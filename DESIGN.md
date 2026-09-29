# Wind in the Rushes

A card-based rock-paper-scissors duel between swordmasters. One player against an AI.

Play: open `index.html` in a browser. Tests: `node --test`.

## Round

1. Each fighter has a 12-card deck and a hand of 4. Both start at 20 HP.
2. Both play one card face down, then reveal.
3. The winner deals their card's damage.
4. Both draw back up to 4.
5. The game ends when a fighter hits 0 HP or a hand is empty. The higher HP wins.

The enemy's hand is hidden. Both discard piles are public.

## Family triangle

- Strike beats Flow
- Flow beats Guard
- Guard beats Strike

Ties: Strike vs Strike trades (both deal damage). Guard vs Guard and Flow vs Flow do nothing.

## Cards

| Card | Family | Dmg | Effect |
|---|---|---|---|
| Falling Hawk | Strike | 4 | A heavy blow |
| Quick Needle | Strike | 2 | Wins Strike ties instead of trading |
| Iron Gate | Guard | 2 | Take 1 less damage if this loses |
| Willow Bends | Guard | 3 | Counterattack. Nothing on a tie |
| Mist on the Pond | Flow | 2 | Wins Flow ties |
| Sparrow Turns | Flow | 3 | A reliable feint |
| Crane in Still Water | Special | 7 | Beats any Strike. Loses to everything else |
| Broken Blade | Special | 8 | Take the enemy hit plus 4, then deal 8 |

Starter deck: Hawk x2, Needle x2, Gate x2, Willow, Mist x2, Sparrow, Crane, Blade.

## Balance

Average net damage of each card against a random card from the starter deck
(first pass, from simulation): regular cards all sit between -0.6 and +0.6,
Crane about +0.8, Broken Blade about +1.5. Games run about 8 rounds and
almost always end on HP, not on empty hands.

## AI (v1)

Random card from hand, weighted 3:1 toward cards that beat the family you played last.

## Later, not now

- Fighting styles as different deck lists
- Weapons as per-family damage modifiers
- AI that reads your discard pile
