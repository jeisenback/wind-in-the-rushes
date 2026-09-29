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

## Fighting styles

A style is a 12-card deck list. You pick yours; the AI picks at random. Both
styles are shown, so you know the enemy's card mix.

| Style | Hawk | Needle | Gate | Willow | Mist | Sparrow | Crane | Blade |
|---|---|---|---|---|---|---|---|---|
| Balanced | 2 | 2 | 2 | 1 | 2 | 1 | 1 | 1 |
| Storm (Strike-heavy) | 3 | 3 | 1 | 1 | 1 | 2 | 0 | 1 |
| Stone (Guard-heavy) | 1 | 1 | 3 | 2 | 1 | 2 | 1 | 1 |
| Stream (Flow-heavy) | 1 | 1 | 1 | 1 | 3 | 3 | 1 | 1 |

The styles form their own triangle: Stone beats Storm, Storm beats Stream,
Stream beats Stone (about 55-60% each, random play). Every style sits between
47% and 52% overall.

## Weapons

A weapon adds to or subtracts from the damage of whole families. Special
cards are never modified. You pick yours; the AI picks at random.

| Weapon | Strike | Guard | Flow |
|---|---|---|---|
| Sword | 0 | 0 | 0 |
| Greatblade | +1 | 0 | -1 |
| Staff | -1 | +2 | 0 |
| Twin Knives | 0 | -1 | +1 |

Each weapon averages 49-51% across all loadouts. Matching a weapon to your
style pays off (Stone + Staff about 62%, Storm + Greatblade about 58%);
mismatching costs (Storm + Staff about 40%).

## Balance

Average net damage of each card against a random card from the Balanced deck
(first pass, from simulation): regular cards all sit between -0.6 and +0.6,
Crane about +0.8, Broken Blade about +1.5. Games run about 8 rounds and
almost always end on HP, not on empty hands.

## AI (v1)

Random card from hand, weighted 3:1 toward cards that beat the family you played last.

## Later, not now

- AI that reads your discard pile
