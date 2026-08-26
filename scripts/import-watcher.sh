#!/bin/bash
# Watch scraper and import to Firestore every 2 minutes
cd "$(dirname "$0")/.."
LOG="scripts/scraped-data/import-watcher.log"
mkdir -p scripts/scraped-data

echo "$(date): Import watcher started" > "$LOG"

while true; do
    # Check if scraper is running
    if ! pgrep -f "scrape-gsmarena" > /dev/null 2>&1 && ! pgrep -f "run-all.sh" > /dev/null 2>&1; then
        echo "$(date): Scraper finished, doing final import..." >> "$LOG"
        python3 scripts/import-incremental.py >> "$LOG" 2>&1
        echo "$(date): Import watcher done" >> "$LOG"
        exit 0
    fi

    # Import whatever is available
    python3 scripts/import-incremental.py >> "$LOG" 2>&1
    echo "$(date): Import cycle done, sleeping 120s..." >> "$LOG"
    sleep 120
done
