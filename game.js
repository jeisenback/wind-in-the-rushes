// Rules and AI for the card duel. No DOM access here, so it runs in Node for tests.

const HAND_SIZE = 4;
const START_HP = 20;
const BLADE_DAMAGE = 8;

// Which family each family beats. Special cards are handled separately.
const BEATS = { strike: 'flow', flow: 'guard', guard: 'strike' };

const CARDS = {
  hawk:   { id: 'hawk',   name: 'Falling Hawk',         family: 'strike',  damage: 4, text: 'Take 1 extra damage if this loses.' },
  needle: { id: 'needle', name: 'Quick Needle',         family: 'strike',  damage: 2, text: 'Wins Strike ties instead of trading.' },
  gate:   { id: 'gate',   name: 'Iron Gate',            family: 'guard',   damage: 1, text: 'A solid block.' },
  willow: { id: 'willow', name: 'Willow Bends',         family: 'guard',   damage: 3, text: 'Counterattack. Nothing on a tie.' },
  mist:   { id: 'mist',   name: 'Mist on the Pond',     family: 'flow',    damage: 2, text: 'Draw 1 extra card if this wins.' },
  sparrow:{ id: 'sparrow',name: 'Sparrow Turns',        family: 'flow',    damage: 3, text: 'A reliable feint.' },
  crane:  { id: 'crane',  name: 'Crane in Still Water', family: 'special', damage: 7, text: 'Beats any Strike. Loses to everything else.' },
  blade:  { id: 'blade',  name: 'Broken Blade',         family: 'special', damage: BLADE_DAMAGE, text: 'Take the enemy hit, then deal 8.' },
};

const STARTER_DECK = [
  'hawk', 'hawk', 'needle', 'needle',
  'gate', 'gate', 'willow',
  'mist', 'mist', 'sparrow',
  'crane', 'blade',
];

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newFighter(rng) {
  const deck = shuffle(STARTER_DECK, rng);
  return { hp: START_HP, hand: deck.splice(0, HAND_SIZE), deck, discard: [] };
}

function newGame(rng = Math.random) {
  return { player: newFighter(rng), ai: newFighter(rng), round: 1, log: [], over: false, winner: null };
}

// Damage a card inflicts on a Broken Blade user, who takes the hit unopposed.
function hitValue(card) {
  return card.id === 'crane' ? 0 : card.damage;
}

// Returns damage dealt to each side, extra draws, and a line for the log.
// `a` and `b` are card ids; results are from a's point of view (a = player).
function resolve(aId, bId) {
  const a = CARDS[aId];
  const b = CARDS[bId];
  const r = { toA: 0, toB: 0, drawA: 0, drawB: 0, text: '' };

  if (a.id === 'blade' || b.id === 'blade') {
    // Each side takes the other card's hit; a Blade's hit is always 8.
    r.toA = hitValue(b);
    r.toB = hitValue(a);
    r.text = 'A Broken Blade: blows land on both sides.';
    return r;
  }

  let winner = null; // 'a', 'b', 'trade' or null (no damage)
  if (a.id === 'crane' || b.id === 'crane') {
    if (a.id === 'crane' && b.id === 'crane') winner = null;
    else if (a.id === 'crane') winner = b.family === 'strike' ? 'a' : 'b';
    else winner = a.family === 'strike' ? 'b' : 'a';
  } else if (a.family === b.family) {
    if (a.family === 'strike') {
      if (a.id === 'needle' && b.id !== 'needle') winner = 'a';
      else if (b.id === 'needle' && a.id !== 'needle') winner = 'b';
      else winner = 'trade';
    }
  } else {
    winner = BEATS[a.family] === b.family ? 'a' : 'b';
  }

  if (winner === 'trade') {
    r.toA = b.damage;
    r.toB = a.damage;
    r.text = 'Both strikes land.';
  } else if (winner === 'a') {
    r.toB = a.damage + (b.id === 'hawk' ? 1 : 0);
    if (a.id === 'mist') r.drawA = 1;
    r.text = `${a.name} beats ${b.name}.`;
  } else if (winner === 'b') {
    r.toA = b.damage + (a.id === 'hawk' ? 1 : 0);
    if (b.id === 'mist') r.drawB = 1;
    r.text = `${b.name} beats ${a.name}.`;
  } else {
    r.text = 'The forms cancel out.';
  }
  return r;
}

// v1 AI: random pick, weighted toward cards that beat the player's last family.
function aiChoose(state, rng = Math.random) {
  const hand = state.ai.hand;
  const last = state.player.discard[state.player.discard.length - 1];
  const lastFamily = last && CARDS[last].family;
  const weights = hand.map((id) => {
    const card = CARDS[id];
    if (!lastFamily) return 1;
    if (card.id === 'crane') return lastFamily === 'strike' ? 3 : 1;
    return BEATS[card.family] === lastFamily ? 3 : 1;
  });
  let roll = rng() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < hand.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return hand.length - 1;
}

function draw(f, n) {
  f.hand.push(...f.deck.splice(0, n));
}

// Plays one round. Mutates and returns state.
function playRound(state, playerIndex, aiIndex) {
  const p = state.player;
  const ai = state.ai;
  const pCard = p.hand.splice(playerIndex, 1)[0];
  const aCard = ai.hand.splice(aiIndex, 1)[0];
  p.discard.push(pCard);
  ai.discard.push(aCard);

  const r = resolve(pCard, aCard);
  p.hp -= r.toA;
  ai.hp -= r.toB;
  state.log.push(`Round ${state.round}: You play ${CARDS[pCard].name}, the enemy plays ${CARDS[aCard].name}. ${r.text} (You -${r.toA}, Enemy -${r.toB})`);

  draw(p, Math.max(0, HAND_SIZE - p.hand.length) + r.drawA);
  draw(ai, Math.max(0, HAND_SIZE - ai.hand.length) + r.drawB);
  state.round++;

  const dead = p.hp <= 0 || ai.hp <= 0;
  if (dead || p.hand.length === 0 || ai.hand.length === 0) {
    state.over = true;
    state.winner = p.hp > ai.hp ? 'player' : ai.hp > p.hp ? 'ai' : 'draw';
  }
  return state;
}

if (typeof module !== 'undefined') {
  module.exports = { CARDS, STARTER_DECK, HAND_SIZE, START_HP, resolve, newGame, aiChoose, playRound };
}
