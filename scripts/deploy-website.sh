#!/usr/bin/env bash
# Publishes the website (`npm run build:web`, docs/website.md) to GitHub Pages from its own repository, which holds only
# the built pages; the source stays here. Run it only when the owner asks.
# Usage: scripts/deploy-website.sh [owner/repo]
#
# DOMAIN below is empty until invojka.cz points at GitHub Pages. Each deploy replaces the whole repository, so the
# domain has to be written into every build (the CNAME file): set it here once the DNS works, not in GitHub's settings.
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
