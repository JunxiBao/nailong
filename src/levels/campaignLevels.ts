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
  '...cc...',
  '........',
  '........',
  '...cc...',
  '........',
  '#......#',
];

const L3_LAYOUT = [
  '........',
  '........',
  '..1221..',
  '..2112..',
  '..2112..',
  '..1221..',
  '........',
  '........',
];

// Heart-shaped pixel board with double ice & crate blockers
const L4_LAYOUT = [
  '.##..##.',
  '..1..1..',
  '.c1221c.',
  '..2222..',
  '.c1221c.',
  '#..22..#',
  '##....##',
  '###..###',
];

const L5_BOSS_LAYOUT = [
  '........',
  '..L11L..',
  '.1.22.1.',
  '........',
  '........',
  '.1.22.1.',
  '..L11L..',
  '........',
];

const L6_CRATE_LAYOUT = [
  '........',
  '.C....C.',
  '..c..c..',
  '..CCCC..',
  '..CCCC..',
  '..c..c..',
  '.C....C.',
  '........',
];

const L7_CHAIN_LAYOUT = [
  '#......#',
  '..ILLI..',
  '.L2222L.',
  '.1.22.1.',
  '.1.22.1.',
  '.L2222L.',
  '..ILLI..',
  '#......#',
];

// Round Nailong belly board with reinforced crates & chains!
const L8_BELLY_LAYOUT = [
  '##....##',
  '#..LL..#',
  '........',
  '...CC...',
  '...CC...',
  '........',
  '#..LL..#',
  '##....##',
];

const L9_FORTRESS_LAYOUT = [
  '........',
  '.C.II.C.',
  '..2222..',
  '.I.CC.I.',
  '.I.CC.I.',
  '..2222..',
  '.C.II.C.',
  '........',
];

const L10_FINAL_BOSS_LAYOUT = [
  '#......#',
  '.C.LL.C.',
  '..2222..',
  '.I.CC.I.',
  '.I.CC.I.',
  '..2222..',
  '.C.LL.C.',
  '#......#',
];

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '第1关 · 阳光野餐垫',
    subtitle: '步数紧迫！多凑 4 连火焰与连消，快速喂饱奶龙吧！',
    rows: 8,
    cols: 8,
    moves: 16,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry'],
    starScores: [1800, 3400, 5200],
    goals: [
      { type: 'collect', color: 'drumstick', target: 22 },
      { type: 'collect', color: 'nailong', target: 22 },
    ],
    layout: L1_LAYOUT,
  },
  {
    id: 2,
    name: '第2关 · 甜心下午茶',
    subtitle: '全 6 色开启！震碎木箱并收集草莓、波波奶茶与呆萌小紫兵！',
    rows: 8,
    cols: 8,
    moves: 18,
    colorsCount: 6,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry', 'milktea'],
    starScores: [2200, 4200, 6200],
    goals: [
      { type: 'collect', color: 'strawberry', target: 18 },
      { type: 'collect', color: 'milktea', target: 18 },
      { type: 'collect', color: 'minion', target: 15 },
    ],
    layout: L2_LAYOUT,
  },
  {
    id: 3,
    name: '第3关 · 雪糕厚冰岛',
    subtitle: '双层厚冰需要消除两次！善用条纹与爆炸包破冰并收集奶茶！',
    rows: 8,
    cols: 8,
    moves: 18,
    colorsCount: 6,
    starScores: [2600, 4800, 7000],
    goals: [
      { type: 'ice', target: countLayoutLayers(L3_LAYOUT, 'ice') },
      { type: 'collect', color: 'milktea', target: 16 },
    ],
    layout: L3_LAYOUT,
  },
  {
    id: 4,
    name: '第4关 · 冰晶爱心湾',
    subtitle: '木箱挡住了滑落路线！先破开两侧木箱，再双特效清扫厚冰！',
    rows: 8,
    cols: 8,
    moves: 19,
    colorsCount: 6,
    starScores: [3000, 5400, 7800],
    goals: [
      { type: 'ice', target: countLayoutLayers(L4_LAYOUT, 'ice') },
      { type: 'crate', target: countLayoutLayers(L4_LAYOUT, 'crate') },
    ],
    layout: L4_LAYOUT,
  },
  {
    id: 5,
    name: '第5关 · 【Boss】暴暴龙与小紫兵突袭',
    subtitle: '暴暴龙每 2 步就会派小紫兵扔铁链冰块！破除冰面并用连击重创它！',
    rows: 8,
    cols: 8,
    moves: 20,
    colorsCount: 6,
    starScores: [3800, 6500, 9500],
    bossMaxHp: 1150,
    bossAttackInterval: 2,
    goals: [
      { type: 'boss', target: 1150 },
      { type: 'ice', target: countLayoutLayers(L5_BOSS_LAYOUT, 'ice') },
    ],
    layout: L5_BOSS_LAYOUT,
  },
  {
    id: 6,
    name: '第6关 · 铁壁木箱阵',
    subtitle: '加固双层木箱需要震击两次！攒满肚肚能量压碎中央防线吧！',
    rows: 8,
    cols: 8,
    moves: 20,
    colorsCount: 6,
    starScores: [3400, 6000, 8800],
    goals: [
      { type: 'crate', target: countLayoutLayers(L6_CRATE_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 22 },
    ],
    layout: L6_CRATE_LAYOUT,
  },
  {
    id: 7,
    name: '第7关 · 极寒铁链线',
    subtitle: '冰封锁链双重封锁！利用远程条纹特效横扫整排锁链！',
    rows: 8,
    cols: 8,
    moves: 21,
    colorsCount: 6,
    starScores: [3800, 6800, 9800],
    goals: [
      { type: 'chain', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'ice') },
    ],
    layout: L7_CHAIN_LAYOUT,
  },
  {
    id: 8,
    name: '第8关 · 大肚肚圆圆岛',
    subtitle: '狭窄圆滚滚肚皮棋盘！冲破木箱锁链，集齐奶龙、暴暴龙与小紫兵！',
    rows: 8,
    cols: 8,
    moves: 21,
    colorsCount: 6,
    starScores: [4000, 7200, 10500],
    goals: [
      { type: 'collect', color: 'nailong', target: 20 },
      { type: 'collect', color: 'bombloong', target: 20 },
      { type: 'collect', color: 'minion', target: 20 },
    ],
    layout: L8_BELLY_LAYOUT,
  },
  {
    id: 9,
    name: '第9关 · 冰火双层堡',
    subtitle: '暴暴龙要塞前布满双层木箱、厚冰与铁链，合理规划每一步！',
    rows: 8,
    cols: 8,
    moves: 22,
    colorsCount: 6,
    starScores: [4500, 8000, 11800],
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
    subtitle: '地狱难度决战！暴暴龙携小紫兵高频捣乱，合成彩虹双特效绝地反击！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 6,
    starScores: [5800, 9800, 14500],
    bossMaxHp: 1750,
    bossAttackInterval: 2,
    goals: [
      { type: 'boss', target: 1750 },
      { type: 'crate', target: countLayoutLayers(L10_FINAL_BOSS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L10_FINAL_BOSS_LAYOUT, 'ice') },
    ],
    layout: L10_FINAL_BOSS_LAYOUT,
  },
];

export const ENDLESS_LEVEL: LevelConfig = {
  id: 99,
  name: '无尽吃货挑战 · 干饭王模式',
  subtitle: '初始 16 步！每档里程碑难度递增并奖励 +3 步，挑战极限高分！',
  rows: 8,
  cols: 8,
  moves: 16,
  colorsCount: 6,
  starScores: [4500, 11000, 22000],
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
      hammer: 1,
      swap_glove: 1,
      shuffle: 1,
      plus5: 1,
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
