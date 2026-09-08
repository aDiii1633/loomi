// Build-time only: converts the mobile app's source illustrations/icon into
// web-sized WebP + PNG icons. Run once (`npm run optimize-images`) whenever a
// source asset changes — nothing here runs in the browser.
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_ASSETS = path.resolve(ROOT, '..', 'TwoFold', 'assets');
const OUT = path.join(ROOT, 'assets', 'img');

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// [source illustration file, output basename, target width in px]
// Width = ~2x the largest on-page display size for that slot, so retina
// screens stay sharp without shipping print-resolution files.
const ILLUSTRATIONS = [
  ['welcome-holding-hands.jpg', 'hero-couple', 920],
  ['invite-pao-invites-ly.jpg', 'how-connect', 760],
  ['games-video-game.jpg', 'feature-games', 760],
  ['memories-viewing-photos.jpg', 'feature-memories', 760],
  ['vault-glowing.jpg', 'feature-vault', 760],
  ['streak-fist-bump.jpg', 'feature-streak', 760],
  ['chat-sitting-together.jpg', 'feature-chat', 760],
  ['bucket-adventure-basket.jpg', 'feature-bucket', 760],
  ['goals-progress-steps.jpg', 'feature-goals', 760],
  ['location-walking.jpg', 'feature-location', 760],
  ['celebrate-jumping.jpg', 'download-celebrate', 760],
];

const run = async () => {
  for (const [src, outName, width] of ILLUSTRATIONS) {
    const input = path.join(APP_ASSETS, 'illustrations', src);
    const outWebp = path.join(OUT, `${outName}.webp`);
    await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(outWebp);
    const stat = await sharp(outWebp).metadata();
    console.log(`${outName}.webp -> ${stat.width}x${stat.height}`);
  }

  // Favicons / touch icons from the app's own launcher icon (single source
  // of truth for brand identity across app + web, per the "app icon must
  // match website branding" requirement).
  const icon = path.join(APP_ASSETS, 'icon.png');
  const iconSizes = [
    ['favicon-32.png', 32],
    ['favicon-192.png', 192],
    ['apple-touch-icon.png', 180],
    ['og-icon.png', 512],
  ];
  for (const [name, size] of iconSizes) {
    await sharp(icon).resize(size, size).png().toFile(path.join(OUT, name));
    console.log(`${name} -> ${size}x${size}`);
  }

  // Open Graph share image: 1200x630 canvas, paper background + centered
  // icon, generated instead of inventing a fake screenshot composition.
  const OG_W = 1200;
  const OG_H = 630;
  const paper = { create: { width: OG_W, height: OG_H, channels: 4, background: '#FFF8E8' } };
  const iconBuf = await sharp(icon).resize(360, 360).toBuffer();
  await sharp(paper)
    .composite([{ input: iconBuf, left: Math.round((OG_W - 360) / 2), top: Math.round((OG_H - 360) / 2) - 20 }])
    .png()
    .toFile(path.join(OUT, 'og-cover.png'));
  console.log('og-cover.png -> 1200x630');
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
