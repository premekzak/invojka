#!/usr/bin/env bash
# Publishes the website (`npm run build:web`, docs/website.md) to GitHub Pages from its own repository, which holds only
# the built pages; the source stays here. Run it only when the owner asks.
# Usage: scripts/deploy-website.sh [owner/repo]
#
# invojka.cz is served by Cloudflare, which follows this repository (see wrangler.jsonc below), so a push here is the
# deploy. DOMAIN is only for a custom domain of GitHub Pages' own copy and stays empty.
# While the site is not launched (docs/launch.md), search engines are told to stay away: robots.txt here and the
# noindex tag in website/index.html. Remove both together at launch.
set -euo pipefail

REPO="${1:-premekzak/invojka-web}"
DOMAIN=""
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
npm run build:web

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "The Invojka website (built pages; the source is in premekzak/invojka)"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -r dist-website/. "$WORK/"
touch "$WORK/.nojekyll"
printf 'User-agent: *\nDisallow: /\n' > "$WORK/robots.txt"
if [ -n "$DOMAIN" ]; then printf '%s\n' "$DOMAIN" > "$WORK/CNAME"; fi
# For Cloudflare, which serves the site from this repository (Workers with static assets, connected to Git): its deploy
# command `npx wrangler deploy` reads this file. No script, only the files; the name must stay the Cloudflare project's.
printf '{\n  "name": "%s",\n  "compatibility_date": "2025-09-01",\n  "assets": { "directory": "." }\n}\n' "${REPO#*/}" > "$WORK/wrangler.jsonc"
printf 'wrangler.jsonc\n.assetsignore\n.git\n.nojekyll\nCNAME\n' > "$WORK/.assetsignore"

cd "$WORK"
git init -q -b main
git add -A
git commit -q -m "Website build $(date -u +%Y-%m-%dT%H:%MZ)"
# Each deploy replaces the whole history: only the latest build matters.
git push -q --force "https://github.com/$REPO.git" main

# Turn on Pages from the main branch (once; later calls just report it exists).
gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
if [ -n "$DOMAIN" ]; then echo "Published: https://$DOMAIN/ (it can take a minute to appear)"
else echo "Published: https://${REPO%%/*}.github.io/${REPO#*/}/ (it can take a minute to appear)"; fi
