import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoardEngine } from '../src/match3/BoardEngine';
import { CAMPAIGN_LEVELS } from '../src/levels/campaignLevels';
import { TileColor } from '../src/match3/types';
import { MatchAudio, NAILONG_VOICE_CLIPS } from '../src/audio/MatchAudio';

function makeSeededRng(seed = 12345): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function setRowColors(engine: BoardEngine, row: number, colors: TileColor[]): void {
  colors.forEach((color, col) => {
    engine.grid[row][col].hole = false;
    engine.grid[row][col].crateHp = 0;
    engine.grid[row][col].chain = false;
    engine.grid[row][col].tile = {
      id: 1000 + row * 10 + col,
      color,
      special: 'none',
    };
  });
}

describe('High-Detail Pixel Models & Reference Stickers Pipeline', () => {
  it('generates valid 96x96 retro PNG stickers (including 123.jpeg drooling Nailong & remodeled Minions) and manifest', () => {
    const manifestPath = path.resolve('public/assets/stickers/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.stickers.length).toBeGreaterThanOrEqual(9);

    const happySticker = manifest.stickers.find((s: { id: string }) => s.id === 'nailong_happy');
    expect(happySticker).toBeDefined();
    expect(happySticker.desc).toContain('流口水');

    const minionTwin = manifest.stickers.find((s: { id: string }) => s.id === 'minion_twin');
    const minionOne = manifest.stickers.find((s: { id: string }) => s.id === 'minion_one');
    expect(minionTwin).toBeDefined();
    expect(minionOne).toBeDefined();

    for (const sticker of manifest.stickers) {
      const pngPath = path.resolve('public', sticker.url.replace(/^\//, ''));
      expect(fs.existsSync(pngPath)).toBe(true);
      const buf = fs.readFileSync(pngPath);
      // Verify PNG signature and 96x96 IHDR dimensions
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf.readUInt32BE(16)).toBe(96);
      expect(buf.readUInt32BE(20)).toBe(96);
      expect(sticker.opaqueRatio).toBeGreaterThan(0.15);
    }
  });

  it('generates high-precision 3D-SDF sprite sheets for Nailong, Bombloong, Xiao Qi, and board tiles', () => {
    const expectedSheets = [
      { file: 'public/assets/models/nailong_sheet.png', width: 1152, height: 96 },
      { file: 'public/assets/models/bombloong_sheet.png', width: 528, height: 88 },
      { file: 'public/assets/models/xiaoqi_sheet.png', width: 320, height: 80 },
      { file: 'public/assets/models/tiles_sheet.png', width: 672, height: 48 },
    ];

    for (const spec of expectedSheets) {
      const fullPath = path.resolve(spec.file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf.readUInt32BE(16)).toBe(spec.width);
      expect(buf.readUInt32BE(20)).toBe(spec.height);
    }

    // Verify standalone 48x48 HUD & Goal legend icons exist (fixes mobile DPR/responsive sprite shift)
    for (const kind of ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry', 'milktea', 'rainbow']) {
      const iconPath = path.resolve(`public/assets/models/tile_${kind}.png`);
      expect(fs.existsSync(iconPath)).toBe(true);
      const buf = fs.readFileSync(iconPath);
      expect(buf.readUInt32BE(16)).toBe(48);
      expect(buf.readUInt32BE(20)).toBe(48);
    }

    // Verify 320x200 16-bit pixel scenic backgrounds for all 3 chapters
    for (const chapId of [1, 2, 3]) {
      const bgPath = path.resolve(`public/assets/models/bg_chapter_${chapId}.png`);
      expect(fs.existsSync(bgPath)).toBe(true);
      const buf = fs.readFileSync(bgPath);
      expect(buf.readUInt32BE(16)).toBe(320);
      expect(buf.readUInt32BE(20)).toBe(200);
    }
  });

  it('configures server-side global Endless leaderboard on Cloudflare (SQLite Durable Object + Pages API)', async () => {
    const wranglerRaw = fs.readFileSync(path.resolve('wrangler.jsonc'), 'utf-8');
    const wranglerCfg = JSON.parse(wranglerRaw);
    expect(wranglerCfg.main).toBe('worker/index.mjs');
    expect(wranglerCfg.assets.run_worker_first).toContain('/api/*');
    expect(wranglerCfg.migrations[0].new_sqlite_classes).toContain('LeaderboardDO');
    expect(fs.existsSync(path.resolve('worker/index.mjs'))).toBe(true);

    // Smoke-test the Pages API handler logic (POST high score + GET global topScore & ranking)
    // @ts-expect-error JS module without d.ts
    const { onRequest } = await import('../functions/api/leaderboard.js');
    const postReq = new Request('https://example.com/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'nl_testplayer01', nickname: '奶龙干饭王', score: 12800 }),
    });
    const postRes = await onRequest({ request: postReq, env: {} });
    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    expect(postData.topScore).toBeGreaterThanOrEqual(12800);
    expect(postData.championName).toBe('奶龙干饭王');
    expect(postData.playerRank).toBe(1);
  });

  it('includes all 3 extracted Nailong voice audio assets, removes source .mov files, and alternates clips on playNailongVoice()', () => {
    expect(NAILONG_VOICE_CLIPS.length).toBe(3);
    for (const clipMeta of NAILONG_VOICE_CLIPS) {
      const voicePath = path.resolve('public', clipMeta.url.replace(/^\//, ''));
      expect(fs.existsSync(voicePath)).toBe(true);
      const buf = fs.readFileSync(voicePath);
      expect(buf.length).toBeGreaterThan(10000);
      const isId3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
      const isMpegSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
      expect(isId3 || isMpegSync).toBe(true);
    }

    // Verify source .mov video files in project root have been cleaned up
    const rootMovs = fs.readdirSync(path.resolve('.')).filter((f) => f.endsWith('.mov'));
    expect(rootMovs).toEqual([]);

    // Verify strict alternating round-robin playback order across all 3 clips
    const audio = new MatchAudio();
    const first = audio.playNailongVoice();
    const second = audio.playNailongVoice();
    const third = audio.playNailongVoice();
    const fourth = audio.playNailongVoice();
    expect(first.url).toBe('/assets/audio/nailong_voice.mp3');
    expect(second.url).toBe('/assets/audio/nailong_belly_voice.mp3');
    expect(third.url).toBe('/assets/audio/nailong_full_voice.mp3');
    expect(fourth.url).toBe('/assets/audio/nailong_voice.mp3');
  });
});

describe('BoardEngine Match-3 Core Mechanics', () => {
  it('initializes all 30 campaign levels across 3 chapters with playable moves and valid cells', () => {
    expect(CAMPAIGN_LEVELS.length).toBe(30);
    CAMPAIGN_LEVELS.forEach((level, idx) => {
      expect(level.id).toBe(idx + 1);
      expect(level.layout?.length).toBe(level.rows);
      for (const line of level.layout ?? []) {
        expect(line.length).toBe(level.cols);
      }
      const engine = new BoardEngine(level, makeSeededRng(level.id * 97));
      expect(engine.findValidMoves().length).toBeGreaterThan(0);
    });
  });

  it('guarantees every task goal in all campaign levels exists in the matchable tile palette and board layout', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const engine = new BoardEngine(level, makeSeededRng(level.id * 313));

      let totalIce = 0;
      let totalCrates = 0;
      let totalChains = 0;
      const colorCounts = new Map<TileColor, number>();

      for (const row of engine.grid) {
        for (const cell of row) {
          totalIce += cell.iceLevel;
          if (cell.crateHp > 0) totalCrates += 1;
          if (cell.chain) totalChains += 1;
          if (cell.tile) {
            colorCounts.set(cell.tile.color, (colorCounts.get(cell.tile.color) ?? 0) + 1);
          }
        }
      }

      for (const goal of level.goals) {
        if (goal.type === 'collect') {
          expect(goal.color).toBeDefined();
          expect(engine.palette).toContain(goal.color);
          expect(colorCounts.get(goal.color!) ?? 0).toBeGreaterThanOrEqual(3);
        } else if (goal.type === 'ice') {
          expect(totalIce).toBe(goal.target);
          expect(totalIce).toBeGreaterThan(0);
        } else if (goal.type === 'crate') {
          expect(totalCrates).toBe(goal.target);
          expect(totalCrates).toBeGreaterThan(0);
        } else if (goal.type === 'chain') {
          expect(totalChains).toBe(goal.target);
          expect(totalChains).toBeGreaterThan(0);
        } else if (goal.type === 'boss') {
          expect(level.bossMaxHp).toBe(goal.target);
          expect(level.bossMaxHp).toBeGreaterThan(0);
        }
      }
    }

    // Specifically verify Level 2 includes milktea & strawberry even if colors array were omitted
    const lv2WithoutExplicitColors = { ...CAMPAIGN_LEVELS[1], colors: undefined };
    const lv2Engine = new BoardEngine(lv2WithoutExplicitColors, makeSeededRng(2026));
    expect(lv2Engine.palette).toContain('milktea');
    expect(lv2Engine.palette).toContain('strawberry');
  });

  it('rejects invalid swaps that do not create a match and keeps board unchanged', () => {
    const engine = new BoardEngine(CAMPAIGN_LEVELS[0], makeSeededRng(42));
    // Fill entire board with a match-free 3-color cycle so no background matches exist
    const cycle: TileColor[] = ['nailong', 'bombloong', 'minion'];
    for (let r = 0; r < engine.rows; r++) {
      const rowColors: TileColor[] = [];
      for (let c = 0; c < engine.cols; c++) {
        rowColors.push(cycle[(r * 2 + c) % 3]);
      }
      setRowColors(engine, r, rowColors);
    }

    const c0 = engine.grid[0][0].tile!.color;
    const c1 = engine.grid[0][1].tile!.color;
    const res = engine.trySwap({ row: 0, col: 0 }, { row: 0, col: 1 });
    expect(res.valid).toBe(false);
    expect(res.consumedMove).toBe(false);
    expect(engine.grid[0][0].tile?.color).toBe(c0);
    expect(engine.grid[0][1].tile?.color).toBe(c1);
  });

  it('synthesizes a 4-match striped flame tile and a 5-match Rainbow Nailong', () => {
    const engine = new BoardEngine(CAMPAIGN_LEVELS[0], makeSeededRng(77));
    // Prepare a 4-match horizontal when swapping (0,3) <-> (1,3)
    setRowColors(engine, 0, ['nailong', 'nailong', 'nailong', 'bombloong', 'minion', 'drumstick', 'strawberry', 'minion']);
    setRowColors(engine, 1, ['minion', 'drumstick', 'strawberry', 'nailong', 'bombloong', 'minion', 'drumstick', 'strawberry']);

    const res4 = engine.trySwap({ row: 1, col: 3 }, { row: 0, col: 3 });
    expect(res4.valid).toBe(true);
    expect(res4.steps[0].spawnedSpecials.length).toBeGreaterThanOrEqual(1);
    expect(['line_h', 'line_v']).toContain(res4.steps[0].spawnedSpecials[0].tile.special);

    // Prepare a 5-match horizontal -> Rainbow Nailong!
    const engine5 = new BoardEngine(CAMPAIGN_LEVELS[0], makeSeededRng(88));
    setRowColors(engine5, 0, ['drumstick', 'drumstick', 'bombloong', 'drumstick', 'drumstick', 'minion', 'strawberry', 'nailong']);
    setRowColors(engine5, 1, ['minion', 'strawberry', 'drumstick', 'nailong', 'bombloong', 'drumstick', 'minion', 'strawberry']);

    const res5 = engine5.trySwap({ row: 1, col: 2 }, { row: 0, col: 2 });
    expect(res5.valid).toBe(true);
    expect(res5.steps[0].spawnedSpecials.some((s) => s.tile.special === 'rainbow')).toBe(true);
  });

  it('executes Dual-Special Rainbow + Rainbow full-board clear and cracks obstacles', () => {
    const engine = new BoardEngine(CAMPAIGN_LEVELS[2], makeSeededRng(99));
    engine.grid[3][3].tile = { id: 9001, color: 'nailong', special: 'rainbow' };
    engine.grid[3][4].tile = { id: 9002, color: 'bombloong', special: 'rainbow' };

    const res = engine.trySwap({ row: 3, col: 3 }, { row: 3, col: 4 });
    expect(res.valid).toBe(true);
    expect(res.steps[0].blasts.some((b) => b.kind === 'rainbow_all')).toBe(true);
    expect(res.steps[0].iceBroken).toBeGreaterThanOrEqual(16); // Cracks at least 1 layer across all 16 ice cells on Level 3!
  });

  it('cracks adjacent wooden crates, breaks chains, and supports Belly Slam skill', () => {
    const engine = new BoardEngine(CAMPAIGN_LEVELS[5], makeSeededRng(105));
    // Place a 1-HP crate at (0,4) next to a 3-match at (0,1..3)
    engine.grid[0][4].crateHp = 1;
    engine.grid[0][4].tile = null;
    setRowColors(engine, 0, ['minion', 'nailong', 'nailong', 'bombloong', 'minion', 'drumstick', 'strawberry', 'minion']);
    engine.grid[0][4].crateHp = 1;
    engine.grid[0][4].tile = null;
    setRowColors(engine, 1, ['drumstick', 'strawberry', 'minion', 'nailong', 'bombloong', 'minion', 'drumstick', 'strawberry']);

    const swapRes = engine.trySwap({ row: 1, col: 3 }, { row: 0, col: 3 });
    expect(swapRes.valid).toBe(true);
    expect(swapRes.steps[0].cratesBroken).toBeGreaterThanOrEqual(1);

    // Belly Slam does not consume a move and spawns 2 bonus specials
    const slamRes = engine.useBellySlam();
    expect(slamRes.valid).toBe(true);
    expect(slamRes.consumedMove).toBe(false);
    expect(slamRes.steps[0].spawnedSpecials.length).toBe(2);
  });

  it('automatically detects a dead board with zero valid moves and shuffles to guarantee playable moves', () => {
    const engine = new BoardEngine(CAMPAIGN_LEVELS[0], makeSeededRng(321));
    // Construct a dead board where every cell is locked in a strict 5-color Latin-like shift so 0 moves exist
    const colors: TileColor[] = ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry'];
    for (let r = 0; r < engine.rows; r++) {
      for (let c = 0; c < engine.cols; c++) {
        engine.grid[r][c].hole = false;
        engine.grid[r][c].crateHp = 0;
        // Checkerboard chains so no two orthogonally adjacent cells are movable simultaneously
        engine.grid[r][c].chain = (r + c) % 2 === 1;
        engine.grid[r][c].tile = {
          id: 5000 + r * 10 + c,
          color: colors[(r * 2 + c) % colors.length],
          special: 'none',
        };
      }
    }

    expect(engine.findValidMoves().length).toBe(0);
    const shuffled = engine.ensurePlayableBoard();
    expect(shuffled).toBe(true);
    expect(engine.findValidMoves().length).toBeGreaterThan(0);
  });
});
