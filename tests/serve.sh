#!/usr/bin/env bash
# Startet alle Test-Server im Vordergrund (Strg+C beendet alle):
#   8765–8767 statische Testseiten (Login, Kasse, Stripe-iframe, Musik …)  · tests/fixtures/site
#   8799      Nachbau von DuckDuckGo/Wikipedia für die eigene Ergebnisseite  · tests/fixtures/search-server.js
#   8798      Test-Song/-Video + LRCLIB-Nachbau für den Disko-Modus          · tests/fixtures/disco
cd "$(dirname "$0")/fixtures"
trap 'kill 0' EXIT
[ -f disco/track.webm ] || python3 disco/make-track.py
(cd site && python3 -m http.server 8765 >/dev/null 2>&1) &
(cd site && python3 -m http.server 8766 >/dev/null 2>&1) &
(cd site && python3 -m http.server 8767 >/dev/null 2>&1) &
node search-server.js &
node disco/server.js &
wait
