import { BoosterType, LevelConfig } from '../match3/types';

export interface ChapterMeta {
  id: number;
  title: string;
  shortTitle: string;
  startLevel: number;
  endLevel: number;
  bgGradient: string;
  bgImage: string;
  tip: string;
}

export const CAMPAIGN_CHAPTERS: ChapterMeta[] = [
  {
    id: 1,
    title: '🌴 第1章 · 阳光野餐岛',
    shortTitle: '🌴 野餐 (1-10)',
    startLevel: 1,
    endLevel: 10,
    bgGradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 50%, #fef9c3 100%)',
    bgImage: '/assets/models/bg_chapter_1.png',
    tip: '💡 第 5 关与第 10 关为【野餐岛 Boss 战】！',
  },
  {
    id: 2,
    title: '🍨 第2章 · 冰晶甜品湾',
    shortTitle: '🍨 甜品 (11-20)',
    startLevel: 11,
    endLevel: 20,
    bgGradient: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 50%, #fce7f3 100%)',
    bgImage: '/assets/models/bg_chapter_2.png',
    tip: '💡 解锁本章需第1章获得≥25★！第 15 关与第 20 关为 Boss 战！',
  },
  {
    id: 3,
    title: '🚀 第3章 · 紫兵机械堡',
    shortTitle: '🚀 机械 (21-30)',
    startLevel: 21,
    endLevel: 30,
    bgGradient: 'linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 50%, #fef3c7 100%)',
    bgImage: '/assets/models/bg_chapter_3.png',
    tip: '💡 解锁本章需第2章获得≥25★！第 25 关与第 30 关为 Boss 战！',
  },
  {
    id: 4,
    title: '🌋 第4章 · 熔岩烤肉谷',
    shortTitle: '🌋 烤肉 (31-40)',
    startLevel: 31,
    endLevel: 40,
    bgGradient: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 50%, #ffedd5 100%)',
    bgImage: '/assets/models/bg_chapter_4.png',
    tip: '💡 解锁本章需第3章获得≥25★！第 35 关与第 40 关为【熔岩暴暴龙 Boss 战】！',
  },
  {
    id: 5,
    title: '🌌 第5章 · 星河吃货殿',
    shortTitle: '🌌 星河 (41-50)',
    startLevel: 41,
    endLevel: 50,
    bgGradient: 'linear-gradient(180deg, #e0e7ff 0%, #ede9fe 50%, #fef3c7 100%)',
    bgImage: '/assets/models/bg_chapter_5.png',
    tip: '💡 解锁本章需第4章获得≥25★！第 45 关与第 50 关为【终极食神 Boss 战】！',
  },
];

export const REQUIRED_CHAPTER_STARS = 25;

export function isAllClear(unlockedLevel: number, levelStars: Record<number, number>): boolean {
  return unlockedLevel > 50 || (levelStars[50] ?? 0) > 0;
}

export function getChapterStars(levelStars: Record<number, number>, chapterId: number): number {
  const chap = CAMPAIGN_CHAPTERS.find((c) => c.id === chapterId);
  if (!chap) return 0;
  let sum = 0;
  for (let lv = chap.startLevel; lv <= chap.endLevel; lv++) {
    sum += levelStars[lv] ?? 0;
  }
  return sum;
}

export function isChapterUnlocked(
  unlockedLevel: number,
  levelStars: Record<number, number>,
  chapterId: number
): boolean {
  if (chapterId <= 1) return true;
  for (let c = 1; c < chapterId; c++) {
    const prevChap = CAMPAIGN_CHAPTERS.find((ch) => ch.id === c);
    if (!prevChap) return false;
    const prevCompleted =
      (levelStars[prevChap.endLevel] ?? 0) > 0 || unlockedLevel >= prevChap.endLevel + 1;
    const prevStars = getChapterStars(levelStars, c);
    if (!prevCompleted || prevStars < REQUIRED_CHAPTER_STARS) {
      return false;
    }
  }
  return true;
}

export function isLevelUnlocked(
  unlockedLevel: number,
  levelStars: Record<number, number>,
  levelId: number
): boolean {
  const chapId = Math.ceil(levelId / 10);
  if (!isChapterUnlocked(unlockedLevel, levelStars, chapId)) {
    return false;
  }
  return levelId <= unlockedLevel;
}

function countLayoutLayers(layout: string[], kind: 'ice' | 'crate' | 'chain'): number {
  let sum = 0;
  for (const row of layout) {
    for (const ch of row) {
      if (kind === 'ice') {
        if (ch === '1' || ch === 'I') sum += 1;
        else if (ch === '2') sum += 2;
      } else if (kind === 'crate') {
        if (ch === 'c' || ch === 'C') sum += 1; // counts broken crates
      } else if (kind === 'chain') {
        if (ch === 'L' || ch === 'I') sum += 1;
      }
    }
  }
  return sum;
}

// ============================================================================
// CHAPTER 1 LAYOUTS (Levels 1 - 10): Sunny Picnic Island
// ============================================================================
const L1_LAYOUT = [
  '#......#',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '#......#',
];

const L2_LAYOUT = [
  '#......#',
  '........',
  '...c....',
  '........',
  '........',
  '....c...',
  '........',
  '#......#',
];

const L3_LAYOUT = [
  '........',
  '........',
  '..1111..',
  '..1221..',
  '..1221..',
  '..1111..',
  '........',
  '........',
];

const L4_LAYOUT = [
  '.##..##.',
  '..1..1..',
  '.c1111c.',
  '..1221..',
  '..1111..',
  '#..22..#',
  '##....##',
  '###..###',
];

const L5_BOSS_LAYOUT = [
  '........',
  '..L11L..',
  '.1.11.1.',
  '........',
  '........',
  '.1.11.1.',
  '..L11L..',
  '........',
];

const L6_CRATE_LAYOUT = [
  '........',
  '.c....c.',
  '..c..c..',
  '..cCCc..',
  '..cCCc..',
  '..c..c..',
  '.c....c.',
  '........',
];

const L7_CHAIN_LAYOUT = [
  '#......#',
  '..L11L..',
  '.121121.',
  '........',
  '........',
  '.121121.',
  '..L11L..',
  '#......#',
];

const L8_BELLY_LAYOUT = [
  '##....##',
  '#..L...#',
  '........',
  '...cc...',
  '...cc...',
  '........',
  '#...L..#',
  '##....##',
];

const L9_FORTRESS_LAYOUT = [
  '........',
  '.c.LL.c.',
  '..1221..',
  '.1.CC.1.',
  '.1.CC.1.',
  '..1221..',
  '.c.LL.c.',
  '........',
];

const L10_FINAL_BOSS_LAYOUT = [
  '#......#',
  '.c.LL.c.',
  '..1221..',
  '.1.CC.1.',
  '.1.CC.1.',
  '..1221..',
  '.c.LL.c.',
  '#......#',
];

// ============================================================================
// CHAPTER 2 LAYOUTS (Levels 11 - 20): Crystal Dessert Bay
// ============================================================================
const L11_TWIN_BRIDGE_LAYOUT = [
  '........',
  '..c..c..',
  '........',
  '#..11..#',
  '#..11..#',
  '........',
  '..c..c..',
  '........',
];

const L12_DONUT_LAYOUT = [
  '#......#',
  '..1111..',
  '.12..21.',
  '.1.##.1.',
  '.1.##.1.',
  '.12..21.',
  '..1111..',
  '#......#',
];

const L13_PATROL_LAYOUT = [
  '........',
  '.c....L.',
  '..C..1..',
  '...cc...',
  '...cc...',
  '..1..C..',
  '.L....c.',
  '........',
];

const L14_HOURGLASS_LAYOUT = [
  '........',
  '.112211.',
  '#..11..#',
  '##.LL.##',
  '##.LL.##',
  '#..11..#',
  '.112211.',
  '........',
];

const L15_BOSS_MINION_LAYOUT = [
  '#......#',
  '.c.11.c.',
  '..L..L..',
  '........',
  '........',
  '..L..L..',
  '.c.11.c.',
  '#......#',
];

const L16_WAFFLE_LAYOUT = [
  '........',
  '.c.c.c..',
  '........',
  '..C.C.c.',
  '.c.C.C..',
  '........',
  '..c.c.c.',
  '........',
];

const L17_PRISM_LAYOUT = [
  '##....##',
  '#..LL..#',
  '..1221..',
  '.L2112L.',
  '.L2112L.',
  '..1221..',
  '#..LL..#',
  '##....##',
];

const L18_FOUNTAIN_LAYOUT = [
  '........',
  '.1c..c1.',
  '.11..11.',
  '..C..C..',
  '..C..C..',
  '.11..11.',
  '.1c..c1.',
  '........',
];

const L19_TERRACE_LAYOUT = [
  '........',
  '.11..11.',
  '.22cc22.',
  '..LCCL..',
  '..LCCL..',
  '.22cc22.',
  '.11..11.',
  '........',
];

const L20_BOSS_CAPTAIN_LAYOUT = [
  '#......#',
  '..L11L..',
  '.c.22.c.',
  '.1....1.',
  '.1....1.',
  '.c.22.c.',
  '..L11L..',
  '#......#',
];

// ============================================================================
// CHAPTER 3 LAYOUTS (Levels 21 - 30): Minion Mecha Citadel
// ============================================================================
const L21_NEON_CORRIDOR_LAYOUT = [
  '#......#',
  '..I..I..',
  '...cc...',
  '.1.CC.1.',
  '.1.CC.1.',
  '...cc...',
  '..I..I..',
  '#......#',
];

const L22_BUTTERFLY_LAYOUT = [
  '...##...',
  '.c1..1c.',
  '.C2..2C.',
  '..1..1..',
  '..1..1..',
  '.C2..2C.',
  '.c1..1c.',
  '...##...',
];

const L23_GEAR_CROSS_LAYOUT = [
  '........',
  '...LL...',
  '..1cc1..',
  '.LcCCcL.',
  '.LcCCcL.',
  '..1cc1..',
  '...LL...',
  '........',
];

const L24_SNACK_VAULT_LAYOUT = [
  '#......#',
  '.cc..cc.',
  '.C....C.',
  '...11...',
  '...11...',
  '.C....C.',
  '.cc..cc.',
  '#......#',
];

const L25_BOSS_TWINBUN_LAYOUT = [
  '.c....c.',
  'c11..11c',
  '.L....L.',
  '...CC...',
  '...CC...',
  '.L....L.',
  'c11..11c',
  '.c....c.',
];

const L26_STAR_X_LAYOUT = [
  '........',
  '.I....I.',
  '..2..2..',
  '...LL...',
  '...LL...',
  '..2..2..',
  '.I....I.',
  '........',
];

const L27_ROYAL_TEA_LAYOUT = [
  '#..##..#',
  '.c.11.c.',
  '..L..L..',
  '..1221..',
  '........',
  '..c..c..',
  '........',
  '#......#',
];

const L28_MECHA_MAZE_LAYOUT = [
  '........',
  '.C.11.C.',
  '.1.LL.1.',
  '..IccI..',
  '..IccI..',
  '.1.LL.1.',
  '.C.11.C.',
  '........',
];

const L29_GRAND_EVE_LAYOUT = [
  '#......#',
  '.c1221c.',
  '..L..L..',
  '..C..C..',
  '..C..C..',
  '..L..L..',
  '.c1221c.',
  '#......#',
];

const L30_ULTIMATE_BOSS_LAYOUT = [
  '#......#',
  '.C.LL.C.',
  '..1221..',
  '.c.22.c.',
  '.c.22.c.',
  '..1221..',
  '.C.LL.C.',
  '#......#',
];

// ============================================================================
// CHAPTER 4 LAYOUTS (Levels 31 - 40): Lava BBQ Valley
// ============================================================================
const L31_VOLCANO_GATE_LAYOUT = [
  '#......#',
  '.c.11.c.',
  '..1221..',
  '..1221..',
  '..1221..',
  '..1221..',
  '.c.11.c.',
  '#......#',
];

const L32_LAVA_RIVER_LAYOUT = [
  '........',
  '.c....c.',
  '..L..L..',
  '#..11..#',
  '#..11..#',
  '..L..L..',
  '.c....c.',
  '........',
];

const L33_BBQ_GRILL_LAYOUT = [
  '.#....#.',
  '..c..c..',
  '.1C..C1.',
  '.12..21.',
  '.12..21.',
  '.1C..C1.',
  '..c..c..',
  '.#....#.',
];

const L34_MAGMA_CHASM_LAYOUT = [
  '##....##',
  '#.1221.#',
  '.c1CC1c.',
  '..L..L..',
  '..L..L..',
  '.c1CC1c.',
  '#.1221.#',
  '##....##',
];

const L35_BOSS_LAVA_LAYOUT = [
  '#......#',
  '.C.11.C.',
  '..L22L..',
  '.1....1.',
  '.1....1.',
  '..L22L..',
  '.C.11.C.',
  '#......#',
];

const L36_SPICY_CRATER_LAYOUT = [
  '........',
  '.1c..c1.',
  '.c1221c.',
  '..2CC2..',
  '..2CC2..',
  '.c1221c.',
  '.1c..c1.',
  '........',
];

const L37_LAVA_FALLS_LAYOUT = [
  '#..##..#',
  '..1221..',
  '.c.LL.c.',
  '..1..1..',
  '..1..1..',
  '.c.LL.c.',
  '..1221..',
  '#..##..#',
];

const L38_CROSS_FORTRESS_LAYOUT = [
  '..#..#..',
  '.c1221c.',
  '#1LCCL1#',
  '..CCCC..',
  '..CCCC..',
  '#1LCCL1#',
  '.c1221c.',
  '..#..#..',
];

const L39_GRILL_MASTER_LAYOUT = [
  '#......#',
  '.1CLLC1.',
  '.c1221c.',
  '.C2..2C.',
  '.C2..2C.',
  '.c1221c.',
  '.1CLLC1.',
  '#......#',
];

const L40_BOSS_LAVA_OVERLORD_LAYOUT = [
  '#......#',
  '.C1221C.',
  '..LCCL..',
  '.1.22.1.',
  '.1.22.1.',
  '..LCCL..',
  '.C1221C.',
  '#......#',
];

// ============================================================================
// CHAPTER 5 LAYOUTS (Levels 41 - 50): Galactic Gourmet Palace
// ============================================================================
const L41_STAR_STAIRS_LAYOUT = [
  '#......#',
  '.1....1.',
  '..1c.1..',
  '...c1...',
  '...1c...',
  '..1.c1..',
  '.1....1.',
  '#......#',
];

const L42_DONUT_NEBULA_LAYOUT = [
  '##....##',
  '#122221#',
  '.2.LL.2.',
  '.2L##L2.',
  '.2L##L2.',
  '.2.LL.2.',
  '#122221#',
  '##....##',
];

const L43_CONSTELLATION_LAYOUT = [
  '........',
  '.c.11.c.',
  '..1221..',
  '.12CC21.',
  '.12CC21.',
  '..1221..',
  '.c.11.c.',
  '........',
];

const L44_ASTRAL_PYRAMID_LAYOUT = [
  '...##...',
  '..1221..',
  '.1cCCc1.',
  '.12CC21.',
  '..LCCL..',
  '.12CC21.',
  '..1221..',
  '...##...',
];

const L45_BOSS_CELESTIAL_LAYOUT = [
  '#......#',
  '.1.LL.1.',
  '..c22c..',
  '.L2CC2L.',
  '.L2CC2L.',
  '..c22c..',
  '.1.LL.1.',
  '#......#',
];

const L46_GALACTIC_BANQUET_LAYOUT = [
  '........',
  '.c.11.c.',
  '.1.22.1.',
  '..cCCc..',
  '..cCCc..',
  '.1.22.1.',
  '.c.11.c.',
  '........',
];

const L47_STELLAR_REACTOR_LAYOUT = [
  '#..##..#',
  '.1c..c1.',
  '.c1CC1c.',
  '#..LL..#',
  '#..LL..#',
  '.c1CC1c.',
  '.1c..c1.',
  '#..##..#',
];

const L48_COSMIC_SEAL_LAYOUT = [
  '##....##',
  '#12CC21#',
  '.2L..L2.',
  '.CL..LC.',
  '.CL..LC.',
  '.2L..L2.',
  '#12CC21#',
  '##....##',
];

const L49_ROAD_TO_THRONES_LAYOUT = [
  '........',
  '.C1221C.',
  '.1cLLc1.',
  '.2LCCL2.',
  '.2LCCL2.',
  '.1cLLc1.',
  '.C1221C.',
  '........',
];

const L50_GRAND_FINALE_BOSS_LAYOUT = [
  '#......#',
  '.C1221C.',
  '.1LCCL1.',
  '.2CC22C.',
  '.C22CC2.',
  '.1LCCL1.',
  '.C1221C.',
  '#......#',
];

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  // -------------------- CHAPTER 1 (Levels 1 - 10) --------------------
  {
    id: 1,
    name: '第1关 · 阳光野餐垫',
    subtitle: '凑齐 4 连火焰与连消，快速收集烤鸡腿喂饱奶龙吧！',
    rows: 8,
    cols: 8,
    moves: 19,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry'],
    starScores: [1500, 3600, 6500],
    goals: [
      { type: 'collect', color: 'drumstick', target: 18 },
      { type: 'collect', color: 'nailong', target: 18 },
    ],
    layout: L1_LAYOUT,
  },
  {
    id: 2,
    name: '第2关 · 甜心下午茶',
    subtitle: '震碎小木箱，集齐草莓、波波奶茶与呆萌小紫兵！',
    rows: 8,
    cols: 8,
    moves: 21,
    colorsCount: 5,
    colors: ['nailong', 'minion', 'drumstick', 'strawberry', 'milktea'],
    starScores: [1600, 3800, 6800],
    goals: [
      { type: 'collect', color: 'strawberry', target: 15 },
      { type: 'collect', color: 'milktea', target: 15 },
      { type: 'collect', color: 'minion', target: 13 },
    ],
    layout: L2_LAYOUT,
  },
  {
    id: 3,
    name: '第3关 · 雪糕厚冰岛',
    subtitle: '中心厚冰需要消除两次！善用条纹与爆炸包破冰并收集奶茶！',
    rows: 8,
    cols: 8,
    moves: 21,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'strawberry', 'milktea'],
    starScores: [1700, 4000, 7000],
    goals: [
      { type: 'ice', target: countLayoutLayers(L3_LAYOUT, 'ice') },
      { type: 'collect', color: 'milktea', target: 14 },
    ],
    layout: L3_LAYOUT,
  },
  {
    id: 4,
    name: '第4关 · 冰晶爱心湾',
    subtitle: '先震碎两侧木箱打通滑落路线，再一举清扫爱心冰块！',
    rows: 8,
    cols: 8,
    moves: 22,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry'],
    starScores: [1800, 4200, 7200],
    goals: [
      { type: 'ice', target: countLayoutLayers(L4_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L4_LAYOUT, 'crate') },
    ],
    layout: L4_LAYOUT,
  },
  {
    id: 5,
    name: '第5关 · 【Boss】暴暴龙与小紫兵突袭',
    subtitle: '全 6 色开启！暴暴龙每 3 步会扔障碍，用连击和肚肚大招弹飞它！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2000, 4500, 7800],
    bossMaxHp: 900,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 900 },
      { type: 'ice', target: countLayoutLayers(L5_BOSS_LAYOUT, 'ice') },
    ],
    layout: L5_BOSS_LAYOUT,
  },
  {
    id: 6,
    name: '第6关 · 铁壁木箱阵',
    subtitle: '中心双层加固木箱需要震击两次！攒满肚肚能量压碎防线吧！',
    rows: 8,
    cols: 8,
    moves: 23,
    colorsCount: 6,
    starScores: [1900, 4400, 7500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L6_CRATE_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 18 },
    ],
    layout: L6_CRATE_LAYOUT,
  },
  {
    id: 7,
    name: '第7关 · 极寒铁链线',
    subtitle: '被铁链锁住的棋子无法拖动，凑齐同色或利用远程条纹解锁！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2000, 4500, 7600],
    goals: [
      { type: 'chain', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'ice') },
    ],
    layout: L7_CHAIN_LAYOUT,
  },
  {
    id: 8,
    name: '第8关 · 大肚肚圆圆岛',
    subtitle: '圆滚滚肚皮棋盘！敲碎中心木箱，集齐奶龙、暴暴龙与小紫兵！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2100, 4600, 7800],
    goals: [
      { type: 'collect', color: 'nailong', target: 17 },
      { type: 'collect', color: 'bombloong', target: 17 },
      { type: 'collect', color: 'minion', target: 17 },
    ],
    layout: L8_BELLY_LAYOUT,
  },
  {
    id: 9,
    name: '第9关 · 冰火双层堡',
    subtitle: '暴暴龙要塞前布满木箱、厚冰与铁链，组合双特效清场吧！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [2200, 4800, 8000],
    goals: [
      { type: 'crate', target: countLayoutLayers(L9_FORTRESS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L9_FORTRESS_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L9_FORTRESS_LAYOUT, 'chain') },
    ],
    layout: L9_FORTRESS_LAYOUT,
  },
  {
    id: 10,
    name: '第10关 · 【Boss】野餐岛食神争霸',
    subtitle: '第 1 章守关决战！合成彩虹奶龙双特效，击退暴暴龙！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [2400, 5000, 8500],
    bossMaxHp: 1350,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1350 },
      { type: 'crate', target: countLayoutLayers(L10_FINAL_BOSS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L10_FINAL_BOSS_LAYOUT, 'ice') },
    ],
    layout: L10_FINAL_BOSS_LAYOUT,
  },

  // -------------------- CHAPTER 2 (Levels 11 - 20): Crystal Dessert Bay --------------------
  {
    id: 11,
    name: '第11关 · 双桥奶茶铺',
    subtitle: '欢迎来到第 2 章甜品湾！5 色畅爽连消，收集奶茶与甜草莓！',
    rows: 8,
    cols: 8,
    moves: 23,
    colorsCount: 5,
    colors: ['nailong', 'minion', 'drumstick', 'strawberry', 'milktea'],
    starScores: [2200, 5000, 9000],
    goals: [
      { type: 'collect', color: 'milktea', target: 18 },
      { type: 'collect', color: 'strawberry', target: 18 },
      { type: 'ice', target: countLayoutLayers(L11_TWIN_BRIDGE_LAYOUT, 'ice') },
    ],
    layout: L11_TWIN_BRIDGE_LAYOUT,
  },
  {
    id: 12,
    name: '第12关 · 甜甜圈糖霜岛',
    subtitle: '中空甜甜圈棋盘！绕着圆环触发条纹火焰横扫全部冰块！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2300, 5200, 9200],
    goals: [
      { type: 'ice', target: countLayoutLayers(L12_DONUT_LAYOUT, 'ice') },
      { type: 'collect', color: 'drumstick', target: 16 },
    ],
    layout: L12_DONUT_LAYOUT,
  },
  {
    id: 13,
    name: '第13关 · 紫兵巡逻小径',
    subtitle: '斜线巡逻的小紫兵设下了木箱路障，敲碎木箱并收服小紫兵！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2400, 5400, 9500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L13_PATROL_LAYOUT, 'crate') },
      { type: 'collect', color: 'minion', target: 19 },
    ],
    layout: L13_PATROL_LAYOUT,
  },
  {
    id: 14,
    name: '第14关 · 沙漏冰沙杯',
    subtitle: '沙漏窄口被铁链封锁！先解开腰部双铁链，让上方零食倾泻而下！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'strawberry', 'milktea'],
    starScores: [2500, 5600, 9800],
    goals: [
      { type: 'chain', target: countLayoutLayers(L14_HOURGLASS_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L14_HOURGLASS_LAYOUT, 'ice') },
      { type: 'collect', color: 'nailong', target: 16 },
    ],
    layout: L14_HOURGLASS_LAYOUT,
  },
  {
    id: 15,
    name: '第15关 · 【Boss】小紫兵先锋队',
    subtitle: '5 色高速连击 Boss 战！用满屏爆炸特效把小紫兵先锋与暴暴龙轰飞！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'milktea'],
    starScores: [2800, 6000, 10500],
    bossMaxHp: 1250,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1250 },
      { type: 'collect', color: 'minion', target: 20 },
    ],
    layout: L15_BOSS_MINION_LAYOUT,
  },
  {
    id: 16,
    name: '第16关 · 草莓华夫格',
    subtitle: '交错分布的华夫格木箱！在木箱缝隙间消除可同时震裂多个木箱！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [2600, 5800, 10000],
    goals: [
      { type: 'crate', target: countLayoutLayers(L16_WAFFLE_LAYOUT, 'crate') },
      { type: 'collect', color: 'strawberry', target: 19 },
    ],
    layout: L16_WAFFLE_LAYOUT,
  },
  {
    id: 17,
    name: '第17关 · 极光棱镜阵',
    subtitle: '钻石形冰晶棱镜！解锁外围铁链后用肚肚泰山压顶震碎厚冰核心！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [2700, 6000, 10200],
    goals: [
      { type: 'chain', target: countLayoutLayers(L17_PRISM_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L17_PRISM_LAYOUT, 'ice') },
    ],
    layout: L17_PRISM_LAYOUT,
  },
  {
    id: 18,
    name: '第18关 · 波波双子泉',
    subtitle: '左右对称的奶茶喷泉！破开中央加固木箱，畅饮波波奶茶！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [2800, 6200, 10500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L18_FOUNTAIN_LAYOUT, 'crate') },
      { type: 'collect', color: 'milktea', target: 18 },
      { type: 'collect', color: 'nailong', target: 18 },
    ],
    layout: L18_FOUNTAIN_LAYOUT,
  },
  {
    id: 19,
    name: '第19关 · 雪山阶梯堡',
    subtitle: '层层递进的雪山防线！合成爆炸包+条纹十字大招一次扫平三排！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [2900, 6400, 11000],
    goals: [
      { type: 'ice', target: countLayoutLayers(L19_TERRACE_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L19_TERRACE_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L19_TERRACE_LAYOUT, 'chain') },
    ],
    layout: L19_TERRACE_LAYOUT,
  },
  {
    id: 20,
    name: '第20关 · 【Boss】冰封暴暴龙舰长',
    subtitle: '第 2 章终极守关 Boss！攻破冰封甲板，迎战暴暴龙舰长！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [3200, 6800, 12000],
    bossMaxHp: 1450,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1450 },
      { type: 'ice', target: countLayoutLayers(L20_BOSS_CAPTAIN_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L20_BOSS_CAPTAIN_LAYOUT, 'chain') },
    ],
    layout: L20_BOSS_CAPTAIN_LAYOUT,
  },

  // -------------------- CHAPTER 3 (Levels 21 - 30): Minion Mecha Citadel --------------------
  {
    id: 21,
    name: '第21关 · 霓虹传送走廊',
    subtitle: '闯入第 3 章紫兵机械堡！5 色高连消破除冰封铁链，抢回烤鸡腿！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'milktea'],
    starScores: [3000, 6800, 12200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L21_NEON_CORRIDOR_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L21_NEON_CORRIDOR_LAYOUT, 'chain') },
      { type: 'collect', color: 'drumstick', target: 18 },
    ],
    layout: L21_NEON_CORRIDOR_LAYOUT,
  },
  {
    id: 22,
    name: '第22关 · 蝴蝶双翼岛',
    subtitle: '对称蝴蝶双翼棋盘！敲碎两侧机甲木箱，收集草莓与小紫兵！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [3100, 7000, 12500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L22_BUTTERFLY_LAYOUT, 'crate') },
      { type: 'collect', color: 'strawberry', target: 18 },
      { type: 'collect', color: 'minion', target: 18 },
    ],
    layout: L22_BUTTERFLY_LAYOUT,
  },
  {
    id: 23,
    name: '第23关 · 齿轮十字阵',
    subtitle: '机械齿轮核心由双层木箱与铁链守护，从外圈向内逐层瓦解！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [3200, 7200, 12800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L23_GEAR_CROSS_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L23_GEAR_CROSS_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L23_GEAR_CROSS_LAYOUT, 'ice') },
    ],
    layout: L23_GEAR_CROSS_LAYOUT,
  },
  {
    id: 24,
    name: '第24关 · 烤鸡腿补给库',
    subtitle: '找到暴暴龙藏零食的金库啦！轰开四角木箱，把烤鸡腿统统打包！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [3300, 7400, 13000],
    goals: [
      { type: 'crate', target: countLayoutLayers(L24_SNACK_VAULT_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 20 },
      { type: 'collect', color: 'nailong', target: 18 },
    ],
    layout: L24_SNACK_VAULT_LAYOUT,
  },
  {
    id: 25,
    name: '第25关 · 【Boss】双丸紫兵大队长',
    subtitle: '双丸子头阵型迎敌！集齐小紫兵能量并击败大队长与暴暴龙！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [3600, 8000, 13800],
    bossMaxHp: 1500,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1500 },
      { type: 'crate', target: countLayoutLayers(L25_BOSS_TWINBUN_LAYOUT, 'crate') },
      { type: 'collect', color: 'minion', target: 18 },
    ],
    layout: L25_BOSS_TWINBUN_LAYOUT,
  },
  {
    id: 26,
    name: '第26关 · 星际X交叉线',
    subtitle: '开阔棋盘上的 X 型冰封锁链！极易合成 5 连彩虹奶龙爽快清屏！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [3400, 7600, 13200],
    goals: [
      { type: 'chain', target: countLayoutLayers(L26_STAR_X_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L26_STAR_X_LAYOUT, 'ice') },
    ],
    layout: L26_STAR_X_LAYOUT,
  },
  {
    id: 27,
    name: '第27关 · 皇家下午茶宴',
    subtitle: '皇冠大厅美食派对！一口气集齐波波奶茶、甜心草莓与香烤鸡腿！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [3500, 7800, 13500],
    goals: [
      { type: 'collect', color: 'milktea', target: 19 },
      { type: 'collect', color: 'strawberry', target: 19 },
      { type: 'collect', color: 'drumstick', target: 19 },
    ],
    layout: L27_ROYAL_TEA_LAYOUT,
  },
  {
    id: 28,
    name: '第28关 · 机械迷宫外围',
    subtitle: '突破对称机甲防线！优先消除中心木箱，扩大下方连消空间！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [3600, 8000, 13800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L28_MECHA_MAZE_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L28_MECHA_MAZE_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L28_MECHA_MAZE_LAYOUT, 'ice') },
    ],
    layout: L28_MECHA_MAZE_LAYOUT,
  },
  {
    id: 29,
    name: '第29关 · 决战前夜大满贯',
    subtitle: '终极决战前的最后考验！破开上下厚冰防线，召集奶龙与暴暴龙图标！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [3800, 8500, 14200],
    goals: [
      { type: 'ice', target: countLayoutLayers(L29_GRAND_EVE_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L29_GRAND_EVE_LAYOUT, 'crate') },
      { type: 'collect', color: 'nailong', target: 18 },
      { type: 'collect', color: 'bombloong', target: 18 },
    ],
    layout: L29_GRAND_EVE_LAYOUT,
  },
  {
    id: 30,
    name: '第30关 · 【机械Boss】紫兵要塞决战',
    subtitle: '机械堡终极要塞决战！粉碎紫兵要塞核心防御，迎接通往熔岩烤肉谷的传送门！',
    rows: 8,
    cols: 8,
    moves: 29,
    colorsCount: 6,
    starScores: [4500, 9500, 15000],
    bossMaxHp: 1500,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1500 },
      { type: 'crate', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'chain') },
    ],
    layout: L30_ULTIMATE_BOSS_LAYOUT,
  },
  // -------------------- CHAPTER 4 (Levels 31 - 40) --------------------
  {
    id: 31,
    name: '第31关 · 熔岩谷入口 · 炭烤前哨',
    subtitle: '踏入炙热熔岩烤肉谷！高温热浪封锁通道，粉碎烤架木箱与薄冰！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [3200, 7500, 15500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L31_VOLCANO_GATE_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L31_VOLCANO_GATE_LAYOUT, 'ice') },
    ],
    layout: L31_VOLCANO_GATE_LAYOUT,
  },
  {
    id: 32,
    name: '第32关 · 炙热火山道 · 串串阵地',
    subtitle: '解开铁链束缚，收集 20 只外焦里嫩的火山特制烤鸡腿！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [3400, 7800, 15800],
    goals: [
      { type: 'chain', target: countLayoutLayers(L32_LAVA_RIVER_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L32_LAVA_RIVER_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L32_LAVA_RIVER_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 20 },
    ],
    layout: L32_LAVA_RIVER_LAYOUT,
  },
  {
    id: 33,
    name: '第33关 · 滚烫岩浆池 · 鸡腿大丰收',
    subtitle: '利用横竖火箭与炸弹组合穿透烤架，大量收集鸡腿饱餐一顿！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 6,
    starScores: [3600, 8200, 16200],
    goals: [
      { type: 'ice', target: countLayoutLayers(L33_BBQ_GRILL_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L33_BBQ_GRILL_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 22 },
    ],
    layout: L33_BBQ_GRILL_LAYOUT,
  },
  {
    id: 34,
    name: '第34关 · 巨石烤肉架 · 炭火双重破拆',
    subtitle: '岩浆深渊裂谷！必须合力解开中央铁链并彻底击碎坚硬木箱！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [3800, 8600, 16500],
    goals: [
      { type: 'crate', target: countLayoutLayers(L34_MAGMA_CHASM_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L34_MAGMA_CHASM_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L34_MAGMA_CHASM_LAYOUT, 'chain') },
    ],
    layout: L34_MAGMA_CHASM_LAYOUT,
  },
  {
    id: 35,
    name: '第35关 · 【Boss战】暴暴龙·熔岩烤肉形态',
    subtitle: '暴暴龙披上熔岩铠甲！每3回合投掷岩浆碎石，全力轰击Boss！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [4200, 9500, 16800],
    bossMaxHp: 1350,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1350 },
      { type: 'crate', target: countLayoutLayers(L35_BOSS_LAVA_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L35_BOSS_LAVA_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L35_BOSS_LAVA_LAYOUT, 'ice') },
    ],
    layout: L35_BOSS_LAVA_LAYOUT,
  },
  {
    id: 36,
    name: '第36关 · 辣椒火山坑 · 连环爆燃',
    subtitle: '火辣冲击！收集草莓解辣，制造大面积连击破除中心坚冰！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [4400, 9800, 17200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L36_SPICY_CRATER_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L36_SPICY_CRATER_LAYOUT, 'ice') },
      { type: 'collect', color: 'strawberry', target: 22 },
    ],
    layout: L36_SPICY_CRATER_LAYOUT,
  },
  {
    id: 37,
    name: '第37关 · 熔岩大瀑布 · 激流飞渡',
    subtitle: '岩浆奔涌而下！突破双侧链条铁索，收集 20 份美味烤鸡腿！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [4600, 10200, 17500],
    goals: [
      { type: 'chain', target: countLayoutLayers(L37_LAVA_FALLS_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L37_LAVA_FALLS_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L37_LAVA_FALLS_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 20 },
    ],
    layout: L37_LAVA_FALLS_LAYOUT,
  },
  {
    id: 38,
    name: '第38关 · 铁签十字要塞 · 坚如磐石',
    subtitle: '坚固的十字形双层加固木箱！制造彩虹球+火箭全屏清除障碍！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [4800, 10800, 17800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L38_CROSS_FORTRESS_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L38_CROSS_FORTRESS_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L38_CROSS_FORTRESS_LAYOUT, 'ice') },
    ],
    layout: L38_CROSS_FORTRESS_LAYOUT,
  },
  {
    id: 39,
    name: '第39关 · 烤肉大师决战前夕',
    subtitle: '多重封锁！收集暴暴龙徽记，解除熔岩终极大关的结界！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [5000, 11200, 18200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L39_GRILL_MASTER_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L39_GRILL_MASTER_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L39_GRILL_MASTER_LAYOUT, 'ice') },
      { type: 'collect', color: 'bombloong', target: 20 },
    ],
    layout: L39_GRILL_MASTER_LAYOUT,
  },
  {
    id: 40,
    name: '第40关 · 【第4章Boss】熔岩巨龙·霸王烤肉大决斗',
    subtitle: '熔岩巨龙狂暴来袭！释放肚肚泰山压顶，赢得通往星河吃货殿的终极门票！',
    rows: 8,
    cols: 8,
    moves: 30,
    colorsCount: 6,
    starScores: [5200, 11800, 18600],
    bossMaxHp: 1580,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1580 },
      { type: 'crate', target: countLayoutLayers(L40_BOSS_LAVA_OVERLORD_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L40_BOSS_LAVA_OVERLORD_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L40_BOSS_LAVA_OVERLORD_LAYOUT, 'ice') },
    ],
    layout: L40_BOSS_LAVA_OVERLORD_LAYOUT,
  },
  // -------------------- CHAPTER 5 (Levels 41 - 50) --------------------
  {
    id: 41,
    name: '第41关 · 星门启程 · 银河天梯',
    subtitle: '步入星河吃货殿！星光阶梯蜿蜒向前，收集 24 只机智呆萌奶龙！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [5200, 12000, 19000],
    goals: [
      { type: 'ice', target: countLayoutLayers(L41_STAR_STAIRS_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L41_STAR_STAIRS_LAYOUT, 'crate') },
      { type: 'collect', color: 'nailong', target: 24 },
    ],
    layout: L41_STAR_STAIRS_LAYOUT,
  },
  {
    id: 42,
    name: '第42关 · 甜甜圈星云 · 环形引力',
    subtitle: '浩瀚甜甜圈星系！破开内圈环形双层厚冰，解救被锁链固定的图块！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [5400, 12400, 19400],
    goals: [
      { type: 'chain', target: countLayoutLayers(L42_DONUT_NEBULA_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L42_DONUT_NEBULA_LAYOUT, 'ice') },
    ],
    layout: L42_DONUT_NEBULA_LAYOUT,
  },
  {
    id: 43,
    name: '第43关 · 奶龙星座 · 璀璨星图',
    subtitle: '点亮夜空中最贪吃的星宿！同时集齐奶龙与香浓珍珠奶茶！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [5600, 12800, 19800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L43_CONSTELLATION_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L43_CONSTELLATION_LAYOUT, 'ice') },
      { type: 'collect', color: 'nailong', target: 22 },
      { type: 'collect', color: 'milktea', target: 22 },
    ],
    layout: L43_CONSTELLATION_LAYOUT,
  },
  {
    id: 44,
    name: '第44关 · 星辰金字塔 · 双重坚冰',
    subtitle: '金字塔顶端的美食宝藏！合成十字激光快速瓦解高密度木箱群！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [5800, 13200, 20200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L44_ASTRAL_PYRAMID_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L44_ASTRAL_PYRAMID_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L44_ASTRAL_PYRAMID_LAYOUT, 'chain') },
    ],
    layout: L44_ASTRAL_PYRAMID_LAYOUT,
  },
  {
    id: 45,
    name: '第45关 · 【Boss战】机械紫兵总督·星海奇袭',
    subtitle: '紫兵总督率领星际舰队反扑！抵御机械冰弹攻击，集中火力轰破Boss！',
    rows: 8,
    cols: 8,
    moves: 29,
    colorsCount: 6,
    starScores: [6000, 13600, 20600],
    bossMaxHp: 1680,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1680 },
      { type: 'crate', target: countLayoutLayers(L45_BOSS_CELESTIAL_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L45_BOSS_CELESTIAL_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L45_BOSS_CELESTIAL_LAYOUT, 'ice') },
    ],
    layout: L45_BOSS_CELESTIAL_LAYOUT,
  },
  {
    id: 46,
    name: '第46关 · 银河盛宴长廊 · 满汉全席',
    subtitle: '吃货的终极狂欢！各收集 20 份烤鸡腿、奶茶与鲜红草莓！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [6200, 14000, 21000],
    goals: [
      { type: 'collect', color: 'drumstick', target: 20 },
      { type: 'collect', color: 'milktea', target: 20 },
      { type: 'collect', color: 'strawberry', target: 20 },
      { type: 'crate', target: countLayoutLayers(L46_GALACTIC_BANQUET_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L46_GALACTIC_BANQUET_LAYOUT, 'ice') },
    ],
    layout: L46_GALACTIC_BANQUET_LAYOUT,
  },
  {
    id: 47,
    name: '第47关 · 星核反应堆 · 连环能量释放',
    subtitle: '聚变核心急速运转！连锁引爆特殊炸弹，粉碎双层加固木箱！',
    rows: 8,
    cols: 8,
    moves: 29,
    colorsCount: 6,
    starScores: [6400, 14400, 21400],
    goals: [
      { type: 'crate', target: countLayoutLayers(L47_STELLAR_REACTOR_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L47_STELLAR_REACTOR_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L47_STELLAR_REACTOR_LAYOUT, 'ice') },
    ],
    layout: L47_STELLAR_REACTOR_LAYOUT,
  },
  {
    id: 48,
    name: '第48关 · 创世美食神殿 · 坚冰封印',
    subtitle: '解开沉睡千万年的美食神殿封印！全方位瓦解双重厚冰与锁链！',
    rows: 8,
    cols: 8,
    moves: 30,
    colorsCount: 6,
    starScores: [6600, 14800, 21800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L48_COSMIC_SEAL_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L48_COSMIC_SEAL_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L48_COSMIC_SEAL_LAYOUT, 'ice') },
    ],
    layout: L48_COSMIC_SEAL_LAYOUT,
  },
  {
    id: 49,
    name: '第49关 · 登顶之路 · 宇宙吃货试炼',
    subtitle: '踏上通往食神王座的登天长廊！突破所有防线，召集 24 只奶龙伙伴！',
    rows: 8,
    cols: 8,
    moves: 30,
    colorsCount: 6,
    starScores: [6800, 15200, 22200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L49_ROAD_TO_THRONES_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L49_ROAD_TO_THRONES_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L49_ROAD_TO_THRONES_LAYOUT, 'ice') },
      { type: 'collect', color: 'nailong', target: 24 },
    ],
    layout: L49_ROAD_TO_THRONES_LAYOUT,
  },
  {
    id: 50,
    name: '第50关 · 【终极大决战】宇宙暴食魔王·真·终极食神大决战',
    subtitle: '全50关巅峰终章！粉碎暴暴龙所有防御，解锁全城放鞭炮盛典，加冕宇宙终极食神！',
    rows: 8,
    cols: 8,
    moves: 32,
    colorsCount: 6,
    starScores: [7200, 16000, 23000],
    bossMaxHp: 1980,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1980 },
      { type: 'crate', target: countLayoutLayers(L50_GRAND_FINALE_BOSS_LAYOUT, 'crate') },
      { type: 'chain', target: countLayoutLayers(L50_GRAND_FINALE_BOSS_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L50_GRAND_FINALE_BOSS_LAYOUT, 'ice') },
    ],
    layout: L50_GRAND_FINALE_BOSS_LAYOUT,
  },
];

export const ENDLESS_LEVEL: LevelConfig = {
  id: 99,
  name: '无尽吃货挑战 · 干饭王模式',
  subtitle: '初始 18 步！每突破里程碑奖励 +4 步，挑战你的最高干饭纪录！',
  rows: 8,
  cols: 8,
  moves: 18,
  colorsCount: 6,
  starScores: [3000, 8000, 15000],
  goals: [{ type: 'score', target: 999999 }],
  layout: L2_LAYOUT,
};

export const DEFAULT_BOOSTERS: Record<BoosterType, number> = {
  hammer: 2,
  swap_glove: 2,
  shuffle: 2,
  plus5: 2,
};

export function createDefaultBoosters(): Record<BoosterType, number> {
  return { ...DEFAULT_BOOSTERS };
}

export interface SaveProgress {
  playerId: string;
  playerNickname: string;
  unlockedLevel: number;
  levelStars: Record<number, number>;
  levelBestScores: Record<number, number>;
  endlessBestScore: number;
  boosters: Record<BoosterType, number>;
  chapterBoosters?: Record<number, Record<BoosterType, number>>;
}

const STORAGE_KEY = 'nailong_match3_save_v1';

function generatePlayerId(): string {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `nl_${rand}`;
}

export function loadProgress(): SaveProgress {
  const fallbackChapterBoosters: Record<number, Record<BoosterType, number>> = {
    1: createDefaultBoosters(),
    2: createDefaultBoosters(),
    3: createDefaultBoosters(),
    4: createDefaultBoosters(),
    5: createDefaultBoosters(),
  };
  const fallback: SaveProgress = {
    playerId: generatePlayerId(),
    playerNickname: '',
    unlockedLevel: 1,
    levelStars: {},
    levelBestScores: {},
    endlessBestScore: 0,
    boosters: createDefaultBoosters(),
    chapterBoosters: fallbackChapterBoosters,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveProgress(fallback);
      return fallback;
    }
    const parsed = JSON.parse(raw);
    const chapterBoosters: Record<number, Record<BoosterType, number>> = {};
    for (let c = 1; c <= 5; c++) {
      const src = parsed.chapterBoosters?.[c] ?? {};
      chapterBoosters[c] = {
        hammer: Math.min(DEFAULT_BOOSTERS.hammer, Math.max(0, Number(src.hammer ?? DEFAULT_BOOSTERS.hammer))),
        swap_glove: Math.min(DEFAULT_BOOSTERS.swap_glove, Math.max(0, Number(src.swap_glove ?? DEFAULT_BOOSTERS.swap_glove))),
        shuffle: Math.min(DEFAULT_BOOSTERS.shuffle, Math.max(0, Number(src.shuffle ?? DEFAULT_BOOSTERS.shuffle))),
        plus5: Math.min(DEFAULT_BOOSTERS.plus5, Math.max(0, Number(src.plus5 ?? DEFAULT_BOOSTERS.plus5))),
      };
    }
    const merged: SaveProgress = {
      ...fallback,
      ...parsed,
      playerId:
        typeof parsed.playerId === 'string' && parsed.playerId.length >= 4
          ? parsed.playerId
          : fallback.playerId,
      playerNickname: typeof parsed.playerNickname === 'string' ? parsed.playerNickname : '',
      boosters: { ...fallback.boosters, ...(parsed.boosters ?? {}) },
      chapterBoosters,
    };
    // Re-evaluate level stars with the new relaxed thresholds based on recorded best scores
    for (const lv of CAMPAIGN_LEVELS) {
      const best = merged.levelBestScores[lv.id] ?? 0;
      if (best > 0) {
        const [s1, s2, s3] = lv.starScores;
        const recalculated = best >= s3 ? 3 : best >= s2 ? 2 : best >= s1 ? 1 : 1;
        merged.levelStars[lv.id] = Math.max(merged.levelStars[lv.id] ?? 0, recalculated);
      }
    }
    if (merged.playerId !== parsed.playerId) {
      saveProgress(merged);
    }
    return merged;
  } catch {
    return fallback;
  }
}

export function saveProgress(data: SaveProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}
