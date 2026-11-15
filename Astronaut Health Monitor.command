#!/bin/bash
# Double-click to open the Astronaut Health Monitor in the browser (macOS).
# Starts the local server if it is not already running; close this window to stop it.
cd "$(dirname "$0")" || exit 1
URL=http://localhost:5173

if ! curl -s -o /dev/null "$URL"; then
  command -v npm >/dev/null || { echo "Node.js is not installed: get it from https://nodejs.org"; read -r; exit 1; }
  [ -d node_modules ] || npm install
  npx vite --port 5173 --strictPort &
  until curl -s -o /dev/null "$URL"; do sleep 0.5; done
  open "$URL"
  echo "Running at $URL - close this window to stop."
  wait
else
  open "$URL"
fi
