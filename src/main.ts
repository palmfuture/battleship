// Orchestration: wires core + view + fx, owns the rAF loop and turn flow.
import '../style.css';
import { emptyBoard, fire, randomFleet, type Board, type Coord } from './core/board.ts';
import { HuntTargetAi } from './core/ai.ts';
import { createFx, createOcean, type FxLayer, type OceanLayer } from './fx.ts';
import { createView, cellCenter, type ViewRefs } from './view.ts';

const PLAYER_HOST = document.getElementById('playerHost')!;
const ENEMY_HOST = document.getElementById('enemyHost')!;
const PLAYER_FLEET = document.getElementById('playerFleet')!;
const ENEMY_FLEET = document.getElementById('enemyFleet')!;
const STATUS = document.getElementById('status')!;
const AUTO_BTN = document.getElementById('autoBtn')!;

const refs: ViewRefs = {
  playerHost: PLAYER_HOST,
  enemyHost: ENEMY_HOST,
  playerFleet: PLAYER_FLEET,
  enemyFleet: ENEMY_FLEET,
  status: STATUS,
};

const oceanCanvas = document.createElement('canvas');
oceanCanvas.id = 'ocean';
document.body.prepend(oceanCanvas);

const fxCanvas = document.createElement('canvas');
fxCanvas.id = 'fx';
fxCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;';
document.body.append(fxCanvas);

const ocean: OceanLayer = createOcean(oceanCanvas);
const fx: FxLayer = createFx(fxCanvas);
const view = createView(refs);

// ---------- Game state ----------

interface Game {
  player: Board;
  enemy: Board;
  ai: HuntTargetAi;
  playerTurn: boolean;
  over: boolean;
  busy: boolean; // animating between turns
}

let game: Game = freshGame();

function freshGame(): Game {
  return { player: emptyBoard(), enemy: randomFleet(), ai: new HuntTargetAi(), playerTurn: true, over: false, busy: false };
}

const AI_DELAY = 750; // ms before AI fires, feels like "aiming"

function status(msg: string): void {
  view.setStatus(msg);
}

function renderAll(): void {
  view.renderShips('player', game.player);
  view.renderMarkers('player', game.player);
  view.renderShips('enemy', game.enemy);
  view.renderMarkers('enemy', game.enemy);
  view.fleetPanel(PLAYER_FLEET, game.player, true);
  view.fleetPanel(ENEMY_FLEET, game.enemy, false);
}

// ---------- Turn flow ----------

async function playerFire(c: Coord): Promise<void> {
  if (game.over || game.busy || !game.playerTurn) return;
  const result = fire(game.enemy, c);
  if (!result) return; // already shot
  game.busy = true;

  const el = view.cellEl('enemy', c)!;
  const at = cellCenter(el);
  if (result.state === 'miss') {
    fx.burst(at.x, at.y, 'splash');
  } else {
    fx.burst(at.x, at.y, result.sunk ? 'sunk' : 'boom');
    view.shake('enemy');
    if (result.sunk) status(`จม! ${result.ship?.name} ของศัตรูถูกจม`);
  }
  renderAll();

  if (result.gameOver) return endGame(true);
  game.playerTurn = false;
  game.busy = false;
  status('ศัตรูกำลังเล็ง…');
  await aiMove();
}

async function aiMove(): Promise<void> {
  await delay(AI_DELAY);
  if (game.over) return;
  const c = game.ai.move(game.player);
  const result = fire(game.player, c);
  if (!result) return; // unreachable: AI only picks unshot cells

  const el = view.cellEl('player', c)!;
  const at = cellCenter(el);
  if (result.state === 'miss') {
    fx.burst(at.x, at.y, 'splash');
  } else {
    fx.burst(at.x, at.y, result.sunk ? 'sunk' : 'boom');
    view.shake('player');
    if (result.sunk) status(`เรือ ${result.ship?.name} ของคุณถูกจม!`);
  }
  renderAll();

  if (result.gameOver) return endGame(false);
  game.playerTurn = true;
  status('ตาคุณ — ยิงน่านน้ำศัตรู');
}

function endGame(playerWon: boolean): void {
  game.over = true;
  game.busy = false;
  status(playerWon ? 'ชนะ! กองเรือศัตรูล่ม' : 'แพ้… กองเรือของคุณจมหมด');
  // reveal remaining enemy ships
  view.renderShips('enemy', game.enemy);
  view.fleetPanel(ENEMY_FLEET, game.enemy, true);
  setTimeout(() => {
    if (confirm(playerWon ? '🏆 คุณชนะ! เล่นอีกครั้ง?' : '💀 คุณแพ้ เล่นอีกครั้ง?')) startNewGame();
  }, 900);
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// ---------- Placement ----------

function startNewGame(): void {
  game = freshGame();
  renderAll();
  status('ยิงน่านน้ำศัตรูเพื่อเริ่ม');
}

function autoPlace(): void {
  game.player = randomFleet();
  renderAll();
  status('วางเรือใหม่แล้ว — พร้อมยิง');
}

AUTO_BTN.addEventListener('click', autoPlace);

// click on enemy cells -> fire
ENEMY_HOST.addEventListener('click', (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLElement>('.cell');
  if (!cell) return;
  const c = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  if (game.enemy.shots[c.y][c.x] !== null) return;
  void playerFire(c);
});

// ---------- Main loop ----------

function onResize(): void {
  ocean.resize();
  fx.resize();
}
addEventListener('resize', onResize);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  ocean.step(dt);
  fx.step(dt);
  requestAnimationFrame(frame);
}

// ---------- Boot ----------

// Give player a random starting fleet so the game is playable immediately
game.player = randomFleet();
renderAll();
status('ตาคุณ — ยิงน่านน้ำศัตรู (ปุ่ม "สุ่มวางเรือ" เพื่อวางใหม่)');
requestAnimationFrame(frame);
