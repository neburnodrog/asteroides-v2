# ASTEROiDES

Browser-based Asteroids arcade game clone built with p5.js and bundled with Webpack.

## Build & Development

- Dev server: `npm start` (webpack-dev-server, opens http://localhost:8080 with HMR)
- Build (dev): `npm run build:dev`
- Build (prod): `npm run build:prod`
- Watch: `npm run watch`
- Deploy: push to `main`. Vercel's git integration builds the commit and promotes it to production at https://asteroides-v2.vercel.app. `vercel.json` holds the build command and output directory. There is no deploy script.
- E2E tests: `npm run test:e2e` (Playwright starts the dev server itself)
- E2E tests, watch mode: `npm run test:e2e:ui`
- Dev server without opening a browser: `npm run start:test`
- Node version: see `.nvmrc` (v24)
- **Playwright is the only test runner. There is no unit test runner, linter, or formatter.** Do not invent commands beyond the ones listed here.

## Testing

E2E tests live in `e2e/` and run against a real browser. Read `e2e/README.md` before writing
one. The short version:

- The game is a canvas, so there is nothing in the DOM to assert on. `src/game/harness.js`
  exposes arrangement verbs on `window.__asteroides` and `e2e/fixtures.mjs` wraps them.
- The pattern is freeze, arrange, step, snapshot, assert. Every frame comes from an explicit
  `a.step()`. Never write a test that waits and then checks: asteroids drift, the ship dies, and
  a shot crosses the whole canvas in under a second.
- Specs call verbs (`a.putAsteroidsOnShip(2)`), never fields. If a test needs something the
  harness cannot express, add a verb rather than reaching into the game from the spec.
- Add the verb name to `VERBS` in `e2e/fixtures.mjs` or it will not be callable.
- The harness attaches only in a development build loaded with `?e2e=1`. See the invariant in
  ARCHITECTURE.md before touching that check.

## Code Style

- Plain ES6+ JavaScript, no TypeScript. Do not add `.ts`/`.tsx` files.
- 2-space indentation, double-quoted strings (match existing files — no Prettier config exists).
- Class-based OOP for game entities. PascalCase classes, camelCase methods/variables.
- ES module imports (`import`/`export`). `.babelrc` has `"modules": false` so Webpack can tree-shake — **do not** add `require()` syntax.

## p5.js Usage (CRITICAL)

- This project uses **p5 instance mode**, not global mode. The p5 instance is created in `src/index.js` and passed into every class constructor as `p5`. Inside classes, always call `this.p5.line(...)`, never the bare `line(...)`.
- `p5.sound` is loaded via `import "p5/lib/addons/p5.sound"` in `src/index.js`. Sound effects go through `SoundManager`, not raw `p5.SoundFile`.
- The Webpack `ProvidePlugin` only injects `p5` into the constructor at module init; it does NOT make p5 functions globally callable inside classes.

## Asset Loading

- Import images, fonts, and sounds through ES imports (`import font from "./font/x.ttf"`). Webpack's `type: "asset"` rule handles them.
- **Never** reference assets via string URLs, `public/`, or `require()` — they will not be bundled.
- Assets live in `src/images/`, `src/font/`, `src/sounds/`.

## Project Structure

- `src/index.js` — p5 instance bootstrap, asset preloading, global game state holder
- `src/game/game.js` — central Game controller (one instance per level)
- `src/game/elements/` — game entities (Ship, Asteroids, Shot, Debris) and visual elements (Background, Stars, Score, Life)
- `src/game/state/` — screen state classes (StartMenuScreen, GameOverScreen, LevelUpScreen)
- `src/game/soundManager.js` — wraps p5.sound with reverb effects
- `src/game/helpers.js` — viewport sizing, polygon drawing, vector utilities
- `src/css/`, `src/font/`, `src/images/`, `src/sounds/` — assets

See **ARCHITECTURE.md** for the module map and game-loop invariants.

## Gotchas

- **A cleared level, a game over and a return to the menu reconstruct the Game**. `resetSketch()` in `index.js` builds a new `Game` around the long-lived `Run`, which carries the score, the lives and the level across. Do not try to "soft reset" those three paths by mutation, follow the reconstruction pattern. A death is the exception: it keeps the surviving asteroids, so it rebuilds only the ship, in place. See the invariants in ARCHITECTURE.md.
- **Arrow keys and space are blocked at the document level** (`window.top.document.onkeydown` in `index.js`) to prevent page scroll. If you change input handling, preserve this guard or shooting/movement will scroll the page.
- **`p5.windowResized` rebuilds the Background**. Any class that caches canvas dimensions must also rebuild on resize, or it will desync after a window resize.
- **Class-based state is mutated in `draw()` each frame** (60fps). Allocating new objects inside `draw()` (especially Vector instances) creates GC pressure — reuse instances when possible.

## Workflow

- Single branch (`main`). Pushing it deploys to Vercel, so a push is a release. The `gh-pages` remote branch is a dead deploy target kept for history: nothing should push to it, and Vercel fails every preview build it triggers because that branch carries no lockfile.
- Commit style observed: short, lowercase imperative ("add explosion", "fix levels", "bump dependencies"). No conventional-commit prefix is required.
- No PR template, no CI. Solo project — keep it simple.

## Controls (for testing)

Defined by `KEY_MAP` in `src/game/input.js`. Change them there, not here.

- Thrust: `W` or up arrow
- Brake: `S` or down arrow
- Rotate left: `A` or left arrow
- Rotate right: `D` or right arrow
- Shoot: space or enter
- Confirm (start menu, level-up, game-over restart): space or enter

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `neburnodrog/asteroides-v2`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root plus ADRs under `docs/adr/`. See `docs/agents/domain.md`.
