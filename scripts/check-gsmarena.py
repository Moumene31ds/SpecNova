#!/usr/bin/env python3
"""
Monitor GSMArena IP ban status.
Checks every 5 minutes and notifies when ban is cleared.
"""
import requests
import time
import sys

CHECK_INTERVAL = 300  # 5 minutes
MAX_CHECKS = 288  # 24 hours

for i in range(MAX_CHECKS):
    try:
        s = requests.Session()
        s.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
        r = s.get('https://www.gsmarena.com/makers.php3', timeout=15)
        
        elapsed_h = (i * CHECK_INTERVAL) / 3600
        
        if r.status_code == 200:
            import re
            brands = re.findall(r'href="([a-z0-9-]+)-phones-\d+\.php"', r.text)
            print(f'[{time.strftime("%H:%M:%S")}] ✅ BAN CLEARED after ~{elapsed_h:.1f}h! Found {len(brands)} brands', flush=True)
            # Signal success
            with open('gsmarena-ready.flag', 'w') as f:
                f.write(f'cleared at {time.strftime("%Y-%m-%d %H:%M:%S")}\nbrands: {len(brands)}')
            sys.exit(0)
        else:
            print(f'[{time.strftime("%H:%M:%S")}] ❌ Still banned ({r.status_code}) — check #{i+1}, ~{elapsed_h:.1f}h elapsed', flush=True)
    except Exception as e:
        print(f'[{time.strftime("%H:%M:%S")}] ⚠️  Error: {str(e)[:80]}', flush=True)
    
    if i < MAX_CHECKS - 1:
        time.sleep(CHECK_INTERVAL)

print('Max checks reached', flush=True)
