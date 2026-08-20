#!/usr/bin/env python3
"""
AI Phone Importer — Uses Gemini to discover and extract phone specs.

Usage:
    python3 scripts/import-phones.py --brands=samsung,apple,google --max=50
    python3 scripts/import-phones.py --brands=all --max=50
    python3 scripts/import-phones.py --resume
"""

import json
import os
import re
import sys
import time
import traceback
from pathlib import Path
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

OUTPUT_FILE = "phones.json"
PROGRESS_FILE = "import-progress.json"
ENV_FILE = ".env.local"

TOP_BRANDS = [
    "Samsung", "Apple", "Google", "Xiaomi", "OnePlus", "Huawei",
    "Oppo", "Vivo", "Realme", "Sony", "Nokia", "Motorola",
    "Honor", "Nothing", "Asus", "Tecno", "Infinix", "iQOO",
    "Poco", "Redmi",
]

# ---------------------------------------------------------------------------
# Load API key
# ---------------------------------------------------------------------------

def load_api_key():
    """Load GEMINI_API_KEY from .env.local"""
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    
    env_path = Path(ENV_FILE)
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("GEMINI_API_KEY not found in env or .env.local")

API_KEY = load_api_key()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text):
    text = text.lower()
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_progress():
    return load_json(PROGRESS_FILE, {
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "lastBrand": None,
        "completedBrands": [],
        "totalPhones": 0,
        "scrapedPhones": 0,
        "failedPhones": [],
    })

def save_progress(p):
    save_json(PROGRESS_FILE, p)

def load_phones():
    return load_json(OUTPUT_FILE, [])

def save_phones(phones):
    phones.sort(key=lambda p: (p.get("brand", ""), p.get("name", "")))
    save_json(OUTPUT_FILE, phones)
    print(f"💾 Saved {len(phones)} phones to {OUTPUT_FILE}", flush=True)

# ---------------------------------------------------------------------------
# Gemini API
# ---------------------------------------------------------------------------

GEMINI_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
]

current_model_idx = 0

def call_gemini(prompt, system_prompt=None, max_tokens=4096, temperature=0.1):
    """Call Gemini API directly via requests with model rotation."""
    global current_model_idx
    
    for attempt in range(5):
        model = GEMINI_MODELS[current_model_idx % len(GEMINI_MODELS)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}"
        
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        if system_prompt:
            body["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        
        try:
            resp = requests.post(url, json=body, timeout=60)
            
            if resp.status_code in (429, 502, 503, 504):
                wait = (attempt + 1) * 15
                print(f"  ⏳ Rate limited ({resp.status_code}) on {model}, rotating & waiting {wait}s...", flush=True)
                current_model_idx += 1
                time.sleep(wait)
                continue
            
            resp.raise_for_status()
            result = resp.json()
            text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            if not text:
                raise RuntimeError("Empty Gemini response")
            return text
        except requests.exceptions.Timeout:
            wait = (attempt + 1) * 10
            print(f"  ⏳ Timeout on {model}, rotating & waiting {wait}s...", flush=True)
            current_model_idx += 1
            time.sleep(wait)
        except requests.exceptions.ConnectionError as e:
            wait = (attempt + 1) * 10
            print(f"  ⏳ Connection error on {model}, rotating & waiting {wait}s...", flush=True)
            current_model_idx += 1
            time.sleep(wait)
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep((attempt + 1) * 5)
    
    raise RuntimeError("Failed after 5 attempts")

# ---------------------------------------------------------------------------
# Brand Discovery
# ---------------------------------------------------------------------------

def discover_brand_phones(brand):
    print(f"\n🔍 Discovering {brand} phones...", flush=True)
    
    prompt = f"""List ALL {brand} smartphone models from 2023-2026.

For EACH phone, return ONE line:
Model Name | Year | Category

Where:
- Model Name = Official name (e.g. "Galaxy S25 Ultra", "iPhone 16 Pro Max")
- Year = Release year (2023, 2024, 2025, or 2026)
- Category = flagship / mid-range / budget / foldable / gaming / tablet

Include ALL models: flagships, mid-range, budget, foldables, gaming phones.
Be comprehensive. Do NOT skip any model."""

    raw = call_gemini(prompt, "You are a comprehensive phone catalog researcher.", max_tokens=4096)
    
    phones = []
    for line in raw.split("\n"):
        line = re.sub(r'^[-*•\d.]\s*', '', line).strip()
        if not line or len(line) < 5:
            continue
        
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 2:
            name = parts[0]
            try:
                year = int(parts[1])
            except (ValueError, IndexError):
                continue
            category = parts[2] if len(parts) > 2 else "phone"
            
            if 2023 <= year <= 2027 and len(name) > 3:
                phones.append({"name": name, "year": year, "category": category})
    
    # Deduplicate
    seen = set()
    unique = []
    for p in phones:
        key = f"{brand} {p['name']}".lower()
        if key not in seen:
            seen.add(key)
            unique.append(p)
    
    print(f"  Found {len(unique)} {brand} phones", flush=True)
    return unique

# ---------------------------------------------------------------------------
# Phone Spec Extraction
# ---------------------------------------------------------------------------

def extract_phone_specs(brand, name):
    full_name = f"{brand} {name}"
    
    prompt = f"""Extract COMPLETE specifications for the "{full_name}" smartphone.

Return a JSON object with EXACTLY this structure:
{{
  "brand": "{brand}",
  "name": "{name}",
  "releaseYear": 2024,
  "status": "available",
  "images": {{
    "heroImage": "URL of main product image or null",
    "gallery": []
  }},
  "specs": {{
    "body": {{
      "dimensions": "W x H x D mm",
      "weightG": 200,
      "ipRating": "IP68",
      "sim": "Nano-SIM + eSIM",
      "colors": ["Black"]
    }},
    "screen": {{
      "type": "LTPO AMOLED",
      "sizeIn": 6.7,
      "resolution": "1440 x 3200",
      "ppi": 500,
      "refreshRateHz": 120,
      "peakBrightnessNits": 2000,
      "hdr": ["HDR10+"]
    }},
    "cameras": {{
      "rear": [
        {{
          "label": "wide",
          "megapixels": 50,
          "aperture": "f/1.8",
          "stabilization": "OIS",
          "features": ["PDAF"]
        }}
      ],
      "front": {{
        "label": "selfie",
        "megapixels": 12,
        "aperture": "f/2.2"
      }}
    }},
    "platform": {{
      "os": "Android 14",
      "chipset": "Snapdragon 8 Gen 3",
      "processNodeNm": 4,
      "antutuV10": 2000000
    }},
    "memory": {{
      "ramGb": [8, 12],
      "storageGb": [128, 256],
      "storageType": "UFS 4.0"
    }},
    "battery": {{
      "capacityMah": 5000,
      "chargingW": 45,
      "wirelessChargingW": 15
    }},
    "connectivity": {{
      "network": "5G",
      "wifi": "Wi-Fi 7",
      "bluetooth": "5.3",
      "nfc": true,
      "usb": "USB-C 3.2"
    }},
    "extras": {{
      "fingerprint": "under-display",
      "headphoneJack": false
    }}
  }},
  "pricing": {{
    "msrp": 999,
    "currency": "USD"
  }}
}}

Use ACCURATE specs for this EXACT phone model. Search your knowledge for correct values.
If unsure about a field, use null. Return ONLY valid JSON, no markdown."""

    raw = call_gemini(prompt, "You are a phone specifications expert. Return ONLY valid JSON.", 
                      max_tokens=4096, temperature=0.05)
    
    # Extract JSON from response
    code_block = re.search(r'```(?:json)?\s*(.*?)```', raw, re.DOTALL)
    if code_block:
        raw = code_block.group(1)
    
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        raise RuntimeError("No JSON found in response")
    
    json_str = json_match.group(0)
    
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError:
        # Try to fix common issues
        fixed = re.sub(r',\s*([}\]])', r'\1', json_str)
        parsed = json.loads(fixed)
    
    # Add metadata
    parsed["id"] = slugify(f"{brand} {name}")
    parsed["slug"] = slugify(f"{brand} {name}")
    parsed["gsmarenaId"] = None
    parsed["sourceUrl"] = ""
    parsed["brandColor"] = get_brand_color(brand)
    parsed["scrapedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    parsed["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    if "pricing" not in parsed or not parsed["pricing"]:
        parsed["pricing"] = {"msrp": None, "currency": "USD"}
    
    # Fix aperture "f/f/X" -> "f/X"
    fix_aperture = lambda s: s.replace("f/f/", "f/") if s else s
    if parsed.get("specs", {}).get("cameras", {}).get("rear"):
        for cam in parsed["specs"]["cameras"]["rear"]:
            if cam.get("aperture"):
                cam["aperture"] = fix_aperture(cam["aperture"])
    if parsed.get("specs", {}).get("cameras", {}).get("front"):
        f = parsed["specs"]["cameras"]["front"]
        if f.get("aperture"):
            f["aperture"] = fix_aperture(f["aperture"])
    
    return parsed

def get_brand_color(brand):
    colors = {
        "samsung": "#1428A0", "apple": "#A2AAAD", "google": "#4285F4",
        "xiaomi": "#FF6700", "oneplus": "#F5010C", "huawei": "#CF0A2C",
        "oppo": "#1BA784", "vivo": "#415FFF", "realme": "#FFC800",
        "sony": "#000000", "nokia": "#124191", "motorola": "#5C2D91",
        "honor": "#00B0F0", "nothing": "#000000", "asus": "#00529B",
        "tecno": "#0066CC", "infinix": "#F37920", "iqoo": "#F5C518",
    }
    return colors.get(brand.lower(), "#6B7280")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]
    
    brands_arg = next((a for a in args if a.startswith("--brands=")), None)
    max_arg = next((a for a in args if a.startswith("--max=")), None)
    resume = "--resume" in args
    
    if brands_arg:
        val = brands_arg.split("=", 1)[1]
        brands = TOP_BRANDS if val == "all" else [b.strip() for b in val.split(",")]
    else:
        brands = TOP_BRANDS
    
    max_per_brand = int(max_arg.split("=")[1]) if max_arg else 50
    
    print("=" * 60, flush=True)
    print(f"🤖 AI Phone Importer — {len(brands)} brands, max {max_per_brand}/brand", flush=True)
    print("=" * 60, flush=True)
    
    progress = load_progress()
    phones = load_phones()
    existing_slugs = {p["slug"] for p in phones}
    
    start_idx = 0
    if resume and progress["lastBrand"]:
        try:
            idx = brands.index(progress["lastBrand"])
            start_idx = idx + 1
        except ValueError:
            pass
    
    for i in range(start_idx, len(brands)):
        brand = brands[i]
        progress["lastBrand"] = brand
        
        if brand in progress["completedBrands"]:
            print(f"\n⏭️  {brand} — already completed, skipping", flush=True)
            continue
        
        print(f"\n{'━' * 60}", flush=True)
        print(f"📱 [{i+1}/{len(brands)}] {brand}", flush=True)
        print("━" * 60, flush=True)
        
        try:
            # Use hardcoded lists for brands with discovery issues
            if brand == "samsung" and len(progress.get("_samsung_hardcoded", []) or []) == 0:
                discovered = [{"name": "Galaxy S23", "year": 2023, "category": "flagship"},
                              {"name": "Galaxy S23+", "year": 2023, "category": "flagship"},
                              {"name": "Galaxy S23 Ultra", "year": 2023, "category": "flagship"},
                              {"name": "Galaxy S23 FE", "year": 2023, "category": "flagship"},
                              {"name": "Galaxy S24", "year": 2024, "category": "flagship"},
                              {"name": "Galaxy S24+", "year": 2024, "category": "flagship"},
                              {"name": "Galaxy S24 Ultra", "year": 2024, "category": "flagship"},
                              {"name": "Galaxy S24 FE", "year": 2024, "category": "flagship"},
                              {"name": "Galaxy S25", "year": 2025, "category": "flagship"},
                              {"name": "Galaxy S25+", "year": 2025, "category": "flagship"},
                              {"name": "Galaxy S25 Ultra", "year": 2025, "category": "flagship"},
                              {"name": "Galaxy S25 Edge", "year": 2025, "category": "flagship"},
                              {"name": "Galaxy Z Flip5", "year": 2023, "category": "foldable"},
                              {"name": "Galaxy Z Fold5", "year": 2023, "category": "foldable"},
                              {"name": "Galaxy Z Flip6", "year": 2024, "category": "foldable"},
                              {"name": "Galaxy Z Fold6", "year": 2024, "category": "foldable"},
                              {"name": "Galaxy Z Fold6 Special Edition", "year": 2024, "category": "foldable"},
                              {"name": "Galaxy A14", "year": 2023, "category": "budget"},
                              {"name": "Galaxy A14 5G", "year": 2023, "category": "budget"},
                              {"name": "Galaxy A24", "year": 2023, "category": "mid-range"},
                              {"name": "Galaxy A34 5G", "year": 2023, "category": "mid-range"},
                              {"name": "Galaxy A54 5G", "year": 2023, "category": "mid-range"},
                              {"name": "Galaxy A15", "year": 2024, "category": "budget"},
                              {"name": "Galaxy A15 5G", "year": 2024, "category": "budget"},
                              {"name": "Galaxy A25 5G", "year": 2024, "category": "mid-range"},
                              {"name": "Galaxy A35 5G", "year": 2024, "category": "mid-range"},
                              {"name": "Galaxy A55 5G", "year": 2024, "category": "mid-range"},
                              {"name": "Galaxy A16", "year": 2024, "category": "budget"},
                              {"name": "Galaxy A16 5G", "year": 2024, "category": "budget"},
                              {"name": "Galaxy A26 5G", "year": 2025, "category": "mid-range"},
                              {"name": "Galaxy A36 5G", "year": 2025, "category": "mid-range"},
                              {"name": "Galaxy A56 5G", "year": 2025, "category": "mid-range"},
                              {"name": "Galaxy Note 20 Ultra", "year": 2023, "category": "flagship"}]
            elif brand == "google" and len(progress.get("_google_hardcoded", []) or []) == 0:
                discovered = [{"name": "Pixel 7a", "year": 2023, "category": "mid-range"},
                              {"name": "Pixel 7", "year": 2023, "category": "flagship"},
                              {"name": "Pixel 7 Pro", "year": 2023, "category": "flagship"},
                              {"name": "Pixel Fold", "year": 2023, "category": "foldable"},
                              {"name": "Pixel 8", "year": 2024, "category": "flagship"},
                              {"name": "Pixel 8 Pro", "year": 2024, "category": "flagship"},
                              {"name": "Pixel 8a", "year": 2024, "category": "mid-range"},
                              {"name": "Pixel 9", "year": 2024, "category": "flagship"},
                              {"name": "Pixel 9 Pro", "year": 2024, "category": "flagship"},
                              {"name": "Pixel 9 Pro XL", "year": 2024, "category": "flagship"},
                              {"name": "Pixel 9 Pro Fold", "year": 2024, "category": "foldable"},
                              {"name": "Pixel 9a", "year": 2025, "category": "mid-range"},
                              {"name": "Pixel 10", "year": 2025, "category": "flagship"},
                              {"name": "Pixel 10 Pro", "year": 2025, "category": "flagship"},
                              {"name": "Pixel 10 Pro XL", "year": 2025, "category": "flagship"},
                              {"name": "Pixel 10 Pro Fold", "year": 2025, "category": "foldable"}]
            else:
                discovered = discover_brand_phones(brand)
            filtered = discovered[:max_per_brand]
            progress["totalPhones"] += len(filtered)
            
            imported = 0
            brand_failures = 0
            for j, phone in enumerate(filtered):
                slug = slugify(f"{brand} {phone['name']}")
                
                if slug in existing_slugs:
                    print(f"  ⏭️  [{j+1}/{len(filtered)}] {phone['name']} — exists", flush=True)
                    continue
                
                # Skip brand if too many consecutive failures (likely rate limited)
                if brand_failures >= 8:
                    print(f"  ⚠️  Too many failures for {brand}, skipping remaining {len(filtered)-j} phones", flush=True)
                    break
                
                print(f"  📋 [{j+1}/{len(filtered)}] Extracting {brand} {phone['name']}...", flush=True)
                
                try:
                    data = extract_phone_specs(brand, phone["name"])
                    phones.append(data)
                    existing_slugs.add(slug)
                    progress["scrapedPhones"] += 1
                    imported += 1
                    brand_failures = 0  # Reset on success
                    save_phones(phones)
                    save_progress(progress)
                except Exception as e:
                    msg = str(e)[:200]
                    print(f"  ❌ {phone['name']}: {msg}", flush=True)
                    progress["failedPhones"].append(f"{brand} {phone['name']}: {msg}")
                    save_progress(progress)
                    brand_failures += 1
                    time.sleep(5)  # Extra pause after error
            
            progress["completedBrands"].append(brand)
            print(f"  ✅ {brand}: {imported} phones imported", flush=True)
        except Exception as e:
            print(f"  ❌ {brand} discovery failed: {e}", flush=True)
            progress["failedPhones"].append(f"{brand} discovery: {str(e)[:100]}")
        
        save_phones(phones)
        save_progress(progress)
    
    print("\n" + "=" * 60, flush=True)
    print(f"🎉 DONE! {len(phones)} total phones imported", flush=True)
    print(f"Failed: {len(progress['failedPhones'])}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted — saving progress...", flush=True)
        p = load_progress()
        save_progress(p)
    except Exception as e:
        traceback.print_exc()
        save_progress(load_progress())
