#!/bin/bash
# Wazuh API Watchdog - auto-restarts API + email alert on failure
# Usage: bash /home/wazuh/wazuh-api-watchdog.sh &

API_SCRIPT="/home/wazuh/wazuh_api_server.py"
CHECK_INTERVAL=30
ALERT_EMAIL="gopal@cgcein.com"
SERVER_NAME=$(hostname)
LAST_STATE="running"

send_alert() {
    local subject="$1"
    local message="$2"
    echo "$message" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || \
    echo -e "Subject: $subject\n\n$message" | sendmail "$ALERT_EMAIL" 2>/dev/null || \
    curl -s --max-time 5 --data "subject=$subject&message=$message" \
      "http://localhost:3099/api/notifications/send-test" 2>/dev/null || true
}

get_last_error() {
    local log_file="/home/wazuh/api_server.log"
    local reason="Unknown"
    if [ -f "$log_file" ]; then
        reason=$(tail -20 "$log_file" | grep -i "error\|traceback\|exception\|fail" | tail -5 | tr '\n' '; ')
    fi
    if [ -z "$reason" ]; then
        reason=$(dmesg 2>/dev/null | grep -i "python\|wazuh" | tail -3 | tr '\n' '; ' || echo "No error log found")
    fi
    echo "$reason"
}

while true; do
    if ! pgrep -f "wazuh_api_server.py" > /dev/null; then
        REASON=$(get_last_error)
        echo "[$(date)] ⚠ API not running. Restarting... Reason: $REASON"
        cd /home/wazuh && python3 "$API_SCRIPT" &
        sleep 3
        if pgrep -f "wazuh_api_server.py" > /dev/null; then
            echo "[$(date)] ✅ API restarted"
            send_alert "🔴 Wazuh API Crashed - Restarted" \
              "Time: $(date)\nServer: $SERVER_NAME\nAction: Auto-restarted\nStatus: Running now\n\nReason: $REASON"
        fi
        LAST_STATE="restarted"
    elif ! curl -s -o /dev/null --max-time 5 http://localhost:9999/health; then
        REASON=$(get_last_error)
        echo "[$(date)] ⚠ API not responding. Killing and restarting... Reason: $REASON"
        pkill -f "wazuh_api_server.py" 2>/dev/null
        sleep 2
        cd /home/wazuh && python3 "$API_SCRIPT" &
        sleep 3
        if pgrep -f "wazuh_api_server.py" > /dev/null; then
            echo "[$(date)] ✅ API restarted"
            send_alert "🔴 Wazuh API Unresponsive - Restarted" \
              "Time: $(date)\nServer: $SERVER_NAME\nAction: Killed and restarted\nStatus: Running now\n\nReason: $REASON"
        fi
        LAST_STATE="restarted"
    fi
    sleep $CHECK_INTERVAL
done
