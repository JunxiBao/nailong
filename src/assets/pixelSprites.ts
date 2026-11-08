import { SpecialType, TileColor } from '../match3/types';

export const COLOR_META: Record<TileColor, { label: string; hex: string; light: string }> = {
  nailong: { label: '奶龙', hex: '#FFD438', light: '#FFF3A1' },
  bombloong: { label: '暴暴龙', hex: '#55C5EE', light: '#C4F0FF' },
  minion: { label: '小紫兵', hex: '#D87BF2', light: '#F5D0FE' },
  drumstick: { label: '烤鸡腿', hex: '#FF8F3D', light: '#FFD099' },
  strawberry: { label: '红草莓', hex: '#FF4D5E', light: '#FFB3BC' },
  milktea: { label: '波波奶茶', hex: '#52E09B', light: '#BFF8DC' },
};

export type NailongPose = 'idle' | 'mouth_open' | 'chew' | 'pat_belly' | 'belly_slam' | 'worried';

const POSE_TO_INDEX: Record<NailongPose, number> = {
  idle: 0,
  mouth_open: 1, // Matches images/奶龙/123.jpeg (both paws up + drool!)
  chew: 2,
  pat_belly: 3,
  belly_slam: 4,
  worried: 5, // Matches images/奶龙/images copy.jpeg (half-lidded expression!)
};

export const TILE_KIND_ORDER: Array<TileColor | 'rainbow'> = [
  'nailong',
  'bombloong',
  'minion',
  'drumstick',
  'strawberry',
  'milktea',
  'rainbow',
];

interface LoadedSheets {
  nailong: HTMLImageElement | null;
  bombloong: HTMLImageElement | null;
  xiaoqi: HTMLImageElement | null;
  tiles: HTMLImageElement | null;
}

const sheets: LoadedSheets = {
  nailong: null,
  bombloong: null,
  xiaoqi: null,
  tiles: null,
};

const slicedTileCache = new Map<string, HTMLCanvasElement>();

function loadSheet(url: string, onLoad: (img: HTMLImageElement) => void): void {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    slicedTileCache.clear();
    onLoad(img);
  };
  img.src = url;
}

if (typeof window !== 'undefined') {
  loadSheet('/assets/models/nailong_sheet.png', (img) => (sheets.nailong = img));
  loadSheet('/assets/models/bombloong_sheet.png', (img) => (sheets.bombloong = img));
  loadSheet('/assets/models/xiaoqi_sheet.png', (img) => (sheets.xiaoqi = img));
  loadSheet('/assets/models/tiles_sheet.png', (img) => (sheets.tiles = img));
}

function makeFallbackTile(hex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(24, 24, 18, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function getTileSprite(color: TileColor, blink = false): HTMLCanvasElement {
  const key = `${color}:${blink ? 1 : 0}`;
  const cached = slicedTileCache.get(key);
  if (cached) return cached;

  if (!sheets.tiles) {
    return makeFallbackTile(COLOR_META[color].hex);
  }

  const kindIdx = TILE_KIND_ORDER.indexOf(color);
  const frameIdx = kindIdx * 2 + (blink ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheets.tiles, frameIdx * 48, 0, 48, 48, 0, 0, 48, 48);
  slicedTileCache.set(key, c);
  return c;
}

export function getRainbowNailongSprite(phase: number): HTMLCanvasElement {
  const alt = (phase & 1) === 1;
  const key = `rainbow:${alt ? 1 : 0}`;
  const cached = slicedTileCache.get(key);
  if (cached) return cached;

  if (!sheets.tiles) {
    return makeFallbackTile('#FFD438');
  }

  const frameIdx = 6 * 2 + (alt ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheets.tiles, frameIdx * 48, 0, 48, 48, 0, 0, 48, 48);
  slicedTileCache.set(key, c);
  return c;
}

export function drawSpecialBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  special: SpecialType,
  timeSec: number
): void {
  if (special === 'none' || special === 'rainbow') return;

  const pulse = Math.sin(timeSec * 8) * 2;
  ctx.save();
  if (special === 'line_h') {
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(x + 3, y + size / 2 - 4, size - 6, 8);
    ctx.fillStyle = '#FFF176';
    ctx.fillRect(x + 6, y + size / 2 - 2, size - 12, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + Math.max(1, 3 - pulse), y + size / 2 - 6, 5, 12);
    ctx.fillRect(x + size - 8 + Math.max(0, pulse), y + size / 2 - 6, 5, 12);
  } else if (special === 'line_v') {
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(x + size / 2 - 4, y + 3, 8, size - 6);
    ctx.fillStyle = '#FFF176';
    ctx.fillRect(x + size / 2 - 2, y + 6, 4, size - 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + size / 2 - 6, y + Math.max(1, 3 - pulse), 12, 5);
    ctx.fillRect(x + size / 2 - 6, y + size - 8 + Math.max(0, pulse), 12, 5);
  } else if (special === 'bomb') {
    // 1. Pulsing fiery warning border
    const bombPulse = Math.sin(timeSec * 10) * 1.5;
    ctx.strokeStyle = '#FF3D00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3 - bombPulse * 0.5, y + 3 - bombPulse * 0.5, size - 6 + bombPulse, size - 6 + bombPulse);

    // 2. Corner warning teeth
    ctx.fillStyle = '#FFEA00';
    ctx.fillRect(x + 3, y + 3, 5, 5);
    ctx.fillRect(x + size - 8, y + 3, 5, 5);
    ctx.fillRect(x + 3, y + size - 8, 5, 5);
    ctx.fillRect(x + size - 8, y + size - 8, 5, 5);

    // 3. High-detail retro iron bomb badge (top-right corner)
    const bx = x + size - 19;
    const by = y + 3;

    // Dark cast-iron bomb sphere
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(bx + 7, by + 9, 7, 0, Math.PI * 2);
    ctx.fill();

    // Metallic highlight ring
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + 6, by + 8, 5, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // White specular glint
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx + 4, by + 6, 2, 2);

    // Brass fuse cap
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(bx + 5, by + 1, 4, 3);

    // Sizzling spark on the fuse (flickering animated star)
    const sparkPhase = Math.floor(timeSec * 14) % 3;
    ctx.fillStyle = sparkPhase === 0 ? '#FFFFFF' : sparkPhase === 1 ? '#FFEA00' : '#FF5722';
    ctx.fillRect(bx + 6, by - 2, 3, 3);
    ctx.fillRect(bx + 5, by - 1, 5, 1);
  }
  ctx.restore();
}

/**
 * Renders the 96x96 3D-SDF sculpted Pixel Nailong onto `targetCanvas`
 * with bouncy squash-and-stretch belly physics & full-energy sparkle aura!
 */
export function renderNailongMascot(
  targetCanvas: HTMLCanvasElement,
  pose: NailongPose,
  timeSec: number,
  bellyFillRatio: number
): void {
  const ctx = targetCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cw = targetCanvas.width;
  const ch = targetCanvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (!sheets.nailong) return;

  const poseIdx = POSE_TO_INDEX[pose] ?? 0;
  const speed = pose === 'chew' || pose === 'pat_belly' ? 7.5 : pose === 'belly_slam' ? 10 : 2.6;
  const phase = Math.floor(timeSec * speed) % 2;
  const frameIdx = poseIdx * 2 + phase;

  // Sparkle ring when belly energy is 100% full!
  if (bellyFillRatio >= 0.99 || pose === 'belly_slam') {
    for (let i = 0; i < 8; i++) {
      const ang = timeSec * 3.2 + (i * Math.PI) / 4;
      const sx = Math.round(cw * 0.5 + Math.cos(ang) * (cw * 0.43));
      const sy = Math.round(ch * 0.52 + Math.sin(ang) * (ch * 0.4));
      ctx.fillStyle = i % 2 === 0 ? '#FFF59D' : '#FF9800';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }
  }

  // Subtle squash & stretch for juicy `duang~duang` belly feel!
  const jiggleFreq = pose === 'pat_belly' ? 16 : pose === 'chew' ? 12 : 4;
  const jiggleAmp = pose === 'pat_belly' ? 0.045 : pose === 'belly_slam' ? 0.06 : 0.015;
  const squashX = 1 + Math.sin(timeSec * jiggleFreq) * jiggleAmp + bellyFillRatio * 0.03;
  const squashY = 1 - Math.sin(timeSec * jiggleFreq) * jiggleAmp * 0.8;

  const jumpOffset = pose === 'belly_slam' ? -Math.abs(Math.sin(timeSec * 12)) * 12 : 0;

  const drawW = Math.round(cw * squashX);
  const drawH = Math.round(ch * squashY);
  const dx = Math.round((cw - drawW) * 0.5);
  const dy = Math.round(ch - drawH + jumpOffset);

  ctx.drawImage(sheets.nailong, frameIdx * 96, 0, 96, 96, dx, dy, drawW, drawH);

  // Floating pixel heart when happily chewing snacks!
  if (pose === 'chew') {
    const hy = Math.round(18 + Math.sin(timeSec * 10) * 4);
    ctx.fillStyle = '#FF4D5E';
    ctx.fillRect(cw - 28, hy, 6, 6);
    ctx.fillRect(cw - 20, hy, 6, 6);
    ctx.fillRect(cw - 30, hy + 4, 18, 6);
    ctx.fillRect(cw - 26, hy + 10, 10, 4);
    ctx.fillRect(cw - 23, hy + 14, 4, 4);
  }
}

/**
 * Renders the 88x88 3D-SDF sculpted Pixel Bombloong Boss (cracked eggshell cap + bat wings!)
 */
export function renderBombloongBoss(
  targetCanvas: HTMLCanvasElement,
  hurtTimer: number,
  isAttacking: boolean,
  timeSec: number
): void {
  const ctx = targetCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cw = targetCanvas.width;
  const ch = targetCanvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (!sheets.bombloong) return;

  const poseIdx = hurtTimer > 0 ? 2 : isAttacking ? 1 : 0;
  const phase = Math.floor(timeSec * (hurtTimer > 0 ? 12 : 4)) % 2;
  const frameIdx = poseIdx * 2 + phase;
  const shakeX = hurtTimer > 0 ? (Math.floor(timeSec * 40) % 2 === 0 ? -3 : 3) : 0;

  ctx.drawImage(sheets.bombloong, frameIdx * 88, 0, 88, 88, shakeX, 0, cw, ch);
}

/**
 * Renders the 80x80 3D-SDF sculpted Pixel Xiao Qi helper (ahoge hair + coral-orange tee!)
 */
export function renderXiaoQiHelper(
  targetCanvas: HTMLCanvasElement,
  cheering: boolean,
  timeSec: number
): void {
  const ctx = targetCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cw = targetCanvas.width;
  const ch = targetCanvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (!sheets.xiaoqi) return;

  const poseIdx = cheering ? 1 : 0;
  const phase = Math.floor(timeSec * (cheering ? 6 : 2.2)) % 2;
  const frameIdx = poseIdx * 2 + phase;

  ctx.drawImage(sheets.xiaoqi, frameIdx * 80, 0, 80, 80, 0, 0, cw, ch);
}
