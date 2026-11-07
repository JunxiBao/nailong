import {
  ALL_TILE_COLORS,
  CascadeStep,
  CellState,
  Coord,
  FallMove,
  LevelConfig,
  LevelGoal,
  SpecialType,
  TileColor,
  TileData,
  TurnResolution,
} from './types';

interface MatchRun {
  dir: 'h' | 'v';
  color: TileColor;
  cells: Coord[];
}

interface MatchCluster {
  color: TileColor;
  cells: Coord[];
  runs: MatchRun[];
  synthesize: SpecialType;
  spawnAt: Coord | null;
}

export class BoardEngine {
  public readonly rows: number;
  public readonly cols: number;
  public readonly palette: TileColor[];
  public grid: CellState[][];
  private nextTileId = 1;
  private rng: () => number;

  constructor(
    config: Pick<LevelConfig, 'rows' | 'cols' | 'colorsCount' | 'layout'> & {
      colors?: readonly TileColor[];
      goals?: ReadonlyArray<Pick<LevelGoal, 'type' | 'color'>>;
    },
    rng: () => number = Math.random
  ) {
    this.rows = config.rows;
    this.cols = config.cols;
    this.palette = BoardEngine.resolvePalette(config);
    this.rng = rng;
    this.grid = this.buildInitialGrid(config.layout);
    this.ensurePalettePresence();
    this.ensurePlayableBoard();
  }

  /**
   * Builds the active spawnable/matchable tile palette for a level and guarantees
   * every 'collect' goal color is included in `this.palette`.
   */
  private static resolvePalette(config: {
    colorsCount: number;
    colors?: readonly TileColor[];
    goals?: ReadonlyArray<Pick<LevelGoal, 'type' | 'color'>>;
  }): TileColor[] {
    const required = new Set<TileColor>();
    for (const g of config.goals ?? []) {
      if (g.type === 'collect' && g.color) {
        required.add(g.color);
      }
    }

    const base: TileColor[] = [];
    const seedList = config.colors && config.colors.length > 0
      ? config.colors
      : ALL_TILE_COLORS.slice(0, config.colorsCount);

    for (const c of seedList) {
      if (!base.includes(c)) base.push(c);
    }

    // Ensure every required collect-goal color is in the active palette
    for (const req of required) {
      if (!base.includes(req)) {
        if (base.length < config.colorsCount) {
          base.push(req);
        } else {
          // Replace the last non-required color so total color count stays balanced
          let replaceIdx = -1;
          for (let i = base.length - 1; i >= 0; i--) {
            if (!required.has(base[i])) {
              replaceIdx = i;
              break;
            }
          }
          if (replaceIdx >= 0) {
            base[replaceIdx] = req;
          } else {
            base.push(req);
          }
        }
      }
    }

    for (const fallbackColor of ALL_TILE_COLORS) {
      if (base.length >= config.colorsCount) break;
      if (!base.includes(fallbackColor)) {
        base.push(fallbackColor);
      }
    }

    return base;
  }

  /**
   * Ensures every color in `this.palette` appears at least 3 times on the initial board
   * so all collectable items are visibly present right from Move 1.
   */
  private ensurePalettePresence(): void {
    const counts = new Map<TileColor, number>();
    for (const c of this.palette) counts.set(c, 0);

    const openCells: Coord[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.hole && cell.crateHp === 0 && cell.tile) {
          counts.set(cell.tile.color, (counts.get(cell.tile.color) ?? 0) + 1);
          openCells.push({ row: r, col: c });
        }
      }
    }

    if (openCells.length < this.palette.length * 3) return;

    for (const targetColor of this.palette) {
      while ((counts.get(targetColor) ?? 0) < 3) {
        // Pick an open cell whose current color has > 4 tiles and where placing targetColor won't create an instant 3-match
        let placed = false;
        for (const pos of openCells) {
          const curTile = this.grid[pos.row][pos.col].tile!;
          const curCount = counts.get(curTile.color) ?? 0;
          if (curTile.color === targetColor || curCount <= 4) continue;

          const oldColor = curTile.color;
          curTile.color = targetColor;
          if (!this.hasAnyMatchQuick()) {
            counts.set(oldColor, curCount - 1);
            counts.set(targetColor, (counts.get(targetColor) ?? 0) + 1);
            placed = true;
            break;
          }
          curTile.color = oldColor;
        }
        if (!placed) break;
      }
    }
  }

  public cloneGrid(): CellState[][] {
    return this.grid.map((row) =>
      row.map((cell) => ({
        ...cell,
        tile: cell.tile ? { ...cell.tile } : null,
      }))
    );
  }

  private randomColor(exclude?: Set<TileColor>): TileColor {
    const choices = exclude && exclude.size > 0 ? this.palette.filter((c) => !exclude.has(c)) : this.palette;
    const pool = choices.length > 0 ? choices : this.palette;
    return pool[Math.floor(this.rng() * pool.length)];
  }

  private createTile(color: TileColor, special: SpecialType = 'none'): TileData {
    return {
      id: this.nextTileId++,
      color,
      special,
    };
  }

  private buildInitialGrid(layout: string[]): CellState[][] {
    const grid: CellState[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const rowArr: CellState[] = [];
      const line = layout[r] ?? '.'.repeat(this.cols);
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] ?? '.';
        const hole = ch === '#';
        const crateHp: 0 | 1 | 2 = ch === 'c' ? 1 : ch === 'C' ? 2 : 0;
        const iceLevel: 0 | 1 | 2 = ch === '1' || ch === 'I' ? 1 : ch === '2' ? 2 : 0;
        const chain = ch === 'L' || ch === 'I';

        let tile: TileData | null = null;
        if (!hole && crateHp === 0) {
          const forbidden = new Set<TileColor>();
          if (c >= 2) {
            const left1 = rowArr[c - 1]?.tile;
            const left2 = rowArr[c - 2]?.tile;
            if (left1 && left2 && left1.color === left2.color) {
              forbidden.add(left1.color);
            }
          }
          if (r >= 2) {
            const up1 = grid[r - 1][c]?.tile;
            const up2 = grid[r - 2][c]?.tile;
            if (up1 && up2 && up1.color === up2.color) {
              forbidden.add(up1.color);
            }
          }
          tile = this.createTile(this.randomColor(forbidden), 'none');
        }

        rowArr.push({
          row: r,
          col: c,
          hole,
          iceLevel,
          crateHp,
          chain,
          tile,
        });
      }
      grid.push(rowArr);
    }
    return grid;
  }

  public inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  public isAdjacent(a: Coord, b: Coord): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  public isMovableCell(r: number, c: number): boolean {
    if (!this.inBounds(r, c)) return false;
    const cell = this.grid[r][c];
    return !cell.hole && cell.crateHp === 0 && !cell.chain && cell.tile !== null;
  }

  private isSpecialDualCombo(t1: TileData, t2: TileData): boolean {
    if (t1.special === 'rainbow' || t2.special === 'rainbow') return true;
    return t1.special !== 'none' && t2.special !== 'none';
  }

  /**
   * Finds all valid adjacent swaps that either trigger a special swap or produce at least one 3+ match.
   */
  public findValidMoves(): Array<[Coord, Coord]> {
    const moves: Array<[Coord, Coord]> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.isMovableCell(r, c)) continue;
        const a: Coord = { row: r, col: c };
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          const nr = r + dr;
          const nc = c + dc;
          if (!this.isMovableCell(nr, nc)) continue;
          const b: Coord = { row: nr, col: nc };
          const ta = this.grid[r][c].tile!;
          const tb = this.grid[nr][nc].tile!;
          if (this.isSpecialDualCombo(ta, tb)) {
            moves.push([a, b]);
            continue;
          }
          if (ta.color === tb.color) continue;
          // Temporarily swap and check matches
          this.swapTilesRaw(a, b);
          const hasMatch = this.hasAnyMatchQuick();
          this.swapTilesRaw(a, b);
          if (hasMatch) {
            moves.push([a, b]);
          }
        }
      }
    }
    return moves;
  }

  public getHintMove(): [Coord, Coord] | null {
    const moves = this.findValidMoves();
    if (moves.length === 0) return null;
    // Prefer special combos if available
    for (const [a, b] of moves) {
      const ta = this.grid[a.row][a.col].tile!;
      const tb = this.grid[b.row][b.col].tile!;
      if (this.isSpecialDualCombo(ta, tb)) return [a, b];
    }
    return moves[0];
  }

  private swapTilesRaw(a: Coord, b: Coord): void {
    const tmp = this.grid[a.row][a.col].tile;
    this.grid[a.row][a.col].tile = this.grid[b.row][b.col].tile;
    this.grid[b.row][b.col].tile = tmp;
  }

  private hasAnyMatchQuick(): boolean {
    // Horizontal check
    for (let r = 0; r < this.rows; r++) {
      let run = 1;
      for (let c = 1; c < this.cols; c++) {
        const prev = this.grid[r][c - 1].tile;
        const curr = this.grid[r][c].tile;
        if (
          prev &&
          curr &&
          prev.special !== 'rainbow' &&
          curr.special !== 'rainbow' &&
          prev.color === curr.color
        ) {
          run++;
          if (run >= 3) return true;
        } else {
          run = 1;
        }
      }
    }
    // Vertical check
    for (let c = 0; c < this.cols; c++) {
      let run = 1;
      for (let r = 1; r < this.rows; r++) {
        const prev = this.grid[r - 1][c].tile;
        const curr = this.grid[r][c].tile;
        if (
          prev &&
          curr &&
          prev.special !== 'rainbow' &&
          curr.special !== 'rainbow' &&
          prev.color === curr.color
        ) {
          run++;
          if (run >= 3) return true;
        } else {
          run = 1;
        }
      }
    }
    return false;
  }

  /**
   * Shuffles movable normal tiles so there are no immediate matches AND at least 1 valid move exists.
   */
  public shuffleBoard(): boolean {
    const movableCoords: Coord[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.isMovableCell(r, c)) {
          movableCoords.push({ row: r, col: c });
        }
      }
    }
    if (movableCoords.length < 3) return false;

    for (let attempt = 0; attempt < 40; attempt++) {
      const tiles = movableCoords.map((p) => this.grid[p.row][p.col].tile!);
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      movableCoords.forEach((p, idx) => {
        this.grid[p.row][p.col].tile = tiles[idx];
      });
      if (!this.hasAnyMatchQuick() && this.findValidMoves().length > 0) {
        return true;
      }
    }

    // Fallback guaranteed playable setup: plant a clean 1-move 3-match if board is ultra cramped
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.isMovableCell(r, c)) continue;
        const forbidden = new Set<TileColor>();
        if (c >= 2 && this.grid[r][c - 1].tile?.color === this.grid[r][c - 2].tile?.color) {
          if (this.grid[r][c - 1].tile) forbidden.add(this.grid[r][c - 1].tile!.color);
        }
        if (r >= 2 && this.grid[r - 1][c].tile?.color === this.grid[r - 2][c].tile?.color) {
          if (this.grid[r - 1][c].tile) forbidden.add(this.grid[r - 1][c].tile!.color);
        }
        this.grid[r][c].tile!.color = this.randomColor(forbidden);
      }
    }
    if (this.findValidMoves().length === 0 && movableCoords.length >= 3) {
      // Turn one movable tile into a rainbow Nailong to guarantee a move!
      const p = movableCoords[0];
      this.grid[p.row][p.col].tile!.special = 'rainbow';
    }
    return true;
  }

  private ensurePlayableBoard(): boolean {
    if (this.findValidMoves().length === 0) {
      return this.shuffleBoard();
    }
    return false;
  }

  /**
   * Standard player swap action (consumes 1 move if valid).
   */
  public trySwap(a: Coord, b: Coord): TurnResolution {
    if (!this.isAdjacent(a, b) || !this.isMovableCell(a.row, a.col) || !this.isMovableCell(b.row, b.col)) {
      return this.emptyResolution(false, false);
    }

    const ta = this.grid[a.row][a.col].tile!;
    const tb = this.grid[b.row][b.col].tile!;

    this.swapTilesRaw(a, b);

    // Case 1: Dual special or Rainbow swap!
    if (this.isSpecialDualCombo(ta, tb)) {
      const steps: CascadeStep[] = [];
      const firstStep = this.executeDualSpecialCombo(a, b, 1);
      steps.push(firstStep);
      this.resolveCascadesInto(steps, 2);
      const shuffledAfter = this.ensurePlayableBoard();
      return this.summarizeResolution(true, true, steps, shuffledAfter);
    }

    // Case 2: Standard swap -> must form at least one 3+ match
    const clusters = this.findMatchClusters([b, a]);
    if (clusters.length === 0) {
      // Revert swap
      this.swapTilesRaw(a, b);
      return this.emptyResolution(false, false);
    }

    const steps: CascadeStep[] = [];
    this.resolveCascadesInto(steps, 1, [b, a]);
    const shuffledAfter = this.ensurePlayableBoard();
    return this.summarizeResolution(true, true, steps, shuffledAfter);
  }

  /**
   * Booster 1: Xiao Qi's Mechanical Hammer — smashes 1 target cell (no move cost).
   */
  public useHammer(target: Coord): TurnResolution {
    if (!this.inBounds(target.row, target.col) || this.grid[target.row][target.col].hole) {
      return this.emptyResolution(false, false);
    }
    const cell = this.grid[target.row][target.col];
    if (cell.crateHp === 0 && !cell.chain && cell.iceLevel === 0 && !cell.tile) {
      return this.emptyResolution(false, false);
    }

    const step = this.createEmptyStep(1);
    const blastQueue: Array<{ pos: Coord; tile: TileData }> = [];
    const triggered = new Set<string>();
    this.damageCellByBlast(target.row, target.col, 'skill', step, blastQueue, triggered);
    this.drainBlastQueue(blastQueue, triggered, step);
    step.falls = this.applyGravityAndRefill();
    step.boardSnapshot = this.cloneGrid();

    const steps: CascadeStep[] = [step];
    this.resolveCascadesInto(steps, 2);
    const shuffledAfter = this.ensurePlayableBoard();
    return this.summarizeResolution(true, false, steps, shuffledAfter);
  }

  /**
   * Booster 2: Xiao Qi's Force-Swap Glove — swaps any 2 adjacent movable cells even without a match!
   */
  public useForceSwap(a: Coord, b: Coord): TurnResolution {
    if (!this.isAdjacent(a, b) || !this.isMovableCell(a.row, a.col) || !this.isMovableCell(b.row, b.col)) {
      return this.emptyResolution(false, false);
    }
    const ta = this.grid[a.row][a.col].tile!;
    const tb = this.grid[b.row][b.col].tile!;
    this.swapTilesRaw(a, b);

    const steps: CascadeStep[] = [];
    if (this.isSpecialDualCombo(ta, tb)) {
      steps.push(this.executeDualSpecialCombo(a, b, 1));
      this.resolveCascadesInto(steps, 2);
    } else {
      this.resolveCascadesInto(steps, 1, [b, a]);
    }
    const shuffledAfter = this.ensurePlayableBoard();
    return this.summarizeResolution(true, false, steps, shuffledAfter);
  }

  /**
   * Active Skill: Nailong's 2-Ton Belly Slam ("大肚肚泰山压顶")!
   * Smashes up to 6 priority obstacles/tiles AND gifts 2 special tiles onto the board!
   */
  public useBellySlam(): TurnResolution {
    const step = this.createEmptyStep(1);
    const candidates: Array<{ pos: Coord; priority: number }> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.hole) continue;
        let prio = 1;
        if (cell.crateHp > 0) prio = 5;
        else if (cell.chain) prio = 4;
        else if (cell.iceLevel > 0) prio = 3;
        else if (cell.tile) prio = 1;
        else continue;
        candidates.push({ pos: { row: r, col: c }, priority: prio + this.rng() * 0.8 });
      }
    }
    candidates.sort((x, y) => y.priority - x.priority);
    const chosen = candidates.slice(0, Math.min(5, candidates.length)).map((c) => c.pos);

    step.blasts.push({
      kind: 'belly_slam',
      origin: { row: Math.floor(this.rows / 2), col: Math.floor(this.cols / 2) },
      targets: chosen,
    });

    const blastQueue: Array<{ pos: Coord; tile: TileData }> = [];
    const triggered = new Set<string>();
    for (const pos of chosen) {
      this.damageCellByBlast(pos.row, pos.col, 'skill', step, blastQueue, triggered);
    }
    this.drainBlastQueue(blastQueue, triggered, step);
    step.falls = this.applyGravityAndRefill();

    // Gift 1 random normal tile with special power ('line_h', 'line_v', or 'bomb')!
    const normalPositions: Coord[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.hole && cell.crateHp === 0 && cell.tile && cell.tile.special === 'none') {
          normalPositions.push({ row: r, col: c });
        }
      }
    }
    for (let k = 0; k < 1 && normalPositions.length > 0; k++) {
      const idx = Math.floor(this.rng() * normalPositions.length);
      const p = normalPositions.splice(idx, 1)[0];
      const tile = this.grid[p.row][p.col].tile!;
      const kinds: SpecialType[] = ['line_h', 'line_v', 'bomb'];
      tile.special = kinds[Math.floor(this.rng() * kinds.length)];
      step.spawnedSpecials.push({ row: p.row, col: p.col, tile: { ...tile } });
    }

    step.scoreDelta += 350;
    step.bossDamageDelta += 85;
    step.boardSnapshot = this.cloneGrid();

    const steps: CascadeStep[] = [step];
    this.resolveCascadesInto(steps, 2);
    const shuffledAfter = this.ensurePlayableBoard();
    return this.summarizeResolution(true, false, steps, shuffledAfter);
  }

  /**
   * Boss Stage Mechanic: Bombloong throws 1~2 chains or ice onto random normal cells!
   */
  public triggerBossSabotage(count = 2): Coord[] {
    const affected: Coord[] = [];
    const pool: Coord[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.hole && cell.crateHp === 0 && !cell.chain && cell.tile && cell.tile.special === 'none') {
          pool.push({ row: r, col: c });
        }
      }
    }
    for (let i = 0; i < count && pool.length > 2; i++) {
      const idx = Math.floor(this.rng() * pool.length);
      const p = pool.splice(idx, 1)[0];
      if (this.rng() < 0.55) {
        this.grid[p.row][p.col].chain = true;
      } else {
        this.grid[p.row][p.col].iceLevel = Math.min(2, this.grid[p.row][p.col].iceLevel + 1) as 0 | 1 | 2;
      }
      affected.push(p);
    }
    this.ensurePlayableBoard();
    return affected;
  }

  private resolveCascadesInto(steps: CascadeStep[], startCombo: number, preferredSpawns?: Coord[]): void {
    let combo = startCombo;
    let preferred = preferredSpawns;
    while (combo < 30) {
      const clusters = this.findMatchClusters(preferred);
      preferred = undefined;
      if (clusters.length === 0) break;

      const step = this.executeMatchClusters(clusters, combo);
      steps.push(step);
      combo++;
    }
  }

  private findMatchClusters(preferredSpawns?: Coord[]): MatchCluster[] {
    const runs: MatchRun[] = [];

    // Horizontal runs
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const t = this.grid[r][c].tile;
        if (!t || t.special === 'rainbow') {
          c++;
          continue;
        }
        let end = c + 1;
        while (end < this.cols) {
          const nt = this.grid[r][end].tile;
          if (nt && nt.special !== 'rainbow' && nt.color === t.color) {
            end++;
          } else {
            break;
          }
        }
        if (end - c >= 3) {
          const cells: Coord[] = [];
          for (let k = c; k < end; k++) cells.push({ row: r, col: k });
          runs.push({ dir: 'h', color: t.color, cells });
        }
        c = end;
      }
    }

    // Vertical runs
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const t = this.grid[r][c].tile;
        if (!t || t.special === 'rainbow') {
          r++;
          continue;
        }
        let end = r + 1;
        while (end < this.rows) {
          const nt = this.grid[end][c].tile;
          if (nt && nt.special !== 'rainbow' && nt.color === t.color) {
            end++;
          } else {
            break;
          }
        }
        if (end - r >= 3) {
          const cells: Coord[] = [];
          for (let k = r; k < end; k++) cells.push({ row: k, col: c });
          runs.push({ dir: 'v', color: t.color, cells });
        }
        r = end;
      }
    }

    if (runs.length === 0) return [];

    // Group overlapping runs of the same color into connected components
    const visited = new Array(runs.length).fill(false);
    const key = (p: Coord) => `${p.row},${p.col}`;
    const clusters: MatchCluster[] = [];

    const swapDir: 'h' | 'v' | null =
      preferredSpawns && preferredSpawns.length >= 2
        ? preferredSpawns[0].row === preferredSpawns[1].row
          ? 'h'
          : 'v'
        : null;

    for (let i = 0; i < runs.length; i++) {
      if (visited[i]) continue;
      visited[i] = true;
      const compRuns: MatchRun[] = [runs[i]];
      const cellMap = new Map<string, Coord>();
      const cellFreq = new Map<string, number>();

      const addRunCells = (run: MatchRun) => {
        for (const p of run.cells) {
          const k = key(p);
          cellMap.set(k, p);
          cellFreq.set(k, (cellFreq.get(k) ?? 0) + 1);
        }
      };
      addRunCells(runs[i]);

      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < runs.length; j++) {
          if (visited[j] || runs[j].color !== runs[i].color) continue;
          if (runs[j].cells.some((p) => cellMap.has(key(p)))) {
            visited[j] = true;
            compRuns.push(runs[j]);
            addRunCells(runs[j]);
            changed = true;
          }
        }
      }

      const maxStraight = Math.max(...compRuns.map((r) => r.cells.length));
      const hasH = compRuns.some((r) => r.dir === 'h');
      const hasV = compRuns.some((r) => r.dir === 'v');

      let synthesize: SpecialType = 'none';
      if (maxStraight >= 5) {
        synthesize = 'rainbow';
      } else if (hasH && hasV) {
        synthesize = 'bomb';
      } else if (maxStraight === 4) {
        if (swapDir) {
          synthesize = swapDir === 'h' ? 'line_h' : 'line_v';
        } else {
          const fourRun = compRuns.find((r) => r.cells.length === 4)!;
          synthesize = fourRun.dir === 'h' ? 'line_v' : 'line_h';
        }
      }

      let spawnAt: Coord | null = null;
      if (synthesize !== 'none') {
        const allCells = [...cellMap.values()];
        const unchained = allCells.filter((p) => !this.grid[p.row][p.col].chain);
        const candidates = unchained.length > 0 ? unchained : allCells;

        if (preferredSpawns) {
          for (const pref of preferredSpawns) {
            if (candidates.some((c) => c.row === pref.row && c.col === pref.col)) {
              spawnAt = { ...pref };
              break;
            }
          }
        }
        if (!spawnAt) {
          // Prefer T/L intersection cell
          const inter = candidates.find((p) => (cellFreq.get(key(p)) ?? 0) > 1);
          spawnAt = inter ? { ...inter } : { ...candidates[Math.floor(candidates.length / 2)] };
        }
      }

      clusters.push({
        color: runs[i].color,
        cells: [...cellMap.values()],
        runs: compRuns,
        synthesize,
        spawnAt,
      });
    }

    return clusters;
  }

  private executeMatchClusters(clusters: MatchCluster[], comboIndex: number): CascadeStep {
    const step = this.createEmptyStep(comboIndex);
    const blastQueue: Array<{ pos: Coord; tile: TileData }> = [];
    const triggered = new Set<string>();
    const matchedCellSet = new Set<string>();

    const plannedSpawns: Array<{ pos: Coord; tile: TileData }> = [];

    for (const cluster of clusters) {
      for (const p of cluster.cells) {
        matchedCellSet.add(`${p.row},${p.col}`);
      }
      if (cluster.synthesize !== 'none' && cluster.spawnAt) {
        plannedSpawns.push({
          pos: cluster.spawnAt,
          tile: this.createTile(cluster.color, cluster.synthesize),
        });
      }
    }

    // 1. Damage orthogonally adjacent wooden crates around matched cells
    const damagedCratesThisWave = new Set<string>();
    for (const keyStr of matchedCellSet) {
      const [r, c] = keyStr.split(',').map(Number);
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        const nk = `${nr},${nc}`;
        if (!this.inBounds(nr, nc) || damagedCratesThisWave.has(nk)) continue;
        const neighbor = this.grid[nr][nc];
        if (neighbor.crateHp > 0) {
          damagedCratesThisWave.add(nk);
          neighbor.crateHp = (neighbor.crateHp - 1) as 0 | 1 | 2;
          if (neighbor.crateHp === 0) {
            step.cratesBroken++;
          }
          step.scoreDelta += 60;
        }
      }
    }

    // 2. Process matched cells (break chains, crack ice, clear tiles, queue any pre-existing specials)
    for (const keyStr of matchedCellSet) {
      const [r, c] = keyStr.split(',').map(Number);
      const cell = this.grid[r][c];
      if (cell.chain) {
        cell.chain = false;
        step.chainsBroken++;
        step.scoreDelta += 50;
        continue;
      }
      if (cell.iceLevel > 0) {
        cell.iceLevel = (cell.iceLevel - 1) as 0 | 1 | 2;
        step.iceBroken++;
        step.scoreDelta += 50;
      }
      if (cell.tile) {
        const oldTile = cell.tile;
        cell.tile = null;
        step.cleared.push({
          row: r,
          col: c,
          color: oldTile.color,
          special: oldTile.special,
          reason: 'match',
        });
        if (oldTile.special !== 'none') {
          blastQueue.push({ pos: { row: r, col: c }, tile: oldTile });
        }
      }
    }

    // 3. Trigger any specials that were part of the match
    this.drainBlastQueue(blastQueue, triggered, step);

    // 4. Place newly synthesized special tiles!
    for (const sp of plannedSpawns) {
      const cell = this.grid[sp.pos.row][sp.pos.col];
      cell.chain = false;
      cell.tile = sp.tile;
      step.spawnedSpecials.push({ row: sp.pos.row, col: sp.pos.col, tile: { ...sp.tile } });
      step.scoreDelta += 120;
    }

    // 5. Compute score, Nailong belly energy, and Boss damage with combo multiplier!
    const mult = 1 + (comboIndex - 1) * 0.35;
    step.scoreDelta += Math.round(step.cleared.length * 30 * mult);
    step.bellyEnergyDelta = Math.min(26, Math.round(step.cleared.length * 2.0 + step.blasts.length * 5));
    step.bossDamageDelta = Math.round((step.cleared.length * 10 + step.blasts.length * 25) * mult);

    // 6. Gravity & top refill
    step.falls = this.applyGravityAndRefill();
    step.boardSnapshot = this.cloneGrid();
    return step;
  }

  private executeDualSpecialCombo(a: Coord, b: Coord, comboIndex: number): CascadeStep {
    const step = this.createEmptyStep(comboIndex);
    const ta = this.grid[a.row][a.col].tile!;
    const tb = this.grid[b.row][b.col].tile!;
    const blastQueue: Array<{ pos: Coord; tile: TileData }> = [];
    const triggered = new Set<string>([`${a.row},${a.col}`, `${b.row},${b.col}`]);

    // Clear the two swapped tiles first
    for (const pos of [a, b]) {
      const cell = this.grid[pos.row][pos.col];
      if (cell.iceLevel > 0) {
        cell.iceLevel = (cell.iceLevel - 1) as 0 | 1 | 2;
        step.iceBroken++;
      }
      if (cell.tile) {
        step.cleared.push({
          row: pos.row,
          col: pos.col,
          color: cell.tile.color,
          special: cell.tile.special,
          reason: 'blast',
        });
        cell.tile = null;
      }
    }

    const isLine = (s: SpecialType) => s === 'line_h' || s === 'line_v';

    // Combo 1: Rainbow + Rainbow => Full-Board Mega Clear!
    if (ta.special === 'rainbow' && tb.special === 'rainbow') {
      step.blasts.push({ kind: 'rainbow_all', origin: b });
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.grid[r][c].hole) {
            this.damageCellByBlast(r, c, 'blast', step, blastQueue, triggered);
          }
        }
      }
      step.scoreDelta += 1200;
    }
    // Combo 2: Rainbow + Colored (Normal or Special)
    else if (ta.special === 'rainbow' || tb.special === 'rainbow') {
      const rainbowPos = ta.special === 'rainbow' ? a : b;
      const partner = ta.special === 'rainbow' ? tb : ta;
      const targetColor = partner.color;
      const targets: Coord[] = [];

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c].tile;
          if (t && t.color === targetColor) {
            targets.push({ row: r, col: c });
          }
        }
      }
      step.blasts.push({ kind: 'rainbow_rays', origin: rainbowPos, targets, color: targetColor });

      if (partner.special === 'none') {
        for (const p of targets) {
          this.damageCellByBlast(p.row, p.col, 'blast', step, blastQueue, triggered);
        }
      } else {
        // Transform every tile of targetColor into line or bomb, then detonate ALL of them!
        for (const p of targets) {
          const cell = this.grid[p.row][p.col];
          cell.chain = false;
          if (cell.tile) {
            const converted: SpecialType = isLine(partner.special)
              ? this.rng() < 0.5
                ? 'line_h'
                : 'line_v'
              : 'bomb';
            cell.tile.special = converted;
            this.damageCellByBlast(p.row, p.col, 'blast', step, blastQueue, triggered);
          }
        }
      }
      step.scoreDelta += 500;
    }
    // Combo 3: Bomb + Bomb => 5x5 Belly Quake!
    else if (ta.special === 'bomb' && tb.special === 'bomb') {
      step.blasts.push({ kind: 'bomb5', origin: b });
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = b.row + dr;
          const nc = b.col + dc;
          if (this.inBounds(nr, nc) && !this.grid[nr][nc].hole) {
            this.damageCellByBlast(nr, nc, 'blast', step, blastQueue, triggered);
          }
        }
      }
      step.scoreDelta += 450;
    }
    // Combo 4: Line + Bomb => 3 Rows + 3 Columns Giant Flame Sweep!
    else if ((isLine(ta.special) && tb.special === 'bomb') || (ta.special === 'bomb' && isLine(tb.special))) {
      step.blasts.push({ kind: 'cross3', origin: b });
      for (let d = -1; d <= 1; d++) {
        const rr = b.row + d;
        if (rr >= 0 && rr < this.rows) {
          for (let c = 0; c < this.cols; c++) {
            if (!this.grid[rr][c].hole) this.damageCellByBlast(rr, c, 'blast', step, blastQueue, triggered);
          }
        }
        const cc = b.col + d;
        if (cc >= 0 && cc < this.cols) {
          for (let r = 0; r < this.rows; r++) {
            if (!this.grid[r][cc].hole) this.damageCellByBlast(r, cc, 'blast', step, blastQueue, triggered);
          }
        }
      }
      step.scoreDelta += 400;
    }
    // Combo 5: Line + Line => Cross Row + Column Sweep!
    else {
      step.blasts.push({ kind: 'line_h', origin: b });
      step.blasts.push({ kind: 'line_v', origin: b });
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[b.row][c].hole) this.damageCellByBlast(b.row, c, 'blast', step, blastQueue, triggered);
      }
      for (let r = 0; r < this.rows; r++) {
        if (!this.grid[r][b.col].hole) this.damageCellByBlast(r, b.col, 'blast', step, blastQueue, triggered);
      }
      step.scoreDelta += 300;
    }

    this.drainBlastQueue(blastQueue, triggered, step);
    step.scoreDelta += step.cleared.length * 35;
    step.bellyEnergyDelta = Math.min(34, 10 + step.cleared.length * 2);
    step.bossDamageDelta = 60 + step.cleared.length * 12;
    step.falls = this.applyGravityAndRefill();
    step.boardSnapshot = this.cloneGrid();
    return step;
  }

  private drainBlastQueue(
    blastQueue: Array<{ pos: Coord; tile: TileData }>,
    triggered: Set<string>,
    step: CascadeStep
  ): void {
    while (blastQueue.length > 0) {
      const { pos, tile } = blastQueue.shift()!;
      const k = `${pos.row},${pos.col}:${tile.id}`;
      if (triggered.has(k)) continue;
      triggered.add(k);

      if (tile.special === 'line_h') {
        step.blasts.push({ kind: 'line_h', origin: pos });
        for (let c = 0; c < this.cols; c++) {
          if (!this.grid[pos.row][c].hole) {
            this.damageCellByBlast(pos.row, c, 'blast', step, blastQueue, triggered);
          }
        }
      } else if (tile.special === 'line_v') {
        step.blasts.push({ kind: 'line_v', origin: pos });
        for (let r = 0; r < this.rows; r++) {
          if (!this.grid[r][pos.col].hole) {
            this.damageCellByBlast(r, pos.col, 'blast', step, blastQueue, triggered);
          }
        }
      } else if (tile.special === 'bomb') {
        step.blasts.push({ kind: 'bomb3', origin: pos });
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = pos.row + dr;
            const nc = pos.col + dc;
            if (this.inBounds(nr, nc) && !this.grid[nr][nc].hole) {
              this.damageCellByBlast(nr, nc, 'blast', step, blastQueue, triggered);
            }
          }
        }
      } else if (tile.special === 'rainbow') {
        // When triggered indirectly by another blast, clear the most abundant color on the board!
        const counts = new Map<TileColor, number>();
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const t = this.grid[r][c].tile;
            if (t) counts.set(t.color, (counts.get(t.color) ?? 0) + 1);
          }
        }
        let bestColor = this.palette[0];
        let maxCnt = -1;
        for (const [col, cnt] of counts.entries()) {
          if (cnt > maxCnt) {
            maxCnt = cnt;
            bestColor = col;
          }
        }
        const targets: Coord[] = [];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.grid[r][c].tile?.color === bestColor) {
              targets.push({ row: r, col: c });
            }
          }
        }
        step.blasts.push({ kind: 'rainbow_rays', origin: pos, targets, color: bestColor });
        for (const p of targets) {
          this.damageCellByBlast(p.row, p.col, 'blast', step, blastQueue, triggered);
        }
      }
    }
  }

  private damageCellByBlast(
    r: number,
    c: number,
    reason: 'blast' | 'skill',
    step: CascadeStep,
    blastQueue: Array<{ pos: Coord; tile: TileData }>,
    _triggered: Set<string>
  ): void {
    const cell = this.grid[r][c];
    if (cell.hole) return;

    if (cell.crateHp > 0) {
      cell.crateHp = (cell.crateHp - 1) as 0 | 1 | 2;
      if (cell.crateHp === 0) step.cratesBroken++;
      step.scoreDelta += 60;
      return;
    }

    if (cell.chain) {
      cell.chain = false;
      step.chainsBroken++;
      step.scoreDelta += 50;
      return;
    }

    if (cell.iceLevel > 0) {
      cell.iceLevel = (cell.iceLevel - 1) as 0 | 1 | 2;
      step.iceBroken++;
      step.scoreDelta += 50;
    }

    if (cell.tile) {
      const old = cell.tile;
      cell.tile = null;
      step.cleared.push({
        row: r,
        col: c,
        color: old.color,
        special: old.special,
        reason,
      });
      if (old.special !== 'none') {
        blastQueue.push({ pos: { row: r, col: c }, tile: old });
      }
    }
  }

  /**
   * Applies vertical gravity (passing through holes, stopping at crates or chained tiles)
   * and spawns fresh tiles from above each column!
   */
  private applyGravityAndRefill(): FallMove[] {
    const falls: FallMove[] = [];

    for (let c = 0; c < this.cols; c++) {
      // Process segments separated by impassable crates or chained tiles
      // Note: holes can be passed through by falling tiles (classic 开心消消乐 behavior!),
      // whereas crates and chained tiles stay anchored in place.
      let writeRow = this.rows - 1;

      while (writeRow >= 0) {
        const dst = this.grid[writeRow][c];
        if (dst.hole) {
          writeRow--;
          continue;
        }
        if (dst.crateHp > 0 || dst.chain) {
          writeRow--;
          continue;
        }
        if (dst.tile !== null) {
          writeRow--;
          continue;
        }

        // Find the nearest movable tile above writeRow without crossing a crate or chained cell
        let srcRow = writeRow - 1;
        let blocked = false;
        let foundRow = -1;
        while (srcRow >= 0) {
          const above = this.grid[srcRow][c];
          if (above.crateHp > 0 || above.chain) {
            blocked = true;
            break;
          }
          if (!above.hole && above.tile !== null) {
            foundRow = srcRow;
            break;
          }
          srcRow--;
        }

        if (foundRow >= 0) {
          const moving = this.grid[foundRow][c].tile!;
          this.grid[writeRow][c].tile = moving;
          this.grid[foundRow][c].tile = null;
          falls.push({
            tileId: moving.id,
            color: moving.color,
            special: moving.special,
            fromRow: foundRow,
            fromCol: c,
            toRow: writeRow,
            toCol: c,
          });
          writeRow--;
        } else if (!blocked) {
          // Unblocked all the way to top -> spawn new tiles from sky!
          let spawnOffset = -1;
          for (let r = writeRow; r >= 0; r--) {
            const target = this.grid[r][c];
            if (target.hole) continue;
            if (target.crateHp > 0 || target.chain) break;
            if (target.tile === null) {
              const fresh = this.createTile(this.randomColor(), 'none');
              target.tile = fresh;
              falls.push({
                tileId: fresh.id,
                color: fresh.color,
                special: fresh.special,
                fromRow: spawnOffset--,
                fromCol: c,
                toRow: r,
                toCol: c,
              });
            }
          }
          break;
        } else {
          // Blocked by a crate/chain above: try diagonal slide from top-left or top-right!
          let slid = false;
          if (writeRow > 0) {
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (nc < 0 || nc >= this.cols) continue;
              const diag = this.grid[writeRow - 1][nc];
              if (!diag.hole && diag.crateHp === 0 && !diag.chain && diag.tile !== null) {
                const moving = diag.tile;
                diag.tile = null;
                dst.tile = moving;
                falls.push({
                  tileId: moving.id,
                  color: moving.color,
                  special: moving.special,
                  fromRow: writeRow - 1,
                  fromCol: nc,
                  toRow: writeRow,
                  toCol: c,
                });
                slid = true;
                break;
              }
            }
          }
          if (!slid) {
            // Spawn directly into shadowed pocket so pocket cells never stay permanently empty!
            const fresh = this.createTile(this.randomColor(), 'none');
            dst.tile = fresh;
            falls.push({
              tileId: fresh.id,
              color: fresh.color,
              special: fresh.special,
              fromRow: writeRow - 1,
              fromCol: c,
              toRow: writeRow,
              toCol: c,
            });
          }
          writeRow--;
        }
      }
    }

    return falls;
  }

  private createEmptyStep(comboIndex: number): CascadeStep {
    return {
      comboIndex,
      cleared: [],
      spawnedSpecials: [],
      blasts: [],
      iceBroken: 0,
      cratesBroken: 0,
      chainsBroken: 0,
      scoreDelta: 0,
      bellyEnergyDelta: 0,
      bossDamageDelta: 0,
      falls: [],
      boardSnapshot: [],
    };
  }

  private emptyResolution(valid: boolean, consumedMove: boolean): TurnResolution {
    return {
      valid,
      consumedMove,
      steps: [],
      shuffledAfter: false,
      totalCombo: 0,
      totalScoreDelta: 0,
      totalBellyDelta: 0,
      totalBossDamage: 0,
    };
  }

  private summarizeResolution(
    valid: boolean,
    consumedMove: boolean,
    steps: CascadeStep[],
    shuffledAfter: boolean
  ): TurnResolution {
    return {
      valid,
      consumedMove,
      steps,
      shuffledAfter,
      totalCombo: steps.length,
      totalScoreDelta: steps.reduce((acc, s) => acc + s.scoreDelta, 0),
      totalBellyDelta: steps.reduce((acc, s) => acc + s.bellyEnergyDelta, 0),
      totalBossDamage: steps.reduce((acc, s) => acc + s.bossDamageDelta, 0),
    };
  }
}
