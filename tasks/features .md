# Feature backlog

Brainstormed 2026-08-28 against commit `7396358`. Every item below was checked against the
source, not guessed. Line references are accurate as of that commit.

## How to read this

Effort is calendar time for one person including manual browser verification, since no test
runner exists.

| Size | Meaning |
|---|---|
| XS | under an hour |
| S | half a day |
| M | one to three days |
| L | a week or more |

## Constraints every feature works around

Four structural facts about this codebase. Read them before scoping any item.

**Game is reconstructed, never reset.** `resetSketch()` in `index.js` builds a fresh `Game` on
every death and every level-up. State that must survive a run either travels through
`state.rebuildArgs`, the way `score` and `lifes` already do, or lives outside `Game` entirely,
the way `Input` and `SoundManager` do. Power-ups, shields, combo counters, and run stats all
collide with this. Picking the channel is the first design question for each of them.

**`collisions.js` stays pure.** It imports nothing, holds no state, and never touches p5. A new
entity type adds a detection function there and keeps every consequence in `Game`. Do not put
scoring, sound, or state transitions in the geometry module.

**Entities clean up their own children.** Each class filters its own dead objects. New entity
types follow that pattern. Cleanup does not go in `Game.playGame()`.

**Frame rate is reassigned every frame, per state.** `playGame()` calls `p5.frameRate(60)`, the
menu screen calls `frameRate(10)`, and the game-over screen calls `frameRate(20)`. p5 honors the
target by skipping `draw` calls, so this throttles the whole sketch, including the `Background`
starfield that `index.js` draws before `game.draw()`. The starfield therefore animates at 10fps
on the menu. Anything that manipulates time depends on item 24.

## Top 5 by impact per effort

| # | Feature | Effort | Why it ranks |
|---|---|---|---|
| 1 | Wire up the dead sounds | S | Three `play()` call sites already exist and produce silence |
| 2 | Fix the asteroid debris leak | XS | Unbounded array growth in the 60fps loop, three commented lines |
| 3 | Respawn invulnerability | S | You can respawn inside an asteroid and lose a second life instantly |
| 4 | Real difficulty curve | S | `level * 2` is the only difficulty dial in the game |
| 5 | High-score persistence | S | Lives outside `Game`, so the reconstruction pattern never touches it |

---

# Polish and juice

## 1. Wire up the dead sounds

`SoundManager.preload` has five `loadSound` calls commented out: `shipThrust`, `gameOver`,
`levelUp`, `life`, and `background`. Three of them already have live callers that currently do
nothing, because `play()` uses optional chaining and silently no-ops on a missing key:
`ship.js:52` plays `shipThrust`, `game.js:84` plays `levelUp`, `game.js:112` plays `gameOver`.
The commented lines reference assets by string URL, which the Webpack asset rule does not
resolve, so they need ES imports and real files in `src/sounds/`.

Thrust is not a one-shot. `Ship.accelerate` already tracks `this.thrustSoundPlaying` to avoid
retriggering, so thrust should `loop()` on press and `stop()` on release. `SoundManager` already
exposes `stop()`. `addReverb()` only processes the four explosion and break sounds, so adding
keys to `sounds` is safe.

`life` has no caller at all. It pairs with an extra-life award, which needs a score threshold
rule in `Game`.

Effort S. Touches `src/sounds/`, `src/game/soundManager.js`, `src/game/elements/ship.js`.

## 2. Fix the asteroid debris leak

Asteroid debris is created on every asteroid break and never removed. Three lines are commented
out: `asteroidDebris.js:15` never initializes `this.faded`, `asteroidDebris.js:72` never sets it
to `true`, and `asteroids.js:66` never filters on it. The array grows for the entire level and
every entry is drawn on every frame.

Uncommenting all three restores the intended behavior, but the fade condition at line 72 needs
checking first, since it has never run. Verify by logging `game.asteroids.asteroidDebris.length`
across a level and confirming it plateaus instead of climbing.

This is a bug, not a feature, and it is the cheapest item in this file.

Effort XS. Touches `src/game/elements/asteroidDebris.js`, `src/game/elements/asteroids.js`.

## 3. Respawn invulnerability and blink

`Asteroids.initialPosition` rejects spawn points within 300px of the canvas center, so the
opening wave never appears on the ship. That guard runs once, at level construction. Asteroids
then drift freely, and the respawn after a death puts a fresh ship back at
`{ x: p5.width / 2, y: p5.height / 2 }` with no check at all. Respawning into an asteroid costs
a second life immediately.

Add a countdown on `Ship` that starts at construction, render the ship with a pulsing alpha
while it runs, and have `Game.checkIfCollisions` return early while it is active. The guard
belongs in `Game`, not in `collisions.js`, which stays pure.

Effort S. Touches `src/game/elements/ship.js`, `src/game/game.js`.

## 4. Pause

There is no pause. `GameState` has five states and the ARCHITECTURE notes record that a dead
`paused` boolean was deleted during the `GameState` extraction. Add a `paused` state, a `pause`
action in `KEY_MAP`, and a `Game.draw()` case that renders the last frame plus an overlay
without integrating physics.

One trap. `GameState.shipDied` schedules the respawn with `setTimeout(..., respawnDelayMs)`.
Pausing during `dying` leaves that timer running, so the rebuild fires while the game is paused.
Either capture the remaining time and restart the timer on resume, or replace the timer with a
frame counter decremented in `playGame`. The frame counter is simpler and matches how the rest
of the loop works.

Effort S to M. Touches `src/game/input.js`, `src/game/gameState.js`, `src/game/game.js`.

## 5. Screen shake

Add a trauma value on `Game` that spikes on ship death and on large asteroid breaks, then decays
each frame. `index.js` wraps `game.draw()` in `push`/`translate` with a random offset scaled by
trauma squared.

Shake only the game layer. `index.js` draws `Background` before `game.draw()`, so leaving the
starfield fixed reads as the camera moving rather than the whole universe wobbling.

Effort S. Touches `src/game/game.js`, `src/index.js`.

## 6. Hit-stop on ship death

Freeze the frame for roughly 100ms when the ship explodes, before the debris starts moving. It
is the cheapest way to make a death feel like it landed.

Blocked on item 24. With motion coupled to frame delivery, a freeze means skipping `draw` calls,
which also freezes rendering and produces a black stall instead of a held frame.

Effort S once delta time lands. Touches `src/game/game.js`.

## 7. Vector monitor glow

Set `p5.drawingContext.shadowBlur` and `shadowColor` before stroking asteroids, shots, the ship,
and screen text, to get the bloom of a real vector display. The palette is already right for it:
asteroids stroke `#F29F38` on fill `#A65E05`, score is `#00ca8d`, screen text is `#AFE4FF`.

Check the frame rate on a late wave first. Canvas 2D shadows are fill-rate expensive and the
asteroid count grows linearly with level.

Effort S. Touches `src/game/elements/asteroids.js`, `shot.js`, `ship.js`, both screen classes.

## 8. Thruster flame from the unused sprites

`src/images/` contains `ship1.png` through `ship5.png`. Nothing in `src/` references any of
them. Only `ship.png` is imported. If they are thrust animation frames, cycle them while
`input.isHeld("thrust")` is true.

`index.js` preloads exactly one ship image and passes it into `Game.setup(shipImage, heartImage,
score, lifes)`, which forwards it to the `Ship` constructor. Supporting frames means preloading
an array and widening that signature. Look at the five files before scoping this, since they may
be discarded ship designs rather than animation frames.

Effort S. Touches `src/index.js`, `src/game/game.js`, `src/game/elements/ship.js`.

## 9. Touch controls

`helpers.js` already sizes the canvas responsively through `findOutWidth` and `findOutHeight`,
so the game renders on a phone and is simply unplayable. Add an on-screen thumbstick and fire
button driven by pointer events inside `Input`.

`Input` is the designed seam for this. Keeping `isHeld(action)` and `wasPressed(action)` as the
only interface means no caller in `ship.js` or the screen classes changes at all.

Effort M. Touches `src/game/input.js`, `src/css/index.css`.

## 10. Gamepad support

Poll `navigator.getGamepads()` inside `Input.isHeld` and diff button state between frames to
produce `wasPressed`. Analog stick maps to rotation, trigger to thrust.

Same seam as item 9, same zero-caller-change property.

Effort M. Touches `src/game/input.js`.

---

# Gameplay depth

## 11. Real difficulty curve

`createInitialAsteroids` builds `this.level * 2` large asteroids and changes nothing else. Level
10 is 20 identical rocks, which is slow and cluttered rather than hard. The `Asteroid`
constructor already reads three size-keyed maps, `asteroidVelocityMap`, `initialRadius`, and
`strokes`, so a level factor has an obvious place to multiply in.

Scale speed with level, cap the asteroid count so late levels stay readable, and vary the
starting size mix instead of always spawning `X`. This is the single highest-impact gameplay
change per line changed, because the game currently has one dial.

Effort S. Touches `src/game/elements/asteroids.js`.

## 12. Combo multiplier

Scoring policy is already a single `ASTEROID_HITS` table at the top of `game.js`. Add a
multiplier that increments on each hit and decays after roughly a second without one, then
render it next to the score.

The combo resets on death, so it does not need to survive a rebuild. That makes this the only
scoring feature here that avoids the `rebuildArgs` question entirely.

Effort S. Touches `src/game/game.js`, `src/game/elements/score.js`.

## 13. Armored asteroids

Give `Asteroid` an `hp` field defaulting to 1. `Game.checkForHits` decrements instead of setting
`exploded` directly, and only flags the explosion at zero. Render armor as a second stroke ring.

Note the behavior the collisions refactor preserved deliberately: `shotsVsAsteroids` returns
every matching pair, and one shot inside two overlapping asteroids damages both. With hp that
becomes more visible, so decide whether it stays.

Effort M. Touches `src/game/elements/asteroids.js`, `src/game/game.js`.

## 14. Asteroid variants

Ice splits into three children instead of two. Metal reflects shots instead of taking damage.
`handleExplodedAsteroids` already branches on size to decide the split, so a type field slots in
next to it.

Metal needs shot velocity reflected off the surface normal. That is a new consequence in `Game`,
not new geometry. `shotsVsAsteroids` already returns the `{ shot, asteroid }` pair, which is
everything the reflection needs.

Effort M. Touches `src/game/elements/asteroids.js`, `src/game/elements/shot.js`,
`src/game/game.js`.

## 15. Power-up drops

Destroyed asteroids occasionally drop a floating pickup: spread shot, rapid fire, or extra life.
Needs a `PowerUp` entity, a `shipVsPowerUps` function in `collisions.js`, and a modifier layer on
`Ship.fireIfPressed`.

The reconstruction problem bites hardest here. A power-up active when the level ends is gone the
moment `resetSketch` runs, unless it travels through `rebuildArgs`. Recommendation: expire all
power-ups on level clear and on death. It is honest arcade behavior and it keeps `rebuildArgs`
from growing into a save file.

Effort L. Touches `src/game/elements/powerUp.js` (new), `src/game/collisions.js`,
`src/game/game.js`, `src/game/elements/ship.js`.

## 16. Shield with charges

A shield absorbs one collision instead of costing a life. `Game.checkIfCollisions` consumes a
charge and skips `handleExplosion` when one is available.

Unlike power-ups, a shield the player earned should survive a level-up. That means adding it to
`rebuildArgs` next to `lifes`, which is a four-element array today and should probably become an
object first.

Effort M. Touches `src/game/game.js`, `src/game/gameState.js`, `src/game/elements/ship.js`.

## 17. Hunter enemy

An enemy ship that enters from an edge, tracks the player, and fires. This is the arcade saucer
with aim.

Largest item here. Needs a new entity with its own movement and firing, two new detection
functions in `collisions.js` for enemy shots against the ship and enemy against asteroids, and
new consequences in `Game` for both. It also needs a spawn schedule, which is the first thing
after item 11 that makes levels feel different from each other.

Effort L. Touches `src/game/elements/enemy.js` (new), `src/game/collisions.js`,
`src/game/game.js`.

---

# Meta and infrastructure

## 18. High-score persistence

No `localStorage` call exists anywhere in `src/`. Persist the top ten scores, show them on the
start menu, and show the player's rank on the game-over screen.

This is the cleanest feature in the file. It lives entirely outside `Game`, so reconstruction
never touches it. Wrap the storage calls in `try`/`catch`, because private browsing modes throw
on write.

Effort S. Touches `src/game/storage.js` (new), `src/game/state/startMenuScreen.js`,
`src/game/state/gameOverScreen.js`.

## 19. Gate the FPS overlay

The `window.__game`, `window.__background`, `window.__diag`, and `window.__diagFrames` hooks were
removed from `index.js` on 2026-08-28, so what remains is the FPS readout, drawn unconditionally
at the bottom left of every frame in every state, menus included.

Put it behind a query parameter or a key toggle so it stays available without shipping by
default. Note that it also draws with `fill(255)` and `stroke(0)` and never wraps them in
`push`/`pop`, so it leaks both settings into the next frame's first draw call.

Effort XS. Touches `src/index.js`.

## 20. Settings screen with rebindable keys

`KEY_MAP` at the top of `input.js` is a single table, and `ACTIONS_BY_KEY` is derived from it at
module load. Make the map instance state, hydrate it from storage, and rebuild the reverse index
on change. Add a settings screen reachable from the menu.

ARCHITECTURE already names this as the reason the `Input` module exists. Note that `shoot` and
`confirm` deliberately share keys `32` and `13`, and the `_pending` map clears the whole key
entry on consume so one press cannot satisfy both. Rebinding has to preserve that.

Effort M. Touches `src/game/input.js`, `src/game/state/settingsScreen.js` (new),
`src/game/storage.js`.

## 21. Run stats

Track shots fired, hits, accuracy, asteroids destroyed by size, and time alive. Show them on the
game-over screen. Accuracy in particular changes how people play.

Stats span a whole run, so they cross death and level-up rebuilds. Put the collector outside
`Game`, next to `Input` and `SoundManager` in the `index.js` closure, and let `Game` report into
it. That avoids growing `rebuildArgs`.

Effort S to M. Touches `src/game/stats.js` (new), `src/index.js`, `src/game/game.js`.

## 22. Test runner for the p5-free modules

Three modules can be tested today without a canvas. `collisions.js` imports nothing and holds no
state. `gameState.js` has one `setTimeout` that fake timers handle. `helpers.js` is arithmetic
apart from `drawPolygon`.

Vitest in a node environment covers all three. The double-life bug the collisions refactor fixed
is exactly the regression a test suite would have caught, and it was found by hand with headless
Playwright instead.

This changes project ground rules, so it needs a CLAUDE.md update in the same change. CLAUDE.md
currently states that no test runner is configured and instructs against inventing commands.

Effort M. Touches `package.json`, `vitest.config.js` (new), `src/game/*.test.js` (new),
`CLAUDE.md`.

## 23. Resolve the lives off-by-one

`Game.checkIfCollisions` computes `wasFinalDeath` as `this.lifes.length === 0`, and `lifes`
starts as three `Life` objects. The player therefore gets four deaths while three hearts render.
Flagged twice in the ARCHITECTURE followups and deliberately left alone during the refactors.

Decide which is intended. Either the ship in play counts as a life and the hearts are spares, in
which case document it, or it is off by one, in which case fix it.

Effort XS. Touches `src/game/game.js`.

## 24. Delta-time frame loop

Every moving entity adds pixels per frame. `Ship.calcPosition` adds `velocity` to `position`,
`Asteroid.calcPosition` does the same, and `Ship.calcVelocity` applies a fixed `0.02` resistance
per frame.

p5 throttles to `_targetFrameRate`, so a 144Hz display does not run the game fast. The real
problem is the other direction: a machine that cannot hold 60fps plays the whole game in slow
motion. The per-state `frameRate` calls make it worse, since the menu's `frameRate(10)` throttles
the shared `Background` starfield too.

Scale motion by elapsed time instead, and drop the per-frame `frameRate` reassignment. This is a
prerequisite for item 6 and for any slow-motion effect.

Effort M. Touches every entity with a `calcPosition` or `calcVelocity`, plus `src/game/game.js`
and both screen classes.

## 25. Extract Lives and Level from Game

`Game` is 152 lines and still owns entity construction, lives, level progression, and frame
orchestration. ARCHITECTURE names lives and level as the next extractions after `GameState`,
`Input`, and `Collisions`.

Not a feature, but it unblocks several above. Items 12, 15, 16, and 21 all need somewhere to put
run-scoped state that is not `Game`, and `rebuildArgs` is a four-element positional array that
will not absorb much more before it becomes unreadable. Turning it into an object is the natural
first step.

Effort M. Touches `src/game/game.js`, `src/game/gameState.js`, `src/index.js`.

---

# Deferred

Arcade-faithful gaps were considered and set aside for now: the UFO saucer, hyperspace jump, and
score-threshold extra lives. Item 17 covers the enemy idea in a modern form. Items 1 and 23 touch
the extra-life machinery, so a threshold award is cheap to add later.

Replay and ghost recording is out for a structural reason. The game seeds nothing: asteroid
count, position, velocity, side count, radius, rotation, and debris count all call `Math.random`
directly. Deterministic replay needs a seeded generator threaded through `asteroids.js`,
`debris.js`, `asteroidDebris.js`, `shipDebris.js`, and `helpers.js` first. That is a larger
change than the feature is worth right now.
