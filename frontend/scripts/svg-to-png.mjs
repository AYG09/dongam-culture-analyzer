import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Convert all SVGs in ./svgs to PNG in public/culture_maps with normalized names
import { fileURLToPath } from 'node:url';
const SRC_DIR = fileURLToPath(new URL('../svgs/', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/culture_maps/', import.meta.url));

const NAME_MAP = [
  { match: '불우재', out: 'spirit_01.png' },
  { match: '숭조', out: 'spirit_02.png' },
  { match: '불굴', out: 'spirit_03.png' },
  { match: '통찰', out: 'spirit_04.png' },
  { match: '미풍양속', out: 'spirit_05.png' },
  { match: '인화', out: 'spirit_06.png' },
  { match: '사회적 책임', out: 'spirit_07.png' }
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = await fs.readdir(SRC_DIR);
  const svgs = files.filter(f => f.toLowerCase().endsWith('.svg'));
  for (const f of svgs) {
    const src = path.join(SRC_DIR, f);
    const found = NAME_MAP.find(n => f.includes(n.match));
    const outName = found ? found.out : f.replace(/\.[sS][vV][gG]$/, '.png');
    const out = path.join(OUT_DIR, outName);
    const buf = await fs.readFile(src);
    await sharp(buf).png({ quality: 90 }).toFile(out);
    console.log('Wrote', outName);
  }
}

main().catch(e => { console.error(e); process.exit(1); });


