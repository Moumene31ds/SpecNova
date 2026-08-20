#!/usr/bin/env python3
"""
Watch for GSMArena ban to clear, then automatically run scraper.
"""
import os
import sys
import time
import subprocess
from datetime import datetime

CHECK_INTERVAL = 300  # 5 min
FLAG_FILE = "gsmarena-ready.flag"
LOG_FILE = "scraper-auto.log"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def check_gsmarena():
    import requests
    try:
        s = requests.Session()
        s.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
        r = s.get('https://www.gsmarena.com/makers.php3', timeout=15)
        return r.status_code == 200
    except:
        return False

log("=== GSMArena Monitor + Auto-Scraper Started ===")

check_num = 0
while True:
    check_num += 1
    log(f"Check #{check_num} — testing GSMArena...")
    
    if check_gsmarena():
        log("✅ GSMArena is BACK! Starting scraper...")
        with open(FLAG_FILE, "w") as f:
            f.write(f"cleared at {datetime.now().isoformat()}")
        
        # Run the scraper
        proc = subprocess.Popen(
            [sys.executable, "scraper.py", "--mode=full", "--download-images", "--resume"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        
        log(f"Scraper started (PID: {proc.pid})")
        
        # Monitor scraper output
        with open("scraper-auto.log", "a") as f:
            for line in proc.stdout:
                f.write(line)
                f.flush()
                if line.strip():
                    print(line.strip(), flush=True)
        
        proc.wait()
        log(f"Scraper finished with exit code: {proc.returncode}")
        
        # After scraper, import to Firestore
        log("Starting Firestore import...")
        import_proc = subprocess.Popen(
            [sys.executable, "scripts/import-to-firestore.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        with open("scraper-auto.log", "a") as f:
            for line in import_proc.stdout:
                f.write(line)
                f.flush()
                if line.strip():
                    print(line.strip(), flush=True)
        import_proc.wait()
        log(f"Firestore import finished with exit code: {import_proc.returncode}")
        
        break
    else:
        elapsed_h = (check_num * CHECK_INTERVAL) / 3600
        log(f"❌ Still banned (~{elapsed_h:.1f}h elapsed)")
    
    time.sleep(CHECK_INTERVAL)

log("=== Done! ===")
