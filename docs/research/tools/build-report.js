#!/usr/bin/env node
/*
 * Rebuilds a research report's HTML and PDF from its Markdown source.
 * Markdown is the source of record; the other two formats are generated.
 *
 * Usage:  node build-report.js <path-to-report.md>
 * Output: <report>.html and <report>.pdf alongside the input.
 *
 * Setup on a fresh machine:
 *   npm ci
 *   npx playwright-core install chromium   # only if no cached browser is present
 *   PW_EXEC=/path/to/chrome node build-report.js <md>   # or point at any Chromium build
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CSS = `
:root { --border: #8a8a8a; --th-bg: #e3e7ee; --code-bg: #f5f6f8; --muted: #4a5568; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 11pt; line-height: 1.55; color: #14181f; background: #fff;
  margin: 0; padding: 2rem 1.25rem;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
main { max-width: 52rem; margin: 0 auto; }
h1, h2, h3, h4, h5, h6 {
  line-height: 1.25; margin: 1.6em 0 0.6em;
  break-after: avoid-page; page-break-after: avoid;
  break-inside: avoid; page-break-inside: avoid;
}
h1 { font-size: 1.9em; margin-top: 0; border-bottom: 2px solid var(--border); padding-bottom: .3em; }
h2 { font-size: 1.45em; border-bottom: 1px solid var(--border); padding-bottom: .25em; }
h3 { font-size: 1.2em; }
h4 { font-size: 1.05em; }
p, li { orphans: 3; widows: 3; }
p { margin: 0 0 .8em; }
ul, ol { margin: 0 0 .9em; padding-left: 1.6em; }
li { margin: .2em 0; }
a { color: #14508c; overflow-wrap: anywhere; }
strong { font-weight: 650; }
table {
  border-collapse: collapse; width: 100%; margin: .9em 0 1.3em;
  font-size: .92em; break-inside: auto; page-break-inside: auto;
}
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
/* break-word, not anywhere: long words still break rather than clip, but short
   words are not split mid-syllable in narrow columns. Links and code below opt
   into anywhere, since URLs must break to stay inside the page. */
th, td {
  border: 1px solid var(--border); padding: 5px 8px; text-align: left;
  vertical-align: top; overflow-wrap: break-word;
}
th { background: var(--th-bg); font-weight: 650; }
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .88em; background: var(--code-bg); padding: .1em .3em;
  border-radius: 3px; overflow-wrap: anywhere;
}
pre {
  background: var(--code-bg); border: 1px solid #ccc; border-radius: 4px;
  padding: .7em .85em; margin: .9em 0 1.2em;
  white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;
  font-size: .84em; line-height: 1.45;
  break-inside: auto; page-break-inside: auto;
}
pre code { background: none; padding: 0; font-size: 1em; }
blockquote {
  margin: .9em 0; padding: .1em 0 .1em 1em;
  border-left: 4px solid var(--border); color: var(--muted);
}
hr { border: 0; border-top: 1px solid var(--border); margin: 1.8em 0; }
@media print {
  body { padding: 0; font-size: 10.5pt; }
  main { max-width: none; }
  a { color: #14508c; text-decoration: none; }
}
`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(markdown) {
  const titleLine = markdown.split('\n').find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : 'Research report';
  const body = marked.parse(markdown, { gfm: true, breaks: false });
  return {
    title,
    html: [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(title)}</title>`,
      `<style>${CSS}</style>`,
      '</head>',
      '<body>',
      '<main>',
      body.trim(),
      '</main>',
      '</body>',
      '</html>',
      '',
    ].join('\n'),
  };
}

async function launchChromium() {
  const attempts = [];
  const exec = process.env.PW_EXEC;

  for (const mod of ['playwright-core', 'playwright']) {
    let chromium;
    try {
      chromium = require(mod).chromium;
    } catch (err) {
      attempts.push(`${mod}: not resolvable (${err.code || err.message})`);
      continue;
    }
    try {
      const browser = await chromium.launch(exec ? { executablePath: exec } : {});
      return { browser, via: exec ? `${mod} + PW_EXEC` : mod };
    } catch (err) {
      attempts.push(`${mod}: ${err.message.split('\n')[0]}`);
    }
  }
  throw new Error(
    `No usable Chromium.\n  ${attempts.join('\n  ')}\n` +
      'Fix: npx playwright-core install chromium, or set PW_EXEC to a Chromium/Chrome binary.'
  );
}

async function writePdf(html, title, pdfPath) {
  const { browser, via } = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const footer =
      '<div style="width:100%;font-size:8.5pt;color:#555;text-align:center;' +
      'font-family:system-ui,-apple-system,Arial,sans-serif;padding:0 12mm;">' +
      escapeHtml(title) +
      ' &mdash; page <span class="pageNumber"></span> of <span class="totalPages"></span>' +
      '</div>';
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '18mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
    });
    return via;
  } finally {
    await browser.close();
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node build-report.js <path-to-report.md>');
    process.exit(2);
  }
  const mdPath = path.resolve(input);
  if (!fs.existsSync(mdPath)) {
    console.error(`Not found: ${mdPath}`);
    process.exit(2);
  }

  const { html, title } = buildHtml(fs.readFileSync(mdPath, 'utf8'));
  const base = mdPath.replace(/\.md$/i, '');
  const htmlPath = `${base}.html`;
  const pdfPath = `${base}.pdf`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  const via = await writePdf(html, title, pdfPath);

  const kb = (p) => `${(fs.statSync(p).size / 1024).toFixed(1)} KB`;
  console.log(`title : ${title}`);
  console.log(`md    : ${path.basename(mdPath)} (${kb(mdPath)})`);
  console.log(`html  : ${path.basename(htmlPath)} (${kb(htmlPath)})`);
  console.log(`pdf   : ${path.basename(pdfPath)} (${kb(pdfPath)}) via ${via}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
