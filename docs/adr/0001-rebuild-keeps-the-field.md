# Rebuild after a death keeps the surviving asteroids

A rebuild after a death used to start the level over with a fresh set of asteroids, which
punished the player twice. We decided the field persists and the ship comes back into a
clearing: a 300 pixel circle with no asteroid inside and none due to enter within a second and
a half, chosen as the point on the canvas with the longest time to the first threat. Asteroids
fly in straight lines at constant speed, so the test is an exact prediction, not a guess.

## Considered options

Always come back at the centre and wait for it to clear, as the arcade original does. Rejected
because a dense field at high levels can leave the centre unsafe for a long time, which needs a
capped wait plus a fallback that tightens the margin. One rule that always terminates beat a
rule plus a fallback.

Brief invulnerability after the rebuild. Rejected because the clearing is meant to be the only
protection, and a ship that cannot die teaches players to ignore the field.
