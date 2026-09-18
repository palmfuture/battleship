// DOM rendering of boards + fleet panels. Reads Board state, mutates only its own DOM.
import { N, cellsOf, type Board, type Coord, type Ship } from './core/board.ts';

export interface ViewRefs {
  playerHost: HTMLElement;
  enemyHost: HTMLElement;
  playerFleet: HTMLElement;
  enemyFleet: HTMLElement;
  status: HTMLElement;
}

export function createView(refs: ViewRefs) {
  const cellEls: Record<'player' | 'enemy', HTMLElement[][]> = {
    player: grid(refs.playerHost),
    enemy: grid(refs.enemyHost),
  };

  function grid(host: HTMLElement): HTMLElement[][] {
    host.classList.add('board-host');
    const rows: HTMLElement[][] = [];
    for (let y = 0; y < N; y++) {
      const row: HTMLElement[] = [];
      for (let x = 0; x < N; x++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.x = String(x);
        el.dataset.y = String(y);
        host.appendChild(el);
        row.push(el);
      }
      rows.push(row);
    }
    return rows;
  }

  /** Draw ships of a board onto its grid (player sees own ships; enemy only when sunk). */
  function renderShips(side: 'player' | 'enemy', b: Board): void {
    const cells = cellEls[side];
    for (const row of cells) for (const el of row) {
      el.classList.remove('ship-horizontal', 'ship-vertical', 'ship-hit', 'ship-sunk');
      el.querySelector('.ship')?.remove();
    }
    for (const s of b.ships) {
      const sunk = s.hits === s.size;
      const cs = cellsOf(s);
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]!;
        const el = cells[c.y][c.x];
        if (!el) continue;
        if (side === 'enemy' && !sunk) continue; // hidden ship
        el.appendChild(warshipSegment(s, i, side));
        el.classList.add(s.orient === 'H' ? 'ship-horizontal' : 'ship-vertical');
        if (sunk) el.classList.add('ship-sunk');
        else if (b.shots[c.y][c.x] !== null) el.classList.add('ship-hit');
      }
    }
  }

  /**
   * One segment of a warship, drawn as inline SVG.
   * i === 0 is the bow (pointed hull front); last segment carries the stern + flag.
   * Middle segments carry turrets; single-cell ships are a full patrol boat.
   */
  function warshipSegment(s: Ship, i: number, side: 'player' | 'enemy'): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ship';
    const segs = s.size;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('ship-svg');

    const bow = i === 0;
    const stern = i === segs - 1;
    const mid = !bow && !stern;

    const P = (d: string, fill: string): SVGPathElement => {
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return p;
    };

    const deck = 'var(--hull)';
    const deckTop = 'var(--hull-top)';

    // hull slice: bow is pointed, middle rectangular, stern slightly tapered
    if (bow && stern) {
      P('M4,50 L30,18 L86,20 L86,80 L30,82 Z', deck); // patrol boat: point + flat stern
    } else if (bow) {
      P('M2,50 L34,16 L100,20 L100,80 L34,84 Z', deck);
    } else if (stern) {
      P('M0,20 L92,20 L98,50 L84,80 L0,80 Z', deck);
    } else {
      P('M0,20 L100,20 L100,80 L0,80 Z', deck);
    }
    // deck line
    P('M0,26 L100,26 L100,31 L0,31 Z', deckTop);

    // bow flag stripe
    if (bow) P('M12,46 L34,40 L34,60 L12,54 Z', 'var(--flag)');

    if (segs === 1) {
      // patrol boat: bridge + single funnel
      P('M42,38 L70,38 L74,50 L70,62 L42,62 Z', 'var(--bridge)');
      P('M52,40 L58,40 L58,36 L52,36 Z', 'var(--funnel)');
    } else if (bow) {
      // fore turret
      P('M46,40 L72,40 L76,50 L72,60 L46,60 Z', 'var(--bridge)');
      P('M54,44 L62,44 L58,34 Z', 'var(--gun)');
    } else if (mid) {
      // funnels + mainmast
      P('M28,36 L36,36 L36,44 L28,44 Z', 'var(--funnel)');
      P('M56,36 L64,36 L64,44 L56,44 Z', 'var(--funnel)');
      P('M47,30 L53,30 L50,72 Z', 'var(--bridge)');
    } else {
      // stern: aft turret + flag mast
      P('M24,40 L50,40 L54,50 L50,60 L24,60 Z', 'var(--bridge)');
      P('M32,44 L40,44 L36,34 Z', 'var(--gun)');
      P('M78,30 L82,30 L80,44 Z', 'var(--bridge)');
    }

    // battle damage: scorch on hit segments (sunk ships get full darkening via CSS)
    if (side === 'player' && s.hits < s.size && i < s.hits) {
      P('M20,20 L80,20 L80,80 L20,80 Z', 'rgba(10,10,10,0.55)');
    }

    wrap.appendChild(svg);
    return wrap;
  }

  function renderMarkers(side: 'player' | 'enemy', b: Board): void {
    const cells = cellEls[side];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const el = cells[y][x]!;
        el.querySelector('.marker')?.remove();
        const st = b.shots[y][x];
        if (!st || st === 'sunk') continue; // sunk shown via ship visual
        const m = document.createElement('div');
        m.className = 'marker';
        const inner = document.createElement('div');
        inner.className = st === 'hit' ? 'marker-hit' : 'marker-splash';
        m.appendChild(inner);
        el.appendChild(m);
      }
  }

  function fleetPanel(host: HTMLElement, b: Board, reveal: boolean): void {
    host.innerHTML = '';
    for (const s of b.ships) {
      const row = document.createElement('div');
      row.className = 'fleet-ship';
      const label = document.createElement('span');
      label.textContent = s.name;
      const pips = document.createElement('div');
      pips.className = 'fleet-pips';
      for (let i = 0; i < s.size; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip' + (s.hits === s.size ? ' sunk' : i < s.hits ? ' damaged' : '');
        pips.appendChild(pip);
      }
      row.append(label, pips);
      host.appendChild(row);
    }
    host.style.visibility = reveal ? 'visible' : 'hidden';
  }

  function shake(side: 'player' | 'enemy'): void {
    const host = side === 'player' ? refs.playerHost : refs.enemyHost;
    host.classList.remove('shake');
    void host.offsetWidth; // restart animation
    host.classList.add('shake');
  }

  function cellEl(side: 'player' | 'enemy', c: Coord): HTMLElement | null {
    return cellEls[side][c.y]?.[c.x] ?? null;
  }

  function setStatus(msg: string): void {
    refs.status.textContent = msg;
  }

  return { renderShips, renderMarkers, fleetPanel, shake, cellEl, setStatus };
}

/** Center of a cell element in viewport coordinates (for fx bursts). */
export function cellCenter(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
