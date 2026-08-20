#!/usr/bin/env python3
"""
Migrate imported phones to match the app's DeviceSpecs schema.

Transforms AI-extracted specs (screen, chargingW, ramGb) into
the pipeline schema (display, chargingWatts, ramOptions) and adds
missing required fields (content, priceSummary, bandGroupIds, etc.)
"""

import json
import re
import time
import requests
import sys
from jwt.utils import force_bytes
from cryptography.hazmat.primitives import serialization

# Firebase Auth
env_text = open(".env.local").read()
sa_match = re.search(r'FIREBASE_SERVICE_ACCOUNT_JSON=(\{.*?\})', env_text, re.DOTALL)
sa_json = json.loads(sa_match.group(1))
PROJECT_ID = sa_json["project_id"]

def get_token():
    import jwt
    now = int(time.time())
    pk = serialization.load_pem_private_key(force_bytes(sa_json["private_key"]), password=None)
    token = jwt.encode({"iss": sa_json["client_email"], "scope": "https://www.googleapis.com/auth/cloud-platform", "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}, pk, algorithm="RS256")
    resp = requests.post("https://oauth2.googleapis.com/token", data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": token})
    resp.raise_for_status()
    return resp.json()["access_token"]

print("Getting access token...", flush=True)
access_token = get_token()
headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
api_base = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"
db_prefix = f"projects/{PROJECT_ID}/databases/(default)/documents"
batch_url = f"https://firestore.googleapis.com/v1/{db_prefix}:batchWrite"

# Fetch all device docs
print("Fetching all devices...", flush=True)
all_docs = []
page_token = None
while True:
    url = f"{api_base}/devices"
    params = {"pageSize": 300}
    if page_token:
        params["pageToken"] = page_token
    resp = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, params=params)
    data = resp.json()
    docs = data.get("documents", [])
    all_docs.extend(docs)
    page_token = data.get("nextPageToken")
    if not page_token:
        break

print(f"Found {len(all_docs)} devices", flush=True)

# Parse a Firestore value to Python
def fs_to_py(val):
    if not val:
        return None
    t = val.get("stringValue")
    if t is not None: return t
    t = val.get("integerValue")
    if t is not None: return int(t)
    t = val.get("doubleValue")
    if t is not None: return float(t)
    t = val.get("booleanValue")
    if t is not None: return bool(t)
    t = val.get("arrayValue")
    if t is not None:
        return [fs_to_py(v) for v in t.get("values", [])]
    t = val.get("mapValue")
    if t is not None:
        return {k: fs_to_py(v) for k, v in t.get("fields", {}).items()}
    return None

# Python value to Firestore
def py_to_fs(val):
    if val is None:
        return None
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        items = [py_to_fs(v) for v in val if v is not None]
        return {"arrayValue": {"values": items}}
    if isinstance(val, dict):
        fields = {}
        for k, v in val.items():
            if v is not None:
                fields[k] = py_to_fs(v)
        return {"mapValue": {"fields": fields}}
    return {"stringValue": str(val)}

# Convert AI schema → Pipeline schema
def migrate_specs(ai):
    if not ai:
        ai = {}

    body = ai.get("body", {}) or {}
    screen = ai.get("screen", {}) or {}
    display = ai.get("display", {}) or screen  # fallback
    cam = ai.get("cameras", {}) or {}
    plat = ai.get("platform", {}) or {}
    mem = ai.get("memory", {}) or {}
    batt = ai.get("battery", {}) or {}
    conn = ai.get("connectivity", {}) or {}
    extras = ai.get("extras", {}) or {}

    # Body dimensions: string → object
    dims_raw = body.get("dimensions", "") or ""
    dims = {"widthMm": 0, "heightMm": 0, "depthMm": 0}
    if isinstance(dims_raw, str) and dims_raw:
        parts = re.findall(r'[\d.]+', dims_raw)
        if len(parts) >= 3:
            dims = {"widthMm": float(parts[0]), "heightMm": float(parts[1]), "depthMm": float(parts[2])}

    # Materials
    materials = body.get("materials", []) or []
    if isinstance(materials, str):
        materials = [m.strip() for m in materials.split(",")]
    build = body.get("build", "") or ""
    if not build and materials:
        build = " / ".join(materials)

    # Display
    hdr = display.get("hdr", []) or display.get("hdrSupport", []) or []
    if isinstance(hdr, str):
        hdr = [h.strip() for h in hdr.split(",")]

    display_out = {
        "type": (display.get("type", "") or "LCD"),
        "sizeIn": float(display.get("sizeIn", 0) or 0),
        "resolution": str(display.get("resolution", "") or ""),
        "ppi": int(display.get("ppi", 0) or 0),
        "refreshRateHz": int(display.get("refreshRateHz", 0) or 60),
        "peakBrightnessNits": int(display.get("peakBrightnessNits", 0) or display.get("peakBrightness", 0) or 0),
        "hdrSupport": hdr if isinstance(hdr, list) else [hdr],
        "pwmHz": display.get("pwmHz") or display.get("touchSamplingHz") or None,
        "glass": display.get("protection", None),
        "colorDepth": "10-bit" if any("10" in str(h) for h in hdr) else "8-bit",
    }

    # Camera
    rear_raw = cam.get("rear", []) or []
    rear = []
    if isinstance(rear_raw, list):
        for i, c in enumerate(rear_raw):
            if not isinstance(c, dict):
                continue
            label = (c.get("label", "") or "").lower()
            kind_map = {"wide": "wide", "ultrawide": "ultrawide", "telephoto": "telephoto", "periscope": "periscope", "macro": "macro", "depth": "depth", "selfie": "selfie"}
            kind = kind_map.get(label, "wide" if i == 0 else "ultrawide" if i == 1 else "telephoto")
            stab = (c.get("stabilization", "") or "").upper()
            if stab in ("OIS+EIS", "OIS + EIS"): stab = "OIS+EIS"
            elif "OIS" in stab: stab = "OIS"
            elif "EIS" in stab: stab = "EIS"
            else: stab = "none"

            rear.append({
                "id": f"rear-{i}",
                "position": "rear",
                "kind": kind,
                "megapixels": int(c.get("megapixels", 0) or 0),
                "aperture": c.get("aperture"),
                "sensorSize": c.get("sensorSize"),
                "pixelSize": str(c.get("pixelSizeUm", "") or "") or c.get("pixelSize"),
                "fieldOfViewDeg": c.get("fovDeg") or c.get("fieldOfViewDeg"),
                "opticalZoom": c.get("opticalZoom"),
                "digitalZoom": c.get("digitalZoom"),
                "stabilization": stab,
                "video": c.get("video", []) or [],
            })

    front_raw = cam.get("front", None) or []
    if isinstance(front_raw, dict):
        front_raw = [front_raw]
    elif not isinstance(front_raw, list):
        front_raw = []
    
    front = []
    for i, c in enumerate(front_raw):
        if not isinstance(c, dict):
            continue
        stab = (c.get("stabilization", "") or "").upper()
        if "EIS" in stab: stab = "EIS"
        else: stab = "none"
        front.append({
            "id": f"front-{i}",
            "position": "front",
            "kind": "selfie",
            "megapixels": int(c.get("megapixels", 0) or 0),
            "aperture": c.get("aperture"),
            "sensorSize": c.get("sensorSize"),
            "pixelSize": str(c.get("pixelSizeUm", "") or ""),
            "fieldOfViewDeg": c.get("fovDeg"),
            "opticalZoom": None,
            "digitalZoom": None,
            "stabilization": stab,
            "video": [],
        })

    cameras_out = {
        "rear": rear,
        "front": front,
        "features": cam.get("features", []) or [],
        "videoCapabilities": [cam.get("videoMax", "")] if cam.get("videoMax") else [],
    }

    # Memory
    ram = mem.get("ramGb", []) or mem.get("ram", []) or []
    if isinstance(ram, (int, float)):
        ram = [int(ram)]
    elif isinstance(ram, list):
        ram = [int(r) for r in ram if isinstance(r, (int, float)) and r > 0]
    else:
        ram = []
    
    storage = mem.get("storageGb", []) or mem.get("storage", []) or []
    if isinstance(storage, (int, float)):
        storage = [int(storage)]
    elif isinstance(storage, list):
        storage = [int(s) for s in storage if isinstance(s, (int, float)) and s > 0]
    else:
        storage = []

    storage_type = mem.get("storageType", "UFS 3.1") or "UFS 3.1"
    valid_types = ["UFS 2.2", "UFS 3.1", "UFS 4.0", "eMMC 5.1"]
    if storage_type not in valid_types:
        storage_type = "UFS 3.1"

    memory_out = {
        "ramOptions": ram if ram else [8],
        "storageOptions": storage if storage else [128],
        "storageType": storage_type,
        "cardSlot": bool(mem.get("cardSlot", False)),
    }

    # Battery
    battery_out = {
        "capacityMah": int(batt.get("capacityMah", 0) or 0),
        "type": batt.get("type", "Li-Po") or "Li-Po",
        "chargingWatts": int(batt.get("chargingW", 0) or batt.get("chargingWatts", 0) or 0),
        "chargingTimeMin": None,
        "wirelessWatts": int(batt.get("wirelessChargingW", 0) or batt.get("wirelessWatts", 0) or 0),
        "reverseWirelessWatts": int(batt.get("reverseW", 0) or batt.get("reverseWirelessWatts", 0) or 0),
        "enduranceHours": None,
    }

    # Connectivity
    gnss = conn.get("gnss", []) or []
    if isinstance(gnss, str):
        gnss = [g.strip() for g in gnss.split(",")]
    bands = conn.get("bands", []) or []
    if isinstance(bands, str):
        bands = [b.strip() for b in bands.split(",")]

    connectivity_out = {
        "wifi": conn.get("wifi", "") or "",
        "bluetooth": conn.get("bluetooth", "") or "",
        "nfc": bool(conn.get("nfc", False)),
        "usb": conn.get("usb", "USB-C") or "USB-C",
        "irBlaster": bool(conn.get("irBlaster", False) or extras.get("irBlaster", False)),
        "gnss": gnss,
        "bands": bands,
    }

    # Audio
    audio_out = {
        "speakers": [extras.get("speakers", "mono speaker") or "mono speaker"],
        "headphoneJack": bool(extras.get("headphoneJack", False)),
        "codecs": [],
        "microphone": "dual microphone",
    }

    # Sensors
    sensors = extras.get("sensors", []) or []
    if isinstance(sensors, str):
        sensors = [s.strip() for s in sensors.split(",")]

    # Extras → device extras
    fp = extras.get("fingerprint", "side") or "side"
    if isinstance(fp, str) and "under" in fp.lower():
        fp = "under-display"
    elif isinstance(fp, str) and "side" in fp.lower():
        fp = "side"
    elif isinstance(fp, str) and "rear" in fp.lower():
        fp = "rear"
    else:
        fp = "side"

    extras_out = {
        "fingerprint": fp,
        "faceUnlock": bool(extras.get("faceUnlock", False)),
        "stylus": bool(extras.get("stylus", False)),
        "esim": "esim" in str(conn.get("sim", "")).lower() or "esim" in str(extras.get("sim", "")).lower(),
        "uwb": bool(conn.get("uwb", False) or extras.get("uwb", False)),
        "satelliteSos": bool(conn.get("satelliteSos", False) or extras.get("satelliteSos", False)),
    }

    return {
        "body": {
            "dimensions": dims,
            "weightG": int(body.get("weightG", 0) or 0),
            "build": build,
            "materials": materials if isinstance(materials, list) else [],
            "protection": body.get("ipRating"),
            "ipRating": body.get("ipRating"),
            "colors": body.get("colors", []) or [],
        },
        "display": display_out,
        "platform": {
            "os": plat.get("os", "") or "",
            "ui": plat.get("ui", "") or "",
            "chipset": plat.get("chipset", "") or "",
            "cpu": plat.get("cpu", "") or "",
            "gpu": plat.get("gpu", "") or "",
            "antutuV10": plat.get("antutuV10") or plat.get("antutu"),
            "geekbench6": None,
        },
        "memory": memory_out,
        "cameras": cameras_out,
        "audio": audio_out,
        "battery": battery_out,
        "connectivity": connectivity_out,
        "sensors": sensors if isinstance(sensors, list) else [],
        "extras": extras_out,
    }


def build_content(brand, name, specs):
    parts = [
        brand, name,
        specs.get("platform", {}).get("chipset", ""),
        specs.get("platform", {}).get("cpu", ""),
        specs.get("platform", {}).get("gpu", ""),
        specs.get("display", {}).get("type", ""),
        str(specs.get("display", {}).get("sizeIn", "")),
        str(specs.get("battery", {}).get("capacityMah", "")),
        str((specs.get("cameras", {}).get("rear") or [{}])[0].get("megapixels", "")),
    ]
    return " ".join(p for p in parts if p).lower()


def migrate_device(doc):
    """Convert one Firestore doc to the new schema."""
    doc_name = doc.get("name", "")
    slug = doc_name.split("/")[-1]
    fields = {k: fs_to_py(v) for k, v in doc.get("fields", {}).items()}

    brand = fields.get("brand", "")
    name = fields.get("name", "")
    
    # Migrate specs
    old_specs = fields.get("specs", {}) or {}
    new_specs = migrate_specs(old_specs)

    # Build content
    content = build_content(brand, name, new_specs)

    # Build priceSummary from pricing
    pricing = fields.get("pricing", {}) or {}
    msrp = pricing.get("msrp") or pricing.get("startingPrice") or 0
    if isinstance(msrp, (int, float)) and msrp > 0:
        price_summary = {
            "currency": pricing.get("currency", "USD") or "USD",
            "latest": float(msrp),
            "msrp": float(msrp),
            "min": float(msrp),
            "max": float(msrp),
            "average": float(msrp),
            "dropPercent": 0,
            "trend": "stable",
            "sources": [],
        }
    else:
        price_summary = {
            "currency": "USD",
            "latest": 0,
            "msrp": 0,
            "min": 0,
            "max": 0,
            "average": 0,
            "dropPercent": 0,
            "trend": "stable",
            "sources": [],
        }

    # Build score
    score = fields.get("score", {})
    score_out = {
        "total": float(score.get("total", 65) or 65),
        "hardware": float(score.get("hardware", 60) or 60),
        "display": float(score.get("display", 65) or 65),
        "camera": float(score.get("camera", 60) or 60),
        "battery": float(score.get("battery", 70) or 70),
        "value": float(score.get("value", 70) or 70),
        "sentiment": 75,
    }

    # Band group IDs
    band_groups = []
    bands = new_specs.get("connectivity", {}).get("bands", [])
    has_5g = any(b.startswith("n") for b in bands)
    has_4g = any(b.startswith("B") or b.startswith("b") for b in bands)
    if has_5g: band_groups.append("5G")
    if has_4g: band_groups.append("4G")

    # Model numbers
    model_numbers = fields.get("modelNumbers", []) or []
    if isinstance(model_numbers, str):
        model_numbers = [model_numbers]

    # Media
    media = fields.get("media", {}) or {}
    
    return {
        "slug": slug,
        "brand": brand,
        "name": name,
        "modelNumbers": model_numbers,
        "codename": fields.get("codename"),
        "status": fields.get("status", "available"),
        "brandColor": fields.get("brandColor", "#6B7280"),
        "specs": new_specs,
        "media": {
            "heroImage": media.get("heroImage"),
            "gallery": media.get("gallery", []) or [],
            "renderImages": media.get("renderImages", []) or [],
            "modelUrl": None,
            "cameraSamples": {},
        },
        "content": content,
        "score": score_out,
        "priceSummary": price_summary,
        "bandGroupIds": band_groups,
        "sources": fields.get("sources", []) or [],
    }


# Migrate and batch write
BATCH_SIZE = 50
total = 0
errors = 0
writes_batch = []

for doc in all_docs:
    try:
        migrated = migrate_device(doc)
        slug = migrated["slug"]
        doc_path = f"{db_prefix}/devices/{slug}"
        
        # Build Firestore fields
        fs_fields = {}
        for k, v in migrated.items():
            if v is not None:
                converted = py_to_fs(v)
                if converted:
                    fs_fields[k] = converted
        
        writes_batch.append({
            "updateMask": {"paths": list(fs_fields.keys())},
            "update": {
                "name": doc_path,
                "fields": fs_fields,
            }
        })
        total += 1
        
        if len(writes_batch) >= BATCH_SIZE:
            resp = requests.post(batch_url, headers=headers, json={"writes": writes_batch})
            if resp.status_code != 200:
                # Try without updateMask
                for w in writes_batch:
                    w.pop("updateMask", None)
                resp = requests.post(batch_url, headers=headers, json={"writes": writes_batch})
                if resp.status_code != 200:
                    errors += len(writes_batch)
                    print(f"  ❌ Batch failed: {resp.json().get('error',{}).get('message','')[:100]}", flush=True)
                else:
                    print(f"  ✅ Committed {len(writes_batch)} (total: {total})", flush=True)
            else:
                print(f"  ✅ Committed {len(writes_batch)} (total: {total})", flush=True)
            writes_batch = []
    except Exception as e:
        errors += 1
        if errors <= 10:
            print(f"  ❌ {doc.get('name','?').split('/')[-1]}: {str(e)[:100]}", flush=True)

# Final batch
if writes_batch:
    for w in writes_batch:
        w.pop("updateMask", None)
    resp = requests.post(batch_url, headers=headers, json={"writes": writes_batch})
    if resp.status_code != 200:
        errors += len(writes_batch)
        print(f"  ❌ Final batch failed: {resp.json().get('error',{}).get('message','')[:100]}", flush=True)
    else:
        print(f"  ✅ Committed final {len(writes_batch)}", flush=True)

print(f"\n🎉 Migration done! {total} devices migrated, {errors} errors", flush=True)
