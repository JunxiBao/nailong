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
  TILE_KIND_ORDER,
} from '../assets/pixelSprites';
import {
  CAMPAIGN_LEVELS,
  ENDLESS_LEVEL,
  loadProgress,
  saveProgress,
  SaveProgress,
} from '../levels/campaignLevels';
import { BoardEngine } from '../match3/BoardEngine';
import {
  BlastEffectEvent,
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

const NAILONG_QUIPS = [
  '我的大肚肚真的很酷酷~ duang!',
  '啊呜！再多消几个烤鸡腿嘛！',
  '4连能喷火，5连变彩虹奶龙哦！',
  '把两个特效棋子交换试试？超爽哒！',
  '暴暴龙那家伙休想抢走我的零食！',
  '肚肚能量满格时，记得点我放大招！',
];

export class GameApp {
  private root: HTMLElement;
  private audio = new MatchAudio();
  private progress: SaveProgress = loadProgress();
  private stickers: StickerEntry[] = [];

  private screen: 'title' | 'map' | 'play' = 'title';
  private activeModal: 'none' | 'stickers' | 'rules' | 'win' | 'lose' = 'none';

  // Gameplay state
  private currentLevel: LevelConfig = CAMPAIGN_LEVELS[0];
  private isEndless = false;
  private endlessNextMilestone = 2500;
  private engine!: BoardEngine;
  private renderGrid: CellState[][] = [];

  private score = 0;
  private movesLeft = 20;
  private movesUsed = 0;
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

    // Lock full-screen viewport against mobile pull-to-refresh / vertical rubber-banding
    document.addEventListener(
      'touchmove',
      (ev) => {
        const target = ev.target as HTMLElement | null;
        const modal = target?.closest('.modal-card') as HTMLElement | null;
        if (modal && modal.scrollHeight > modal.clientHeight) {
          return;
        }
        ev.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener('pointerup', () => {
      this.dragStartCell = null;
      this.dragStartPt = null;
    });

    this.loadStickerManifest();
    this.renderUI();
    requestAnimationFrame((ts) => this.tick(ts));
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

  private getStickerUrl(id: string): string {
    const found = this.stickers.find((s) => s.id === id);
    return found ? found.url : '/assets/stickers/nailong_happy.png';
  }

  private startLevel(level: LevelConfig, endless = false): void {
    this.audio.unlock();
    this.currentLevel = level;
    this.isEndless = endless;
    this.endlessNextMilestone = 2500;
    this.engine = new BoardEngine(level);
    this.renderGrid = this.engine.cloneGrid();

    this.score = 0;
    this.movesLeft = level.moves;
    this.movesUsed = 0;
    this.bellyEnergy = 25;
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

  private renderUI(): void {
    this.titleMascotCanvas = null;
    this.playMascotCanvas = null;
    this.bossCanvas = null;
    this.xiaoqiCanvas = null;
    this.boardCanvas = null;

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
          <div class="hero-sticker-card" title="基于 123.jpeg 像素化的奶龙流口水贴纸">
            <img class="pixel-img" src="${happyUrl}" width="96" height="96" alt="奶龙流口水像素贴纸" />
            <div style="font-size:11px;font-weight:800;margin-top:4px;">馋得流口水</div>
          </div>

          <div id="title-mascot-box" style="cursor:pointer;" title="戳戳奶龙的大肚皮！">
            <canvas id="title-mascot" width="192" height="192"></canvas>
            <div style="font-size:12px;font-weight:900;color:#b45309;">▲ 点我duang~duang大肚皮 ▲</div>
          </div>

          <div class="hero-sticker-card right" title="基于参考图集像素化的奶龙全身贴纸">
            <img class="pixel-img" src="${bellyUrl}" width="96" height="96" alt="奶龙歪头秀大肚肚贴纸" />
            <div style="font-size:11px;font-weight:800;margin-top:4px;">歪头秀大肚肚</div>
          </div>
        </div>

        <div class="title-actions">
          <button class="pixel-btn" id="btn-start-map" style="font-size:18px;padding:13px 20px;">
            ▶ 开始闯关大冒险 (10关)
          </button>
          <button class="pixel-btn secondary" id="btn-start-endless">
            🍗 无尽干饭王模式 (最高: ${this.progress.endlessBestScore})
          </button>
          <div style="display:flex;gap:10px;">
            <button class="pixel-btn" id="btn-open-stickers" style="flex:1;font-size:14px;background:#fde68a;">
              📒 像素表情图鉴
            </button>
            <button class="pixel-btn" id="btn-open-rules" style="flex:1;font-size:14px;background:#e0e7ff;">
              ❓ 消除秘籍
            </button>
          </div>
        </div>
      </div>
    `;

    this.titleMascotCanvas = document.getElementById('title-mascot') as HTMLCanvasElement;
    document.getElementById('title-mascot-box')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playBellyBounce();
      this.nailongPose = 'pat_belly';
      this.poseTimer = 1.1;
    });
    document.getElementById('btn-start-map')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSelect();
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

    const nodesHtml = CAMPAIGN_LEVELS.map((lv) => {
      const unlocked = lv.id <= this.progress.unlockedLevel;
      const isCurrent = lv.id === this.progress.unlockedLevel;
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
          ${
            isCurrent
              ? `<div class="current-tag">◀ 奶龙在这儿!</div>`
              : ''
          }
        </div>
      `;
    }).join('');

    this.root.innerHTML = `
      <div class="pixel-box map-screen">
        <div class="map-header">
          <button class="pixel-btn secondary topbar-btn" id="btn-back-title">
            ◀ 首页
          </button>
          <div class="map-title">🌴 美食岛闯关大地图</div>
          <div class="star-pill">★ ${totalStars} / ${maxStars}</div>
        </div>

        <div class="vine-map-grid">
          ${nodesHtml}
        </div>

        <div class="map-footer">
          <div class="map-tip">
            💡 第 5 关与第 10 关为【暴暴龙 Boss 战】！
          </div>
          <button class="pixel-btn topbar-btn" id="btn-map-endless">
            🍗 无尽干饭模式
          </button>
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
    this.root.querySelectorAll<HTMLElement>('.level-node').forEach((el) => {
      el.addEventListener('click', () => {
        const id = Number(el.dataset.lv);
        if (id > this.progress.unlockedLevel) return;
        const lv = CAMPAIGN_LEVELS.find((l) => l.id === id);
        if (lv) this.startLevel(lv, false);
      });
    });
  }

  private renderPlayScreen(): void {
    const star3 = this.currentLevel.starScores[2];
    const scorePct = Math.min(100, Math.round((this.score / star3) * 100));
    const bellyReady = this.bellyEnergy >= 100;

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
                <span>🎯 目标</span>
                <span class="palette-preview" title="本关棋盘可消除元素表">
                  ${this.isEndless ? '<span style="font-size:11px;color:#b45309;">每2500分+4步</span>' : this.buildPalettePreviewHtml()}
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
                      <span>👾 暴暴龙</span>
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
                      ${this.progress.boosters.hammer <= 0 ? 'disabled' : ''}>
                <span>🔨 木槌(${this.progress.boosters.hammer})</span>
                <span class="booster-sub">敲碎任意单格</span>
              </button>
              <button class="booster-btn ${this.activeBooster === 'swap_glove' ? 'active' : ''}" id="boost-glove"
                      ${this.progress.boosters.swap_glove <= 0 ? 'disabled' : ''}>
                <span>🧤 手套(${this.progress.boosters.swap_glove})</span>
                <span class="booster-sub">无视规则互换</span>
              </button>
              <button class="booster-btn" id="boost-shuffle"
                      ${this.progress.boosters.shuffle <= 0 ? 'disabled' : ''}>
                <span>🌀 重排(${this.progress.boosters.shuffle})</span>
                <span class="booster-sub">不耗步洗牌</span>
              </button>
              <button class="booster-btn" id="boost-plus5"
                      ${this.progress.boosters.plus5 <= 0 ? 'disabled' : ''}>
                <span>➕ +5步(${this.progress.boosters.plus5})</span>
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
      .map((color) => {
        const idx = Math.max(0, TILE_KIND_ORDER.indexOf(color));
        return `<span class="palette-mini-icon" title="可消除：${COLOR_META[color].label}" style="background-position:-${idx * 2 * 16}px 0;"></span>`;
      })
      .join('');
  }

  private buildGoalsHtml(): string {
    if (this.isEndless) {
      return `
        <div class="goal-chip">
          🍗 下一奖励档: ${this.endlessNextMilestone} 分 (+4步)
        </div>
      `;
    }
    return this.goals
      .map((g) => {
        const done = g.current >= g.target;
        let icon = '⭐';
        let label = '';
        if (g.type === 'collect' && g.color) {
          const idx = Math.max(0, TILE_KIND_ORDER.indexOf(g.color));
          icon = `<span class="goal-tile-icon" style="background-position:-${idx * 2 * 20}px 0;"></span>`;
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
          icon = '👾';
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
      const ready = clampedBelly >= 100 && !this.isAnimating;
      bellyBtn.disabled = !ready;
      bellyBtn.className = `pixel-btn belly-slam-btn ${clampedBelly >= 100 ? 'accent' : ''}`;
      bellyBtn.textContent = clampedBelly >= 100 ? '💥 肚肚泰山压顶!' : '吃零食攒满放大招';
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
      this.screen = this.isEndless ? 'title' : 'map';
      this.renderUI();
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
      if (this.isAnimating) return;
      this.audio.unlock();
      if (this.bellyEnergy >= 100) {
        this.executeBellySlamSkill();
      } else {
        this.audio.playBellyBounce();
        this.nailongPose = 'pat_belly';
        this.poseTimer = 0.9;
        this.speechText = NAILONG_QUIPS[Math.floor(Math.random() * NAILONG_QUIPS.length)];
        this.updateHudDom();
      }
    };

    document.getElementById('mascot-click-zone')?.addEventListener('click', triggerBellySkill);
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
      if (this.isAnimating || this.progress.boosters.hammer <= 0) return;
      this.audio.playSelect();
      this.xiaoqiCheerTimer = 1.4;
      this.activeBooster = this.activeBooster === 'hammer' ? null : 'hammer';
      this.speechText = this.activeBooster
        ? '小七木槌已就绪：请点击棋盘上任意一格敲碎它！'
        : '已取消木槌瞄准。';
      this.renderUI();
    });

    document.getElementById('boost-glove')?.addEventListener('click', () => {
      if (this.isAnimating || this.progress.boosters.swap_glove <= 0) return;
      this.audio.playSelect();
      this.xiaoqiCheerTimer = 1.4;
      this.activeBooster = this.activeBooster === 'swap_glove' ? null : 'swap_glove';
      this.selectedCell = null;
      this.speechText = this.activeBooster
        ? '强换手套已就绪：点击或滑动相邻两格直接互换！'
        : '已取消强换手套。';
      this.renderUI();
    });

    document.getElementById('boost-shuffle')?.addEventListener('click', () => {
      if (this.isAnimating || this.progress.boosters.shuffle <= 0) return;
      this.progress.boosters.shuffle--;
      saveProgress(this.progress);
      this.audio.playSpecialBlast('rainbow_rays');
      this.xiaoqiCheerTimer = 1.6;
      this.engine.shuffleBoard();
      this.renderGrid = this.engine.cloneGrid();
      this.speechText = '小七开启旋风重排！棋盘焕然一新啦！';
      this.renderUI();
    });

    document.getElementById('boost-plus5')?.addEventListener('click', () => {
      if (this.isAnimating || this.progress.boosters.plus5 <= 0) return;
      this.progress.boosters.plus5--;
      saveProgress(this.progress);
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
      if (this.isAnimating || this.activeModal !== 'none') return;
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
      if (!this.dragStartCell || !this.dragStartPt || this.isAnimating) return;
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
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.audio.playSwap();

    // Animate visual swap forward
    await this.animateSwapPair(a, b, false);

    const usingGlove = this.activeBooster === 'swap_glove';
    const res = usingGlove ? this.engine.useForceSwap(a, b) : this.engine.trySwap(a, b);

    if (!res.valid) {
      this.audio.playInvalidSwap();
      this.speechText = '咦？这俩凑不成 3 连消除哦，弹回来啦~';
      this.updateHudDom();
      await this.animateSwapPair(a, b, true);
      this.isAnimating = false;
      return;
    }

    // Commit visual swap into renderGrid so tile pop starts smoothly from post-swap positions
    const tmpTile = this.renderGrid[a.row][a.col].tile;
    this.renderGrid[a.row][a.col].tile = this.renderGrid[b.row][b.col].tile;
    this.renderGrid[b.row][b.col].tile = tmpTile;

    if (usingGlove) {
      this.progress.boosters.swap_glove--;
      this.activeBooster = null;
      saveProgress(this.progress);
      this.renderUI();
      this.isAnimating = true;
    }

    if (res.consumedMove) {
      this.movesLeft = Math.max(0, this.movesLeft - 1);
      this.movesUsed++;
    }

    if (res.steps.length === 0) {
      this.renderGrid = this.engine.cloneGrid();
      this.updateHudDom();
      this.isAnimating = false;
      return;
    }

    await this.playResolutionSteps(res.steps, res.shuffledAfter);
    await this.postTurnChecks(res.consumedMove);
    this.isAnimating = false;
    this.lastActionTime = performance.now();
    this.updateHudDom();
  }

  private async executeHammerBooster(target: Coord): Promise<void> {
    this.isAnimating = true;
    const res = this.engine.useHammer(target);
    if (!res.valid) {
      this.isAnimating = false;
      return;
    }
    this.progress.boosters.hammer--;
    this.activeBooster = null;
    saveProgress(this.progress);
    this.audio.playSpecialBlast('bomb3');
    this.renderUI();
    this.isAnimating = true;

    await this.playResolutionSteps(res.steps, res.shuffledAfter);
    await this.postTurnChecks(false);
    this.isAnimating = false;
    this.updateHudDom();
  }

  private async executeBellySlamSkill(): Promise<void> {
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
        this.boardShake = Math.max(this.boardShake, step.blasts[0].kind === 'rainbow_all' ? 16 : 8);
      }

      if (step.comboIndex >= 2 || step.blasts.length > 0) {
        this.showComboPopup(step.comboIndex, step.blasts.length > 0);
      }

      // 2. Register blast visuals, particles & flying snacks toward Nailong!
      for (const b of step.blasts) {
        this.activeBlasts.push({ event: b, timer: 0, duration: 0.34 });
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
      this.renderGrid = this.engine.cloneGrid();
      this.speechText = '棋盘死局啦，小七自动施展旋风重排！';
      this.updateHudDom();
      await this.sleep(350);
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
      while (this.score >= this.endlessNextMilestone) {
        this.movesLeft += 4;
        this.endlessNextMilestone += 2500;
        this.progress.boosters.hammer++;
        this.audio.playVictory();
        this.speechText = `干饭突破新里程碑！奖励 +4 步与小七木槌！`;
      }
      if (this.score > this.progress.endlessBestScore) {
        this.progress.endlessBestScore = this.score;
        saveProgress(this.progress);
      }
      if (this.movesLeft <= 0) {
        this.audio.playOutOfMoves();
        this.activeModal = 'lose';
        this.renderUI();
      }
      return;
    }

    // Check Campaign Victory!
    const allDone = this.goals.every((g) => g.current >= g.target);
    if (allDone) {
      // Remaining moves bonus!
      if (this.movesLeft > 0) {
        const bonus = this.movesLeft * 120;
        this.score += bonus;
        this.speechText = `过关啦！剩余 ${this.movesLeft} 步转化为 +${bonus} 美味加分！`;
        this.movesLeft = 0;
        this.updateHudDom();
      }
      const [s1, s2, s3] = this.currentLevel.starScores;
      this.earnedStars = this.score >= s3 ? 3 : this.score >= s2 ? 2 : this.score >= s1 ? 1 : 1;

      const lvId = this.currentLevel.id;
      this.progress.levelStars[lvId] = Math.max(this.progress.levelStars[lvId] ?? 0, this.earnedStars);
      this.progress.levelBestScores[lvId] = Math.max(this.progress.levelBestScores[lvId] ?? 0, this.score);
      if (lvId >= this.progress.unlockedLevel && lvId < CAMPAIGN_LEVELS.length) {
        this.progress.unlockedLevel = lvId + 1;
      }
      // Reward 1 random booster on 3-star clear!
      if (this.earnedStars === 3) {
        this.progress.boosters.hammer++;
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
        this.speechText = '哎呀！暴暴龙往棋盘扔了捣乱障碍，快消除它！';
        this.updateHudDom();
        await this.sleep(300);
      }
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
    } else if (combo === 3 || hasSpecial) {
      title = '真香暴击! GREAT!';
      stickerId = 'nailong_happy';
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

  private appendModal(): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    if (this.activeModal === 'stickers') {
      const cards = this.stickers
        .map(
          (s) => `
          <div class="sticker-item">
            <img class="pixel-img" src="${s.url}" width="96" height="96" alt="${s.desc}" />
            <div style="font-weight:900;font-size:12px;">${s.desc}</div>
            <div style="font-size:10px;color:#64748b;">
              ${s.origin === 'online-pixelized' ? '🖼️ 参考原图像素化' : '🎨 像素精绘角色'}
            </div>
          </div>
        `
        )
        .join('');

      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <h2 style="margin:0 0 6px;">📒 奶龙像素表情包图鉴</h2>
          <div style="font-size:12px;color:#5c3d28;">
            以下 96×96 高清像素贴纸基于分类参考图集（奶龙 / 暴暴龙 / 小七）经复古调色板量化与像素描边生成：
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
    } else if (this.activeModal === 'win') {
      const starsStr = '★'.repeat(this.earnedStars) + '☆'.repeat(3 - this.earnedStars);
      const nextLv = CAMPAIGN_LEVELS.find((l) => l.id === this.currentLevel.id + 1);
      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <img class="pixel-img" src="${this.getStickerUrl('nailong_happy')}" width="96" height="96" alt="win" />
          <h2 style="margin:8px 0 4px;color:#d97706;">🎉 闯关大成功！肚肚吃饱啦！</h2>
          <div style="font-size:34px;color:#f59e0b;text-shadow:2px 2px 0 #2b1e16;margin:6px 0;">
            ${starsStr}
          </div>
          <div style="font-weight:900;font-size:18px;margin-bottom:14px;">最终得分: ${this.score}</div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            ${
              nextLv
                ? `<button class="pixel-btn" id="modal-next-lv">▶ 下一关 (${nextLv.name.split('·')[0]})</button>`
                : ''
            }
            <button class="pixel-btn secondary" id="modal-retry">🔄 再玩一次</button>
            <button class="pixel-btn" id="modal-to-map" style="background:#fde68a;">🌴 选关地图</button>
          </div>
        </div>
      `;
    } else if (this.activeModal === 'lose') {
      backdrop.innerHTML = `
        <div class="pixel-box modal-card">
          <img class="pixel-img" src="${this.getStickerUrl('nailong_eat')}" width="96" height="96" alt="hungry" />
          <h2 style="margin:8px 0 6px;color:#dc2626;">🥺 步数用完啦，肚肚还没吃饱...</h2>
          <div style="font-weight:800;font-size:15px;margin-bottom:14px;">
            本局得分: ${this.score}
          </div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <button class="pixel-btn accent" id="modal-free-continue">
              🍗 奶龙卖萌续命 (+5步继续!)
            </button>
            <button class="pixel-btn" id="modal-retry">🔄 重新挑战</button>
            <button class="pixel-btn secondary" id="modal-to-map">返回</button>
          </div>
        </div>
      `;
    }

    this.root.appendChild(backdrop);

    backdrop.querySelector('#modal-close')?.addEventListener('click', () => {
      this.audio.playSelect();
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
      this.activeModal = 'none';
      this.screen = this.isEndless ? 'title' : 'map';
      this.renderUI();
    });
    backdrop.querySelector('#modal-free-continue')?.addEventListener('click', () => {
      this.audio.playBellyBounce();
      this.movesLeft += 5;
      this.activeModal = 'none';
      this.nailongPose = 'pat_belly';
      this.poseTimer = 1.0;
      this.speechText = '满血复活！再给我 5 步一定吃光它们！';
      this.renderUI();
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

    // Idle 4-second smart hint detection
    if (
      this.screen === 'play' &&
      !this.isAnimating &&
      this.activeModal === 'none' &&
      !this.hintPair &&
      now - this.lastActionTime > 4200
    ) {
      this.hintPair = this.engine.getHintMove();
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

        // Warm biscuit checkerboard cell
        ctx.fillStyle = isEven ? '#FFFBEB' : '#FEF3C7';
        ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
        ctx.strokeStyle = '#E5C687';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, CELL_PX - 4, CELL_PX - 4);

        // Ice underlay
        if (cell.iceLevel > 0) {
          ctx.fillStyle = cell.iceLevel === 2 ? 'rgba(56, 189, 248, 0.72)' : 'rgba(186, 230, 253, 0.78)';
          ctx.fillRect(x + 2, y + 2, CELL_PX - 4, CELL_PX - 4);
          ctx.strokeStyle = cell.iceLevel === 2 ? '#0284C7' : '#38BDF8';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 4, y + 4, CELL_PX - 8, CELL_PX - 8);
          // Pixel ice shine
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 7, y + 7, 10, 4);
          ctx.fillRect(x + 7, y + 11, 4, 6);
        }

        // Wooden Snack Crate obstacle
        if (cell.crateHp > 0) {
          ctx.fillStyle = cell.crateHp === 2 ? '#92400E' : '#B45309';
          ctx.fillRect(x + 4, y + 4, CELL_PX - 8, CELL_PX - 8);
          ctx.fillStyle = cell.crateHp === 2 ? '#B45309' : '#D97706';
          ctx.fillRect(x + 8, y + 8, CELL_PX - 16, CELL_PX - 16);
          ctx.strokeStyle = '#2B1E16';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 4, y + 4, CELL_PX - 8, CELL_PX - 8);
          // Diagonal wood plank / crack
          ctx.fillStyle = cell.crateHp === 2 ? '#FDE68A' : '#2B1E16';
          for (let d = 0; d < 40; d += 4) {
            ctx.fillRect(x + 10 + d, y + 10 + d, 4, 4);
          }
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

        // Locked Chain overlay (on top of tile)
        if (cell.chain) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(drawX + 8, drawY + 8);
          ctx.lineTo(drawX + CELL_PX - 8, drawY + CELL_PX - 8);
          ctx.moveTo(drawX + CELL_PX - 8, drawY + 8);
          ctx.lineTo(drawX + 8, drawY + CELL_PX - 8);
          ctx.stroke();
          // Padlock center pixel icon
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(drawX + 24, drawY + 24, 16, 16);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX + 24, drawY + 24, 16, 16);
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

      if (ev.kind === 'line_h') {
        const h = Math.max(6, Math.round(34 * (1 - t)));
        ctx.fillStyle = '#FF5722';
        ctx.fillRect(0, oy - h / 2, BOARD_PX, h);
        ctx.fillStyle = '#FFF59D';
        ctx.fillRect(0, oy - h / 4, BOARD_PX, h / 2);
      } else if (ev.kind === 'line_v') {
        const w = Math.max(6, Math.round(34 * (1 - t)));
        ctx.fillStyle = '#FF5722';
        ctx.fillRect(ox - w / 2, 0, w, BOARD_PX);
        ctx.fillStyle = '#FFF59D';
        ctx.fillRect(ox - w / 4, 0, w / 2, BOARD_PX);
      } else if (ev.kind === 'cross3') {
        ctx.fillStyle = 'rgba(255, 112, 67, 0.78)';
        ctx.fillRect(0, oy - CELL_PX * 1.5, BOARD_PX, CELL_PX * 3);
        ctx.fillRect(ox - CELL_PX * 1.5, 0, CELL_PX * 3, BOARD_PX);
      } else if (ev.kind === 'bomb3' || ev.kind === 'bomb5' || ev.kind === 'belly_slam') {
        const maxR = ev.kind === 'bomb3' ? CELL_PX * 1.8 : CELL_PX * 3.2;
        const rad = maxR * t;
        ctx.strokeStyle = '#FFEA00';
        ctx.lineWidth = 10 * (1 - t);
        ctx.strokeRect(ox - rad, oy - rad, rad * 2, rad * 2);
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

    ctx.font = '900 18px "Courier New", monospace';
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
