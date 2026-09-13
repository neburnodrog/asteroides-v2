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
The sequence from the ship exploding to the ship becoming killable again: an absence, then a
ghost. It costs one life.
_Avoid_: dying, respawn delay, death timer

**Absence**
The 120 frames after the ship explodes, with no ship on the canvas. The field keeps drifting and
no press is read.
_Avoid_: death timer, wait, pause

**Ghost**
The 120 frames after an absence. The ship is back at its return point and can be flown, but it
cannot be hit and it cannot shoot. It blinks faster and fades in as the time runs out.
_Avoid_: invulnerability, spawn protection, immunity

**Grace**
A fixed 60 frame extension of a ghost, triggered when an asteroid overlaps the ship at the moment
the ghost would end. It runs its full length whatever happens next. An overlap still present at
the end of a grace kills.
_Avoid_: grace period, extension, mercy

**Return point**
The place a ghost appears, which is the place the ship died.
_Avoid_: spawn, spawn point, respawn point

**Rebuild**
The point where play restarts inside a run, after a death or after a cleared level. The score,
the lives and the level survive a rebuild. After a death the surviving asteroids survive too,
and the ship comes back at its return point as a ghost. After a cleared level the next level
starts fresh.
_Avoid_: reset, restart, respawn. A reset ends the run and starts a new one.

### The record

**High score table**
The ten best runs on this browser, best first. It outlives every run and survives closing the
tab. The start menu lists all of it, in columns of five.
_Avoid_: leaderboard, scoreboard, high scores. A scoreboard is the strip on the top of the
canvas during play.

**Entry**
One finished run in the table: the score it reached and the level it reached.
_Avoid_: record, row, result

**Qualifying score**
A score that earns a place. Any score above zero qualifies while the table holds fewer than ten
entries; after that it has to beat the tenth outright. A score equal to an entry does not
displace it.
_Avoid_: high enough, good enough

**Rank**
The place a finished run took in the table, counted from 1. A run that did not qualify has no
rank. The game over screen names it when there is one.
_Avoid_: position, place, index

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
The empty circle at the canvas centre that a new level starts with. It applies to a new level
only. A death protects the ship with a ghost instead.
_Avoid_: safe zone, spawn exclusion, buffer

### On screen

**Scoreboard**
The strip along the top of the canvas showing the score and the remaining lives.
_Avoid_: HUD, status bar, overlay

**Screen**
A full canvas state the player reads instead of playing: the start menu, the level up screen and
the game over screen. Every screen waits on one confirm press.
_Avoid_: menu, view, page

**Hull**
The ship's outline: four vertices in local coordinates, nose first, filled with the same magenta
the shots and the debris use. Drawn, not a sprite. Collision does not read it yet.
_Avoid_: sprite, ship image, model

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
just before the two shapes visually touch. Hand tuned.
_Avoid_: margin, tolerance, fudge
