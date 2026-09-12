# Architecture

> ASTEROiDES is a browser-based Asteroids clone rendered with p5.js (Canvas 2D) and bundled by Webpack. It uses a fixed-tick frame loop, instance-mode rendering, and a class-based entity model coordinated by a central `Game` controller.

## Overview

The application boots a single p5 instance in `src/index.js`. The p5 instance owns the render loop (`preload → setup → draw` at 60fps) and is passed by reference into every game class. A central `Game` object dispatches each frame to one of six states (`menu`, `playing`, `dying`, `ghost`, `levelComplete`, `gameOver`) owned by a `GameState` module. Game state transitions that start a fresh field (new level, "start game" from menu, restart after game over) are implemented by reconstructing the `Game` instance from `index.js` in response to `state.nextState`, which names the state the fresh `Game` starts in. Score, lives, and level survive the rebuild because a `Run` module owns them and outlives every `Game`. A death is the exception: it keeps the surviving asteroids, so it rebuilds the ship in place and leaves the `Game` standing. A death is an absence (`dying`) followed by a ghost (`ghost`), both counted in frames.

Domain vocabulary lives in `CONTEXT.md`. There are no external services. The only persistence is the high score table, which one `HighScores` module keeps in `localStorage`. Tests are end to end only: Playwright drives a real browser against a small harness, and there is no unit test runner. The only runtime dependency is `p5` (with its `p5.sound` addon).

## Module Map

| Module | Path | Purpose | Key Files |
|---|---|---|---|
| Bootstrap | `src/index.js` | p5 instance creation, asset preload, top-level state reset wiring | `index.js` |
| Game Controller | `src/game/` | Per-level Game instance, state-machine dispatch, collision response, and the run scoped score, lives and level | `game.js`, `gameState.js`, `run.js`, `input.js`, `collisions.js`, `soundManager.js`, `cues.js`, `helpers.js` |
| High score table | `src/game/highScores.js` | The ten best runs on this browser, and the only `localStorage` access in `src/` | `highScores.js` |
| Entities | `src/game/elements/` | Ship, Asteroids, Shot, Debris, Scoreboard, Background, Stars. All class-based, all own their own `draw()` | `ship.js`, `asteroids.js`, `shot.js`, `debris.js`, `asteroidDebris.js`, `shipDebris.js`, `shipTrace.js`, `background.js`, `stars.js`, `scoreboard.js` |
| Test seam | `src/game/harness.js`, `e2e/` | Arrangement verbs exposed to Playwright, plus the spec suite | `harness.js`, `e2e/fixtures.mjs`, `e2e/*.spec.mjs`, `playwright.config.mjs` |
| Screens | `src/game/state/` | Non-playing game states rendered as full-canvas overlays | `startMenuScreen.js` (exports `StartMenuScreen` and `LevelUpScreen`), `gameOverScreen.js` |
| Assets | `src/{font,images,sounds,css}/` | Static assets imported via ES modules and bundled by Webpack's `type: "asset"` rule | `font/SpaceQuest-yOY3.ttf`, `images/ship.png`, `images/heart.png`, `sounds/*.wav` |
| Build | `webpack.config.js`, `.babelrc` | Bundling, dev server (HMR on :8080), asset loaders, `p5` ProvidePlugin | `webpack.config.js` |

## Entry Points

- **Application bootstrap**: `src/index.js` — creates the p5 instance, preloads assets, constructs the long-lived `Input`, `SoundManager` and `Run`, defines `resetSketch(current)` (the rebuild-Game function called on game-over restart and level-up, taking the state the fresh `Game` starts in), and registers `keydown` blocking for arrows/space at the document level.
- **Game controller**: `src/game/game.js` — dispatches each frame based on `state.current` via `draw()`, runs `playGame()` during `"playing"`, `"dying"` and `"ghost"`, constructs all entities in `setup()`.
- **State machine**: `src/game/gameState.js` — owns `state.current`, the legal transitions (`startPlaying`, `shipDied`, `levelCleared`, `acknowledgeLevelUp`, `acknowledgeGameOver`), the whole death timeline (`advanceDeath`: the absence, the return point, the ghost and its grace extension, and the blink and fade curves the ship renders off), and the `nextState` signal that `index.js` polls to trigger `resetSketch`. It never sees score, lives, or level.
- **Input dispatcher**: `src/game/input.js` — single owner of `p5.keyPressed` and the action vocabulary (`thrust`, `brake`, `rotateLeft`, `rotateRight`, `shoot`, `confirm`). Exposes `isHeld(action)` for held inputs and `wasPressed(action)` (consume-on-read) for one-shots. Constructed once in `index.js`; survives `Game` reconstructions.
- **Run state**: `src/game/run.js`. Score, lives and level as plain numbers, plus the four transitions that change them (`addPoints`, `loseLife`, `nextLevel`, `reset`). Constructed once in `index.js`, handed to every `Game`. Imports nothing, holds no p5 reference.
- **High score table**: `src/game/highScores.js`. The ten best runs as plain `{ score, level }` numbers, `entries()` to read them and `record(score, level)` to insert one and get back its rank. Constructed once in `index.js`, handed to every `Game`. Imports nothing, holds no p5 reference, and is the only module in `src/` that calls `localStorage`.
- **Test seam**: `src/game/harness.js`. Arrangement verbs for the e2e suite: frame stepping, a JSON
  snapshot, and verbs that place asteroids, set run values and arrange or break the high score
  table. Attached to `window.__asteroides`
  only by a development build loaded with `?e2e=1`.
- **Collision detection**: `src/game/collisions.js` — two pure functions, `shipVsAsteroids(ship, asteroids)` and `shotsVsAsteroids(shots, asteroids)`. Imports nothing, holds no state, never touches p5. `Game` calls them and owns every consequence.
- **Player entity**: `src/game/elements/ship.js` — physics integration, shot/trace/debris spawning, screen-wrap. Reads input via `this.game.input.isHeld(...)` / `wasPressed(...)`.
- **Asteroid system**: `src/game/elements/asteroids.js` — spawns initial wave per `level`, handles splitting (`X` → `M` → `S`) on hit, owns the asteroid array.
- **Sound dispatch**: `src/game/soundManager.js` — keys every cue by name, applies a shared reverb to explosion/break sounds. Five cues are `p5.SoundFile`s loaded from `src/sounds/`. The three with no file in the repository (`levelUp`, `gameOver`, `shipThrust`) are synthesized in `src/game/cues.js` and answer the same `play`/`stop` pair, so neither `SoundManager` method knows which kind it holds.

## Invariants

- **p5 instance mode only.** Never use bare p5 functions (`line(...)`, `dist(...)`). Every class receives the p5 instance via constructor and calls methods through `this.p5`. The only p5 globals are `p5` (the class) and `p5.SoundFile` (via the sound addon import in `index.js`).
- **`Game.draw()` is the single state dispatcher.** It switches on `this.state.current` and selects exactly one of: `startMenuScreen.draw()`, `playGame()` (for `playing`, `dying` and `ghost`), `levelUpScreen.draw()`, or `gameOverScreen.draw()`. State changes happen by calling transition methods on `GameState` (`shipDied`, `levelCleared`, etc.) — never by reading or writing `state.current` directly from outside `GameState`.
- **Collision detection is suppressed for the whole death, absence and ghost alike.** `Game.checkIfCollisions` early-returns when `!state.isPlaying()`. Shots in flight continue to register hits on asteroids throughout. The ship's overlap is measured during a death in exactly one other place, `GameState.advanceDeath` on the single frame the ghost would end, and there it decides the grace rather than a life.
- **A ghost cannot shoot, and the ban is a consume rather than an ignore.** `Ship.fireIfPressed` calls `input.wasPressed("shoot")` on every live frame and discards the result during a ghost. Skipping the call would leave the press buffered and fire it on the frame the ship becomes mortal.
- **A death rebuilds the ship; everything else reconstructs the `Game`.** A cleared level, a game over and a return to the menu set `nextState`, and `index.js` calls `resetSketch(current)` to build a fresh `Game` around the existing `Run`. A death sets nothing: the surviving asteroids are the point of it, so `Ship.rebuildAt` puts the ship back in place and the `Game` stands. The reason the reconstruct rule exists, stale cross-references between entities, does not apply to a death because nothing is torn down. Do not add a "soft reset" to any of the other three paths.
- **The death is counted in frames, not wall time.** `GameState.advanceDeath` runs once per frame and owns the whole timeline: 120 frames of absence, 120 of ghost, and the one fixed 60 frame extension a ghost gets when an asteroid overlaps the ship on the frame it would end. A ghost runs 120 frames or 180 and never anything between. Nothing in the engine calls `setTimeout`, which is what makes a stepped test exactly reproducible.
- **Run state lives outside `Game`.** Score, lives and level belong to `Run`, which `index.js` constructs once and every `Game` borrows. `Game` has no `score`, `lifes` or `level` field. Anything that must survive a rebuild goes on `Run`, never into the rebuild signal.
- **The high score table lives outside `Game` and outside `Run`.** `index.js` constructs one `HighScores` next to `Run`, `Input` and `SoundManager`, and it outlives every `Game` and every run. It is not carried in `nextState`, which keeps the rule that the rebuild signal carries no state. The one point the table meets the engine is the final death in `Game.killShip`, which is the only place that knows a run ended while its score and level are still set. `Game.rank` holds what `record` returned so the game over screen reads a value rather than recomputing one; a death is not a rebuild, so it survives until the player confirms.
- **`HighScores` is the only module in `src/` that touches `localStorage`.** Every read and every write is wrapped, so a private window, a blocked origin, a hand edited value and a foreign version all end in an empty table or a swallowed write rather than a game that will not boot. A failed write is not latching: the in-memory table keeps the new entry and the next write is attempted normally. Do not put storage in a screen, in `Game` or in `Run`. (`harness.js` corrupts and breaks storage to arrange a test, and takes the key from `highScores.js` rather than naming it. It ships in no production build.)
- **A menu rebuild ends the run.** `index.js` calls `run.reset()` when `nextState` is `"menu"`, and only then. Every other rebuild continues the run.
- **Lives include the ship in play.** `Run` starts at 3 and `loseLife()` returns `true` when the count reaches 0, so the third death ends the run. Do not reintroduce a separate "was this the last life" test in `Game`.
- **Entities own their own cleanup.** Each entity class filters its own dead children (`filterOldShots`, `filterOldTraces`, `filterOldShipDebris`, `cleanExplodedAsteroids`). New entity types must follow the same pattern; do not add cleanup logic to `Game.playGame()`.
- **Collision detection runs before rendering each frame.** `playGame()` order is: `advanceDeath → checkIfCollisions → checkForHits → checkIfExplodedAsteroids → checkIfLevelCompleted → draw entities`. Do not reorder. Collision flags drive what the entities render on the same frame, and `advanceDeath` leads so the absence and the ghost start and end on a frame boundary. Run it after `checkIfCollisions` instead and both windows go wrong by a frame: the frame a death begins is counted as a frame of the absence, and the frame a ghost ends still has its collision check skipped, so the ship stays immune one frame longer than it is drawn as a ghost.
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
- **Entity-vs-entity geometry lives only in `src/game/collisions.js`.** No other module measures overlap between two entities. The module is pure: no imports, no state, no p5. It reports hits and never applies them, so scoring, sound, lives, and state transitions stay in `Game`. (The 300px check in `asteroids.js` keeps a new level's asteroids out of the clearing at the canvas centre. That is placement, not collision, and stays where it is.)
- **`shipVsAsteroids` returns at most one asteroid.** The ship can lose only one life per frame no matter how many asteroids overlap it. This is enforced by the `find` in `collisions.js`, not by a guard in `Game`. Do not reintroduce a loop over all overlapping asteroids in the ship path.
- **All keyboard input flows through `Input`.** No module outside `src/game/input.js` may read `p5.keyCode`, call `p5.keyIsDown`, or assign `p5.keyPressed` / `p5.keyReleased`. Game-action callers use `this.game.input.isHeld(action)` or `this.game.input.wasPressed(action)`.

## Cross-Cutting Concerns

| Concern | Implementation | Location |
|---|---|---|
| Rendering | p5.js Canvas 2D, instance mode, 60fps `draw()` | `index.js` (instance creation), every entity's `draw()` |
| Audio | `p5.sound` soundfiles plus oscillator/noise cues synthesized at runtime, with a shared reverb on explosions, breaks and both one-shot cues | `src/game/soundManager.js`, `src/game/cues.js` |
| Input | All keyboard input flows through `src/game/input.js`. Ship and screens query via `input.isHeld(action)` for held inputs and `input.wasPressed(action)` (consume-on-read) for one-shots. `p5.keyPressed` is assigned exactly once, in the `Input` constructor. | `src/game/input.js`, callers in `ship.js`, `state/startMenuScreen.js`, `state/gameOverScreen.js` |
| Run state | Score, lives and level as plain numbers on one `Run` instance that outlives every `Game`. Only `Game` writes to it, through four methods. | `src/game/run.js`, callers in `game.js`, `index.js`, both screen classes |
| Persistence | One `localStorage` key holding a versioned JSON object: a version number and the entry list. Reads and writes are each wrapped, entries are validated on load, and a wrong version discards the table. Nothing else in `src/` reads or writes storage. | `src/game/highScores.js`, callers in `index.js`, `game.js`, both screen classes |
| Geometry/viewport | Vector helpers and responsive canvas sizing | `src/game/helpers.js` (`findOutWidth`, `findOutHeight`, `calcVectorValue`, `randomInteger`, `drawPolygon`) |
| Collision geometry | Circle overlap via `Math.hypot`. Detection is pure and separate from response: `collisions.js` reports, `game.js` reacts. | `src/game/collisions.js`, callers in `game.js` |
| Screen wrap | Each moving entity implements its own `ifOverflowed()` toroidal wrap | `ship.js`, `asteroids.js`, `shot.js` |

## External Integrations

None. ASTEROiDES is fully client-side and offline-capable once bundled. The only "external" target is **GitHub Pages**, used as a static-hosting deploy target via `gh-pages -d dist`.

## Data Flow (per frame)

1. Browser fires p5's `draw` tick (60fps target).
2. `index.js` draws `Background` (parallax stars), then delegates to `game.draw()`.
3. `Game.draw()` switches on `state.current` to select one of: `startMenuScreen` / `playGame()` (for `playing`, `dying` and `ghost`) / `levelUpScreen` / `gameOverScreen`.
4. In `playGame()`:
   a. `advanceDeath()` — one frame of the death, and the first thing the frame does. Through the absence it counts frames with no ship on the canvas. On the frame the absence ends it answers `"return"`, and `Game` calls `Ship.rebuildAt(state.returnPoint)` to put the ship back where it died, at rest, on the heading it died with. Through the ghost it advances the blink and fade curves. On the frame the ghost would end it asks `Game` whether an asteroid overlaps the ship: if one does and no extension has run, the ghost gains 60 frames; if one does after the extension, it answers `"kill"` and `Game` runs an ordinary death; otherwise the state returns to `playing`, which makes the ship mortal for the rest of this same frame.
   b. `checkIfCollisions()` early-returns when `!state.isPlaying()`, then asks `Game.shipIsOverlapping`, which wraps `collisions.shipVsAsteroids`. On a hit it hands over to `Game.killShip`, which reads the ship's position first because `handleExplosion` nulls it, explodes the ship, plays the sound, and calls `run.loseLife()`. When the verdict is a final death it calls `highScores.record(run.score, run.level)` and keeps the returned rank on `Game.rank`, which is where the whole of the high score feature meets the engine. It then passes the verdict and that position to `state.shipDied({ wasFinalDeath, returnPoint })`. That moves state to `dying` (zeroing the death's frame counts) or `gameOver`.
   c. `checkForHits()` asks `collisions.shotsVsAsteroids` for every `{ shot, asteroid }` pair, then marks each asteroid exploded and each shot hit, awards score through `run.addPoints`, and plays the break sound via the `ASTEROID_HITS` table. Runs during `dying` and `ghost` too, so in-flight shots continue to score for the whole death. Detection completes before any mutation.
   d. `checkIfExplodedAsteroids()` — asks `Asteroids` to split large/medium asteroids into smaller children and remove the exploded ones.
   e. `checkIfLevelCompleted()` — early-returns when `!state.isPlaying()`. Otherwise, if no asteroids remain, calls `state.levelCleared()` and then `run.nextLevel()`, so the level up screen already shows the wave about to be played.
   f. Each entity's `draw()` runs: physics → cleanup → render.
5. After `Game.draw()` returns, `index.js` checks `game.state.nextState`. If it is set, `index.js` calls `run.reset()` when the target is `menu`, then calls `resetSketch(nextState)` to construct a fresh `Game` around the same `Run`.
6. FPS counter is overlaid in the bottom-left for diagnostic visibility.

## Key Decisions

### Why p5 instance mode (not global mode)
Instance mode keeps p5's ~200 globals out of the module scope, makes the code Webpack-tree-shakable, and avoids name collisions with browser globals (`background`, `text`, `line`). The trade-off is verbosity — every class receives and stores a p5 reference — but it pays off for bundling and for keeping the code analyzable.

### Why reconstruct `Game` on state transitions
Entities cache references to one another (ship → shots → debris) and to the p5 instance. Resetting in-place would require coordinated nulling of cross-references across ~12 entity classes. Reconstructing one `Game` instance and letting the GC reclaim the old one is simpler, faster to reason about, and avoids subtle stale-reference bugs across levels.

A death is the one transition that does not reconstruct, because the asteroids that survived have to survive the rebuild too (ADR-0001). The alternatives were carrying the surviving array in `nextState`, which would put p5-holding entities back into the state machine, and making `Asteroids` a long-lived module owned by `index.js`. Keeping the `Game` costs nothing: nothing is torn down, so there is no stale reference to null. `Ship.rebuildAt` is the whole of the reset, and `GameState` holds the death's frame counts so `Game` asks questions rather than keeping a parallel timer.

### Why a `GameState` module
Previously, "what state is the game in?" was encoded as four independent booleans (`started`, `gameOver`, `levelCompleted`, `restartLevel`, plus a dead `paused`) that could be mutated from any module — screens, collision code, and even `index.js` (which polled `restartLevel`). The interface was "any caller may write any flag," which is barely an interface at all. Consolidating into a `GameState` module gives the engine a deep module with a small surface: callers send transition events (`startPlaying`, `shipDied`, `levelCleared`, `acknowledgeLevelUp`, `acknowledgeGameOver`), the module enforces legal moves, owns the death's timeline and the return point, and exposes a single field for `index.js` to poll. That field started as `wantsRebuild` plus a `rebuildArgs` array and became `nextState` when `Run` took over score, lives and level. Making `dying` an explicit state also closed a latent bug: collisions are now suppressed for the whole death, so a drifting asteroid no longer re-triggers `handleExplosion` on a dead ship.

### Why a death is an absence and a ghost, not a clearing

ADR-0001 made a searched clearing the only protection after a death. `clearing.js` scored grid
points by time to the first threat and returned the best of the ones not occupied on the current
frame. Verifying it in a browser found two defects, neither of which throws. At 1280x720 a level
8 death ran 484 frames and still returned the ship to a point an asteroid reached 10 frames
later. On a 520x420 canvas a 300 pixel circle plus a 95 pixel asteroid radius does not fit at
all, so every candidate stayed occupied, the search returned `null` forever and the ship never
came back.

ADR-0002 replaces it. The ship returns to the point it died and is a ghost for 120 frames: it can
be flown, it cannot be hit, and it cannot shoot. The blink interval ramps from 20 frames to 4 and
the opacity from 0.25 to 1.0, both linear in the time remaining, so the player watches the
protection run out rather than being handed a silent head start. That is the answer to
ADR-0001's objection that a ship which cannot die teaches players to ignore the field. Removing
the ability to shoot keeps the ghost a window for escape rather than a window for free kills.

The one edge the fixed window leaves open is a ghost that ends inside an asteroid. It gains 60
frames, once, and an overlap still present at the end of those kills. The alternative, deferring
expiry for as long as anything overlaps, was rejected because a player who never moves would
never become killable. A fixed extension is bounded and a spec can assert it.

`clearing.js`, `Game.findClearing` and the blinking outline preview are gone with it. So is the
harness's `findClearing` verb: the ghost is arranged and measured through `killShip`,
`setAbsenceFrames` and the ghost counters in `snapshot()`.

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

### Why the high score table sits outside both `Game` and `Run`

The table outlives a run, so `Run` is the wrong owner: `run.reset()` fires on every return to the
menu and would take the history with it. It outlives a `Game` by even more, and a `Game` is
rebuilt three ways. That leaves `index.js`, which already constructs the three things that
outlive a `Game` and hands them down.

`HighScores` imports nothing and never sees p5, which puts it in the same tier as `run.js`,
`collisions.js` and `helpers.js`: it can be reasoned about without a canvas. Confining
`localStorage` to it means the four ways storage fails (a private window throwing on write, a
blocked origin throwing on read, a hand edited value, a value written by an older version) are
handled in one place instead of at every call site.

`record` returns the rank rather than a boolean, which is what lets the game over screen say
something specific without reading the table and working it out. It mirrors `Run.loseLife`,
which returns the verdict for the same reason. A tie ranks below the run already there, so the
older run keeps the place it earned, and a score of zero never qualifies, so quitting on the
first wave cannot occupy a place.

Recording happens at the one point that already knows a run ended, the final death in
`Game.killShip`. No new state transition was invented to carry it, and because that point runs
before the table is read again, the rank is measured against the table as it stood before the
run. A death does not rebuild the `Game`, so `Game.rank` survives until the player confirms the
game over screen and `index.js` reconstructs into the menu.

Rejected: a date on an entry. `Date.now()` would be the first wall clock read in the engine, and
the whole e2e suite rests on nothing in the engine reading wall time.

### Why the e2e suite drives a harness rather than the canvas

The game renders to a canvas, so a black-box test has nothing to assert on beyond pixels.
Screenshot comparison was rejected: the background is 500 randomly placed stars, and every
asteroid has a random radius, side count and rotation, so a pixel diff would fail on noise.

Driving the game live and sampling it also fails, and did fail. A first pass at verifying the
`Run` extraction pressed keys and read state between round trips. Asteroids drifted into the
ship, two deaths happened between calls, and shots crossed the canvas before they could be
counted. Nothing about that pass was reproducible.

What works is owning the clock. There is one: frames advance only through `p5.redraw()` after
`p5.noLoop()`, and nothing in the engine reads wall time. A death is a frame count, and
`setMinimumDeathFrames` shortens it so the real path stays under test instead of being
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

### Why the sketch is constructed on the window load event

p5 defers `_start`, and therefore `preload`, to the window load event whenever `document.readyState`
is not already `complete`. By that point `p5.sound`'s `init` hook has incremented p5's preload
counter and started loading its audio worklet from a blob URL, which needs no network. If that
worklet resolves before the load event fires, the counter reaches zero early, `_runIfPreloadsAreDone`
runs `_setup`, and the sketch sets up with nothing loaded: `p5.textFont` throws "null font passed to
textFont" on a font that was never fetched, the canvas keeps p5's default 100x100, and `Game` is
built holding undefined images.

Constructing the instance once the document is complete makes p5 run `_start` inside the constructor,
where `preload()` executes in the same synchronous block as the `init` hook. A promise cannot resolve
in between, so `preload` cannot lose the race. `e2e/boot.spec.mjs` holds the load event open with a
slow image to make the race deterministic, and fails without this.

### Why `module.hot.decline()` in `src/index.js`
p5's `preload` → `setup` lifecycle binds to the module-scope variables (`spaceQuest`, `ship`, `heart`) at first load. When webpack HMR hot-replaces `index.js`, the new module re-runs and resets those `let` bindings to `undefined`, but p5 does not re-run `preload` — so `setup` can fire (triggered by an async preload-tracker decrement from `p5.sound`) with `spaceQuest` still `undefined`, and `p5.textFont(null)` throws. Declining HMR forces a full page reload on edits, which re-runs the entire lifecycle.
