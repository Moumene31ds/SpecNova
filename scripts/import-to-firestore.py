#!/usr/bin/env python3
"""
Import phones.json into Firestore via REST API.

Usage: python3 scripts/import-to-firestore.py
"""

import json
import os
import time
from pathlib import Path
import requests

# Load env
import re
env_text = open(".env.local").read()
sa_match = re.search(r'FIREBASE_SERVICE_ACCOUNT_JSON=(\{.*?\})', env_text, re.DOTALL)
if not sa_match:
    raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON not found in .env.local")
sa_json = json.loads(sa_match.group(1))
PROJECT_ID = sa_json["project_id"]
CLIENT_EMAIL = sa_json["client_email"]
PRIVATE_KEY = sa_json["private_key"]

# Get access token
def get_access_token():
    import jwt as pyjwt
    from jwt.utils import force_bytes
    from cryptography.hazmat.primitives import serialization
    
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": CLIENT_EMAIL,
        "scope": "https://www.googleapis.com/auth/cloud-platform",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    
    private_key = serialization.load_pem_private_key(force_bytes(PRIVATE_KEY), password=None)
    token = pyjwt.encode(payload, private_key, algorithm="RS256")
    
    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": token,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]

def slugify(text):
    import re
    text = text.lower()
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def build_search_content(device):
    specs = device.get("specs") or {}
    parts = [
        device.get("brand", ""),
        device.get("name", ""),
        " ".join(device.get("modelNumbers") or []),
        (specs.get("platform") or {}).get("chipset", "") or "",
        str((specs.get("screen") or {}).get("sizeIn", "") or ""),
        str((specs.get("battery") or {}).get("capacityMah", "") or ""),
        str((specs.get("cameras") or {}).get("rear", [{}])[0].get("megapixels", "") if (specs.get("cameras") or {}).get("rear") else ""),
    ]
    return " ".join(str(p) for p in parts if p).lower()

def main():
    import jwt as pyjwt
    
    print("Getting access token...")
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    db_prefix = f"projects/{PROJECT_ID}/databases/(default)/documents"
    batch_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:batchWrite"
    
    phones = json.load(open("phones.json"))
    print(f"📦 Importing {len(phones)} phones to Firestore...")
    
    count = 0
    errors = 0
    BATCH_SIZE = 50
    
    # Process in batches
    for batch_start in range(0, len(phones), BATCH_SIZE):
        batch = phones[batch_start:batch_start + BATCH_SIZE]
        writes = []
        
        for p in batch:
            try:
                slug = p.get("slug") or slugify(f"{p.get('brand','')} {p.get('name','')}")
                search_content = build_search_content(p)
                
                # Build Firestore document
                fields = {
                    "slug": {"stringValue": slug},
                    "brand": {"stringValue": p.get("brand", "")},
                    "name": {"stringValue": p.get("name", "")},
                    "status": {"stringValue": p.get("status", "available")},
                    "specs": {"mapValue": {"fields": convert_specs(p.get("specs", {}))}},
                    "media": {"mapValue": {"fields": {
                        "heroImage": {"stringValue": (p.get("images") or {}).get("heroImage") or p.get("heroImage") or ""},
                        "gallery": {"arrayValue": {"values": [{"stringValue": u} for u in (p.get("images") or {}).get("gallery") or [] if u]}},
                        "renderImages": {"arrayValue": {"values": [{"stringValue": u} for u in (p.get("images") or {}).get("renderImages") or [] if u]}},
                    }}},
                    "pricing": convert_pricing(p.get("pricing", {})),
                    "searchContent": {"stringValue": search_content},
                    "score": convert_score(compute_score_simple(p.get("specs", {}), (p.get("pricing") or {}).get("msrp"))),
                    "confidence": {"mapValue": {"fields": {
                        "overall": {"doubleValue": 0.5},
                    }}},
                }
                
                ry = p.get("releaseYear")
                if ry:
                    fields["releaseYear"] = {"integerValue": str(int(ry))}
                
                doc = {"fields": fields}
                
                writes.append({
                        "update": {
                            "name": f"{db_prefix}/devices/{slug}",
                        "fields": doc["fields"],
                    }
                })
                count += 1
                
            except Exception as e:
                errors += 1
                if errors <= 10:
                    print(f"  ❌ {p.get('brand')} {p.get('name')}: {str(e)[:100]}")
        
        # Commit batch, with fallback to smaller sub-batches on failure
        if writes:
            payload = {"writes": writes}
            resp = requests.post(batch_url, headers=headers, json=payload)
            if resp.status_code != 200:
                # Fallback: commit one by one
                print(f"  ⚠️  Batch of {len(writes)} failed, trying individually...", flush=True)
                for w in writes:
                    r = requests.post(batch_url, headers=headers, json={"writes": [w]})
                    if r.status_code == 200:
                        count += 1
                    else:
                        errors += 1
                        if errors <= 20:
                            doc_name = w.get("update", {}).get("name", "?")
                            err_msg = r.json().get("error", {}).get("message", "")[:100]
                            print(f"  ❌ {doc_name.split('/')[-1]}: {err_msg}", flush=True)
            else:
                print(f"  ✅ Committed {len(writes)} phones (total: {count})", flush=True)
    
    print(f"\n🎉 Done! {count} phones imported, {errors} errors")


def convert_specs(specs):
    """Convert specs dict to Firestore format recursively."""
    result = {}
    if not isinstance(specs, dict):
        return result
    for key, val in specs.items():
        if val is None:
            continue
        if isinstance(val, dict):
            sub = convert_specs(val)
            if sub:  # Only include non-empty maps
                result[key] = {"mapValue": {"fields": sub}}
        elif isinstance(val, list):
            if not val:
                continue
            if all(isinstance(v, dict) for v in val):
                items = [{"mapValue": {"fields": convert_specs(v)}} for v in val]
                result[key] = {"arrayValue": {"values": items}}
            elif all(isinstance(v, str) for v in val):
                result[key] = {"arrayValue": {"values": [{"stringValue": v} for v in val]}}
            elif all(isinstance(v, bool) for v in val):
                result[key] = {"arrayValue": {"values": [{"booleanValue": v} for v in val]}}
            elif all(isinstance(v, (int, float)) for v in val):
                result[key] = {"arrayValue": {"values": [{"integerValue": str(int(v))} for v in val]}}
            else:
                result[key] = {"arrayValue": {"values": [{"stringValue": str(v)} for v in val]}}
        elif isinstance(val, bool):
            result[key] = {"booleanValue": val}
        elif isinstance(val, int):
            # Detect boolean-like values (0/1 for nfc, headphoneJack, etc.)
            if key in ("nfc", "headphoneJack", "fmRadio", "irBlaster", "satelliteSos", "uwb", "stylus", "stylusStorage", "cardSlot", "faceUnlock") or (isinstance(val, int) and val in (0, 1) and key.lower() in ("nfc", "headphonejack", "fmradio", "irblaster", "satellite", "uwb", "stylus", "cardslot", "faceunlock")):
                result[key] = {"booleanValue": bool(val)}
            else:
                result[key] = {"integerValue": str(val)}
        elif isinstance(val, float):
            result[key] = {"doubleValue": val}
        elif isinstance(val, str):
            if val:  # Skip empty strings
                result[key] = {"stringValue": val}
        else:
            result[key] = {"stringValue": str(val)}
    return result


def convert_pricing(pricing):
    fields = {}
    for key, val in (pricing or {}).items():
        if val is not None:
            if isinstance(val, (int, float)):
                fields[key] = {"doubleValue": float(val)}
            else:
                fields[key] = {"stringValue": str(val)}
    if not fields:
        fields["currency"] = {"stringValue": "USD"}
    return {"mapValue": {"fields": fields}}


def convert_score(score):
    fields = {}
    for key, val in score.items():
        fields[key] = {"doubleValue": float(val)}
    return {"mapValue": {"fields": fields}}


def compute_score_simple(specs, price_usd=None):
    """Simple score computation matching compute-score.ts logic."""
    hardware = 50
    display = 50
    camera = 50
    battery = 50
    
    platform = specs.get("platform") or {}
    chipset = (platform.get("chipset") or "").lower()
    if "snapdragon 8" in chipset or "dimensity 9" in chipset or "a1[789]" in chipset:
        hardware += 20
    elif "snapdragon 7" in chipset or "dimensity 8" in chipset or "exynos 2" in chipset:
        hardware += 10
    
    ram = (specs.get("memory") or {}).get("ramGb", [])
    if isinstance(ram, list) and ram:
        max_ram = max(r for r in ram if isinstance(r, (int, float))) if any(isinstance(r, (int, float)) for r in ram) else 0
    elif isinstance(ram, (int, float)):
        max_ram = ram
    else:
        max_ram = 0
    if max_ram >= 16: hardware += 15
    elif max_ram >= 12: hardware += 10
    elif max_ram >= 8: hardware += 5
    
    # Display
    refresh = (specs.get("screen") or {}).get("refreshRateHz", 60)
    if isinstance(refresh, (int, float)):
        if refresh >= 144: display += 20
        elif refresh >= 120: display += 15
        elif refresh >= 90: display += 5
    
    brightness = (specs.get("screen") or {}).get("peakBrightnessNits", 0)
    if isinstance(brightness, (int, float)):
        if brightness >= 2000: display += 15
        elif brightness >= 1000: display += 10
    
    ppi = (specs.get("screen") or {}).get("ppi", 0)
    if isinstance(ppi, (int, float)):
        if ppi >= 500: display += 10
        elif ppi >= 400: display += 5
    
    # Camera
    rear = (specs.get("cameras") or {}).get("rear", [])
    if isinstance(rear, list) and rear:
        main_mp = rear[0].get("megapixels", 0) if isinstance(rear[0], dict) else 0
        if isinstance(main_mp, (int, float)):
            if main_mp >= 200: camera += 25
            elif main_mp >= 100: camera += 20
            elif main_mp >= 50: camera += 15
            elif main_mp >= 12: camera += 5
    
    if len(rear) >= 4: camera += 10
    elif len(rear) >= 3: camera += 5
    
    # Battery
    mah = (specs.get("battery") or {}).get("capacityMah", 0)
    if isinstance(mah, (int, float)):
        if mah >= 6000: battery += 20
        elif mah >= 5000: battery += 15
        elif mah >= 4000: battery += 5
    
    charging = (specs.get("battery") or {}).get("chargingW", 0)
    if isinstance(charging, (int, float)):
        if charging >= 100: battery += 15
        elif charging >= 65: battery += 10
        elif charging >= 30: battery += 5
    
    value = 70
    
    def clamp(v):
        return max(0, min(100, round(v)))
    
    total = round(hardware * 0.3 + display * 0.15 + camera * 0.25 + battery * 0.15 + value * 0.15)
    
    return {
        "total": clamp(total),
        "hardware": clamp(hardware),
        "display": clamp(display),
        "camera": clamp(camera),
        "battery": clamp(battery),
        "value": clamp(value),
    }


if __name__ == "__main__":
    main()
