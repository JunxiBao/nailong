import { BoosterType, LevelConfig } from '../match3/types';

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

// Heart-shaped pixel board with ice & light crate blockers
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

// Round Nailong belly board with center crates & corner chains!
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

export const CAMPAIGN_LEVELS: LevelConfig[] = [
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
    name: '第10关 · 【终极Boss】宇宙最强吃货王',
    subtitle: '终极美食决战！合成彩虹奶龙双特效，彻底击败暴暴龙与小紫兵！',
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
