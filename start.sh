#!/bin/bash
cd "$(dirname "$0")"

echo "[sniffer] Starting server and client..."

(cd server && npm run dev) &
SERVER_PID=$!

(cd client && npm run dev) &
CLIENT_PID=$!

trap "echo ''; echo '[sniffer] Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null" EXIT INT TERM

wait
