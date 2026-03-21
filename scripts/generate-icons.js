/**
 * SafeDose Icon Generator
 * Generates all required app icon assets using sharp + SVG
 *
 * Design: Pill capsule with plus cross — medical, clean, recognizable at 48px
 * Brand: Teal (#2DD4BF / #14B8A6) on Dark Navy (#0F172A)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Brand colors
const TEAL_LIGHT = '#2DD4BF';
const TEAL_DARK = '#14B8A6';
const NAVY = '#0F172A';
const WHITE = '#FFFFFF';

const ASSETS_DIR = path.join(__dirname, '..', 'apps', 'mobile', 'assets');

// ---------------------------------------------------------------------------
// SVG builders
// ---------------------------------------------------------------------------

/**
 * Main app icon SVG
 * Pill capsule with a plus cross, teal on dark navy
 * size: canvas size in px
 */
function buildIconSvg(size) {
  // Proportional values based on size
  const cx = size / 2;
  const cy = size / 2;

  // Pill dimensions — 55% wide, 28% tall of canvas
  const pillW = size * 0.55;
  const pillH = size * 0.28;
  const pillRx = pillH / 2; // fully rounded ends
  const pillX = cx - pillW / 2;
  const pillY = cy - pillH / 2;

  // Clip path for the pill shape — used to split into two halves
  const clipId = 'pillClip';

  // Left half (teal light) — rect covering left side of pill
  // Right half (teal dark) — rect covering right side of pill

  // Plus cross inside the pill
  const crossThick = pillH * 0.18;
  const crossLen = pillH * 0.52;
  const crossX = cx - crossThick / 2;
  const crossY = cy - crossLen / 2;
  const crossHX = cx - crossLen / 2;
  const crossHY = cy - crossThick / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="${clipId}">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillRx}" ry="${pillRx}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${NAVY}"/>

  <!-- Pill left half (lighter teal) -->
  <rect
    x="${pillX}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_LIGHT}"
    clip-path="url(#${clipId})"
  />

  <!-- Pill right half (darker teal) -->
  <rect
    x="${cx}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_DARK}"
    clip-path="url(#${clipId})"
  />

  <!-- Dividing line between halves — subtle white -->
  <line
    x1="${cx}" y1="${pillY}"
    x2="${cx}" y2="${pillY + pillH}"
    stroke="${WHITE}" stroke-width="${size * 0.004}" stroke-opacity="0.4"
    clip-path="url(#${clipId})"
  />

  <!-- Plus cross (white) -->
  <!-- Vertical bar -->
  <rect
    x="${crossX}" y="${crossY}"
    width="${crossThick}" height="${crossLen}"
    rx="${crossThick * 0.3}"
    fill="${WHITE}" fill-opacity="0.95"
  />
  <!-- Horizontal bar -->
  <rect
    x="${crossHX}" y="${crossHY}"
    width="${crossLen}" height="${crossThick}"
    rx="${crossThick * 0.3}"
    fill="${WHITE}" fill-opacity="0.95"
  />
</svg>`.trim();
}

/**
 * Adaptive icon SVG — same design but with more padding (Android crops to circle/squircle)
 * The safe zone for adaptive icons is 66px out of 108dp — use ~72% of canvas for content
 */
function buildAdaptiveIconSvg(size) {
  // Same as main icon but slightly more breathing room (content at 72% scale)
  const scale = 0.72;
  const cx = size / 2;
  const cy = size / 2;

  const pillW = size * 0.55 * scale;
  const pillH = size * 0.28 * scale;
  const pillRx = pillH / 2;
  const pillX = cx - pillW / 2;
  const pillY = cy - pillH / 2;

  const clipId = 'pillClipAdaptive';

  const crossThick = pillH * 0.18;
  const crossLen = pillH * 0.52;
  const crossX = cx - crossThick / 2;
  const crossY = cy - crossLen / 2;
  const crossHX = cx - crossLen / 2;
  const crossHY = cy - crossThick / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="${clipId}">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillRx}" ry="${pillRx}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${NAVY}"/>

  <!-- Pill left half -->
  <rect
    x="${pillX}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_LIGHT}"
    clip-path="url(#${clipId})"
  />

  <!-- Pill right half -->
  <rect
    x="${cx}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_DARK}"
    clip-path="url(#${clipId})"
  />

  <!-- Dividing line -->
  <line
    x1="${cx}" y1="${pillY}"
    x2="${cx}" y2="${pillY + pillH}"
    stroke="${WHITE}" stroke-width="${size * 0.004}" stroke-opacity="0.4"
    clip-path="url(#${clipId})"
  />

  <!-- Plus cross (white) -->
  <rect x="${crossX}" y="${crossY}" width="${crossThick}" height="${crossLen}" rx="${crossThick * 0.3}" fill="${WHITE}" fill-opacity="0.95"/>
  <rect x="${crossHX}" y="${crossHY}" width="${crossLen}" height="${crossThick}" rx="${crossThick * 0.3}" fill="${WHITE}" fill-opacity="0.95"/>
</svg>`.trim();
}

/**
 * Splash screen SVG — 1284x2778
 * Large centered pill on full dark navy background, with app name below
 */
function buildSplashSvg(width, height) {
  const cx = width / 2;
  const cy = height / 2;

  // Pill sized relative to width — prominent but not overwhelming
  const pillW = width * 0.42;
  const pillH = pillW * 0.5;
  const pillRx = pillH / 2;
  const pillX = cx - pillW / 2;
  const pillY = cy - pillH / 2 - height * 0.04; // slightly above center

  const clipId = 'splashPillClip';

  // Cross
  const crossThick = pillH * 0.16;
  const crossLen = pillH * 0.50;
  const crossX = cx - crossThick / 2;
  const crossY = cy - crossLen / 2 - height * 0.04;
  const crossHX = cx - crossLen / 2;
  const crossHY = cy - crossThick / 2 - height * 0.04;

  // App name text — below the pill
  const textY = pillY + pillH + height * 0.05;
  const fontSize = width * 0.075;
  const subtitleY = textY + fontSize * 1.4;
  const subtitleFontSize = width * 0.028;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="${clipId}">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillRx}" ry="${pillRx}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${NAVY}"/>

  <!-- Pill left half -->
  <rect
    x="${pillX}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_LIGHT}"
    clip-path="url(#${clipId})"
  />

  <!-- Pill right half -->
  <rect
    x="${cx}" y="${pillY}"
    width="${pillW / 2}" height="${pillH}"
    fill="${TEAL_DARK}"
    clip-path="url(#${clipId})"
  />

  <!-- Dividing line -->
  <line
    x1="${cx}" y1="${pillY}"
    x2="${cx}" y2="${pillY + pillH}"
    stroke="${WHITE}" stroke-width="${width * 0.003}" stroke-opacity="0.35"
    clip-path="url(#${clipId})"
  />

  <!-- Plus cross (white) -->
  <rect x="${crossX}" y="${crossY}" width="${crossThick}" height="${crossLen}" rx="${crossThick * 0.3}" fill="${WHITE}" fill-opacity="0.95"/>
  <rect x="${crossHX}" y="${crossHY}" width="${crossLen}" height="${crossThick}" rx="${crossThick * 0.3}" fill="${WHITE}" fill-opacity="0.95"/>

  <!-- App name -->
  <text
    x="${cx}" y="${textY}"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${WHITE}"
    text-anchor="middle"
    letter-spacing="${fontSize * 0.04}"
  >SafeDose</text>

  <!-- Subtitle -->
  <text
    x="${cx}" y="${subtitleY}"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    font-size="${subtitleFontSize}"
    font-weight="400"
    fill="${TEAL_LIGHT}"
    text-anchor="middle"
    letter-spacing="${subtitleFontSize * 0.08}"
  >Medication Safety</text>
</svg>`.trim();
}

/**
 * Notification icon SVG — white silhouette on transparent background
 * Android requires: single color, no alpha gradients, simple silhouette
 * 96x96
 */
function buildNotificationIconSvg(size) {
  const cx = size / 2;
  const cy = size / 2;

  const pillW = size * 0.78;
  const pillH = size * 0.40;
  const pillRx = pillH / 2;
  const pillX = cx - pillW / 2;
  const pillY = cy - pillH / 2;

  const clipId = 'notifClip';

  const crossThick = pillH * 0.20;
  const crossLen = pillH * 0.55;
  const crossX = cx - crossThick / 2;
  const crossY = cy - crossLen / 2;
  const crossHX = cx - crossLen / 2;
  const crossHY = cy - crossThick / 2;

  const maskId = 'notifMask';

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <!--
      Mask: white = show, black = hide (transparent)
      Pill shape is white (visible), cross cutout is black (transparent)
    -->
    <mask id="${maskId}">
      <!-- Pill shape — fully visible -->
      <rect
        x="${pillX}" y="${pillY}"
        width="${pillW}" height="${pillH}"
        rx="${pillRx}" ry="${pillRx}"
        fill="white"
      />
      <!-- Cross cutout — black punches through to transparent -->
      <rect x="${crossX}" y="${crossY}" width="${crossThick}" height="${crossLen}" rx="${crossThick * 0.3}" fill="black"/>
      <rect x="${crossHX}" y="${crossHY}" width="${crossLen}" height="${crossThick}" rx="${crossThick * 0.3}" fill="black"/>
    </mask>
  </defs>

  <!-- White pill with cross punched out — transparent background -->
  <rect
    x="${pillX}" y="${pillY}"
    width="${pillW}" height="${pillH}"
    rx="${pillRx}" ry="${pillRx}"
    fill="${WHITE}"
    mask="url(#${maskId})"
  />
</svg>`.trim();
}

/**
 * Favicon SVG — 48x48, minimal, just the pill
 */
function buildFaviconSvg(size) {
  return buildIconSvg(size);
}

// ---------------------------------------------------------------------------
// Generation pipeline
// ---------------------------------------------------------------------------

async function generateIcon(svgString, outputPath, width, height) {
  const svgBuffer = Buffer.from(svgString, 'utf8');
  await sharp(svgBuffer)
    .resize(width, height)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
  const stats = fs.statSync(outputPath);
  const kb = (stats.size / 1024).toFixed(1);
  console.log(`  [OK] ${path.basename(outputPath)} — ${width}x${height} — ${kb} KB`);
}

async function main() {
  console.log('\nSafeDose Icon Generator');
  console.log('========================\n');

  // Ensure assets dir exists
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const icons = [
    {
      name: 'icon.png',
      svg: buildIconSvg(1024),
      width: 1024,
      height: 1024,
    },
    {
      name: 'adaptive-icon.png',
      svg: buildAdaptiveIconSvg(1024),
      width: 1024,
      height: 1024,
    },
    {
      name: 'splash.png',
      svg: buildSplashSvg(1284, 2778),
      width: 1284,
      height: 2778,
    },
    {
      name: 'notification-icon.png',
      svg: buildNotificationIconSvg(96),
      width: 96,
      height: 96,
    },
    {
      name: 'favicon.png',
      svg: buildFaviconSvg(48),
      width: 48,
      height: 48,
    },
  ];

  for (const icon of icons) {
    const outputPath = path.join(ASSETS_DIR, icon.name);
    await generateIcon(icon.svg, outputPath, icon.width, icon.height);
  }

  console.log('\nAll icons generated successfully.');
  console.log(`Output: ${ASSETS_DIR}\n`);
}

main().catch((err) => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
