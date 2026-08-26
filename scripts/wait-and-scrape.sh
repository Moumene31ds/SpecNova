#!/bin/bash
# Run scraper when GSMArena ban expires
cd "$(dirname "$0")/.."

LOG="scripts/scraped-data/scrape-log.txt"
mkdir -p scripts/scraped-data

echo "$(date): Waiting for ban to expire..." > "$LOG"

# Wait for ban (check every 5 min)
for i in $(seq 1 150); do
    STATUS=$(python3 -c "
import requests
s = requests.Session()
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
try:
    r = s.get('https://www.gsmarena.com/', timeout=10)
    print(r.status_code)
except:
    print('000')
" 2>/dev/null)
    
    if [ "$STATUS" = "200" ]; then
        echo "$(date): GSMArena accessible! Starting scrape..." >> "$LOG"
        rm -f scripts/scraped-data/phones.json scripts/scraped-data/progress.json scripts/scraped-data/firestore-import.json
        bash scripts/run-all.sh >> "$LOG" 2>&1
        echo "$(date): DONE" >> "$LOG"
        exit 0
    fi
    
    echo "$(date): Still blocked ($STATUS), waiting 5 min... (attempt $i)" >> "$LOG"
    sleep 300
done

echo "$(date): Timed out after 12.5 hours" >> "$LOG"
