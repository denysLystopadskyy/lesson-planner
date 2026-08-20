#!/usr/bin/env bash
# Mechanical verification gate for a research report triple (.md / .html / .pdf).
#
# Usage: ./verify-report.sh <path-to-report.md>
# Exit:  0 = all gates pass, 1 = at least one gate failed.
#
# Gates 1-6 are pass/fail. Gate 7 prints figures needing a human check
# (every number must carry a source reference or be labelled TBD).
# The PDF layout check (page-number footers, no clipped tables) is a
# human read of the generated file and is not automatable here.

set -uo pipefail

MD="${1:-}"
if [[ -z "$MD" || ! -f "$MD" ]]; then
  echo "Usage: $0 <path-to-report.md>" >&2
  exit 2
fi

BASE="${MD%.md}"
HTML="$BASE.html"
PDF="$BASE.pdf"
NAME="$(basename "$BASE")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_HTML="$REPO_ROOT/index.html"

fails=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; fails=$((fails + 1)); }
warn() { printf '  WARN  %s\n' "$1"; }

printf '\nVerifying %s\n\n' "$NAME"

# --- Gate 1: the three files exist and are substantial ---------------------
md_bytes=0; html_bytes=0; pdf_bytes=0
[[ -f "$MD" ]]   && md_bytes=$(wc -c < "$MD" | tr -d ' ')
[[ -f "$HTML" ]] && html_bytes=$(wc -c < "$HTML" | tr -d ' ')
[[ -f "$PDF" ]]  && pdf_bytes=$(wc -c < "$PDF" | tr -d ' ')

if [[ "$md_bytes" -ge 10240 ]]; then
  pass "markdown present ($((md_bytes / 1024)) KB)"
else
  fail "markdown missing or under 10 KB ($md_bytes bytes)"
fi

if [[ "$html_bytes" -ge "$md_bytes" ]]; then
  pass "html present ($((html_bytes / 1024)) KB)"
else
  fail "html missing or smaller than markdown ($html_bytes bytes)"
fi

if [[ "$pdf_bytes" -ge 30720 ]] && [[ "$(head -c 5 "$PDF" 2>/dev/null)" == "%PDF-" ]]; then
  pass "pdf present and well-formed header ($((pdf_bytes / 1024)) KB)"
else
  fail "pdf missing, under 30 KB, or not a PDF ($pdf_bytes bytes)"
fi

# --- Gate 2: html is fully self-contained (no external assets) -------------
if [[ -f "$HTML" ]]; then
  ext=$(grep -nE '<(script|img|iframe|link|embed|object|source|video|audio)\b|@import|url\(' "$HTML" || true)
  if [[ -z "$ext" ]]; then
    pass "html self-contained (no script/img/link/@import/url())"
  else
    fail "html references external assets:"
    printf '%s\n' "$ext" | head -5 | sed 's/^/          /'
  fi
fi

# --- Gate 3: md -> html structural parity ---------------------------------
if [[ -f "$MD" && -f "$HTML" ]]; then
  # Strip fenced code blocks before counting markdown structure.
  stripped=$(awk '/^[[:space:]]*```/ { f = !f; next } !f' "$MD")

  md_heads=$(printf '%s\n' "$stripped" | grep -cE '^#{1,6} ' || true)
  html_heads=$(grep -oE '<h[1-6][ >]' "$HTML" | wc -l | tr -d ' ')

  md_pipes=$(printf '%s\n' "$stripped" | grep -cE '^\|' || true)
  md_seps=$(printf '%s\n' "$stripped" | grep -cE '^\|[[:space:]]*:?-{2,}' || true)
  md_rows=$((md_pipes - md_seps))
  html_rows=$(grep -oE '<tr>' "$HTML" | wc -l | tr -d ' ')

  md_fences=$(grep -cE '^[[:space:]]*```' "$MD" || true)
  md_blocks=$((md_fences / 2))
  html_pre=$(grep -oE '<pre>' "$HTML" | wc -l | tr -d ' ')

  [[ "$md_heads" -eq "$html_heads" ]] \
    && pass "heading parity ($md_heads)" \
    || fail "heading parity: md=$md_heads html=$html_heads"

  [[ "$md_rows" -eq "$html_rows" ]] \
    && pass "table row parity ($md_rows rows across $md_seps tables)" \
    || fail "table row parity: md=$md_rows html=$html_rows"

  [[ "$md_blocks" -eq "$html_pre" ]] \
    && pass "code block parity ($md_blocks)" \
    || fail "code block parity: md=$md_blocks html=$html_pre"
fi

# --- Gate 4: sources carry resolvable URLs and access dates ----------------
if [[ -f "$MD" ]]; then
  if grep -qiE '^#{2,3} .*sources' "$MD"; then
    src_rows=$(awk '/^#{2,3} .*[Ss]ources/ { s = 1; next } s && /^#{1,3} / { s = 0 } s && /^\|/' "$MD" \
      | grep -vE '^\|[[:space:]]*:?-{2,}' | grep -viE '^\|[[:space:]]*#?[[:space:]]*\|[[:space:]]*(title|source)' || true)
    total=$(printf '%s\n' "$src_rows" | grep -c '^|' || true)
    good=$(printf '%s\n' "$src_rows" | grep -cE 'https?://' || true)
    dated=$(printf '%s\n' "$src_rows" | grep -cE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' || true)

    min=5
    case "$NAME" in *durable-storage*|*auth-gdpr*) min=10 ;; esac

    # Markdown link syntax would hide the address in the PDF; the URL must be bare.
    linked=$(printf '%s\n' "$src_rows" | grep -cE '\]\([[:space:]]*https?://' || true)

    if [[ "$total" -ge "$min" && "$good" -eq "$total" && "$dated" -eq "$total" && "$linked" -eq 0 ]]; then
      pass "sources table: $total rows, all with bare URL + access date (min $min)"
    elif [[ "$linked" -gt 0 ]]; then
      fail "sources table: $linked row(s) use markdown link syntax; URLs must be bare so they resolve in the PDF"
    else
      fail "sources table: $total rows (min $min), $good with URL, $dated with access date"
    fi
  else
    fail "no Sources section found"
  fi
fi

# --- Gate 5: quick wins carry complete implementation prompts --------------
if [[ -f "$MD" ]]; then
  # Only line-start markers count: a cross-reference in prose must not inflate the total.
  qw=$(grep -c '^PROMPT QW-' "$MD" || true)
  if [[ "$qw" -ge 3 ]]; then
    missing=""
    for label in 'Context:' 'Task:' 'Constraints:' 'Acceptance criteria:' 'Verification:'; do
      n=$(grep -c "^$label" "$MD" || true)
      [[ "$n" -lt "$qw" ]] && missing="$missing $label($n/$qw)"
    done
    if [[ -z "$missing" ]]; then
      pass "quick wins: $qw prompts, all five labels present in each"
    else
      fail "quick wins: $qw prompts but label counts short:$missing"
    fi
  else
    fail "quick wins: only $qw PROMPT QW- blocks (min 3), or none marked"
  fi
fi

# --- Gate 6: no personal data from the app template is reproduced ----------
# Forbidden values are derived from index.html at runtime so that this script
# never itself contains them.
if [[ -f "$APP_HTML" ]]; then
  leaked=0
  while IFS= read -r secret; do
    [[ -z "$secret" || ${#secret} -lt 6 ]] && continue
    hits=$(grep -rlF "$secret" "$REPO_ROOT/docs/research" --include='*.md' --include='*.html' 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      leaked=1
      fail "personal data from index.html reproduced in:"
      printf '%s\n' "$hits" | sed "s|$REPO_ROOT/||" | sed 's/^/          /'
    fi
  done < <(
    {
      grep -oE '\bUA[0-9]{20,29}\b' "$APP_HTML"
      grep -oE 'ІПН/ЄДРПОУ:[[:space:]]*[0-9]{8,12}' "$APP_HTML" | grep -oE '[0-9]{8,12}'
      grep -oE 'ФОП[[:space:]]+[^[:cntrl:]]+' "$APP_HTML" | sed 's/^ФОП[[:space:]]*//'
    } 2>/dev/null | sort -u
  )
  [[ "$leaked" -eq 0 ]] && pass "no personal data from the app template reproduced"
else
  warn "index.html not found; personal-data gate skipped"
fi

# --- Gate 7: figures needing a human source/TBD check ---------------------
if [[ -f "$MD" ]]; then
  figs=$(grep -nE '(\$[0-9]|€[0-9]|[0-9][[:space:]]*(zł|PLN|UAH|EUR|USD)|/mo\b|per month|[0-9][[:space:]]*(GB|MB|KB|TB)\b|[0-9]+[[:space:]]*(req|requests)/)' "$MD" \
    | grep -vE 'TBD|\[S[0-9]+\]' || true)
  if [[ -z "$figs" ]]; then
    pass "figures: none without a source ref or TBD"
  else
    warn "figures to review by hand ($(printf '%s\n' "$figs" | wc -l | tr -d ' ') lines lack [S#] or TBD):"
    printf '%s\n' "$figs" | head -12 | cut -c1-150 | sed 's/^/          /'
  fi
fi

printf '\n'
if [[ "$fails" -eq 0 ]]; then
  printf 'RESULT: all gates passed for %s\n' "$NAME"
  printf 'Remaining manual step: read the PDF (page-number footers, no clipped tables, no stranded headings).\n\n'
  exit 0
fi
printf 'RESULT: %d gate(s) FAILED for %s\n\n' "$fails" "$NAME"
exit 1
