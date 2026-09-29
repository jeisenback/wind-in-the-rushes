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

| Card | Family | Dmg | Posture | Effect |
|---|---|---|---|---|
| Falling Hawk | Strike | 4 | 4 | A heavy blow that staggers |
| Quick Needle | Strike | 2 | 2 | Wins Strike ties instead of trading |
| Iron Gate | Guard | 2 | 2 | Take 1 less damage if this loses |
| Willow Bends | Guard | 3 | 3 | A deflect and counter |
| Mist on the Pond | Flow | 2 | 2 | Wins Flow ties |
| Sparrow Turns | Flow | 4 | 2 | A feint that cuts deep |
| Crane in Still Water | Special | 7 | 5 | Beats any Strike, crushing posture. Loses to everything else |
| Broken Blade | Special | 8 | 0 | Only at 10 HP or less. Take the enemy hit plus 4, then deal 8 |

## Posture

Borrowed from Sekiro. Each fighter has a posture bar of 8.

- Losing a clash adds the winning card's posture value to your bar. A Strike trade fills both bars. Broken Blade deals no posture.
- A round where you take no posture recovers 1.
- A full bar breaks your guard: you take a 5-damage deathblow and the bar resets to 0.

## Desperation

At 10 HP or less (half of starting HP) you are desperate, which gives you two
tools:

- **Clarity:** each round, one random card in the enemy hand is revealed to
  you. The AI gets the same when it is desperate, and plays the best counter
  to the card it sees (never Broken Blade, which ignores what it meets). Your
  card the enemy can see is marked.
- **Broken Blade** unlocks. It is also playable if it is the last card in
  your hand.

An information boost was chosen over a damage boost (Tekken-style rage).
In simulation, +1 or +2 damage when desperate lifted comebacks only to 13-15%,
while making a lead feel fragile. Stopping posture recovery at low HP had no
measurable effect, so that rule was dropped.

## Simulation (1,000 AI-vs-AI games, random loadouts)

With Broken Blade locked, Clarity in, and Sparrow Turns at 4 damage: games
run about 8.8 rounds, 88% have at least one guard break, and 20% end on a
deathblow. The fighter who drops to half HP first comes back to win about 18%
of the time (10% without Clarity). Broken Blade decides 7% of rounds.

Regular cards sit between -0.45 (Quick Needle) and +0.26 (Willow Bends) HP
per play. Sparrow Turns moved from -0.53 to -0.18 when its damage went from
3 to 4. Loadouts range from about 41% (Storm + Staff, Stone + Sword) to 63%
(Stone + Staff).

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
Stream beats Stone (random play). With posture, every style sits between 48%
and 53% overall.

## Weapons

A weapon adds to or subtracts from the damage of whole families. Special
cards are never modified. You pick yours; the AI picks at random.

| Weapon | Strike | Guard | Flow |
|---|---|---|---|
| Sword | 0 | 0 | 0 |
| Greatblade | +1 | 0 | -1 |
| Staff | -1 | +2 | 0 |
| Twin Knives | 0 | -1 | +1 |

Each weapon averages about 50% across all loadouts. Matching a weapon to your
style pays off and mismatching costs; with posture, loadouts range from about
43% to 57%.

## Balance

Average net damage of each card against a random card from the Balanced deck
(first pass, before posture): regular cards all sit between -0.6 and +0.6,
Crane about +0.8, Broken Blade about +1.5. Games almost always end on HP,
not on empty hands.

## AI (v1)

Random card from hand, weighted 3:1 toward cards that beat the family you played last.

## Later, not now

- AI that reads your discard pile
