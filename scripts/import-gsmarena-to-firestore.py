#!/usr/bin/env python3
"""
Import scraped GSMArena phones into Firestore.

Reads: scripts/scraped-data/firestore-import.json
Writes to: Firestore 'devices' collection

Usage:
    python3 scripts/import-gsmarena-to-firestore.py
    python3 scripts/import-gsmarena-to-firestore.py --dry-run
    python3 scripts/import-gsmarena-to-firestore.py --brand=samsung
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path("scripts/scraped-data")
INPUT_FILE = DATA_DIR / "firestore-import.json"
IMPORT_LOG = DATA_DIR / "import-log.json"
BATCH_SIZE = 50

# ---------------------------------------------------------------------------
# Firebase Auth (service account → access token)
# ---------------------------------------------------------------------------
def load_env():
    env_path = Path(".env.local")
    if not env_path.exists():
        raise RuntimeError(".env.local not found")
    text = env_path.read_text()
    sa_match = re.search(r'FIREBASE_SERVICE_ACCOUNT_JSON=(\{.*?\})', text, re.DOTALL)
    if not sa_match:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON not found in .env.local")
    return json.loads(sa_match.group(1))


def get_access_token(sa_json):
    import jwt as pyjwt
    from jwt.utils import force_bytes
    from cryptography.hazmat.primitives import serialization

    now = int(time.time())
    payload = {
        "iss": sa_json["client_email"],
        "scope": "https://www.googleapis.com/auth/cloud-platform",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    private_key = serialization.load_pem_private_key(
        force_bytes(sa_json["private_key"]), password=None
    )
    token = pyjwt.encode(payload, private_key, algorithm="RS256")
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": token},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Build searchContent for full-text search
# ---------------------------------------------------------------------------
def build_search_content(device):
    specs = device.get("specs") or {}
    parts = [
        device.get("brand", ""),
        device.get("name", ""),
        " ".join(device.get("modelNumbers") or []),
        (specs.get("platform") or {}).get("chipset", "") or "",
        str((specs.get("display") or {}).get("sizeIn", "") or ""),
        str((specs.get("battery") or {}).get("capacityMah", "") or ""),
        str((specs.get("cameras") or {}).get("rear", [{}])[0].get("megapixels", "")
            if (specs.get("cameras") or {}).get("rear") else ""),
        " ".join((specs.get("connectivity") or {}).get("bands", []) or []),
    ]
    return " ".join(str(p) for p in parts if p).lower()


# ---------------------------------------------------------------------------
# Firestore REST API helpers
# ---------------------------------------------------------------------------
def to_firestore_value(val):
    """Convert a Python value to Firestore REST API field format."""
    if val is None:
        return None
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        if not val:
            return None
        return {"stringValue": val}
    if isinstance(val, list):
        if not val:
            return {"arrayValue": {"values": []}}
        items = []
        for v in val:
            fv = to_firestore_value(v)
            if fv is not None:
                items.append(fv)
        return {"arrayValue": {"values": items}}
    if isinstance(val, dict):
        fields = {}
        for k, v in val.items():
            fv = to_firestore_value(v)
            if fv is not None:
                fields[k] = fv
        return {"mapValue": {"fields": fields}}
    return {"stringValue": str(val)}


def device_to_firestore(device):
    """Convert a device dict to Firestore REST API document fields."""
    # Top-level fields
    fields = {}
    simple_fields = ["id", "slug", "brand", "name", "status", "brandColor", "content"]
    for f in simple_fields:
        v = device.get(f)
        if v is not None:
            fields[f] = {"stringValue": str(v)}

    # modelNumbers (array of strings)
    mn = device.get("modelNumbers") or []
    fields["modelNumbers"] = {"arrayValue": {"values": [{"stringValue": s} for s in mn if s]}}

    # Timestamps as string ISO (Firestore will accept these)
    for ts_field in ["announcedAt", "releaseAt", "createdAt", "updatedAt"]:
        v = device.get(ts_field)
        if v:
            fields[ts_field] = {"stringValue": str(v)}

    # codename
    if device.get("codename"):
        fields["codename"] = {"stringValue": device["codename"]}

    # specs (nested map)
    specs = device.get("specs")
    if specs:
        fields["specs"] = to_firestore_value(specs)

    # media (nested map)
    media = device.get("media")
    if media:
        fields["media"] = to_firestore_value(media)

    # score (nested map)
    score = device.get("score")
    if score:
        fields["score"] = to_firestore_value(score)

    # priceSummary (nested map)
    ps = device.get("priceSummary")
    if ps:
        fields["priceSummary"] = to_firestore_value(ps)

    # searchContent
    fields["searchContent"] = {"stringValue": build_search_content(device)}

    # bandGroupIds
    fields["bandGroupIds"] = {"arrayValue": {"values": []}}

    # sources
    sources = device.get("sources") or []
    src_values = []
    for s in sources:
        src_fields = {}
        for k, v in s.items():
            fv = to_firestore_value(v)
            if fv:
                src_fields[k] = fv
        src_values.append({"mapValue": {"fields": src_fields}})
    fields["sources"] = {"arrayValue": {"values": src_values}}

    # embedding (empty array for now)
    fields["embedding"] = {"arrayValue": {"values": []}}

    # confidence
    fields["confidence"] = {"mapValue": {"fields": {
        "overall": {"doubleValue": 0.5},
    }}}

    return fields


# ---------------------------------------------------------------------------
# Main import
# ---------------------------------------------------------------------------
def main():
    dry_run = "--dry-run" in sys.argv
    brand_filter = None
    for arg in sys.argv[1:]:
        if arg.startswith("--brand="):
            brand_filter = arg.split("=", 1)[1].lower()

    # Load input
    if not INPUT_FILE.exists():
        print(f"❌ {INPUT_FILE} not found. Run scraper first.")
        sys.exit(1)

    devices = json.loads(INPUT_FILE.read_text())
    if not devices:
        print("❌ No devices in input file.")
        sys.exit(1)

    # Filter by brand if specified
    if brand_filter:
        devices = [d for d in devices if d.get("brand", "").lower().replace(" ", "-") == brand_filter
                   or d.get("slug", "").startswith(brand_filter)]
        print(f"🔍 Filtered to {len(devices)} {brand_filter} devices")

    print(f"📦 {len(devices)} devices to import")

    if dry_run:
        print("🔍 DRY RUN — no writes")
        # Show sample
        d = devices[0]
        print(f"  Sample: {d['brand']} {d['name']}")
        print(f"  Slug: {d['slug']}")
        print(f"  Score: {d.get('score', {}).get('total', '?')}/100")
        print(f"  Image: {d.get('media', {}).get('heroImage', 'N/A')[:60]}")
        return

    # Auth
    print("🔑 Authenticating...")
    sa_json = load_env()
    project_id = sa_json["project_id"]
    token = get_access_token(sa_json)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    db_prefix = f"projects/{project_id}/databases/(default)/documents"
    batch_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:batchWrite"

    # Import in batches
    count = 0
    errors = 0
    skipped = 0

    for batch_start in range(0, len(devices), BATCH_SIZE):
        batch = devices[batch_start : batch_start + BATCH_SIZE]
        writes = []

        for device in batch:
            slug = device.get("slug", "")
            if not slug:
                skipped += 1
                continue

            try:
                fields = device_to_firestore(device)
                writes.append({
                    "update": {
                        "name": f"{db_prefix}/devices/{slug}",
                        "fields": fields,
                    }
                })
            except Exception as e:
                errors += 1
                print(f"  ❌ {device.get('brand')} {device.get('name')}: {e}")

        if not writes:
            continue

        # Commit batch
        payload = {"writes": writes}
        resp = requests.post(batch_url, headers=headers, json=payload)

        if resp.status_code == 200:
            count += len(writes)
            print(f"  ✅ Batch {batch_start // BATCH_SIZE + 1}: {len(writes)} phones (total: {count})")
        else:
            # Fallback: commit one by one
            print(f"  ⚠️  Batch of {len(writes)} failed, trying individually...")
            for w in writes:
                r = requests.post(batch_url, headers=headers, json={"writes": [w]})
                if r.status_code == 200:
                    count += 1
                else:
                    errors += 1
                    doc_name = w.get("update", {}).get("name", "?")
                    err_msg = r.json().get("error", {}).get("message", "")[:100]
                    print(f"  ❌ {doc_name.split('/')[-1]}: {err_msg}")
                    if errors > 30:
                        print("  ⚠️  Too many errors, stopping.")
                        break

        if errors > 30:
            break

        # Small delay between batches
        time.sleep(0.3)

    # Save import log
    log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalDevices": len(devices),
        "imported": count,
        "errors": errors,
        "skipped": skipped,
    }
    IMPORT_LOG.write_text(json.dumps(log, indent=2))

    print(f"\n{'=' * 60}")
    print(f"🎉 DONE! {count} phones imported to Firestore")
    print(f"   Errors: {errors}")
    print(f"   Skipped: {skipped}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
