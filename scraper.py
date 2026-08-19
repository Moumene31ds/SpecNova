#!/usr/bin/env python3
"""
iToPhone Scraper — Extract ALL smartphones from GSMArena (1996–today)
====================================================================

Usage:
    python scraper.py --mode=full           # Scrape all brands + all phones
    python scraper.py --mode=daily          # Scrape only today's new releases
    python scraper.py --mode=full --brands=samsung,apple  # Specific brands only
    python scraper.py --mode=full --download-images        # Download images locally
    python scraper.py --resume              # Resume from last checkpoint
    python scraper.py --stats               # Show progress statistics

Output:
    phones.json       — Array of ScrapedPhone objects
    progress.json     — Checkpoint for resuming interrupted scrapes
    public/images/phones/ — Downloaded images (if --download-images)

Dependencies:
    pip install requests beautifulsoup4 lxml tqdm
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag
from tqdm import tqdm

# ============================================================================
# Configuration
# ============================================================================

BASE_URL = "https://www.gsmarena.com"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0",
]
REQUEST_DELAY = (2.0, 4.0)      # Random delay between requests (min, max) seconds
IMAGE_DELAY = (0.3, 0.8)        # Delay between image downloads
MAX_RETRIES = 3                 # Max retries per request
RETRY_BACKOFF = 5               # Base backoff for retries
PROGRESS_FILE = "progress.json"
OUTPUT_FILE = "phones.json"
IMAGES_DIR = "public/images/phones"
LOG_FILE = "scraper.log"

# Brand color map for UI glow effects
BRAND_COLORS: dict[str, str] = {
    "samsung": "#1428A0",
    "apple": "#A2AAAD",
    "google": "#4285F4",
    "xiaomi": "#FF6700",
    "oneplus": "#F5010C",
    "huawei": "#CF0A2C",
    "oppo": "#1BA784",
    "vivo": "#415FFF",
    "realme": "#FFC800",
    "sony": "#000000",
    "nokia": "#124191",
    "motorola": "#5C2D91",
    "lg": "#A50034",
    "honor": "#00B0F0",
    "nothing": "#000000",
    "asus": "#00529B",
    "lenovo": "#E2231A",
    "tecno": "#0066CC",
    "infinix": "#F37920",
    "iqoo": "#F5C518",
    "redmi": "#FF4500",
    "poco": "#FBC02D",
    "zte": "#0057B8",
    "meizu": "#1E90FF",
    "blackberry": "#000000",
    "htc": "#6DB33F",
    "alcatel": "#FF6600",
    "panasonic": "#003DA5",
    "sharp": "#C4002F",
    "cat": "#FFD700",
    "tcl": "#000000",
    "fairphone": "#2DB84B",
    "nothing": "#000000",
    "google pixel": "#4285F4",
}

# ============================================================================
# Logging
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("gsmarena")

# ============================================================================
# Data Models
# ============================================================================


@dataclass
class CameraLens:
    label: str = "wide"
    megapixels: Optional[float] = None
    aperture: str = ""
    sensorSize: str = ""
    pixelSizeUm: Optional[float] = None
    fovDeg: Optional[float] = None
    opticalZoom: Optional[float] = None
    stabilization: str = ""
    features: list[str] = field(default_factory=list)


@dataclass
class PhoneData:
    id: str = ""
    slug: str = ""
    name: str = ""
    brand: str = ""
    gsmarenaId: Optional[int] = None
    sourceUrl: str = ""
    announcedAt: Optional[str] = None
    releaseAt: Optional[str] = None
    releaseYear: Optional[int] = None
    status: str = "available"
    images: dict = field(default_factory=lambda: {
        "main": None,
        "gallery": [],
        "renders": [],
        "cameraSamples": [],
    })
    specs: dict = field(default_factory=dict)
    pricing: dict = field(default_factory=lambda: {
        "msrp": None,
        "currency": "USD",
        "startingPrice": None,
    })
    scrapedAt: str = ""
    updatedAt: str = ""


# ============================================================================
# HTTP Session
# ============================================================================


class HTTPSession:
    """Rotating user-agent session with retries and rate limiting."""

    def __init__(self):
        self.session = requests.Session()
        self._ua_index = 0
        self._last_request = 0.0
        self._request_count = 0
        self.session.headers.update({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })

    def _rotate_ua(self):
        self._ua_index = (self._ua_index + 1) % len(USER_AGENTS)
        self.session.headers["User-Agent"] = USER_AGENTS[self._ua_index]

    def _rate_limit(self):
        elapsed = time.time() - self._last_request
        delay = REQUEST_DELAY[0] + (REQUEST_DELAY[1] - REQUEST_DELAY[0]) * __import__("random").random()
        if elapsed < delay:
            time.sleep(delay - elapsed)

    def get(self, url: str, retries: int = MAX_RETRIES) -> Optional[requests.Response]:
        for attempt in range(retries):
            self._rotate_ua()
            self._rate_limit()
            try:
                resp = self.session.get(url, timeout=30)
                self._last_request = time.time()
                self._request_count += 1

                if resp.status_code == 200:
                    return resp
                elif resp.status_code == 403:
                    log.warning(f"403 Forbidden (attempt {attempt + 1}): {url}")
                    time.sleep(RETRY_BACKOFF * (attempt + 1) * 2)
                elif resp.status_code == 429:
                    log.warning(f"429 Rate Limited (attempt {attempt + 1}): {url}")
                    time.sleep(RETRY_BACKOFF * (attempt + 1) * 3)
                elif resp.status_code == 404:
                    log.debug(f"404 Not Found: {url}")
                    return None
                else:
                    log.warning(f"HTTP {resp.status_code} (attempt {attempt + 1}): {url}")
                    time.sleep(RETRY_BACKOFF * (attempt + 1))
            except requests.RequestException as e:
                log.error(f"Request error (attempt {attempt + 1}): {e}")
                time.sleep(RETRY_BACKOFF * (attempt + 1))

        log.error(f"Failed after {retries} attempts: {url}")
        return None

    def get_image(self, url: str, save_path: Path) -> bool:
        """Download an image with proper headers."""
        for attempt in range(MAX_RETRIES):
            self._rotate_ua()
            time.sleep(IMAGE_DELAY[0] + (IMAGE_DELAY[1] - IMAGE_DELAY[0]) * __import__("random").random())
            try:
                resp = self.session.get(url, timeout=30, stream=True)
                self._last_request = time.time()
                if resp.status_code == 200:
                    save_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(save_path, "wb") as f:
                        for chunk in resp.iter_content(8192):
                            f.write(chunk)
                    return True
                else:
                    log.debug(f"Image download failed {resp.status_code}: {url}")
            except Exception as e:
                log.debug(f"Image download error: {e}")
            time.sleep(1)
        return False

    @property
    def request_count(self) -> int:
        return self._request_count


# ============================================================================
# GSMArena Parsers
# ============================================================================


def parse_text(soup: BeautifulSoup, selector: str, strip: bool = True) -> str:
    """Extract text from a CSS selector."""
    el = soup.select_one(selector)
    if el and el.string:
        text = el.string.strip() if strip else el.string
        return text
    return ""


def parse_all_text(soup: BeautifulSoup, selector: str) -> str:
    """Extract all text content from a selector (including children)."""
    el = soup.select_one(selector)
    if el:
        return el.get_text(separator=" ", strip=True)
    return ""


def parse_int(text: str) -> Optional[int]:
    """Extract first integer from text."""
    match = re.search(r"[\d,]+", text.replace(",", ""))
    if match:
        try:
            return int(match.group().replace(",", ""))
        except ValueError:
            return None
    return None


def parse_float(text: str) -> Optional[float]:
    """Extract first float from text."""
    match = re.search(r"[\d.]+", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# Brand Discovery
# ---------------------------------------------------------------------------


def discover_brands(session: HTTPSession) -> list[dict[str, str]]:
    """Get all brands from GSMArena makers page."""
    log.info("Discovering brands...")
    url = f"{BASE_URL}/makers.php"
    resp = session.get(url)
    if not resp:
        log.error("Failed to fetch brand list")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    brands = []

    # GSMArena brand links are in <div class="brandmenu-v2">
    for link in soup.select("a[href]"):
        href = link.get("href", "")
        # Brand pages look like: samsung-phones-f-1.php
        if re.match(r"^[a-z0-9-]+-phones-f-\d+\.php$", href):
            name = link.get_text(strip=True)
            if name and len(name) > 1:
                slug = href.split("-phones")[0]
                brands.append({
                    "name": name,
                    "slug": slug,
                    "url": f"{BASE_URL}/{href}",
                })

    log.info(f"Found {len(brands)} brands")
    return sorted(brands, key=lambda b: b["name"].lower())


# ---------------------------------------------------------------------------
# Phone List Discovery (per brand, with pagination)
# ---------------------------------------------------------------------------


def discover_brand_phones(session: HTTPSession, brand_url: str) -> list[dict[str, str]]:
    """Get all phone page URLs for a brand (handles pagination)."""
    phones = []
    page = 1

    while True:
        if page == 1:
            url = brand_url
        else:
            # GSMArena pagination: samsung-phones-f-1.php -> samsung-phones-f-1-p2.php
            url = brand_url.replace(".php", f"-p{page}.php")

        resp = session.get(url)
        if not resp:
            break

        soup = BeautifulSoup(resp.text, "lxml")
        found_on_page = 0

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            # Phone detail pages look like: samsung_galaxy_s24_ultra-12712.php
            match = re.match(r"^([a-z0-9_]+)-(\d+)\.php$", href)
            if match:
                name_el = link.select_one(".phone-name, span")
                name = name_el.get_text(strip=True) if name_el else link.get_text(strip=True)
                if name:
                    phones.append({
                        "name": name,
                        "slug": href.replace(".php", ""),
                        "url": f"{BASE_URL}/{href}",
                        "gsmarenaId": int(match.group(2)),
                    })
                    found_on_page += 1

        if found_on_page == 0:
            break

        # Check for next page
        next_link = soup.select_one("a.down-pagination")
        if not next_link:
            break

        page += 1

    # Deduplicate by URL
    seen = set()
    unique = []
    for p in phones:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique.append(p)

    return unique


# ---------------------------------------------------------------------------
# Phone Detail Extraction
# ---------------------------------------------------------------------------


def extract_phone_detail(session: HTTPSession, phone: dict, download_images: bool = False) -> Optional[PhoneData]:
    """Extract full specs from a GSMArena phone detail page."""
    resp = session.get(phone["url"])
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    now = datetime.now(timezone.utc).isoformat()

    data = PhoneData()
    data.id = phone["slug"]
    data.slug = phone["slug"]
    data.name = phone.get("name", "").strip()
    data.gsmarenaId = phone.get("gsmarenaId")
    data.sourceUrl = phone["url"]
    data.scrapedAt = now
    data.updatedAt = now

    # ── Brand ──
    brand_el = soup.select_one(".brandmenu-v2 a.active, .article-info .brand")
    if brand_el:
        data.brand = brand_el.get_text(strip=True)
    else:
        # Infer brand from slug (first part before underscore)
        data.brand = phone["slug"].split("_")[0].replace("-", " ").title()

    # ── Dates ──
    launch_el = soup.select_one(".launch-date")
    if launch_el:
        date_text = launch_el.get_text(" ", strip=True)
        # "Announced 2024, January 17"
        announced = re.search(r"(\d{4})(?:,\s*([A-Za-z]+)\s*(\d{1,2}))?", date_text)
        if announced:
            year = announced.group(1)
            month = announced.group(2) or ""
            day = announced.group(3) or ""
            if month:
                month_map = {
                    "january": "01", "february": "02", "march": "03", "april": "04",
                    "may": "05", "june": "06", "july": "07", "august": "08",
                    "september": "09", "october": "10", "november": "11", "december": "12",
                }
                month_num = month_map.get(month.lower(), "")
                if month_num and day:
                    data.announcedAt = f"{year}-{month_num}-{day.zfill(2)}"
                elif month_num:
                    data.announcedAt = f"{year}-{month_num}"
                else:
                    data.announcedAt = year
            else:
                data.announcedAt = year

            try:
                data.releaseYear = int(year)
            except ValueError:
                pass

    # Release status
    status_el = soup.select_one(".status")
    if status_el:
        status_text = status_el.get_text(strip=True).lower()
        if "discontinued" in status_text:
            data.status = "discontinued"
        elif "available" in status_text:
            data.status = "available"
        elif "expected" in status_text or "upcoming" in status_text:
            data.status = "upcoming"
        elif "rumored" in status_text:
            data.status = "rumored"
        else:
            data.status = "available"
    else:
        data.status = "available"

    # ── Images ──
    images = extract_images(soup, phone["url"], download_images, data.slug)
    data.images = images

    # ── Specs Table ──
    specs = extract_specs_table(soup)
    data.specs = specs

    # ── Pricing ──
    price_el = soup.select_one(".price-body, .pricing")
    if price_el:
        price_text = price_el.get_text(strip=True)
        price_val = parse_float(price_text.replace(",", ""))
        if price_val:
            data.pricing["msrp"] = price_val
            data.pricing["startingPrice"] = price_val

    return data


def extract_images(soup: BeautifulSoup, page_url: str, download: bool, slug: str) -> dict:
    """Extract all images from the phone detail page."""
    images: dict[str, Any] = {
        "main": None,
        "gallery": [],
        "renders": [],
        "cameraSamples": [],
    }

    # Main product image
    main_img = soup.select_one(".phone-image img, .review-body img, #review-body img, img.phone")
    if main_img:
        src = main_img.get("src") or main_img.get("data-src", "")
        if src:
            images["main"] = ensure_absolute_url(src, page_url)

    # Gallery images (color variants, different angles)
    gallery_links = soup.select(".picture-list a img, .gallery a img, .review-gallery img")
    for img in gallery_links:
        src = img.get("src") or img.get("data-src", "")
        if src:
            url = ensure_absolute_url(src, page_url)
            if url and url not in images["gallery"]:
                images["gallery"].append(url)

    # Official renders (usually in the "pictures" section)
    render_imgs = soup.select(".pictures a[href], .official-press-imgs a[href]")
    for link in render_imgs:
        href = link.get("href", "")
        if href and ("pictures" in href or "pictures" in page_url):
            url = ensure_absolute_url(href, page_url)
            if url and url not in images["renders"]:
                images["renders"].append(url)

    # Camera samples
    sample_imgs = soup.select(".camera-sample img, .sample-photo img")
    for img in sample_imgs:
        src = img.get("src") or img.get("data-src", "")
        if src:
            url = ensure_absolute_url(src, page_url)
            if url and url not in images["cameraSamples"]:
                images["cameraSamples"].append(url)

    # If no gallery, add the main image as the only gallery entry
    if not images["gallery"] and images["main"]:
        images["gallery"] = [images["main"]]

    # Download images if requested
    if download:
        images = download_phone_images(images, slug)

    return images


def ensure_absolute_url(url: str, base_url: str) -> str:
    """Ensure URL is absolute."""
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    return urljoin(base_url, url)


def download_phone_images(images: dict, slug: str) -> dict:
    """Download images to public/images/phones/ and update URLs to local paths."""
    http = HTTPSession()
    local_images: dict[str, Any] = {
        "main": None,
        "gallery": [],
        "renders": [],
        "cameraSamples": [],
    }

    img_dir = Path(IMAGES_DIR)

    def download_one(url: str, suffix: str = "") -> Optional[str]:
        if not url:
            return None
        # Generate filename from URL hash
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        ext = ".jpg"
        if ".png" in url.lower():
            ext = ".png"
        elif ".webp" in url.lower():
            ext = ".webp"
        filename = f"{slug}{suffix}-{url_hash}{ext}"
        save_path = img_dir / filename

        if save_path.exists():
            return f"/images/phones/{filename}"

        if http.get_image(url, save_path):
            return f"/images/phones/{filename}"
        return None

    # Download main image
    local_images["main"] = download_one(images.get("main"), "-main")

    # Download gallery (limit to 8)
    for i, url in enumerate(images.get("gallery", [])[:8]):
        local_url = download_one(url, f"-{i + 1}")
        if local_url:
            local_images["gallery"].append(local_url)

    # Download renders (limit to 4)
    for i, url in enumerate(images.get("renders", [])[:4]):
        local_url = download_one(url, f"-render-{i + 1}")
        if local_url:
            local_images["renders"].append(local_url)

    # Download camera samples (limit to 6)
    for i, url in enumerate(images.get("cameraSamples", [])[:6]):
        local_url = download_one(url, f"-sample-{i + 1}")
        if local_url:
            local_images["cameraSamples"].append(local_url)

    return local_images


# ---------------------------------------------------------------------------
# Specs Table Parser
# ---------------------------------------------------------------------------


def extract_specs_table(soup: BeautifulSoup) -> dict:
    """Parse the GSMArena specs table into a structured dict."""
    specs: dict[str, Any] = {
        "body": {
            "dimensions": "",
            "weightG": None,
            "build": "",
            "ipRating": "",
            "sim": "",
            "colors": [],
            "materials": [],
        },
        "screen": {
            "type": "",
            "sizeIn": None,
            "resolution": "",
            "ppi": None,
            "refreshRateHz": None,
            "peakBrightnessNits": None,
            "hdr": [],
            "protection": "",
            "touchSamplingHz": None,
        },
        "cameras": {
            "rear": [],
            "front": None,
            "videoMax": "",
            "features": [],
        },
        "platform": {
            "os": "",
            "ui": "",
            "chipset": "",
            "processNodeNm": None,
            "cpu": "",
            "gpu": "",
            "antutuV10": None,
            "geekbench6Single": None,
            "geekbench6Multi": None,
        },
        "memory": {
            "ramGb": [],
            "storageGb": [],
            "storageType": "",
            "cardSlot": False,
        },
        "battery": {
            "capacityMah": None,
            "type": "Li-Po",
            "chargingW": None,
            "wirelessChargingW": None,
            "reverseW": None,
        },
        "connectivity": {
            "network": "",
            "wifi": "",
            "bluetooth": "",
            "nfc": False,
            "usb": "",
            "irBlaster": False,
            "satelliteSos": False,
            "uwb": False,
        },
        "extras": {
            "fingerprint": "",
            "faceUnlock": False,
            "stylus": False,
            "stylusStorage": False,
            "speakers": "",
            "headphoneJack": False,
            "fmRadio": False,
            "sensors": [],
        },
    }

    # GSMArena uses a single table with class "spec-table" or "nfo"
    # Each row has a <th> (label) and <td> (value)
    tables = soup.select("table.spec-table, table.nfo, #specs-list table")
    if not tables:
        # Fallback: try all tables on the page
        tables = soup.select("table")

    for table in tables:
        rows = table.select("tr")
        current_section = ""

        for row in rows:
            th = row.select_one("th")
            td = row.select_one("td")

            if th and not td:
                # Section header
                current_section = th.get_text(strip=True).lower()
                continue

            if not th or not td:
                continue

            label = th.get_text(strip=True).lower()
            value = td.get_text(" ", strip=True)

            # ── Body ──
            if "dimensions" in label:
                specs["body"]["dimensions"] = value
            elif "weight" in label:
                specs["body"]["weightG"] = parse_float(value)
            elif label in ("build", "build type"):
                specs["body"]["build"] = value
            elif "ip rating" in label or "protection" in label or "dust" in label:
                specs["body"]["ipRating"] = value
            elif "sim" in label and "size" not in label:
                specs["body"]["sim"] = value
            elif "color" in label:
                specs["body"]["colors"] = parse_color_list(value)
            elif "material" in label:
                specs["body"]["materials"] = [m.strip() for m in value.split(",") if m.strip()]

            # ── Display ──
            elif "type" in label and ("display" in current_section or "screen" in current_section):
                specs["screen"]["type"] = value
            elif "type" in label and not specs["screen"]["type"]:
                specs["screen"]["type"] = value
            elif "size" in label and "inches" in value.lower() or re.search(r'[\d.]+["″]', value):
                specs["screen"]["sizeIn"] = parse_float(value)
            elif "resolution" in label:
                specs["screen"]["resolution"] = value
            elif "ppi" in label:
                specs["screen"]["ppi"] = parse_int(value)
            elif "refresh" in label or "hz" in label.lower():
                specs["screen"]["refreshRateHz"] = parse_int(value)
            elif "brightness" in label or "nits" in label.lower():
                specs["screen"]["peakBrightnessNits"] = parse_int(value)
            elif "hdr" in label:
                specs["screen"]["hdr"] = [h.strip() for h in value.split(",") if h.strip()]
            elif "protection" in label or "glass" in label:
                specs["screen"]["protection"] = value
            elif "touch" in label and "sampling" in label:
                specs["screen"]["touchSamplingHz"] = parse_int(value)

            # ── Platform ──
            elif "os" in label and "operating" in current_section:
                specs["platform"]["os"] = value
            elif "chipset" in label:
                specs["platform"]["chipset"] = value
                # Try to extract process node
                node_match = re.search(r"(\d+)\s*nm", value)
                if node_match:
                    specs["platform"]["processNodeNm"] = int(node_match.group(1))
            elif "cpu" in label and "processor" not in label:
                specs["platform"]["cpu"] = value
            elif "gpu" in label:
                specs["platform"]["gpu"] = value
            elif "antutu" in label:
                specs["platform"]["antutuV10"] = parse_int(value)
            elif "geekbench" in label:
                gb_match = re.search(r"(\d+)\s*(?:points?)?,?\s*(?:for\s*)?(\d+)?", value)
                if gb_match:
                    specs["platform"]["geekbench6Single"] = int(gb_match.group(1))
                    if gb_match.group(2):
                        specs["platform"]["geekbench6Multi"] = int(gb_match.group(2))

            # ── Memory ──
            elif "ram" in label:
                specs["memory"]["ramGb"] = parse_ram_storage(value)
            elif "internal" in label or "storage" in label:
                specs["memory"]["storageGb"] = parse_ram_storage(value)
                if "ufs" in value.lower():
                    ufs_match = re.search(r"UFS\s*(\d+\.\d+)", value, re.I)
                    if ufs_match:
                        specs["memory"]["storageType"] = f"UFS {ufs_match.group(1)}"
                elif "emmc" in value.lower():
                    specs["memory"]["storageType"] = "eMMC 5.1"
            elif "card" in label and "slot" in label:
                specs["memory"]["cardSlot"] = value.lower() not in ("no", "none", "")

            # ── Battery ──
            elif "capacity" in label or ("battery" in label and "type" not in label):
                specs["battery"]["capacityMah"] = parse_int(value)
            elif "type" in label and "battery" in current_section:
                specs["battery"]["type"] = value
            elif "charging" in label and "wireless" not in label:
                specs["battery"]["chargingW"] = parse_int(value)
            elif "wireless" in label and "charging" in label:
                specs["battery"]["wirelessChargingW"] = parse_int(value)
            elif "reverse" in label:
                specs["battery"]["reverseW"] = parse_int(value)

            # ── Connectivity ──
            elif "technology" in label or "network" in label:
                specs["connectivity"]["network"] = value
            elif "wlan" in label or "wifi" in label.lower():
                specs["connectivity"]["wifi"] = value
            elif "bluetooth" in label:
                specs["connectivity"]["bluetooth"] = value
            elif "nfc" in label:
                specs["connectivity"]["nfc"] = value.lower() not in ("no", "none", "")
            elif "usb" in label:
                specs["connectivity"]["usb"] = value
            elif "infrared" in label:
                specs["connectivity"]["irBlaster"] = value.lower() not in ("no", "none", "")

            # ── Extras ──
            elif "fingerprint" in label:
                specs["extras"]["fingerprint"] = value
            elif "face" in label and "unlock" in label:
                specs["extras"]["faceUnlock"] = value.lower() not in ("no", "none", "")
            elif "stylus" in label or "pen" in label:
                specs["extras"]["stylus"] = value.lower() not in ("no", "none", "")
            elif "speaker" in label:
                specs["extras"]["speakers"] = value
            elif "3.5mm" in label or "headphone" in label or "jack" in label:
                specs["extras"]["headphoneJack"] = value.lower() not in ("no", "none", "")
            elif "radio" in label and "fm" in label:
                specs["extras"]["fmRadio"] = value.lower() not in ("no", "none", "")
            elif "sensor" in label:
                specs["extras"]["sensors"] = [s.strip() for s in value.split(",") if s.strip()]

            # ── Camera ──
            elif "main camera" in label or "quad camera" in label or "triple camera" in label or "dual camera" in label or "single camera" in label:
                # Camera features line
                specs["cameras"]["features"] = [f.strip() for f in value.split(",") if f.strip()]

            elif "video" in label and ("max" in label or "resolution" in label or current_section in ("main camera", "selfie camera", "camera")):
                if "front" in current_section or "selfie" in current_section:
                    # Front camera video
                    pass
                else:
                    specs["cameras"]["videoMax"] = value

            elif "selfie" in label or "front" in label:
                lens = parse_camera_from_text(value, td)
                if lens:
                    specs["cameras"]["front"] = lens

    # ── Parse rear cameras from the detail sections ──
    # GSMArena often lists camera details in separate sections
    camera_sections = soup.select(".camera-feature, .cameras-info")
    if not camera_sections:
        # Try to parse from the main specs table camera rows
        rear_cameras = parse_rear_cameras_from_specs(soup)
        if rear_cameras:
            specs["cameras"]["rear"] = rear_cameras

    # If we still have no cameras, try to parse from the text
    if not specs["cameras"]["rear"]:
        camera_text = extract_camera_text(soup)
        if camera_text:
            lenses = parse_camera_text_to_lenses(camera_text)
            specs["cameras"]["rear"] = lenses

    return specs


def parse_rear_cameras_from_specs(soup: BeautifulSoup) -> list[dict]:
    """Parse rear cameras from the specs table detail rows."""
    cameras = []

    # Look for camera detail sections in the table
    for row in soup.select("tr"):
        th = row.select_one("th")
        td = row.select_one("td")
        if not th or not td:
            continue

        label = th.get_text(strip=True).lower()
        value = td.get_text(" ", strip=True)

        # Match individual camera specs like "200 MP, f/1.7, 23mm (wide)"
        camera_match = re.match(
            r"(\d+(?:\.\d+)?)\s*(?:MP|megapixel)",
            value,
            re.IGNORECASE,
        )
        if camera_match:
            mp = float(camera_match.group(1))
            aperture_match = re.search(r"f/(\d+(?:\.\d+)?)", value)
            aperture = f"f/{aperture_match.group(1)}" if aperture_match else ""

            sensor_match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)["″]', value)
            sensor_size = f'1/{sensor_match.group(2)}"' if sensor_match else ""

            pixel_match = re.search(r"([\d.]+)\s*µm", value)
            pixel_size = float(pixel_match.group(1)) if pixel_match else None

            fov_match = re.search(r"(\d+(?:\.\d+)?)\s*mm", value)
            fov = float(fov_match.group(1)) if fov_match else None

            zoom_match = re.search(r"(\d+(?:\.\d+)?)x\s*(?:optical|zoom)", value, re.I)
            optical_zoom = float(zoom_match.group(1)) if zoom_match else None

            ois = "OIS" if "ois" in value.lower() or "optical image" in value.lower() else ""

            # Determine lens type
            lens_type = "wide"
            if "ultra" in value.lower() or "uwd" in value.lower():
                lens_type = "ultrawide"
            elif "telephoto" in value.lower() or "periscope" in value.lower() or (optical_zoom and optical_zoom > 2):
                lens_type = "periscope" if "periscope" in value.lower() or (optical_zoom and optical_zoom >= 5) else "telephoto"
            elif "macro" in value.lower():
                lens_type = "macro"
            elif "depth" in value.lower():
                lens_type = "depth"

            cameras.append({
                "label": lens_type,
                "megapixels": mp,
                "aperture": aperture,
                "sensorSize": sensor_size,
                "pixelSizeUm": pixel_size,
                "fovDeg": fov,
                "opticalZoom": optical_zoom,
                "stabilization": ois,
                "features": [],
            })

    return cameras


def extract_camera_text(soup: BeautifulSoup) -> str:
    """Extract camera description text from the page."""
    # Try the cameras section
    for section in soup.select("#camera, .camera, [id*='camera']"):
        text = section.get_text(" ", strip=True)
        if "MP" in text or "megapixel" in text.lower():
            return text

    # Fallback: look for the camera info in the specs table
    for row in soup.select("tr"):
        th = row.select_one("th")
        if th and "camera" in th.get_text(strip=True).lower():
            td = row.select_one("td")
            if td:
                return td.get_text(" ", strip=True)

    return ""


def parse_camera_text_to_lenses(text: str) -> list[dict]:
    """Parse camera specifications from free-form text."""
    lenses = []

    # Split by common delimiters
    parts = re.split(r"[+|]", text)

    for part in parts:
        part = part.strip()
        mp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:MP|megapixel)", part, re.I)
        if not mp_match:
            continue

        mp = float(mp_match.group(1))
        aperture_match = re.search(r"f/(\d+(?:\.\d+)?)", part)
        aperture = f"f/{aperture_match.group(1)}" if aperture_match else ""

        zoom_match = re.search(r"(\d+(?:\.\d+)?)x", part)
        optical_zoom = float(zoom_match.group(1)) if zoom_match else None

        lens_type = "wide"
        if "ultra" in part.lower():
            lens_type = "ultrawide"
        elif "tele" in part.lower() or "zoom" in part.lower():
            lens_type = "telephoto"
        elif "periscope" in part.lower():
            lens_type = "periscope"
        elif "macro" in part.lower():
            lens_type = "macro"
        elif "depth" in part.lower():
            lens_type = "depth"

        ois = "OIS" if "ois" in part.lower() else ""

        lenses.append({
            "label": lens_type,
            "megapixels": mp,
            "aperture": aperture,
            "sensorSize": "",
            "pixelSizeUm": None,
            "fovDeg": None,
            "opticalZoom": optical_zoom,
            "stabilization": ois,
            "features": [],
        })

    return lenses


def parse_camera_from_text(text: str, td: Tag) -> Optional[dict]:
    """Parse a camera lens spec from text."""
    mp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:MP|megapixel)", text, re.I)
    if not mp_match:
        return None

    mp = float(mp_match.group(1))
    aperture_match = re.search(r"f/(\d+(?:\.\d+)?)", text)
    aperture = f"f/{aperture_match.group(1)}" if aperture_match else ""

    lens_type = "selfie" if "selfie" in text.lower() or "front" in text.lower() else "wide"
    ois = "OIS" if "ois" in text.lower() else ""

    return {
        "label": lens_type,
        "megapixels": mp,
        "aperture": aperture,
        "sensorSize": "",
        "pixelSizeUm": None,
        "fovDeg": None,
        "opticalZoom": None,
        "stabilization": ois,
        "features": [],
    }


def parse_color_list(text: str) -> list[str]:
    """Parse a comma-separated color list."""
    # "Cosmic Black, Nebula Blue, Silver" -> ["Cosmic Black", "Nebula Blue", "Silver"]
    # Handle "Also in X colors: A, B, C" pattern
    text = re.sub(r"^(?:also\s+)?(?:in\s+)?(?:\d+\s+)?(?:additional\s+)?colou?rs?\s*:?\s*", "", text, flags=re.I)
    colors = re.split(r",\s*(?=[A-Z])", text)
    return [c.strip() for c in colors if c.strip() and len(c.strip()) > 1]


def parse_ram_storage(text: str) -> list[int]:
    """Parse RAM/Storage options like '256GB / 512GB / 1TB' or '8GB RAM'."""
    # Extract all numbers with their units
    options = []
    parts = re.split(r"[/,]", text)

    for part in parts:
        part = part.strip()
        gb_match = re.search(r"(\d+)\s*GB", part, re.I)
        tb_match = re.search(r"(\d+)\s*TB", part, re.I)

        if gb_match:
            options.append(int(gb_match.group(1)))
        elif tb_match:
            options.append(int(tb_match.group(1)) * 1024)

    return sorted(set(options))


# ---------------------------------------------------------------------------
# Daily Mode — Get latest phones
# ---------------------------------------------------------------------------


def discover_daily_phones(session: HTTPSession) -> list[dict]:
    """Get phones from the 'latest' / 'just announced' page."""
    log.info("Fetching latest phones...")

    phones = []
    urls_to_try = [
        f"{BASE_URL}/phones.php3",
        f"{BASE_URL}/newphones.php",
    ]

    for url in urls_to_try:
        resp = session.get(url)
        if not resp:
            continue

        soup = BeautifulSoup(resp.text, "lxml")

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            match = re.match(r"^([a-z0-9_]+)-(\d+)\.php$", href)
            if match:
                name = link.get_text(strip=True)
                if name:
                    phones.append({
                        "name": name,
                        "slug": href.replace(".php", ""),
                        "url": f"{BASE_URL}/{href}",
                        "gsmarenaId": int(match.group(2)),
                    })

        if phones:
            break

    # Deduplicate
    seen = set()
    unique = []
    for p in phones:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique.append(p)

    log.info(f"Found {len(unique)} latest phones")
    return unique


# ============================================================================
# Progress / Checkpoint Management
# ============================================================================


@dataclass
class Progress:
    mode: str = "full"
    startedAt: str = ""
    lastBrand: Optional[str] = None
    lastPage: int = 0
    totalBrands: int = 0
    completedBrands: int = 0
    totalPhones: int = 0
    scrapedPhones: int = 0
    scrapedSlugs: list[str] = field(default_factory=list)
    failedUrls: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)

    def save(self):
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(asdict(self), f, indent=2, ensure_ascii=False)

    @classmethod
    def load(cls) -> "Progress":
        if os.path.exists(PROGRESS_FILE):
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()


# ============================================================================
# Main Scraper Engine
# ============================================================================


class PhoneScraper:
    """Main scraper orchestrator."""

    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.http = HTTPSession()
        self.progress = Progress()
        self.phones: list[PhoneData] = []
        self._load_existing()

    def _load_existing(self):
        """Load existing phones.json if it exists."""
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                # Convert dicts back to PhoneData objects
                for item in data:
                    phone = PhoneData()
                    for k, v in item.items():
                        if hasattr(phone, k):
                            setattr(phone, k, v)
                    self.phones.append(phone)
                log.info(f"Loaded {len(self.phones)} existing phones from {OUTPUT_FILE}")
            except Exception as e:
                log.warning(f"Could not load existing {OUTPUT_FILE}: {e}")

    def run(self):
        """Main entry point."""
        self.progress.mode = self.args.mode
        self.progress.startedAt = datetime.now(timezone.utc).isoformat()

        if self.args.resume:
            self.progress = Progress.load()
            log.info(f"Resuming from checkpoint: brand={self.progress.lastBrand}, page={self.progress.lastPage}")
        elif self.args.stats:
            self._show_stats()
            return

        try:
            if self.args.mode == "daily":
                self._run_daily()
            else:
                self._run_full()
        except KeyboardInterrupt:
            log.info("\nInterrupted! Saving progress...")
            self.progress.save()
        except Exception as e:
            log.error(f"Scraper error: {e}", exc_info=True)
            self.progress.save()
        finally:
            self._save_output()

    def _run_full(self):
        """Scrape all brands and all phones."""
        brands = discover_brands(self.http)

        if self.args.brands:
            filter_brands = [b.lower() for b in self.args.brands.split(",")]
            brands = [b for b in brands if b["slug"].lower() in filter_brands or b["name"].lower() in filter_brands]
            log.info(f"Filtered to {len(brands)} brands: {[b['name'] for b in brands]}")

        self.progress.totalBrands = len(brands)

        # Resume from last completed brand
        start_idx = 0
        if self.progress.lastBrand:
            for i, brand in enumerate(brands):
                if brand["slug"] == self.progress.lastBrand:
                    start_idx = i + 1
                    break

        for i, brand in enumerate(brands[start_idx:], start=start_idx):
            self.progress.lastBrand = brand["slug"]
            self.progress.completedBrands = i

            log.info(f"[{i + 1}/{len(brands)}] Scraping brand: {brand['name']}")
            self._scrape_brand(brand)

            # Save checkpoint after each brand
            self.progress.save()

        self.progress.completedBrands = len(brands)
        self.progress.save()

    def _run_daily(self):
        """Scrape only today's new releases."""
        daily_phones = discover_daily_phones(self.http)
        self.progress.totalPhones = len(daily_phones)

        existing_slugs = {p.slug for p in self.phones}
        new_phones = [p for p in daily_phones if p["slug"] not in existing_slugs]

        log.info(f"Found {len(new_phones)} new phones to scrape (out of {len(daily_phones)} total)")

        for i, phone in enumerate(new_phones):
            self.progress.scrapedPhones = i + 1
            log.info(f"[{i + 1}/{len(new_phones)}] {phone['name']}")
            self._scrape_phone(phone)

        self.progress.save()

    def _scrape_brand(self, brand: dict):
        """Scrape all phones for a single brand."""
        phones = discover_brand_phones(self.http, brand["url"])
        self.progress.totalPhones += len(phones)

        existing_slugs = {p.slug for p in self.phones}
        new_phones = [p for p in phones if p["slug"] not in existing_slugs]

        if not new_phones:
            log.info(f"  All {len(phones)} phones already scraped, skipping")
            return

        log.info(f"  {len(new_phones)} new phones to scrape (out of {len(phones)})")

        for i, phone in enumerate(new_phones):
            log.info(f"  [{i + 1}/{len(new_phones)}] {phone['name']}")
            self._scrape_phone(phone)

    def _scrape_phone(self, phone: dict):
        """Scrape a single phone and add to the collection."""
        try:
            data = extract_phone_detail(
                self.http,
                phone,
                download_images=self.args.download_images,
            )
            if data:
                # Set brand color
                brand_key = data.brand.lower().split()[0]
                data_dict = asdict(data)
                data_dict["brandColor"] = BRAND_COLORS.get(brand_key, "#6B7280")

                self.phones.append(data)
                self.progress.scrapedSlugs.append(data.slug)
                self.progress.scrapedPhones += 1
                log.info(f"    ✓ {data.name} ({data.brand}) — {len(data.images.get('gallery', []))} images")
            else:
                log.warning(f"    ✗ No data extracted for {phone['name']}")
                self.progress.failedUrls.append(phone["url"])
        except Exception as e:
            log.error(f"    ✗ Error scraping {phone['name']}: {e}")
            self.progress.failedUrls.append(phone["url"])
            self.progress.errors.append({
                "url": phone["url"],
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    def _save_output(self):
        """Save all scraped phones to phones.json."""
        log.info(f"Saving {len(self.phones)} phones to {OUTPUT_FILE}...")
        output = [asdict(p) for p in self.phones]

        # Sort by brand then name
        output.sort(key=lambda p: (p["brand"].lower(), p["name"].lower()))

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        log.info(f"✓ Saved {len(output)} phones to {OUTPUT_FILE}")
        self._show_stats()

    def _show_stats(self):
        """Display scraping statistics."""
        total = len(self.phones)
        if total == 0:
            log.info("No phones scraped yet.")
            return

        brands = {}
        with_images = 0
        with_specs = 0
        years = {}

        for p in self.phones:
            brands[p.brand] = brands.get(p.brand, 0) + 1
            if p.images.get("main"):
                with_images += 1
            if p.specs:
                with_specs += 1
            if p.releaseYear:
                years[p.releaseYear] = years.get(p.releaseYear, 0) + 1

        log.info("=" * 60)
        log.info("SCRAPER STATISTICS")
        log.info("=" * 60)
        log.info(f"Total phones:    {total}")
        log.info(f"With images:     {with_images} ({with_images * 100 // total}%)")
        log.info(f"With specs:      {with_specs} ({with_specs * 100 // total}%)")
        log.info(f"Unique brands:   {len(brands)}")
        log.info(f"Failed URLs:     {len(self.progress.failedUrls)}")
        log.info("")
        log.info("Top brands:")
        for brand, count in sorted(brands.items(), key=lambda x: -x[1])[:20]:
            log.info(f"  {brand}: {count}")
        log.info("")
        if years:
            log.info(f"Year range: {min(years)} - {max(years)}")
            for year in sorted(years.keys()):
                log.info(f"  {year}: {years[year]}")
        log.info("=" * 60)


# ============================================================================
# CLI
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="iToPhone Scraper — Extract smartphone data from GSMArena",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scraper.py --mode=full                      # Scrape everything
    python scraper.py --mode=full --download-images    # Scrape + download images
    python scraper.py --mode=full --brands=samsung,apple  # Specific brands only
    python scraper.py --mode=daily                     # Today's new phones only
    python scraper.py --resume                         # Resume from checkpoint
    python scraper.py --stats                          # Show statistics
        """,
    )

    parser.add_argument(
        "--mode",
        choices=["full", "daily"],
        default="full",
        help="Scraping mode: full (all phones) or daily (new today)",
    )
    parser.add_argument(
        "--brands",
        type=str,
        default=None,
        help="Comma-separated brand slugs to scrape (e.g. samsung,apple,google)",
    )
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="Download images to public/images/phones/",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint (progress.json)",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show scraping statistics and exit",
    )

    args = parser.parse_args()

    log.info("=" * 60)
    log.info("iToPhone Scraper — GSMArena Data Extractor")
    log.info(f"Mode: {args.mode} | Images: {args.download_images} | Resume: {args.resume}")
    log.info("=" * 60)

    scraper = PhoneScraper(args)
    scraper.run()


if __name__ == "__main__":
    main()
