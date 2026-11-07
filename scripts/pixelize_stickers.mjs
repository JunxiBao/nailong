import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const REF_DIR = path.resolve('assets/references');
const OUT_DIR = path.resolve('public/assets/stickers');
const TMP_DIR = path.resolve('assets/references/.tmp_bmp');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// Curated 36-color vibrant 16-bit retro pixel palette tailored for Nailong, Bombloong, Xiao Qi & Snacks
const RETRO_PALETTE = [
  // Nailong yellows & warm golds
  [255, 250, 205],
  [255, 241, 138],
  [255, 224, 71],
  [255, 207, 43],
  [247, 181, 25],
  [230, 148, 20],
  [196, 112, 18],
  // Warm oranges, browns & outlines
  [255, 158, 68],
  [235, 114, 46],
  [176, 86, 40],
  [122, 62, 36],
  [74, 39, 28],
  [43, 30, 22],
  // Blush, reds & pinks
  [255, 196, 196],
  [255, 139, 123],
  [255, 87, 87],
  [214, 48, 65],
  // Bombloong blues & cyans
  [209, 244, 255],
  [135, 220, 250],
  [79, 195, 247],
  [41, 148, 219],
  [28, 95, 168],
  [24, 54, 104],
  // Purples (Purple minions)
  [225, 196, 255],
  [179, 136, 255],
  [126, 87, 194],
  // Greens
  [185, 246, 202],
  [105, 240, 174],
  [46, 184, 114],
  [27, 117, 72],
  // Skin & neutrals
  [255, 228, 196],
  [232, 190, 154],
  [255, 255, 255],
  [226, 232, 240],
  [160, 174, 192],
  [90, 101, 119],
];

// Precompute CRC32 table for PNG encoding
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const crcInput = Buffer.concat([typeBuf, dataBuf]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function encodePngRGBA(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < width * 4; x++) {
      raw[rowStart + 1 + x] = rgba[y * width * 4 + x];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodeBmp(bmpPath) {
  const buf = fs.readFileSync(bmpPath);
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) {
    throw new Error(`Invalid BMP header: ${bmpPath}`);
  }
  const dataOffset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const heightRaw = buf.readInt32LE(22);
  const topDown = heightRaw < 0;
  const height = Math.abs(heightRaw);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);

  if (bpp !== 24 && bpp !== 32) {
    throw new Error(`Unsupported BMP bpp=${bpp} (compression=${compression})`);
  }
  const rowStride = Math.floor((bpp * width + 31) / 32) * 4;
  const bytesPerPixel = bpp / 8;
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const rowOff = dataOffset + srcY * rowStride;
    for (let x = 0; x < width; x++) {
      const pxOff = rowOff + x * bytesPerPixel;
      const b = buf[pxOff];
      const g = buf[pxOff + 1];
      const r = buf[pxOff + 2];
      // Note: sips 32-bit BMP sometimes writes alpha=0 for opaque JPEGs; check if all alphas are 0
      const a = bpp === 32 ? buf[pxOff + 3] : 255;
      const dst = (y * width + x) * 4;
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = a;
    }
  }

  // Fix sips 32-bit XRGB BMP where alpha channel is all zeros
  let anyAlpha = false;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 0) {
      anyAlpha = true;
      break;
    }
  }
  if (!anyAlpha) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }

  return { width, height, rgba };
}

function nearestPaletteColor(r, g, b) {
  let best = RETRO_PALETTE[0];
  let bestDist = Infinity;
  for (const c of RETRO_PALETTE) {
    // Perceptual RGB weights
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

const BAYER_2X2 = [
  [-6, 4],
  [6, -4],
];

function pixelizeSticker(img, size = 64, opts = {}) {
  const { width, height, rgba } = img;
  // Optional zoom crop for face close-ups
  const zoom = opts.zoom || 1;
  const cropSide = Math.floor(Math.min(width, height) / zoom);
  const startX = Math.floor((width - cropSide) / 2);
  const startY = Math.floor((height - cropSide) * (opts.biasY ?? 0.38));

  const inner = size - 6; // 58x58 inside 64x64 frame for sticker border
  const grid = new Uint8Array(size * size * 4);

  // Sample corner color to detect uniform light/white sticker background
  const samplePx = (sx, sy) => {
    const cx = Math.min(width - 1, Math.max(0, sx));
    const cy = Math.min(height - 1, Math.max(0, sy));
    const idx = (cy * width + cx) * 4;
    return [rgba[idx], rgba[idx + 1], rgba[idx + 2], rgba[idx + 3]];
  };

  const corners = [
    samplePx(startX + 2, startY + 2),
    samplePx(startX + cropSide - 3, startY + 2),
    samplePx(startX + 2, startY + cropSide - 3),
    samplePx(startX + cropSide - 3, startY + cropSide - 3),
  ];
  const bgLightCount = corners.filter((c) => c[0] > 232 && c[1] > 232 && c[2] > 232).length;
  const hasWhiteBg = bgLightCount >= 3;

  // Area-average + sharpen downsample to inner x inner
  const rawInner = new Uint8Array(size * size * 4);
  for (let py = 0; py < inner; py++) {
    for (let px = 0; px < inner; px++) {
      const srcXf = startX + ((px + 0.5) / inner) * cropSide;
      const srcYf = startY + ((py + 0.5) / inner) * cropSide;
      const [r, g, b, a] = samplePx(Math.floor(srcXf), Math.floor(srcYf));
      const tx = px + 3;
      const ty = py + 3;
      const dst = (ty * size + tx) * 4;

      // Boost saturation slightly for punchy pixel art
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const dither = BAYER_2X2[py & 1][px & 1];
      const sr = Math.min(255, Math.max(0, gray + (r - gray) * 1.22 + dither));
      const sg = Math.min(255, Math.max(0, gray + (g - gray) * 1.22 + dither));
      const sb = Math.min(255, Math.max(0, gray + (b - gray) * 1.22 + dither));

      rawInner[dst] = r;
      rawInner[dst + 1] = g;
      rawInner[dst + 2] = b;
      rawInner[dst + 3] = a;

      const [qr, qg, qb] = nearestPaletteColor(sr, sg, sb);
      grid[dst] = qr;
      grid[dst + 1] = qg;
      grid[dst + 2] = qb;
      grid[dst + 3] = a < 128 ? 0 : 255;
    }
  }

  if (hasWhiteBg) {
    // Flood-fill near-white background from outer edges so character becomes a die-cut pixel sticker!
    const visited = new Uint8Array(size * size);
    const queue = [];
    for (let i = 0; i < size; i++) {
      queue.push([i, 3], [i, size - 4], [3, i], [size - 4, i]);
    }
    while (queue.length > 0) {
      const [x, y] = queue.pop();
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const k = y * size + x;
      if (visited[k]) continue;
      visited[k] = 1;
      const idx = k * 4;
      const r = rawInner[idx];
      const g = rawInner[idx + 1];
      const b = rawInner[idx + 2];
      const a = grid[idx + 3];
      if (a === 0 || (r > 234 && g > 234 && b > 228)) {
        grid[idx + 3] = 0;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    // Add 1px dark cocoa outline + 1px cream sticker halo around opaque pixels
    const copy = new Uint8Array(grid);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = (y * size + x) * 4;
        if (copy[idx + 3] > 0) continue;
        const neighbors4 = [
          copy[((y - 1) * size + x) * 4 + 3],
          copy[((y + 1) * size + x) * 4 + 3],
          copy[(y * size + x - 1) * 4 + 3],
          copy[(y * size + x + 1) * 4 + 3],
        ];
        if (neighbors4.some((na) => na > 0)) {
          grid[idx] = 43;
          grid[idx + 1] = 30;
          grid[idx + 2] = 22;
          grid[idx + 3] = 255;
        }
      }
    }
    const copy2 = new Uint8Array(grid);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = (y * size + x) * 4;
        if (copy2[idx + 3] > 0) continue;
        const neighbors4 = [
          copy2[((y - 1) * size + x) * 4 + 3],
          copy2[((y + 1) * size + x) * 4 + 3],
          copy2[(y * size + x - 1) * 4 + 3],
          copy2[(y * size + x + 1) * 4 + 3],
        ];
        if (neighbors4.some((na) => na > 0)) {
          grid[idx] = 255;
          grid[idx + 1] = 252;
          grid[idx + 2] = 230;
          grid[idx + 3] = 255;
        }
      }
    }
  } else {
    // Full-scene image: add a cute retro pixel stamp frame around the 58x58 image!
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const onOuter = x === 1 || x === size - 2 || y === 1 || y === size - 2;
        const onMid = x === 2 || x === size - 3 || y === 2 || y === size - 3;
        const idx = (y * size + x) * 4;
        if (onOuter) {
          // Stamp perforation look
          if ((x + y) % 2 === 0) {
            grid[idx] = 43;
            grid[idx + 1] = 30;
            grid[idx + 2] = 22;
            grid[idx + 3] = 255;
          }
        } else if (onMid) {
          grid[idx] = 255;
          grid[idx + 1] = 224;
          grid[idx + 2] = 71;
          grid[idx + 3] = 255;
        }
      }
    }
  }

  return grid;
}

function drawCircle(rgba, size, cx, cy, r, color) {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * size + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = 255;
      }
    }
  }
}

function makeBombloongSticker(size = 64) {
  const g = new Uint8Array(size * size * 4);
  // Die-cut outline + blue chubby dragon boss
  drawCircle(g, size, 32, 35, 23, [43, 30, 22]);
  drawCircle(g, size, 32, 24, 19, [43, 30, 22]);
  // Tiny white wings
  drawCircle(g, size, 12, 35, 6, [43, 30, 22]);
  drawCircle(g, size, 52, 35, 6, [43, 30, 22]);
  drawCircle(g, size, 12, 35, 4.5, [226, 232, 240]);
  drawCircle(g, size, 52, 35, 4.5, [226, 232, 240]);
  // Body & head
  drawCircle(g, size, 32, 35, 21, [41, 148, 219]);
  drawCircle(g, size, 32, 24, 17, [79, 195, 247]);
  drawCircle(g, size, 29, 18, 9, [135, 220, 250]);
  // White eggshell belly
  drawCircle(g, size, 32, 41, 12, [240, 248, 255]);
  // Angry cute eyes
  drawCircle(g, size, 25, 23, 4.2, [255, 255, 255]);
  drawCircle(g, size, 39, 23, 4.2, [255, 255, 255]);
  drawCircle(g, size, 26, 23, 2.2, [43, 30, 22]);
  drawCircle(g, size, 38, 23, 2.2, [43, 30, 22]);
  // Fierce V eyebrows
  for (let i = 0; i < 7; i++) {
    const lx = 21 + i;
    const rx = 43 - i;
    const ey = 17 + Math.floor(i / 2);
    for (const bx of [lx, rx]) {
      const idx = (ey * size + bx) * 4;
      g[idx] = 24;
      g[idx + 1] = 54;
      g[idx + 2] = 104;
      g[idx + 3] = 255;
    }
  }
  // Grumpy fang grin
  drawCircle(g, size, 32, 31, 5, [74, 39, 28]);
  drawCircle(g, size, 30, 29, 1.5, [255, 255, 255]);
  drawCircle(g, size, 34, 29, 1.5, [255, 255, 255]);
  return g;
}

function makeXiaoqiSticker(size = 64) {
  const g = new Uint8Array(size * size * 4);
  // Spiky brown hair + goggles + lab coat inventor boy
  drawCircle(g, size, 32, 27, 19, [43, 30, 22]);
  drawCircle(g, size, 32, 48, 14, [43, 30, 22]);
  // Lab coat shoulders
  drawCircle(g, size, 32, 48, 12.5, [245, 248, 255]);
  drawCircle(g, size, 32, 48, 6, [79, 195, 247]);
  // Hair back & face
  drawCircle(g, size, 32, 24, 17, [102, 58, 34]);
  drawCircle(g, size, 32, 30, 13.5, [255, 228, 196]);
  // Inventor goggles on forehead
  drawCircle(g, size, 25, 18, 5, [43, 30, 22]);
  drawCircle(g, size, 39, 18, 5, [43, 30, 22]);
  drawCircle(g, size, 25, 18, 3.5, [135, 220, 250]);
  drawCircle(g, size, 39, 18, 3.5, [135, 220, 250]);
  // Bright eyes & smile
  drawCircle(g, size, 26, 29, 2.4, [43, 30, 22]);
  drawCircle(g, size, 38, 29, 2.4, [43, 30, 22]);
  drawCircle(g, size, 25, 28, 1, [255, 255, 255]);
  drawCircle(g, size, 37, 28, 1, [255, 255, 255]);
  drawCircle(g, size, 22, 33, 2, [255, 139, 123]);
  drawCircle(g, size, 42, 33, 2, [255, 139, 123]);
  drawCircle(g, size, 32, 35, 3, [214, 48, 65]);
  return g;
}

function main() {
  const sourcesPath = path.join(REF_DIR, 'sources.json');
  if (!fs.existsSync(sourcesPath)) {
    console.error('Missing assets/references/sources.json. Run fetch_refer_images.mjs first.');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  const manifest = [];
  const size = 64;

  for (const item of items) {
    if (!fs.existsSync(item.outPath)) continue;
    const bmpPath = path.join(TMP_DIR, `${item.id}.bmp`);
    execFileSync('/usr/bin/sips', ['-s', 'format', 'bmp', '-Z', '256', item.outPath, '--out', bmpPath], {
      stdio: 'ignore',
    });
    const decoded = decodeBmp(bmpPath);
    const cropOpts = item.id === 'nailong_cool' ? { zoom: 1.55, biasY: 0.14 } : {};
    const stickerRgba = pixelizeSticker(decoded, size, cropOpts);
    const pngBuf = encodePngRGBA(size, size, stickerRgba);
    const stickerFile = `${item.id}.png`;
    const outStickerPath = path.join(OUT_DIR, stickerFile);
    fs.writeFileSync(outStickerPath, pngBuf);

    let opaqueCount = 0;
    for (let i = 3; i < stickerRgba.length; i += 4) {
      if (stickerRgba[i] > 0) opaqueCount++;
    }

    manifest.push({
      id: item.id,
      desc: item.desc,
      origin: 'online-pixelized',
      url: `/assets/stickers/${stickerFile}`,
      width: size,
      height: size,
      opaqueRatio: Number((opaqueCount / (size * size)).toFixed(3)),
    });
    console.log(
      `Pixelized [${item.id}] -> public/assets/stickers/${stickerFile} (${size}x${size}, opaque=${opaqueCount})`
    );
  }

  // Add companion pixel stickers for Bombloong & Xiao Qi if not already fetched
  const extras = [
    { id: 'bombloong', desc: '暴暴龙：宇宙最强对手', fn: makeBombloongSticker },
    { id: 'xiaoqi', desc: '天才少年小七：道具发明家', fn: makeXiaoqiSticker },
  ];
  for (const ex of extras) {
    if (manifest.some((m) => m.id === ex.id)) continue;
    const rgba = ex.fn(size);
    const pngBuf = encodePngRGBA(size, size, rgba);
    const stickerFile = `${ex.id}.png`;
    fs.writeFileSync(path.join(OUT_DIR, stickerFile), pngBuf);
    let opaqueCount = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) opaqueCount++;
    manifest.push({
      id: ex.id,
      desc: ex.desc,
      origin: 'pixel-crafted',
      url: `/assets/stickers/${stickerFile}`,
      width: size,
      height: size,
      opaqueRatio: Number((opaqueCount / (size * size)).toFixed(3)),
    });
    console.log(`Crafted [${ex.id}] -> public/assets/stickers/${stickerFile}`);
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ stickers: manifest }, null, 2));
  console.log(`Generated ${manifest.length} retro pixel stickers!`);
}

main();
