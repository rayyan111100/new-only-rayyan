# Wazuh API Fix Guide - Step by Step

## Problem
Wazuh API Server (`wazuh_api_server.py`) stops after ~4 hours due to `ConnectionResetError`. UniShield dashboard loses data connection.

## Step 1: Fix the API Script (crash-proof + threading)

### 1.1 Add error handling for connection resets
In `/home/wazuh/wazuh_api_server.py`, inside `do_GET()`:

**Before:**
```python
self.end_headers()
# ... route handling ...
self.wfile.write(json.dumps(resp, default=str).encode())
```

**After:**
```python
try:
    self.end_headers()
except (BrokenPipeError, ConnectionResetError):
    return

try:
    self.wfile.write(json.dumps(resp, default=str).encode())
except (BrokenPipeError, ConnectionResetError):
    pass
```

### 1.2 Use ThreadedHTTPServer (handles multiple requests)
Replace:
```python
from http.server import HTTPServer, BaseHTTPRequestHandler
```
With:
```python
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True
```

Replace at bottom:
```python
HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
```
With:
```python
ThreadedHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
```

---

## Step 2: Install Systemd Service (auto-start on boot + auto-restart)

### 2.1 Create service file
```bash
sudo tee /etc/systemd/system/wazuh-custom-api.service << 'EOF'
[Unit]
Description=Wazuh Custom SOC API Server
After=network.target opensearch.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/wazuh
ExecStart=/usr/bin/python3 /home/wazuh/wazuh_api_server.py
Restart=always
RestartSec=10
StandardOutput=append:/home/wazuh/api_server.log
StandardError=append:/home/wazuh/api_server.log

[Install]
WantedBy=multi-user.target
EOF
```

### 2.2 Enable and start
```bash
sudo systemctl daemon-reload
sudo systemctl enable wazuh-custom-api
sudo systemctl start wazuh-custom-api
```

### 2.3 Check status
```bash
sudo systemctl status wazuh-custom-api
```

### 2.4 View logs
```bash
sudo journalctl -u wazuh-custom-api -f
```

---

## Step 3: Watchdog Script (email alert on crash)

### 3.1 Create watchdog
```bash
cat > /home/wazuh/wazuh-api-watchdog.sh << 'EOF'
#!/bin/bash
API_SCRIPT="/home/wazuh/wazuh_api_server.py"
CHECK_INTERVAL=30
ALERT_EMAIL="gopal@cgcein.com"
SERVER_NAME=$(hostname)

send_alert() {
    local subject="$1"; local message="$2"
    echo "$message" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || \
    echo -e "Subject: $subject\n\n$message" | sendmail "$ALERT_EMAIL" 2>/dev/null || true
}

while true; do
    if ! pgrep -f "wazuh_api_server.py" > /dev/null; then
        echo "[$(date)] API not running. Restarting..."
        cd /home/wazuh && python3 "$API_SCRIPT" &
        sleep 3
        if pgrep -f "wazuh_api_server.py" > /dev/null; then
            send_alert "Wazuh API Crashed - Restarted" \
              "Time: $(date)\nServer: $SERVER_NAME\nAction: Auto-restarted\nStatus: OK"
        fi
    elif ! curl -s -o /dev/null --max-time 5 http://localhost:9999/health; then
        echo "[$(date)] API not responding. Restarting..."
        pkill -f "wazuh_api_server.py" 2>/dev/null; sleep 2
        cd /home/wazuh && python3 "$API_SCRIPT" &
        sleep 3
        if pgrep -f "wazuh_api_server.py" > /dev/null; then
            send_alert "Wazuh API Unresponsive - Restarted" \
              "Time: $(date)\nServer: $SERVER_NAME\nAction: Restarted\nStatus: OK"
        fi
    fi
    sleep $CHECK_INTERVAL
done
EOF

chmod +x /home/wazuh/wazuh-api-watchdog.sh
```

### 3.2 Run watchdog
```bash
nohup bash /home/wazuh/wazuh-api-watchdog.sh > /home/wazuh/watchdog.log 2>&1 &
```

### 3.3 Test email
```bash
echo "Test email from Wazuh watchdog" | mail -s "Wazuh API Test" gopal@cgcein.com
```

---

## Step 4: UniShield Dashboard (.env Configuration)

### 4.1 Set correct API URL
File: `U360-PROD/.env`
```
UNISHIELD360_API_URL=http://192.168.1.77:9999
PORT=3099
JWT_SECRET=unishield360-secret-key-2026
```

### 4.2 Test connection from Windows
```bash
curl http://192.168.1.77:9999/health
```
Expected response:
```json
{"status":"ok","cluster":"wazuh-cluster","cluster_status":"yellow","nodes":1}
```

---

## Step 5: Run Full Stack

### 5.1 Start backend
```bash
cd U360-PROD
node server/server.cjs
```

### 5.2 Start frontend (separate terminal)
```bash
cd U360-PROD
npm run dev
```

### 5.3 Or start both
```bash
cd U360-PROD
npm start
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Address already in use` | `pkill -f wazuh_api_server.py` then restart |
| `ConnectionResetError` | Apply Step 1.1 fix (try/except around wfile.write) |
| API stops after hours | Use systemd (Step 2) OR watchdog (Step 3) |
| Email not sending | Install mailutils: `apt install mailutils` |
| Port 9999 blocked | `sudo ufw allow 9999` |
| Can't reach Wazuh from Windows | Check `hostname -I` on Wazuh server, update `.env` |

---

## Quick Commands Reference

```bash
# Restart API
sudo systemctl restart wazuh-custom-api

# Check API status
curl http://localhost:9999/health

# Watchdog logs
tail -f /home/wazuh/watchdog.log

# API logs
tail -f /home/wazuh/api_server.log

# Kill all API processes
pkill -f wazuh_api_server.py

# Start API manually
cd /home/wazuh && python3 wazuh_api_server.py &
```
