#!/usr/bin/env python3
"""
Incremental import — imports new phones from phones.json to Firestore
as they are scraped, without waiting for the full scrape to finish.
Runs once and exits. Call repeatedly via cron/watcher.

Usage:
    python3 scripts/import-incremental.py
"""
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
import requests

DATA_DIR = Path("scripts/scraped-data")
PHONES_FILE = DATA_DIR / "phones.json"
IMPORTED_FILE = DATA_DIR / "imported-slugs.json"
IMPORT_LOG = DATA_DIR / "import-log.json"
BATCH_SIZE = 50

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

def build_search_content(device):
    specs = device.get("specs") or {}
    parts = [device.get("brand", ""), device.get("name", ""), " ".join(device.get("modelNumbers") or []), (specs.get("platform") or {}).get("chipset", "") or "", str((specs.get("display") or {}).get("sizeIn", "") or ""), str((specs.get("battery") or {}).get("capacityMah", "") or ""), str((specs.get("cameras") or {}).get("rear", [{}])[0].get("megapixels", "") if (specs.get("cameras") or {}).get("rear") else "")]
    return " ".join(str(p) for p in parts if p).lower()

def to_firestore_value(val):
    if val is None: return None
    if isinstance(val, bool): return {"booleanValue": val}
    if isinstance(val, int): return {"integerValue": str(val)}
    if isinstance(val, float): return {"doubleValue": val}
    if isinstance(val, str):
        if not val: return None
        return {"stringValue": val}
    if isinstance(val, list):
        items = [fv for v in val if (fv := to_firestore_value(v)) is not None]
        return {"arrayValue": {"values": items}}
    if isinstance(val, dict):
        fields = {k: fv for k, v in val.items() if (fv := to_firestore_value(v)) is not None}
        return {"mapValue": {"fields": fields}}
    return {"stringValue": str(val)}

def device_to_firestore(device):
    fields = {}
    for f in ["id", "slug", "brand", "name", "status", "brandColor"]:
        v = device.get(f)
        if v: fields[f] = {"stringValue": str(v)}
    fields["modelNumbers"] = {"arrayValue": {"values": [{"stringValue": s} for s in (device.get("modelNumbers") or []) if s]}}
    for ts in ["announcedAt", "releaseAt", "createdAt", "updatedAt"]:
        v = device.get(ts)
        if v: fields[ts] = {"stringValue": str(v)}
    if device.get("codename"): fields["codename"] = {"stringValue": device["codename"]}
    for nested in ["specs", "media", "score", "priceSummary"]:
        v = device.get(nested)
        if v: fields[nested] = to_firestore_value(v)
    fields["searchContent"] = {"stringValue": build_search_content(device)}
    fields["bandGroupIds"] = {"arrayValue": {"values": []}}
    fields["embedding"] = {"arrayValue": {"values": []}}
    fields["confidence"] = {"mapValue": {"fields": {"overall": {"doubleValue": 0.5}}}}
    sources = device.get("sources") or []
    src_vals = []
    for s in sources:
        sf = {k: fv for k, v in s.items() if (fv := to_firestore_value(v)) is not None}
        src_vals.append({"mapValue": {"fields": sf}})
    fields["sources"] = {"arrayValue": {"values": src_vals}}
    return fields

def main():
    if not PHONES_FILE.exists():
        return

    all_devices = json.loads(PHONES_FILE.read_text())
    if not all_devices:
        return

    imported_slugs = set()
    if IMPORTED_FILE.exists():
        imported_slugs = set(json.loads(IMPORTED_FILE.read_text()))

    new_devices = [d for d in all_devices if d.get("slug") not in imported_slugs]
    if not new_devices:
        return

    print(f"📦 {len(new_devices)} new phones to import ({len(imported_slugs)} already imported)", flush=True)

    sa_json = load_env()
    project_id = sa_json["project_id"]
    token = get_access_token(sa_json)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    batch_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:batchWrite"
    db_prefix = f"projects/{project_id}/databases/(default)/documents"

    count = 0
    errors = 0
    newly_imported = set()

    for batch_start in range(0, len(new_devices), BATCH_SIZE):
        batch = new_devices[batch_start:batch_start + BATCH_SIZE]
        writes = []
        for device in batch:
            slug = device.get("slug", "")
            if not slug: continue
            try:
                fields = device_to_firestore(device)
                writes.append({"update": {"name": f"{db_prefix}/devices/{slug}", "fields": fields}})
            except Exception as e:
                errors += 1

        if not writes: continue
        resp = requests.post(batch_url, headers=headers, json={"writes": writes})
        if resp.status_code == 200:
            count += len(writes)
            for w in writes:
                slug = w["update"]["name"].split("/")[-1]
                newly_imported.add(slug)
            print(f"  ✅ Batch: {len(writes)} phones (total: {count})", flush=True)
        else:
            for w in writes:
                r = requests.post(batch_url, headers=headers, json={"writes": [w]})
                if r.status_code == 200:
                    count += 1
                    slug = w["update"]["name"].split("/")[-1]
                    newly_imported.add(slug)
                else:
                    errors += 1
        time.sleep(0.3)

    if newly_imported:
        imported_slugs.update(newly_imported)
        IMPORTED_FILE.write_text(json.dumps(list(imported_slugs), indent=2))

    log = {"timestamp": datetime.now(timezone.utc).isoformat(), "imported_this_run": count, "errors": errors, "total_imported": len(imported_slugs)}
    IMPORT_LOG.write_text(json.dumps(log, indent=2))
    if count > 0:
        print(f"  📥 {count} phones imported to Firestore ({errors} errors)", flush=True)

if __name__ == "__main__":
    main()
