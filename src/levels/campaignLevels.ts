import { BoosterType, LevelConfig } from '../match3/types';

export interface ChapterMeta {
  id: number;
  title: string;
  shortTitle: string;
  startLevel: number;
  endLevel: number;
  bgGradient: string;
  tip: string;
}

export const CAMPAIGN_CHAPTERS: ChapterMeta[] = [
  {
    id: 1,
    title: '🌴 第1章 · 阳光野餐岛',
    shortTitle: '🌴 野餐岛 (1-10)',
    startLevel: 1,
    endLevel: 10,
    bgGradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 50%, #fef9c3 100%)',
    tip: '💡 第 5 关与第 10 关为【野餐岛 Boss 战】！',
  },
  {
    id: 2,
    title: '🍨 第2章 · 冰晶甜品湾',
    shortTitle: '🍨 甜品湾 (11-20)',
    startLevel: 11,
    endLevel: 20,
    bgGradient: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 50%, #fce7f3 100%)',
    tip: '💡 第 15 关与第 20 关为【甜品湾 Boss 战】！',
  },
  {
    id: 3,
    title: '🚀 第3章 · 紫兵机械堡',
    shortTitle: '🚀 机械堡 (21-30)',
    startLevel: 21,
    endLevel: 30,
    bgGradient: 'linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 50%, #fef3c7 100%)',
    tip: '💡 第 25 关与第 30 关为【机械堡终极 Boss 战】！',
  },
];

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
    starScores: [1600, 3100, 4800],
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
    starScores: [2000, 3800, 5600],
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
    starScores: [2300, 4300, 6400],
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
    starScores: [2600, 4800, 7000],
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
    starScores: [3400, 5800, 8600],
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
    starScores: [3100, 5500, 8000],
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
    starScores: [3400, 6000, 8800],
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
    starScores: [3600, 6400, 9400],
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
    starScores: [4000, 7200, 10500],
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
    starScores: [5000, 8600, 12800],
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
    starScores: [3000, 5600, 8400],
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
    starScores: [3400, 6200, 9200],
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
    starScores: [3500, 6400, 9500],
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
    starScores: [3600, 6600, 9800],
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
    starScores: [4200, 7400, 11000],
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
    starScores: [3600, 6500, 9600],
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
    starScores: [3800, 6800, 10000],
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
    starScores: [3900, 7000, 10400],
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
    starScores: [4200, 7600, 11200],
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
    starScores: [5200, 9000, 13200],
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
    starScores: [3800, 6800, 10200],
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
    starScores: [4000, 7200, 10600],
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
    starScores: [4200, 7500, 11000],
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
    starScores: [4200, 7600, 11200],
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
    starScores: [5400, 9200, 13600],
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
    starScores: [4300, 7800, 11500],
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
    starScores: [4400, 8000, 11800],
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
    starScores: [4600, 8200, 12200],
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
    starScores: [4800, 8500, 12600],
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
    name: '第30关 · 【终极Boss】宇宙食神大决战',
    subtitle: '全 30 关巅峰之战！火力全开释放双彩虹与肚肚泰山压顶，加冕宇宙食神！',
    rows: 8,
    cols: 8,
    moves: 30,
    colorsCount: 6,
    starScores: [6000, 10500, 15500],
    bossMaxHp: 1680,
    bossAttackInterval: 3,
    goals: [
      { type: 'boss', target: 1680 },
      { type: 'crate', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'ice') },
      { type: 'chain', target: countLayoutLayers(L30_ULTIMATE_BOSS_LAYOUT, 'chain') },
    ],
    layout: L30_ULTIMATE_BOSS_LAYOUT,
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
  starScores: [4000, 9500, 19000],
  goals: [{ type: 'score', target: 999999 }],
  layout: L2_LAYOUT,
};

export interface SaveProgress {
  unlockedLevel: number;
  levelStars: Record<number, number>;
  levelBestScores: Record<number, number>;
  endlessBestScore: number;
  boosters: Record<BoosterType, number>;
}

const STORAGE_KEY = 'nailong_match3_save_v1';

export function loadProgress(): SaveProgress {
  const fallback: SaveProgress = {
    unlockedLevel: 1,
    levelStars: {},
    levelBestScores: {},
    endlessBestScore: 0,
    boosters: {
      hammer: 2,
      swap_glove: 2,
      shuffle: 2,
      plus5: 2,
    },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      boosters: { ...fallback.boosters, ...(parsed.boosters ?? {}) },
    };
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
