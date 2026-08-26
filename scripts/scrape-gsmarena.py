#!/usr/bin/env python3
"""
GSMArena Scraper — Scrapes all phones and imports to Firestore.

Usage:
    python3 scripts/scrape-gsmarena.py --brands=samsung,apple
    python3 scripts/scrape-gsmarena.py --brands=all
    python3 scripts/scrape-gsmarena.py --brands=all --new-only       # 2024+ only
    python3 scripts/scrape-gsmarena.py --brands=all --year=2025      # 2025+ only
    python3 scripts/scrape-gsmarena.py --resume
    python3 scripts/scrape-gsmarena.py --import-only
"""
import json
import os
import re
import sys
import time
import traceback
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path("scripts/scraped-data")
BRANDS_FILE = DATA_DIR / "brands.json"
PHONES_FILE = DATA_DIR / "phones.json"
PROGRESS_FILE = DATA_DIR / "progress.json"
OUTPUT_FILE = DATA_DIR / "firestore-import.json"

BASE = "https://www.gsmarena.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
DELAY = 4.0
MAX_RETRIES = 3
MAX_WORKERS = 1
BACKOFF_DELAY = 10
MAX_REQ_PER_MIN = 15
BATCH_SIZE = 40
BATCH_BREAK = 180
BRAND_BREAK = 60

TOP_BRANDS = {}  # Populated dynamically from makers.php3

# Global state for keyboard interrupt handler
all_devices = []
progress = {}
start_time = 0

# Fallback brand data if makers.php3 is blocked (429)
FALLBACK_BRANDS = {
    "samsung": {"name": "Samsung", "listUrl": "samsung-phones-9.php", "id": 9},
    "apple": {"name": "Apple", "listUrl": "apple-phones-48.php", "id": 48},
    "xiaomi": {"name": "Xiaomi", "listUrl": "xiaomi-phones-80.php", "id": 80},
    "google": {"name": "Google", "listUrl": "google-phones-107.php", "id": 107},
    "oneplus": {"name": "OnePlus", "listUrl": "oneplus-phones-95.php", "id": 95},
    "huawei": {"name": "Huawei", "listUrl": "huawei-phones-29.php", "id": 29},
    "oppo": {"name": "OPPO", "listUrl": "oppo-phones-82.php", "id": 82},
    "vivo": {"name": "Vivo", "listUrl": "vivo-phones-98.php", "id": 98},
    "realme": {"name": "Realme", "listUrl": "realme-phones-118.php", "id": 118},
    "sony": {"name": "Sony", "listUrl": "sony-phones-5.php", "id": 5},
    "nokia": {"name": "Nokia", "listUrl": "nokia-phones-1.php", "id": 1},
    "motorola": {"name": "Motorola", "listUrl": "motorola-phones-4.php", "id": 4},
    "honor": {"name": "Honor", "listUrl": "honor-phones-121.php", "id": 121},
    "nothing": {"name": "Nothing", "listUrl": "nothing-phones-128.php", "id": 128},
    "asus": {"name": "Asus", "listUrl": "asus-phones-46.php", "id": 46},
    "tecno": {"name": "Tecno", "listUrl": "tecno-phones-109.php", "id": 109},
    "infinix": {"name": "Infinix", "listUrl": "infinix-phones-112.php", "id": 112},
    "iqoo": {"name": "iQOO", "listUrl": "iqoo-phones-125.php", "id": 125},
    "poco": {"name": "POCO", "listUrl": "poco-phones-123.php", "id": 123},
    "lenovo": {"name": "Lenovo", "listUrl": "lenovo-phones-73.php", "id": 73},
    "meizu": {"name": "Meizu", "listUrl": "meizu-phones-62.php", "id": 62},
    "zte": {"name": "ZTE", "listUrl": "zte-phones-30.php", "id": 30},
    "alcatel": {"name": "Alcatel", "listUrl": "alcatel-phones-35.php", "id": 35},
    "blackberry": {"name": "BlackBerry", "listUrl": "blackberry-phones-8.php", "id": 8},
    "lg": {"name": "LG", "listUrl": "lg-phones-20.php", "id": 20},
    "panasonic": {"name": "Panasonic", "listUrl": "panasonic-phones-13.php", "id": 13},
    "sharp": {"name": "Sharp", "listUrl": "sharp-phones-17.php", "id": 17},
    "hp": {"name": "HP", "listUrl": "hp-phones-44.php", "id": 44},
    "micromax": {"name": "Micromax", "listUrl": "micromax-phones-66.php", "id": 66},
    "lava": {"name": "Lava", "listUrl": "lava-phones-71.php", "id": 71},
    "fairphone": {"name": "Fairphone", "listUrl": "fairphone-phones-114.php", "id": 114},
    "cat": {"name": "Cat", "listUrl": "cat-phones-100.php", "id": 100},
    "doogee": {"name": "Doogee", "listUrl": "doogee-phones-113.php", "id": 113},
    "ulefone": {"name": "Ulefone", "listUrl": "ulefone-phones-115.php", "id": 115},
    "cubot": {"name": "Cubot", "listUrl": "cubot-phones-117.php", "id": 117},
    "blackview": {"name": "Blackview", "listUrl": "blackview-phones-116.php", "id": 116},
    "hotwav": {"name": "Hotwav", "listUrl": "hotwav-phones-131.php", "id": 131},
    "oukitel": {"name": "Oukitel", "listUrl": "oukitel-phones-122.php", "id": 122},
    "nubia": {"name": "Nubia", "listUrl": "nubia-phones-97.php", "id": 97},
    "redmi": {"name": "Redmi", "listUrl": "redmi-phones-124.php", "id": 124},
    "tcl": {"name": "TCL", "listUrl": "tcl-phones-110.php", "id": 110},
    "gigaset": {"name": "Gigaset", "listUrl": "gigaset-phones-119.php", "id": 119},
    "wiko": {"name": "Wiko", "listUrl": "wiko-phones-86.php", "id": 86},
    "bq": {"name": "BQ", "listUrl": "bq-phones-75.php", "id": 75},
    "jolla": {"name": "Jolla", "listUrl": "jolla-phones-90.php", "id": 90},
    "sierra": {"name": "Sierra", "listUrl": "sierra-phones-93.php", "id": 93},
    "sss": {"name": "SSS", "listUrl": "sss-phones-101.php", "id": 101},
    "avin": {"name": "Avin", "listUrl": "avin-phones-106.php", "id": 106},
    "amoi": {"name": "Amoi", "listUrl": "amoi-phones-14.php", "id": 14},
    "formspro": {"name": "Formspro", "listUrl": "formspro-phones-130.php", "id": 130},
}

DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# HTTP Session
# ---------------------------------------------------------------------------
session = requests.Session()
session.headers.update(HEADERS)

# --- Ultra-safe rate limiter ---
_req_times = []

def _rate_wait():
    """Enforce max MAX_REQ_PER_MIN requests per 60s window."""
    global _req_times
    now = time.time()
    _req_times = [t for t in _req_times if now - t < 60]
    if len(_req_times) >= MAX_REQ_PER_MIN:
        wait = 60 - (now - _req_times[0]) + 2
        print(f"    ⏸️  Rate limit: waiting {wait:.0f}s...", flush=True)
        time.sleep(wait)
        _req_times = [t for t in _req_times if time.time() - t < 60]
    _req_times.append(time.time())

def fetch(url, retries=MAX_RETRIES):
    for attempt in range(retries):
        try:
            _rate_wait()
            time.sleep(DELAY)
            r = session.get(url, timeout=20)
            if r.status_code == 200:
                if "Turnstile" in r.text[:500]:
                    print(f"    ⚠️  Turnstile, waiting 30s...", flush=True)
                    time.sleep(30)
                    continue
                return r.text
            if r.status_code == 429:
                retry_after = int(r.headers.get("Retry-After", 600))
                wait = max(retry_after, 600)
                print(f"    ⏳ 429! Waiting {wait}s...", flush=True)
                time.sleep(wait)
                _req_times.clear()
                continue
            print(f"    ❌ HTTP {r.status_code}", flush=True)
            return None
        except Exception as e:
            print(f"    ⏳ Error: {e}, retry {attempt+1}/{retries}", flush=True)
            time.sleep(10 * (attempt + 1))
    return None

# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------
def load_json(path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

# ---------------------------------------------------------------------------
# Brand Discovery
# ---------------------------------------------------------------------------
def scrape_brands():
    if BRANDS_FILE.exists():
        data = load_json(BRANDS_FILE, {})
        if data and len(data) > 20:  # fallback has 20, full list has 100+
            print("📦 Using cached brand list", flush=True)
            return data
        elif data:
            print("📦 Using cached brand list (fallback — will refresh when possible)", flush=True)
            return data

    print("🔍 Fetching brands from makers.php3...", flush=True)
    html = fetch(f"{BASE}/makers.php3")
    if not html:
        print("⚠️  Using fallback brand list (makers.php3 blocked)", flush=True)
        # Don't cache fallback permanently
        return FALLBACK_BRANDS

    soup = BeautifulSoup(html, "lxml")
    brands = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.match(r"([a-z0-9-]+)-phones-(\d+)\.php", href)
        if m:
            slug = m.group(1)
            name = a.get_text(strip=True)
            brands[slug] = {"name": name, "listUrl": href, "id": int(m.group(2))}

    if not brands:
        print("⚠️  No brands found on makers.php3, using fallback", flush=True)
        return FALLBACK_BRANDS

    save_json(BRANDS_FILE, brands)
    print(f"✅ Found {len(brands)} brands from GSMArena", flush=True)
    return brands

# ---------------------------------------------------------------------------
# Phone List Discovery (per brand)
# ---------------------------------------------------------------------------
def scrape_brand_phones(brand_slug, brand_info):
    phones = []
    page = 1
    brand_id = brand_info.get("id", 0)
    base = brand_info.get("listUrl", "").replace(".php", "")

    while True:
        if page == 1:
            url = f"{BASE}/{base}.php"
        else:
            url = f"{BASE}/{brand_slug}-phones-f-{brand_id}-0-p{page}.php"

        print(f"  📄 Page {page}: {url}", flush=True)
        html = fetch(url)
        if not html:
            break

        soup = BeautifulSoup(html, "lxml")
        title_text = soup.title.get_text(strip=True) if soup.title else ""
        if "All" not in title_text and page > 1:
            break

        found = 0
        prefix = f"{brand_slug}_"
        for a in soup.find_all("a", href=True):
            href = a["href"]
            # Match phone detail pages: brand_something-12345.php
            if href.endswith(".php") and re.match(rf"^{re.escape(prefix)}[a-z0-9_]+-\d+\.php$", href):
                name = a.get_text(strip=True)
                if name and len(name) > 2 and "review" not in href and "opinion" not in href:
                    phones.append({"name": name, "url": href, "brand": brand_slug})
                    found += 1

        if found == 0:
            break

        page += 1
        time.sleep(DELAY)

    # Deduplicate by URL
    seen = set()
    unique = []
    for p in phones:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique.append(p)

    return unique

# ---------------------------------------------------------------------------
# Phone Spec Parser
# ---------------------------------------------------------------------------
def parse_phone_page(html, url, brand_slug):
    soup = BeautifulSoup(html, "lxml")
    data = {}

    # Title
    title_el = soup.find("h1", {"class": "specs-phone-name-title"})
    data["name"] = title_el.get_text(strip=True) if title_el else ""
    data["brand"] = brand_slug.replace("-", " ").title()
    data["url"] = url

    # Decoy page detection: GSMArena sometimes serves random phone pages
    page_title = soup.title.get_text(strip=True) if soup.title else ""
    if data["name"]:
        name_words = data["name"].lower().split()[:3]
        title_lower = page_title.lower()
        match_count = sum(1 for w in name_words if w in title_lower)
        if match_count == 0 and len(name_words) >= 2:
            print(f"    ⚠️  Decoy page: expected '{data['name']}' but got '{page_title}'", flush=True)
            return None

    # Extract phone ID from URL
    m = re.search(r"-(\d+)\.php", url)
    data["gsmarenaId"] = int(m.group(1)) if m else None

    # Hero image — get highest quality from GSMArena
    img_div = soup.find("div", {"class": "specs-photo-main"})
    hero_url = None
    if img_div:
        img_tag = img_div.find("img")
        if img_tag and img_tag.get("src"):
            src = img_tag["src"]
            if not src.startswith("http"):
                src = f"https:{src}"
            hero_url = src

    # Extract gallery images from the page
    gallery_urls = []
    # Look for gallery links
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "/pics/" in href or "/bigpic/" in href:
            full = href if href.startswith("http") else f"https:{href}"
            if full not in gallery_urls:
                gallery_urls.append(full)
    # Also look for img tags pointing to gallery
    for img_tag in soup.find_all("img"):
        src = img_tag.get("src", "") or img_tag.get("data-src", "")
        if "/pics/" in src and "gsmarena" in src:
            full = src if src.startswith("http") else f"https:{src}"
            if full not in gallery_urls:
                gallery_urls.append(full)

    # Also try to extract from review section
    for div in soup.find_all(["div", "section"], class_=True):
        cls = " ".join(div.get("class", []))
        if "gallery" in cls.lower() or "review" in cls.lower() or "photo" in cls.lower():
            for a in div.find_all("a", href=True):
                href = a["href"]
                if href.endswith((".jpg", ".png", ".webp")):
                    full = href if href.startswith("http") else f"https:{href}"
                    if full not in gallery_urls:
                        gallery_urls.append(full)

    data["heroImage"] = hero_url
    data["galleryImages"] = gallery_urls[:20]  # Cap at 20 images

    # Parse spec tables using ttl/nfo class pattern
    specs = {}
    current_category = "Other"
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            th = row.find("th", scope="row")
            if th:
                current_category = th.get_text(strip=True)
                specs[current_category] = {}
            ttl = row.find("td", class_="ttl")
            nfo = row.find("td", class_="nfo")
            if ttl and nfo:
                key = ttl.get_text(strip=True)
                val = nfo.get_text(separator="\n", strip=True)
                if key:
                    specs.setdefault(current_category, {})[key] = val

    data["rawSpecs"] = specs
    return data

# ---------------------------------------------------------------------------
# Map to Firestore Device Format
# ---------------------------------------------------------------------------
def map_to_device(phone_data, brand_slug):
    raw = phone_data.get("rawSpecs", {})
    name = phone_data.get("name", "")
    brand = brand_slug.replace("-", " ").title()

    # Remove brand prefix from name to avoid duplication
    name_lower = name.lower()
    brand_lower = brand.lower()
    if name_lower.startswith(brand_lower + " "):
        name = name[len(brand) + 1:]

    slug = re.sub(r'[^a-z0-9]+', '-', f"{brand_slug} {name}".lower()).strip("-")

    def get_num(text, default=0):
        if not text:
            return default
        m = re.search(r"(\d+[\.,]?\d*)", str(text).replace(",", "."))
        return int(float(m.group(1))) if m else default

    def get_float(text, default=0.0):
        if not text:
            return default
        m = re.search(r"(\d+[\.,]?\d*)", str(text).replace(",", "."))
        return float(m.group(1)) if m else default

    # Body
    body_raw = raw.get("Body", {})
    dims = body_raw.get("Dimensions", "")
    dim_nums = [get_float(x) for x in re.findall(r"[\d.]+", dims)]

    # Display
    display_raw = raw.get("Display", {})
    display_size = get_float(display_raw.get("Size", ""))
    resolution = display_raw.get("Resolution", "")
    ppi = get_num(display_raw.get("Density", ""))

    # Platform
    platform_raw = raw.get("Platform", {})
    chipset = platform_raw.get("Chipset", "")

    # Memory
    memory_raw = raw.get("Memory", {})
    ram_match = re.search(r"(\d+)\s*GB\s*RAM", memory_raw.get("Internal", "") + " " + memory_raw.get("Card slot", ""))
    storage_match = re.search(r"(\d+)\s*GB", memory_raw.get("Internal", ""))

    # Main Camera
    camera_raw = raw.get("Main Camera", {})
    main_cam_text = camera_raw.get("Triple", camera_raw.get("Dual", camera_raw.get("Single", camera_raw.get("Quad", ""))))
    mp_match = re.search(r"(\d+)\s*MP", main_cam_text)
    main_mp = get_num(mp_match.group(1)) if mp_match else 0

    # Selfie
    selfie_raw = raw.get("Selfie camera", raw.get("Selfie Camera", {}))
    selfie_text = selfie_raw.get("Single", selfie_raw.get("Dual", ""))
    selfie_mp = get_num(re.search(r"(\d+)\s*MP", selfie_text).group(1)) if re.search(r"(\d+)\s*MP", selfie_text) else 0

    # Battery
    battery_raw = raw.get("Battery", {})
    battery_text = battery_raw.get("Type", "")
    if not battery_text:
        # Some phones put capacity in Charging field or elsewhere
        for v in battery_raw.values():
            if re.search(r"\d+\s*mAh", v):
                battery_text = v
                break
    battery_mah = get_num(re.search(r"(\d+)\s*mAh", battery_text).group(1)) if re.search(r"(\d+)\s*mAh", battery_text) else 0

    # Status + Year
    status_raw = raw.get("Launch", {})
    announced_text = status_raw.get("Announced", "")
    status_text = status_raw.get("Status", announced_text)
    if "Available" in status_text:
        status = "available"
    elif "Discontinued" in status_text:
        status = "discontinued"
    elif "Rumored" in status_text:
        status = "rumored"
    elif "Expected" in status_text:
        status = "upcoming"
    else:
        status = "available"

    # Extract announced year
    year_match = re.search(r"(20\d{2})", announced_text)
    announced_year = int(year_match.group(1)) if year_match else None

    # Network
    network_raw = raw.get("Network", {})
    network_text = network_raw.get("Technology", "")

    # Charging
    charging_text = battery_raw.get("Charging", "")
    charging_watts = get_num(re.search(r"(\d+)\s*W", charging_text).group(1)) if re.search(r"(\d+)\s*W", charging_text) else 0

    # SIM
    sim = body_raw.get("SIM", "")

    # Build
    build = body_raw.get("Build", "")
    weight = get_num(body_raw.get("Weight", ""))

    # Colors
    misc_raw = raw.get("Misc", {})
    colors = [c.strip() for c in misc_raw.get("Colors", "").split(",") if c.strip()]

    # Price extraction from Misc > Price
    price_text = misc_raw.get("Price", "")
    price_eur = None
    price_usd = None
    price_inr = None
    if price_text:
        eur_match = re.search(r"(?:About|approx\.?|~)?\s*(\d[\d,.]*)\s*(?:EUR|€)", price_text, re.IGNORECASE)
        usd_match = re.search(r"(?:About|approx\.?|~)?\s*\$?(\d[\d,.]*)\s*(?:USD|\$)", price_text, re.IGNORECASE)
        inr_match = re.search(r"(?:About|approx\.?|~)?\s*₹?(\d[\d,.]*)\s*(?:INR|₹)", price_text, re.IGNORECASE)
        any_price = re.search(r"(?:About|approx\.?|~)?\s*(\d[\d,.]*)\s*(EUR|USD|INR|GBP|CNY|KRW|\$|€|£)", price_text, re.IGNORECASE)
        if eur_match:
            price_eur = float(eur_match.group(1).replace(",", ""))
        if usd_match:
            price_usd = float(usd_match.group(1).replace(",", ""))
        if inr_match:
            price_inr = float(inr_match.group(1).replace(",", ""))
        if not price_eur and not price_usd and not price_inr and any_price:
            val = float(any_price.group(1).replace(",", ""))
            curr = any_price.group(2).upper()
            if curr in ("EUR", "€"):
                price_eur = val
            elif curr in ("USD", "$"):
                price_usd = val
            elif curr in ("GBP", "£"):
                price_usd = round(val * 1.27, 2)
            elif curr in ("INR", "₹"):
                price_inr = val

    # EU Label data
    eu_raw = raw.get("EU LABEL", {})
    endurance_hours = None
    eu_battery = eu_raw.get("Battery", "")
    if eu_battery:
        eh_match = re.search(r"(\d+):(\d+)h", eu_battery)
        if eh_match:
            endurance_hours = int(eh_match.group(1)) + int(eh_match.group(2)) / 60

    # Display extras (refresh, brightness, PWM often in Type field)
    display_type_text = display_raw.get("Type", "")
    refresh_rate = get_num(display_raw.get("Refresh rate", ""))
    if refresh_rate == 0:
        refresh_match = re.search(r'(\d{2,3})Hz(?!\s*PWM)', display_type_text)
        if refresh_match:
            refresh_rate = get_num(refresh_match.group(1))
    if refresh_rate == 0:
        refresh_rate = 60
    pwm_hz = get_num(display_raw.get("PWM", ""))
    if pwm_hz == 0:
        pwm_match = re.search(r'(\d{3,4})Hz\s*PWM', display_type_text)
        if pwm_match:
            pwm_hz = get_num(pwm_match.group(1))
    peak_brightness = 0
    brightness_match = re.search(r"(\d+)\s*nits", display_raw.get("Brightness", display_type_text))
    if brightness_match:
        peak_brightness = get_num(brightness_match.group(1))

    device = {
        "id": slug,
        "slug": slug,
        "brand": brand,
        "name": name,
        "modelNumbers": [],
        "codename": None,
        "status": status,
        "announcedYear": announced_year,
        "announcedAt": announced_text if announced_text else None,
        "releaseAt": None,
        "brandColor": get_brand_color(brand_slug),
        "specs": {
            "body": {
                "dimensions": {
                    "widthMm": dim_nums[1] if len(dim_nums) > 1 else 0,
                    "heightMm": dim_nums[0] if len(dim_nums) > 0 else 0,
                    "depthMm": dim_nums[2] if len(dim_nums) > 2 else 0,
                },
                "weightG": weight,
                "build": build,
                "materials": [],
                "protection": None,
                "ipRating": get_ip_rating(body_raw),
                "colors": colors,
            },
            "display": {
                "type": get_display_type(display_raw.get("Type", "")),
                "sizeIn": display_size,
                "resolution": resolution,
                "ppi": ppi,
                "refreshRateHz": refresh_rate,
                "peakBrightnessNits": peak_brightness,
                "hdrSupport": parse_list(display_raw.get("Features", "")),
                "pwmHz": pwm_hz,
                "glass": display_raw.get("Protection", None),
                "colorDepth": "",
            },
            "platform": {
                "os": platform_raw.get("OS", ""),
                "ui": "",
                "chipset": chipset,
                "cpu": platform_raw.get("CPU", ""),
                "gpu": platform_raw.get("GPU", ""),
                "antutuV10": None,
                "geekbench6": None,
            },
            "memory": {
                "ramOptions": [int(ram_match.group(1))] if ram_match else [],
                "storageOptions": [int(storage_match.group(1))] if storage_match else [],
                "storageType": "UFS 3.1" if "UFS" in memory_raw.get("Internal", "") else ("UFS 4.0" if "4.0" in chipset else "UFS 3.1"),
                "cardSlot": "microSD" in memory_raw.get("Card slot", ""),
            },
            "cameras": {
                "rear": parse_cameras(main_cam_text, "rear"),
                "front": parse_cameras(selfie_text, "front"),
                "features": parse_list(camera_raw.get("Features", "")),
                "videoCapabilities": parse_list(camera_raw.get("Video", "")),
            },
            "audio": {
                "speakers": ["Loudspeaker"],
                "headphoneJack": "3.5mm jack" in str(raw.get("Sound", {})),
                "codecs": [],
                "microphone": "",
            },
            "battery": {
                "capacityMah": battery_mah,
                "type": "Li-Po" if "Li-Po" in battery_text else "Li-Ion",
                "chargingWatts": charging_watts,
                "chargingTimeMin": None,
                "wirelessWatts": get_num(re.search(r"(\d+)\s*W", battery_raw.get("Charging", "")).group(1)) if re.search(r"(\d+)\s*W.*wireless|wireless.*(\d+)\s*W", battery_raw.get("Charging", ""), re.IGNORECASE) else 0,
                "reverseWirelessWatts": 0,
                "enduranceHours": None,
            },
            "connectivity": {
                "wifi": raw.get("Comms", {}).get("WLAN", ""),
                "bluetooth": raw.get("Comms", {}).get("Bluetooth", ""),
                "nfc": "Yes" in raw.get("Comms", {}).get("NFC", ""),
                "usb": raw.get("Comms", {}).get("USB", ""),
                "irBlaster": False,
                "gnss": parse_list(raw.get("Comms", {}).get("GPS", "")),
                "bands": [],
            },
            "sensors": parse_list(raw.get("Features", {}).get("Sensors", "")),
            "extras": {
                "fingerprint": "under-display" if "under display" in body_raw.get("Build", "").lower() or "fingerprint" in str(raw.get("Features", {})).lower() else "side",
                "faceUnlock": "face" in str(raw.get("Features", {})).lower(),
                "stylus": "stylus" in str(raw).lower(),
                "esim": "eSIM" in sim,
                "uwb": "UWB" in str(raw.get("Comms", {})),
                "satelliteSos": False,
            },
        },
        "media": {
            "heroImage": phone_data.get("heroImage"),
            "gallery": phone_data.get("galleryImages", []),
            "renderImages": [],
            "modelUrl": None,
            "cameraSamples": {},
        },
        "content": "",
        "embedding": [],
        "score": compute_score(raw),
        "priceSummary": {
            "latest": price_eur or price_usd,
            "currency": "EUR" if price_eur else ("USD" if price_usd else ("INR" if price_inr else "USD")),
            "msrp": price_eur or price_usd,
            "min": price_eur or price_usd,
            "max": price_eur or price_usd,
            "average": price_eur or price_usd,
            "dropPercent": 0,
            "trend": "stable",
            "sources": ["gsmarena"],
        },
        "bandGroupIds": [],
        "sources": [{"kind": "gsmarena", "url": phone_data.get("url", ""), "title": name, "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")}],
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "announcedYear": announced_year,
    }

    return device

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_brand_color(slug):
    colors = {
        "samsung": "#1428A0", "apple": "#A2AAAD", "google": "#4285F4",
        "xiaomi": "#FF6700", "oneplus": "#F5010C", "huawei": "#CF0A2C",
        "oppo": "#1BA784", "vivo": "#415FFF", "realme": "#FFC800",
        "sony": "#000000", "nokia": "#124191", "motorola": "#5C2D91",
        "honor": "#00B0F0", "nothing": "#000000", "asus": "#00529B",
        "tecno": "#0066CC", "infinix": "#F37920", "iqoo": "#F5C518",
        "poco": "#FF6900", "lenovo": "#E2231A", "meizu": "#1DB5A3",
        "zte": "#0057B8", "alcatel": "#00A1DE", "blackberry": "#000000",
        "lg": "#A50034", "panasonic": "#004A97", "sharp": "#004A97",
        "hp": "#0096D6",
    }
    return colors.get(slug, "#6B7280")

def get_ip_rating(body_raw):
    text = str(body_raw)
    m = re.search(r"IP\d{2}", text)
    return m.group(0) if m else None

def get_display_type(text):
    text = text.lower()
    if "ltpo" in text and "amoled" in text:
        return "LTPO AMOLED"
    if "amoled" in text or "oled" in text:
        if "amoled" in text:
            return "AMOLED"
        return "OLED"
    if "lcd" in text:
        return "LCD"
    if "ips" in text:
        return "LCD"
    return "OLED"

def parse_list(text):
    if not text or text.lower() in ("yes", "no", ""):
        return []
    parts = re.split(r",\s*(?![^(]*\))", text)
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 1]

def parse_cameras(text, position):
    if not text:
        return []
    cameras = []
    parts = re.split(r"(?<=\S)\s+(?=\d+\s*MP)", text)
    if len(parts) <= 1:
        parts = [text]

    for i, part in enumerate(parts):
        mp_match = re.search(r"(\d+)\s*MP", part)
        mp = int(mp_match.group(1)) if mp_match else 0
        aperture_match = re.search(r"f/(\d+\.?\d*)", part)
        aperture = f"f/{aperture_match.group(1)}" if aperture_match else None

        kind = "wide"
        part_lower = part.lower()
        if "ultra" in part_lower or "ultrawide" in part_lower:
            kind = "ultrawide"
        elif "tele" in part_lower or "periscope" in part_lower:
            kind = "periscope" if "periscope" in part_lower else "telephoto"
        elif "macro" in part_lower:
            kind = "macro"
        elif "depth" in part_lower:
            kind = "depth"
        elif position == "front":
            kind = "selfie"

        stabilization = "OIS+EIS" if "OIS" in part and "EIS" in part else ("OIS" if "OIS" in part else ("EIS" if "EIS" in part else "none"))

        cameras.append({
            "id": f"{position}_{kind}_{i}",
            "position": position,
            "kind": kind,
            "megapixels": mp,
            "aperture": aperture,
            "sensorSize": None,
            "pixelSize": None,
            "fieldOfViewDeg": None,
            "opticalZoom": None,
            "digitalZoom": None,
            "stabilization": stabilization,
            "video": [],
        })
    return cameras

CHIPSET_SCORES = {
    # Flagship (90-99)
    "Snapdragon 8 Elite": 98, "Snapdragon 8 Gen 4": 98, "Snapdragon 8s Elite": 95,
    "Snapdragon 8 Gen 3": 96, "Dimensity 9400": 97, "Dimensity 9300": 95,
    "A19 Pro": 99, "A19": 97, "A18 Pro": 98, "A18": 96, "A17 Pro": 95, "A17": 93,
    "Tensor G5": 92, "Tensor G4": 88, "Tensor G3": 82, "Tensor G2": 78,
    # Upper-mid (80-89)
    "Snapdragon 8s Gen 3": 88, "Snapdragon 8 Gen 2": 92, "Snapdragon 8+ Gen 1": 90,
    "Snapdragon 888": 87, "Snapdragon 888+": 88, "Snapdragon 870": 84,
    "Snapdragon 865": 85, "Snapdragon 860": 83, "Snapdragon 855": 82,
    "Dimensity 9200": 90, "Dimensity 9200+": 91, "Dimensity 9000": 87,
    "Dimensity 8300": 86, "Dimensity 8200": 84, "Dimensity 8100": 82,
    "Dimensity 8050": 81, "Dimensity 8020": 80,
    "A16": 84, "A15": 83, "A14": 80,
    # Mid-range (60-79)
    "Snapdragon 7+ Gen 3": 82, "Snapdragon 7+ Gen 2": 79, "Snapdragon 7 Gen 3": 78,
    "Snapdragon 7 Gen 2": 76, "Snapdragon 7s Gen 3": 75, "Snapdragon 7s Gen 2": 72,
    "Snapdragon 7 Gen 1": 72, "Snapdragon 710": 70, "Snapdragon 712": 71,
    "Snapdragon 695": 68, "Snapdragon 690": 66, "Snapdragon 685": 58,
    "Snapdragon 680": 56, "Snapdragon 675": 67, "Snapdragon 670": 65,
    "Snapdragon 665": 60, "Snapdragon 662": 58, "Snapdragon 660": 62,
    "Snapdragon 653": 55, "Snapdragon 652": 54, "Snapdragon 650": 53,
    "Dimensity 7300": 77, "Dimensity 7200": 75, "Dimensity 7050": 73,
    "Dimensity 7030": 72, "Dimensity 7025": 70, "Dimensity 7020": 69,
    "Dimensity 700": 62, "Dimensity 6300": 63, "Dimensity 6200": 65,
    "Dimensity 6100": 60, "Dimensity 6050": 59, "Dimensity 6020": 57,
    "Dimensity 6000": 58, "Dimensity 930": 70, "Dimensity 920": 68,
    "Dimensity 900": 64, "Dimensity 810": 58, "Dimensity 800": 56,
    "Dimensity 720": 54, "Dimensity 700": 52, "Helio G99": 60, "Helio G96": 55,
    "Helio G95": 57, "Helio G90": 56, "Helio G88": 50, "Helio G85": 48,
    "Helio G81": 47, "Helio G80": 46, "Helio G70": 42, "Helio G35": 35,
    "Helio G25": 30, "Helio A25": 28, "Helio A22": 26, "Helio A20": 24,
    "Exynos 2500": 95, "Exynos 2400": 93, "Exynos 2300": 88,
    "Exynos 2200": 85, "Exynos 2100": 83, "Exynos 1480": 72,
    "Exynos 1380": 65, "Exynos 1280": 62, "Exynos 1080": 70,
    "Exynos 990": 78, "Exynos 9825": 80, "Exynos 9820": 78,
    "Exynos 9810": 73, "Exynos 8895": 72, "Exynos 8890": 70,
    "Kirin 9100": 92, "Kirin 9010": 87, "Kirin 9000S": 83,
    "Kirin 9000": 85, "Kirin 990": 80, "Kirin 985": 76,
    "Kirin 980": 75, "Kirin 970": 70, "Kirin 810": 67,
    "Kirin 820": 70, "Kirin 710": 55,
    # Low-end (30-50)
    "Snapdragon 4 Gen 2": 68, "Snapdragon 4 Gen 1": 65, "Snapdragon 480": 60,
    "Snapdragon 460": 50, "Snapdragon 450": 48, "Snapdragon 439": 38,
    "Snapdragon 435": 36, "Snapdragon 430": 35, "Snapdragon 425": 28,
    "Snapdragon 415": 27, "Snapdragon 412": 26, "Snapdragon 410": 25,
    "Snapdragon 400": 22, "Snapdragon 210": 18, "Snapdragon 208": 17,
    "Snapdragon 205": 16, "Snapdragon 200": 15,
    "MT6739": 25, "MT6735": 30, "MT6737": 32, "MT6738": 35,
    "MT6750": 40, "MT6752": 45, "MT6753": 43, "MT6755": 48,
    "MT6761": 35, "MT6762": 37, "MT6763": 40, "MT6765": 38,
    "MT6768": 42, "MT6769": 44, "MT6771": 46, "MT6785": 55,
    "MT6833": 58, "MT6853": 55, "MT6877": 70, "MT6879": 75,
    "MT6893": 78, "MT6895": 82, "MT6983": 88, "MT6985": 90,
    "SC9863A": 25, "SC9832E": 20, "SC7731E": 15,
    "Tiger T612": 38, "Tiger T616": 40, "Tiger T618": 42, "Tiger T620": 45,
    "Tiger T700": 50, "Tiger T710": 52, "Tiger T720": 48,
    "Spreadtrum SC7731E": 15, "Spreadtrum SC9863A": 25,
    "Qualcomm MSM8916": 30, "Qualcomm MSM8937": 35, "Qualcomm MSM8953": 45,
    "Qualcomm MSM8974": 55, "Qualcomm MSM8996": 70, "Qualcomm MSM8998": 78,
    "Qualcomm MSM8952": 42, "Qualcomm MSM8956": 43,
    "Intel Atom": 35, "Rockchip": 25, "Allwinner": 20,
}

def get_chipset_score(chipset):
    """Score a chipset 10-100 by matching against known benchmarks."""
    if not chipset:
        return 40
    chipset_lower = chipset.lower()
    best = 0
    for key, score in CHIPSET_SCORES.items():
        if key.lower() in chipset_lower:
            best = max(best, score)
    if best > 0:
        return best
    # Fallback heuristics
    if any(x in chipset_lower for x in ["snapdragon 8"]): return 90
    if any(x in chipset_lower for x in ["snapdragon 7"]): return 75
    if any(x in chipset_lower for x in ["snapdragon 6"]): return 60
    if any(x in chipset_lower for x in ["snapdragon 4"]): return 45
    if any(x in chipset_lower for x in ["snapdragon 2"]): return 25
    if "dimensity" in chipset_lower: return 65
    if "exynos" in chipset_lower: return 65
    if "helio" in chipset_lower:
        if "g" in chipset_lower: return 50
        return 35
    if "kirin" in chipset_lower: return 65
    if "unisoc" in chipset_lower or "tiger" in chipset_lower: return 35
    return 40

def compute_score(raw):
    display_raw = raw.get("Display", {})
    platform_raw = raw.get("Platform", {})
    camera_raw = raw.get("Main Camera", {})
    battery_raw = raw.get("Battery", {})

    # Display score (10-100): size, resolution, refresh rate
    size = get_float(display_raw.get("Size", ""))
    display_score = min(100, max(30, int(size * 8))) if size > 0 else 50
    res_text = display_raw.get("Resolution", "")
    if "1440" in res_text or "QHD" in res_text or "2K" in res_text:
        display_score = min(100, display_score + 15)
    elif "1080" in res_text or "FHD" in res_text:
        display_score = min(100, display_score + 8)
    type_text = display_raw.get("Type", "").lower()
    if "amoled" in type_text or "oled" in type_text:
        display_score = min(100, display_score + 10)
    elif "ips" in type_text or "lcd" in type_text:
        display_score = min(100, display_score + 3)
    refresh = get_num(display_raw.get("Refresh rate", ""))
    if refresh == 0:
        rm = re.search(r'(\d{2,3})Hz(?!\s*PWM)', display_raw.get("Type", ""))
        if rm:
            refresh = get_num(rm.group(1))
    if refresh >= 120:
        display_score = min(100, display_score + 8)
    elif refresh >= 90:
        display_score = min(100, display_score + 4)

    # Performance score: chipset-based
    chipset = platform_raw.get("Chipset", "")
    performance_score = get_chipset_score(chipset)

    # Camera score (10-100): MP count, number of lenses, OIS
    main_text = camera_raw.get("Triple", camera_raw.get("Dual", camera_raw.get("Single", camera_raw.get("Quad", ""))))
    mp = 0
    mp_match = re.search(r"(\d+)\s*MP", main_text)
    if mp_match:
        mp = get_num(mp_match.group(1))
    lens_count = 1
    if "Quad" in camera_raw:
        lens_count = 4
    elif "Triple" in camera_raw:
        lens_count = 3
    elif "Dual" in camera_raw:
        lens_count = 2
    camera_score = min(80, int(mp / 2)) if mp > 0 else 30
    if lens_count >= 3: camera_score = min(100, camera_score + 10)
    elif lens_count >= 2: camera_score = min(100, camera_score + 5)
    if "OIS" in str(camera_raw): camera_score = min(100, camera_score + 10)
    features_text = camera_raw.get("Features", "").lower()
    if "hdr" in features_text: camera_score = min(100, camera_score + 3)
    if "panorama" in features_text: camera_score = min(100, camera_score + 2)
    video_text = camera_raw.get("Video", "").lower()
    if "8k" in video_text: camera_score = min(100, camera_score + 5)
    elif "4k" in video_text: camera_score = min(100, camera_score + 3)
    camera_score = max(20, min(100, camera_score))

    # Battery score (10-100): capacity + charging speed
    battery_text = ""
    for v in battery_raw.values():
        if re.search(r"\d+\s*mAh", str(v)):
            battery_text = v
            break
    if not battery_text:
        battery_text = battery_raw.get("Type", "")
    batt_match = re.search(r"(\d+)\s*mAh", battery_text)
    batt = get_num(batt_match.group(1)) if batt_match else 0
    battery_score = 40
    if batt > 0:
        battery_score = min(100, max(25, int(batt / 50)))
    charging_text = battery_raw.get("Charging", "")
    cw = get_num(re.search(r"(\d+)\s*W", charging_text).group(1)) if re.search(r"(\d+)\s*W", charging_text) else 0
    if cw >= 100: battery_score = min(100, battery_score + 15)
    elif cw >= 65: battery_score = min(100, battery_score + 10)
    elif cw >= 30: battery_score = min(100, battery_score + 5)
    wireless_match = re.search(r"(\d+)\s*W.*wireless|wireless.*(\d+)\s*W", charging_text, re.IGNORECASE)
    if wireless_match: battery_score = min(100, battery_score + 5)

    # Value score (price-performance)
    total = round((display_score + performance_score + camera_score + battery_score) / 4)
    total = max(20, min(99, total))

    return {
        "total": total,
        "display": max(20, min(100, display_score)),
        "hardware": max(20, min(100, performance_score)),
        "camera": max(20, min(100, camera_score)),
        "battery": max(20, min(100, battery_score)),
        "value": 0,
        "sentiment": 0,
    }

def get_float(text, default=0.0):
    if not text:
        return default
    m = re.search(r"(\d+[\.,]?\d*)", str(text).replace(",", "."))
    return float(m.group(1)) if m else default

def get_num(text, default=0):
    if not text:
        return default
    return int(get_float(text, default))

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    global start_time, all_devices, progress
    start_time = time.time()
    args = sys.argv[1:]
    brands_arg = next((a for a in args if a.startswith("--brands=")), None)
    year_arg = next((a for a in args if a.startswith("--year=")), None)
    new_only = "--new-only" in args
    resume = "--resume" in args

    # Year filter: only scrape phones announced in this year or later
    min_year = None
    if year_arg:
        min_year = int(year_arg.split("=", 1)[1])
    elif new_only:
        min_year = 2024  # default for --new-only

    # Discover brands
    all_brands = scrape_brands()

    if brands_arg:
        val = brands_arg.split("=", 1)[1]
        if val == "all":
            brand_slugs = list(all_brands.keys())
        else:
            brand_slugs = [b.strip().lower() for b in val.split(",")]
    else:
        # Default: top 20 most popular brands
        priority = [
            "samsung", "apple", "xiaomi", "google", "oneplus", "huawei",
            "oppo", "vivo", "realme", "sony", "nokia", "motorola",
            "honor", "nothing", "asus", "tecno", "infinix", "iqoo",
            "poco", "lenovo",
        ]
        brand_slugs = [b for b in priority if b in all_brands]

    progress = load_json(PROGRESS_FILE, {
        "completedBrands": [],
        "totalPhones": 0,
        "scrapedSpecs": 0,
        "failedPhones": [],
    })
    all_devices = load_json(PHONES_FILE, [])
    existing_urls = {d.get("url") for d in all_devices}
    existing_slugs = {d.get("id") for d in all_devices}

    print("=" * 60, flush=True)
    print(f"📱 GSMArena Scraper — {len(brand_slugs)} brands", flush=True)
    print(f"   Existing: {len(all_devices)} devices", flush=True)
    print(f"   Rate limit: {MAX_REQ_PER_MIN} req/min, {DELAY}s delay", flush=True)
    print(f"   Batch: {BATCH_SIZE} phones, {BATCH_BREAK}s break", flush=True)
    print(f"   Resume: {'yes' if resume else 'no'}", flush=True)
    print("=" * 60, flush=True)

    # Connectivity test: 3 requests to verify not banned
    print("\n🔍 Connectivity test...", flush=True)
    test_ok = True
    for test_url in [f"{BASE}/apple-phones-48.php", f"{BASE}/samsung-phones-9.php"]:
        html = fetch(test_url)
        if not html:
            print("  ❌ Cannot access GSMArena! Waiting 5 min before retry...", flush=True)
            time.sleep(300)
            html = fetch(test_url)
            if not html:
                print("  ❌ Still blocked. Try again later.", flush=True)
                test_ok = False
                break
        time.sleep(DELAY)
    if not test_ok:
        print("Aborting. Re-run with --resume later.", flush=True)
        return
    print("  ✅ GSMArena accessible!", flush=True)

    for i, brand_slug in enumerate(brand_slugs):
        if brand_slug in progress["completedBrands"] and resume:
            print(f"\n⏭️  [{i+1}] {brand_slug} — already done", flush=True)
            continue

        brand_info = all_brands.get(brand_slug)
        if not brand_info:
            print(f"\n❓ [{i+1}] {brand_slug} — unknown brand, skipping", flush=True)
            continue

        print(f"\n{'━' * 60}", flush=True)
        print(f"📱 [{i+1}/{len(brand_slugs)}] {brand_slug.upper()}", flush=True)
        print(f"{'━' * 60}", flush=True)

        try:
            t0 = time.time()
            # 1. Get phone list
            phones = scrape_brand_phones(brand_slug, brand_info)
            print(f"  📋 Found {len(phones)} phones", flush=True)

            # Filter phones to scrape (skip existing)
            to_scrape = [(j, phone) for j, phone in enumerate(phones)
                         if f"{BASE}/{phone['url']}" not in existing_urls]

            scraped = 0
            failed_count = 0
            skipped_old = 0

            for done_count, (j, phone) in enumerate(to_scrape, 1):
                url = f"{BASE}/{phone['url']}"
                html = fetch(url)
                if not html:
                    print(f"  🔧 [{done_count}/{len(to_scrape)}] {phone['name'][:40]} ❌ failed", flush=True)
                    progress["failedPhones"].append(f"{brand_slug}/{phone['name']}")
                    failed_count += 1
                    continue
                try:
                    phone_data = parse_phone_page(html, url, brand_slug)
                    if phone_data is None:
                        skipped_old += 1
                        continue
                    device = map_to_device(phone_data, brand_slug)
                    if min_year and device.get("announcedYear") and device["announcedYear"] < min_year:
                        skipped_old += 1
                        continue
                    if device["id"] not in existing_slugs:
                        all_devices.append(device)
                        existing_urls.add(url)
                        existing_slugs.add(device["id"])
                        scraped += 1
                        progress["scrapedSpecs"] += 1
                        print(f"  🔧 [{done_count}/{len(to_scrape)}] {phone['name'][:40]} ✅ {device['specs']['platform']['chipset'][:30]}", flush=True)
                    else:
                        print(f"  🔧 [{done_count}/{len(to_scrape)}] {phone['name'][:40]} ⏭️ exists", flush=True)
                except Exception as e:
                    print(f"  🔧 [{done_count}/{len(to_scrape)}] {phone['name'][:40]} ❌ {str(e)[:40]}", flush=True)
                    progress["failedPhones"].append(f"{brand_slug}/{phone['name']}: {str(e)[:100]}")
                    failed_count += 1
                # Save periodically
                if done_count % 20 == 0:
                    save_json(PHONES_FILE, all_devices)
                    save_json(PROGRESS_FILE, progress)
                # Batch break every BATCH_SIZE phones
                if done_count % BATCH_SIZE == 0 and done_count < len(to_scrape):
                    print(f"  ⏸️  Batch break ({done_count}/{len(to_scrape)} done), waiting {BATCH_BREAK}s...", flush=True)
                    save_json(PHONES_FILE, all_devices)
                    save_json(PROGRESS_FILE, progress)
                    time.sleep(BATCH_BREAK)

            progress["completedBrands"].append(brand_slug)
            progress["totalPhones"] += len(phones)
            elapsed = int(time.time() - t0)
            m, s = divmod(elapsed, 60)
            skip_info = f", {skipped_old} skipped (< {min_year})" if min_year and skipped_old else ""
            print(f"  ✅ {brand_slug}: {scraped} new phones scraped ({failed_count} failed{skip_info}) [{m}m{s}s]", flush=True)

            # Save after each brand
            save_json(PHONES_FILE, all_devices)
            save_json(PROGRESS_FILE, progress)
            print(f"  💾 Saved ({len(all_devices)} total)", flush=True)
            # Break between brands
            if i < len(brand_slugs) - 1:
                print(f"  ⏸️  Brand break: {BRAND_BREAK}s...", flush=True)
                time.sleep(BRAND_BREAK)

        except Exception as e:
            print(f"  ❌ Brand failed: {e}", flush=True)
            traceback.print_exc()
            progress["failedPhones"].append(f"{brand_slug}: {str(e)[:100]}")

    # Generate Firestore import file
    total_elapsed = int(time.time() - start_time)
    tm, ts = divmod(total_elapsed, 60)
    th, tm = divmod(tm, 60)

    save_json(OUTPUT_FILE, all_devices)
    save_json(PHONES_FILE, all_devices)
    save_json(PROGRESS_FILE, progress)

    print("\n" + "=" * 60, flush=True)
    print(f"🎉 DONE! {len(all_devices)} devices total", flush=True)
    print(f"   Brands completed: {len(progress['completedBrands'])}/{len(brand_slugs)}", flush=True)
    print(f"   New scraped: {progress['scrapedSpecs']}", flush=True)
    print(f"   Failed: {len(progress['failedPhones'])}", flush=True)
    print(f"   Time: {th}h {tm}m {ts}s", flush=True)
    print(f"   Output: {OUTPUT_FILE}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted — saving progress...", flush=True)
        try:
            save_json(PHONES_FILE, all_devices)
            save_json(PROGRESS_FILE, progress)
            save_json(OUTPUT_FILE, all_devices)
            print(f"💾 Saved {len(all_devices)} devices", flush=True)
        except Exception:
            pass
    except Exception as e:
        traceback.print_exc()
