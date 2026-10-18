#!/usr/bin/env bash
# Publishes the showcase (the app on made-up data, `npm run build:showcase`) to GitHub Pages from its own repository,
# so the demo data never enters this public repo's history. Usage: scripts/deploy-showcase.sh [owner/repo]
set -euo pipefail

REPO="${1:-premekzak/invojka-demo}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
npm run build:showcase

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "Invojka on made-up data, for testers"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp dist-showcase/index.html "$WORK/index.html"
touch "$WORK/.nojekyll"
printf 'User-agent: *\nDisallow: /\n' > "$WORK/robots.txt"

cd "$WORK"
git init -q -b main
git add -A
git commit -q -m "Showcase build $(date -u +%Y-%m-%dT%H:%MZ)"
# Each deploy replaces the whole history: only the latest build matters.
git push -q --force "https://github.com/$REPO.git" main

# Turn on Pages from the main branch (once; later calls just report it exists).
gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
echo "Published: https://${REPO%%/*}.github.io/${REPO#*/}/ (it can take a minute to appear)"
