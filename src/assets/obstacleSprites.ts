/**
 * High-Detail 16-Bit Pixel Art Obstacle & Effect Renderers
 * - Wooden Snack Crates (Wood planks, wood grain, iron brackets, rivets, cracks, steel strapping)
 * - Interwoven Metal Chains (3D interlocked steel chain links, heavy brass padlock with shackle & keyhole)
 * - Crystalline Ice Blocks (Multi-faceted crystal prism, frost refraction, air bubbles, diamond sparkles)
 * - Hyper-Plasma Laser Beams (Multi-layered corona, plasma stream, incandescent white core, fusion bursts)
 */

/**
 * Draws a high-detail retro wooden snack crate.
 * @param hp 2 = pristine double-reinforced crate with steel strapping bands and silver studs
 *           1 = damaged single crate with realistic wood splinters and cracked fissures
 */
export function drawHighDetailCrate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hp: 1 | 2
): void {
  ctx.save();

  const pad = 3;
  const bx = x + pad;
  const by = y + pad;
  const bs = size - pad * 2;

  // 1. Outer Box Shadow & Dark Timber Framing
  ctx.fillStyle = '#1C130D';
  ctx.fillRect(bx, by, bs, bs);

  // Outer Wood Casing Bevel
  ctx.fillStyle = hp === 2 ? '#78350F' : '#92400E';
  ctx.fillRect(bx + 2, by + 2, bs - 4, bs - 4);

  // 2. Interior Horizontal Wood Planks (3 planks)
  const innerX = bx + 5;
  const innerY = by + 5;
  const innerS = bs - 10;
  const plankH = Math.floor(innerS / 3);

  for (let i = 0; i < 3; i++) {
    const py = innerY + i * plankH;
    const ph = i === 2 ? innerY + innerS - py : plankH - 2;

    // Plank base gradient
    const baseColor = hp === 2 ? '#B45309' : '#D97706';
    const darkColor = hp === 2 ? '#78350F' : '#B45309';
    const lightColor = hp === 2 ? '#D97706' : '#F59E0B';

    ctx.fillStyle = baseColor;
    ctx.fillRect(innerX, py, innerS, ph);

    // Plank top highlight line & bottom dark bevel
    ctx.fillStyle = lightColor;
    ctx.fillRect(innerX, py, innerS, 2);
    ctx.fillStyle = darkColor;
    ctx.fillRect(innerX, py + ph - 2, innerS, 2);

    // Wood grain texture streaks
    ctx.fillStyle = darkColor;
    ctx.fillRect(innerX + 6 + i * 4, py + 4, 14, 1);
    ctx.fillRect(innerX + 28 - i * 3, py + 7, 18, 1);
    ctx.fillRect(innerX + 12 + i * 5, py + 10, 10, 1);

    // Dark gap groove between planks
    if (i < 2) {
      ctx.fillStyle = '#1C130D';
      ctx.fillRect(innerX, py + ph, innerS, 2);
    }
  }

  // 3. Diagonal Cross Brace (X-brace framing on the front face)
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerS, innerS);
  ctx.clip();

  // Draw diagonal wood struts
  const strutW = 7;
  const strutColor = hp === 2 ? '#92400E' : '#B45309';
  const strutLight = hp === 2 ? '#D97706' : '#F59E0B';
  const strutDark = '#1C130D';

  // Primary diagonal (\)
  ctx.strokeStyle = strutDark;
  ctx.lineWidth = strutW + 2;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  ctx.lineTo(innerX + innerS, innerY + innerS);
  ctx.stroke();

  ctx.strokeStyle = strutColor;
  ctx.lineWidth = strutW;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  ctx.lineTo(innerX + innerS, innerY + innerS);
  ctx.stroke();

  ctx.strokeStyle = strutLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY - 2);
  ctx.lineTo(innerX + innerS - 2, innerY + innerS);
  ctx.stroke();

  // Secondary diagonal (/)
  ctx.strokeStyle = strutDark;
  ctx.lineWidth = strutW + 2;
  ctx.beginPath();
  ctx.moveTo(innerX + innerS, innerY);
  ctx.lineTo(innerX, innerY + innerS);
  ctx.stroke();

  ctx.strokeStyle = strutColor;
  ctx.lineWidth = strutW;
  ctx.beginPath();
  ctx.moveTo(innerX + innerS, innerY);
  ctx.lineTo(innerX, innerY + innerS);
  ctx.stroke();

  ctx.strokeStyle = strutLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX + innerS, innerY - 2);
  ctx.lineTo(innerX + 2, innerY + innerS);
  ctx.stroke();

  ctx.restore();

  // 4. HP Specific Detail:
  if (hp === 2) {
    // Heavy Riveted Steel Strapping Bands (Crosswise)
    const bandW = 8;
    const midX = bx + Math.floor(bs / 2);
    const midY = by + Math.floor(bs / 2);

    // Horizontal steel strap
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(bx + 2, midY - Math.floor(bandW / 2) - 1, bs - 4, bandW + 2);
    ctx.fillStyle = '#475569';
    ctx.fillRect(bx + 2, midY - Math.floor(bandW / 2), bs - 4, bandW);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(bx + 2, midY - Math.floor(bandW / 2), bs - 4, 2);

    // Vertical steel strap
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(midX - Math.floor(bandW / 2) - 1, by + 2, bandW + 2, bs - 4);
    ctx.fillStyle = '#475569';
    ctx.fillRect(midX - Math.floor(bandW / 2), by + 2, bandW, bs - 4);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(midX - Math.floor(bandW / 2), by + 2, 2, bs - 4);

    // Center Gold Boss / Star Seal
    ctx.fillStyle = '#1C130D';
    ctx.fillRect(midX - 7, midY - 7, 14, 14);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(midX - 5, midY - 5, 10, 10);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(midX - 2, midY - 2, 4, 4);

    // Silver studs / rivets on steel bands
    const rivet = (rx: number, ry: number) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(rx - 2, ry - 2, 4, 4);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(rx - 1, ry - 1, 2, 2);
    };
    rivet(midX, by + 8);
    rivet(midX, by + bs - 8);
    rivet(bx + 8, midY);
    rivet(bx + bs - 8, midY);
  } else {
    // HP = 1: Battle damage! Jagged fissures & splinter cracks
    ctx.strokeStyle = '#1C130D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + 12, by + 10);
    ctx.lineTo(bx + 22, by + 24);
    ctx.lineTo(bx + 18, by + 34);
    ctx.lineTo(bx + 28, by + 48);
    ctx.stroke();

    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 13, by + 10);
    ctx.lineTo(bx + 23, by + 24);
    ctx.lineTo(bx + 19, by + 34);
    ctx.stroke();

    // Secondary crack on right side
    ctx.strokeStyle = '#1C130D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + bs - 14, by + bs - 10);
    ctx.lineTo(bx + bs - 24, by + bs - 26);
    ctx.lineTo(bx + bs - 20, by + bs - 36);
    ctx.stroke();
  }

  // 5. Heavy Corner Iron Plates & Rivets in 4 corners
  const cornerSize = 10;
  const drawCornerPlate = (cx: number, cy: number, flipX: boolean, flipY: boolean) => {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(cx, cy, cornerSize, cornerSize);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(flipX ? cx : cx + 1, flipY ? cy : cy + 1, cornerSize - 1, cornerSize - 1);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(flipX ? cx + cornerSize - 3 : cx + 1, flipY ? cy + cornerSize - 3 : cy + 1, 2, 2);

    // Corner Rivet
    const rx = flipX ? cx + 3 : cx + cornerSize - 4;
    const ry = flipY ? cy + 3 : cy + cornerSize - 4;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(rx - 1, ry - 1, 3, 3);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(rx, ry, 1, 1);
  };

  drawCornerPlate(bx + 2, by + 2, false, false);
  drawCornerPlate(bx + bs - cornerSize - 2, by + 2, true, false);
  drawCornerPlate(bx + 2, by + bs - cornerSize - 2, false, true);
  drawCornerPlate(bx + bs - cornerSize - 2, by + bs - cornerSize - 2, true, true);

  ctx.restore();
}

/**
 * Draws high-detail 3D interlocked metal chains and a heavy brass padlock.
 */
export function drawHighDetailChain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  timeSec: number
): void {
  ctx.save();

  const cx = x + size / 2;
  const cy = y + size / 2;

  // Draw 4 diagonal chain link series from corners toward center
  const drawChainArm = (fromX: number, fromY: number, toX: number, toY: number) => {
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const lx = fromX + (toX - fromX) * t;
      const ly = fromY + (toY - fromY) * t;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const isFlat = i % 2 === 0;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);

      if (isFlat) {
        // Flat oval chain link (hollow ring)
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hollow inside link
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.8, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Top edge shiny glint
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-3, -3.5, 6, 1.5);
      } else {
        // Edge-on chain link
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-3.5, -5, 7, 10);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(-2, -3.5, 4, 7);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-1.5, -3.5, 3, 2);
      }
      ctx.restore();
    }
  };

  // 4 Arms
  drawChainArm(x + 5, y + 5, cx - 4, cy - 4);
  drawChainArm(x + size - 5, y + 5, cx + 4, cy - 4);
  drawChainArm(x + 5, y + size - 5, cx - 4, cy + 4);
  drawChainArm(x + size - 5, y + size - 5, cx + 4, cy + 4);

  // Center Heavy Brass Padlock
  const pw = 20;
  const ph = 18;
  const px = cx - pw / 2;
  const py = cy - ph / 2 + 2;

  // U-shaped hardened steel shackle
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, py - 2, 7, Math.PI, 0, false);
  ctx.stroke();

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, py - 2, 7, Math.PI, 0, false);
  ctx.stroke();

  // Shackle highlight
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py - 2, 8, Math.PI + 0.3, Math.PI + 1.2, false);
  ctx.stroke();

  // Solid Brass Lock Body
  ctx.fillStyle = '#1C130D';
  ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);

  ctx.fillStyle = '#D97706';
  ctx.fillRect(px, py, pw, ph);

  // Top and left gold bevel highlights
  ctx.fillStyle = '#FDE68A';
  ctx.fillRect(px, py, pw, 2);
  ctx.fillRect(px, py, 2, ph);

  // Bottom and right bronze shade
  ctx.fillStyle = '#78350F';
  ctx.fillRect(px, py + ph - 2, pw, 2);
  ctx.fillRect(px + pw - 2, py, 2, ph);

  // Keyhole
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(cx, py + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 1.2, py + 7, 2.4, 5);

  // Periodic glint sparkle across lock
  const glintPhase = (timeSec * 1.5) % 3;
  if (glintPhase < 0.4) {
    const gx = px + 3 + (glintPhase / 0.4) * (pw - 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(gx, py + 3, 2, 2);
    ctx.fillRect(gx - 1, py + 4, 4, 1);
  }

  ctx.restore();
}

/**
 * Draws a high-detail faceted crystalline ice block.
 * @param level 2 = deep glacial blue thick ice with internal fractures & frozen bubbles
 *              1 = crystal sky-blue single ice with multi-angle crystal facets & sparkles
 */
export function drawHighDetailIce(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  level: 1 | 2,
  timeSec: number
): void {
  ctx.save();

  const pad = 2;
  const ix = x + pad;
  const iy = y + pad;
  const is = size - pad * 2;

  // 1. Translucent Ice Crystal Body
  const baseFill = level === 2 ? 'rgba(2, 132, 199, 0.76)' : 'rgba(186, 230, 253, 0.74)';
  ctx.fillStyle = baseFill;
  ctx.fillRect(ix, iy, is, is);

  // 2. Chiseled Bevel Rims
  // Top & Left Frost highlight rim
  ctx.fillStyle = level === 2 ? 'rgba(186, 230, 253, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(ix, iy, is, 3);
  ctx.fillRect(ix, iy, 3, is);

  // Bottom & Right Deep refraction rim
  ctx.fillStyle = level === 2 ? 'rgba(3, 105, 161, 0.95)' : 'rgba(56, 189, 248, 0.95)';
  ctx.fillRect(ix, iy + is - 3, is, 3);
  ctx.fillRect(ix + is - 3, iy, 3, is);

  // 3. Internal Refraction Facets (Cut diamond geometry)
  ctx.strokeStyle = level === 2 ? 'rgba(224, 242, 254, 0.55)' : 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.8;

  // Diagonal crystal facet line
  ctx.beginPath();
  ctx.moveTo(ix + 6, iy + 6);
  ctx.lineTo(ix + is - 8, iy + is - 8);
  ctx.stroke();

  // Geometric facet triangle
  ctx.beginPath();
  ctx.moveTo(ix + is - 8, iy + 8);
  ctx.lineTo(ix + Math.floor(is * 0.65), iy + Math.floor(is * 0.45));
  ctx.lineTo(ix + is - 6, iy + is - 8);
  ctx.stroke();

  if (level === 2) {
    // Level 2 Thick Ice: Deep glacial cracks & trapped bubbles
    ctx.strokeStyle = 'rgba(240, 249, 255, 0.7)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ix + 12, iy + 8);
    ctx.lineTo(ix + 24, iy + 22);
    ctx.lineTo(ix + 18, iy + 36);
    ctx.lineTo(ix + 34, iy + is - 10);
    ctx.stroke();

    // Trapped air bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(ix + 16, iy + 14, 3, 3);
    ctx.fillRect(ix + 38, iy + 22, 4, 4);
    ctx.fillRect(ix + 24, iy + 42, 3, 3);
    ctx.fillRect(ix + 44, iy + 40, 2, 2);
  }

  // 4. Multi-point Diamond Crystal Glints (Shimmering Star Sparkles)
  const drawSparkle = (sx: number, sy: number, scale = 1) => {
    ctx.fillStyle = '#FFFFFF';
    const r = Math.round(3 * scale);
    ctx.fillRect(sx - r, sy, r * 2 + 1, 1);
    ctx.fillRect(sx, sy - r, 1, r * 2 + 1);
    ctx.fillRect(sx - 1, sy - 1, 3, 3);
  };

  const sparklePulse1 = 0.8 + 0.3 * Math.sin(timeSec * 7 + x * 0.1);
  const sparklePulse2 = 0.8 + 0.3 * Math.cos(timeSec * 6 + y * 0.1);

  drawSparkle(ix + 8, iy + 8, sparklePulse1);
  drawSparkle(ix + is - 12, iy + is - 12, sparklePulse2);

  ctx.restore();
}

/**
 * Draws a spectacular multi-layer high-energy hyper-plasma laser beam.
 * Layers: Outer Neon Corona Bloom -> Radiant Plasma Heat Stream -> Solar Yellow Flare -> Incandescent White-Hot Core -> Origin Lens Flare Starburst
 */
export function drawHighDetailLaser(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  boardPx: number,
  cellPx: number,
  kind: 'line_h' | 'line_v' | 'cross3',
  t: number,
  timeSec: number
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t * 0.8);

  const isCross = kind === 'cross3';
  const drawH = kind === 'line_h' || isCross;
  const drawV = kind === 'line_v' || isCross;

  // Pulse oscillation factor
  const pulse = 1 + 0.12 * Math.sin(timeSec * 28);
  const beamWidth = Math.max(12, Math.round((isCross ? 56 : 42) * (1 - t * 0.6) * pulse));

  // --- 1. Horizontal Plasma Beam ---
  if (drawH) {
    const yTop = oy - beamWidth / 2;

    // Layer 1: Outer Neon Corona Glow Bloom
    const gradH = ctx.createLinearGradient(0, yTop, 0, yTop + beamWidth);
    gradH.addColorStop(0, 'rgba(255, 61, 0, 0)');
    gradH.addColorStop(0.2, 'rgba(255, 87, 34, 0.45)');
    gradH.addColorStop(0.4, 'rgba(255, 145, 0, 0.85)');
    gradH.addColorStop(0.5, '#FFFFFF');
    gradH.addColorStop(0.6, 'rgba(255, 145, 0, 0.85)');
    gradH.addColorStop(0.8, 'rgba(255, 87, 34, 0.45)');
    gradH.addColorStop(1, 'rgba(255, 61, 0, 0)');

    ctx.fillStyle = gradH;
    ctx.fillRect(0, yTop, boardPx, beamWidth);

    // Layer 2: Ultra-Bright Solar Yellow Core
    const yellowH = Math.max(4, Math.round(beamWidth * 0.38));
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(0, oy - yellowH / 2, boardPx, yellowH);

    // Layer 3: Blinding White-Hot Incandescent Center Line
    const whiteH = Math.max(2, Math.round(beamWidth * 0.16));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, oy - whiteH / 2, boardPx, whiteH);

    // Layer 4: Speed Energy Stream Spark Nodes
    ctx.fillStyle = '#FFFDE7';
    for (let sx = 0; sx < boardPx; sx += 32) {
      const offset = (Math.floor(timeSec * 60) + sx) % boardPx;
      ctx.fillRect(offset, oy - 2, 10, 4);
    }
  }

  // --- 2. Vertical Plasma Beam ---
  if (drawV) {
    const xLeft = ox - beamWidth / 2;

    // Layer 1: Outer Neon Corona Glow Bloom
    const gradV = ctx.createLinearGradient(xLeft, 0, xLeft + beamWidth, 0);
    gradV.addColorStop(0, 'rgba(255, 61, 0, 0)');
    gradV.addColorStop(0.2, 'rgba(255, 87, 34, 0.45)');
    gradV.addColorStop(0.4, 'rgba(255, 145, 0, 0.85)');
    gradV.addColorStop(0.5, '#FFFFFF');
    gradV.addColorStop(0.6, 'rgba(255, 145, 0, 0.85)');
    gradV.addColorStop(0.8, 'rgba(255, 87, 34, 0.45)');
    gradV.addColorStop(1, 'rgba(255, 61, 0, 0)');

    ctx.fillStyle = gradV;
    ctx.fillRect(xLeft, 0, beamWidth, boardPx);

    // Layer 2: Ultra-Bright Solar Yellow Core
    const yellowW = Math.max(4, Math.round(beamWidth * 0.38));
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(ox - yellowW / 2, 0, yellowW, boardPx);

    // Layer 3: Blinding White-Hot Incandescent Center Line
    const whiteW = Math.max(2, Math.round(beamWidth * 0.16));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ox - whiteW / 2, 0, whiteW, boardPx);

    // Layer 4: Speed Energy Stream Spark Nodes
    ctx.fillStyle = '#FFFDE7';
    for (let sy = 0; sy < boardPx; sy += 32) {
      const offset = (Math.floor(timeSec * 60) + sy) % boardPx;
      ctx.fillRect(ox - 2, offset, 4, 10);
    }
  }

  // --- 3. Origin Lens Flare & Nuclear Fusion Starburst ---
  const burstR = Math.max(16, Math.round(cellPx * (isCross ? 1.6 : 1.2) * (1 - t * 0.5)));

  // Radial shockwave glow
  const burstGrad = ctx.createRadialGradient(ox, oy, 2, ox, oy, burstR);
  burstGrad.addColorStop(0, '#FFFFFF');
  burstGrad.addColorStop(0.3, '#FEF08A');
  burstGrad.addColorStop(0.6, '#FF7043');
  burstGrad.addColorStop(1, 'rgba(255, 61, 0, 0)');

  ctx.fillStyle = burstGrad;
  ctx.beginPath();
  ctx.arc(ox, oy, burstR, 0, Math.PI * 2);
  ctx.fill();

  // 8-Point Diffraction Spikes
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  const spikeLen = Math.round(burstR * 1.5);
  ctx.beginPath();
  ctx.moveTo(ox - spikeLen, oy);
  ctx.lineTo(ox + spikeLen, oy);
  ctx.moveTo(ox, oy - spikeLen);
  ctx.lineTo(ox, oy + spikeLen);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  const diagSpike = Math.round(spikeLen * 0.7);
  ctx.beginPath();
  ctx.moveTo(ox - diagSpike, oy - diagSpike);
  ctx.lineTo(ox + diagSpike, oy + diagSpike);
  ctx.moveTo(ox + diagSpike, oy - diagSpike);
  ctx.lineTo(ox - diagSpike, oy + diagSpike);
  ctx.stroke();

  // Expanding shockwave ripple ring
  const ringR = Math.round(burstR * (0.8 + t * 1.4));
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = Math.max(1, 4 * (1 - t));
  ctx.beginPath();
  ctx.arc(ox, oy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a high-detail 16-bit retro arcade bomb explosion.
 * @param kind 'bomb3' (3x3 fiery blast), 'bomb5' (5x5 mega nuclear combo), or 'belly_slam' (bouncy golden cosmic slam)
 * @param t Progress from 0 (instant detonation) to 1 (fully dissipated)
 */
export function drawHighDetailBombExplosion(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cellPx: number,
  kind: 'bomb3' | 'bomb5' | 'belly_slam',
  t: number,
  timeSec: number
): void {
  ctx.save();

  const isBelly = kind === 'belly_slam';
  const isMega = kind === 'bomb5';
  const maxR = isMega ? cellPx * 3.6 : isBelly ? cellPx * 3.2 : cellPx * 2.1;

  // Explosive expansion curve: violent early explosion that decelerates
  const expandEased = 1 - Math.pow(1 - t, 3);
  const currentR = Math.max(8, maxR * expandEased);
  const alpha = Math.max(0, 1 - Math.pow(t, 1.4));

  // --- 1. Outer Shockwave Rings (Expanding high-energy compression wavefronts) ---
  ctx.save();
  const ringCount = isMega ? 2 : 1;
  for (let rIdx = 0; rIdx < ringCount; rIdx++) {
    const ringT = Math.min(1, t * (1 + rIdx * 0.28));
    const ringRad = maxR * (0.2 + ringT * 0.95);
    const ringWidth = Math.max(2, (isMega ? 11 : 7) * (1 - ringT));
    const ringAlpha = Math.max(0, (1 - ringT) * 0.9);

    ctx.strokeStyle = isBelly
      ? `rgba(254, 240, 138, ${ringAlpha})`
      : rIdx === 0
      ? `rgba(255, 235, 59, ${ringAlpha})`
      : `rgba(255, 87, 34, ${ringAlpha})`;
    ctx.lineWidth = ringWidth;

    ctx.beginPath();
    ctx.arc(ox, oy, ringRad, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary inner dashed ripple
    ctx.strokeStyle = isBelly ? '#FFFFFF' : '#FF7043';
    ctx.lineWidth = Math.max(1, ringWidth * 0.45);
    ctx.beginPath();
    ctx.arc(ox, oy, ringRad * 0.86, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // --- 2. Multi-Lobe Fireball / Plasma Cloud Body ---
  // A churning cluster of 8-12 expanding fireball lobes with sin/cos perturbation
  const lobeCount = isMega ? 12 : 8;
  const lobeBaseRad = currentR * 0.58;

  for (let i = 0; i < lobeCount; i++) {
    const angle = (i * Math.PI * 2) / lobeCount + (isMega ? 0.2 : 0);
    const distScale = 0.65 + 0.35 * Math.sin(i * 3 + timeSec * 15);
    const lobeDist = currentR * 0.5 * distScale * (0.4 + expandEased * 0.6);
    const lx = ox + Math.cos(angle) * lobeDist;
    const ly = oy + Math.sin(angle) * lobeDist;
    const lRadius = Math.max(6, lobeBaseRad * (1 - t * 0.45));

    // Outer flame lobe layer
    const lobeGrad = ctx.createRadialGradient(lx, ly, 1, lx, ly, lRadius);
    if (isBelly) {
      lobeGrad.addColorStop(0, '#FFFFFF');
      lobeGrad.addColorStop(0.3, '#FDE047');
      lobeGrad.addColorStop(0.7, '#F59E0B');
      lobeGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    } else {
      lobeGrad.addColorStop(0, '#FFFBEB');
      lobeGrad.addColorStop(0.25, '#FEF08A');
      lobeGrad.addColorStop(0.55, isMega ? '#FF3D00' : '#F97316');
      lobeGrad.addColorStop(0.85, isMega ? '#991B1B' : '#DC2626');
      lobeGrad.addColorStop(1, 'rgba(124, 45, 18, 0)');
    }

    ctx.fillStyle = lobeGrad;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(lx, ly, lRadius, 0, Math.PI * 2);
    ctx.fill();

    // Dark smoke puffs in late stage (t > 0.4)
    if (t > 0.4 && !isBelly) {
      const smokeR = lRadius * 0.65 * (t - 0.4) * 1.6;
      ctx.fillStyle = 'rgba(43, 30, 22, 0.45)';
      ctx.beginPath();
      ctx.arc(lx + 4, ly - 4, smokeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 3. Central Blazing Core Plasma ---
  if (t < 0.65) {
    const coreAlpha = Math.max(0, 1 - t / 0.65);
    const coreR = Math.max(8, currentR * 0.48 * (1 - t * 0.5));

    const coreGrad = ctx.createRadialGradient(ox, oy, 1, ox, oy, coreR);
    coreGrad.addColorStop(0, '#FFFFFF');
    coreGrad.addColorStop(0.4, isBelly ? '#FEF08A' : '#FFF59D');
    coreGrad.addColorStop(0.8, isBelly ? '#F59E0B' : '#FF6B00');
    coreGrad.addColorStop(1, 'rgba(255, 61, 0, 0)');

    ctx.globalAlpha = coreAlpha;
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // 8-Point Diffraction Spikes from core
    const spikeLen = Math.round(coreR * (isMega ? 2.2 : 1.7));
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1, 4 * (1 - t / 0.65));

    ctx.beginPath();
    ctx.moveTo(ox - spikeLen, oy);
    ctx.lineTo(ox + spikeLen, oy);
    ctx.moveTo(ox, oy - spikeLen);
    ctx.lineTo(ox, oy + spikeLen);
    ctx.stroke();

    ctx.lineWidth = Math.max(1, 2 * (1 - t / 0.65));
    const diagSpike = Math.round(spikeLen * 0.7);
    ctx.beginPath();
    ctx.moveTo(ox - diagSpike, oy - diagSpike);
    ctx.lineTo(ox + diagSpike, oy + diagSpike);
    ctx.moveTo(ox + diagSpike, oy - diagSpike);
    ctx.lineTo(ox - diagSpike, oy + diagSpike);
    ctx.stroke();
  }

  // --- 4. High-Velocity Flying Shrapnel Sparks & Comic Star Embers ---
  const sparkCount = isMega ? 24 : isBelly ? 18 : 14;
  for (let s = 0; s < sparkCount; s++) {
    const sAngle = s * 2.39996 + (s % 3) * 0.2;
    const sSpeed = (isMega ? 1.4 : 1.1) * (0.8 + (s % 5) * 0.15);
    const sDist = maxR * expandEased * sSpeed;
    const sx = ox + Math.cos(sAngle) * sDist;
    const sy = oy + Math.sin(sAngle) * sDist;

    const sSize = Math.max(2, Math.round((isMega ? 7 : 5) * (1 - t)));
    const sparkAlpha = Math.max(0, 1 - t * 1.1);
    ctx.globalAlpha = sparkAlpha;

    ctx.fillStyle =
      s % 4 === 0
        ? '#FFFFFF'
        : s % 4 === 1
        ? '#FEF08A'
        : isBelly
        ? '#F59E0B'
        : s % 4 === 2
        ? '#FF7043'
        : '#FF1744';

    ctx.fillRect(Math.round(sx - sSize / 2), Math.round(sy - sSize / 2), sSize, sSize);

    if (sSize >= 3) {
      const trailDx = Math.cos(sAngle) * (sSize * 1.6);
      const trailDy = Math.sin(sAngle) * (sSize * 1.6);
      ctx.fillStyle = isBelly ? '#FDE047' : '#F97316';
      ctx.fillRect(Math.round(sx - trailDx), Math.round(sy - trailDy), sSize * 0.6, sSize * 0.6);
    }
  }

  ctx.restore();
}
