import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const STICKER_OUT_DIR = path.resolve('public/assets/stickers');
const MODEL_OUT_DIR = path.resolve('public/assets/models');
const TMP_DIR = path.resolve('assets/.tmp_bmp_build');

fs.mkdirSync(STICKER_OUT_DIR, { recursive: true });
fs.mkdirSync(MODEL_OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// ============================================================================
// PNG Encoder & sips BMP Decoder
// ============================================================================
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.alloc(4);
  l.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([l, t, data, crc]);
}
function encodePngRGBA(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let i = 0; i < width * 4; i++) raw[y * stride + 1 + i] = rgba[y * width * 4 + i];
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodeImageViaSips(imgPath, maxDim = 320) {
  const bmpPath = path.join(TMP_DIR, `tmp_${Math.random().toString(36).slice(2)}.bmp`);
  execFileSync('/usr/bin/sips', ['-s', 'format', 'bmp', '-Z', String(maxDim), imgPath, '--out', bmpPath], {
    stdio: 'ignore',
  });
  const buf = fs.readFileSync(bmpPath);
  fs.rmSync(bmpPath, { force: true });
  const dataOffset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const heightRaw = buf.readInt32LE(22);
  const topDown = heightRaw < 0;
  const height = Math.abs(heightRaw);
  const bpp = buf.readUInt16LE(28);
  const rowStride = Math.floor((bpp * width + 31) / 32) * 4;
  const bytesPerPx = bpp / 8;
  const rgba = new Uint8Array(width * height * 4);
  let anyAlpha = false;
  for (let y = 0; y < height; y++) {
    const sy = topDown ? y : height - 1 - y;
    const rowOff = dataOffset + sy * rowStride;
    for (let x = 0; x < width; x++) {
      const p = rowOff + x * bytesPerPx;
      const d = (y * width + x) * 4;
      rgba[d] = buf[p + 2];
      rgba[d + 1] = buf[p + 1];
      rgba[d + 2] = buf[p];
      const a = bpp === 32 ? buf[p + 3] : 255;
      rgba[d + 3] = a;
      if (a > 0) anyAlpha = true;
    }
  }
  if (!anyAlpha) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }
  return { width, height, rgba };
}

// ============================================================================
// PART 1: High-Detail 96x96 Pixel Stickers from User's `images/` Folder!
// ============================================================================
const STICKER_PALETTE = [
  // Nailong yellows & warm shading
  [255, 252, 220], [255, 245, 165], [255, 234, 108], [255, 217, 64],
  [252, 196, 37], [242, 168, 24], [219, 135, 18], [184, 102, 16],
  // Cream belly & eggshell
  [255, 248, 232], [250, 235, 210], [235, 212, 182], [207, 178, 145],
  // Pinks, tongues, coral tee & reds
  [255, 214, 214], [248, 168, 168], [240, 128, 140], [224, 82, 106],
  [176, 38, 62], [112, 22, 38], [255, 133, 82], [228, 96, 52],
  // Emerald greens (Nailong eyes & foliage)
  [140, 230, 155], [68, 196, 92], [34, 142, 62], [18, 88, 38],
  // Bombloong blues & ice belly
  [230, 252, 255], [192, 242, 252], [132, 222, 250], [85, 197, 238],
  [52, 154, 204], [32, 106, 152], [22, 62, 102],
  // Minion (小紫兵) lilac-pink skin, plum shadows, violet cloud puffs, teal headband & yellow sclera
  [252, 212, 242], [236, 176, 222], [204, 138, 192], [172, 114, 166], [142, 92, 138], [112, 72, 114],
  [208, 156, 255], [168, 98, 250], [126, 64, 212], [88, 42, 162],
  [92, 192, 218], [64, 174, 204], [42, 132, 172], [28, 92, 132], [228, 226, 94], [196, 194, 68],
  // Skin, browns, claws, charcoal hair & neutrals
  [255, 224, 198], [235, 190, 160], [148, 104, 72], [96, 68, 44],
  [64, 44, 30], [38, 34, 36], [72, 74, 78], [130, 138, 148],
  [196, 204, 214], [238, 242, 246], [255, 255, 255], [22, 16, 14],
];

function nearestColor(r, g, b, pal = STICKER_PALETTE) {
  let best = pal[0];
  let bestDist = Infinity;
  for (const c of pal) {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

const BAYER2 = [
  [-4, 3],
  [4, -3],
];

function convertRefToSticker96(imgPath, opts = {}) {
  const size = 96;
  const src = decodeImageViaSips(imgPath, 384);
  const { width, height, rgba } = src;

  const grid = new Uint8Array(size * size * 4);
  const rawGrid = new Uint8Array(size * size * 4);
  const inner = size - 8; // 88x88 inside 96x96

  // Support wide aspect preservation (like 123.jpeg so BOTH raised paws & drool fit!)
  const mode = opts.mode || 'square'; // 'square' | 'contain_wide'
  const sampleBilinear = (fx, fy) => {
    const cx = Math.min(width - 1, Math.max(0, Math.round(fx)));
    const cy = Math.min(height - 1, Math.max(0, Math.round(fy)));
    const i = (cy * width + cx) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
  };

  for (let py = 0; py < inner; py++) {
    for (let px = 0; px < inner; px++) {
      let sx, sy;
      if (mode === 'contain_wide') {
        // Crop slightly horizontally (keep 86% of width so both paws of 123.jpeg stay completely visible!)
        const cropW = width * 0.92;
        const offX = (width - cropW) * 0.5;
        // Map into inner x inner with subtle rounded card padding top/bottom
        const aspect = cropW / height; // ~1.63
        const drawH = Math.round(inner / aspect);
        const topPad = Math.floor((inner - drawH) * 0.5);
        if (py < topPad || py >= topPad + drawH) continue;
        sx = offX + ((px + 0.5) / inner) * cropW;
        sy = ((py - topPad + 0.5) / drawH) * height;
      } else {
        const cropSide = Math.min(width, height) / (opts.zoom || 1);
        const startX = (width - cropSide) * 0.5;
        const startY = (height - cropSide) * (opts.biasY ?? 0.45);
        sx = startX + ((px + 0.5) / inner) * cropSide;
        sy = startY + ((py + 0.5) / inner) * cropSide;
      }

      const [r, g, b, a] = sampleBilinear(sx, sy);
      const tx = px + 4;
      const ty = py + 4;
      const dst = (ty * size + tx) * 4;
      rawGrid[dst] = r;
      rawGrid[dst + 1] = g;
      rawGrid[dst + 2] = b;
      rawGrid[dst + 3] = a;

      const dither = BAYER2[py & 1][px & 1];
      const [qr, qg, qb] = nearestColor(
        Math.min(255, Math.max(0, r + dither)),
        Math.min(255, Math.max(0, g + dither)),
        Math.min(255, Math.max(0, b + dither))
      );
      grid[dst] = qr;
      grid[dst + 1] = qg;
      grid[dst + 2] = qb;
      grid[dst + 3] = 255;
    }
  }

  if (opts.removeWhiteBg || opts.removeCornerBg) {
    // Flood-fill uniform or vertical-gradient backdrop from border to make crisp die-cut character sticker!
    const visited = new Uint8Array(size * size);
    const queue = [];
    for (let i = 0; i < size; i++) {
      queue.push([i, 4], [i, size - 5], [4, i], [size - 5, i]);
    }
    while (queue.length > 0) {
      const [x, y] = queue.pop();
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const k = y * size + x;
      if (visited[k]) continue;
      visited[k] = 1;
      const idx = k * 4;
      const r = rawGrid[idx];
      const g = rawGrid[idx + 1];
      const b = rawGrid[idx + 2];
      const isWhite = opts.removeWhiteBg && r > 236 && g > 236 && b > 232;
      // Compare against this row's left/right border sample so vertical gradient backdrops vanish 100%!
      const rowY = Math.min(size - 5, Math.max(4, y));
      const bL = (rowY * size + 4) * 4;
      const bR = (rowY * size + (size - 5)) * 4;
      const distL = Math.hypot(r - rawGrid[bL], g - rawGrid[bL + 1], b - rawGrid[bL + 2]);
      const distR = Math.hypot(r - rawGrid[bR], g - rawGrid[bR + 1], b - rawGrid[bR + 2]);
      const tol = opts.bgTolerance ?? 36;
      const isCornerBg = opts.removeCornerBg && Math.min(distL, distR) < tol;
      if (grid[idx + 3] === 0 || isWhite || isCornerBg) {
        grid[idx + 3] = 0;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    // 1px dark cocoa outline + 2px cream die-cut rim
    addOutlinePass(grid, size, size, [38, 24, 18]);
    addOutlinePass(grid, size, size, [255, 252, 235]);
  } else {
    // Frame photo sticker (like 123.jpeg!) in a cute pixel border!
    let minY = size, maxY = 0, minX = size, maxX = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[(y * size + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    // Draw golden + dark cocoa pixel frame tightly around the image!
    for (let y = minY - 3; y <= maxY + 3; y++) {
      for (let x = minX - 3; x <= maxX + 3; x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const idx = (y * size + x) * 4;
        if (grid[idx + 3] > 0) continue;
        const onOuter = x === minX - 3 || x === maxX + 3 || y === minY - 3 || y === maxY + 3;
        const onInner = x === minX - 1 || x === maxX + 1 || y === minY - 1 || y === maxY + 1;
        if (onOuter || onInner) {
          grid[idx] = 43;
          grid[idx + 1] = 30;
          grid[idx + 2] = 22;
          grid[idx + 3] = 255;
        } else {
          grid[idx] = 255;
          grid[idx + 1] = 216;
          grid[idx + 2] = 56;
          grid[idx + 3] = 255;
        }
      }
    }
  }

  return { size, rgba: grid };
}

function addOutlinePass(rgba, w, h, rgb) {
  const copy = new Uint8Array(rgba);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      if (copy[idx + 3] > 0) continue;
      if (
        copy[((y - 1) * w + x) * 4 + 3] > 0 ||
        copy[((y + 1) * w + x) * 4 + 3] > 0 ||
        copy[(y * w + x - 1) * 4 + 3] > 0 ||
        copy[(y * w + x + 1) * 4 + 3] > 0
      ) {
        rgba[idx] = rgb[0];
        rgba[idx + 1] = rgb[1];
        rgba[idx + 2] = rgb[2];
        rgba[idx + 3] = 255;
      }
    }
  }
}

// ============================================================================
// PART 2: 3D SDF Volumetric Pixel Art Modeling Engine!
// Smoothly blends 3D metaballs/capsules, computes true 3D surface normals,
// cel-shades with pixel dithering, and draws crisp 1px pixel-art outlines!
// ============================================================================
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function sdSphere(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const kx = (px - cx) / rx;
  const ky = (py - cy) / ry;
  const kz = (pz - cz) / rz;
  const k0 = Math.sqrt(kx * kx + ky * ky + kz * kz);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const k1 = Math.sqrt((kx / rx) ** 2 + (ky / ry) ** 2 + (kz / rz) ** 2);
  return (k0 * (k0 - 1.0)) / k1;
}

function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/**
 * Raycasts an orthographic pixel grid [-half..+half] against `sceneSdf(x, y, z)`
 * and shades each hit pixel with cel-shaded 3D lighting + Bayer pixel dithering!
 */
function renderSdfFrame(w, h, worldHalf, sceneFn, colorFn, outlineRgb = [43, 30, 22]) {
  const rgba = new Uint8Array(w * h * 4);
  // Light from upper-left-front
  const lx = -0.38, ly = -0.52, lz = 0.76;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const wx = ((px + 0.5) / w * 2 - 1) * worldHalf;
      const wy = ((py + 0.5) / h * 2 - 1) * worldHalf;

      // March from z = +36 toward z = -28
      let z = 36;
      let hit = false;
      for (let step = 0; step < 56; step++) {
        const d = sceneFn(wx, wy, z);
        if (d < 0.08) {
          hit = true;
          break;
        }
        z -= Math.max(0.35, d * 0.85);
        if (z < -26) break;
      }
      if (!hit) continue;

      // Central-difference 3D normal
      const eps = 0.25;
      const nx = sceneFn(wx + eps, wy, z) - sceneFn(wx - eps, wy, z);
      const ny = sceneFn(wx, wy + eps, z) - sceneFn(wx, wy - eps, z);
      const nz = sceneFn(wx, wy, z + eps) - sceneFn(wx, wy, z - eps);
      // Note: camera is at +z, so outward toward camera has negative gradient if z decreases, wait:
      // SDF is negative inside, positive outside -> +z outside means ∂sdf/∂z > 0 on front surface!
      const len = Math.hypot(nx, ny, nz) || 1;
      const unx = nx / len;
      const uny = ny / len;
      const unz = nz / len;

      const ndotl = Math.max(0, unx * lx + uny * ly + unz * lz);
      const rim = Math.pow(1 - Math.max(0, unz), 2.4) * 0.18;
      const dither = BAYER2[py & 1][px & 1] * 0.008;
      const shade = Math.min(1, Math.max(0, ndotl * 0.82 + 0.22 + rim + dither));

      const rgb = colorFn(wx, wy, z, unx, uny, unz, shade, px, py);
      if (!rgb) continue;
      const idx = (py * w + px) * 4;
      rgba[idx] = rgb[0];
      rgba[idx + 1] = rgb[1];
      rgba[idx + 2] = rgb[2];
      rgba[idx + 3] = 255;
    }
  }

  addOutlinePass(rgba, w, h, outlineRgb);
  return rgba;
}

function quantizeRamp(shade, ramp) {
  // ramp has 5 colors from darkest [0] to brightest [4]
  if (shade > 0.86) return ramp[4];
  if (shade > 0.66) return ramp[3];
  if (shade > 0.44) return ramp[2];
  if (shade > 0.26) return ramp[1];
  return ramp[0];
}

const NAILONG_YELLOW_RAMP = [
  [208, 118, 16], // deep warm amber AO
  [236, 152, 22], // warm honey shadow
  [252, 198, 38], // rich golden yellow midtone
  [255, 222, 68], // bright Nailong yellow
  [255, 244, 138], // lemon top highlight
];

const NAILONG_CREAM_RAMP = [
  [235, 188, 128],
  [246, 212, 162],
  [255, 234, 194],
  [255, 245, 218],
  [255, 252, 238],
];

const CLAW_BROWN_RAMP = [
  [54, 36, 22],
  [78, 52, 32],
  [104, 72, 44],
  [128, 90, 56],
  [152, 110, 72],
];

const PAW_PINK_RAMP = [
  [214, 120, 126],
  [235, 145, 150],
  [248, 168, 172],
  [255, 190, 194],
  [255, 212, 216],
];

/**
 * Renders 1 high-precision 96x96 frame of NAILONG!
 * Poses: 0=idle_wave, 1=mouth_open (123.jpeg!), 2=chew_happy, 3=pat_belly, 4=belly_slam, 5=worried (images copy.jpeg!)
 */
function buildNailongFrame(pose, phase = 0) {
  const w = 96, h = 96, half = 36;
  const bob = phase === 1 ? -1.1 : 0;
  const headTilt = pose === 3 ? 0.08 : pose === 0 ? -0.04 : 0; // cute head tilt like images.jpeg!
  const bellyBoost = pose === 3 || pose === 4 ? 1.8 : phase === 1 ? 0.6 : 0;

  const evalParts = (x, y, z) => {
    // Apply subtle head tilt around neck pivot (0, -4)
    const dyNeck = y - (-4 + bob);
    const hx = x * Math.cos(headTilt) - dyNeck * Math.sin(headTilt);
    const hy = -4 + bob + x * Math.sin(headTilt) + dyNeck * Math.cos(headTilt);

    // 1. Pear/Baozi-shaped 3D BIG Head (wider chubby cheeks + adorable big-head proportion!)
    const dome = sdEllipsoid(hx, hy, z, 0, -18.0 + bob, 1.8, 15.8, 13.0, 14.2);
    const cheekL = sdEllipsoid(hx, hy, z, -7.2, -10.2 + bob, 4.2, 11.8, 9.4, 11.2);
    const cheekR = sdEllipsoid(hx, hy, z, 7.2, -10.2 + bob, 4.2, 11.8, 9.4, 11.2);
    const jaw = sdEllipsoid(hx, hy, z, 0, -9.4 + bob, 5.6, 12.6, 8.6, 11.0);
    let dHead = smin(dome, smin(cheekL, cheekR, 5.8), 6.2);
    dHead = smin(dHead, jaw, 4.8);

    // 2. Plump Pear Torso & Protruding Big Duang-Duang Belly!
    const chest = sdEllipsoid(x, y, z, 0, 4.5 + bob, 1.5, 13.2, 11.5, 12.0);
    const belly = sdEllipsoid(
      x,
      y,
      z,
      0,
      14.8 + bob,
      5.2 + bellyBoost * 0.5,
      16.4 + bellyBoost,
      14.5 + bellyBoost * 0.4,
      15.8 + bellyBoost
    );
    const dTorso = smin(chest, belly, 6.5);

    // 3. Curved Dinosaur Tail at bottom-left (just like Unknown.jpeg & Unknown 2.jpeg!)
    const dTail = smin(
      sdCapsule(x, y, z, -11, 21 + bob, -4, -22, 17 + bob, -6, 4.8),
      sdSphere(x, y, z, -24.5, 15.2 + bob, -6, 2.6),
      2.5
    );

    // 4. Arms per pose!
    let dArmL, dArmR;
    let pawPads = [];
    let claws = [];

    if (pose === 1) {
      // Pose 1 (123.jpeg!): Both paws raised excitedly showing pink pads + 3 brown claws!
      dArmL = sdCapsule(x, y, z, -12.5, 5 + bob, 2, -21.5, -5.5 + bob, 8, 4.8);
      dArmR = sdCapsule(x, y, z, 12.5, 5 + bob, 2, 21.5, -5.5 + bob, 8, 4.8);
      pawPads.push([-21.5, -5.0 + bob, 12.2, 3.1, 2.6], [21.5, -5.0 + bob, 12.2, 3.1, 2.6]);
      for (const [ side, cx ] of [[-1, -21.5], [1, 21.5]]) {
        claws.push(
          [cx - 3.0 * side, -9.2 + bob, 10.5, 1.35],
          [cx, -10.2 + bob, 10.8, 1.4],
          [cx + 3.0 * side, -9.0 + bob, 10.5, 1.35]
        );
      }
    } else if (pose === 2) {
      // Pose 2 (Unknown 2.jpeg!): Cute hands held up near cheeks chewing happily!
      const wave = phase === 1 ? -1.2 : 0.8;
      dArmL = sdCapsule(x, y, z, -12, 6 + bob, 3, -15.5, -2.5 + bob + wave, 11, 4.5);
      dArmR = sdCapsule(x, y, z, 12, 6 + bob, 3, 15.5, -2.5 + bob - wave, 11, 4.5);
      claws.push(
        [-14.5, -6.8 + bob + wave, 12.5, 1.2],
        [-16.8, -6.2 + bob + wave, 12.2, 1.2],
        [14.5, -6.8 + bob - wave, 12.5, 1.2],
        [16.8, -6.2 + bob - wave, 12.2, 1.2]
      );
    } else if (pose === 3) {
      // Pose 3: Patting that bouncy big belly clearly from both sides!
      const pat = phase === 1 ? -2.2 : 2.0;
      dArmL = sdCapsule(x, y, z, -14, 5 + bob, 3, -15.2, 14.5 + bob + pat, 16.5, 4.6);
      dArmR = sdCapsule(x, y, z, 14, 5 + bob, 3, 15.2, 14.5 + bob - pat, 16.5, 4.6);
      claws.push(
        [-11.8, 13.8 + bob + pat, 19.8, 1.25],
        [-12.0, 16.2 + bob + pat, 19.8, 1.25],
        [11.8, 13.8 + bob - pat, 19.8, 1.25],
        [12.0, 16.2 + bob - pat, 19.8, 1.25]
      );
    } else if (pose === 4) {
      // Pose 4: Belly Slam airborne jump! Arms wide back, belly thrust out!
      dArmL = sdCapsule(x, y, z, -13, 3 + bob, 2, -24, -4 + bob, 3, 4.5);
      dArmR = sdCapsule(x, y, z, 13, 3 + bob, 2, 24, -4 + bob, 3, 4.5);
    } else if (pose === 5) {
      // Pose 5 (images copy.jpeg!): Unamused / hungry rubbing belly, right arm bent on hip!
      dArmL = sdCapsule(x, y, z, -13, 5 + bob, 2, -16.5, 16 + bob, 9, 4.5);
      dArmR = sdCapsule(x, y, z, 13, 5 + bob, 2, 17.5, 17 + bob, 7, 4.5);
      claws.push([17.5, 20.8 + bob, 9.2, 1.25], [15.5, 21.2 + bob, 9.2, 1.25]);
    } else {
      // Pose 0 (Unknown.jpeg & images.jpeg): Left paw waving with pink pad + 3 claws, right arm relaxed!
      const wv = phase === 1 ? -1.5 : 0.5;
      dArmL = sdCapsule(x, y, z, -12.5, 5.5 + bob, 2, -19.5, 2.5 + bob + wv, 10, 4.6);
      dArmR = sdCapsule(x, y, z, 12.5, 5.5 + bob, 2, 18.5, 16.5 + bob, 6, 4.4);
      pawPads.push([-19.2, 3.2 + bob + wv, 14.0, 2.6, 2.2]);
      claws.push(
        [-22.2, 0.2 + bob + wv, 12.2, 1.25],
        [-20.2, -1.2 + bob + wv, 12.5, 1.25],
        [-17.8, -0.8 + bob + wv, 12.5, 1.2],
        [18.2, 20.5 + bob, 8.2, 1.2],
        [20.2, 19.8 + bob, 7.8, 1.2]
      );
    }

    // 5. Legs & Feet!
    let dLegL, dLegR;
    if (pose === 4) {
      // Jumping splayed feet showing pink sole pads!
      dLegL = sdEllipsoid(x, y, z, -13, 26 + bob, 9, 6.2, 5.2, 6.5);
      dLegR = sdEllipsoid(x, y, z, 13, 26 + bob, 9, 6.2, 5.2, 6.5);
      pawPads.push([-13, 26.8 + bob, 14.8, 3.4, 2.8], [13, 26.8 + bob, 14.8, 3.4, 2.8]);
      for (const lx of [-13, 13]) {
        claws.push([lx - 3.2, 21.2 + bob, 12.5, 1.35], [lx, 20.6 + bob, 12.8, 1.35], [lx + 3.2, 21.2 + bob, 12.5, 1.35]);
      }
    } else {
      // Standing planted chubby legs + 3 brown toe claws (just like images.jpeg!)
      dLegL = smin(
        sdCapsule(x, y, z, -8.5, 22 + bob, 2, -9.2, 29.5, 3, 5.6),
        sdEllipsoid(x, y, z, -9.5, 31.2, 5.2, 6.0, 3.2, 6.5),
        2.5
      );
      dLegR = smin(
        sdCapsule(x, y, z, 8.5, 22 + bob, 2, 9.2, 29.5, 3, 5.6),
        sdEllipsoid(x, y, z, 9.5, 31.2, 5.2, 6.0, 3.2, 6.5),
        2.5
      );
      for (const lx of [-9.5, 9.5]) {
        claws.push([lx - 3.4, 32.2, 11.2, 1.35], [lx, 32.4, 11.6, 1.4], [lx + 3.4, 32.2, 11.2, 1.35]);
      }
    }

    let dBody = smin(dTorso, dTail, 3.0);
    dBody = smin(dBody, smin(dArmL, dArmR, 2.0), 3.2);
    dBody = smin(dBody, smin(dLegL, dLegR, 2.0), 3.2);
    // Crisp slight crease between head & chest so Nailong's cute chin line shows!
    let dSkin = smin(dHead, dBody, 1.6);

    let dClawMin = 999;
    for (const [cx, cy, cz, cr] of claws) {
      dClawMin = Math.min(dClawMin, sdSphere(x, y, z, cx, cy, cz, cr));
    }

    let dPadMin = 999;
    for (const [px0, py0, pz0, prx, pry] of pawPads) {
      dPadMin = Math.min(dPadMin, sdEllipsoid(x, y, z, px0, py0, pz0, prx, pry, 1.8));
    }

    const dTotal = Math.min(dSkin, dClawMin, dPadMin);
    return { dTotal, dHead, dBody, dClawMin, dPadMin, hx, hy };
  };

  const rgba = renderSdfFrame(
    w,
    h,
    half,
    (x, y, z) => evalParts(x, y, z).dTotal,
    (wx, wy, wz, _nx, _ny, _nz, shade) => {
      const p = evalParts(wx, wy, wz);
      if (p.dClawMin <= p.dSkin + 0.15 && p.dClawMin < 0.35) {
        return quantizeRamp(shade, CLAW_BROWN_RAMP);
      }
      if (p.dPadMin < 0.45) {
        return quantizeRamp(Math.max(0.55, shade), PAW_PINK_RAMP);
      }

      const hx = p.hx;
      const hy = p.hy - bob;

      // Facial Features on Head!
      if (p.dHead < p.dBody + 0.8 && wz > 4) {
        // 1. Eyes (left & right around hx = ±6.6, hy = -15.5)
        for (const side of [-1, 1]) {
          const ex = (hx - side * 6.5) / 4.1;
          const ey = (hy - -15.6) / 4.3;
          const r2 = ex * ex + ey * ey;

          if (pose === 2 || (pose === 3 && phase === 1)) {
            // Happy curved ^ ^ eye arc!
            const arcY = -15.2 + (hx - side * 6.5) ** 2 * 0.14;
            if (Math.abs(hx - side * 6.5) < 3.8 && Math.abs(hy - arcY) < 1.05) {
              return [43, 28, 20];
            }
          } else if (r2 <= 1.0) {
            // Pose 5 (images copy.jpeg!): flat half-closed unamused upper eyelid!
            if (pose === 5 && ey < -0.18) {
              return quantizeRamp(shade * 0.92, NAILONG_YELLOW_RAMP);
            }
            if (pose === 5 && Math.abs(ey - -0.15) < 0.16) {
              return [56, 36, 22]; // upper lid line
            }

            // Pupil & Emerald-Green Iris & White Sclera (exact match to 123.jpeg & Unknown.jpeg!)
            const ix = ex + side * 0.12; // slightly looking inward/forward
            const iy = ey - 0.04;
            const ir = Math.hypot(ix, iy);
            // Dual white catchlights!
            if (Math.hypot(ix + 0.24, iy + 0.28) < 0.22) return [255, 255, 255];
            if (Math.hypot(ix - 0.22, iy - 0.26) < 0.12) return [220, 255, 228];
            if (ir < 0.48) return [20, 16, 15]; // glossy black pupil
            if (ir < 0.78) {
              // Vivid emerald-green iris gradient!
              return iy > 0.15 ? [72, 212, 102] : [32, 146, 62];
            }
            if (r2 > 0.86) return [120, 78, 32]; // subtle eye socket rim
            return [255, 255, 255]; // crisp white sclera
          }
        }

        // 2. Rosy Cheek Blush
        if (
          (Math.hypot((hx + 10.8) / 2.8, (hy - -10.8) / 1.9) < 1 ||
            Math.hypot((hx - 10.8) / 2.8, (hy - -10.8) / 1.9) < 1) &&
          pose !== 5
        ) {
          return shade > 0.5 ? [255, 162, 142] : [242, 136, 118];
        }

        // 3. Mouth per Pose!
        if (pose === 1) {
          // Pose 1 (123.jpeg!): Big rounded bean-shaped drooling mouth + teeth + heart-cleft tongue!
          const mx = hx / 9.2;
          const my = (hy - -6.2) / 5.4;
          if (mx * mx + my * my <= 1.0 && hy > -10.8) {
            // Upper & lower white tooth bars
            if (hy < -9.3 && Math.abs(hx) < 7.8) return [255, 253, 248];
            if (hy > -1.9 && Math.abs(hx) < 6.8) return [248, 245, 240];
            // Plump pink heart-cleft tongue!
            const ty = hy - -4.2;
            const cleft = Math.abs(hx) < 0.6 && ty < 0.8;
            if (Math.hypot(hx / 5.8, ty / 3.0) <= 1.0) {
              if (cleft) return [186, 52, 78];
              return ty < -0.5 ? [232, 86, 112] : [252, 128, 150];
            }
            return [102, 20, 36]; // deep burgundy mouth interior
          }
        } else if (pose === 0 || pose === 4) {
          // Happy open D-grin (Unknown.jpeg!)
          const mx = hx / 6.2;
          const my = (hy - -8.0) / 3.2;
          if (hy >= -9.8 && mx * mx + my * my <= 1.0) {
            if (hy < -8.6) return [255, 255, 255]; // upper teeth
            if (hy > -6.4 && Math.abs(hx) < 4.2) return [245, 118, 140]; // cute tongue
            return [96, 20, 36];
          }
        } else if (pose === 2 || pose === 3) {
          // Upward happy smile curve ◡ (images.jpeg & Unknown 2.jpeg!)
          const smileY = -8.2 - (hx * hx) * 0.085;
          if (Math.abs(hx) < 4.2 && Math.abs(hy - smileY) < 0.8) {
            return [128, 62, 18];
          }
        } else if (pose === 5) {
          // Tiny unamused downturned pout ︵ (images copy.jpeg!)
          const poutY = -9.2 + (hx * hx) * 0.085;
          if (Math.abs(hx) < 3.2 && Math.abs(hy - poutY) < 0.75) {
            return [128, 62, 18];
          }
        }
      }

      // Drool stream on chin for Pose 1 (123.jpeg!)
      if (pose === 1 && wz > 6 && hx > 0.6 && hx < 3.4 && hy >= -1.2 && hy <= 3.6) {
        return hx < 2.0 ? [255, 255, 255] : [215, 242, 252];
      }

      // Signature Warm Cream Oval Belly Patch on front of torso!
      const bx = wx / (11.6 + bellyBoost * 0.6);
      const by = (wy - (15.2 + bob)) / (11.8 + bellyBoost * 0.4);
      const bDist = bx * bx + by * by;
      if (wz > 4 && p.dBody < p.dHead && bDist <= 1.0) {
        if (bDist > 0.84) {
          // Soft warm peach-gold transition edge!
          return quantizeRamp(shade, [
            [228, 158, 68],
            [244, 188, 104],
            [252, 214, 142],
            [255, 232, 174],
            [255, 244, 202],
          ]);
        }
        return quantizeRamp(shade, NAILONG_CREAM_RAMP);
      }

      // Subtle chin ambient occlusion shadow right below head!
      let finalShade = shade;
      if (p.dBody < p.dHead && p.dHead < 2.6 && wy < 2) {
        finalShade *= 0.72;
      }

      return quantizeRamp(finalShade, NAILONG_YELLOW_RAMP);
    }
  );

  return rgba;
}

const BOMBLOONG_BLUE_RAMP = [
  [28, 96, 142],
  [48, 138, 192],
  [78, 184, 232],
  [108, 208, 248],
  [162, 232, 255],
];

const EGGSHELL_RAMP = [
  [196, 166, 138],
  [222, 194, 166],
  [242, 220, 196],
  [252, 238, 220],
  [255, 248, 238],
];

const ICE_BELLY_RAMP = [
  [168, 218, 228],
  [198, 236, 244],
  [222, 248, 252],
  [238, 253, 255],
  [250, 255, 255],
];

/**
 * Renders 1 high-precision 88x88 frame of BOMBLOONG (暴暴龙)!
 * Faithful to `images/暴暴龙/images copy 3.jpeg` & `images copy.jpeg`:
 * - Jagged cracked cream eggshell cap on top of head!
 * - Two tiny dark-blue dot eyebrows + sharp cyan-iris almond eyes!
 * - Scalloped blue dragon wings on back!
 * - Ice-mint belly patch & 3 white claws on hands/feet!
 */
function buildBombloongFrame(pose = 0, phase = 0) {
  // pose: 0=smug idle, 1=angry roar (images copy.jpeg), 2=dizzy hurt
  const w = 88, h = 88, half = 34;
  const hover = phase === 1 ? -1.4 : 0;
  const wingFlap = phase === 1 ? -2.2 : 1.2;

  // Crisp 5-point jagged zig-zag eggshell crack line across forehead (images copy 3.jpeg!)
  const shellEdgeY = (x) => {
    const zig = Math.abs((((x + 16.5) / 6.2) % 2) - 1) * 4.4;
    return -15.6 + hover + (x * x) * 0.012 + zig;
  };

  const evalParts = (x, y, z) => {
    // Egg-shaped chubby head + torso blended seamlessly (like images copy 3.jpeg!)
    const headTop = sdEllipsoid(x, y, z, 0, -13.8 + hover, 2, 15.2, 14.2, 14.0);
    const cheeks = sdEllipsoid(x, y, z, 0, -6.2 + hover, 4.2, 16.8, 9.8, 14.2);
    const body = sdEllipsoid(x, y, z, 0, 9.8 + hover, 3.5, 17.2, 15.5, 15.5);
    const dCore = smin(smin(headTop, cheeks, 5.2), body, 5.8);

    // Chubby arms & stubby legs
    const armRaise = pose === 1 ? -6.5 : 0;
    const dArmL = sdCapsule(x, y, z, -15.0, 4.5 + hover, 2, -21.8, 14.2 + hover + armRaise, 6, 5.0);
    const dArmR = sdCapsule(x, y, z, 15.0, 4.5 + hover, 2, 21.8, 14.2 + hover - armRaise * 0.5, 6, 5.0);
    const dLegL = sdCapsule(x, y, z, -8.5, 20 + hover, 2, -9.0, 27.5 + hover, 3, 5.5);
    const dLegR = sdCapsule(x, y, z, 8.5, 20 + hover, 2, 9.0, 27.5 + hover, 3, 5.5);

    // Curved Triangular Dragon/Bat Wings behind shoulders (matching images copy 3.jpeg & copy 2.jpeg!)
    let dWing = 999;
    for (const side of [-1, 1]) {
      const wxRel = Math.abs(x) - 13.0;
      if (wxRel > -3) {
        const archY = -1.5 + hover + wingFlap * (wxRel / 13) + wxRel * 0.25;
        const wThick = Math.max(1.2, 5.5 - wxRel * 0.28);
        // Scalloped bat-wing bottom cutout!
        const scallop = Math.abs(((wxRel / 5.2) % 2) - 1) * 2.2;
        if (Math.abs(x) < 28.5 && y > archY - 3.5 && y < archY + wThick - scallop * 0.6) {
          dWing = Math.min(dWing, sdEllipsoid(x, y, z, side * 19.5, 2.5 + hover + wingFlap * 0.5, -5, 9.5, 6.2, 2.2));
        }
      }
    }

    // 3 creamy-white toe claws on each foot!
    let dClaws = 999;
    for (const lx of [-9.0, 9.0]) {
      for (const dx of [-3.0, 0, 3.0]) {
        dClaws = Math.min(dClaws, sdSphere(x, y, z, lx + dx, 29.8 + hover, 8.2, 1.3));
      }
    }

    const dBlue = smin(dCore, smin(smin(dArmL, dArmR, 2), smin(dLegL, dLegR, 2), 2), 3.0);
    const dTotal = Math.min(dBlue, dWing, dClaws);
    return { dTotal, dBlue, dWing, dClaws };
  };

  return renderSdfFrame(
    w,
    h,
    half,
    (x, y, z) => evalParts(x, y, z).dTotal,
    (wx, wy, wz, _nx, _ny, _nz, shade) => {
      const p = evalParts(wx, wy, wz);
      if (p.dClaws < 0.35) return quantizeRamp(Math.max(0.5, shade), EGGSHELL_RAMP);
      if (p.dWing < p.dBlue - 0.15) {
        return quantizeRamp(shade * 0.8, BOMBLOONG_BLUE_RAMP);
      }
      // Jagged Cracked Eggshell Cap!
      if (wy < shellEdgeY(wx) && p.dBlue < 0.5) {
        return quantizeRamp(shade, EGGSHELL_RAMP);
      }

      const hy = wy - hover;

      // Crisp drop-shadow directly beneath the jagged eggshell rim!
      let finalShade = shade;
      const distBelowShell = wy - shellEdgeY(wx);
      if (distBelowShell >= 0 && distBelowShell < 1.5 && wz > 4) {
        finalShade *= 0.58;
      }

      // Face Features!
      if (wz > 5) {
        // Two tiny dark-blue oval dot eyebrows (signature Bombloong detail from images.jpeg!)
        if (
          Math.hypot((wx + 2.8) / 0.95, (hy - -9.8) / 1.35) < 1 ||
          Math.hypot((wx - 2.8) / 0.95, (hy - -9.8) / 1.35) < 1
        ) {
          return [22, 68, 108];
        }

        // Big Fierce Almond Eyes with Icy Cyan Irises!
        for (const side of [-1, 1]) {
          const ex = (wx - side * 6.8) / 4.3;
          const ey = (hy - -7.0) / 3.2;
          const browCut = hy < -9.6 + (1 - Math.abs(wx) / 11) * (pose === 1 ? 2.2 : 1.0);
          if (!browCut && ex * ex + ey * ey <= 1.0) {
            if (pose === 2) {
              const dx = Math.abs(Math.abs(wx - side * 6.8) - Math.abs(hy - -7.0));
              return dx < 0.95 ? [20, 48, 82] : [235, 250, 255];
            }
            const ir = Math.hypot(ex + side * 0.12, ey);
            if (Math.hypot(ex + 0.22, ey + 0.25) < 0.24) return [255, 255, 255];
            if (ir < 0.44) return [16, 26, 38];
            if (ir < 0.78) return ey > 0 ? [112, 232, 255] : [32, 152, 214];
            return [255, 255, 255];
          }
        }

        // Mouth (smug grin vs roaring Boss mouth with sharp little fangs!)
        if (pose === 1 || pose === 2) {
          const mx = wx / 5.4;
          const my = (hy - -1.2) / 4.0;
          if (mx * mx + my * my <= 1.0) {
            const toothWave = Math.abs(((wx + 6) * 1.4) % 2 - 1);
            if (hy < -3.6 + toothWave * 1.1) return [255, 255, 255];
            if (hy > 1.4 - toothWave * 0.9) return [255, 255, 255];
            return hy > -0.2 ? [178, 46, 68] : [68, 16, 28];
          }
        } else {
          const smileY = -2.4 - (wx * wx) * 0.035 + wx * -0.05;
          if (Math.abs(wx) < 4.5 && Math.abs(hy - smileY) < 0.7) {
            return [26, 74, 114];
          }
          if (wx > 2.2 && wx < 3.8 && hy > smileY && hy < smileY + 1.8) {
            return [255, 255, 255];
          }
        }
      }

      // Ice-Mint Rounded Belly Patch (`images copy 3.jpeg`!)
      const bx = wx / 10.8;
      const by = (hy - 11.2) / 10.2;
      if (wz > 5 && hy > 1.5 && bx * bx + by * by <= 1.0) {
        return quantizeRamp(finalShade, ICE_BELLY_RAMP);
      }

      return quantizeRamp(finalShade, BOMBLOONG_BLUE_RAMP);
    },
    [22, 46, 78]
  );
}

const HAIR_BLACK_RAMP = [
  [18, 16, 18],
  [32, 28, 32],
  [48, 43, 47],
  [68, 62, 68],
  [92, 84, 92],
];

const SKIN_PEACH_RAMP = [
  [212, 152, 122],
  [232, 178, 148],
  [248, 202, 174],
  [255, 220, 196],
  [255, 234, 216],
];

const TEE_CORAL_RAMP = [
  [184, 68, 36],
  [216, 88, 48],
  [244, 114, 68],
  [255, 138, 88],
  [255, 166, 122],
];

const SHORTS_GREY_RAMP = [
  [36, 38, 42],
  [52, 55, 60],
  [70, 74, 80],
  [90, 95, 102],
  [112, 118, 126],
];

/**
 * Renders 1 high-precision 80x80 frame of XIAO QI (小七)!
 * Faithful to `images/小七/images.jpeg`:
 * - Fluffy charcoal-black hair + signature single curved top ahoge (呆毛)!
 * - Warm chestnut-brown eyes!
 * - Coral-orange T-shirt with yellow collar/cuffs + yellow horned chest emblem!
 * - Dark grey shorts!
 */
function buildXiaoQiFrame(pose = 0, phase = 0) {
  const w = 80, h = 80, half = 32;
  const bob = phase === 1 ? -0.9 : 0;

  const evalParts = (x, y, z) => {
    // Head & Short Boyish Layered Hair + Iconic Ahoge (呆毛)!
    const dFace = sdEllipsoid(x, y, z, 0, -10.5 + bob, 3.5, 10.6, 10.2, 10.0);
    const dHairCap = sdEllipsoid(x, y, z, 0, -14.8 + bob, 2.5, 12.2, 9.8, 11.2);
    const dTempleL = sdCapsule(x, y, z, -9.8, -16 + bob, 3, -10.4, -10.5 + bob, 4, 2.1);
    const dTempleR = sdCapsule(x, y, z, 9.8, -16 + bob, 3, 10.4, -10.5 + bob, 4, 2.1);
    // Signature curved ahoge strand on top!
    const dAhoge = smin(
      sdCapsule(x, y, z, 0, -23 + bob, 2, 2.2, -28.5 + bob, 2, 1.5),
      sdCapsule(x, y, z, 2.2, -28.5 + bob, 2, -0.5, -30.5 + bob, 2, 1.0),
      1.2
    );
    const dHair = smin(smin(dHairCap, smin(dTempleL, dTempleR, 1.5), 2.2), dAhoge, 1.8);

    // Coral-Orange T-Shirt Torso
    const dShirt = sdCapsule(x, y, z, 0, 2 + bob, 2, 0, 12.5 + bob, 2, 8.6);
    const dSleeveL = sdCapsule(x, y, z, -7, 2.5 + bob, 2, -11.2, 7.5 + bob, 3.5, 3.2);
    const dSleeveR = sdCapsule(x, y, z, 7, 2.5 + bob, 2, 11.2, 7.5 + bob, 3.5, 3.2);
    const dTee = smin(dShirt, smin(dSleeveL, dSleeveR, 1.5), 2.2);

    // Arms (pose 0 = hand on chin thinking just like images/小七/images.jpeg! pose 1 = cheering!)
    const dArmL =
      pose === 0
        ? sdCapsule(x, y, z, -10.5, 8 + bob, 4, 3.5, 9 + bob, 9, 2.2)
        : sdCapsule(x, y, z, -10.5, 7 + bob, 4, -15.5, 1 + bob, 7, 2.3);
    const dArmR =
      pose === 0
        ? sdCapsule(x, y, z, 10.5, 8 + bob, 4, 2.2, -1.8 + bob, 11, 2.2)
        : sdCapsule(x, y, z, 10.5, 7 + bob, 4, 15.5, -2 + bob, 7, 2.3);

    // Dark Grey Shorts (with solid waist block so zero skin gap!)
    const dWaist = sdEllipsoid(x, y, z, 0, 15.8 + bob, 2, 8.4, 4.2, 7.2);
    const dShortL = sdCapsule(x, y, z, -4.0, 16 + bob, 2, -4.8, 22.5, 2, 4.1);
    const dShortR = sdCapsule(x, y, z, 4.0, 16 + bob, 2, 4.8, 22.5, 2, 4.1);
    const dShorts = smin(dWaist, smin(dShortL, dShortR, 1.8), 2.0);

    const dLegL = sdCapsule(x, y, z, -4.8, 22.5, 2, -5.2, 28.8, 2.5, 2.1);
    const dLegR = sdCapsule(x, y, z, 4.8, 22.5, 2, 5.2, 28.8, 2.5, 2.1);

    const dSkin = Math.min(dFace, dArmL, dArmR, dLegL, dLegR);
    const dTotal = Math.min(dHair, dSkin, dTee, dShorts);
    return { dTotal, dHair, dFace, dSkin, dTee, dShorts };
  };

  return renderSdfFrame(
    w,
    h,
    half,
    (x, y, z) => evalParts(x, y, z).dTotal,
    (wx, wy, wz, _nx, _ny, _nz, shade) => {
      const p = evalParts(wx, wy, wz);
      const hy = wy - bob;

      // Hair + jagged bangs across forehead!
      const bangLine = -14.2 + Math.sin(wx * 0.85) * 1.4 - Math.abs(wx) * 0.08;
      if (p.dHair <= p.dTotal + 0.15 && (hy < bangLine || Math.abs(wx) > 9.2)) {
        return quantizeRamp(shade, HAIR_BLACK_RAMP);
      }

      if (p.dTee <= p.dTotal + 0.15) {
        if (hy >= 15.6) {
          return quantizeRamp(shade, SHORTS_GREY_RAMP);
        }
        // Yellow collar & sleeve trim + yellow horned chest print from images/小七/images.jpeg!
        if (hy < 0.8 && Math.abs(wx) < 5.2) return quantizeRamp(shade, NAILONG_YELLOW_RAMP);
        if (Math.abs(wx) > 9.4 && hy > 5.8 && hy < 8.4) return quantizeRamp(shade, NAILONG_YELLOW_RAMP);
        // Chest yellow graphic icon!
        const gx = Math.abs(wx);
        const gy = hy - 6.8;
        if (wz > 6 && ((gx < 3.2 && Math.abs(gy) < 2.2) || (gx > 1.8 && gx < 3.6 && gy > -3.5 && gy < -1.5))) {
          return quantizeRamp(shade, NAILONG_YELLOW_RAMP);
        }
        return quantizeRamp(shade, TEE_CORAL_RAMP);
      }

      if (p.dShorts <= p.dTotal + 0.15 && hy >= 14.5 && hy <= 24.5) {
        return quantizeRamp(shade, SHORTS_GREY_RAMP);
      }

      // Face details!
      if (p.dFace <= p.dSkin + 0.2 && hy < 0 && wz > 6) {
        // Eyebrows
        for (const side of [-1, 1]) {
          if (Math.abs(wx - side * 4.5) < 2.4 && Math.abs(hy - -12.6) < 0.55) {
            return [36, 30, 30];
          }
          const ex = (wx - side * 4.5) / 2.5;
          const ey = (hy - -9.8) / 2.5;
          if (ex * ex + ey * ey <= 1.0) {
            const ir = Math.hypot(ex, ey);
            if (Math.hypot(ex + 0.25, ey + 0.25) < 0.26) return [255, 255, 255];
            if (ir < 0.45) return [28, 18, 14];
            if (ir < 0.78) return [112, 62, 34]; // warm chestnut brown iris!
            return [255, 255, 255];
          }
        }
        // Cute mouth
        if (Math.abs(wx) < 2.0 && Math.abs(hy - -4.5) < 0.6) {
          return [196, 88, 78];
        }
      }

      return quantizeRamp(shade, SKIN_PEACH_RAMP);
    },
    [32, 24, 22]
  );
}

// ============================================================================
// PART 3: 48x48 Volumetric 3D-Shaded Match-3 Board Tile Sheet!
// Row 0: normal, Row 1: blink/alt
// Columns: 0=nailong, 1=bombloong, 2=minion, 3=drumstick, 4=strawberry, 5=milktea, 6=rainbow
// ============================================================================
function buildTile48(kind, alt = false) {
  const w = 48, h = 48, half = 20;

  if (kind === 'nailong' || kind === 'rainbow') {
    const ramp =
      kind === 'rainbow'
        ? alt
          ? [
              [106, 76, 147],
              [25, 130, 196],
              [138, 201, 38],
              [255, 202, 58],
              [255, 133, 192],
            ]
          : [
              [25, 130, 196],
              [138, 201, 38],
              [255, 202, 58],
              [255, 89, 94],
              [255, 245, 157],
            ]
        : NAILONG_YELLOW_RAMP;

    return renderSdfFrame(
      w,
      h,
      half,
      (x, y, z) => {
        const dome = sdEllipsoid(x, y, z, 0, -2.5, 1, 14.2, 12.8, 13.5);
        const cL = sdEllipsoid(x, y, z, -5.8, 3.8, 3, 10.8, 9.2, 10.5);
        const cR = sdEllipsoid(x, y, z, 5.8, 3.8, 3, 10.8, 9.2, 10.5);
        let d = smin(dome, smin(cL, cR, 5.5), 6.0);
        if (kind === 'rainbow') {
          // Crown on top!
          const crown = Math.min(
            sdCapsule(x, y, z, -5, -13, 3, -6, -17.5, 3, 1.8),
            Math.min(
              sdCapsule(x, y, z, 0, -13, 3, 0, -18.5, 3, 2.0),
              sdCapsule(x, y, z, 5, -13, 3, 6, -17.5, 3, 1.8)
            )
          );
          d = Math.min(d, crown);
        }
        return d;
      },
      (wx, wy, wz, _nx, _ny, _nz, shade) => {
        if (kind === 'rainbow' && wy < -12.8) {
          return quantizeRamp(Math.max(0.6, shade), NAILONG_YELLOW_RAMP);
        }
        if (wz > 4) {
          for (const side of [-1, 1]) {
            const ex = (wx - side * 6.2) / 4.2;
            const ey = (wy - -1.8) / 4.4;
            if (alt && kind === 'nailong') {
              const arc = -1.6 + (wx - side * 6.2) ** 2 * 0.12;
              if (Math.abs(wx - side * 6.2) < 3.6 && Math.abs(wy - arc) < 0.95) return [43, 28, 20];
            } else if (ex * ex + ey * ey <= 1.0) {
              const ir = Math.hypot(ex + side * 0.1, ey);
              if (Math.hypot(ex + 0.25, ey + 0.28) < 0.24) return [255, 255, 255];
              if (ir < 0.48) return [20, 16, 15];
              if (ir < 0.8) return ey > 0 ? [72, 212, 102] : [32, 146, 62];
              return [255, 255, 255];
            }
          }
          // Blush
          if (
            Math.hypot((wx + 10.5) / 2.6, (wy - 3.2) / 1.8) < 1 ||
            Math.hypot((wx - 10.5) / 2.6, (wy - 3.2) / 1.8) < 1
          ) {
            return [255, 148, 132];
          }
          // Cute rounded open smile with teeth & tongue!
          const mx = wx / 6.8;
          const my = (wy - 6.0) / 3.8;
          if (wy >= 3.6 && mx * mx + my * my <= 1.0) {
            if (wy < 5.0) return [255, 255, 255];
            if (wy > 7.0 && Math.abs(wx) < 4.8) return [248, 120, 142];
            return [96, 20, 36];
          }
        }
        return quantizeRamp(shade, ramp);
      }
    );
  }

  if (kind === 'bombloong') {
    const shellY = (x) => -4.2 + Math.abs((((x + 16) / 6.4) % 2) - 1) * 3.8;
    return renderSdfFrame(
      w,
      h,
      half,
      (x, y, z) => {
        const head = sdEllipsoid(x, y, z, 0, -1.5, 1, 14.5, 14.2, 13.5);
        const cheeks = sdEllipsoid(x, y, z, 0, 4.5, 3, 16.0, 9.8, 13.0);
        let d = smin(head, cheeks, 5.0);
        if (y < shellY(x) + 1) {
          d = Math.min(d, sdEllipsoid(x, y, z, 0, -2.0, 1.4, 15.2, 14.6, 14.0));
        }
        return d;
      },
      (wx, wy, wz, _nx, _ny, _nz, shade) => {
        if (wy < shellY(wx)) return quantizeRamp(shade, EGGSHELL_RAMP);
        let s = shade;
        if (wy - shellY(wx) < 1.5) s *= 0.65;
        if (wz > 4) {
          // Dot brows!
          if (
            Math.hypot((wx + 2.8) / 0.9, (wy - -0.5) / 1.3) < 1 ||
            Math.hypot((wx - 2.8) / 0.9, (wy - -0.5) / 1.3) < 1
          ) {
            return [22, 68, 108];
          }
          for (const side of [-1, 1]) {
            const ex = (wx - side * 6.8) / 4.2;
            const ey = (wy - 2.4) / 3.0;
            const cut = wy < 0.8 + Math.abs(wx) * 0.08;
            if (!cut && ex * ex + ey * ey <= 1.0) {
              if (alt) return Math.abs(wy - 2.4) < 0.8 ? [22, 54, 92] : quantizeRamp(s, BOMBLOONG_BLUE_RAMP);
              const ir = Math.hypot(ex + side * 0.1, ey);
              if (Math.hypot(ex + 0.2, ey + 0.25) < 0.24) return [255, 255, 255];
              if (ir < 0.44) return [16, 26, 38];
              if (ir < 0.78) return [92, 224, 255];
              return [255, 255, 255];
            }
          }
          // Smug fang mouth
          const mx = wx / 5.2;
          const my = (wy - 8.2) / 2.6;
          if (wy >= 6.8 && mx * mx + my * my <= 1.0) {
            if ((Math.abs(wx - 2.8) < 1.1 || Math.abs(wx + 2.8) < 1.1) && wy < 8.6) return [255, 255, 255];
            return [68, 18, 32];
          }
        }
        return quantizeRamp(s, BOMBLOONG_BLUE_RAMP);
      },
      [22, 46, 78]
    );
  }

  if (kind === 'minion') {
    // Faithful to `images/小紫兵/Unknown copy.jpeg` & `Unknown.jpeg`:
    // - Twin fluffy violet-purple cloud afro buns + top hair peek!
    // - Sporty cyan-teal "bomb" headband across forehead!
    // - Pastel lilac-pink mochi face + two big lime-yellow sclera eyes with glossy black pupils!
    // - Cute straight horizontal pink mouth + blue denim overalls bib with silver buttons!
    const LILAC_SKIN_RAMP = [
      [164, 104, 156],
      [198, 136, 188],
      [230, 170, 218],
      [246, 196, 234],
      [255, 220, 246],
    ];
    const VIOLET_PUFF_RAMP = [
      [92, 42, 176],
      [124, 66, 214],
      [162, 98, 248],
      [192, 138, 255],
      [224, 186, 255],
    ];
    const TEAL_BAND_RAMP = [
      [24, 98, 128],
      [40, 134, 168],
      [62, 172, 204],
      [94, 202, 228],
      [152, 232, 248],
    ];
    const DENIM_OVERALLS_RAMP = [
      [24, 78, 112],
      [36, 108, 148],
      [52, 138, 182],
      [78, 166, 206],
      [122, 196, 228],
    ];

    const evalMinion = (x, y, z) => {
      // Twin fluffy cloud afro buns on left & right!
      let dPuffs = 999;
      for (const side of [-1, 1]) {
        const p1 = sdSphere(x, y, z, side * 12.6, -10.4, 0.5, 4.5);
        const p2 = sdSphere(x, y, z, side * 15.0, -6.6, 0.8, 4.3);
        const p3 = sdSphere(x, y, z, side * 13.6, -2.6, 0.8, 3.8);
        const p4 = sdSphere(x, y, z, side * 9.8, -11.8, 0.5, 3.8);
        const puff = smin(smin(p1, p2, 1.8), smin(p3, p4, 1.8), 1.8);
        dPuffs = Math.min(dPuffs, puff);
      }

      // Top purple hair crown + cyan headband + wide chubby square-mochi lilac face
      const dCrown = sdEllipsoid(x, y, z, 0, -8.4, 1.5, 10.6, 5.4, 10.2);
      const dBand = sdEllipsoid(x, y, z, 0, -5.8, 2.8, 12.6, 4.0, 12.0);
      const dFaceMid = sdEllipsoid(x, y, z, 0, 1.8, 2.4, 12.2, 8.6, 11.4);
      const dJawL = sdEllipsoid(x, y, z, -5.2, 5.4, 3.2, 7.6, 5.6, 9.6);
      const dJawR = sdEllipsoid(x, y, z, 5.2, 5.4, 3.2, 7.6, 5.6, 9.6);
      const dHead = smin(dCrown, smin(dBand, smin(dFaceMid, smin(dJawL, dJawR, 4.2), 3.8), 1.8), 1.8);

      // Cute chibi upper shoulders + denim overalls bib at bottom!
      const dTorso = sdEllipsoid(x, y, z, 0, 13.0, 1.8, 9.6, 4.4, 8.6);
      const dTotal = Math.min(dPuffs, smin(dHead, dTorso, 1.8));
      return { dTotal, dPuffs, dBand, dCrown, dTorso };
    };

    return renderSdfFrame(
      w,
      h,
      half,
      (x, y, z) => evalMinion(x, y, z).dTotal,
      (wx, wy, wz, _nx, _ny, _nz, shade) => {
        const p = evalMinion(wx, wy, wz);

        // 1. Twin Violet Cloud Afro Puffs!
        if (p.dPuffs < p.dTotal + 0.25 && Math.abs(wx) > 10.0 && wy < 1.2) {
          return quantizeRamp(shade, VIOLET_PUFF_RAMP);
        }

        // 2. Top Violet Hair Crown peeking above headband (with center part line!)
        const bandTopY = -9.0 + (wx * wx) * 0.014;
        const bandBotY = -3.0 + (wx * wx) * 0.01;
        if (wy < bandTopY) {
          if (Math.abs(wx) < 0.55) return [82, 38, 156];
          return quantizeRamp(shade, VIOLET_PUFF_RAMP);
        }

        // 3. Cyan-Teal "bomb" Headband!
        if (wy >= bandTopY && wy <= bandBotY && Math.abs(wx) < 13.0) {
          // Tiny cream "bomb" print on upper-left of headband (`Unknown copy.jpeg`!)
          if (wz > 5 && wx >= -8.4 && wx <= -2.4 && wy >= -7.2 && wy <= -5.4) {
            const dot = Math.floor((wx + 8.4) * 1.15) % 2 === 0;
            if (dot) return [245, 250, 232];
          }
          return quantizeRamp(shade, TEAL_BAND_RAMP);
        }

        // 4. Chibi Denim Overalls Bib + 2 Silver Buttons (`wy >= 10.2`)!
        if (wy >= 10.2) {
          const onStrapL = wx >= -6.8 && wx <= -4.0 && wy >= 9.8;
          const onStrapR = wx >= 4.0 && wx <= 6.8 && wy >= 9.8;
          const onBib = Math.abs(wx) <= 6.6 && wy >= 11.8;
          if (onStrapL || onStrapR || onBib) {
            if (
              wz > 4 &&
              (Math.hypot(wx + 5.2, wy - 12.2) < 1.35 || Math.hypot(wx - 5.2, wy - 12.2) < 1.35)
            ) {
              return [238, 242, 248];
            }
            return quantizeRamp(shade, DENIM_OVERALLS_RAMP);
          }
          return quantizeRamp(shade * 0.92, LILAC_SKIN_RAMP);
        }

        // 5. Face Features: Two Big Round Lime-Yellow Sclera Eyes + Straight Pink Mouth!
        if (wz > 4) {
          for (const side of [-1, 1]) {
            const cx = side * 5.1;
            const cy = 1.2;
            const ex = (wx - cx) / 3.7;
            const ey = (wy - cy) / 3.7;
            const r2 = ex * ex + ey * ey;
            if (r2 <= 1.0) {
              if (alt) {
                if (Math.abs(wy - cy) < 0.85) return [84, 42, 92];
                return quantizeRamp(shade, LILAC_SKIN_RAMP);
              }
              if (r2 > 0.82) return [96, 56, 108];
              const pr = Math.hypot((wx - cx) / 2.3, (wy - cy) / 2.3);
              if (Math.hypot(wx - cx + 0.9, wy - cy + 0.9) < 0.9) return [255, 255, 255];
              if (pr <= 1.0) return [20, 16, 26];
              return wy < cy ? [204, 202, 74] : [234, 232, 98];
            }
          }

          // Straight horizontal rose-pink mouth (`Unknown copy.jpeg`!)
          if (Math.abs(wx) < 3.8 && Math.abs(wy - 6.6) < 0.65) {
            return [188, 62, 88];
          }
        }

        let s = shade;
        if (wy > bandBotY && wy < bandBotY + 1.2) s *= 0.72;
        if (wy > 9.0 && wy < 10.2) s *= 0.76;

        return quantizeRamp(s, LILAC_SKIN_RAMP);
      },
      [46, 24, 68]
    );
  }

  if (kind === 'drumstick') {
    const ROAST_RAMP = [
      [142, 54, 12],
      [188, 82, 20],
      [232, 118, 34],
      [255, 158, 58],
      [255, 208, 118],
    ];
    return renderSdfFrame(
      w,
      h,
      half,
      (x, y, z) => {
        // Diagonal plump roast meat + bone handle with two condyle knobs!
        const rx = (x + y) * 0.707;
        const ry = (y - x) * 0.707;
        const meat = sdEllipsoid(rx, ry, z, -3.8, 0, 2, 11.2, 8.8, 9.5);
        const boneShaft = sdCapsule(x, y, z, 3, 3, 1, 12.5, 12.5, 1, 2.8);
        const knob1 = sdSphere(x, y, z, 14.2, 11.2, 1.5, 3.0);
        const knob2 = sdSphere(x, y, z, 11.2, 14.2, 1.5, 3.0);
        return Math.min(smin(meat, boneShaft, 1.2), smin(knob1, knob2, 1.8));
      },
      (wx, wy, _wz, _nx, _ny, _nz, shade) => {
        if (wx + wy > 11.5) {
          return shade > 0.45 ? [255, 252, 245] : [214, 206, 196];
        }
        // Caramelized grill marks!
        const stripe = Math.abs(((wx - wy + 20) / 4.5) % 2 - 1);
        if (stripe < 0.22 && Math.hypot(wx + 3, wy + 3) < 6.5) {
          return [128, 46, 10];
        }
        return quantizeRamp(shade, ROAST_RAMP);
      }
    );
  }

  if (kind === 'strawberry') {
    const BERRY_RAMP = [
      [156, 18, 44],
      [204, 32, 62],
      [242, 58, 82],
      [255, 92, 112],
      [255, 162, 176],
    ];
    const LEAF_RAMP = [
      [18, 98, 42],
      [32, 142, 62],
      [58, 188, 88],
      [96, 224, 122],
      [162, 248, 178],
    ];
    return renderSdfFrame(
      w,
      h,
      half,
      (x, y, z) => {
        // Tapered heart-berry body + leafy calyx crown!
        const taper = 1 - (y - 2) * 0.028;
        const berry = sdEllipsoid(x / Math.max(0.55, taper), y, z, 0, 3.2, 2, 13.2, 13.0, 12.0);
        const leafC = sdEllipsoid(x, y, z, 0, -10.5, 3, 10.5, 3.2, 6.0);
        const stem = sdCapsule(x, y, z, 0, -11, 2, 1.5, -16, 2, 1.6);
        return Math.min(berry, smin(leafC, stem, 1.5));
      },
      (wx, wy, wz, _nx, _ny, _nz, shade) => {
        const leafEdge = -7.2 + Math.cos(wx * 0.65) * 2.2;
        if (wy < leafEdge) {
          return quantizeRamp(shade, LEAF_RAMP);
        }
        // Recessed golden strawberry seeds!
        if (wz > 5) {
          const seeds = [
            [-5.5, -1], [0, -2], [5.5, -1],
            [-7.5, 4], [-2.5, 4.5], [2.5, 4.5], [7.5, 4],
            [-4.5, 9.5], [0, 10], [4.5, 9.5],
          ];
          for (const [sx, sy] of seeds) {
            if (Math.hypot((wx - sx) / 1.0, (wy - sy) / 1.3) < 1) {
              return [255, 228, 102];
            }
          }
        }
        return quantizeRamp(shade, BERRY_RAMP);
      }
    );
  }

  // 'milktea'
  const MINT_TEA_RAMP = [
    [24, 132, 92],
    [42, 176, 122],
    [76, 216, 156],
    [118, 238, 184],
    [182, 252, 218],
  ];
  return renderSdfFrame(
    w,
    h,
    half,
    (x, y, z) => {
      // Tapered boba cup + domed lid + diagonal straw!
      const cupW = 10.8 - Math.max(0, y + 6) * 0.16;
      let dCup = Math.max(Math.hypot(x, z) - cupW, Math.abs(y - 4.5) - 11.2);
      const lidRim = Math.max(Math.hypot(x, z) - 12.2, Math.abs(y - -7.2) - 1.6);
      const dome = sdEllipsoid(x, y, z, 0, -8.5, 0, 10.8, 5.2, 10.8);
      const straw = sdCapsule(x, y, z, 2.5, -8, 1, 5.5, -16.8, 1, 2.1);
      return Math.min(dCup, lidRim, dome, straw);
    },
    (wx, wy, wz, _nx, _ny, _nz, shade) => {
      if (wy < -10.5 && wx > 1.0) {
        return Math.floor((wy + wx) * 0.8) % 2 === 0 ? [255, 104, 132] : [255, 240, 245];
      }
      if (wy < -5.6) {
        return shade > 0.5 ? [255, 255, 255] : [222, 236, 245];
      }
      if (wy < -1.2) {
        return quantizeRamp(shade, NAILONG_CREAM_RAMP); // cheese foam layer!
      }
      // Glossy tapioca boba pearls visible at bottom!
      if (wz > 4 && wy > 8.5) {
        const pearls = [[-4.8, 11.5], [0, 12.8], [4.8, 11.5], [-2.4, 9.6], [2.8, 9.8]];
        for (const [bx, by] of pearls) {
          const pd = Math.hypot(wx - bx, wy - by);
          if (pd < 2.2) {
            if (Math.hypot(wx - bx + 0.6, wy - by + 0.6) < 0.7) return [168, 132, 112];
            return [42, 26, 20];
          }
        }
      }
      return quantizeRamp(shade, MINT_TEA_RAMP);
    }
  );
}

function packHorizontalStrip(frames, fw, fh) {
  const totalW = fw * frames.length;
  const out = new Uint8Array(totalW * fh * 4);
  frames.forEach((f, idx) => {
    const ox = idx * fw;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const s = (y * fw + x) * 4;
        const d = (y * totalW + (ox + x)) * 4;
        out[d] = f[s];
        out[d + 1] = f[s + 1];
        out[d + 2] = f[s + 2];
        out[d + 3] = f[s + 3];
      }
    }
  });
  return { width: totalW, height: fh, rgba: out };
}

function main() {
  console.log('1) Building 96x96 Pixel Stickers from user categorized `images/` folder...');
  const stickerSpecs = [
    // Exact user request: replace drooling Nailong photo with `images/奶龙/123.jpeg`!
    {
      id: 'nailong_happy',
      src: 'images/奶龙/123.jpeg',
      desc: '奶龙馋得流口水',
      opts: { mode: 'contain_wide' },
    },
    {
      id: 'nailong_belly',
      src: 'images/奶龙/images.jpeg',
      desc: '奶龙歪头秀大肚肚',
      opts: { biasY: 0.42 },
    },
    {
      id: 'nailong_wave',
      src: 'images/奶龙/Unknown.jpeg',
      desc: '奶龙开心招手',
      opts: { removeWhiteBg: true },
    },
    {
      id: 'nailong_eat',
      src: 'images/奶龙/images copy.jpeg',
      desc: '奶龙肚饿小眼神',
      opts: { removeWhiteBg: true },
    },
    {
      id: 'nailong_cool',
      src: 'images/奶龙/Unknown 2.jpeg',
      desc: '奶龙捧脸卖萌',
      opts: { removeWhiteBg: true },
    },
    {
      id: 'bombloong',
      src: 'images/暴暴龙/images copy 3.jpeg',
      desc: '暴暴龙：蛋壳恶龙',
      opts: { removeWhiteBg: true },
    },
    {
      id: 'minion_twin',
      src: 'images/小紫兵/Unknown copy.jpeg',
      desc: '小紫兵：双丸头带',
      opts: { removeCornerBg: true, bgTolerance: 38 },
    },
    {
      id: 'minion_one',
      src: 'images/小紫兵/Unknown.jpeg',
      desc: '小紫兵：独眼呆萌',
      opts: { removeCornerBg: true, bgTolerance: 38 },
    },
    {
      id: 'xiaoqi',
      src: 'images/小七/images.jpeg',
      desc: '天才少年小七',
      opts: { removeWhiteBg: true, zoom: 1.15, biasY: 0.2 },
    },
  ];

  const manifest = [];
  for (const sp of stickerSpecs) {
    const fullSrc = path.resolve(sp.src);
    const { size, rgba } = convertRefToSticker96(fullSrc, sp.opts);
    const file = `${sp.id}.png`;
    fs.writeFileSync(path.join(STICKER_OUT_DIR, file), encodePngRGBA(size, size, rgba));
    let opaque = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) opaque++;
    manifest.push({
      id: sp.id,
      desc: sp.desc,
      origin: 'online-pixelized',
      url: `/assets/stickers/${file}`,
      width: size,
      height: size,
      opaqueRatio: Number((opaque / (size * size)).toFixed(3)),
    });
    console.log(`  Sticker [${sp.id}] <- ${sp.src} (${size}x${size})`);
  }
  fs.writeFileSync(path.join(STICKER_OUT_DIR, 'manifest.json'), JSON.stringify({ stickers: manifest }, null, 2));

  console.log('2) Sculpting 3D SDF Volumetric Pixel Models (Nailong 96x96x12, Bombloong 88x88x6, XiaoQi 80x80x4)...');
  // Nailong: 6 poses x 2 animation phases = 12 frames of 96x96!
  const nailongFrames = [];
  for (let pose = 0; pose < 6; pose++) {
    for (let phase = 0; phase < 2; phase++) {
      nailongFrames.push(buildNailongFrame(pose, phase));
    }
  }
  const nailongStrip = packHorizontalStrip(nailongFrames, 96, 96);
  fs.writeFileSync(
    path.join(MODEL_OUT_DIR, 'nailong_sheet.png'),
    encodePngRGBA(nailongStrip.width, nailongStrip.height, nailongStrip.rgba)
  );

  // Bombloong: 3 poses x 2 animation phases = 6 frames of 88x88!
  const bossFrames = [];
  for (let pose = 0; pose < 3; pose++) {
    for (let phase = 0; phase < 2; phase++) {
      bossFrames.push(buildBombloongFrame(pose, phase));
    }
  }
  const bossStrip = packHorizontalStrip(bossFrames, 88, 88);
  fs.writeFileSync(
    path.join(MODEL_OUT_DIR, 'bombloong_sheet.png'),
    encodePngRGBA(bossStrip.width, bossStrip.height, bossStrip.rgba)
  );

  // Xiao Qi: 2 poses x 2 phases = 4 frames of 80x80!
  const xiaoqiFrames = [];
  for (let pose = 0; pose < 2; pose++) {
    for (let phase = 0; phase < 2; phase++) {
      xiaoqiFrames.push(buildXiaoQiFrame(pose, phase));
    }
  }
  const xiaoqiStrip = packHorizontalStrip(xiaoqiFrames, 80, 80);
  fs.writeFileSync(
    path.join(MODEL_OUT_DIR, 'xiaoqi_sheet.png'),
    encodePngRGBA(xiaoqiStrip.width, xiaoqiStrip.height, xiaoqiStrip.rgba)
  );

  console.log('3) Sculpting 48x48 3D-Shaded Match-3 Tile Atlas & Individual Icons...');
  const tileKinds = ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry', 'milktea', 'rainbow'];
  const tileFrames = [];
  for (const k of tileKinds) {
    const idleRgba = buildTile48(k, false);
    tileFrames.push(idleRgba);
    tileFrames.push(buildTile48(k, true));
    fs.writeFileSync(path.join(MODEL_OUT_DIR, `tile_${k}.png`), encodePngRGBA(48, 48, idleRgba));
  }
  const tileStrip = packHorizontalStrip(tileFrames, 48, 48);
  fs.writeFileSync(
    path.join(MODEL_OUT_DIR, 'tiles_sheet.png'),
    encodePngRGBA(tileStrip.width, tileStrip.height, tileStrip.rgba)
  );

  console.log('4) Painting 320x200 16-bit Pixel Scenic Backgrounds for Chapters 1, 2, and 3...');
  for (const chapId of [1, 2, 3]) {
    const bgRgba = buildChapterBackground(chapId);
    fs.writeFileSync(
      path.join(MODEL_OUT_DIR, `bg_chapter_${chapId}.png`),
      encodePngRGBA(320, 200, bgRgba)
    );
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('All high-precision 3D SDF pixel models & stickers built successfully!');
}

function buildChapterBackground(chapId) {
  const W = 320;
  const H = 200;
  const rgba = new Uint8Array(W * H * 4);
  const setPx = (x, y, r, g, b) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
    const o = (iy * W + ix) * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  };
  const fillCircle = (cx, cy, rad, r, g, b) => {
    const r2 = rad * rad;
    for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) {
      for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
        if (dx * dx + dy * dy <= r2) setPx(cx + dx, cy + dy, r, g, b);
      }
    }
  };
  const fillRect = (x0, y0, w, h, r, g, b) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) setPx(x, y, r, g, b);
    }
  };

  if (chapId === 1) {
    // 🌴 Chapter 1: Sunny Picnic Island (阳光野餐岛)
    for (let y = 0; y < H; y++) {
      const t = y / H;
      for (let x = 0; x < W; x++) {
        if (y < 105) {
          // Sunny sky gradient
          const st = y / 105;
          setPx(x, y, Math.round(72 + st * 115), Math.round(188 + st * 52), Math.round(250 + st * 5));
        } else if (y < 126) {
          // Turquoise tropical ocean
          const ot = (y - 105) / 21;
          const wave = ((x + y * 3) % 14 < 4) ? 18 : 0;
          setPx(x, y, Math.round(20 + ot * 30 + wave), Math.round(184 + ot * 35 + wave), Math.round(216 + wave));
        } else {
          // Rolling green picnic meadow + sandy shore
          const hill = Math.sin(x * 0.028) * 7 + Math.cos(x * 0.06) * 3;
          if (y < 134 + hill * 0.5) {
            setPx(x, y, 253, 230, 138); // Golden sand beach
          } else {
            const gt = (y - 134) / 66;
            const checker = (((x >> 3) + (y >> 3)) & 1) * 8;
            setPx(x, y, Math.round(132 - gt * 34 + checker), Math.round(218 - gt * 28 + checker), Math.round(52 - gt * 14));
          }
        }
      }
    }
    // Golden pixel sun with warm halo
    fillCircle(266, 34, 22, 254, 240, 138);
    fillCircle(266, 34, 16, 250, 204, 21);
    fillCircle(266, 34, 11, 255, 251, 235);
    // Fluffy pixel clouds
    for (const [cx, cy, s] of [[58, 28, 1], [150, 42, 0.85], [225, 24, 0.75]]) {
      fillCircle(cx, cy, 14 * s, 255, 255, 255);
      fillCircle(cx - 12 * s, cy + 4 * s, 10 * s, 255, 255, 255);
      fillCircle(cx + 13 * s, cy + 3 * s, 11 * s, 255, 255, 255);
    }
    // Red-and-white checkered picnic blanket on right meadow
    for (let py = 152; py < 182; py++) {
      const span = (py - 152) * 0.6;
      for (let px = Math.round(210 - span); px < Math.round(282 + span); px++) {
        const cell = (((px >> 2) + (py >> 2)) & 1) === 0;
        setPx(px, py, cell ? 255 : 244, cell ? 251 : 63, cell ? 235 : 94);
      }
    }
    // Palm trees on left & right
    for (const [tx, baseY, bend] of [[34, 158, 1], [292, 162, -1]]) {
      for (let i = 0; i < 58; i++) {
        const px = tx + bend * Math.sin(i * 0.035) * 11;
        const py = baseY - i;
        const shade = (Math.floor(i / 5) % 2 === 0) ? 0 : -18;
        fillCircle(px, py, Math.max(2, 4.5 - i * 0.04), 161 + shade, 98 + shade, 48 + shade);
      }
      const topX = tx + bend * Math.sin(58 * 0.035) * 11;
      const topY = baseY - 58;
      // Palm fronds
      for (const ang of [-2.4, -1.7, -0.9, -0.2, 0.4, 1.1]) {
        for (let r = 0; r < 26; r++) {
          const fx = topX + Math.cos(ang) * r;
          const fy = topY + Math.sin(ang) * r + (r * r) * 0.028;
          fillCircle(fx, fy, Math.max(1.5, 3.8 - r * 0.1), 34, 197, 94);
        }
      }
      fillCircle(topX - 3, topY + 4, 3, 120, 53, 15);
      fillCircle(topX + 3, topY + 5, 3, 120, 53, 15);
    }
  } else if (chapId === 2) {
    // 🍨 Chapter 2: Crystal Dessert Bay (冰晶甜品湾)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y < 108) {
          // Cotton-candy aurora sky (icy cyan -> pastel pink -> lavender)
          const st = y / 108;
          const wave = Math.sin(x * 0.04 + y * 0.05) * 10;
          setPx(
            x,
            y,
            Math.min(255, Math.round(186 + st * 66 + wave)),
            Math.min(255, Math.round(230 - st * 18)),
            Math.min(255, Math.round(253 - st * 12))
          );
        } else if (y < 145) {
          // Distant Ice Cream & Whipped Cream Mountains
          const m1 = 114 + Math.sin(x * 0.035) * 14 + Math.cos(x * 0.08) * 6;
          if (y < m1) {
            setPx(x, y, 252, 231, 243);
          } else if (y < m1 + 7 + Math.sin(x * 0.18) * 3) {
            setPx(x, y, 255, 255, 255); // White whipped cream frosting cap
          } else {
            // Strawberry & mint-ice-cream hills
            const isMint = ((Math.floor(x / 80)) % 2) === 1;
            setPx(x, y, isMint ? 167 : 249, isMint ? 243 : 168, isMint ? 208 : 212);
          }
        } else {
          // Sparkling Berry & Ice Crystal Bay
          const bt = (y - 145) / 55;
          const sparkle = ((x * 7 + y * 13) % 29 === 0) ? 35 : 0;
          setPx(
            x,
            y,
            Math.min(255, Math.round(125 + bt * 60 + sparkle)),
            Math.min(255, Math.round(211 - bt * 20 + sparkle)),
            Math.min(255, Math.round(252 + sparkle))
          );
        }
      }
    }
    // Sparkling ice crystals & 4-point stars in sky
    for (const [sx, sy] of [[32, 24], [88, 18], [146, 32], [210, 20], [278, 28], [54, 62], [254, 58]]) {
      fillRect(sx - 4, sy, 9, 1, 255, 255, 255);
      fillRect(sx, sy - 4, 1, 9, 255, 255, 255);
      fillCircle(sx, sy, 1.8, 254, 249, 195);
    }
    // Ice-Crystal Castle spires on left & Giant Sundae on right
    for (const [bx, w, h] of [[28, 14, 48], [44, 18, 66], [64, 14, 44]]) {
      fillRect(bx, 136 - h, w, h, 186, 230, 253);
      for (let i = 0; i < 14; i++) {
        fillRect(bx + Math.floor((i * w) / 28), 136 - h - i, Math.max(2, w - Math.floor((i * w) / 14)), 1, 125, 211, 252);
      }
    }
    // Giant Ice-Cream Scoops with cherries on right
    fillCircle(268, 134, 24, 251, 207, 232); // Strawberry scoop
    fillCircle(244, 140, 20, 167, 243, 208); // Mint scoop
    fillCircle(268, 110, 6, 244, 63, 94);    // Red cherry on top
  } else {
    // 🚀 Chapter 3: Minion Mecha Fortress (紫兵机械堡)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y < 122) {
          // Deep cyber-purple cosmos & neon grid horizon
          const st = y / 122;
          setPx(
            x,
            y,
            Math.round(38 + st * 78),
            Math.round(18 + st * 38),
            Math.round(78 + st * 96)
          );
        } else if (y < 158) {
          // Distant cyber-fortress skyline
          setPx(x, y, 59, 27, 104);
        } else {
          // Metallic Mecha Deck with glowing purple grid lines
          const gridLine = (x % 16 === 0) || (y % 10 === 0);
          setPx(x, y, gridLine ? 168 : 49, gridLine ? 85 : 36, gridLine ? 247 : 78);
        }
      }
    }
    // Starfield
    for (let i = 0; i < 45; i++) {
      const sx = (i * 73 + 19) % W;
      const sy = (i * 41 + 11) % 105;
      setPx(sx, sy, 250, 245, 255);
      if (i % 4 === 0) setPx(sx + 1, sy, 253, 224, 71);
    }
    // Ringed Cyber Planet in top-right sky
    fillCircle(256, 40, 18, 192, 132, 252);
    fillCircle(252, 36, 14, 216, 180, 254);
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const rx = 256 + Math.cos(rad) * 29;
      const ry = 40 + Math.sin(rad) * 8 - Math.cos(rad) * 5;
      if (Math.sin(rad) > 0 || Math.hypot(rx - 256, ry - 40) > 18) {
        setPx(rx, ry, 56, 189, 248);
        setPx(rx, ry + 1, 250, 204, 21);
      }
    }
    // Mecha Fortress Towers & Giant Minion Silhouette with Glowing Visor & Crown!
    for (const [tx, tw, th] of [[16, 28, 72], [50, 22, 54], [248, 24, 62], [278, 30, 78]]) {
      fillRect(tx, 158 - th, tw, th, 76, 29, 149);
      fillRect(tx + 4, 158 - th + 8, tw - 8, 4, 56, 189, 248); // Cyan energy visor strip
      fillRect(tx + 4, 158 - th + 18, tw - 8, 3, 250, 204, 21); // Gold indicator
    }
    // Yellow-and-black hazard stripe along deck edge (y = 156..161)
    for (let x = 0; x < W; x++) {
      const yellow = ((x + 4) >> 3) & 1;
      for (let y = 156; y < 161; y++) {
        setPx(x, y, yellow ? 250 : 30, yellow ? 204 : 27, yellow ? 21 : 46);
      }
    }
  }
  return rgba;
}

main();
