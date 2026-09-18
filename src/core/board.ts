// Pure board + fleet logic. No DOM, no timing.

export const N = 10;

export type Orientation = 'H' | 'V';
export interface Coord { x: number; y: number }

export const SHIPS = [
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 },
  { name: 'Patrol', size: 1 },
] as const;

export type CellState = 'empty' | 'miss' | 'hit' | 'sunk';

/** Ship placement on a board. */
export interface Ship {
  name: string;
  size: number;
  origin: Coord;
  orient: Orientation;
  hits: number; // 0..size; hits === size => sunk
}

export interface Board {
  ships: Ship[];
  /** shots[y][x]: null = unshot, otherwise CellState of that shot */
  shots: (CellState | null)[][];
}

export function emptyBoard(): Board {
  return {
    ships: [],
    shots: Array.from({ length: N }, () => Array<CellState | null>(N).fill(null)),
  };
}

export function cellsOf(s: Ship): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i < s.size; i++) {
    out.push(s.orient === 'H' ? { x: s.origin.x + i, y: s.origin.y } : { x: s.origin.x, y: s.origin.y + i });
  }
  return out;
}

export function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < N && c.y >= 0 && c.y < N;
}

export function canPlace(b: Board, size: number, origin: Coord, orient: Orientation): boolean {
  const probe: Ship = { name: '', size, origin, orient, hits: 0 };
  const cs = cellsOf(probe);
  if (!cs.every(inBounds)) return false;
  // no adjacency: every cell must be ≥1 apart from existing ship cells
  const taken = new Set(b.ships.flatMap((s) => cellsOf(s).map((c) => `${c.x},${c.y}`)));
  for (const c of cs) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (taken.has(`${c.x + dx},${c.y + dy}`)) return false;
      }
  }
  return true;
}

export function place(b: Board, name: string, size: number, origin: Coord, orient: Orientation): boolean {
  if (!canPlace(b, size, origin, orient)) return false;
  b.ships.push({ name, size, origin, orient, hits: 0 });
  return true;
}

/** Ship occupying a cell, if any. */
export function shipAt(b: Board, c: Coord): Ship | undefined {
  return b.ships.find((s) =>
    cellsOf(s).some((p) => p.x === c.x && p.y === c.y),
  );
}

export interface ShotResult {
  state: CellState;
  ship?: Ship;
  /** true when this shot sank a ship */
  sunk: boolean;
  /** all ships sunk => game over */
  gameOver: boolean;
}

/** Fire at a cell. Mutates board. Returns null if cell was already shot. */
export function fire(b: Board, c: Coord): ShotResult | null {
  if (!inBounds(c) || b.shots[c.y][c.x] !== null) return null;
  const ship = shipAt(b, c);
  if (!ship) {
    b.shots[c.y][c.x] = 'miss';
    return { state: 'miss', sunk: false, gameOver: false };
  }
  ship.hits++;
  const sunk = ship.hits === ship.size;
  b.shots[c.y][c.x] = sunk ? 'sunk' : 'hit';
  // promote all prior 'hit' markers of a sunk ship to 'sunk'
  if (sunk) {
    for (const p of cellsOf(ship)) {
      if (b.shots[p.y][p.x] === 'hit') b.shots[p.y][p.x] = 'sunk';
    }
  }
  const gameOver = b.ships.every((s) => s.hits === s.size);
  return { state: sunk ? 'sunk' : 'hit', ship, sunk, gameOver };
}

/** Random valid full placement (ships never touch). */
export function randomFleet(): Board {
  const b = emptyBoard();
  for (const { name, size } of SHIPS) {
    let guard = 0;
    while (!place(b, name, size, randCell(), Math.random() < 0.5 ? 'H' : 'V')) {
      if (++guard > 5000) throw new Error('placement failed');
    }
  }
  return b;
}

function randCell(): Coord {
  return { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 };
}
