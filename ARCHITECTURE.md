# Architecture

> ASTEROiDES is a browser-based Asteroids clone rendered with p5.js (Canvas 2D) and bundled by Webpack. It uses a fixed-tick frame loop, instance-mode rendering, and a class-based entity model coordinated by a central `Game` controller.

## Overview

The application boots a single p5 instance in `src/index.js`. The p5 instance owns the render loop (`preload → setup → draw` at 60fps) and is passed by reference into every game class. A central `Game` object dispatches each frame to one of five states (`menu`, `playing`, `dying`, `levelComplete`, `gameOver`) owned by a `GameState` module. Game state transitions (new level, restart after death, "start game" from menu) are implemented by reconstructing the `Game` instance from `index.js` in response to `state.nextState`, which names the state the fresh `Game` starts in. Score, lives, and level survive the rebuild because a `Run` module owns them and outlives every `Game`.

Domain vocabulary lives in `CONTEXT.md`. There are no external services and no persistence layer. Tests are end to end only: Playwright drives a real browser against a small harness, and there is no unit test runner. The only runtime dependency is `p5` (with its `p5.sound` addon).

## Module Map

| Module | Path | Purpose | Key Files |
|---|---|---|---|
| Bootstrap | `src/index.js` | p5 instance creation, asset preload, top-level state reset wiring | `index.js` |
| Game Controller | `src/game/` | Per-life Game instance, state-machine dispatch, collision response, and the run scoped score, lives and level | `game.js`, `gameState.js`, `run.js`, `input.js`, `collisions.js`, `soundManager.js`, `helpers.js` |
| Entities | `src/game/elements/` | Ship, Asteroids, Shot, Debris, Scoreboard, Background, Stars. All class-based, all own their own `draw()` | `ship.js`, `asteroids.js`, `shot.js`, `debris.js`, `asteroidDebris.js`, `shipDebris.js`, `shipTrace.js`, `background.js`, `stars.js`, `scoreboard.js` |
| Test seam | `src/game/harness.js`, `e2e/` | Arrangement verbs exposed to Playwright, plus the spec suite | `harness.js`, `e2e/fixtures.mjs`, `e2e/*.spec.mjs`, `playwright.config.mjs` |
| Screens | `src/game/state/` | Non-playing game states rendered as full-canvas overlays | `startMenuScreen.js` (exports `StartMenuScreen` and `LevelUpScreen`), `gameOverScreen.js` |
| Assets | `src/{font,images,sounds,css}/` | Static assets imported via ES modules and bundled by Webpack's `type: "asset"` rule | `font/SpaceQuest-yOY3.ttf`, `images/ship.png`, `images/heart.png`, `sounds/*.wav` |
| Build | `webpack.config.js`, `.babelrc` | Bundling, dev server (HMR on :8080), asset loaders, `p5` ProvidePlugin | `webpack.config.js` |

## Entry Points

- **Application bootstrap**: `src/index.js` — creates the p5 instance, preloads assets, constructs the long-lived `Input`, `SoundManager` and `Run`, defines `resetSketch(current)` (the rebuild-Game function called on game-over restart and level-up, taking the state the fresh `Game` starts in), and registers `keydown` blocking for arrows/space at the document level.
- **Game controller**: `src/game/game.js` — dispatches each frame based on `state.current` via `draw()`, runs `playGame()` during `"playing"` and `"dying"`, constructs all entities in `setup()`.
- **State machine**: `src/game/gameState.js` — owns `state.current`, the legal transitions (`startPlaying`, `shipDied`, `levelCleared`, `acknowledgeLevelUp`, `acknowledgeGameOver`), the 3-second `Dying` timer, and the `nextState` signal that `index.js` polls to trigger `resetSketch`. It never sees score, lives, or level.
- **Input dispatcher**: `src/game/input.js` — single owner of `p5.keyPressed` and the action vocabulary (`thrust`, `brake`, `rotateLeft`, `rotateRight`, `shoot`, `confirm`). Exposes `isHeld(action)` for held inputs and `wasPressed(action)` (consume-on-read) for one-shots. Constructed once in `index.js`; survives `Game` reconstructions.
- **Run state**: `src/game/run.js`. Score, lives and level as plain numbers, plus the four transitions that change them (`addPoints`, `loseLife`, `nextLevel`, `reset`). Constructed once in `index.js`, handed to every `Game`. Imports nothing, holds no p5 reference.
- **Test seam**: `src/game/harness.js`. Arrangement verbs for the e2e suite: frame stepping, a JSON
  snapshot, and verbs that place asteroids and set run values. Attached to `window.__asteroides`
  only by a development build loaded with `?e2e=1`.
- **Collision detection**: `src/game/collisions.js` — two pure functions, `shipVsAsteroids(ship, asteroids)` and `shotsVsAsteroids(shots, asteroids)`. Imports nothing, holds no state, never touches p5. `Game` calls them and owns every consequence.
- **Player entity**: `src/game/elements/ship.js` — physics integration, shot/trace/debris spawning, screen-wrap. Reads input via `this.game.input.isHeld(...)` / `wasPressed(...)`.
- **Asteroid system**: `src/game/elements/asteroids.js` — spawns initial wave per `level`, handles splitting (`X` → `M` → `S`) on hit, owns the asteroid array.
- **Sound dispatch**: `src/game/soundManager.js` — wraps `p5.SoundFile`, applies a shared reverb to explosion/break sounds.

## Invariants

- **p5 instance mode only.** Never use bare p5 functions (`line(...)`, `dist(...)`). Every class receives the p5 instance via constructor and calls methods through `this.p5`. The only p5 globals are `p5` (the class) and `p5.SoundFile` (via the sound addon import in `index.js`).
- **`Game.draw()` is the single state dispatcher.** It switches on `this.state.current` and selects exactly one of: `startMenuScreen.draw()`, `playGame()` (for both `playing` and `dying`), `levelUpScreen.draw()`, or `gameOverScreen.draw()`. State changes happen by calling transition methods on `GameState` (`shipDied`, `levelCleared`, etc.) — never by reading or writing `state.current` directly from outside `GameState`.
- **Collision detection is suppressed during `dying`.** `Game.checkIfCollisions` early-returns when `!state.isPlaying()`. Shots in flight continue to register hits on asteroids during the 3-second window.
- **State resets reconstruct, they do not mutate.** Returning to play (after death or level-up) calls `resetSketch(current)` in `index.js`, which builds a fresh `Game` around the existing `Run`. Do not add code that tries to "soft reset" entities in place.
- **Run state lives outside `Game`.** Score, lives and level belong to `Run`, which `index.js` constructs once and every `Game` borrows. `Game` has no `score`, `lifes` or `level` field. Anything that must survive a rebuild goes on `Run`, never into the rebuild signal.
- **A menu rebuild ends the run.** `index.js` calls `run.reset()` when `nextState` is `"menu"`, and only then. Every other rebuild continues the run.
- **Lives include the ship in play.** `Run` starts at 3 and `loseLife()` returns `true` when the count reaches 0, so the third death ends the run. Do not reintroduce a separate "was this the last life" test in `Game`.
- **Entities own their own cleanup.** Each entity class filters its own dead children (`filterOldShots`, `filterOldTraces`, `filterOldShipDebris`, `cleanExplodedAsteroids`). New entity types must follow the same pattern; do not add cleanup logic to `Game.playGame()`.
- **Collision detection runs before rendering each frame.** `playGame()` order is: `checkIfCollisions → checkForHits → checkIfExplodedAsteroids → checkIfLevelCompleted → draw entities`. Do not reorder — collision flags drive what the entities render on the same frame.
- **The harness is gated twice, and the compile-time gate is fragile.** `index.js` tests
  `process.env.NODE_ENV !== "production"` inline in the `if`, so webpack folds the branch at parse
  time and a production build emits no chunk for `harness.js`. Reading that check into a variable
  first defeats the fold and puts the module in `dist/`. A development build does emit the chunk,
  including the one `npm run build` produces for `npm run deploy`, and there the `?e2e=1` check is
  what keeps it inert. Vercel builds with `build:prod`, so nothing deployed there carries it.
  Verify with `npm run build:prod` and grep `dist/` for `__asteroides`.
- **E2E specs call harness verbs, never game fields.** A spec that reaches into `game.asteroids`
  or `run.score` directly has to be rewritten by the next refactor, which is the whole reason the
  harness exists. Add a verb instead, and register it in `VERBS` in `e2e/fixtures.mjs`.
- **Asset references must be ES imports.** Webpack's `type: "asset"` rule resolves them at build time. String URLs to `public/` or `dist/` will not work, and adding `require()` calls will conflict with the `.babelrc` `modules: false` setting.
- **Document-level keydown guard must remain.** The handler at the bottom of `index.js` prevents the browser from scrolling when arrows/space are pressed. Removing it breaks gameplay. (Distinct from the `Input` module — the guard is browser-scroll suppression, not game-action mapping.)
- **Entity-vs-entity geometry lives only in `src/game/collisions.js`.** No other module measures overlap between two entities. The module is pure: no imports, no state, no p5. It reports hits and never applies them, so scoring, sound, lives, and state transitions stay in `Game`. (The 300px spawn-exclusion check in `asteroids.js` is placement, not collision, and stays where it is.)
- **`shipVsAsteroids` returns at most one asteroid.** The ship can lose only one life per frame no matter how many asteroids overlap it. This is enforced by the `find` in `collisions.js`, not by a guard in `Game`. Do not reintroduce a loop over all overlapping asteroids in the ship path.
- **All keyboard input flows through `Input`.** No module outside `src/game/input.js` may read `p5.keyCode`, call `p5.keyIsDown`, or assign `p5.keyPressed` / `p5.keyReleased`. Game-action callers use `this.game.input.isHeld(action)` or `this.game.input.wasPressed(action)`.

## Cross-Cutting Concerns

| Concern | Implementation | Location |
|---|---|---|
| Rendering | p5.js Canvas 2D, instance mode, 60fps `draw()` | `index.js` (instance creation), every entity's `draw()` |
| Audio | `p5.sound`-wrapped soundfiles with a shared reverb on explosions | `src/game/soundManager.js` |
| Input | All keyboard input flows through `src/game/input.js`. Ship and screens query via `input.isHeld(action)` for held inputs and `input.wasPressed(action)` (consume-on-read) for one-shots. `p5.keyPressed` is assigned exactly once, in the `Input` constructor. | `src/game/input.js`, callers in `ship.js`, `state/startMenuScreen.js`, `state/gameOverScreen.js` |
| Run state | Score, lives and level as plain numbers on one `Run` instance that outlives every `Game`. Only `Game` writes to it, through four methods. | `src/game/run.js`, callers in `game.js`, `index.js`, both screen classes |
| Geometry/viewport | Vector helpers and responsive canvas sizing | `src/game/helpers.js` (`findOutWidth`, `findOutHeight`, `calcVectorValue`, `randomInteger`, `drawPolygon`) |
| Collision geometry | Circle overlap via `Math.hypot`. Detection is pure and separate from response: `collisions.js` reports, `game.js` reacts. | `src/game/collisions.js`, callers in `game.js` |
| Screen wrap | Each moving entity implements its own `ifOverflowed()` toroidal wrap | `ship.js`, `asteroids.js`, `shot.js` |

## External Integrations

None. ASTEROiDES is fully client-side and offline-capable once bundled. The only "external" target is **GitHub Pages**, used as a static-hosting deploy target via `gh-pages -d dist`.

## Data Flow (per frame)

1. Browser fires p5's `draw` tick (60fps target).
2. `index.js` draws `Background` (parallax stars), then delegates to `game.draw()`.
3. `Game.draw()` switches on `state.current` to select one of: `startMenuScreen` / `playGame()` (for `playing` and `dying`) / `levelUpScreen` / `gameOverScreen`.
4. In `playGame()`:
   a. `checkIfCollisions()` early-returns when `!state.isPlaying()`, then asks `collisions.shipVsAsteroids` for the single overlapping asteroid (or `null`). On a hit it explodes the ship, plays the sound, and calls `run.loseLife()`, passing the returned verdict to `state.shipDied({ wasFinalDeath })`. That moves state to `dying` (with a 3-second timer) or `gameOver`.
   b. `checkForHits()` asks `collisions.shotsVsAsteroids` for every `{ shot, asteroid }` pair, then marks each asteroid exploded and each shot hit, awards score through `run.addPoints`, and plays the break sound via the `ASTEROID_HITS` table. Runs during `dying` too, so in-flight shots continue to score. Detection completes before any mutation.
   c. `checkIfExplodedAsteroids()` — asks `Asteroids` to split large/medium asteroids into smaller children and remove the exploded ones.
   d. `checkIfLevelCompleted()` — early-returns when `!state.isPlaying()`. Otherwise, if no asteroids remain, calls `state.levelCleared()` and then `run.nextLevel()`, so the level up screen already shows the wave about to be played.
   e. Each entity's `draw()` runs: physics → cleanup → render.
5. After `Game.draw()` returns, `index.js` checks `game.state.nextState`. If it is set, `index.js` calls `run.reset()` when the target is `menu`, then calls `resetSketch(nextState)` to construct a fresh `Game` around the same `Run`.
6. FPS counter is overlaid in the bottom-left for diagnostic visibility.

## Key Decisions

### Why p5 instance mode (not global mode)
Instance mode keeps p5's ~200 globals out of the module scope, makes the code Webpack-tree-shakable, and avoids name collisions with browser globals (`background`, `text`, `line`). The trade-off is verbosity — every class receives and stores a p5 reference — but it pays off for bundling and for keeping the code analyzable.

### Why reconstruct `Game` on state transitions
Entities cache references to one another (ship → shots → debris) and to the p5 instance. Resetting in-place would require coordinated nulling of cross-references across ~12 entity classes. Reconstructing one `Game` instance and letting the GC reclaim the old one is simpler, faster to reason about, and avoids subtle stale-reference bugs across levels.

### Why a `GameState` module
Previously, "what state is the game in?" was encoded as four independent booleans (`started`, `gameOver`, `levelCompleted`, `restartLevel`, plus a dead `paused`) that could be mutated from any module — screens, collision code, and even `index.js` (which polled `restartLevel`). The interface was "any caller may write any flag," which is barely an interface at all. Consolidating into a `GameState` module gives the engine a deep module with a small surface: callers send transition events (`startPlaying`, `shipDied`, `levelCleared`, `acknowledgeLevelUp`, `acknowledgeGameOver`), the module enforces legal moves, owns the 3-second post-death timer, and exposes a single field for `index.js` to poll. That field started as `wantsRebuild` plus a `rebuildArgs` array and became `nextState` when `Run` took over score, lives and level. Making `dying` an explicit state also closed a latent bug: collisions are now suppressed during the 3-second window, so a drifting asteroid no longer re-triggers `handleExplosion` on a dead ship.

### Why an `Input` module
Previously, keyboard handling was scattered: movement and braking polled `p5.keyIsDown(<keyCode>)` from inside `Ship.draw()`; shooting and screen transitions reassigned `p5.keyPressed` from at least four call sites (`Ship.shoot`, `StartMenuScreen.draw`, `LevelUpScreen.draw`, `GameOverScreen.draw`), each rewriting the callback from inside its own per-frame `draw()` loop. The "interface" was *"any module may overwrite p5.keyPressed; whoever wrote last this frame wins"* — barely an interface. The action vocabulary was implicit in 8 scattered magic keycodes (32, 13, 37–40, 65, 68, 83, 87). Consolidating into a single `Input` module gives the engine one deep place that owns the keyboard: it assigns `p5.keyPressed` exactly once, exposes a tiny two-method interface (`isHeld(action)`, `wasPressed(action)`), and makes the key-to-action mapping a single table at the top of `input.js`. The only entry point into game input is now `this.game.input.<query>(action)`. This is also the seam future rebindable controls, gamepad, or touch support would plug into.

### Why a `Collisions` module

Previously `Game` owned the geometry itself. `checkForHits` ran a nested `forEach` over asteroids and shots calling `p5.dist`, and `checkIfCollisions` ran another `forEach` with two unexplained magic numbers (`ship.position.x - 5`, `asteroid.radius + 20`). Together they were about 70 of `game.js`'s 170 lines, and they interleaved four unrelated jobs: measuring distance, flagging entities, awarding score, and playing sound.

Splitting detection from response gives each half one job. `collisions.js` imports nothing, holds no state, and never sees p5, so it can be reasoned about (and later unit-tested) without a canvas. `p5.dist` became `Math.hypot`, which computes the same Euclidean distance and is what removes the p5 dependency. The two magic numbers became named constants with their original values intact. `Game` keeps every consequence, which is deliberate: a "detect and resolve" module would have needed `game`, `score`, `soundManager`, and `state`, moving the coupling instead of removing it. An event-bus variant was rejected too, since it adds indirection for exactly one subscriber.

The split also closed a live bug. The old ship loop never stopped after a hit, and the `isPlaying()` guard sat at the top of the method rather than inside the loop. Two asteroids overlapping the ship on the same frame therefore ran the whole consequence block twice: `GameState.shipDied` guarded the second state transition, but `lifes.pop()` and the explosion sound lived in `Game`, outside that guard, so the player silently lost two lives and heard a doubled explosion. `shipVsAsteroids` uses `find` and returns at most one asteroid, so the fix is structural rather than another guard.

Scoring policy moved to an `ASTEROID_HITS` table at the top of `game.js`, replacing a three-branch if-chain that encoded two lookups (size to points, size to sound) as control flow.

### Why a `Run` module

Score, lives and level were the only state the game had to keep, and the only state with no
owner. `Game` held them, so every death and every level-up had to hand them back. `GameState`
took them as arguments to `shipDied` and `acknowledgeLevelUp`, parked them in a four slot
positional array (`rebuildArgs`), and `index.js` spread that array back into `new Game` and
`Game.setup`. Three modules passed around values that belonged to none of them.

The array carried objects, not numbers. Score travelled as a `Score` instance and lives as an
array of `Life` instances, each holding a p5 reference, so `gameState.js` was p5 free only by
accident. The 3-second respawn `setTimeout` closed over them and held them for the whole window.

`Run` owns the three numbers and outlives every `Game`, the way `Input` and `SoundManager`
already did. Its interface is four methods, `addPoints`, `loseLife`, `nextLevel` and `reset`,
plus three readable fields. It imports nothing and never sees p5, which puts it in the same tier
as `collisions.js` and `helpers.js`.

`wantsRebuild` and `rebuildArgs` collapse into one `nextState` field naming the state the fresh
`Game` starts in. That also stops a five state machine being encoded as a `started` boolean.
`Game.setup` folded into the constructor once it had no run state left to receive, taking six
placeholder statements with it.

`Score` and `Life` are gone. Both failed the deletion test: removing either moved a single p5
call and nothing else. `Life` existed so an array of identical drawables could stand in for a
count, which is the job `Run.lives` now does. One `Scoreboard` draws the score and the hearts at
the same coordinates they used before.

This closed the lives off-by-one. `Game` computed `wasFinalDeath` as `lifes.length === 0` before
popping, so the player got four deaths while three hearts rendered. `loseLife()` decrements and
returns the verdict in one call, so no caller can read the count and decide for itself. The
third death now ends the run, which is the one deliberate behaviour change in this refactor.

Rejected: giving `GameState` a `Run` reference so it could reset the run itself. `index.js`
already owns the `Run` and already decides when to rebuild, so the reset belongs with the
decision, and `GameState` stays free of dependencies. Rejected too: moving the points column of
`ASTEROID_HITS` into `Run`. It would split one table across two modules and add a second lookup
per hit to buy nothing.

### Why the e2e suite drives a harness rather than the canvas

The game renders to a canvas, so a black-box test has nothing to assert on beyond pixels.
Screenshot comparison was rejected: the background is 500 randomly placed stars, and every
asteroid has a random radius, side count and rotation, so a pixel diff would fail on noise.

Driving the game live and sampling it also fails, and did fail. A first pass at verifying the
`Run` extraction pressed keys and read state between round trips. Asteroids drifted into the
ship, two deaths happened between calls, and shots crossed the canvas before they could be
counted. Nothing about that pass was reproducible.

What works is owning both clocks. Frames advance only through `p5.redraw()` after
`p5.noLoop()`, and the only wall-clock dependency in the engine, the respawn timer, is
shortened through `setRespawnDelay` so the timer path stays under test instead of being
bypassed. The RNG is never seeded, because a test that places the asteroids it cares about does
not care what the RNG chose. Seeding would mean threading a generator through five files for no
gain here.

The harness exposes verbs, not objects. `putAsteroidsOnShip(2)` rather than a handle on
`game.asteroids.array`. The suite therefore names no field that a refactor can move, which is
the same reason `Input` exposes `isHeld(action)` rather than a keycode.

One test earns its place twice. `shipVsAsteroids` is guarded during `dying` by two independent
mechanisms: the `isPlaying()` early return in `Game.checkIfCollisions`, and the fact that
`handleExplosion` sets the ship position to `{ x: null, y: null }`. That second one collapses the
dead ship's hitbox onto the top left corner rather than removing it, so an asteroid parked on the
wreck no longer overlaps anything. Removing the documented guard therefore breaks nothing that a
naive test would notice. The corner test in `e2e/deaths.spec.mjs` places an asteroid at the
origin and is the only spec that fails when the guard goes.

### Why `module.hot.decline()` in `src/index.js`
p5's `preload` → `setup` lifecycle binds to the module-scope variables (`spaceQuest`, `ship`, `heart`) at first load. When webpack HMR hot-replaces `index.js`, the new module re-runs and resets those `let` bindings to `undefined`, but p5 does not re-run `preload` — so `setup` can fire (triggered by an async preload-tracker decrement from `p5.sound`) with `spaceQuest` still `undefined`, and `p5.textFont(null)` throws. Declining HMR forces a full page reload on edits, which re-runs the entire lifecycle.
