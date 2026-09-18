# Battleship ⚓

เกม Battleship เล่นบน browser กับ AI opponent — Vite + TypeScript vanilla, ไม่มี framework

## เล่น

```sh
npm install
npm run dev      # เปิด http://localhost:5173
```

Production build:

```sh
npm run build    # ออกที่ dist/
npm run preview
```

## วิธีเล่น

- กองเรือของคุณถูกสุ่มวางอัตโนมัติ (กดปุ่ม "สุ่มวางเรือให้ทั้งหมด" เพื่อวางใหม่) — เรือไม่เอียงกัน
- คลิกช่องบนกระดาน "น่านน้ำศัตรู" เพื่อยิง สลับตากับ AI
- ชุดเรือ: Battleship (4) · Cruiser (3) · Submarine (3) · Destroyer (2) · Patrol (1)
- จมเรือศัตรูครบทุกลำก่อน = ชนะ

## Architecture

```
src/
├── core/
│   ├── board.ts   # pure game logic: Board, fire(), placement — ไม่รู้จัก DOM/เวลา
│   └── ai.ts      # HuntTarget AI (stateless): parity hunt → axis-lock target
├── fx.ts          # canvas 2 ชั้น: ocean พื้นหลัง + particle bursts
├── view.ts        # render Board → DOM (cells, SVG warships, markers, fleet pips)
├── math.ts        # constants
└── main.ts        # orchestration: turn flow, rAF loop, input
```

**Layering:** `core` บริสุทธิ์ (test ได้โดยไม่ต้อง browser) → `view` render จาก state ทางเดียว → `main` จับคู่ทั้งสองฝั่ง + input

**Rendering:** DOM สำหรับกระดาน/UI, Canvas สำหรับฉากหลังและ FX — ocean เป็น `position:fixed` อยู่หลัง app, particle overlay อยู่หน้า (`pointer-events:none`)

## Animation

- **Ocean**: gradient แคชไว้ + คลื่นแสง sine 3 ชั้น + light glints กะพริบ 130 จุด (rAF loop เดียว)
- **ยิงโดยน**: fire sparks + ควันลอย (buoyancy + drag), board shake
- **ยิงพลาด**: splash น้ำพุ่ม parabolic + วงแหวนค่อยจาง
- **เรือจม**: hull มืด + เอียงแบบ ease-out, particle burst หนัก, เผยตำแหน่งเรือศัตรู
- **เรือ**: SVG warship ต่อ segment — หัวแหลม+ธง, ปล่องไฟ, turret ปืนใหญ่, รอยดำเมื่อโดนยิง

## AI Strategy

Hunt/Target แบบ stateless (สแกนจากกระดานทุกตา):

1. **Target** — เจอ `'hit'` ที่เรือยังไม่จม: โดนติดกัน 2 ช่อง → ล็อกแกน ยิงไล่ปลายทั้งสองด้าน; โดนเดี่ยว → ยิงเพื่อนบ้าน
2. **Hunt** — ยิงแบบ parity `(x+y) % minAliveShipSize === 0` เรือเล็กสุดที่ยังลอยจะไม่มีทางหลบอยู่ระหว่างรอยยิง
