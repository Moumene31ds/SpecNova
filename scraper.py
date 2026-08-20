#!/usr/bin/env python3
"""
iToPhone Scraper — Extract ALL smartphones from GSMArena (1996–today)
====================================================================

Usage:
    python scraper.py --mode=full                    # All brands + all phones
    python scraper.py --mode=daily                   # Today's new releases only
    python scraper.py --mode=full --brands=samsung,apple  # Specific brands
    python scraper.py --mode=full --download-images  # Download images locally
    python scraper.py --resume                       # Resume from checkpoint
    python scraper.py --stats                        # Show statistics

Output:
    phones.json              — Array of ScrapedPhone objects
    progress.json            — Checkpoint for resume
    public/images/phones/    — Downloaded images (if --download-images)

Dependencies:
    pip install requests beautifulsoup4 lxml tqdm
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
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
REQUEST_DELAY = (4.0, 8.0)
IMAGE_DELAY = (0.3, 0.8)
MAX_RETRIES = 4
RETRY_BACKOFF = 8
PROGRESS_FILE = "progress.json"
OUTPUT_FILE = "phones.json"
IMAGES_DIR = "public/images/phones"
LOG_FILE = "scraper.log"

BRAND_COLORS: dict[str, str] = {
    "samsung": "#1428A0", "apple": "#A2AAAD", "google": "#4285F4",
    "xiaomi": "#FF6700", "oneplus": "#F5010C", "huawei": "#CF0A2C",
    "oppo": "#1BA784", "vivo": "#415FFF", "realme": "#FFC800",
    "sony": "#000000", "nokia": "#124191", "motorola": "#5C2D91",
    "honor": "#00B0F0", "nothing": "#000000", "asus": "#00529B",
    "lenovo": "#E2231A", "tecno": "#0066CC", "infinix": "#F37920",
    "iqoo": "#F5C518", "redmi": "#FF4500", "poco": "#FBC02D",
    "zte": "#0057B8", "meizu": "#1E90FF", "blackberry": "#000000",
    "htc": "#6DB33F", "lg": "#A50034", "alcatel": "#FF6600",
    "panasonic": "#003DA5", "sharp": "#C4002F", "cat": "#FFD700",
    "tcl": "#000000", "fairphone": "#2DB84B",
}

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
# HTTP Session
# ============================================================================

class HTTPSession:
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
        delay = REQUEST_DELAY[0] + (REQUEST_DELAY[1] - REQUEST_DELAY[0]) * random.random()
        if elapsed < delay:
            time.sleep(delay - elapsed)

    def get(self, url: str, retries: int = MAX_RETRIES, referer: str = "") -> Optional[requests.Response]:
        for attempt in range(retries):
            self._rotate_ua()
            self._rate_limit()
            headers = {}
            if referer:
                headers["Referer"] = referer
            try:
                resp = self.session.get(url, timeout=30, headers=headers)
                self._last_request = time.time()
                self._request_count += 1
                if resp.status_code == 200:
                    return resp
                elif resp.status_code in (403, 429):
                    wait = RETRY_BACKOFF * (attempt + 1) * (3 if resp.status_code == 429 else 1)
                    log.warning(f"{resp.status_code} (attempt {attempt + 1}), waiting {wait}s: {url}")
                    time.sleep(wait)
                elif resp.status_code == 404:
                    return None
                else:
                    log.warning(f"HTTP {resp.status_code} (attempt {attempt + 1}): {url}")
                    time.sleep(RETRY_BACKOFF * (attempt + 1))
            except requests.RequestException as e:
                log.error(f"Request error (attempt {attempt + 1}): {e}")
                time.sleep(RETRY_BACKOFF * (attempt + 1))
        return None

    def get_image(self, url: str, save_path: Path) -> bool:
        for attempt in range(MAX_RETRIES):
            self._rotate_ua()
            time.sleep(random.uniform(*IMAGE_DELAY))
            try:
                resp = self.session.get(url, timeout=30, stream=True)
                self._last_request = time.time()
                if resp.status_code == 200:
                    save_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(save_path, "wb") as f:
                        for chunk in resp.iter_content(8192):
                            f.write(chunk)
                    return True
            except Exception:
                pass
            time.sleep(1)
        return False


# ============================================================================
# Text Parsing Helpers
# ============================================================================

def parse_int(text: str) -> Optional[int]:
    match = re.search(r"[\d,]+", text.replace(",", ""))
    if match:
        try:
            return int(match.group().replace(",", ""))
        except ValueError:
            return None
    return None


def parse_float(text: str) -> Optional[float]:
    match = re.search(r"[\d.]+", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def extract_between(text: str, start: str, end: str) -> str:
    """Extract text between two markers."""
    idx_start = text.find(start)
    if idx_start == -1:
        return ""
    idx_start += len(start)
    idx_end = text.find(end, idx_start)
    if idx_end == -1:
        return text[idx_start:]
    return text[idx_start:idx_end]


# ============================================================================
# Brand Discovery
# ============================================================================

def discover_brands(session: HTTPSession) -> list[dict[str, str]]:
    log.info("Discovering brands...")
    url = f"{BASE_URL}/makers.php3"
    resp = session.get(url)
    if not resp:
        log.error("Failed to fetch brand list")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    brands = []

    for link in soup.select("a[href]"):
        href = link.get("href", "")
        # Brand pages: samsung-phones-59.php, apple-phones-48.php
        if re.match(r"^[a-z0-9_-]+-phones-\d+\.php$", href):
            raw_text = link.get_text(strip=True)
            # Text includes count like "Apple148 devices" — strip trailing digits+text
            name = re.sub(r"\d+\s*devices?$", "", raw_text, flags=re.I).strip()
            if name and len(name) > 1:
                slug = href.split("-phones")[0]
                brands.append({
                    "name": name,
                    "slug": slug,
                    "url": f"{BASE_URL}/{href}",
                })

    log.info(f"Found {len(brands)} brands")
    return sorted(brands, key=lambda b: b["name"].lower())


# ============================================================================
# Phone List Discovery (per brand, with pagination)
# ============================================================================

def discover_brand_phones(session: HTTPSession, brand_url: str) -> list[dict[str, str]]:
    phones = []
    page = 1
    brand_name = brand_url.split("/")[-1].split("-phones")[0]

    while True:
        if page == 1:
            url = brand_url
        else:
            # GSMArena pagination: brand-phones-48.php -> brand-phones-48-p2.php
            base = brand_url.replace(".php3", ".php") if brand_url.endswith(".php3") else brand_url.replace(".php", "")
            url = f"{base}-p{page}.php"

        resp = session.get(url, referer=brand_url if page > 1 else f"{BASE_URL}/")
        if not resp:
            break

        soup = BeautifulSoup(resp.text, "lxml")
        found_on_page = 0

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            # Phone detail: apple_iphone_16_pro_max-13123.php
            match = re.match(rf"^{re.escape(brand_name)}_[a-z0-9_]+-\d+\.php$", href)
            if not match:
                # Also match any phone from this brand
                match = re.match(rf"^[a-z0-9_-]+_\w+-\d+\.php$", href)

            if match:
                name = link.get_text(strip=True)
                if name and len(name) > 2:
                    phone_url = f"{BASE_URL}/{href}"
                    if phone_url not in [p["url"] for p in phones]:
                        # Extract numeric ID from URL
                        id_match = re.search(r"-(\d+)\.php$", href)
                        phones.append({
                            "name": name,
                            "slug": href.replace(".php", ""),
                            "url": phone_url,
                            "gsmarenaId": int(id_match.group(1)) if id_match else None,
                        })
                        found_on_page += 1

        if found_on_page == 0:
            break

        # Check for next page link
        next_page = soup.select_one(f'a[href*="-p{page + 1}"]')
        if not next_page:
            break

        page += 1

    log.info(f"  Found {len(phones)} phones across {page} pages")
    return phones


# ============================================================================
# Phone Detail Extraction
# ============================================================================

def extract_phone_detail(session: HTTPSession, phone: dict, download_images: bool = False) -> Optional[Any]:
    resp = session.get(phone["url"], referer=f"{BASE_URL}/")
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    now = datetime.now(timezone.utc).isoformat()

    data = {
        "id": phone["slug"],
        "slug": phone["slug"],
        "name": "",
        "brand": "",
        "gsmarenaId": phone.get("gsmarenaId"),
        "sourceUrl": phone["url"],
        "announcedAt": None,
        "releaseAt": None,
        "releaseYear": None,
        "status": "available",
        "brandColor": "",
        "images": {"main": None, "gallery": [], "renders": [], "cameraSamples": []},
        "specs": {},
        "pricing": {"msrp": None, "currency": "USD", "startingPrice": None},
        "scrapedAt": now,
        "updatedAt": now,
    }

    # ── Title & Brand ──
    h1 = soup.select_one("h1")
    if h1:
        data["name"] = h1.get_text(strip=True)
    else:
        data["name"] = phone.get("name", "")

    # Brand from page (in the title usually "Brand Model")
    brand_match = re.match(r"^(\w[\w\s]*?)\s+", data["name"])
    if brand_match:
        data["brand"] = brand_match.group(1).strip()
    else:
        data["brand"] = phone["slug"].split("_")[0].replace("-", " ").title()

    brand_key = data["brand"].lower().split()[0]
    data["brandColor"] = BRAND_COLORS.get(brand_key, "#6B7280")

    # ── Images ──
    data["images"] = extract_images(soup, phone["url"], download_images, data["slug"])

    # ── Dates & Status ──
    specs_section = soup.select_one("#specs-list")
    if specs_section:
        # Find Launch section
        for row in specs_section.select("tr"):
            cells = row.select("th, td")
            texts = [c.get_text(strip=True) for c in cells]
            full_text = " ".join(texts).lower()

            if "announced" in full_text:
                date_match = re.search(r"(\d{4})(?:,\s*([A-Za-z]+)\s*(\d{1,2}))?", " ".join(texts))
                if date_match:
                    year = date_match.group(1)
                    month = date_match.group(2) or ""
                    day = date_match.group(3) or ""
                    month_map = {
                        "january": "01", "february": "02", "march": "03", "april": "04",
                        "may": "05", "june": "06", "july": "07", "august": "08",
                        "september": "09", "october": "10", "november": "11", "december": "12",
                    }
                    month_num = month_map.get(month.lower(), "")
                    if month_num and day:
                        data["announcedAt"] = f"{year}-{month_num}-{day.zfill(2)}"
                    elif month_num:
                        data["announcedAt"] = f"{year}-{month_num}"
                    else:
                        data["announcedAt"] = year
                    try:
                        data["releaseYear"] = int(year)
                    except ValueError:
                        pass

            if "status" in full_text:
                if "discontinued" in full_text:
                    data["status"] = "discontinued"
                elif "available" in full_text or "released" in full_text:
                    data["status"] = "available"
                elif "expected" in full_text or "upcoming" in full_text:
                    data["status"] = "upcoming"

    # ── Full Specs ──
    data["specs"] = extract_specs(soup)

    # ── Pricing ──
    price_text = ""
    for row in (specs_section.select("tr") if specs_section else []):
        th = row.select_one("th")
        if th and "price" in th.get_text(strip=True).lower():
            td = row.select_one("td")
            if td:
                price_text = td.get_text(strip=True)
                break
    if price_text:
        price_val = parse_float(price_text.replace(",", "").replace("$", "").replace("€", "").replace("£", ""))
        if price_val:
            data["pricing"]["msrp"] = price_val
            data["pricing"]["startingPrice"] = price_val

    return data


def extract_images(soup: BeautifulSoup, page_url: str, download: bool, slug: str) -> dict:
    images: dict[str, Any] = {"main": None, "gallery": [], "renders": [], "cameraSamples": []}

    # Main product image (usually in .phone-image or bigpic CDN)
    for img in soup.select("img"):
        src = img.get("src", "")
        if "bigpic" in src or ("gsmarena" in src and ("phones" in src or "vv/bigpic" in src)):
            images["main"] = ensure_absolute(src, page_url)
            break

    # Gallery / pictures page images
    for a in soup.select("a[href*='pictures'] img, a[href*='pictures-'] img"):
        src = a.get("src", "")
        if src:
            url = ensure_absolute(src, page_url)
            if url not in images["gallery"]:
                images["gallery"].append(url)

    # Also check for official renders
    for img in soup.select(".pictures a img, .official-press a img"):
        src = img.get("src", "")
        if src:
            url = ensure_absolute(src, page_url)
            if url not in images["renders"]:
                images["renders"].append(url)

    # If no gallery found, use the main image
    if not images["gallery"] and images["main"]:
        images["gallery"] = [images["main"]]

    if download:
        images = download_phone_images(images, slug)

    return images


def ensure_absolute(url: str, base_url: str) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    return urljoin(base_url, url)


def download_phone_images(images: dict, slug: str) -> dict:
    http = HTTPSession()
    local: dict[str, Any] = {"main": None, "gallery": [], "renders": [], "cameraSamples": []}
    img_dir = Path(IMAGES_DIR)

    def dl(url: str, suffix: str = "") -> Optional[str]:
        if not url:
            return None
        h = hashlib.md5(url.encode()).hexdigest()[:8]
        ext = ".jpg"
        if ".png" in url.lower():
            ext = ".png"
        elif ".webp" in url.lower():
            ext = ".webp"
        filename = f"{slug}{suffix}-{h}{ext}"
        save_path = img_dir / filename
        if save_path.exists():
            return f"/images/phones/{filename}"
        if http.get_image(url, save_path):
            return f"/images/phones/{filename}"
        return None

    local["main"] = dl(images.get("main"), "-main")
    for i, url in enumerate(images.get("gallery", [])[:8]):
        u = dl(url, f"-{i + 1}")
        if u:
            local["gallery"].append(u)
    for i, url in enumerate(images.get("renders", [])[:4]):
        u = dl(url, f"-r{i + 1}")
        if u:
            local["renders"].append(u)
    for i, url in enumerate(images.get("cameraSamples", [])[:6]):
        u = dl(url, f"-s{i + 1}")
        if u:
            local["cameraSamples"].append(u)
    return local


# ============================================================================
# Specs Table Parser — handles GSMArena's actual HTML structure
# ============================================================================

def extract_specs(soup: BeautifulSoup) -> dict:
    specs: dict[str, Any] = {
        "body": {"dimensions": "", "weightG": None, "build": "", "ipRating": "", "sim": "", "colors": [], "materials": []},
        "screen": {"type": "", "sizeIn": None, "resolution": "", "ppi": None, "refreshRateHz": None, "peakBrightnessNits": None, "hdr": [], "protection": "", "touchSamplingHz": None},
        "cameras": {"rear": [], "front": None, "videoMax": "", "features": []},
        "platform": {"os": "", "ui": "", "chipset": "", "processNodeNm": None, "cpu": "", "gpu": "", "antutuV10": None, "geekbench6Single": None, "geekbench6Multi": None},
        "memory": {"ramGb": [], "storageGb": [], "storageType": "", "cardSlot": False},
        "battery": {"capacityMah": None, "type": "Li-Po", "chargingW": None, "wirelessChargingW": None, "reverseW": None},
        "connectivity": {"network": "", "wifi": "", "bluetooth": "", "nfc": False, "usb": "", "irBlaster": False, "satelliteSos": False, "uwb": False},
        "extras": {"fingerprint": "", "faceUnlock": False, "stylus": False, "stylusStorage": False, "speakers": "", "headphoneJack": False, "fmRadio": False, "sensors": []},
    }

    specs_section = soup.select_one("#specs-list")
    if not specs_section:
        return specs

    current_section = ""

    # Parse all rows — each table in #specs-list is a section
    for table in specs_section.select("table"):
        for row in table.select("tr"):
            cells = row.select("th, td")
            if not cells:
                continue

            texts = [c.get_text(" ", strip=True) for c in cells]

            # 3 cells: section_header + label + value (first row of a section)
            if len(cells) == 3:
                current_section = texts[0].lower()
                label = texts[1].lower()
                value = texts[2]
            # 2 cells: label + value
            elif len(cells) == 2:
                label = texts[0].lower()
                value = texts[1]
            else:
                continue

            full_text = " ".join(texts).lower()

            # ── Network ──
            if current_section == "network":
                if "technology" in label:
                    specs["connectivity"]["network"] = value
                elif "5g" in label and "band" in label:
                    pass  # bands handled below
                elif "band" in label:
                    pass

            # ── Launch ──
            elif current_section == "launch":
                pass  # handled in extract_phone_detail

            # ── Body ──
            elif current_section == "body":
                if "dimension" in label:
                    specs["body"]["dimensions"] = value
                elif "weight" in label:
                    specs["body"]["weightG"] = parse_float(value)
                elif "build" in label or "build type" in label:
                    specs["body"]["build"] = value
                elif "sim" in label:
                    specs["body"]["sim"] = value
                elif "ip" in label or "dust" in label:
                    specs["body"]["ipRating"] = value
                elif "color" in label:
                    specs["body"]["colors"] = parse_colors(value)
                elif "material" in label:
                    specs["body"]["materials"] = [m.strip() for m in value.split(",") if m.strip()]

            # ── Display ──
            elif current_section == "display":
                if "type" in label:
                    specs["screen"]["type"] = value
                elif "size" in label:
                    specs["screen"]["sizeIn"] = parse_float(value)
                elif "resolution" in label:
                    specs["screen"]["resolution"] = value
                    ppi_match = re.search(r"(\d+)\s*ppi", value)
                    if ppi_match:
                        specs["screen"]["ppi"] = int(ppi_match.group(1))
                elif "protection" in label or "glass" in label:
                    specs["screen"]["protection"] = value
                elif "brightness" in label or "nits" in full_text:
                    nits = parse_int(value)
                    if nits:
                        specs["screen"]["peakBrightnessNits"] = nits
                elif "refresh" in label or "hz" in full_text:
                    hz = parse_int(value)
                    if hz:
                        specs["screen"]["refreshRateHz"] = hz
                elif "touch" in label and "sampling" in label:
                    hz = parse_int(value)
                    if hz:
                        specs["screen"]["touchSamplingHz"] = hz
                elif "hdr" in label:
                    specs["screen"]["hdr"] = [h.strip() for h in re.split(r",\s*", value) if h.strip()]

            # ── Platform ──
            elif current_section == "platform":
                if "os" in label:
                    specs["platform"]["os"] = value
                elif "chipset" in label:
                    specs["platform"]["chipset"] = value
                    node = re.search(r"(\d+)\s*nm", value)
                    if node:
                        specs["platform"]["processNodeNm"] = int(node.group(1))
                elif "cpu" in label:
                    specs["platform"]["cpu"] = value
                elif "gpu" in label:
                    specs["platform"]["gpu"] = value

            # ── Memory ──
            elif current_section == "memory":
                if "card" in label and "slot" in label:
                    specs["memory"]["cardSlot"] = "no" not in value.lower()
                elif "internal" in label:
                    specs["memory"]["storageGb"] = parse_storage_options(value)
                    specs["memory"]["ramGb"] = parse_ram_options(value)
                    if "ufs" in value.lower():
                        ufs = re.search(r"UFS\s*(\d+\.\d+)", value, re.I)
                        if ufs:
                            specs["memory"]["storageType"] = f"UFS {ufs.group(1)}"
                    elif "nvme" in value.lower():
                        specs["memory"]["storageType"] = "NVMe"
                    elif "emmc" in value.lower():
                        specs["memory"]["storageType"] = "eMMC 5.1"

            # ── Main Camera ──
            elif current_section == "main camera":
                if "feature" in label or "led" in label:
                    specs["cameras"]["features"] = [f.strip() for f in re.split(r",\s*", value) if f.strip()]
                elif "video" in label:
                    specs["cameras"]["videoMax"] = value
                elif label in ("triple", "dual", "single", "quad", "penta", "") or "mp" in value.lower():
                    lenses = parse_camera_text(value)
                    if lenses:
                        specs["cameras"]["rear"] = lenses

            # ── Selfie Camera ──
            elif current_section == "selfie camera":
                if "feature" in label:
                    pass
                elif "video" in label:
                    pass
                elif label in ("triple", "dual", "single", "quad", "penta", "") or "mp" in value.lower():
                    lenses = parse_camera_text(value)
                    if lenses:
                        specs["cameras"]["front"] = lenses[0] if lenses else None

            # ── Sound ──
            elif current_section == "sound":
                if "loudspeaker" in label:
                    specs["extras"]["speakers"] = value
                elif "3.5mm" in label or "jack" in label:
                    specs["extras"]["headphoneJack"] = "no" not in value.lower()

            # ── Comms ──
            elif current_section == "comms":
                if "wlan" in label or "wifi" in label:
                    specs["connectivity"]["wifi"] = value
                elif "bluetooth" in label:
                    specs["connectivity"]["bluetooth"] = value
                elif "nfc" in label:
                    specs["connectivity"]["nfc"] = "no" not in value.lower()
                elif "usb" in label:
                    specs["connectivity"]["usb"] = value
                elif "positioning" in label or "gps" in label:
                    pass  # GNSS info

            # ── Features ──
            elif current_section == "features":
                if "sensor" in label:
                    specs["extras"]["sensors"] = [s.strip() for s in re.split(r",\s*", value) if s.strip()]
                elif "fingerprint" in label:
                    specs["extras"]["fingerprint"] = value
                elif "uwb" in full_text or "ultra wideband" in full_text:
                    specs["connectivity"]["uwb"] = True
                elif "satellite" in full_text or "emergency" in full_text:
                    specs["connectivity"]["satelliteSos"] = True
                elif "face" in label and "id" in label:
                    specs["extras"]["faceUnlock"] = True
                elif "stylus" in label or "pen" in label:
                    specs["extras"]["stylus"] = True

            # ── Battery ──
            elif current_section == "battery":
                if "type" in label:
                    # "Li-Ion 4685 mAh" or "Li-Po 5000 mAh"
                    mah = re.search(r"(\d+)\s*mAh", value, re.I)
                    if mah:
                        specs["battery"]["capacityMah"] = int(mah.group(1))
                    if "li-ion" in value.lower():
                        specs["battery"]["type"] = "Li-Ion"
                    elif "li-po" in value.lower():
                        specs["battery"]["type"] = "Li-Po"
                    elif "silicon" in value.lower():
                        specs["battery"]["type"] = "Silicon-carbon"
                elif "charging" in label:
                    w = re.search(r"(\d+)W", value, re.I)
                    if w:
                        specs["battery"]["chargingW"] = int(w.group(1))
                    wire_w = re.search(r"(\d+)W.*wireless", value, re.I)
                    if wire_w:
                        specs["battery"]["wirelessChargingW"] = int(wire_w.group(1))

            # ── Misc ──
            elif current_section == "misc":
                if "color" in label:
                    specs["body"]["colors"] = parse_colors(value)
                elif "model" in label:
                    pass
                elif "sar" in label:
                    pass
                elif "price" in label:
                    pass  # handled in pricing section

            # ── Our Tests ──
            elif current_section == "our tests":
                if "performance" in label or "antutu" in full_text:
                    antutu = re.search(r"(\d[\d,]+)", value.replace(",", ""))
                    if antutu:
                        specs["platform"]["antutuV10"] = int(antutu.group(1).replace(",", ""))
                    gb = re.search(r"GeekBench:\s*(\d+)", value)
                    if gb:
                        specs["platform"]["geekbench6Single"] = int(gb.group(1))

    return specs


# ============================================================================
# Camera Text Parser
# ============================================================================

def parse_camera_text(text: str) -> list[dict]:
    """Parse camera specifications like 'Triple 48 MP, f/1.8, 24mm (wide), ...'"""
    lenses = []

    # Remove the leading type word (Triple, Dual, Single, Quad, Penta)
    text = re.sub(r"^(?:Triple|Dual|Single|Quad|Penta)\s+", "", text)

    # Find all MP values and their positions to split the text into per-lens segments
    mp_positions = [(m.start(), m.end()) for m in re.finditer(r"\b\d+(?:\.\d+)?\s*MP\b", text, re.I)]

    if not mp_positions:
        return []

    # Extract segments: from one MP to the next
    segments = []
    for i, (start, _) in enumerate(mp_positions):
        end = mp_positions[i + 1][0] if i + 1 < len(mp_positions) else len(text)
        segments.append(text[start:end].strip())

    for part in segments:
        mp_match = re.search(r"(\d+(?:\.\d+)?)\s*MP", part, re.I)
        if not mp_match:
            continue

        mp = float(mp_match.group(1))

        # Skip very low MP (LiDAR scanner etc)
        if mp < 1.0:
            continue

        aperture_match = re.search(r"f/(\d+(?:\.\d+)?)", part)
        aperture = f"f/{aperture_match.group(1)}" if aperture_match else ""

        sensor_match = re.search(r'1/(\d+(?:\.\d+)?)["″]', part)
        sensor_size = f'1/{sensor_match.group(1)}"' if sensor_match else ""

        pixel_match = re.search(r"([\d.]+)\s*[µu]m", part)
        pixel_size = float(pixel_match.group(1)) if pixel_match else None

        zoom_match = re.search(r"(\d+(?:\.\d+)?)x\s*(?:optical|zoom|periscope)", part, re.I)
        optical_zoom = float(zoom_match.group(1)) if zoom_match else None

        fov_match = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", part)
        fov = float(fov_match.group(1)) if fov_match else None

        ois = ""
        if "ois" in part.lower() or "optical image" in part.lower() or "sensor-shift" in part.lower() or "sensor\u2011shift" in part.lower():
            ois = "OIS"
        elif "eis" in part.lower() or "gyro" in part.lower():
            ois = "EIS"

        # Determine lens type
        lens_type = "wide"
        part_lower = part.lower()
        if "ultra" in part_lower or "uwd" in part_lower or "120°" in part:
            lens_type = "ultrawide"
        elif "periscope" in part_lower:
            lens_type = "periscope"
        elif "telephoto" in part_lower or (optical_zoom and optical_zoom >= 2):
            lens_type = "telephoto"
        elif "macro" in part_lower:
            lens_type = "macro"
        elif "depth" in part_lower or "lidar" in part_lower or "tof" in part_lower:
            lens_type = "depth"

        lenses.append({
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

    return lenses


# ============================================================================
# Storage / RAM Parsers
# ============================================================================

def parse_storage_options(text: str) -> list[int]:
    """Parse '256GB 8GB RAM, 512GB 8GB RAM, 1TB 8GB RAM' into [256, 512, 1024]."""
    options = set()
    # Remove "XGB RAM" parts first to avoid matching RAM as storage
    cleaned = re.sub(r"\d+\s*GB\s*RAM", "", text, flags=re.I)
    # Match storage amounts (GB or TB)
    for match in re.finditer(r"(\d+)\s*(TB|GB)", cleaned, re.I):
        val = int(match.group(1))
        unit = match.group(2).upper()
        if unit == "TB":
            val *= 1024
        if val > 0:
            options.add(val)
    return sorted(options)


def parse_ram_options(text: str) -> list[int]:
    """Parse RAM from '256GB 8GB RAM, 512GB 12GB RAM'."""
    options = set()
    for match in re.finditer(r"(\d+)\s*GB\s*RAM", text, re.I):
        val = int(match.group(1))
        if 1 <= val <= 32:
            options.add(val)
    return sorted(options)


def parse_colors(text: str) -> list[str]:
    """Parse color list like 'Black Titanium, White Titanium, Natural Titanium'."""
    # Remove "Also in X colors:" prefix
    text = re.sub(r"^(?:also\s+)?(?:in\s+)?(?:\d+\s+)?(?:additional\s+)?colou?rs?\s*:?\s*", "", text, flags=re.I)
    # Split by comma followed by uppercase letter
    colors = re.split(r",\s*(?=[A-Z])", text)
    return [c.strip() for c in colors if c.strip() and len(c.strip()) > 1]


# ============================================================================
# Daily Mode
# ============================================================================

def discover_daily_phones(session: HTTPSession) -> list[dict]:
    log.info("Fetching latest phones...")
    phones = []

    for url in [f"{BASE_URL}/phones.php3", f"{BASE_URL}/newphones.php"]:
        resp = session.get(url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "lxml")
        for link in soup.select("a[href]"):
            href = link.get("href", "")
            match = re.match(r"^[a-z0-9_-]+_[a-z0-9_]+-\d+\.php$", href)
            if match:
                name = link.get_text(strip=True)
                if name and len(name) > 2:
                    id_match = re.search(r"-(\d+)\.php$", href)
                    phones.append({
                        "name": name,
                        "slug": href.replace(".php", ""),
                        "url": f"{BASE_URL}/{href}",
                        "gsmarenaId": int(id_match.group(1)) if id_match else None,
                    })
        if phones:
            break

    seen = set()
    unique = [p for p in phones if p["url"] not in seen and not seen.add(p["url"])]
    log.info(f"Found {len(unique)} latest phones")
    return unique


# ============================================================================
# Progress / Checkpoint
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
# Main Scraper
# ============================================================================

class PhoneScraper:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.http = HTTPSession()
        self.progress = Progress()
        self.phones: list[dict] = []
        self._load_existing()

    def _load_existing(self):
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                    self.phones = json.load(f)
                log.info(f"Loaded {len(self.phones)} existing phones from {OUTPUT_FILE}")
            except Exception as e:
                log.warning(f"Could not load existing {OUTPUT_FILE}: {e}")

    def run(self):
        self.progress.mode = self.args.mode
        self.progress.startedAt = datetime.now(timezone.utc).isoformat()

        if self.args.resume:
            self.progress = Progress.load()
            log.info(f"Resuming: brand={self.progress.lastBrand}, page={self.progress.lastPage}")
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
            log.error(f"Error: {e}", exc_info=True)
            self.progress.save()
        finally:
            self._save_output()

    def _run_full(self):
        brands = discover_brands(self.http)
        if self.args.brands:
            filter_list = [b.lower() for b in self.args.brands.split(",")]
            brands = [b for b in brands if b["slug"].lower() in filter_list or b["name"].lower() in filter_list]
            log.info(f"Filtered to {len(brands)} brands")

        self.progress.totalBrands = len(brands)

        start_idx = 0
        if self.progress.lastBrand:
            for i, brand in enumerate(brands):
                if brand["slug"] == self.progress.lastBrand:
                    start_idx = i + 1
                    break

        for i, brand in enumerate(brands[start_idx:], start=start_idx):
            self.progress.lastBrand = brand["slug"]
            self.progress.completedBrands = i
            log.info(f"[{i + 1}/{len(brands)}] {brand['name']}")
            self._scrape_brand(brand)
            self.progress.save()

        self.progress.completedBrands = len(brands)
        self.progress.save()

    def _run_daily(self):
        daily_phones = discover_daily_phones(self.http)
        self.progress.totalPhones = len(daily_phones)
        existing_slugs = {p["slug"] for p in self.phones}
        new_phones = [p for p in daily_phones if p["slug"] not in existing_slugs]
        log.info(f"{len(new_phones)} new phones to scrape")

        for i, phone in enumerate(new_phones):
            self.progress.scrapedPhones = i + 1
            log.info(f"[{i + 1}/{len(new_phones)}] {phone['name']}")
            self._scrape_phone(phone)

        self.progress.save()

    def _scrape_brand(self, brand: dict):
        phones = discover_brand_phones(self.http, brand["url"])
        self.progress.totalPhones += len(phones)
        existing_slugs = {p["slug"] for p in self.phones}
        new_phones = [p for p in phones if p["slug"] not in existing_slugs]

        if not new_phones:
            log.info(f"  All {len(phones)} phones already scraped")
            return

        log.info(f"  {len(new_phones)} new phones (out of {len(phones)})")

        for i, phone in enumerate(new_phones):
            log.info(f"  [{i + 1}/{len(new_phones)}] {phone['name']}")
            self._scrape_phone(phone)

        # Save after each brand to prevent data loss
        self._save_phone_data()

    def _scrape_phone(self, phone: dict):
        try:
            data = extract_phone_detail(self.http, phone, self.args.download_images)
            if data and data.get("name"):
                self.phones.append(data)
                self.progress.scrapedSlugs.append(data["slug"])
                self.progress.scrapedPhones += 1
                img_count = len(data.get("images", {}).get("gallery", []))
                log.info(f"    ✓ {data['name']} ({data['brand']}) — {img_count} images")
                # Save after every phone to prevent data loss
                self._save_phone_data()
            else:
                log.warning(f"    ✗ No data: {phone['name']}")
                self.progress.failedUrls.append(phone["url"])
        except Exception as e:
            log.error(f"    ✗ Error: {phone['name']}: {e}")
            self.progress.failedUrls.append(phone["url"])
            self.progress.errors.append({
                "url": phone["url"], "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    def _save_phone_data(self):
        """Save phones data incrementally (after each brand)."""
        output = sorted(self.phones, key=lambda p: (p.get("brand", "").lower(), p.get("name", "").lower()))
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        log.info(f"  💾 Saved {len(output)} phones to {OUTPUT_FILE}")

    def _save_output(self):
        log.info(f"Saving {len(self.phones)} phones to {OUTPUT_FILE}...")
        self._save_phone_data()
        log.info(f"✓ Saved {len(self.phones)} phones")
        self._show_stats()

    def _show_stats(self):
        total = len(self.phones)
        if total == 0:
            log.info("No phones scraped yet.")
            return

        brands, years = {}, {}
        with_images = 0
        for p in self.phones:
            b = p.get("brand", "Unknown")
            brands[b] = brands.get(b, 0) + 1
            if p.get("images", {}).get("main"):
                with_images += 1
            y = p.get("releaseYear")
            if y:
                years[y] = years.get(y, 0) + 1

        log.info("=" * 60)
        log.info("SCRAPER STATISTICS")
        log.info("=" * 60)
        log.info(f"Total phones:  {total}")
        log.info(f"With images:   {with_images} ({with_images * 100 // max(total, 1)}%)")
        log.info(f"Unique brands: {len(brands)}")
        log.info(f"Failed URLs:   {len(self.progress.failedUrls)}")
        log.info("")
        log.info("Top brands:")
        for brand, count in sorted(brands.items(), key=lambda x: -x[1])[:20]:
            log.info(f"  {brand}: {count}")
        if years:
            log.info(f"\nYear range: {min(years)} - {max(years)}")
        log.info("=" * 60)


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="iToPhone Scraper — Extract smartphone data from GSMArena",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--mode", choices=["full", "daily"], default="full")
    parser.add_argument("--brands", type=str, default=None, help="Comma-separated brand slugs")
    parser.add_argument("--download-images", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--stats", action="store_true")

    args = parser.parse_args()

    log.info("=" * 60)
    log.info(f"iToPhone Scraper — Mode: {args.mode} | Images: {args.download_images}")
    log.info("=" * 60)

    scraper = PhoneScraper(args)
    scraper.run()


if __name__ == "__main__":
    main()
