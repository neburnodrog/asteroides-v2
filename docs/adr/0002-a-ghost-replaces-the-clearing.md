# A ghost replaces the clearing

Supersedes ADR-0001.

ADR-0001 made the clearing the only protection after a death and rejected invulnerability
outright. Verification in a browser found the clearing does not hold. At 1280x720 a level 8
death ran 484 frames and still returned the ship to a point an asteroid reached 10 frames
later, and on a 520x420 canvas with a slow field the search returned null forever and the ship
never came back. `findClearing` disqualifies only the candidates occupied on the current frame
and then returns the best of the rest, so the guarantee degrades to nothing exactly where the
field is densest.

We decided the ship comes back at the point it died, as a ghost: 120 frames during which it can
be flown but cannot be hit, blinking from a 20 frame interval down to 4 and fading in from 0.25
opacity to 1.0, both linear in time remaining. A ghost cannot shoot. If an asteroid overlaps the
ship at the moment the ghost would end, the ghost extends by a fixed 60 frames, and an overlap
still present at the end of that kills. `src/game/clearing.js` is deleted.

ADR-0001's argument was that a ship which cannot die teaches players to ignore the field. That
argument assumed a silent grace period. The ghost is the opposite: the blink and the fade both
accelerate toward the moment of mortality, so the player is told exactly how long they have and
watches the protection run out. Removing the ability to shoot keeps the ghost a window for
escape rather than a window for free kills.

## Considered options

Deferring the ghost's expiry for as long as the ship overlaps anything. Rejected because a
player who never moves would never become killable, and a fixed extension is both bounded and
assertable from a spec.

Keeping the clearing search and fixing it, by falling back to a smaller radius when no candidate
survives the whole look ahead. Rejected because it leaves two mechanisms protecting one moment,
and the ghost already covers the case the search was for.

An accelerating beep that becomes a sustained tone. Rejected on cost. `SoundManager` is two
one-line methods with no rate, volume or loop argument, nothing in the codebase plays a sound
that varies over time, and sound needs a user gesture the headless browser will not give, so the
cue could never be asserted in the Playwright suite. The blink and the fade carry the same
information where a spec can check it.

## Consequences

The return point is stored in canvas coordinates and nothing revalidates it on a resize, so
shrinking the window during a death can leave it off the canvas. We accept this rather than
clamp it.

A death at the end of a ghost is an ordinary death. It costs a life and starts an absence and a
ghost again at the same point, so a near-stationary large asteroid parked on the return point can
take several lives in a row. Per-axis asteroid velocity is uniform in [-2, 2] for the large size,
which puts this at roughly one death in a hundred.

Nothing reports whether the ship is still inside an asteroid during the extension. The asteroid
is drawn at the same place, so the screen shows it, but no signal states it.
