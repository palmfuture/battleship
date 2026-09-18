// Canvas effects: animated ocean background + particle bursts.
// Two canvases: ocean (fixed, behind app) and fx overlay (fixed, above boards, pointer-events none).

import { TAU } from './math.ts';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  age: number; ttl: number;
  size: number;
  r: number; g: number; b: number;
  grav: number; drag: number;
}

export type BurstKind = 'splash' | 'boom' | 'sunk';

export interface FxLayer {
  resize(): void;
  burst(clientX: number, clientY: number, kind: BurstKind): void;
  step(dt: number): void;
}

export function createFx(canvas: HTMLCanvasElement): FxLayer {
  const ctx = canvas.getContext('2d')!;
  const particles: Particle[] = [];

  function resize(): void {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  function emit(n: number, at: { x: number; y: number }, mk: (i: number) => Omit<Particle, 'x' | 'y' | 'age'>): void {
    for (let i = 0; i < n; i++) {
      particles.push({ x: at.x, y: at.y, age: 0, ...mk(i) });
    }
  }

  function burst(clientX: number, clientY: number, kind: BurstKind): void {
    const p = { x: clientX, y: clientY };
    if (kind === 'splash') {
      emit(16, p, () => {
        const a = randomAngle(-Math.PI, 0); // upward half
        const sp = 60 + Math.random() * 160;
        return {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          ttl: 0.45 + Math.random() * 0.4, size: 1 + Math.random() * 2.2,
          r: 190, g: 225, b: 255, grav: 420, drag: 0.4,
        };
      });
      return;
    }
    const power = kind === 'sunk' ? 2.1 : 1;
    // fire sparks
    emit(Math.round(24 * power), p, () => {
      const a = Math.random() * TAU;
      const sp = (90 + Math.random() * 260) * power;
      const hot = Math.random();
      return {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ttl: 0.3 + Math.random() * 0.5, size: (1.2 + Math.random() * 2.6) * power,
        r: 255, g: hot > 0.5 ? 200 : 120, b: hot > 0.8 ? 60 : 30,
        grav: 260, drag: 1.6,
      };
    });
    // smoke
    emit(Math.round(9 * power), p, () => {
      const a = randomAngle(-Math.PI - 0.6, -Math.PI + 0.6);
      const sp = 20 + Math.random() * 60;
      return {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ttl: 0.9 + Math.random() * 0.8, size: (3 + Math.random() * 5) * power,
        r: 90, g: 95, b: 105, grav: -60, drag: 1.2,
      };
    });
  }

  function step(dt: number): void {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.ttl) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      const damp = 1 - p.drag * dt;
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.age / p.ttl; // 1 -> 0
      ctx.globalAlpha = k * 0.9;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      const s = p.size * (p.r === 90 ? 1 + p.age * 2 : 1); // smoke grows
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { resize, burst, step };
}

// ---------- Ocean background ----------

export interface OceanLayer {
  resize(): void;
  step(dt: number): void;
}

export function createOcean(canvas: HTMLCanvasElement): OceanLayer {
  const ctx = canvas.getContext('2d')!;
  let base: HTMLCanvasElement | null = null;
  let glints: { x: number; y: number; phase: number; freq: number }[] = [];
  let t = 0;

  function resize(): void {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    // cached static gradient
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d')!;
    const g = b.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0c3352');
    g.addColorStop(0.55, '#072033');
    g.addColorStop(1, '#03101b');
    b.fillStyle = g;
    b.fillRect(0, 0, base.width, base.height);
    // broad soft swells baked in
    for (let i = 0; i < 9; i++) {
      const y = (canvas.height / 9) * i + Math.random() * 40;
      b.strokeStyle = `rgba(80,160,220,${0.03 + Math.random() * 0.04})`;
      b.lineWidth = 6 + Math.random() * 18;
      b.beginPath();
      b.moveTo(-20, y);
      b.bezierCurveTo(canvas.width * 0.3, y - 25 - Math.random() * 20, canvas.width * 0.7, y + 30, canvas.width + 20, y - 10);
      b.stroke();
    }
    // pulsing glints
    glints = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      phase: Math.random() * TAU,
      freq: 0.5 + Math.random() * 1.5,
    }));
  }
  resize();

  function step(dt: number): void {
    t += dt;
    if (!base) return;
    ctx.drawImage(base, 0, 0);
    // drifting light bands
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const yBase = canvas.height * (0.2 + i * 0.28);
      const amp = 12 + i * 7;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= canvas.width; x += 32) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.008 + t * (0.6 + i * 0.35) + i * 2.1) * amp);
      }
      ctx.lineTo(canvas.width, yBase + 70);
      ctx.lineTo(0, yBase + 70);
      ctx.closePath();
      ctx.fillStyle = `rgba(70,150,215,${0.045 + i * 0.02})`;
      ctx.fill();
    }
    ctx.restore();
    // glints
    ctx.fillStyle = '#bfe4ff';
    for (const s of glints) {
      const a = Math.sin(t * s.freq + s.phase);
      if (a <= 0.55) continue;
      ctx.globalAlpha = (a - 0.55) * 1.4;
      ctx.fillRect(s.x, s.y, 2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  return { resize, step };
}

function randomAngle(from: number, to: number): number {
  return from + Math.random() * (to - from);
}
