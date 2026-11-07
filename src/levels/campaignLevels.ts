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
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
];

const L2_LAYOUT = [
  '#......#',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '#......#',
];

const L3_LAYOUT = [
  '........',
  '........',
  '..1111..',
  '..1111..',
  '..1111..',
  '..1111..',
  '........',
  '........',
];

// Heart-shaped pixel board with single & double ice
const L4_LAYOUT = [
  '.##..##.',
  '........',
  '..1221..',
  '..2112..',
  '..1221..',
  '#..11..#',
  '##....##',
  '###..###',
];

const L5_BOSS_LAYOUT = [
  '........',
  '...11...',
  '..L..L..',
  '........',
  '........',
  '..L..L..',
  '...11...',
  '........',
];

const L6_CRATE_LAYOUT = [
  '........',
  '.c....c.',
  '..c..c..',
  '...CC...',
  '...CC...',
  '..c..c..',
  '.c....c.',
  '........',
];

const L7_CHAIN_LAYOUT = [
  '#......#',
  '..LLLL..',
  '..1111..',
  '.L.22.L.',
  '.L.22.L.',
  '..1111..',
  '..LLLL..',
  '#......#',
];

// Round Nailong belly board!
const L8_BELLY_LAYOUT = [
  '##....##',
  '#......#',
  '........',
  '...cc...',
  '...cc...',
  '........',
  '#......#',
  '##....##',
];

const L9_FORTRESS_LAYOUT = [
  '........',
  '.C.11.C.',
  '..2222..',
  '.1.CC.1.',
  '.1.CC.1.',
  '..2222..',
  '.C.11.C.',
  '........',
];

const L10_FINAL_BOSS_LAYOUT = [
  '#......#',
  '.c.LL.c.',
  '..1221..',
  '.L.cc.L.',
  '.L.cc.L.',
  '..1221..',
  '.c.LL.c.',
  '#......#',
];

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '第1关 · 阳光野餐垫',
    subtitle: '喂饿扁肚皮的奶龙吃烤鸡腿吧！4连还能合成喷火特效哦！',
    rows: 8,
    cols: 8,
    moves: 22,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'minion', 'drumstick', 'strawberry'],
    starScores: [1200, 2600, 4200],
    goals: [
      { type: 'collect', color: 'drumstick', target: 16 },
      { type: 'collect', color: 'nailong', target: 16 },
    ],
    layout: L1_LAYOUT,
  },
  {
    id: 2,
    name: '第2关 · 甜心下午茶',
    subtitle: '吃完烤肉来点草莓和波波奶茶解腻，5连可召唤彩虹百变奶龙！',
    rows: 8,
    cols: 8,
    moves: 22,
    colorsCount: 5,
    colors: ['nailong', 'bombloong', 'drumstick', 'strawberry', 'milktea'],
    starScores: [1500, 3000, 4800],
    goals: [
      { type: 'collect', color: 'strawberry', target: 18 },
      { type: 'collect', color: 'milktea', target: 18 },
    ],
    layout: L2_LAYOUT,
  },
  {
    id: 3,
    name: '第3关 · 雪糕薄冰岛',
    subtitle: '零食被冻在像素冰块下啦！在冰块上消除棋子即可破冰！',
    rows: 8,
    cols: 8,
    moves: 24,
    colorsCount: 5,
    starScores: [1800, 3500, 5400],
    goals: [{ type: 'ice', target: countLayoutLayers(L3_LAYOUT, 'ice') }],
    layout: L3_LAYOUT,
  },
  {
    id: 4,
    name: '第4关 · 冰晶爱心湾',
    subtitle: '深色双层厚冰需要消除两次！试试把两个特效棋子相邻交换！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 5,
    starScores: [2200, 4000, 6200],
    goals: [{ type: 'ice', target: countLayoutLayers(L4_LAYOUT, 'ice') }],
    layout: L4_LAYOUT,
  },
  {
    id: 5,
    name: '第5关 · 【Boss】暴暴龙突袭',
    subtitle: '暴暴龙来抢零食啦！连消发射火球痛扁它，小心它扔铁链捣乱！',
    rows: 8,
    cols: 8,
    moves: 25,
    colorsCount: 5,
    starScores: [2800, 4800, 7200],
    bossMaxHp: 620,
    bossAttackInterval: 3,
    goals: [{ type: 'boss', target: 620 }],
    layout: L5_BOSS_LAYOUT,
  },
  {
    id: 6,
    name: '第6关 · 零食木箱阵',
    subtitle: '在木箱旁边消除棋子，或用奶龙肚皮压顶直接震碎木箱！',
    rows: 8,
    cols: 8,
    moves: 26,
    colorsCount: 6,
    starScores: [2400, 4400, 6600],
    goals: [
      { type: 'crate', target: countLayoutLayers(L6_CRATE_LAYOUT, 'crate') },
      { type: 'collect', color: 'drumstick', target: 18 },
    ],
    layout: L6_CRATE_LAYOUT,
  },
  {
    id: 7,
    name: '第7关 · 铁链封锁线',
    subtitle: '被锁链困住的棋子无法拖动，和同色棋子凑成3连即可解开锁链！',
    rows: 8,
    cols: 8,
    moves: 27,
    colorsCount: 6,
    starScores: [2800, 5000, 7600],
    goals: [
      { type: 'chain', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'chain') },
      { type: 'ice', target: countLayoutLayers(L7_CHAIN_LAYOUT, 'ice') },
    ],
    layout: L7_CHAIN_LAYOUT,
  },
  {
    id: 8,
    name: '第8关 · 大肚肚圆圆岛',
    subtitle: '“我的大肚肚真的很酷酷！”在圆滚滚的肚皮棋盘收集全员头像吧！',
    rows: 8,
    cols: 8,
    moves: 28,
    colorsCount: 6,
    starScores: [3000, 5400, 8200],
    goals: [
      { type: 'collect', color: 'nailong', target: 22 },
      { type: 'collect', color: 'bombloong', target: 22 },
      { type: 'collect', color: 'minion', target: 22 },
    ],
    layout: L8_BELLY_LAYOUT,
  },
  {
    id: 9,
    name: '第9关 · 冰火双层堡',
    subtitle: '暴暴龙城堡大门前布满了双层木箱与厚冰，善用小七的发明道具！',
    rows: 8,
    cols: 8,
    moves: 29,
    colorsCount: 6,
    starScores: [3500, 6200, 9200],
    goals: [
      { type: 'crate', target: countLayoutLayers(L9_FORTRESS_LAYOUT, 'crate') },
      { type: 'ice', target: countLayoutLayers(L9_FORTRESS_LAYOUT, 'ice') },
    ],
    layout: L9_FORTRESS_LAYOUT,
  },
  {
    id: 10,
    name: '第10关 · 【终极Boss】宇宙最强吃货王',
    subtitle: '终极对决！攒满大肚皮能量+双特效清屏，夺回小七家的全部零食！',
    rows: 8,
    cols: 8,
    moves: 32,
    colorsCount: 6,
    starScores: [4500, 7800, 11500],
    bossMaxHp: 1150,
    bossAttackInterval: 3,
    goals: [{ type: 'boss', target: 1150 }],
    layout: L10_FINAL_BOSS_LAYOUT,
  },
];

export const ENDLESS_LEVEL: LevelConfig = {
  id: 99,
  name: '无尽吃货挑战 · 干饭王模式',
  subtitle: '每满 2500 分奖励 +4 步与随机道具！看看奶龙今天能吃多少分！',
  rows: 8,
  cols: 8,
  moves: 20,
  colorsCount: 6,
  starScores: [3000, 8000, 16000],
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
      hammer: 3,
      swap_glove: 2,
      shuffle: 3,
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
