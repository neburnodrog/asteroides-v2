# ASTEROiDES

An Asteroids arcade clone. This glossary fixes the words the code and the docs use for the
things a player experiences. It is a glossary, not a spec. Structure lives in `ARCHITECTURE.md`.

## Language

### The run

**Run**
One attempt at the game, from the first press of start to game over. A run carries the score,
the lives and the level across every death and every new wave.
_Avoid_: session, game, playthrough

**Level**
One wave of asteroids. A level starts with two `X` asteroids per level number and is cleared when
no asteroids remain. The level number sets how many asteroids there are; asteroid size sets how
fast they move.
_Avoid_: wave, stage, round

**Life**
One ship the player still has. The count includes the ship in play, so the run ends on the death
that takes it to zero.
_Avoid_: spare, chance, heart. A heart is the picture of a life, not the life itself.

**Death**
The time from the ship exploding to the rebuild: at least three seconds, then until a clearing
exists. The field keeps drifting, the ship cannot act, and no press is read. The last half
second shows where the ship will come back.
_Avoid_: dying, respawn delay, death timer

**Rebuild**
The point where play restarts inside a run, after a death or after a cleared level. The score,
the lives and the level survive a rebuild. After a death the surviving asteroids survive too,
and the ship comes back inside a clearing. After a cleared level the next level starts fresh.
_Avoid_: reset, restart, respawn. A reset ends the run and starts a new one.

### Flying

**Thrust**
Acceleration along the ship's heading. Thrust is the only thing that leaves a trace.
_Avoid_: boost, accelerate, forward

**Brake**
Thrust against the ship's heading. It slows the ship and, held long enough, sends it backwards.
_Avoid_: reverse, stop, decelerate

**Wrap**
The ship or an asteroid leaving one edge of the canvas re-enters from the opposite edge. Shots
do not wrap: a shot that leaves the canvas is gone.
_Avoid_: overflow, toroidal, teleport

**Clearing**
A 300 pixel circle the ship comes back into, with no asteroid inside it and none due to enter
it within the next second and a half. A new level clears the canvas centre; a rebuild after a
death picks the point on the canvas with the longest time to the first threat. The clearing is
the only protection the ship gets; there is no invulnerability.
_Avoid_: safe zone, spawn exclusion, buffer

### On screen

**Scoreboard**
The strip along the top of the canvas showing the score and the remaining lives.
_Avoid_: HUD, status bar, overlay

**Screen**
A full canvas state the player reads instead of playing: the start menu, the level up screen and
the game over screen. Every screen waits on one confirm press.
_Avoid_: menu, view, page

**Debris**
The short lived fragments thrown off when an asteroid breaks or the ship explodes. They are
drawn, they fade, they collide with nothing.
_Avoid_: particle, fragment, shard

**Trace**
The coloured puff left behind the ship while thrusting. Shorter lived than debris and tied to
the ship rather than to an explosion.
_Avoid_: exhaust, trail, smoke

### Collisions

**Asteroid size**
One of three: `X`, `M`, `S`. Size decides the radius, the speed, the points awarded and what an
asteroid breaks into. `X` breaks into two `M`, `M` breaks into two `S`, `S` breaks into nothing.
Smaller is faster and worth more: top speeds of about 3, 5 and 7 pixels per frame, and
points 20, 50, 75.
_Avoid_: large, medium, small as identifiers. The letters are the names.

**Hit pair**
One shot overlapping one asteroid on one frame. A frame can produce several, and one shot can
appear in more than one pair.
_Avoid_: collision, impact

**Hitbox padding**
The 20 pixels added to an asteroid's radius when testing it against the ship, so the ship dies
just before the sprites visually touch. Hand tuned.
_Avoid_: margin, tolerance, fudge
