#!/bin/sh
# Assemble the Cloudflare Pages output: static files plus the Worker that serves /api/*.
set -e
cd "$(dirname "$0")"
rm -rf dist
cp -R public dist
mkdir dist/_worker.js
for f in src/*.js; do [ "$f" = src/worker.js ] || cp "$f" dist/_worker.js/; done
cp src/worker.js dist/_worker.js/index.js
printf '{"version":1,"include":["/api/*"],"exclude":[]}\n' > dist/_routes.json
