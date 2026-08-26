#!/usr/bin/env python3
"""
Upgrade phone images: replace bigpic (160px) with pics (600px+).
Also generates gallery URLs for each phone.

Usage:
    python3 scripts/upgrade-images.py          # Upgrade existing phones
    python3 scripts/upgrade-images.py --dry-run # Preview without updating
"""
import json
import re
import sys
import time
from pathlib import Path

import requests

PHONES_FILE = Path("scripts/scraped-data/phones.json")

def load_env():
    env_path = Path(".env.local")
    text = env_path.read_text()
    sa_match = re.search(r'FIREBASE_SERVICE_ACCOUNT_JSON=(\{.*?\})', text, re.DOTALL)
    if not sa_match:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON not found")
    return json.loads(sa_match.group(1))

def get_access_token(sa_json):
    import jwt as pyjwt
    from jwt.utils import force_bytes
    from cryptography.hazmat.primitives import serialization
    now = int(time.time())
    payload = {"iss": sa_json["client_email"], "scope": "https://www.googleapis.com/auth/cloud-platform", "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}
    private_key = serialization.load_pem_private_key(force_bytes(sa_json["private_key"]), password=None)
    token = pyjwt.encode(payload, private_key, algorithm="RS256")
    resp = requests.post("https://oauth2.googleapis.com/token", data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": token})
    resp.raise_for_status()
    return resp.json()["access_token"]

def generate_gsmarena_image_urls(brand, name):
    """Generate possible GSMArena image URLs for a phone."""
    brand_lower = brand.lower()
    # Create phone name slug: lowercase, spaces to hyphens, remove special chars
    name_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    
    urls = []
    
    # Hero image patterns (try highest quality first)
    urls.append(("pics_with_num", f"https://fdn2.gsmarena.com/vv/pics/{brand_lower}/{brand_lower}-{name_slug}-1.jpg"))
    urls.append(("pics_no_num", f"https://fdn2.gsmarena.com/vv/pics/{brand_lower}/{brand_lower}-{name_slug}.jpg"))
    urls.append(("pics_nobrand_num", f"https://fdn2.gsmarena.com/vv/pics/{brand_lower}/{name_slug}-1.jpg"))
    urls.append(("pics_nobrand", f"https://fdn2.gsmarena.com/vv/pics/{brand_lower}/{name_slug}.jpg"))
    urls.append(("bigpic", f"https://fdn2.gsmarena.com/vv/bigpic/{brand_lower}-{name_slug}.jpg"))
    
    return urls

def check_image_quality(session, url):
    """Check if an image URL exists and return its quality info."""
    try:
        r = session.head(url, timeout=10, allow_redirects=True)
        if r.status_code == 200:
            content_type = r.headers.get("Content-Type", "")
            content_length = int(r.headers.get("Content-Length", 0))
            if "image" in content_type and content_length > 1000:
                return {"url": url, "size": content_length, "type": content_type}
    except:
        pass
    return None

def upgrade_hero_image(session, phone):
    """Try to find a higher quality hero image for a phone."""
    brand = phone.get("brand", "")
    name = phone.get("name", "")
    current_hero = phone.get("media", {}).get("heroImage", "")
    
    # If current hero is already from pics/, it's already good quality
    if current_hero and "/pics/" in current_hero:
        # Still try to find more gallery images
        pass
    
    # Generate candidate URLs
    patterns = generate_gsmarena_image_urls(brand, name)
    
    best_url = current_hero
    best_size = 0
    gallery_urls = []
    
    for pattern_name, url in patterns:
        result = check_image_quality(session, url)
        if result:
            gallery_urls.append(url)
            if result["size"] > best_size:
                best_size = result["size"]
                best_url = url
    
    # Try gallery images (numbers 2-8) based on the best URL found
    if best_url and "/pics/" in best_url:
        # Find the base pattern: remove the -1.jpg or .jpg suffix
        base = re.sub(r'-?\d*\.jpg$', '', best_url)
        if not base.endswith('-'):
            base += '-'
        for i in range(2, 10):
            gallery_url = f"{base}{i}.jpg"
            result = check_image_quality(session, gallery_url)
            if result:
                gallery_urls.append(gallery_url)
            else:
                break
        # Also try without number for the base
        base_clean = base.rstrip('-')
        if base_clean != best_url:
            result = check_image_quality(session, f"{base_clean}.jpg")
            if result and f"{base_clean}.jpg" not in gallery_urls:
                gallery_urls.append(f"{base_clean}.jpg")
    
    # Remove duplicates and bigpic from gallery
    seen = set()
    clean_gallery = []
    for url in gallery_urls:
        if url not in seen and url != best_url and "/bigpic/" not in url:
            seen.add(url)
            clean_gallery.append(url)
    
    return best_url, clean_gallery

def main():
    dry_run = "--dry-run" in sys.argv
    
    if not PHONES_FILE.exists():
        print("No phones.json found")
        return
    
    all_devices = json.loads(PHONES_FILE.read_text())
    print(f"📱 {len(all_devices)} phones to upgrade images", flush=True)
    
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    
    upgraded = 0
    gallery_added = 0
    already_good = 0
    errors = 0
    
    for i, phone in enumerate(all_devices):
        name = phone.get("name", "")[:40]
        brand = phone.get("brand", "")
        current_hero = phone.get("media", {}).get("heroImage", "")
        current_gallery = phone.get("media", {}).get("gallery", [])
        
        if i % 20 == 0 and i > 0:
            print(f"  [{i}/{len(all_devices)}] Upgraded: {upgraded}, Gallery: {gallery_added}, Good: {already_good}", flush=True)
        
        try:
            # Check if already good quality
            if current_hero and "/pics/" in current_hero and not current_hero.endswith("bigpic"):
                already_good += 1
                continue
            
            new_hero, new_gallery = upgrade_hero_image(session, phone)
            
            if new_hero and new_hero != current_hero:
                if not dry_run:
                    phone["media"]["heroImage"] = new_hero
                upgraded += 1
            
            if new_gallery and not current_gallery:
                if not dry_run:
                    phone["media"]["gallery"] = new_gallery
                gallery_added += 1
            
            time.sleep(1)  # Rate limit
            
        except Exception as e:
            errors += 1
            if i < 5:
                print(f"  ❌ {name}: {str(e)[:60]}", flush=True)
    
    print(f"\n✅ Done! Upgraded: {upgraded}, Gallery: {gallery_added}, Already good: {already_good}, Errors: {errors}", flush=True)
    
    if not dry_run and (upgraded > 0 or gallery_added > 0):
        PHONES_FILE.write_text(json.dumps(all_devices, indent=2, ensure_ascii=False))
        print(f"💾 Saved to {PHONES_FILE}", flush=True)

if __name__ == "__main__":
    main()
