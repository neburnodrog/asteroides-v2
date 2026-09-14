# Collision follows the drawn shape

The ship was a 20px disc sitting 5px behind its own origin and an asteroid was its circumcircle.
Neither shape was drawn anywhere. Since the hull landed the gap was visible: the game showed
polygons and killed with circles, and an asteroid's corner killed at the same distance as the
empty air beside it.

We decided the shapes that are drawn are the shapes that collide. The hull collides as the two
triangles its tail notch forces it into, because a quad with one reflex vertex has exactly one
interior diagonal. The asteroid collides as its rotated n-gon, inflated by half its stroke width
so the pixels on screen are the pixels that kill. A circle broad phase runs first, and the test
substeps along the frame's motion when the pair closed far enough that contact could fall
between two frames.

Movement moved out of `draw()` into `step()` in the same change. With entities advancing
themselves during rendering, every check in `playGame` judged the previous frame, which the 20px
pad had been hiding and exact geometry would have made visible as a frame of overlap the ship
survived.

The kill test and the ghost's exit test stopped being the same question. Killing asks whether the
shapes touch. The ghost asks whether it is safe to become solid, and measures the same geometry
with 10px of clearance.

The ship reaches 30px forward where the disc reached 15, so head on deaths land 11 to 19px
earlier against a big asteroid while flank and rear deaths land 1 to 9px later. That is accepted:
the nose is drawn out to 30, so it kills at 30.

## Considered options

Inflating the hull by 2px so a touching stroke reads as a hit. Rejected because pushing a reflex
vertex outward closes the notch and makes the two triangles overlap each other, which is a harder
problem than the collision test. The allowance is taken on the asteroid instead, where the shape
is convex and the offset is one multiply. The hull under reaches by the 1px of its own stroke,
knowingly.

Colliding the hull's convex hull instead of splitting it, which would have kept one polygon.
Rejected because it reintroduces an invisible fudge in the one orientation players least expect,
a tail first asteroid killing a few pixels early.

Keeping the asteroid a circle and only making the ship exact. Rejected because it leaves the
corners phantom and leaves the shot test disagreeing with the ship test about where an asteroid
ends.

True swept collision with a time of impact. Rejected as real work for a game where the wrong
answer costs one life; substepping the test is bounded and leaves the physics alone.

Wrap aware collision at the screen seam. Rejected because neither entity draws a duplicate copy
at the edge, so no pair can look like it touches across it.

## Correction: the substep budget and the ship's speed

This ADR was written against a terminal ship speed of 50px per frame, a figure the plan asserted
and nobody measured. The ship tops out at 5.88px per frame: thrust is added only while speed is
under 5, and 2% resistance holds it at (5 + 1) * 0.98. A shot travels 15px per frame plus the
ship's speed when it was fired, so 20.88px at most, and an S asteroid closes at up to 7.07px.
The worst relative step in the game is therefore under 28px against a rock 40px across.

Two consequences. The ship's substep loop guards against a future speed change rather than a
reachable defect, since at 5.88px per frame the ship cannot cross an asteroid within a frame.
And `MAX_SUBSTEPS` of 8 is never approached in play, where two samples suffice.

The shot test was left unsampled in the original change, which left `collisions.js` holding two
answers to what a frame is. A shot that entered and left a small asteroid between two frames
scored nothing, an effect confined to grazing shots: against the smallest asteroid an impact
parameter between 21.63 and 26.66px crosses a chord shorter than one frame's travel. Both tests
now sample the frame the same way, through one `substepsFor`, and both suppress sampling for a
pair where the asteroid wrapped. A shot needs no wrap flag of its own: it is filtered out at the
canvas edge rather than wrapped, so it has no teleporting frame.

Sampling narrows that window rather than closing it. The substep count is sized by the asteroid's
radius, which bounds how much of a rock a step may skip, not how thin a chord may be: against the
smallest asteroid a 20.88px step is read at 3 places, 6.96px apart, so a chord shorter than that
still falls between two samples. What is left is an impact parameter between 24.98 and 26.66px,
the outermost 1.7px of the smallest rock in the game. Closing it needs segment against polygon
rather than a denser sample, and it was not worth the exact test for 1.7px.
