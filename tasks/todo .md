# Plan: Give the run its own module

## Goal

Score, lives and level get one owner. A `Run` module holds them as plain numbers, is constructed
once in `index.js` next to `Input` and `SoundManager`, and outlives every `Game` reconstruction.
`GameState.rebuildArgs` disappears, `Score` and `Life` disappear, and `Game.setup` folds into the
constructor.

This is the fourth extraction in the arc after `GameState` (`00fd2d8`), `Input` (`8fa551d`) and
`Collisions` (`358ddb3`).

## Decisions locked

- **Run holds numbers, never p5.** `score`, `lives`, `level` as plain public fields. It imports
  nothing, draws nothing, and joins `collisions.js`, `gameState.js` and `helpers.js` as a module
  that can be reasoned about without a canvas.
- **Reads are fields, writes are methods.** Public fields for reading, matching `GameState.current`.
  Four methods cover every run rule: `addPoints`, `loseLife`, `nextLevel`, `reset`.
- **`loseLife()` returns the verdict.** It decrements and returns `true` when the run is over, so
  `Game` cannot ask about lives without spending one. This is what removes the off by one.
- **Lives become three, not four.** Today `wasFinalDeath` is `lifes.length === 0` against three
  `Life` objects, so the player gets four deaths while three hearts render. After this the third
  death ends the run and the hearts count down 3, 2, 1. This is the one deliberate behaviour change.
- **`nextState` replaces `wantsRebuild` and `rebuildArgs`.** One field holding a state name or
  `null`. The five state machine stops being encoded as a `started` boolean.
- **`index.js` owns the reset.** It holds the `Run` and decides when to rebuild, so it calls
  `run.reset()` when the rebuild target is the menu. `GameState` never learns that `Run` exists.
- **`ASTEROID_HITS` stays in `game.js`.** One table, one lookup per hit. `Run` takes points and
  knows nothing about asteroid sizes.
- **`setup` folds into the constructor.** Positional arguments, collaborators ungrouped. Grouping
  them belongs with the separate change that stops passing `Game` into `Ship` and the screens.
- **One `Scoreboard` replaces `Score` and `Life`.** Both fail the deletion test today: removing
  either moves a single p5 call and nothing else.

## Vocabulary

Added to `CONTEXT.md` in this change: Run, Level, Life, Rebuild, Scoreboard, Screen, Debris,
Trace, Asteroid size, Hit pair, Hitbox padding.

## Behaviour preserved

`checkIfLevelCompleted` calls `state.levelCleared()` and then increments, so the level up screen
already shows the level about to be played. `run.nextLevel()` goes in the same spot and the
screen keeps showing the same number.

`Asteroids` keeps taking a number, `new Asteroids(p5, run.level)`, so it never sees `Run`.

The `Scoreboard` draws hearts at the same coordinates `Life` used, x of 20, 40 and 60, and the
score at (100, 12). One `push`/`pop` now wraps both, which is equivalent because `p5.image`
ignores `fill` and `textSize`.

## Files touched

| File | Change |
|---|---|
| `src/game/run.js` | NEW. Three fields, four methods, no imports. About 25 LOC. |
| `src/game/elements/scoreboard.js` | NEW. Takes p5 and the heart image, `draw(run)`. About 20 LOC. |
| `src/game/elements/score.js` | DELETED. |
| `src/game/elements/life.js` | DELETED. |
| `src/game/gameState.js` | `nextState` replaces `wantsRebuild` and `rebuildArgs`. Constructor takes `current`. `shipDied` takes only `wasFinalDeath`. `acknowledgeLevelUp` takes nothing. |
| `src/game/game.js` | Constructor absorbs `setup` and takes `run`. Loses `level`, `score`, `lifes`. |
| `src/index.js` | Constructs `Run`. `resetSketch(current)`. Calls `run.reset()` before a menu rebuild. |
| `src/game/state/startMenuScreen.js` | Reads `game.run.level`. `acknowledgeLevelUp()` loses its arguments. |
| `src/game/state/gameOverScreen.js` | Reads `game.run.score`. |
| `CONTEXT.md` | NEW. Glossary. |
| `ARCHITECTURE.md` | Module map, invariants, data flow, one new decision entry. Separate commit. |

No entity class changes. No build config changes. `collisions.js`, `input.js`, `soundManager.js`
and `helpers.js` are untouched.

## Implementation steps

- [x] 1. Create `src/game/run.js`. `STARTING_LIVES = 3`. `reset()` sets score 0, lives 3, level 1,
      and the constructor calls it. `addPoints(points)`, `loseLife()` returning `this.lives === 0`
      after decrementing, `nextLevel()`.
- [x] 2. Create `src/game/elements/scoreboard.js`. `constructor(p5, heartImage)` and `draw(run)`
      drawing `run.lives` hearts then `run.score`, wrapped in one `push`/`pop`.
- [x] 3. Rewrite `src/game/gameState.js`. Constructor takes `{ current = "menu", respawnDelayMs }`.
      `shipDied({ wasFinalDeath })` sets `nextState = "playing"` on the timer.
      `acknowledgeLevelUp()` sets `nextState = "playing"`. `acknowledgeGameOver()` sets
      `nextState = "menu"`. Delete `wantsRebuild` and `rebuildArgs`.
- [x] 4. Rewrite `src/game/game.js`. Constructor signature
      `(p5, soundManager, input, run, current, images)`. Delete the six placeholder statements and
      the `setup` method. `checkForHits` calls `run.addPoints(rule.points)`. `checkIfCollisions`
      calls `const wasFinalDeath = this.run.loseLife()`. `checkIfLevelCompleted` calls
      `run.nextLevel()`. `playGame` calls `this.scoreboard.draw(this.run)`.
- [x] 5. Rewrite `src/index.js`. Add `let run = new Run()` beside `soundManager` and `input`.
      `resetSketch(current)` builds the `Game` with `{ ship, heart }`. `setup` calls
      `resetSketch("menu")`. `draw` checks `game.state.nextState`, calls `run.reset()` when it is
      `"menu"`, then rebuilds.
- [x] 6. Update both screen modules for `game.run` and the argument free `acknowledgeLevelUp()`.
- [x] 7. Delete `score.js` and `life.js`.
- [x] 8. Verify in the browser against the checklist below.
- [x] 9. Update `ARCHITECTURE.md`. Separate commit, matching `7396358`, `ff98d7b` and `f4361ce`.

## Verification

No test runner. Driven by hand with headless Playwright, the way the collisions refactor was
verified.

- [x] Score survives a level up and keeps counting from where it was.
- [x] Score survives a death and keeps counting from where it was.
- [x] Hearts decrement exactly once per death, including when two asteroids overlap the ship on
      the same frame.
- [x] The third death ends the run. The fourth is impossible.
- [x] Restarting from game over shows score 0, three hearts, and level 1.
- [x] The number on the level up screen matches the wave that follows it.
- [x] Shots in flight still score during the three second dying window.
- [x] No console errors across two levels and a full death cycle.

## Review

All nine steps done. Not committed.

### What changed

`Run` (30 lines) and `Scoreboard` (26 lines) are new. `score.js` and `life.js` are deleted.
`game.js` went from 149 lines to 125, and lost the `setup` method, the six placeholder
statements, and the `level`, `score` and `lifes` fields. `gameState.js` traded `wantsRebuild`
plus `rebuildArgs` for one `nextState` field and no longer takes score, lives or level as
arguments anywhere.

Net source is 1369 lines to 1375, so this bought nothing in size. What it bought is that score,
lives and level are now written in one file instead of passed through three.

### What verification showed

Driven with headless Playwright against the dev server. The game was frozen with `p5.noLoop()`
and stepped one frame at a time with `redraw()`, so every check below is deterministic rather
than a race against roundtrip latency.

- A menu rebuild resets the run to 0 score, 3 lives, level 1, and spawns 2 asteroids.
- A level up keeps a score of 120, moves level 1 to 2, and the next wave has 4 asteroids, so the
  number the level up screen shows is the wave that follows it.
- Two asteroids parked on the ship in the same frame cost exactly one life. This is the case the
  old `lifes.pop()` shape got wrong and the one that is impossible to trigger by hand.
- Three deaths end the run. Lives went 3, 2, 1, 0 with the score held at 250 across both
  respawns, and ten further frames with an asteroid sitting on the ship changed nothing.
- A shot in flight still scores during the dying window.
- The real keyboard path works end to end: Space through `Input` produces a real `Shot`, which
  hits an `X` asteroid for 20 points and splits it into two `M`.
- The scoreboard renders two hearts and the score at the same coordinates as before.
- Zero console errors. The only warning is Chrome's AudioContext autoplay notice, which predates
  this change.
- Live at 60fps through two natural deaths.

One result needs explaining. The dying-window check scored 40 rather than 20 because the test
shot sat inside two stacked asteroids, and `shotsVsAsteroids` returns every matching pair by
design. That is the behaviour the collisions refactor preserved on purpose.

### Notes

Verification used a temporary `window.__verify` hook in `index.js`, the same trick the collisions
refactor used. It is removed, and the build was re-run clean afterwards.

`gameOverScreen.js` gained a trailing newline, which it was missing before. That is the whole of
the third hunk in its diff.

### Follow-ups

- Backlog item 22 is answered, differently than it proposed. Instead of Vitest over the p5 free
  modules, there is now a Playwright suite in `e2e/` driving the real game through a harness. 17
  specs, 7 seconds. A unit runner is still an option later, but the run rules are covered.
- Items 12, 15, 16 and 21 (combo, power-ups, shield, run stats) now have somewhere to go.
- The next deepening from the same review is candidate 2: stop passing the whole `Game` into
  `Ship` and the screen classes. Both screens still reach through `this.game.run`.
