# 3D FPS — Architecture (full scope)

First-person wave shooter in a low-poly city. **v0.9.15.0**. Pointer-lock FPS, wave-based enemies, in-game level editor.

## Stack

Three.js 0.170 (jsDelivr import map), ES modules. Dev: `start_server.bat` → `npx serve :3000`.

## Entry

`js/main.js` → `new Game()` on `DOMContentLoaded`.

## Runtime (`js/Game.js`)

```
Game
 ├── InputManager.js
 ├── World.js              (loads assets/world.json + GLB city)
 ├── Player.js             (FPS movement, shooting, pointer lock, editor)
 ├── EnemyManager.js       (waves, spawn cap, difficulty)
 ├── LootManager.js        (coins, hats, potions)
 ├── AudioManager.js
 ├── ParticleSystem.js
 └── PointerLockControls.js
```

## Game loop

`Game.animate()` — variable `delta` from `THREE.Clock`. When `isRunning`: update player, world, enemies, loot → single-pass render. Menu blocker until pointer lock.

## World data

`assets/world.json` — placed GLB instances (buildings, vehicles, props) with transforms and `collidable` flags. `GLTFLoader` with clone cache.

## Player systems

WASD + jump (double jump), raycast shooting, ammo/health/armor/money. Ghost/noclip mode. **Level editor:** place props, save world JSON (`[P]`).

## Combat

`EnemyManager` — waves, spawn radius around player, difficulty slider (6 levels). `Enemy` AI state machine.

## Persistence

Session-only (money/health reset on refresh). Editor saves `world.json` manually.

## UI

HTML menus (main, settings, about, credits), HUD (health, armor, money, ammo, wave, kills), wave notifications, editor overlay.

## Docs

`docs/adr/`.
