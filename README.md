# Wind in the Rushes

A card duel between swordmasters. You and an AI opponent each play a sword form
face down, then reveal. Read your opponent, choose the right form, and break
their guard.

**Play in your browser:** https://jeisenback.github.io/wind-in-the-rushes/

## How to play

- **Strike beats Flow, Flow beats Guard, Guard beats Strike.** The winning card
  deals its damage.
- **Posture:** losing a clash fills your posture bar. A full bar breaks your
  guard for a 5-damage deathblow.
- **Desperation:** at 10 HP or less you gain Clarity (one enemy card is revealed
  each round) and Broken Blade joins your hand. The enemy gets the same.
- **Loadout:** before the fight, pick a fighter (each fighter's style is your
  deck), a weapon (bonuses and penalties by family) and two single-use items.
- Each round plays out on a duel stage; tap it to skip.
- The fight ends when someone reaches 0 HP.

Every clash shows the rule that decided it and how each number adds up.

## Run it locally

No build step and no dependencies. Open `index.html` in a browser.

## Tests

Requires Node.js 18 or later:

```sh
node --test
```

## Balance simulation

```sh
node tools/simulate.js 1000            # 1,000 AI-vs-AI games
node tools/simulate.js 3000 --seed 7   # more games, another seed
```

Both sides use the game's AI with random styles, weapons and items. The report
covers win rates by style, weapon, item and loadout, each card's average HP
swing per play, how games end, and how often the first fighter to reach half HP
still wins. A fixed seed repeats the same games, so you can change a value in
`game.js` and compare like for like.

## Project layout

| File | What it holds |
|---|---|
| `game.js` | Rules, cards, styles, weapons, items and the AI. No DOM access, so it runs in Node for tests. |
| `index.html` | The page: layout, styles and rendering. |
| `test/game.test.js` | Rule and AI tests. |
| `tools/simulate.js` | The balance simulation. |
| `DESIGN.md` | Design notes and the simulation results behind the balance numbers. |

## License

[MIT](LICENSE)
