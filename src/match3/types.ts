export type TileColor =
  | 'nailong'
  | 'bombloong'
  | 'minion'
  | 'drumstick'
  | 'strawberry'
  | 'milktea';

export const ALL_TILE_COLORS: readonly TileColor[] = [
  'nailong',
  'bombloong',
  'minion',
  'drumstick',
  'strawberry',
  'milktea',
] as const;

export type SpecialType = 'none' | 'line_h' | 'line_v' | 'bomb' | 'rainbow';

export type BoosterType = 'hammer' | 'swap_glove' | 'shuffle' | 'plus5';

export interface Coord {
  row: number;
  col: number;
}

export interface TileData {
  id: number;
  color: TileColor;
  special: SpecialType;
}

export interface CellState {
  row: number;
  col: number;
  hole: boolean;
  iceLevel: 0 | 1 | 2;
  crateHp: 0 | 1 | 2;
  chain: boolean;
  tile: TileData | null;
}

export interface ClearedTileEvent {
  row: number;
  col: number;
  color: TileColor;
  special: SpecialType;
  reason: 'match' | 'blast' | 'skill';
}

export interface FallMove {
  tileId: number;
  color: TileColor;
  special: SpecialType;
  fromRow: number; // negative if spawned above top
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface BlastEffectEvent {
  kind: 'line_h' | 'line_v' | 'bomb3' | 'bomb5' | 'cross3' | 'rainbow_rays' | 'rainbow_all' | 'belly_slam';
  origin: Coord;
  targets?: Coord[];
  color?: TileColor;
}

export interface CascadeStep {
  comboIndex: number; // 1, 2, 3...
  cleared: ClearedTileEvent[];
  spawnedSpecials: Array<{ row: number; col: number; tile: TileData }>;
  blasts: BlastEffectEvent[];
  iceBroken: number;
  cratesBroken: number;
  chainsBroken: number;
  scoreDelta: number;
  bellyEnergyDelta: number;
  bossDamageDelta: number;
  falls: FallMove[];
  boardSnapshot: CellState[][];
}

export interface TurnResolution {
  valid: boolean;
  consumedMove: boolean;
  steps: CascadeStep[];
  shuffledAfter: boolean;
  totalCombo: number;
  totalScoreDelta: number;
  totalBellyDelta: number;
  totalBossDamage: number;
}

export type GoalType = 'collect' | 'ice' | 'crate' | 'chain' | 'score' | 'boss';

export interface LevelGoal {
  type: GoalType;
  color?: TileColor; // for 'collect'
  target: number;
  current: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  rows: number;
  cols: number;
  moves: number;
  colorsCount: 5 | 6;
  colors?: readonly TileColor[];
  starScores: [number, number, number];
  goals: Array<Omit<LevelGoal, 'current'>>;
  bossMaxHp?: number;
  bossAttackInterval?: number; // every N moves Bombloong throws obstacles
  /**
   * 8x8 ASCII layout codes:
   * '.' = normal cell
   * '#' = hole (non-playable)
   * '1' = single ice, '2' = double ice
   * 'c' = 1-HP crate, 'C' = 2-HP crate
   * 'L' = chained tile, 'I' = chained tile + single ice
   */
  layout: string[];
}
