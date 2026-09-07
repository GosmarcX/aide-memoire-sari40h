import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MODULES = [
  'prevention',
  'evaluation',
  'urgences-medicales',
  'urgences-environnement',
  'lesions-tissus-mous',
  'lesions-musculosquelettiques',
  'lesions-traumatiques',
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

// Sert le dossier docs/ en local : les chemins relatifs et les polices se résolvent
// exactement comme sur GitHub Pages.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join('docs', normalize(path === '/' ? '/index.html' : path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

await mkdir('docs/pdf', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const slug of MODULES) {
  await page.goto(`${base}/${slug}.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.querySelectorAll('doc-page section.page').length > 0,
    null,
    { timeout: 15000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const out = `docs/pdf/aide-memoire-sari40h-${slug}.pdf`;
  await page.pdf({
    path: out,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
  });
  const pages = await page.evaluate(
    () => document.querySelectorAll('doc-page section.page').length,
  );
  console.log(`${out} — ${pages} pages`);
}

await browser.close();
server.close();
