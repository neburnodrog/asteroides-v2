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
