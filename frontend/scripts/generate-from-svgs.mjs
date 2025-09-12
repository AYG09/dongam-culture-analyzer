import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const SRC_DIR = fileURLToPath(new URL('../svgs/', import.meta.url));
const BASELINE_JSON = fileURLToPath(new URL('../public/baseline/spirits_baseline.json', import.meta.url));

const SPIRIT_IDS = ['spirit_01','spirit_02','spirit_03','spirit_04','spirit_05','spirit_06','spirit_07'];

function classifySpirit(fileName) {
  if (fileName.includes('불우재')) return 'spirit_01';
  if (fileName.includes('숭조')) return 'spirit_02';
  if (fileName.includes('불굴')) return 'spirit_03';
  if (fileName.includes('통찰')) return 'spirit_04';
  if (fileName.includes('미풍양속')) return 'spirit_05';
  if (fileName.includes('인화')) return 'spirit_06';
  if (fileName.includes('사회적 책임')) return 'spirit_07';
  return null;
}

function extractDots(svg) {
  const $ = cheerioLoad(svg, { xmlMode: true });
  const viewBox = ($('svg').attr('viewBox') || '').split(/\s+/).map(Number);
  let width = Number($('svg').attr('width'));
  let height = Number($('svg').attr('height'));
  if ((!width || !height) && viewBox.length === 4) {
    width = viewBox[2];
    height = viewBox[3];
  }
  width = width || 1000;
  height = height || 1000;

  const parseTransform = (attr) => {
    if (!attr) return { tx: 0, ty: 0 };
    let tx = 0, ty = 0;
    const m = attr.match(/translate\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(/[,\s]+/).map(Number).filter(n=>!Number.isNaN(n));
      tx += parts[0] || 0; ty += (parts[1] || 0);
    }
    const mm = attr.match(/matrix\(([^)]+)\)/i);
    if (mm) {
      const p = mm[1].split(/[,\s]+/).map(Number);
      // a b c d e f → translate is e,f
      tx += p[4] || 0; ty += p[5] || 0;
    }
    return { tx, ty };
  };

  const getAbsOffset = (el) => {
    let tx = 0, ty = 0;
    const stack = [el, ...$(el).parents().toArray()];
    for (const node of stack) {
      const t = $(node).attr('transform');
      const { tx: dx, ty: dy } = parseTransform(t);
      tx += dx; ty += dy;
    }
    return { tx, ty };
  };

  const dots = [];
  // 1) circles with data-name/id as labels
  $('circle').each((_, el) => {
    const cx = Number($(el).attr('cx'));
    const cy = Number($(el).attr('cy'));
    const title = $(el).attr('data-name') || $(el).attr('id') || '';
    const { tx, ty } = getAbsOffset(el);
    if (!isNaN(cx) && !isNaN(cy) && title) {
      const ax = cx + tx, ay = cy + ty;
      dots.push({ lever_name: title, position: { x: +(ax/width).toFixed(4), y: +(ay/height).toFixed(4) } });
    }
  });

  // 2) rects (sticky notes). map rects then find nearest text inside
  const rects = [];
  $('rect').each((_, el) => {
    const x = Number($(el).attr('x')); const y = Number($(el).attr('y'));
    const w = Number($(el).attr('width')); const h = Number($(el).attr('height'));
    const rx = Number($(el).attr('rx') || 0);
    const { tx, ty } = getAbsOffset(el);
    if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
      // heuristic: sticky note if size reasonable
      if (w >= 40 && h >= 20) {
        rects.push({ x: x + tx, y: y + ty, w, h, rx });
      }
    }
  });

  const texts = [];
  $('text').each((_, el) => {
    const x = Number($(el).attr('x')); const y = Number($(el).attr('y'));
    const { tx, ty } = getAbsOffset(el);
    const label = ($(el).text() || '').replace(/\s+/g, ' ').trim();
    if (label && !isNaN(x) && !isNaN(y)) texts.push({ x: x + tx, y: y + ty, label });
  });

  for (const r of rects) {
    // find texts inside rect bounds
    const inside = texts.filter(t => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h);
    if (inside.length) {
      const label = inside.map(t => t.label).join(' ').trim();
      const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
      if (label) dots.push({ lever_name: label, position: { x: +(cx/width).toFixed(4), y: +(cy/height).toFixed(4) } });
    }
  }

  // de-duplicate by lever_name
  const seen = new Set();
  return dots.filter(d => {
    const key = d.lever_name + '|' + d.position.x + '|' + d.position.y;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}

async function main() {
  const files = (await fs.readdir(SRC_DIR)).filter(f => f.endsWith('.svg'));
  const baseline = JSON.parse(await fs.readFile(BASELINE_JSON, 'utf-8'));
  const map = new Map(baseline.spirits.map(s => [s.id, s]));
  for (const f of files) {
    const svg = await fs.readFile(path.join(SRC_DIR, f), 'utf-8');
    const id = classifySpirit(f);
    if (!id) continue;
    const levers = extractDots(svg);
    const spirit = map.get(id);
    if (spirit) spirit.levers = levers;
  }
  const out = { version: baseline.version || 1, spirits: Array.from(map.values()) };
  await fs.writeFile(BASELINE_JSON, JSON.stringify(out, null, 2), 'utf-8');
  console.log('Updated', path.basename(BASELINE_JSON));
}

main().catch(e => { console.error(e); process.exit(1); });


