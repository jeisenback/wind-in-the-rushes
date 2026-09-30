// Balance simulation: AI-vs-AI games with random loadouts and item belts.
//
//   node tools/simulate.js [games] [--seed N]
//
// Both seats use the game's own AI. The seed makes a run repeatable, so a rules
// change can be compared against the same sequence of games. To try a variant,
// edit the values in game.js and run again.

const g = require('../game.js');

const args = process.argv.slice(2);
const games = Number(args.find((a) => /^\d+$/.test(a))) || 1000;
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 2026;

// Small seeded random number generator (mulberry32).
function seeded(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = seeded(seed);
const pick = (list) => list[Math.floor(rng() * list.length)];

const styleIds = Object.keys(g.STYLES);
const weaponIds = Object.keys(g.WEAPONS);
const itemIds = Object.keys(g.ITEMS);

function randomLoadout() {
  const belt = [pick(itemIds)];
  while (belt.length < g.BELT_SIZE) {
    const item = pick(itemIds);
    if (!belt.includes(item)) belt.push(item);
  }
  return { style: pick(styleIds), weapon: pick(weaponIds), belt };
}

// The AI plays the "ai" seat; this gives the player seat the same AI.
const playerView = (s) => ({ ai: s.player, player: s.ai, clarity: { ai: s.clarity.player } });

const results = { player: 0, ai: 0, draw: 0 };
const endings = { damage: 0, deathblow: 0 };
const cards = {};
const tally = { style: {}, weapon: {}, item: {}, loadout: {} };
let rounds = 0;
let longest = 0;
let behindGames = 0;
let comebacks = 0;

const add = (table, key, score) => {
  const t = (table[key] ||= { games: 0, score: 0 });
  t.games++;
  t.score += score;
};

for (let i = 0; i < games; i++) {
  const loadouts = { player: randomLoadout(), ai: randomLoadout() };
  const s = g.newGame(loadouts.player, loadouts.ai, rng);
  let firstDesperate = null;

  while (!s.over) {
    const pm = g.aiMove(playerView(s), rng);
    const am = g.aiMove(s, rng);
    g.playRound(s, pm.card, am.card, rng, { player: pm.item, ai: am.item });

    const L = s.last;
    for (const [card, took, dealt] of [[L.player, L.toPlayer, L.toAi], [L.ai, L.toAi, L.toPlayer]]) {
      const c = (cards[card] ||= { played: 0, won: 0, lost: 0, net: 0 });
      c.played++;
      c.net += dealt - took;
      if (dealt > took) c.won++;
      else if (took > dealt) c.lost++;
    }
    if (!firstDesperate) {
      const p = s.player.hp <= g.START_HP / 2;
      const a = s.ai.hp <= g.START_HP / 2;
      if (p !== a) firstDesperate = p ? 'player' : 'ai';
      else if (p && a) firstDesperate = 'both';
    }
  }

  results[s.winner]++;
  rounds += s.round - 1;
  longest = Math.max(longest, s.round - 1);
  endings[s.last.pBroke || s.last.aBroke ? 'deathblow' : 'damage']++;
  if (firstDesperate === 'player' || firstDesperate === 'ai') {
    behindGames++;
    if (s.winner === firstDesperate) comebacks++;
  }
  for (const side of ['player', 'ai']) {
    const score = s.winner === side ? 1 : s.winner === 'draw' ? 0.5 : 0;
    const l = loadouts[side];
    add(tally.style, g.STYLES[l.style].name, score);
    add(tally.weapon, g.WEAPONS[l.weapon].name, score);
    for (const item of l.belt) add(tally.item, g.ITEMS[item].name, score);
    add(tally.loadout, `${g.STYLES[l.style].name} + ${g.WEAPONS[l.weapon].name}`, score);
  }
}

const pct = (n, d) => `${(n / d * 100).toFixed(1)}%`;
const print = (title, table) => {
  console.log(`\n${title} (win rate, games)`);
  for (const [k, t] of Object.entries(table).sort((a, b) => b[1].score / b[1].games - a[1].score / a[1].games)) {
    console.log(`  ${k.padEnd(26)} ${pct(t.score, t.games).padStart(6)}  ${String(t.games).padStart(5)}`);
  }
};

console.log(`${games} games, seed ${seed}`);
console.log(`Seats: player ${results.player}, enemy ${results.ai}, draws ${results.draw}`);
console.log(`Rounds: ${(rounds / games).toFixed(1)} on average, longest ${longest}`);
console.log(`Endings: ${pct(endings.deathblow, games)} on a deathblow`);
console.log(`Comebacks: first to half HP still won ${pct(comebacks, behindGames)} of ${behindGames} games`);

console.log('\nCards (won, lost, average HP swing per play)');
for (const [id, c] of Object.entries(cards).sort((a, b) => b[1].net / b[1].played - a[1].net / a[1].played)) {
  const swing = (c.net / c.played).toFixed(2);
  console.log(`  ${g.CARDS[id].name.padEnd(22)} ${pct(c.won, c.played).padStart(6)} ${pct(c.lost, c.played).padStart(6)}  ${swing.padStart(6)}`);
}
print('Styles', tally.style);
print('Weapons', tally.weapon);
print('Items carried', tally.item);
print('Loadouts', tally.loadout);
