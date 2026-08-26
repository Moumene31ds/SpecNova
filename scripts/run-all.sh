#!/bin/bash
# ============================================================================
# Master Script — Scrape GSMArena + Import to Firestore
# ============================================================================
# Usage:
#   bash scripts/run-all.sh              # All brands, all years
#   bash scripts/run-all.sh --force      # Skip ban check
#   bash scripts/run-all.sh --new-only   # Only 2024+ phones
#   bash scripts/run-all.sh --year=2025  # Only 2025+ phones
#   bash scripts/run-all.sh --import     # Import only (skip scraping)
# ============================================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"; }
err() { echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"; }
warn(){ echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"; }

# ---- Parse args ----
FORCE=false
IMPORT_ONLY=false
NEW_ONLY=false
YEAR_ARG=""
for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
        --import) IMPORT_ONLY=true ;;
        --new-only) NEW_ONLY=true ;;
        --year=*) YEAR_ARG="$arg" ;;
    esac
done

# Build scraper flags
SCRAPER_FLAGS="--brands=all --resume"
if [ "$NEW_ONLY" = true ]; then
    SCRAPER_FLAGS="$SCRAPER_FLAGS --new-only"
fi
if [ -n "$YEAR_ARG" ]; then
    SCRAPER_FLAGS="$SCRAPER_FLAGS $YEAR_ARG"
fi

# ---- Step 0: Check ban ----
if [ "$IMPORT_ONLY" = false ]; then
    log "Checking GSMArena access..."
    STATUS=$(python3 -c "
import requests
s = requests.Session()
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
r = s.get('https://www.gsmarena.com/', timeout=10)
print(r.status_code)
" 2>/dev/null || echo "000")

    if [ "$STATUS" = "429" ]; then
        if [ "$FORCE" = true ]; then
            warn "GSMArena returning 429, but --force flag set. Continuing..."
        else
            err "GSMArena is blocking us (429). Ban still active."
            log "Options:"
            log "  1. Wait and retry later"
            log "  2. Run with --force to try anyway"
            log "  3. Run with --import to import previously scraped data"
            exit 1
        fi
    elif [ "$STATUS" = "200" ]; then
        ok "GSMArena is accessible!"
    else
        warn "Unexpected status: $STATUS"
        if [ "$FORCE" = false ]; then
            exit 1
        fi
    fi
fi

# ---- Step 1: Scrape ----
if [ "$IMPORT_ONLY" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📱 Step 1: Scraping all brands from GSMArena..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    python3 scripts/scrape-gsmarena.py $SCRAPER_FLAGS 2>&1
    SCRAPE_EXIT=$?

    if [ $SCRAPE_EXIT -ne 0 ]; then
        err "Scraper exited with errors (code $SCRAPE_EXIT)"
        log "Progress saved. Re-run this script to resume."
        exit $SCRAPE_EXIT
    fi

    # Count scraped phones
    PHONE_COUNT=$(python3 -c "
import json
from pathlib import Path
f = Path('scripts/scraped-data/firestore-import.json')
if f.exists():
    print(len(json.loads(f.read_text())))
else:
    print(0)
" 2>/dev/null)

    ok "Scraped $PHONE_COUNT phones"

    if [ "$PHONE_COUNT" -eq 0 ]; then
        err "No phones scraped. Nothing to import."
        exit 1
    fi
fi

# ---- Step 2: Import to Firestore ----
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🔥 Step 2: Importing to Firestore..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

python3 scripts/import-gsmarena-to-firestore.py 2>&1
IMPORT_EXIT=$?

if [ $IMPORT_EXIT -ne 0 ]; then
    err "Import exited with errors (code $IMPORT_EXIT)"
    exit $IMPORT_EXIT
fi

# ---- Done ----
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "ALL DONE! 🎉"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Summary:"
log "  Phones scraped:  $PHONE_COUNT"
log "  Import log:      scripts/scraped-data/import-log.json"
log "  Output file:     scripts/scraped-data/firestore-import.json"
echo ""
