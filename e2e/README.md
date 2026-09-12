# End to end tests

Run them with `npm run test:e2e`. Playwright starts the dev server itself.

## How a test reaches the game

The game is a canvas, so there is nothing in the DOM to assert on. `src/game/harness.js`
exposes a small set of arrangement verbs on `window.__asteroides`, and `fixtures.mjs` wraps them
so a spec calls `a.step()` rather than writing `page.evaluate` by hand.

The harness attaches only when the bundle is built for development and the page is loaded with
`?e2e=1`. `index.js` imports it dynamically inside that check.

The `process.env.NODE_ENV !== "production"` test has to stay written inline in the `if`. Webpack
folds it at parse time and never registers the dynamic import, so `build:prod` emits no chunk for
the harness. Reading it into a variable first defeats the fold: the first version of this shipped
a `dist/232.js` containing the whole harness, and only a grep of `dist/` caught it. A development
build does emit the chunk, and there the `?e2e=1` check is the thing keeping it inert.

## The pattern

Freeze, arrange, step, snapshot, assert.

```js
await a.startRun();
await a.putAsteroidsOnShip(2);
await a.step();
expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });
```

Three rules, each learned the hard way while verifying the `Run` extraction by hand.

Own the clock. There is one. The fixture freezes the sketch with `p5.noLoop()` and every frame
comes from an explicit `step()`, and nothing in the engine reads wall time: a death is a frame
count that `setMinimumDeathFrames` shortens. Anything that waits and then checks is racing the
game: asteroids drift, the ship dies, and shots cross the whole canvas in under a second.

`freeze()` cancels the animation frame p5 has already queued as well as calling `p5.noLoop()`, which
only stops the *next* frame being scheduled. Without the cancel, one frame still fires, and on a
loaded machine it arrives mid test and adds a frame no `step()` asked for. That showed up as a death
ending one frame early in roughly one run in three.

Arrange everything the test depends on. `parkAsteroids` stops the drift before a test places
what it cares about. The RNG is never seeded, because a test that sets the positions it needs
does not care what the RNG chose.

One page per test. Playwright gives each test a fresh page, so no test can inherit a world
another test arranged. A stale pair of stacked asteroids is what made a hand run report 40
points where 20 was expected.

## What is deliberately not tested

Rendering. Comparing screenshots of a starfield built from 500 randomly placed stars is a flake
generator.

Sound. It needs a user gesture the headless browser will not give, and `SoundManager.play` no-ops
on a missing key by design.

Exact positions and velocities. `snapshot()` reports counts, states and a `shipMoving` boolean
rather than floats, so a physics tweak does not fail an unrelated test. `spawnPoint` is the one
exception, and a spec asserts a relationship about it, that it is far from a corner or is where
the ship ended up, never a coordinate.
