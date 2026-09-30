# Wind in the Rushes

A card-based rock-paper-scissors duel between swordmasters. One player against an AI.

Play: open `index.html` in a browser. Tests: `node --test`.
Balance numbers in this document come from `node tools/simulate.js` (see the README).

## Round

1. Each fighter has an 11-card deck (plus Broken Blade in reserve), a hand of 4,
   and a belt of 2 single-use items. Both start at 20 HP.
2. Both play one card face down, optionally with one item, then reveal.
3. The winner deals their card's damage.
4. Both draw back up to 4.
5. When a deck runs out, that fighter's discard pile is shuffled into a new deck.
6. The game ends when a fighter reaches 0 HP. If both do in the same round, the higher HP wins.

The enemy's hand is hidden. Both discard piles are public.

## Family triangle

- Strike beats Flow
- Flow beats Guard
- Guard beats Strike

Ties: Strike vs Strike trades (both deal damage). Guard vs Guard and Flow vs Flow do nothing.

## Cards

| Card | Family | Dmg | Posture | Effect |
|---|---|---|---|---|
| Falling Hawk | Strike | 4 | 4 | A braced, heavy blow. Take 1 less damage if this loses |
| Quick Needle | Strike | 2 | 2 | Wins Strike ties instead of trading |
| Iron Gate | Guard | 2 | 2 | Take 1 less damage if this loses |
| Willow Bends | Guard | 3 | 3 | A deflect and counter |
| Mist on the Pond | Flow | 2 | 2 | Wins Flow ties |
| Sparrow Turns | Flow | 4 | 2 | A feint that cuts deep |
| Crane in Still Water | Special | 7 | 5 | Beats any Strike, crushing posture. Loses to everything else |
| Broken Blade | Special | 8 | 0 | Held in reserve; joins your hand at 10 HP or less. Take the enemy hit plus 4, then deal 8 |

## Posture

Borrowed from Sekiro. Each fighter has a posture bar of 8.

- Losing a clash adds the winning card's posture value to your bar. A Strike trade fills both bars. Broken Blade deals no posture.
- A round where you take no posture recovers 1.
- A full bar breaks your guard: you take a 5-damage deathblow and the bar resets to 0.

## Desperation

At 10 HP or less (half of starting HP) you are desperate, which gives you two
tools:

- **Clarity:** each round, one random card in the enemy hand is revealed to
  you. The AI gets the same when it is desperate. Your card the enemy can see
  is marked.
- **Broken Blade** joins your hand. It starts in reserve, outside the deck,
  so it never sits in your hand as a card you cannot play. Whether a fighter's
  Blade is still in reserve is public.

An information boost was chosen over a damage boost (Tekken-style rage).
In simulation, +1 or +2 damage when desperate lifted comebacks only to 13-15%,
while making a lead feel fragile. Stopping posture recovery at low HP had no
measurable effect, so that rule was dropped.

## Items

Each fighter carries a belt of 2 different items, chosen with style and weapon
(random for the AI). Each is used once. You commit an item face down with your
card and both are revealed together, so an item is part of your read, not a
reaction to it. Belts and used items are public.

| Item | Effect |
|---|---|
| Healing Gourd | Heal 4 HP |
| Calming Tea | Clear 4 posture before the clash |
| Smoke Bomb | If you lose this round, take no damage or posture |
| Battle Tonic | +3 damage if your card wins |
| Throwing Knife | Deal 2 damage no matter what |
| Firecracker | The enemy takes 3 posture no matter what |

The AI scores every card with and without each remaining item. Each item has a
`keep` value (roughly what it is worth on an ordinary round), and the AI only
spends it when using it now beats that by a real margin, so it saves the Knife
for a finishing blow and the Gourd for danger.

Tuning (3,000 AI-vs-AI games per variant, random belts): with the first values,
fighters carrying Battle Tonic (+2) won 44% and Healing Gourd (heal 5) 56%.
Tonic +3 and Gourd 4 brought every item between 47% and 54%. Items shorten
games slightly (about 8.8 rounds) and leave style balance intact (47-52%).

## Duel stage

Each round plays out on a stage above the result: two ink-silhouette fighters
act out the cards (Strike lunges, Guard braces, Flow sidesteps, Crane in Still
Water lifts into a one-legged counter, Broken Blade rushes all in), the loser
recoils, damage floats up, and a guard break slumps the fighter under a brush
stroke. Items have their own effects (a thrown knife, smoke, a firecracker
burst, healing and posture numbers). The rest of the page updates at the moment
of contact, so the numbers never give the result away early. A scene lasts
about a second; tapping the stage skips it, and reduced motion skips the
movement. It is presentation only: the rules and balance are unchanged.

Each fighting style is a character, and the weapon is drawn in their hands:

| Style | Character | Look |
|---|---|---|
| Balanced | The Wanderer | Wide straw hat |
| Storm | The Tempest | Headband with trailing tails |
| Stone | The Sentinel | Crested helmet, broad shoulder plates |
| Stream | The Dancer | Long ponytail, slimmer build |

## Fighting styles

A style is a 12-card list (11-card deck plus Broken Blade). You pick yours; the AI picks at random. Both
styles are shown, so you know the enemy's card mix.

| Style | Hawk | Needle | Gate | Willow | Mist | Sparrow | Crane | Blade |
|---|---|---|---|---|---|---|---|---|
| Balanced | 2 | 2 | 2 | 1 | 2 | 1 | 1 | 1 |
| Storm (Strike-heavy) | 2 | 3 | 1 | 1 | 1 | 3 | 0 | 1 |
| Stone (Guard-heavy) | 1 | 1 | 3 | 2 | 1 | 2 | 1 | 1 |
| Stream (Flow-heavy) | 1 | 1 | 1 | 1 | 3 | 3 | 1 | 1 |

With random play the styles formed their own triangle (Stone beats Storm,
Storm beats Stream, Stream beats Stone). Current style numbers are under AI.

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
style pays off and mismatching costs.

## Balance

Average net damage of each card against a random card from the Balanced deck
(first pass, before posture): regular cards all sit between -0.6 and +0.6,
Crane about +0.8, Broken Blade about +1.5.

## AI

The AI predicts the player's next card from public information only: the
player's style (so their full card list), their discards, their hand size,
whether their Broken Blade is still in reserve, and any card Clarity reveals.
It never looks at the player's hand.

It scores each card in its own hand by expected value against that prediction:
HP difference, posture difference at half weight, guard breaks (5), and lethal
blows (20). It then picks with a softmax (temperature 1) rather than always
taking the top score, so it stays hard to read.

Head to head over 2,000 games with random loadouts, it beats the previous AI
(weighted toward beating your last family) about 58% of the time, and random
play about 64%. The temperature and posture weight barely changed that.

With both sides using this AI, Falling Hawk fell to about -0.7 HP per play
and Storm to 41-43%: an opponent that counts cards answers a Strike-heavy
deck with Guards. Extra damage or posture on Hawk did not help (it just gets
blocked). Two changes fixed it:

- Falling Hawk is braced: it takes 1 less damage when it loses.
- Storm trades a Hawk for a third Sparrow Turns, so it has more Flow to punish
  the Guards it draws out.

Current numbers (1,000 AI-vs-AI games, reshuffling decks): games run about 9.4
rounds, 13% end on a deathblow, none end on empty hands. Regular cards sit
between -0.22 and +0.36 HP per play. Styles sit between 48% and 54% (3,000
games). The fighter who drops to half HP first comes back about 12% of the
time.

## Later, not now

- An AI that learns a player's habits across games
