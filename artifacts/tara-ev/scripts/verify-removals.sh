#!/usr/bin/env bash
# Fails if client-requested removals reappear anywhere in the site:
# Mautic inquiry form scripts/markup, floating contact sidebar, WhatsApp
# widget, web footer, or inquiry form section. See replit.md
# "Client-requested removals". These have been restored accidentally by
# past merges (e.g. offline localization) — this script guards against that.
# Scans source files, and also the production build output (dist/public)
# when it exists, so a build step or vendored dependency can't reintroduce
# removed content into the published site. Pass --require-dist to fail if
# dist/public is missing (used by the production build before publish).
set -euo pipefail
cd "$(dirname "$0")/.."

require_dist=0
if [ "${1:-}" = "--require-dist" ]; then
  require_dist=1
fi

scan_dirs=(public/content/ src/ index.html public/js/)
if [ -d dist/public ]; then
  scan_dirs+=(dist/public/)
elif [ "$require_dist" -eq 1 ]; then
  echo "ERROR: dist/public not found — build output must exist for pre-publish verification"
  exit 1
fi

fail=0

check() {
  local label="$1" pattern="$2"
  shift 2
  local hits
  hits=$(grep -rlE "$@" "$pattern" "${scan_dirs[@]}" 2>/dev/null | sort -u || true)
  if [ -n "$hits" ]; then
    echo "REMOVED CONTENT REAPPEARED — $label:"
    echo "$hits" | head -20
    fail=1
  fi
}

# Vendored Mautic form scripts and the retired NEV-brand logo must not exist at all
for f in public/js/form-generate.js public/js/mautic-form.js \
         dist/public/js/form-generate.js dist/public/js/mautic-form.js \
         public/images/tara-nev-logo.png dist/public/images/tara-nev-logo.png; do
  if [ -e "$f" ]; then
    echo "REMOVED FILE REAPPEARED: $f"
    fail=1
  fi
done

# "mauticform" appears in dead CSS selectors (styling for the deleted form),
# which are harmless — exclude .css files for this text token only.
check "Mautic form markup/scripts (mauticform outside CSS)" \
  'mauticform' --exclude='*.css'
check "Mautic form script files (form-generate.js / mautic-form.js)" \
  'form-generate\.js|mautic-form\.js'
check "external inquiry-form script source (formcs.globalso.com)" \
  'formcs\.globalso\.com'
check "floating contact sidebar (ul.right_nav)" \
  '<ul[^>]*class="[^"]*right_nav'
check "inquiry popup (div.inquiry-pop-bd)" \
  '<div[^>]*class="[^"]*inquiry-pop-bd'
check "WhatsApp widget (#whatsapp / #whatsappMain)" \
  'id="whatsapp(Main)?"'
check "web footer (<footer class=\"web-footer\">)" \
  '<footer[^>]*class="[^"]*web-footer'
check "inquiry form section (section.inquiry-form-wrap)" \
  '<section[^>]*class="[^"]*inquiry-form-wrap'
check "Online Service floating sidebar (aside.scrollsidebar)" \
  '<aside[^>]*class="[^"]*scrollsidebar'

# Page titles in routes.json must stay <=60 chars and unique (SEO trim, Task 15-era).
# Past merges have restored old long/duplicate titles — guard against regression.
check_titles() {
  local file="$1" label="$2"
  [ -f "$file" ] || return 0
  local out
  out=$(node -e '
    const routes = require(process.argv[1]);
    const seen = new Map();
    let bad = [];
    for (const [route, cfg] of Object.entries(routes)) {
      if (!cfg || typeof cfg.title !== "string") continue;
      const t = cfg.title;
      if (t.length > 60) bad.push(`TOO LONG (${t.length} chars) ${route}: ${t}`);
      if (seen.has(t)) bad.push(`DUPLICATE title "${t}" on ${route} (also ${seen.get(t)})`);
      else seen.set(t, route);
    }
    if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
  ' "$PWD/$file" 2>&1) || {
    echo "PAGE TITLE CHECK FAILED — $label:"
    echo "$out" | head -20
    fail=1
  }
}

check_titles public/content/routes.json "source routes.json"
check_titles dist/public/content/routes.json "built routes.json"

if [ "$fail" -eq 0 ]; then
  echo "OK: no removed inquiry form, popups, widgets, or footer found"
fi
exit $fail
