import {
  fetchGlobalLeaderboard,
  LeaderboardState,
  submitEndlessScore,
} from '../api/leaderboard';
import { MatchAudio } from '../audio/MatchAudio';
import {
  COLOR_META,
  drawSpecialBadge,
  getRainbowNailongSprite,
  getTileSprite,
  NailongPose,
  renderBombloongBoss,
  renderNailongMascot,
  renderXiaoQiHelper,
} from '../assets/pixelSprites';
import {
  drawHighDetailBombExplosion,
  drawHighDetailChain,
  drawHighDetailCrate,
  drawHighDetailIce,
  drawHighDetailLaser,
} from '../assets/obstacleSprites';
import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_LEVELS,
  createDefaultBoosters,
  ENDLESS_LEVEL,
  getChapterStars,
  isChapterUnlocked,
  isLevelUnlocked,
  loadProgress,
  REQUIRED_CHAPTER_STARS,
  saveProgress,
  SaveProgress,
} from '../levels/campaignLevels';
import { BoardEngine } from '../match3/BoardEngine';
import {
  BlastEffectEvent,
  BoosterType,
  CascadeStep,
  CellState,
  Coord,
  FallMove,
  LevelConfig,
  LevelGoal,
  TileColor,
} from '../match3/types';

interface StickerEntry {
  id: string;
  desc: string;
  origin: string;
  url: string;
}

interface PixelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface FlyingSnack {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: TileColor;
  t: number;
}

interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface ActiveBlastVisual {
  event: BlastEffectEvent;
  timer: number;
  duration: number;
}

const CELL_PX = 64;
const BOARD_PX = CELL_PX * 8; // 512x512 crisp high-detail pixel grid

export class GameApp {
  private root: HTMLElement;
  private audio = new MatchAudio();
  private progress: SaveProgress = loadProgress();
  private stickers: StickerEntry[] = [];

  private screen: 'title' | 'map' | 'play' = 'title';
  private activeModal: 'none' | 'stickers' | 'rules' | 'leaderboard' | 'win' | 'lose' = 'none';
  private selectedChapter = 1;
  private leaderboard: LeaderboardState | null = null;
  private isSyncingScore = false;
  private nickSavedToast = '';

  // Gameplay state
  private currentLevel: LevelConfig = CAMPAIGN_LEVELS[0];
  private isEndless = false;
  private endlessBoosters: Record<BoosterType, number> = createDefaultBoosters();
  private endlessNextMilestone = 3000;
  private endlessStepGap = 3000;
  private endlessTier = 0;
  private usedContinue = false;
  private engine!: BoardEngine;
  private renderGrid: CellState[][] = [];

  private score = 0;
  private movesLeft = 20;
  private movesUsed = 0;
  private lastMovesBonus = 0;
  private bellyEnergy = 0; // 0..100
  private bossHp = 0;
  private bossHurtTimer = 0;
  private bossAttackTimer = 0;
  private xiaoqiCheerTimer = 0;
  private goals: LevelGoal[] = [];

  private selectedCell: Coord | null = null;
  private activeBooster: 'hammer' | 'swap_glove' | null = null;
  private isAnimating = false;
  private lastActionTime = performance.now();
  private hintPair: [Coord, Coord] | null = null;

  // Animation state
  private swapAnim: {
    a: Coord;
    b: Coord;
    progress: number;
  } | null = null;
  private activeFalls: Map<string, { fall: FallMove; progress: number }> = new Map();
  private clearingSet: Set<string> = new Set();
  private clearPopProgress = 0;
  private shuffleAnimProgress = 0;

  private particles: PixelParticle[] = [];
  private flyingSnacks: FlyingSnack[] = [];
  private floatingScores: FloatingScore[] = [];
  private activeBlasts: ActiveBlastVisual[] = [];
  private boardShake = 0;

  private nailongPose: NailongPose = 'idle';
  private poseTimer = 0;
  private speechText = '欢迎来到奶龙消消乐！快喂饱我的大肚肚吧！';
  private comboBanner: { text: string; sub: string; stickerUrl: string; timer: number } | null = null;
  private earnedStars = 0;

  // Pointer drag tracking
  private dragStartCell: Coord | null = null;
  private dragStartPt: { x: number; y: number } | null = null;

  // Live DOM canvases
  private titleMascotCanvas: HTMLCanvasElement | null = null;
  private playMascotCanvas: HTMLCanvasElement | null = null;
  private bossCanvas: HTMLCanvasElement | null = null;
  private xiaoqiCanvas: HTMLCanvasElement | null = null;
  private boardCanvas: HTMLCanvasElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.selectedChapter = this.getFurthestUnlockedChapter();

    // Lock full-screen viewport against mobile pull-to-refresh / vertical rubber-banding
    // while allowing scrollable containers (like leaderboard list, modal cards, sticker gallery) to scroll
    document.addEventListener(
      'touchmove',
      (ev) => {
        let el = ev.target as HTMLElement | null;
        while (el && el !== document.body && el !== document.documentElement) {
          if (el.scrollHeight > el.clientHeight) {
            const overflowY = window.getComputedStyle(el).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
              return; // Allow touch scrolling inside any scrollable container
            }
          }
          el = el.parentElement;
        }
        ev.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener('pointerup', () => {
      this.dragStartCell = null;
      this.dragStartPt = null;
    });

    // Delegated click handler so any Nailong sticker marked with data-nailong-voice plays Nailong's alternating voice clips
    this.root.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest('[data-nailong-voice]')) {
        this.audio.unlock();
        const clip = this.audio.playNailongVoice();
        this.nailongPose = 'pat_belly';
        this.poseTimer = clip.durationMs / 1000;
        const titleLbl = document.getElementById('title-voice-label');
        if (titleLbl) titleLbl.textContent = `🔊 ${clip.subtitle}`;
      }
    });

    this.loadStickerManifest();
    this.refreshGlobalLeaderboard();
    this.renderUI();
    requestAnimationFrame((ts) => this.tick(ts));
  }

  private escapeHtml(raw: string): string {
    return String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async refreshGlobalLeaderboard(): Promise<void> {
    const state = await fetchGlobalLeaderboard(this.progress.playerId);
    if (state) {
      this.leaderboard = state;
      if (this.screen === 'title' || this.activeModal === 'leaderboard' || this.activeModal === 'lose') {
        this.renderUI();
      } else if (this.screen === 'play' && this.isEndless) {
        this.updateHudDom();
      }
    }
  }

  private async syncEndlessScoreToServer(scoreToSync: number): Promise<void> {
    const best = Math.max(this.progress.endlessBestScore, scoreToSync);
    if (best <= 0) return;
    this.isSyncingScore = true;
    const state = await submitEndlessScore(
      this.progress.playerId,
      this.progress.playerNickname,
      best
    );
    this.isSyncingScore = false;
    if (state) {
      this.leaderboard = state;
      if (this.activeModal === 'leaderboard' || this.activeModal === 'lose' || this.screen === 'title') {
        this.renderUI();
      } else if (this.screen === 'play' && this.isEndless) {
        this.updateHudDom();
      }
    }
  }

  private async loadStickerManifest(): Promise<void> {
    try {
      const res = await fetch('/assets/stickers/manifest.json');
      if (res.ok) {
        const data = await res.json();
        this.stickers = data.stickers ?? [];
        this.renderUI();
      }
    } catch {
      // fallback empty
    }
  }

  private getFurthestUnlockedChapter(): number {
    for (let c = CAMPAIGN_CHAPTERS.length; c >= 1; c--) {
      if (isChapterUnlocked(this.progress.unlockedLevel, this.progress.levelStars, c)) {
        return c;
      }
    }
    return 1;
  }

  private getStickerUrl(id: string): string {
    const found = this.stickers.find((s) => s.id === id);
    return found ? found.url : '/assets/stickers/nailong_happy.png';
  }

  private startLevel(level: LevelConfig, endless = false): void {
    this.audio.unlock();
    this.currentLevel = level;
    this.isEndless = endless;
    if (!endless) {
      this.selectedChapter = Math.min(CAMPAIGN_CHAPTERS.length, Math.max(1, Math.ceil(level.id / 10)));
    } else {
      this.endlessBoosters = createDefaultBoosters();
      this.refreshGlobalLeaderboard();
    }
    this.endlessNextMilestone = 3000;
    this.endlessStepGap = 3000;
    this.endlessTier = 0;
    this.usedContinue = false;
    this.engine = new BoardEngine(level);
    this.renderGrid = this.engine.cloneGrid();

    this.score = 0;
    this.movesLeft = level.moves;
    this.movesUsed = 0;
    this.lastMovesBonus = 0;
    this.bellyEnergy = 15;
    this.bossHp = level.bossMaxHp ?? 0;
    this.bossHurtTimer = 0;
    this.bossAttackTimer = 0;
    this.xiaoqiCheerTimer = 0;
    this.goals = level.goals.map((g) => ({ ...g, current: 0 }));

    this.selectedCell = null;
    this.activeBooster = null;
    this.isAnimating = false;
    this.particles = [];
    this.flyingSnacks = [];
    this.floatingScores = [];
    this.activeBlasts = [];
    this.comboBanner = null;
    this.activeModal = 'none';
    this.nailongPose = 'idle';
    this.speechText = level.subtitle;
    this.lastActionTime = performance.now();
    this.hintPair = null;

    this.screen = 'play';
    this.renderUI();
  }

  private getActiveBoosters(): Record<BoosterType, number> {
    if (this.isEndless) {
      return this.endlessBoosters;
    }
    const chap = this.selectedChapter || 1;
    if (!this.progress.chapterBoosters) {
      this.progress.chapterBoosters = {};
    }
    if (!this.progress.chapterBoosters[chap]) {
      this.progress.chapterBoosters[chap] = createDefaultBoosters();
    }
    return this.progress.chapterBoosters[chap];
  }

  private renderUI(): void {
    this.titleMascotCanvas = null;
    this.playMascotCanvas = null;
    this.bossCanvas = null;
    this.xiaoqiCanvas = null;
    this.boardCanvas = null;

    if (typeof document !== 'undefined' && document.body) {
      // Title screen & Endless mode use the player's furthest reached chapter background
      const reachedChap = this.getFurthestUnlockedChapter();
      const chapId =
        this.screen === 'title' || (this.screen === 'play' && this.isEndless)
          ? reachedChap
          : Math.min(3, Math.max(1, this.selectedChapter));
      document.body.className = `theme-chap-${chapId}`;
      document.documentElement.className = `theme-chap-${chapId}`;
    }

    if (this.screen === 'title') {
      this.renderTitleScreen();
    } else if (this.screen === 'map') {
      this.renderMapScreen();
    } else {
      this.renderPlayScreen();
    }

    if (this.activeModal !== 'none') {
      this.appendModal();
    }
  }

  private renderTitleScreen(): void {
    const happyUrl = this.getStickerUrl('nailong_happy');
    const bellyUrl = this.getStickerUrl('nailong_belly');

    this.root.innerHTML = `
      <div class="pixel-box title-screen">
        <div class="title-badge">★ 16-BIT PIXEL PUZZLE PARTY ★</div>
        <h1 class="game-logo">奶龙消消乐</h1>
        <div class="title-sub">大肚肚美食派对 · 收集烤鸡腿 · 弹飞暴暴龙！</div>

        <div class="title-hero-row">
          <div class="hero-sticker-card" data-nailong-voice="1" style="cursor:pointer;" title="点击听奶龙原声！">
            <img class="pixel-img" src="${happyUrl}" width="96" height="96" alt="奶龙流口水像素贴纸" />
            <div style="font-size:11px;font-weight:800;margin-top:4px;">馋得流口水</div>
          </div>

          <div id="title-mascot-box" style="cursor:pointer;" title="点击奶龙轮播原声语音！">
            <canvas id="title-mascot" width="192" height="192"></canvas>
            <div id="title-voice-label" style="font-size:12px;font-weight:900;color:#b45309;">▲ 点我轮播奶龙原声语音 ▲</div>
          </div>

          <div class="hero-sticker-card right" data-nailong-voice="1" style="cursor:pointer;" title="点击听奶龙原声！">
            <img class="pixel-img" src="${bellyUrl}" width="96" height="96" alt="奶龙歪头秀大肚肚贴纸" />
            <div style="font-size:11px;font-weight:800;margin-top:4px;">歪头秀大肚肚</div>
          </div>
        </div>

        <div class="title-actions">
          <button class="pixel-btn" id="btn-start-map" style="font-size:18px;padding:13px 20px;">
            ▶ 开始闯关大冒险 (${CAMPAIGN_LEVELS.length}关)
          </button>
          <button class="pixel-btn secondary" id="btn-start-endless" style="flex-direction:column;gap:2px;padding:9px 14px;">
            <span>🍗 无尽干饭王模式</span>
            <span style="font-size:11px;font-weight:800;color:#0f172a;">
              🌍 全服最高: ${this.leaderboard ? this.leaderboard.topScore : '...'} | 我的最高: ${this.progress.endlessBestScore}
            </span>
          </button>
          <div style="display:flex;gap:8px;">
            <button class="pixel-btn" id="btn-open-stickers" style="flex:1;font-size:13px;padding:9px 6px;background:#fde68a;">
              📒 图鉴
            </button>
            <button class="pixel-btn" id="btn-open-leaderboard" style="flex:1;font-size:13px;padding:9px 6px;background:#fed7aa;">
              🏆 全服榜
            </button>
            <button class="pixel-btn" id="btn-open-rules" style="flex:1;font-size:13px;padding:9px 6px;background:#e0e7ff;">
              ❓ 秘籍
            </button>
          </div>
        </div>
      </div>
    `;

    this.titleMascotCanvas = document.getElementById('title-mascot') as HTMLCanvasElement;
    document.getElementById('title-mascot-box')?.addEventListener('click', () => {
      this.audio.unlock();
      const clip = this.audio.playNailongVoice();
      this.nailongPose = 'pat_belly';
      this.poseTimer = clip.durationMs / 1000;
      const titleLbl = document.getElementById('title-voice-label');
      if (titleLbl) titleLbl.textContent = `🔊 ${clip.subtitle}`;
    });
    document.getElementById('btn-start-map')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
      this.selectedChapter = this.getFurthestUnlockedChapter();
      this.screen = 'map';
      this.renderUI();
    });
    document.getElementById('btn-start-endless')?.addEventListener('click', () => {
      this.startLevel(ENDLESS_LEVEL, true);
    });
    document.getElementById('btn-open-stickers')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
      this.activeModal = 'stickers';
      this.renderUI();
    });
    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
      this.nickSavedToast = '';
      this.activeModal = 'leaderboard';
      this.renderUI();
      this.refreshGlobalLeaderboard();
    });
    document.getElementById('btn-open-rules')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
      this.activeModal = 'rules';
      this.renderUI();
    });
  }

  private renderMapScreen(): void {
    const totalStars = Object.values(this.progress.levelStars).reduce((a, b) => a + b, 0);
    const maxStars = CAMPAIGN_LEVELS.length * 3;
    const activeChap =
      CAMPAIGN_CHAPTERS.find((c) => c.id === this.selectedChapter) ?? CAMPAIGN_CHAPTERS[0];
    const activeChapStars = getChapterStars(this.progress.levelStars, activeChap.id);
    const chapterLevels = CAMPAIGN_LEVELS.filter(
      (lv) => lv.id >= activeChap.startLevel && lv.id <= activeChap.endLevel
    );

    const chapterTabsHtml = CAMPAIGN_CHAPTERS.map((chap) => {
      const chapUnlocked = isChapterUnlocked(this.progress.unlockedLevel, this.progress.levelStars, chap.id);
      const isAct = chap.id === activeChap.id;
      const prevStars = chap.id > 1 ? getChapterStars(this.progress.levelStars, chap.id - 1) : 0;
      const curStars = getChapterStars(this.progress.levelStars, chap.id);
      const lockHint = !chapUnlocked ? ` (需前章25★·现${prevStars}★)` : ` (${curStars}/30★)`;
      return `
        <button class="chapter-tab ${isAct ? 'active' : ''} ${chapUnlocked ? '' : 'chap-locked'}"
                data-chap="${chap.id}" title="${chapUnlocked ? `${chap.title} (${curStars}/30★)` : `需第${chap.id - 1}章获得≥25★（当前${prevStars}★）`}">
          ${chapUnlocked ? '' : '🔒 '}${chap.shortTitle}${lockHint}
        </button>
      `;
    }).join('');

    const nodesHtml = chapterLevels
      .map((lv) => {
        const unlocked = isLevelUnlocked(this.progress.unlockedLevel, this.progress.levelStars, lv.id);
        const isCurrent = lv.id === this.progress.unlockedLevel && unlocked;
        const stars = this.progress.levelStars[lv.id] ?? 0;
        const starStr = unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒 未解锁';
        const isBoss = Boolean(lv.bossMaxHp);
        const shortName = lv.name.split('·')[1]?.trim() ?? lv.name;

        return `
          <div class="level-node ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''} ${isBoss ? 'boss' : ''}"
               data-lv="${lv.id}">
            <div class="node-num">${isBoss ? '👑 ' : ''}第 ${lv.id} 关</div>
            <div class="node-title">${shortName}</div>
            <div class="node-stars">${starStr}</div>
            ${isCurrent ? `<div class="current-tag">◀ 奶龙在这儿!</div>` : ''}
          </div>
        `;
      })
      .join('');

    this.root.innerHTML = `
      <div class="pixel-box map-screen">
        <div class="map-header">
          <button class="pixel-btn secondary topbar-btn" id="btn-back-title">
            ◀ 首页
          </button>
          <div class="map-title">${activeChap.title} (${activeChapStars}/30★)</div>
          <div class="star-pill">★ ${totalStars} / ${maxStars}</div>
        </div>

        <div class="chapter-tabs">
          ${chapterTabsHtml}
        </div>

        <div class="vine-map-grid" style="background-image: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.10)), url('${activeChap.bgImage}'); background-size: cover; background-position: center bottom; image-rendering: pixelated;">
          ${nodesHtml}
        </div>

        <div class="map-footer">
          <div class="map-tip">
            ${activeChap.tip}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <button class="pixel-btn topbar-btn" id="btn-map-endless">
              🍗 无尽干饭模式
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back-title')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.screen = 'title';
      this.renderUI();
    });
    document.getElementById('btn-map-endless')?.addEventListener('click', () => {
      this.startLevel(ENDLESS_LEVEL, true);
    });
    this.root.querySelectorAll<HTMLElement>('.chapter-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chapId = Number(btn.dataset.chap);
        if (!chapId) return;
        const unlocked = isChapterUnlocked(this.progress.unlockedLevel, this.progress.levelStars, chapId);
        if (!unlocked) {
          this.audio.playInvalidSwap();
          const prevStars = getChapterStars(this.progress.levelStars, chapId - 1);
          const diff = Math.max(0, REQUIRED_CHAPTER_STARS - prevStars);
          const tipEl = this.root.querySelector('.map-tip');
          if (tipEl) {
            tipEl.innerHTML = `<span style="color:#dc2626;font-weight:900;">🔒 解锁第 ${chapId} 章需要第 ${chapId - 1} 章累计获得 ≥25★（当前 ${prevStars}/25★，还差 ${diff}★）！快去补齐三星吧！</span>`;
          }
          return;
        }
        if (chapId !== this.selectedChapter) {
          this.audio.playSelect();
          this.selectedChapter = chapId;
          this.renderUI();
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('.level-node').forEach((el) => {
      el.addEventListener('click', () => {
        const id = Number(el.dataset.lv);
        const unlocked = isLevelUnlocked(this.progress.unlockedLevel, this.progress.levelStars, id);
        if (!unlocked) {
          this.audio.playInvalidSwap();
          const chapId = Math.ceil(id / 10);
          if (!isChapterUnlocked(this.progress.unlockedLevel, this.progress.levelStars, chapId)) {
            const prevStars = getChapterStars(this.progress.levelStars, chapId - 1);
            const diff = Math.max(0, REQUIRED_CHAPTER_STARS - prevStars);
            const tipEl = this.root.querySelector('.map-tip');
            if (tipEl) {
              tipEl.innerHTML = `<span style="color:#dc2626;font-weight:900;">🔒 该关卡所在章节未解锁！需前一章获得 ≥25★（当前 ${prevStars}/25★，还差 ${diff}★）！</span>`;
            }
          }
          return;
        }
        const lv = CAMPAIGN_LEVELS.find((l) => l.id === id);
        if (lv) this.startLevel(lv, false);
      });
    });
  }

  private renderPlayScreen(): void {
    const star3 = this.currentLevel.starScores[2];
    const scorePct = Math.min(100, Math.round((this.score / star3) * 100));
    const bellyReady = this.bellyEnergy >= 100;
    const boosters = this.getActiveBoosters();

    this.root.innerHTML = `
      <div class="play-screen-wrap">
        <!-- TOP HUD -->
        <div class="pixel-box play-topbar">
          <div class="topbar-left">
            <button class="pixel-btn secondary topbar-btn" id="btn-exit-level">
              ◀ <span class="hide-xs">地图</span>
            </button>
            <div class="topbar-title">${this.currentLevel.name}</div>
          </div>

          <div class="moves-badge ${this.movesLeft <= 5 ? 'low' : ''}" id="hud-moves">
            步数: ${this.movesLeft}
          </div>

          <div class="score-bar-wrap">
            <div class="score-label-row">
              <span id="hud-score">得分: ${this.score}</span>
              <span class="hide-xs">★★★ ${star3}</span>
            </div>
            <div class="score-bar-track">
              <div class="score-bar-fill" id="hud-score-fill" style="width:${scorePct}%"></div>
            </div>
          </div>

          <div class="topbar-actions">
            <button class="pixel-btn topbar-btn" id="btn-mute" style="background:#fef08a;">
              ${this.audio.muted ? '🔇' : '🔊'}<span class="hide-xs"> ${this.audio.muted ? '静音' : '音效'}</span>
            </button>
            <button class="pixel-btn topbar-btn" id="btn-help" style="background:#e0e7ff;">
              ❓
            </button>
          </div>
        </div>

        <!-- MAIN STAGE -->
        <div class="play-main">
          <!-- LEFT / TOP INTERACTIVE NAILONG & GOALS PANEL -->
          <div class="side-stage">
            <div class="pixel-box goals-panel">
              <div class="panel-heading">
                <span>${this.isEndless ? '🏆 无尽纪录' : '🎯 目标'}</span>
                <span class="palette-preview" title="本关棋盘可消除元素表">
                  ${
                    this.isEndless
                      ? `<button class="mini-rank-btn" id="btn-hud-rank">🏆 全服榜</button>`
                      : this.buildPalettePreviewHtml()
                  }
                </span>
              </div>
              <div class="goals-list" id="hud-goals">
                ${this.buildGoalsHtml()}
              </div>

              ${
                this.currentLevel.bossMaxHp
                  ? `
                <div class="boss-strip">
                  <canvas id="boss-canvas" width="88" height="88"></canvas>
                  <div style="flex:1;text-align:left;min-width:0;">
                    <div class="boss-label-row">
                      <span style="display:inline-flex;align-items:center;gap:4px;">
                        <img class="pixel-img goal-tile-icon" src="/assets/models/tile_bombloong.png" alt="暴暴龙" />
                        <span>暴暴龙</span>
                      </span>
                      <span id="hud-boss-hp">${Math.max(0, this.bossHp)}/${this.currentLevel.bossMaxHp}</span>
                    </div>
                    <div class="boss-hp-track">
                      <div class="boss-hp-fill" id="hud-boss-fill"
                           style="width:${Math.max(0, Math.round((this.bossHp / this.currentLevel.bossMaxHp) * 100))}%"></div>
                    </div>
                    <div class="boss-sub-hint">
                      ${
                        (this.currentLevel.bossAttackInterval ?? 3) -
                        (this.movesUsed % (this.currentLevel.bossAttackInterval ?? 3))
                      }步后捣乱!
                    </div>
                  </div>
                </div>
              `
                  : ''
              }
            </div>

            <div class="pixel-box mascot-card">
              <div class="speech-bubble" id="hud-speech">${this.speechText}</div>
              <div class="mascot-body-row">
                <div class="mascot-canvas-wrap" id="mascot-click-zone" title="点击奶龙大肚皮互动 / 满能量释放绝招！">
                  <canvas id="play-mascot" width="192" height="192"></canvas>
                </div>

                <div class="belly-meter-box">
                  <div class="belly-label-row">
                    <span>🍮 肚肚能量</span>
                    <span id="hud-belly-pct">${Math.min(100, this.bellyEnergy)}%</span>
                  </div>
                  <div class="belly-meter-track">
                    <div class="belly-meter-fill" id="hud-belly-fill" style="width:${Math.min(100, this.bellyEnergy)}%"></div>
                  </div>
                  <button class="pixel-btn belly-slam-btn ${bellyReady ? 'accent' : ''}" id="btn-belly-slam"
                          ${bellyReady ? '' : 'disabled'}>
                    ${bellyReady ? '💥 肚肚泰山压顶!' : '吃零食攒满放大招'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT / CENTER PIXEL MATCH-3 BOARD & XIAOQI BOOSTERS -->
          <div class="board-column">
            <div class="board-frame" id="board-frame-el">
              <canvas id="board-canvas" width="${BOARD_PX}" height="${BOARD_PX}"></canvas>
              <div id="combo-popup-slot"></div>
            </div>

            <div class="pixel-box booster-bar">
              <div class="xiaoqi-helper-wrap" id="xiaoqi-click-zone" title="天才少年小七：点击打招呼，使用道具为你助威！">
                <canvas id="xiaoqi-canvas" width="80" height="80"></canvas>
                <span class="xiaoqi-tag">小七</span>
              </div>
              <button class="booster-btn ${this.activeBooster === 'hammer' ? 'active' : ''}" id="boost-hammer"
                      ${boosters.hammer <= 0 ? 'disabled' : ''}>
                <span>🔨 木槌(${boosters.hammer})</span>
                <span class="booster-sub">敲碎任意单格</span>
              </button>
              <button class="booster-btn ${this.activeBooster === 'swap_glove' ? 'active' : ''}" id="boost-glove"
                      ${boosters.swap_glove <= 0 ? 'disabled' : ''}>
                <span>🧤 手套(${boosters.swap_glove})</span>
                <span class="booster-sub">无视规则互换</span>
              </button>
              <button class="booster-btn" id="boost-shuffle"
                      ${boosters.shuffle <= 0 ? 'disabled' : ''}>
                <span>🌀 重排(${boosters.shuffle})</span>
                <span class="booster-sub">不耗步洗牌</span>
              </button>
              <button class="booster-btn" id="boost-plus5"
                      ${boosters.plus5 <= 0 ? 'disabled' : ''}>
                <span>➕ +5步(${boosters.plus5})</span>
                <span class="booster-sub">立刻增加5步</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.playMascotCanvas = document.getElementById('play-mascot') as HTMLCanvasElement;
    this.bossCanvas = document.getElementById('boss-canvas') as HTMLCanvasElement | null;
    this.xiaoqiCanvas = document.getElementById('xiaoqi-canvas') as HTMLCanvasElement | null;
    this.boardCanvas = document.getElementById('board-canvas') as HTMLCanvasElement;

    this.bindPlayEvents();
  }

  private buildPalettePreviewHtml(): string {
    if (!this.engine) return '';
    return this.engine.palette
      .map(
        (color) =>
          `<img class="pixel-img palette-mini-icon" src="/assets/models/tile_${color}.png" alt="${COLOR_META[color].label}" title="可消除：${COLOR_META[color].label}" />`
      )
      .join('');
  }

  private buildGoalsHtml(): string {
    if (this.isEndless) {
      const serverTop = this.leaderboard?.topScore ?? 0;
      const serverChamp = this.leaderboard?.championName ?? '加载中';
      const isLeading = this.score > 0 && this.score >= serverTop;
      const shownGlobalTop = Math.max(serverTop, this.score);
      const shownChamp = isLeading
        ? this.escapeHtml(this.progress.playerNickname || '你正在领跑!')
        : this.escapeHtml(serverChamp);
      const myBest = Math.max(this.progress.endlessBestScore, this.score);

      return `
        <div class="goal-chip ${isLeading ? 'done' : ''}" style="background:${isLeading ? '#fef08a' : '#fff7ed'};">
          🌍 全服最高: ${shownGlobalTop} (${shownChamp})
        </div>
        <div class="goal-chip">
          🧑 我的最高: ${myBest}
        </div>
        <div class="goal-chip">
          🍗 下一档: ${this.endlessNextMilestone}分 (+4步)
        </div>
      `;
    }
    return this.goals
      .map((g) => {
        const done = g.current >= g.target;
        let icon = '⭐';
        let label = '';
        if (g.type === 'collect' && g.color) {
          icon = `<img class="pixel-img goal-tile-icon" src="/assets/models/tile_${g.color}.png" alt="${COLOR_META[g.color].label}" />`;
          label = COLOR_META[g.color].label;
        } else if (g.type === 'ice') {
          icon = '🧊';
          label = '破冰';
        } else if (g.type === 'crate') {
          icon = '📦';
          label = '木箱';
        } else if (g.type === 'chain') {
          icon = '⛓️';
          label = '锁链';
        } else if (g.type === 'boss') {
          icon = `<img class="pixel-img goal-tile-icon" src="/assets/models/tile_bombloong.png" alt="暴暴龙" />`;
          label = '暴暴龙';
        }
        return `
          <div class="goal-chip ${done ? 'done' : ''}">
            ${icon}
            <span>${label} ${Math.min(g.target, g.current)}/${g.target}${done ? '✓' : ''}</span>
          </div>
        `;
      })
      .join('');
  }

  private updateHudDom(): void {
    if (this.screen !== 'play') return;
    const movesEl = document.getElementById('hud-moves');
    if (movesEl) {
      movesEl.textContent = `步数: ${this.movesLeft}`;
      movesEl.className = `moves-badge ${this.movesLeft <= 5 ? 'low' : ''}`;
    }
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = `得分: ${this.score}`;

    const scoreFill = document.getElementById('hud-score-fill');
    if (scoreFill) {
      const pct = Math.min(100, Math.round((this.score / this.currentLevel.starScores[2]) * 100));
      scoreFill.style.width = `${pct}%`;
    }

    const goalsEl = document.getElementById('hud-goals');
    if (goalsEl) goalsEl.innerHTML = this.buildGoalsHtml();

    const speechEl = document.getElementById('hud-speech');
    if (speechEl) speechEl.textContent = this.speechText;

    const bellyPct = document.getElementById('hud-belly-pct');
    const bellyFill = document.getElementById('hud-belly-fill');
    const bellyBtn = document.getElementById('btn-belly-slam') as HTMLButtonElement | null;
    const clampedBelly = Math.min(100, this.bellyEnergy);
    if (bellyPct) bellyPct.textContent = `${clampedBelly}%`;
    if (bellyFill) bellyFill.style.width = `${clampedBelly}%`;
    if (bellyBtn) {
      const ready = clampedBelly >= 100;
      bellyBtn.disabled = !ready;
      bellyBtn.className = `pixel-btn belly-slam-btn ${ready ? 'accent' : ''}`;
      bellyBtn.textContent = ready ? '💥 肚肚泰山压顶!' : '吃零食攒满放大招';
    }

    if (this.currentLevel.bossMaxHp) {
      const hpText = document.getElementById('hud-boss-hp');
      const hpFill = document.getElementById('hud-boss-fill');
      if (hpText) hpText.textContent = `${Math.max(0, this.bossHp)}/${this.currentLevel.bossMaxHp}`;
      if (hpFill) {
        hpFill.style.width = `${Math.max(0, Math.round((this.bossHp / this.currentLevel.bossMaxHp) * 100))}%`;
      }
    }
  }

  private bindPlayEvents(): void {
    document.getElementById('btn-exit-level')?.addEventListener('click', () => {
      this.audio.playSelect();
      if (this.isEndless && this.score > 0) {
        if (this.score > this.progress.endlessBestScore) {
          this.progress.endlessBestScore = this.score;
          saveProgress(this.progress);
        }
        this.syncEndlessScoreToServer(this.score);
      }
      this.screen = this.isEndless ? 'title' : 'map';
      this.renderUI();
    });

    document.getElementById('btn-hud-rank')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.nickSavedToast = '';
      this.activeModal = 'leaderboard';
      this.renderUI();
      this.refreshGlobalLeaderboard();
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => {
      this.audio.toggleMute();
      this.renderUI();
    });

    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.activeModal = 'rules';
      this.renderUI();
    });

    const triggerBellySkill = () => {
      this.audio.unlock();
      const clip = this.audio.playNailongVoice();
      if (this.isAnimating) return;
      if (this.bellyEnergy >= 100) {
        this.executeBellySlamSkill();
      } else {
        this.nailongPose = 'pat_belly';
        this.poseTimer = clip.durationMs / 1000;
        this.speechText = clip.subtitle;
        this.updateHudDom();
      }
    };

    document.getElementById('mascot-click-zone')?.addEventListener('click', triggerBellySkill);
    document.getElementById('hud-speech')?.addEventListener('click', triggerBellySkill);
    document.getElementById('btn-belly-slam')?.addEventListener('click', triggerBellySkill);

    // Xiao Qi helper & Boosters
    document.getElementById('xiaoqi-click-zone')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
      this.xiaoqiCheerTimer = 1.6;
      this.speechText = '小七：“奶龙加油！卡关的时候尽管用我发明的道具！”';
      this.updateHudDom();
    });

    document.getElementById('boost-hammer')?.addEventListener('click', () => {
      const b = this.getActiveBoosters();
      if (this.isAnimating || b.hammer <= 0) return;
      this.audio.playSelect();
      this.xiaoqiCheerTimer = 1.4;
      this.activeBooster = this.activeBooster === 'hammer' ? null : 'hammer';
      this.speechText = this.activeBooster
        ? '小七木槌已就绪：请点击棋盘上任意一格敲碎它！'
        : '已取消木槌瞄准。';
      this.renderUI();
    });

    document.getElementById('boost-glove')?.addEventListener('click', () => {
      const b = this.getActiveBoosters();
      if (this.isAnimating || b.swap_glove <= 0) return;
      this.audio.playSelect();
      this.xiaoqiCheerTimer = 1.4;
      this.activeBooster = this.activeBooster === 'swap_glove' ? null : 'swap_glove';
      this.selectedCell = null;
      this.speechText = this.activeBooster
        ? '强换手套已就绪：点击或滑动相邻两格直接互换！'
        : '已取消强换手套。';
      this.renderUI();
    });

    document.getElementById('boost-shuffle')?.addEventListener('click', async () => {
      const b = this.getActiveBoosters();
      if (this.isAnimating || b.shuffle <= 0) return;
      this.isAnimating = true;
      b.shuffle--;
      if (!this.isEndless) {
        this.progress.boosters = { ...b };
        saveProgress(this.progress);
      }
      this.renderUI();
      this.isAnimating = true;
      await this.performAutoShuffleVisual(true, true);
      this.isAnimating = false;
      this.lastActionTime = performance.now();
    });

    document.getElementById('boost-plus5')?.addEventListener('click', () => {
      const b = this.getActiveBoosters();
      if (this.isAnimating || b.plus5 <= 0) return;
      b.plus5--;
      if (!this.isEndless) {
        this.progress.boosters = { ...b };
        saveProgress(this.progress);
      }
      this.movesLeft += 5;
      this.audio.playEatChomp();
      this.xiaoqiCheerTimer = 1.5;
      this.nailongPose = 'chew';
      this.poseTimer = 1.0;
      this.speechText = '啊呜！补充应急零食包，步数 +5！';
      this.renderUI();
    });

    // Board pointer events (supports both click-swap AND drag/swipe-swap!)
    const canvas = this.boardCanvas;
    if (!canvas) return;

    const getCellFromEvent = (ev: PointerEvent): Coord | null => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = BOARD_PX / rect.width;
      const scaleY = BOARD_PX / rect.height;
      const px = (ev.clientX - rect.left) * scaleX;
      const py = (ev.clientY - rect.top) * scaleY;
      const col = Math.floor(px / CELL_PX);
      const row = Math.floor(py / CELL_PX);
      if (row < 0 || row >= 8 || col < 0 || col >= 8) return null;
      return { row, col };
    };

    canvas.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (this.isAnimating || this.activeModal !== 'none' || this.movesLeft <= 0) return;
      this.audio.unlock();
      this.lastActionTime = performance.now();
      this.hintPair = null;

      const cell = getCellFromEvent(ev);
      if (!cell) return;

      if (this.activeBooster === 'hammer') {
        this.executeHammerBooster(cell);
        return;
      }

      this.dragStartCell = cell;
      this.dragStartPt = { x: ev.clientX, y: ev.clientY };

      if (!this.engine.isMovableCell(cell.row, cell.col)) {
        this.selectedCell = null;
        return;
      }

      if (this.selectedCell && this.engine.isAdjacent(this.selectedCell, cell)) {
        const from = this.selectedCell;
        this.selectedCell = null;
        this.dragStartCell = null;
        this.handlePlayerSwapAttempt(from, cell);
      } else {
        this.audio.playSelect();
        this.selectedCell = cell;
      }
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!this.dragStartCell || !this.dragStartPt || this.isAnimating || this.movesLeft <= 0) return;
      ev.preventDefault();
      const dx = ev.clientX - this.dragStartPt.x;
      const dy = ev.clientY - this.dragStartPt.y;
      const minSwipe = Math.max(14, canvas.getBoundingClientRect().width / 24);
      if (Math.hypot(dx, dy) < minSwipe) return;

      let dr = 0;
      let dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) {
        dc = dx > 0 ? 1 : -1;
      } else {
        dr = dy > 0 ? 1 : -1;
      }
      const target: Coord = {
        row: this.dragStartCell.row + dr,
        col: this.dragStartCell.col + dc,
      };
      const origin = this.dragStartCell;
      this.dragStartCell = null;
      this.dragStartPt = null;
      this.selectedCell = null;

      if (this.engine.isMovableCell(origin.row, origin.col) && this.engine.isMovableCell(target.row, target.col)) {
        this.handlePlayerSwapAttempt(origin, target);
      }
    });
  }

  private async handlePlayerSwapAttempt(a: Coord, b: Coord): Promise<void> {
    if (this.isAnimating || this.movesLeft <= 0) return;
    this.isAnimating = true;
    this.audio.playSwap();

    // Animate visual swap forward
    await this.animateSwapPair(a, b, false);

    const usingGlove = this.activeBooster === 'swap_glove';
    const res = usingGlove ? this.engine.useForceSwap(a, b) : this.engine.trySwap(a, b);

    if (!res.valid) {
      this.audio.playInvalidSwap();
      this.speechText = '咦？这俩凑不成 3 连消除哦，弹回来啦~';
      await this.animateSwapPair(a, b, true);
      this.isAnimating = false;
      this.updateHudDom();
      return;
    }

    // Commit visual swap into renderGrid so tile pop starts smoothly from post-swap positions
    const tmpTile = this.renderGrid[a.row][a.col].tile;
    this.renderGrid[a.row][a.col].tile = this.renderGrid[b.row][b.col].tile;
    this.renderGrid[b.row][b.col].tile = tmpTile;

    if (usingGlove) {
      const b = this.getActiveBoosters();
      b.swap_glove--;
      this.activeBooster = null;
      if (!this.isEndless) {
        this.progress.boosters = { ...b };
        saveProgress(this.progress);
      }
      this.renderUI();
      this.isAnimating = true;
    }

    if (res.consumedMove) {
      this.movesLeft = Math.max(0, this.movesLeft - 1);
      this.movesUsed++;
    }

    if (res.steps.length === 0) {
      if (res.shuffledAfter) {
        await this.performAutoShuffleVisual(false, false);
      } else {
        this.renderGrid = this.engine.cloneGrid();
      }
      await this.postTurnChecks(res.consumedMove);
      this.isAnimating = false;
      this.updateHudDom();
      return;
    }

    await this.playResolutionSteps(res.steps, res.shuffledAfter);
    await this.postTurnChecks(res.consumedMove);
    this.isAnimating = false;
    this.lastActionTime = performance.now();
    this.updateHudDom();
  }

  private async executeHammerBooster(target: Coord): Promise<void> {
    if (this.movesLeft <= 0) return;
    this.isAnimating = true;
    const res = this.engine.useHammer(target);
    if (!res.valid) {
      this.isAnimating = false;
      return;
    }
    const b = this.getActiveBoosters();
    b.hammer--;
    this.activeBooster = null;
    if (!this.isEndless) {
      this.progress.boosters = { ...b };
      saveProgress(this.progress);
    }
    this.audio.playSpecialBlast('bomb3');
    this.renderUI();
    this.isAnimating = true;

    await this.playResolutionSteps(res.steps, res.shuffledAfter);
    await this.postTurnChecks(false);
    this.isAnimating = false;
    this.updateHudDom();
  }

  private async executeBellySlamSkill(): Promise<void> {
    if (this.movesLeft <= 0) return;
    this.isAnimating = true;
    this.bellyEnergy = 0;
    this.nailongPose = 'belly_slam';
    this.poseTimer = 1.4;
    this.speechText = '看招！！2吨大肚肚泰山压顶 —— DUANG！！！';
    this.audio.playSpecialBlast('belly_slam');
    this.boardShake = 14;
    this.updateHudDom();

    await this.sleep(240);
    const res = this.engine.useBellySlam();
    await this.playResolutionSteps(res.steps, res.shuffledAfter);
    await this.postTurnChecks(false);
    this.isAnimating = false;
    this.updateHudDom();
  }

  private async playResolutionSteps(steps: CascadeStep[], shuffledAfter: boolean): Promise<void> {
    for (const step of steps) {
      // 1. Trigger audio & combo banner
      this.audio.playComboMatch(step.comboIndex);
      if (step.blasts.length > 0) {
        this.audio.playSpecialBlast(step.blasts[0].kind);
        const bk = step.blasts[0].kind;
        const shake =
          bk === 'bomb5' || bk === 'belly_slam' ? 22 : bk === 'bomb3' ? 14 : bk === 'rainbow_all' ? 16 : 8;
        this.boardShake = Math.max(this.boardShake, shake);
      }

      if (step.comboIndex >= 2 || step.blasts.length > 0) {
        this.showComboPopup(step.comboIndex, step.blasts.length > 0);
      }

      // 2. Register blast visuals, particles & flying snacks toward Nailong!
      for (const b of step.blasts) {
        const duration = b.kind === 'bomb5' || b.kind === 'belly_slam' ? 0.52 : b.kind === 'bomb3' ? 0.44 : 0.36;
        this.activeBlasts.push({ event: b, timer: 0, duration });
      }

      this.clearingSet.clear();
      for (const cl of step.cleared) {
        this.clearingSet.add(`${cl.row},${cl.col}`);
        const cx = cl.col * CELL_PX + CELL_PX / 2;
        const cy = cl.row * CELL_PX + CELL_PX / 2;
        const hex = COLOR_META[cl.color].hex;
        for (let p = 0; p < 7; p++) {
          const ang = (Math.PI * 2 * p) / 7 + Math.random() * 0.5;
          const spd = 60 + Math.random() * 110;
          this.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,
            color: p % 2 === 0 ? hex : '#FFFBEB',
            size: 5 + Math.floor(Math.random() * 4),
            life: 0,
            maxLife: 0.42,
          });
        }
        // Spawn flying snack zooming toward top-left Nailong!
        if (Math.random() < 0.65 || step.cleared.length <= 4) {
          this.flyingSnacks.push({
            x: cx,
            y: cy,
            startX: cx,
            startY: cy,
            targetX: -28,
            targetY: 160,
            color: cl.color,
            t: 0,
          });
        }
      }

      if (step.cleared.length > 0) {
        const first = step.cleared[0];
        this.floatingScores.push({
          x: first.col * CELL_PX + CELL_PX / 2,
          y: first.row * CELL_PX + 22,
          text: `+${step.scoreDelta}`,
          color: step.comboIndex >= 3 ? '#FF4D5E' : '#F59E0B',
          life: 0,
        });
        this.nailongPose = 'mouth_open';
        this.poseTimer = 0.45;
      }

      // Animate tile pop-out
      await this.animateProgress(180, (t) => {
        this.clearPopProgress = t;
      });
      this.clearingSet.clear();
      this.clearPopProgress = 0;

      // Apply scores, belly energy, goals & boss damage!
      this.score += step.scoreDelta;
      this.bellyEnergy = Math.min(100, this.bellyEnergy + step.bellyEnergyDelta);
      if (this.currentLevel.bossMaxHp && step.bossDamageDelta > 0) {
        this.bossHp = Math.max(0, this.bossHp - step.bossDamageDelta);
        this.bossHurtTimer = 0.55;
      }

      this.applyStepToGoals(step);
      this.audio.playEatChomp();
      this.nailongPose = 'chew';
      this.poseTimer = 0.65;
      if (step.comboIndex >= 3) {
        this.xiaoqiCheerTimer = 1.5;
        this.speechText = `${step.comboIndex}连消！太香啦！我的大肚皮好幸福~`;
      }
      this.updateHudDom();

      // Switch renderGrid to post-fall snapshot & animate falling tiles!
      this.renderGrid = step.boardSnapshot.map((r) =>
        r.map((c) => ({ ...c, tile: c.tile ? { ...c.tile } : null }))
      );

      if (step.falls.length > 0) {
        this.activeFalls.clear();
        for (const f of step.falls) {
          this.activeFalls.set(`${f.toRow},${f.toCol}`, { fall: f, progress: 0 });
        }
        await this.animateProgress(210, (t) => {
          // EaseOutBack slight bounce on land
          const eased = t < 0.85 ? t / 0.85 : 1 - Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.06;
          for (const item of this.activeFalls.values()) {
            item.progress = eased;
          }
        });
        this.activeFalls.clear();
      }
    }

    if (shuffledAfter) {
      await this.performAutoShuffleVisual(false, false);
    }
  }

  private async performAutoShuffleVisual(needEngineShuffle = false, manual = false): Promise<void> {
    this.audio.playSpecialBlast('rainbow_rays');
    this.xiaoqiCheerTimer = 1.8;
    this.speechText = manual
      ? '小七开启旋风重排！棋盘焕然一新啦！'
      : '发现棋盘没有可走步数啦，已自动为你免费洗牌重排！';
    this.updateHudDom();
    this.showShufflePopup(manual);

    let swappedGrid = false;
    await this.animateProgress(460, (t) => {
      if (t >= 0.5 && !swappedGrid) {
        swappedGrid = true;
        if (needEngineShuffle) {
          this.engine.shuffleBoard();
        }
        this.renderGrid = this.engine.cloneGrid();
        // Spawn cheerful swirl sparkles across the board
        for (let i = 0; i < 18; i++) {
          const ang = (Math.PI * 2 * i) / 18;
          const cx = BOARD_PX / 2 + Math.cos(ang) * 90;
          const cy = BOARD_PX / 2 + Math.sin(ang) * 90;
          this.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * 140,
            vy: Math.sin(ang) * 140 - 40,
            color: i % 2 === 0 ? '#FACC15' : '#38BDF8',
            size: 6,
            life: 0,
            maxLife: 0.45,
          });
        }
      }
      this.shuffleAnimProgress = t;
    });
    this.shuffleAnimProgress = 0;
    this.renderGrid = this.engine.cloneGrid();
    if (!manual) {
      this.hintPair = this.engine.getHintMove();
    }
  }

  private applyStepToGoals(step: CascadeStep): void {
    for (const goal of this.goals) {
      if (goal.type === 'collect' && goal.color) {
        const cnt = step.cleared.filter((c) => c.color === goal.color).length;
        goal.current += cnt;
      } else if (goal.type === 'ice') {
        goal.current += step.iceBroken;
      } else if (goal.type === 'crate') {
        goal.current += step.cratesBroken;
      } else if (goal.type === 'chain') {
        goal.current += step.chainsBroken;
      } else if (goal.type === 'boss' && this.currentLevel.bossMaxHp) {
        goal.current = this.currentLevel.bossMaxHp - this.bossHp;
      } else if (goal.type === 'score') {
        goal.current = this.score;
      }
    }

    // Exact board sync safeguard: if zero ice/crates/chains remain on board, snap goal complete!
    let remIce = 0;
    let remCrate = 0;
    let remChain = 0;
    for (const row of this.engine.grid) {
      for (const cell of row) {
        remIce += cell.iceLevel;
        if (cell.crateHp > 0) remCrate++;
        if (cell.chain) remChain++;
      }
    }
    for (const goal of this.goals) {
      if (goal.type === 'ice' && remIce === 0) goal.current = Math.max(goal.current, goal.target);
      if (goal.type === 'crate' && remCrate === 0) goal.current = Math.max(goal.current, goal.target);
      if (goal.type === 'chain' && remChain === 0) goal.current = Math.max(goal.current, goal.target);
    }
  }

  private async postTurnChecks(consumedMove: boolean): Promise<void> {
    // Endless mode milestones!
    if (this.isEndless) {
      let hitMilestone = false;
      while (this.score >= this.endlessNextMilestone) {
        hitMilestone = true;
        this.endlessTier++;
        this.movesLeft += 4;
        this.endlessStepGap += 450;
        this.endlessNextMilestone += this.endlessStepGap;
        this.audio.playVictory();
        this.speechText = `干饭突破第 ${this.endlessTier} 档里程碑！奖励 +4 步！`;
      }
      if (this.score > this.progress.endlessBestScore) {
        this.progress.endlessBestScore = this.score;
        saveProgress(this.progress);
      }
      if (hitMilestone && this.score > 0) {
        this.syncEndlessScoreToServer(this.score);
      }
      if (this.movesLeft <= 0) {
        this.audio.playOutOfMoves();
        this.nickSavedToast = '';
        this.activeModal = 'lose';
        this.renderUI();
        if (this.score > 0) {
          this.syncEndlessScoreToServer(this.score);
        }
      }
      return;
    }

    // Check Campaign Victory!
    const allDone = this.goals.every((g) => g.current >= g.target);
    if (allDone) {
      // Remaining moves bonus! Rewarding players generously for saving moves (1000 pts / move)
      if (this.movesLeft > 0) {
        const BONUS_PER_REMAINING_MOVE = 1000;
        this.lastMovesBonus = this.movesLeft * BONUS_PER_REMAINING_MOVE;
        this.score += this.lastMovesBonus;
        this.speechText = `过关啦！剩余 ${this.movesLeft} 步转化为 +${this.lastMovesBonus} 美味大奖（每步 +${BONUS_PER_REMAINING_MOVE}）！`;
        this.movesLeft = 0;
        this.updateHudDom();
      } else {
        this.lastMovesBonus = 0;
      }
      const [s1, s2, s3] = this.currentLevel.starScores;
      this.earnedStars = this.score >= s3 ? 3 : this.score >= s2 ? 2 : this.score >= s1 ? 1 : 1;

      const lvId = this.currentLevel.id;
      this.progress.levelStars[lvId] = Math.max(this.progress.levelStars[lvId] ?? 0, this.earnedStars);
      this.progress.levelBestScores[lvId] = Math.max(this.progress.levelBestScores[lvId] ?? 0, this.score);

      const currentChapId = Math.ceil(lvId / 10);
      const isChapEnd = lvId === currentChapId * 10;
      if (isChapEnd) {
        const starsInChap = getChapterStars(this.progress.levelStars, currentChapId);
        if (starsInChap >= REQUIRED_CHAPTER_STARS) {
          if (lvId >= this.progress.unlockedLevel && lvId < CAMPAIGN_LEVELS.length) {
            this.progress.unlockedLevel = lvId + 1;
          }
        }
      } else {
        if (lvId >= this.progress.unlockedLevel && lvId < CAMPAIGN_LEVELS.length) {
          this.progress.unlockedLevel = lvId + 1;
        }
      }

      // Check if replaying an earlier level just pushed chapter stars to >= 25
      for (let c = 1; c < CAMPAIGN_CHAPTERS.length; c++) {
        const endLv = c * 10;
        const nextLv = endLv + 1;
        if (
          (this.progress.levelStars[endLv] ?? 0) > 0 &&
          getChapterStars(this.progress.levelStars, c) >= REQUIRED_CHAPTER_STARS
        ) {
          if (this.progress.unlockedLevel < nextLv) {
            this.progress.unlockedLevel = nextLv;
          }
        }
      }
      this.selectedChapter = this.getFurthestUnlockedChapter();

      // Reward 1 random booster on 3-star clear!
      if (this.earnedStars === 3) {
        const chapBoosters = this.getActiveBoosters();
        chapBoosters.hammer++;
        this.progress.boosters = { ...chapBoosters };
      }
      saveProgress(this.progress);

      this.nailongPose = 'pat_belly';
      this.poseTimer = 5;
      this.audio.playVictory();
      await this.sleep(380);
      this.activeModal = 'win';
      this.renderUI();
      return;
    }

    // Boss sabotage every N moves!
    if (
      consumedMove &&
      this.currentLevel.bossMaxHp &&
      this.bossHp > 0 &&
      this.movesLeft > 0 &&
      this.movesUsed % (this.currentLevel.bossAttackInterval ?? 3) === 0
    ) {
      const sabotaged = this.engine.triggerBossSabotage(2);
      this.renderGrid = this.engine.cloneGrid();
      if (sabotaged.length > 0) {
        this.bossAttackTimer = 1.2;
        this.boardShake = 7;
        this.speechText = '哎呀！暴暴龙派小紫兵扔了捣乱障碍，快消除它！';
        this.updateHudDom();
        await this.sleep(300);
      }
      if (this.engine.findValidMoves().length === 0) {
        await this.performAutoShuffleVisual(true, false);
      }
    }

    // Safeguard: if moves remain and no valid move exists on board, auto-shuffle immediately!
    if (this.movesLeft > 0 && this.engine.findValidMoves().length === 0) {
      await this.performAutoShuffleVisual(true, false);
    }

    // Check Out of Moves!
    if (this.movesLeft <= 0) {
      this.nailongPose = 'worried';
      this.poseTimer = 5;
      this.audio.playOutOfMoves();
      await this.sleep(320);
      this.activeModal = 'lose';
      this.renderUI();
    }
  }

  private showComboPopup(combo: number, hasSpecial: boolean): void {
    let title = '好耶! GOOD!';
    let stickerId = 'nailong_happy';
    if (combo >= 5) {
      title = '宇宙干饭神!! UNBELIEVABLE!';
      stickerId = 'nailong_belly';
    } else if (combo === 4) {
      title = '肚肚酷酷! AMAZING!';
      stickerId = 'nailong_cool';
    } else if (combo === 3) {
      title = '真香暴击! GREAT!';
      stickerId = 'nailong_happy';
    } else if (hasSpecial) {
      title = '特效轰炸! NICE!';
      stickerId = 'minion_twin';
    }

    this.comboBanner = {
      text: title,
      sub: `${combo} 连消达成!`,
      stickerUrl: this.getStickerUrl(stickerId),
      timer: 1.15,
    };

    const slot = document.getElementById('combo-popup-slot');
    if (slot) {
      slot.innerHTML = `
        <div class="combo-popup">
          <img class="pixel-img" src="${this.comboBanner.stickerUrl}" width="44" height="44" alt="combo" />
          <div style="text-align:left;">
            <div style="font-weight:900;font-size:15px;color:#d97706;">${this.comboBanner.text}</div>
            <div style="font-weight:800;font-size:11px;color:#2b1e16;">${this.comboBanner.sub}</div>
          </div>
        </div>
      `;
    }
  }

  private showShufflePopup(manual: boolean): void {
    this.comboBanner = {
      text: manual ? '🌀 小七旋风洗牌!' : '🌀 无可走步数 · 自动洗牌!',
      sub: manual ? '棋盘已重新排列!' : '已免费重排棋盘（不消耗步数）',
      stickerUrl: this.getStickerUrl('xiaoqi_cheer'),
      timer: 1.65,
    };

    const slot = document.getElementById('combo-popup-slot');
    if (slot) {
      slot.innerHTML = `
        <div class="combo-popup">
          <img class="pixel-img" src="${this.comboBanner.stickerUrl}" width="44" height="44" alt="shuffle" />
          <div style="text-align:left;">
            <div style="font-weight:900;font-size:15px;color:#0284c7;">${this.comboBanner.text}</div>
            <div style="font-weight:800;font-size:11px;color:#2b1e16;">${this.comboBanner.sub}</div>
          </div>
        </div>
      `;
    }
  }

  private appendModal(): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    if (this.activeModal === 'stickers') {
      const cards = this.stickers
        .map((s) => {
          const isNailong = s.id.startsWith('nailong_');
          const voiceAttr = isNailong ? 'data-nailong-voice="1" style="cursor:pointer;" title="点击听奶龙原声！"' : '';
          return `
          <div class="sticker-item" ${voiceAttr}>
            <img class="pixel-img" src="${s.url}" width="96" height="96" alt="${s.desc}" />
            <div style="font-weight:900;font-size:12px;">${s.desc}${isNailong ? ' 🔊' : ''}</div>
            <div style="font-size:10px;color:#64748b;">
              ${s.origin === 'online-pixelized' ? '🖼️ 参考原图像素化' : '🎨 像素精绘角色'}
            </div>
          </div>
        `;
        })
        .join('');

      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <h2 style="margin:0 0 6px;">📒 奶龙像素表情包图鉴</h2>
          <div style="font-size:12px;color:#5c3d28;">
            以下 96×96 高清像素贴纸基于分类参考图集（奶龙 / 暴暴龙 / 小七 / 小紫兵）经复古调色板量化与像素描边生成：
          </div>
          <div class="sticker-gallery">${cards}</div>
          <button class="pixel-btn" id="modal-close">关闭图鉴</button>
        </div>
      `;
    } else if (this.activeModal === 'rules') {
      backdrop.innerHTML = `
        <div class="pixel-box modal-card" style="text-align:left;">
          <h2 style="margin:0 0 10px;text-align:center;">📖 奶龙消消乐 · 特效秘籍</h2>
          <div style="font-size:13px;line-height:1.7;font-weight:700;">
            <p>🔸 <b>基础三消</b>：点击或拖拽交换相邻棋子，凑齐 3 个同色即可喂奶龙吃零食！</p>
            <p>🔥 <b>4连直线 -> 【烈焰条纹棋】</b>：消除时奶龙喷出火焰横扫整行或整列！</p>
            <p>💥 <b>T型 / L型 5连 -> 【肚皮爆炸包】</b>：duang~ 震碎周围 3×3 范围一切障碍！</p>
            <p>🌈 <b>5连一线 -> 【百变彩虹奶龙】</b>：与任意颜色交换，吸走全屏同色棋子！</p>
            <p>⚡ <b>双特效互换大招</b>：把任意两个特效棋子相邻交换（如彩虹+条纹、爆炸+爆炸），触发全屏毁天灭地连环清场！</p>
            <p>🍮 <b>大肚肚主动技</b>：消除攒满 100% 肚肚能量后，点击左侧奶龙释放【泰山压顶】不耗步炸场并赠送 2 个特效棋子！</p>
          </div>
          <div style="text-align:center;margin-top:14px;">
            <button class="pixel-btn" id="modal-close">学会啦，开吃！</button>
          </div>
        </div>
      `;
    } else if (this.activeModal === 'leaderboard') {
      const topScore = this.leaderboard?.topScore ?? 0;
      const champ = this.escapeHtml(this.leaderboard?.championName ?? '虚位以待');
      const entries = this.leaderboard?.entries ?? [];
      const myRank = this.leaderboard?.playerRank;
      const rowsHtml =
        entries.length === 0
          ? `<div style="padding:14px;font-weight:800;color:#64748b;">暂无全服记录，快去无尽模式抢下全服第一吧！</div>`
          : entries
              .map((item) => {
                const medal =
                  item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;
                const isMe = item.playerId === this.progress.playerId;
                return `
                  <div class="leaderboard-row ${isMe ? 'me' : ''}">
                    <span class="lb-rank">${medal}</span>
                    <span class="lb-name">${this.escapeHtml(item.nickname)}${isMe ? ' (我)' : ''}</span>
                    <span class="lb-score">${item.score} 分</span>
                  </div>
                `;
              })
              .join('');

      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <h2 style="margin:0 0 8px;">🏆 无尽模式 · 全服最高分榜</h2>
          <div class="leaderboard-banner">
            <div style="font-size:12px;font-weight:800;color:#9a3412;">👑 当前全服最高分纪录</div>
            <div style="font-size:22px;font-weight:900;color:#b45309;margin:2px 0;">
              ${topScore} 分
            </div>
            <div style="font-size:12px;font-weight:900;color:#2b1e16;">
              纪录保持者：${champ} ${
                this.leaderboard ? `(共 ${this.leaderboard.totalPlayers} 位干饭家上榜)` : '(同步中...)'
              }
            </div>
          </div>

          <div style="font-size:12px;font-weight:800;margin:6px 0;color:#475569;">
            我的本地最高: <b>${this.progress.endlessBestScore}</b> 分
            ${myRank ? ` · 全服排名: <b style="color:#d97706;">第 #${myRank} 名</b>` : ''}
          </div>

          <div class="nick-form">
            <input
              id="nick-input"
              class="pixel-input"
              type="text"
              maxlength="12"
              placeholder="输入你的上榜昵称 (最多12字)"
              value="${this.escapeHtml(this.progress.playerNickname)}"
            />
            <button class="pixel-btn topbar-btn" id="btn-save-nick">
              ${this.isSyncingScore ? '上传中...' : '💾 保存并同步'}
            </button>
          </div>
          ${
            this.nickSavedToast
              ? `<div style="font-size:11px;font-weight:900;color:#16a34a;margin-bottom:6px;">${this.escapeHtml(this.nickSavedToast)}</div>`
              : ''
          }

          <div class="leaderboard-list">
            ${rowsHtml}
          </div>

          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px;">
            <button class="pixel-btn secondary topbar-btn" id="btn-refresh-lb">🔄 刷新榜单</button>
            ${
              this.screen !== 'play'
                ? `<button class="pixel-btn topbar-btn" id="btn-lb-play-endless">🍗 冲击全服第一</button>`
                : ''
            }
            <button class="pixel-btn topbar-btn" id="modal-close" style="background:#fde68a;">
              ${this.movesLeft <= 0 && this.screen === 'play' ? (this.isEndless ? '🚪 退出到主页' : '🚪 退出到地图') : '关闭'}
            </button>
          </div>
        </div>
      `;
    } else if (this.activeModal === 'win') {
      const starsStr = '★'.repeat(this.earnedStars) + '☆'.repeat(3 - this.earnedStars);
      const nextLv = CAMPAIGN_LEVELS.find((l) => l.id === this.currentLevel.id + 1);
      const isNextUnlocked = nextLv
        ? isLevelUnlocked(this.progress.unlockedLevel, this.progress.levelStars, nextLv.id)
        : false;
      const currentChapId = Math.ceil(this.currentLevel.id / 10);
      const isChapEnd = this.currentLevel.id === currentChapId * 10;
      const curChapStars = getChapterStars(this.progress.levelStars, currentChapId);
      const starGateHint =
        isChapEnd && nextLv && curChapStars < REQUIRED_CHAPTER_STARS
          ? `<div style="font-size:13px;font-weight:900;color:#dc2626;background:#fee2e2;border:2px solid #ef4444;padding:8px 12px;margin:10px 0;">
               🔒 解锁第 ${currentChapId + 1} 章需要前一章获得 ≥25★（当前 ${curChapStars}/25★，还差 ${REQUIRED_CHAPTER_STARS - curChapStars}★）！<br/>请返回选关地图提升前面关卡的星级！
             </div>`
          : isChapEnd && nextLv && curChapStars >= REQUIRED_CHAPTER_STARS
          ? `<div style="font-size:13px;font-weight:900;color:#16a34a;background:#dcfce7;border:2px solid #22c55e;padding:6px 12px;margin:10px 0;">
               🌟 本章星级已达 ${curChapStars}★（≥25★）！第 ${currentChapId + 1} 章已成功解锁！
             </div>`
          : '';

      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <img class="pixel-img" data-nailong-voice="1" style="cursor:pointer;" title="点击奶龙播放原声！" src="${this.getStickerUrl('nailong_happy')}" width="96" height="96" alt="win" />
          <h2 style="margin:8px 0 4px;color:#d97706;">🎉 闯关大成功！肚肚吃饱啦！</h2>
          <div style="font-size:34px;color:#f59e0b;text-shadow:2px 2px 0 #2b1e16;margin:6px 0;">
            ${starsStr}
          </div>
          <div style="font-weight:900;font-size:18px;margin-bottom:8px;">最终得分: ${this.score}</div>
          ${
            this.lastMovesBonus > 0
              ? `<div style="font-size:13px;font-weight:900;color:#16a34a;background:#dcfce7;border:2px solid #22c55e;padding:4px 10px;margin-bottom:10px;display:inline-block;">
                   🍗 剩余步数大奖: +${this.lastMovesBonus} 分！
                 </div>`
              : ''
          }
          ${starGateHint}
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            ${
              nextLv && isNextUnlocked
                ? `<button class="pixel-btn" id="modal-next-lv">▶ 下一关 (${nextLv.name.split('·')[0]})</button>`
                : ''
            }
            <button class="pixel-btn secondary" id="modal-retry">🔄 再玩一次</button>
            <button class="pixel-btn" id="modal-to-map" style="background:#fde68a;">🌴 选关地图</button>
          </div>
        </div>
      `;
    } else if (this.activeModal === 'lose') {
      const globalTop = Math.max(this.leaderboard?.topScore ?? 0, this.isEndless ? this.score : 0);
      const globalChamp =
        this.isEndless && this.score > 0 && this.score >= (this.leaderboard?.topScore ?? 0)
          ? this.escapeHtml(this.progress.playerNickname || '你创造新纪录!')
          : this.escapeHtml(this.leaderboard?.championName ?? '同步中...');
      const myRank = this.leaderboard?.playerRank;

      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <img class="pixel-img" data-nailong-voice="1" style="cursor:pointer;" title="点击奶龙播放原声！" src="${this.getStickerUrl('nailong_eat')}" width="84" height="84" alt="hungry" />
          <h2 style="margin:6px 0 4px;color:#dc2626;">
            ${this.isEndless ? '🍗 无尽挑战步数耗尽！' : '🥺 步数用完啦，肚肚还没吃饱...'}
          </h2>
          <div style="font-weight:900;font-size:17px;margin-bottom:8px;">
            本局得分: ${this.score}
          </div>
          ${
            this.isEndless
              ? `
            <div class="leaderboard-banner" style="margin-bottom:8px;">
              <div style="font-size:12px;font-weight:900;color:#b45309;">
                🌍 全服最高纪录: ${globalTop} 分 (${globalChamp})
              </div>
              <div style="font-size:11px;font-weight:800;color:#334155;margin-top:2px;">
                我的最高: ${this.progress.endlessBestScore} 分
                ${myRank ? ` · 当前全服第 #${myRank} 名` : ''}
              </div>
            </div>
            <div class="nick-form" style="margin-bottom:10px;">
              <input
                id="nick-input"
                class="pixel-input"
                type="text"
                maxlength="12"
                placeholder="输入昵称登上全服榜"
                value="${this.escapeHtml(this.progress.playerNickname)}"
              />
              <button class="pixel-btn topbar-btn" id="btn-save-nick">
                ${this.isSyncingScore ? '上传中...' : '📤 上榜改名'}
              </button>
            </div>
            ${
              this.nickSavedToast
                ? `<div style="font-size:11px;font-weight:900;color:#16a34a;margin-bottom:8px;">${this.escapeHtml(this.nickSavedToast)}</div>`
                : ''
            }
          `
              : ''
          }
          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            ${
              !this.usedContinue
                ? `<button class="pixel-btn" id="modal-free-continue">🍗 卖萌续命 (+5步·限1次)</button>`
                : `<button class="pixel-btn" disabled>🍗 续命已用完</button>`
            }
            ${
              this.isEndless
                ? `<button class="pixel-btn topbar-btn" id="modal-open-lb" style="background:#fed7aa;">🏆 全服榜</button>`
                : ''
            }
            <button class="pixel-btn" id="modal-retry">🔄 重新挑战</button>
            <button class="pixel-btn secondary" id="modal-to-map">${this.isEndless ? '🚪 退出到主页' : '返回选关'}</button>
          </div>
        </div>
      `;
    }

    this.root.appendChild(backdrop);

    backdrop.querySelector('#modal-close')?.addEventListener('click', () => {
      this.audio.playSelect();
      if (this.movesLeft <= 0 && this.screen === 'play') {
        this.activeModal = 'none';
        this.screen = this.isEndless ? 'title' : 'map';
        this.renderUI();
        return;
      }
      this.activeModal = 'none';
      this.renderUI();
    });
    backdrop.querySelector('#modal-retry')?.addEventListener('click', () => {
      this.startLevel(this.currentLevel, this.isEndless);
    });
    backdrop.querySelector('#modal-next-lv')?.addEventListener('click', () => {
      const nextLv = CAMPAIGN_LEVELS.find((l) => l.id === this.currentLevel.id + 1);
      if (nextLv) this.startLevel(nextLv, false);
    });
    backdrop.querySelector('#modal-to-map')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.activeModal = 'none';
      this.screen = this.isEndless ? 'title' : 'map';
      this.renderUI();
    });
    backdrop.querySelector('#modal-free-continue')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (this.usedContinue) return;
      this.usedContinue = true;
      const btn = ev.currentTarget as HTMLButtonElement | null;
      if (btn) btn.disabled = true;
      this.audio.unlock();
      const clip = this.audio.playNailongVoice();
      this.movesLeft = 5;
      this.activeModal = 'none';
      this.nailongPose = 'pat_belly';
      this.poseTimer = clip.durationMs / 1000;
      this.speechText = `${clip.subtitle} 抓住这 5 步一鼓作气过关吧！`;
      this.renderUI();
      this.updateHudDom();
    });
    backdrop.querySelector('#modal-open-lb')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.nickSavedToast = '';
      this.activeModal = 'leaderboard';
      this.renderUI();
      this.refreshGlobalLeaderboard();
    });
    backdrop.querySelector('#btn-refresh-lb')?.addEventListener('click', () => {
      this.audio.playSelect();
      this.refreshGlobalLeaderboard();
    });
    backdrop.querySelector('#btn-lb-play-endless')?.addEventListener('click', () => {
      this.startLevel(ENDLESS_LEVEL, true);
    });
    backdrop.querySelector('#btn-save-nick')?.addEventListener('click', async () => {
      const inputEl = backdrop.querySelector('#nick-input') as HTMLInputElement | null;
      if (!inputEl) return;
      const cleaned = inputEl.value
        .replace(/[<>"'`&/\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12);
      this.progress.playerNickname = cleaned;
      saveProgress(this.progress);
      this.audio.playSelect();

      const scoreToPush = Math.max(this.progress.endlessBestScore, this.isEndless ? this.score : 0);
      if (scoreToPush > 0) {
        this.nickSavedToast = '✅ 昵称与最高分已同步到服务器！';
        await this.syncEndlessScoreToServer(scoreToPush);
      } else {
        this.nickSavedToast = '✅ 昵称已保存！快去无尽模式打出一局分数上榜吧！';
        this.renderUI();
      }
    });
  }

  private animateSwapPair(a: Coord, b: Coord, reverse: boolean): Promise<void> {
    return this.animateProgress(155, (t) => {
      this.swapAnim = {
        a,
        b,
        progress: reverse ? 1 - t : t,
      };
    }).then(() => {
      this.swapAnim = null;
    });
  }

  private animateProgress(durationMs: number, onUpdate: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        onUpdate(t);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private lastFrameTs = performance.now();

  private tick(now: number): void {
    const dt = Math.min(0.05, (now - this.lastFrameTs) / 1000);
    this.lastFrameTs = now;
    const timeSec = now / 1000;

    // Update pose timers
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) {
        this.nailongPose = this.screen === 'play' && this.movesLeft <= 3 ? 'worried' : 'idle';
      }
    }
    if (this.bossHurtTimer > 0) {
      this.bossHurtTimer = Math.max(0, this.bossHurtTimer - dt);
    }
    if (this.bossAttackTimer > 0) {
      this.bossAttackTimer = Math.max(0, this.bossAttackTimer - dt);
    }
    if (this.xiaoqiCheerTimer > 0) {
      this.xiaoqiCheerTimer = Math.max(0, this.xiaoqiCheerTimer - dt);
    }
    if (this.boardShake > 0) {
      this.boardShake = Math.max(0, this.boardShake - dt * 36);
    }
    if (this.comboBanner) {
      this.comboBanner.timer -= dt;
      if (this.comboBanner.timer <= 0) {
        this.comboBanner = null;
        const slot = document.getElementById('combo-popup-slot');
        if (slot) slot.innerHTML = '';
      }
    }

    // Live dead-board auto-shuffle guard + Idle 5-second smart hint detection
    if (this.screen === 'play' && !this.isAnimating && this.activeModal === 'none' && this.movesLeft > 0) {
      if (this.engine.findValidMoves().length === 0) {
        this.isAnimating = true;
        this.performAutoShuffleVisual(true, false).finally(() => {
          this.isAnimating = false;
          this.lastActionTime = performance.now();
        });
      } else if (!this.hintPair && now - this.lastActionTime > 5000) {
        this.hintPair = this.engine.getHintMove();
      }
    }

    // Render live animated pixel mascots
    if (this.titleMascotCanvas) {
      renderNailongMascot(this.titleMascotCanvas, this.nailongPose, timeSec, 0.75);
    }
    if (this.playMascotCanvas) {
      renderNailongMascot(
        this.playMascotCanvas,
        this.nailongPose,
        timeSec,
        Math.min(1, this.bellyEnergy / 100)
      );
    }
    if (this.bossCanvas) {
      renderBombloongBoss(this.bossCanvas, this.bossHurtTimer, this.bossAttackTimer > 0, timeSec);
    }
    if (this.xiaoqiCanvas) {
      renderXiaoQiHelper(
        this.xiaoqiCanvas,
        this.xiaoqiCheerTimer > 0 || this.activeBooster !== null,
        timeSec
      );
    }
    if (this.boardCanvas) {
      this.updateEffects(dt);
      this.drawBoardCanvas(timeSec);
    }

    requestAnimationFrame((ts) => this.tick(ts));
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    for (let i = this.flyingSnacks.length - 1; i >= 0; i--) {
      const s = this.flyingSnacks[i];
      s.t += dt * 2.4;
      if (s.t >= 1) {
        this.flyingSnacks.splice(i, 1);
      } else {
        const inv = 1 - s.t;
        const ctrlX = (s.startX + s.targetX) * 0.5;
        const ctrlY = Math.min(s.startY, s.targetY) - 90;
        s.x = inv * inv * s.startX + 2 * inv * s.t * ctrlX + s.t * s.t * s.targetX;
        s.y = inv * inv * s.startY + 2 * inv * s.t * ctrlY + s.t * s.t * s.targetY;
      }
    }

    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const f = this.floatingScores[i];
      f.life += dt;
      f.y -= 36 * dt;
      if (f.life >= 0.75) this.floatingScores.splice(i, 1);
    }

    for (let i = this.activeBlasts.length - 1; i >= 0; i--) {
      const b = this.activeBlasts[i];
      b.timer += dt;
      if (b.timer >= b.duration) this.activeBlasts.splice(i, 1);
    }
  }

  private drawBoardCanvas(timeSec: number): void {
    const canvas = this.boardCanvas!;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

    if (this.boardShake > 0.2) {
      const sx = Math.round((Math.random() - 0.5) * this.boardShake);
      const sy = Math.round((Math.random() - 0.5) * this.boardShake);
      ctx.translate(sx, sy);
    }

    const rainbowPhase = Math.floor(timeSec * 8);

    // 1. Draw Checkerboard Pixel Cells & Ice / Crates
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.renderGrid[r]?.[c];
        if (!cell || cell.hole) continue;

        const x = c * CELL_PX;
        const y = r * CELL_PX;
        const isEven = (r + c) % 2 === 0;

        // Chapter-themed checkerboard cell
        const chapTheme = this.isEndless
          ? Math.min(3, Math.max(1, Math.ceil(this.progress.unlockedLevel / 10)))
          : Math.min(3, Math.max(1, this.selectedChapter));
        if (chapTheme === 2) {
          ctx.fillStyle = isEven ? '#FFF1F2' : '#E0F2FE';
          ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
          ctx.strokeStyle = '#93C5FD';
        } else if (chapTheme === 3) {
          ctx.fillStyle = isEven ? '#FAF5FF' : '#EDE9FE';
          ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
          ctx.strokeStyle = '#C084FC';
        } else {
          ctx.fillStyle = isEven ? '#FFFBEB' : '#FEF3C7';
          ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
          ctx.strokeStyle = '#E5C687';
        }
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, CELL_PX - 4, CELL_PX - 4);

        // Ice underlay (High-detail crystalline prism)
        if (cell.iceLevel > 0) {
          drawHighDetailIce(ctx, x, y, CELL_PX, cell.iceLevel as 1 | 2, timeSec);
        }

        // Wooden Snack Crate obstacle (High-detail timber planks, X-brace, iron brackets & rivets)
        if (cell.crateHp > 0) {
          drawHighDetailCrate(ctx, x, y, CELL_PX, cell.crateHp as 1 | 2);
        }
      }
    }

    // 2. Highlight Selected Cell & Hint Pair
    if (this.selectedCell) {
      const sx = this.selectedCell.col * CELL_PX;
      const sy = this.selectedCell.row * CELL_PX;
      ctx.strokeStyle = '#FF4D5E';
      ctx.lineWidth = 4;
      ctx.strokeRect(sx + 3, sy + 3, CELL_PX - 6, CELL_PX - 6);
    }

    if (this.hintPair && !this.isAnimating) {
      const pulse = (Math.floor(timeSec * 6) & 1) === 0;
      ctx.strokeStyle = pulse ? '#22C55E' : '#FACC15';
      ctx.lineWidth = 4;
      for (const hp of this.hintPair) {
        ctx.strokeRect(hp.col * CELL_PX + 4, hp.row * CELL_PX + 4, CELL_PX - 8, CELL_PX - 8);
      }
    }

    // 3. Draw Tiles (with swap interpolation, fall interpolation & match pop!)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.renderGrid[r]?.[c];
        if (!cell || cell.hole || !cell.tile) continue;

        let drawX = c * CELL_PX;
        let drawY = r * CELL_PX;
        let scale = 1;

        // Swap offset
        if (this.swapAnim) {
          const { a, b, progress } = this.swapAnim;
          if (r === a.row && c === a.col) {
            drawX = (a.col + (b.col - a.col) * progress) * CELL_PX;
            drawY = (a.row + (b.row - a.row) * progress) * CELL_PX;
          } else if (r === b.row && c === b.col) {
            drawX = (b.col + (a.col - b.col) * progress) * CELL_PX;
            drawY = (b.row + (a.row - b.row) * progress) * CELL_PX;
          }
        }

        // Fall offset
        const fallInfo = this.activeFalls.get(`${r},${c}`);
        if (fallInfo) {
          const { fall, progress } = fallInfo;
          drawX = (fall.fromCol + (fall.toCol - fall.fromCol) * progress) * CELL_PX;
          drawY = (fall.fromRow + (fall.toRow - fall.fromRow) * progress) * CELL_PX;
        }

        // Selected bounce or Hint wiggle
        if (this.selectedCell && this.selectedCell.row === r && this.selectedCell.col === c) {
          drawY += Math.round(Math.sin(timeSec * 14) * 3);
          scale = 1.08;
        } else if (
          this.hintPair &&
          ((this.hintPair[0].row === r && this.hintPair[0].col === c) ||
            (this.hintPair[1].row === r && this.hintPair[1].col === c))
        ) {
          drawY += Math.round(Math.sin(timeSec * 10) * 2.5);
        }

        // Clearing pop shrink
        if (this.clearingSet.has(`${r},${c}`)) {
          scale = this.clearPopProgress < 0.35 ? 1.22 : Math.max(0, 1.22 * (1 - this.clearPopProgress));
        } else if (this.shuffleAnimProgress > 0 && !cell.chain) {
          const p = this.shuffleAnimProgress;
          const centerPx = (BOARD_PX - CELL_PX) / 2;
          const pull = p < 0.5 ? (p / 0.5) * 0.28 : (1 - (p - 0.5) / 0.5) * 0.28;
          drawX = drawX + (centerPx - drawX) * pull;
          drawY = drawY + (centerPx - drawY) * pull;
          if (p < 0.5) {
            scale = Math.max(0.15, 1 - (p / 0.5) * 0.85);
          } else {
            const u = (p - 0.5) / 0.5;
            scale = u < 0.75 ? 0.15 + (u / 0.75) * 0.98 : 1.13 - ((u - 0.75) / 0.25) * 0.13;
          }
        }

        const spriteSize = Math.round(54 * scale);
        const offset = Math.round((CELL_PX - spriteSize) / 2);

        const blink = ((r * 7 + c * 13 + Math.floor(timeSec * 2)) % 19) === 0;
        const sprite =
          cell.tile.special === 'rainbow'
            ? getRainbowNailongSprite(rainbowPhase + r + c)
            : getTileSprite(cell.tile.color, blink);

        if (spriteSize > 2) {
          ctx.drawImage(sprite, Math.round(drawX + offset), Math.round(drawY + offset), spriteSize, spriteSize);
          drawSpecialBadge(ctx, Math.round(drawX), Math.round(drawY), CELL_PX, cell.tile.special, timeSec);
        }

        // Locked Chain overlay (High-detail 3D interlocked steel chain links & brass padlock)
        if (cell.chain) {
          drawHighDetailChain(ctx, Math.round(drawX), Math.round(drawY), CELL_PX, timeSec);
        }
      }
    }

    // 4. Draw Special Blast Beams & Shockwaves!
    for (const ab of this.activeBlasts) {
      const t = ab.timer / ab.duration;
      const ev = ab.event;
      const ox = ev.origin.col * CELL_PX + CELL_PX / 2;
      const oy = ev.origin.row * CELL_PX + CELL_PX / 2;

      ctx.save();
      ctx.globalAlpha = 1 - t * 0.75;

      if (ev.kind === 'line_h' || ev.kind === 'line_v' || ev.kind === 'cross3') {
        drawHighDetailLaser(ctx, ox, oy, BOARD_PX, CELL_PX, ev.kind, t, timeSec);
      } else if (ev.kind === 'bomb3' || ev.kind === 'bomb5' || ev.kind === 'belly_slam') {
        drawHighDetailBombExplosion(ctx, ox, oy, CELL_PX, ev.kind, t, timeSec);
      } else if (ev.kind === 'rainbow_rays' && ev.targets) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 5;
        for (const tg of ev.targets) {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(tg.col * CELL_PX + CELL_PX / 2, tg.row * CELL_PX + CELL_PX / 2);
          ctx.stroke();
        }
      } else if (ev.kind === 'rainbow_all') {
        ctx.fillStyle = `rgba(255, 245, 157, ${0.7 * (1 - t)})`;
        ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);
      }
      ctx.restore();
    }

    // 5. Draw Flying Snacks zooming toward Nailong!
    for (const s of this.flyingSnacks) {
      const spr = getTileSprite(s.color, false);
      ctx.drawImage(spr, Math.round(s.x - 18), Math.round(s.y - 18), 36, 36);
    }

    // 6. Draw Pixel Particles & Floating Scores!
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    for (const f of this.floatingScores) {
      ctx.fillStyle = '#2B1E16';
      ctx.fillText(f.text, Math.round(f.x + 2), Math.round(f.y + 2));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }

    ctx.restore();
  }
}
