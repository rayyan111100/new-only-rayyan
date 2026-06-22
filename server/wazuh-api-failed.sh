#!/bin/bash
# Called by systemd when wazuh-custom-api service stops
# Sends email alert with reason

ALERT_EMAIL="gopal@cgcein.com"
SERVER=$(hostname)
LOG_FILE="/home/wazuh/api_server.log"

# Get last error from log
REASON="Unknown"
if [ -f "$LOG_FILE" ]; then
    REASON=$(tail -30 "$LOG_FILE" | grep -i "error\|traceback\|exception\|fail" | tail -3 | tr '\n' '; ')
fi
[ -z "$REASON" ] && REASON="Service stopped (check: journalctl -u wazuh-custom-api)"

# Get service status
STATUS=$(systemctl is-active wazuh-custom-api 2>/dev/null || echo "inactive")

BODY="Server: $SERVER
Time: $(date)
Status: $STATUS
Reason: $REASON
Action: systemd will auto-restart (RestartSec=10)"

echo -e "$BODY" | mail -s "Wazuh API Stopped - $STATUS" "$ALERT_EMAIL" 2>/dev/null
