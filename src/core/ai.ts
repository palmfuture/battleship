// AI opponent: Hunt (parity random) + Target (line-extension) strategy.
// Stateless: every move re-derives targets from the board, so no queue can go stale or out of bounds.
import { N, type Board, type Coord } from './board.ts';

const ORTHO: Coord[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export class HuntTargetAi {
  move(player: Board): Coord {
    const target = this.targetShot(player);
    return target ?? this.huntShot(player);
  }

  /** Aim at hits whose ship is not yet sunk ('hit' cells; sunk ships are marked 'sunk'). */
  private targetShot(b: Board): Coord | null {
    const hits: Coord[] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (b.shots[y][x] === 'hit') hits.push({ x, y });
    if (hits.length === 0) return null;

    // Two adjacent hits => the ship lies along that line: shoot beyond the run's ends.
    for (const h of hits) {
      for (const d of ORTHO) {
        const n = { x: h.x + d.x, y: h.y + d.y };
        if (b.shots[n.y]?.[n.x] !== 'hit') continue;
        const fwd = runEnd(b, h, d);
        const back = runEnd(b, h, { x: -d.x, y: -d.y });
        if (isUnshot(b, fwd)) return fwd;
        if (isUnshot(b, back)) return back;
      }
    }

    // Isolated hit: any unshot orthogonal neighbor.
    const neighbors = hits
      .flatMap((h) => ORTHO.map((d) => ({ x: h.x + d.x, y: h.y + d.y })))
      .filter((c) => isUnshot(b, c));
    if (neighbors.length === 0) return null;
    return neighbors[(Math.random() * neighbors.length) | 0];
  }

  /** Parity hunt: no unshot cell can hide the smallest alive ship between two shots. */
  private huntShot(b: Board): Coord {
    const aliveSizes = b.ships.filter((s) => s.hits < s.size).map((s) => s.size);
    const minSize = aliveSizes.length > 0 ? Math.min(...aliveSizes) : 1;
    const candidates: Coord[] = [];
    const anyUnshot: Coord[] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (b.shots[y][x] !== null) continue;
        anyUnshot.push({ x, y });
        if ((x + y) % minSize === 0) candidates.push({ x, y });
      }
    const pool = candidates.length > 0 ? candidates : anyUnshot;
    return pool[(Math.random() * pool.length) | 0];
  }
}

function isUnshot(b: Board, c: Coord): boolean {
  return !!b.shots[c.y] && b.shots[c.y][c.x] === null;
}

/** Walk from `from` along `d` through contiguous 'hit' cells; return the first cell past the run. */
function runEnd(b: Board, from: Coord, d: Coord): Coord {
  let cur = from;
  for (;;) {
    const next = { x: cur.x + d.x, y: cur.y + d.y };
    if (b.shots[next.y]?.[next.x] === 'hit') cur = next;
    else return next;
  }
}
