// Rules and AI for the card duel. No DOM access here, so it runs in Node for tests.

const HAND_SIZE = 4;
const START_HP = 20;
const BLADE_DAMAGE = 8;
// Posture, after Sekiro: losing a clash fills your bar; a full bar breaks your guard.
const POSTURE_MAX = 8;
const DEATHBLOW = 5;
// How loosely the AI picks among its options; see aiChoose.
const AI_TEMPERATURE = 1;

// Which family each family beats. Special cards are handled separately.
const BEATS = { strike: 'flow', flow: 'guard', guard: 'strike' };

const CARDS = {
  hawk:   { id: 'hawk',   name: 'Falling Hawk',         family: 'strike',  damage: 4, posture: 4, loseMod: -1, text: 'A braced, heavy blow. Take 1 less damage if this loses.' },
  needle: { id: 'needle', name: 'Quick Needle',         family: 'strike',  damage: 2, posture: 2, winsTies: true, text: 'Wins Strike ties instead of trading.' },
  gate:   { id: 'gate',   name: 'Iron Gate',            family: 'guard',   damage: 2, posture: 2, loseMod: -1, text: 'Take 1 less damage if this loses.' },
  willow: { id: 'willow', name: 'Willow Bends',         family: 'guard',   damage: 3, posture: 3, text: 'A deflect and counter.' },
  mist:   { id: 'mist',   name: 'Mist on the Pond',     family: 'flow',    damage: 2, posture: 2, winsTies: true, text: 'Wins Flow ties.' },
  sparrow:{ id: 'sparrow',name: 'Sparrow Turns',        family: 'flow',    damage: 4, posture: 2, text: 'A feint that cuts deep.' },
  crane:  { id: 'crane',  name: 'Crane in Still Water', family: 'special', damage: 7, posture: 5, text: 'Beats any Strike, crushing posture. Loses to everything else.' },
  blade:  { id: 'blade',  name: 'Broken Blade',         family: 'special', damage: BLADE_DAMAGE, posture: 0, selfCost: 4, reserve: true, text: 'Joins your hand at 10 HP or less. Take the enemy hit plus 4, then deal 8.' },
};

// A fighting style is a named deck list of 12 cards.
const STYLES = {
  balanced: { name: 'Balanced', deck: ['hawk', 'hawk', 'needle', 'needle', 'gate', 'gate', 'willow', 'mist', 'mist', 'sparrow', 'crane', 'blade'] },
  storm:    { name: 'Storm',    deck: ['hawk', 'hawk', 'needle', 'needle', 'needle', 'gate', 'willow', 'mist', 'sparrow', 'sparrow', 'sparrow', 'blade'] },
  stone:    { name: 'Stone',    deck: ['hawk', 'needle', 'gate', 'gate', 'gate', 'willow', 'willow', 'mist', 'sparrow', 'sparrow', 'crane', 'blade'] },
  stream:   { name: 'Stream',   deck: ['hawk', 'needle', 'gate', 'willow', 'mist', 'mist', 'mist', 'sparrow', 'sparrow', 'sparrow', 'crane', 'blade'] },
};

// A weapon adds to or subtracts from the damage of one or more families.
// Special cards are never modified.
const WEAPONS = {
  sword:      { name: 'Sword',       mods: {} },
  greatblade: { name: 'Greatblade',  mods: { strike: 1, flow: -1 } },
  staff:      { name: 'Staff',       mods: { guard: 2, strike: -1 } },
  knives:     { name: 'Twin Knives', mods: { flow: 1, guard: -1 } },
};

// Damage a card deals when wielded with the given weapon.
function cardDamage(cardId, weaponId = 'sword') {
  const card = CARDS[cardId];
  return Math.max(0, card.damage + (WEAPONS[weaponId].mods[card.family] || 0));
}

// Items: single use, committed face down with a card and revealed with it.
// `keep` is roughly what an item is worth on an ordinary round; the AI only
// spends one when using it now beats that.
const ITEMS = {
  gourd:       { name: 'Healing Gourd',  amount: 4, keep: 4,   text: 'Heal 4 HP.' },
  tea:         { name: 'Calming Tea',    amount: 4, keep: 2,   text: 'Clear 4 posture before the clash.' },
  smoke:       { name: 'Smoke Bomb',     keep: 2,   text: 'If you lose this round, take no damage or posture.' },
  tonic:       { name: 'Battle Tonic',   amount: 3, keep: 2,   text: '+3 damage if your card wins.' },
  knife:       { name: 'Throwing Knife', amount: 2, keep: 2,   text: 'Deal 2 damage no matter what.' },
  firecracker: { name: 'Firecracker',    amount: 3, keep: 1.5, text: 'The enemy takes 3 posture no matter what.' },
};
const BELT_SIZE = 2;

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reserve cards (Broken Blade) stay out of the deck until the fighter is desperate.
// `belt` lists the fighter's items (at most BELT_SIZE, no repeats).
function newFighter({ style = 'balanced', weapon = 'sword', belt = [] } = {}, rng) {
  const cards = STYLES[style].deck;
  const deck = shuffle(cards.filter((id) => !CARDS[id].reserve), rng);
  const reserve = cards.filter((id) => CARDS[id].reserve);
  return { style, weapon, hp: START_HP, posture: 0, hand: deck.splice(0, HAND_SIZE), deck, reserve, discard: [], played: [], items: [...new Set(belt)].slice(0, BELT_SIZE) };
}

// `player` and `ai` are { style, weapon, belt } choices.
function newGame(player, ai, rng = Math.random) {
  return { player: newFighter(player, rng), ai: newFighter(ai, rng), round: 1, log: [], last: null, clarity: { player: null, ai: null }, over: false, winner: null };
}

const cap = (w) => w[0].toUpperCase() + w.slice(1);

// The damage one card deals to another, with each contributing part named
// so the player can see where the number came from.
function hit(card, weaponId, target, { softened = true } = {}) {
  const parts = [`${card.name} ${card.damage}`];
  let total = card.damage;
  const mod = WEAPONS[weaponId].mods[card.family] || 0;
  if (mod) { total += mod; parts.push(`${WEAPONS[weaponId].name} ${mod > 0 ? '+' : ''}${mod}`); }
  if (softened && target.loseMod) { total += target.loseMod; parts.push(`${target.name} ${target.loseMod}`); }
  return { total: Math.max(0, total), parts };
}

// Decides who wins a clash and why. `a` and `b` are card ids; results are from
// a's point of view (a = player). Returns HP and posture damage for each side,
// `rule` (the rule that decided it), `text` (what happened), and `partsA` /
// `partsB` (how each side's HP loss adds up).
function resolve(aId, bId, aWeapon = 'sword', bWeapon = 'sword') {
  const a = CARDS[aId];
  const b = CARDS[bId];
  const r = { toA: 0, toB: 0, postureToA: 0, postureToB: 0, partsA: [], partsB: [], rule: '', text: '' };

  if (a.id === 'blade' || b.id === 'blade') {
    // Each side takes the other card's hit (a Crane misses anything but a
    // Strike); a Blade also costs its user. No posture either way.
    const sideHit = (card, weapon, target) => (card.id === 'crane'
      ? { total: 0, parts: [`${card.name} misses`] }
      : hit(card, weapon, target, { softened: false }));
    const onA = sideHit(b, bWeapon, a);
    const onB = sideHit(a, aWeapon, b);
    r.toA = onA.total + (a.selfCost || 0);
    r.toB = onB.total + (b.selfCost || 0);
    r.partsA = [...onA.parts, ...(a.selfCost ? [`Broken Blade cost ${a.selfCost}`] : [])];
    r.partsB = [...onB.parts, ...(b.selfCost ? [`Broken Blade cost ${b.selfCost}`] : [])];
    r.rule = 'Broken Blade: no winner';
    r.text = 'A Broken Blade takes the enemy hit to land its own. Both sides are hurt.';
    r.winner = 'blade';
    return r;
  }

  let winner = null; // 'a', 'b', 'trade' or null (nothing happens)
  if (a.id === 'crane' || b.id === 'crane') {
    const crane = a.id === 'crane' ? a : b;
    const other = crane === a ? b : a;
    if (a.id === b.id) {
      r.rule = 'Crane meets Crane';
      r.text = 'Both fighters wait for a Strike that never comes. Nothing happens.';
    } else if (other.family === 'strike') {
      winner = crane === a ? 'a' : 'b';
      r.rule = 'Crane beats any Strike';
      r.text = `${crane.name} counters the ${other.name} strike.`;
    } else {
      winner = crane === a ? 'b' : 'a';
      r.rule = 'Crane loses to anything but a Strike';
      r.text = `${crane.name} waits for a Strike, and ${other.name} (${cap(other.family)}) catches it off guard.`;
    }
  } else if (a.family === b.family) {
    const fam = cap(a.family);
    if (a.winsTies && !b.winsTies) {
      winner = 'a';
      r.rule = `${fam} tie: ${a.name} wins ties`;
      r.text = `Both played ${fam}. ${a.name} wins ${fam} ties.`;
    } else if (b.winsTies && !a.winsTies) {
      winner = 'b';
      r.rule = `${fam} tie: ${b.name} wins ties`;
      r.text = `Both played ${fam}. ${b.name} wins ${fam} ties.`;
    } else if (a.family === 'strike') {
      winner = 'trade';
      r.rule = 'Strike tie: both land';
      r.text = 'Both played Strike, and neither wins the tie, so both blows land.';
    } else {
      r.rule = `${fam} tie: nothing happens`;
      r.text = `Both played ${fam}, and neither wins the tie. Nothing happens.`;
    }
  } else {
    winner = BEATS[a.family] === b.family ? 'a' : 'b';
    const w = winner === 'a' ? a : b;
    const l = winner === 'a' ? b : a;
    r.rule = `${cap(w.family)} beats ${cap(l.family)}`;
    r.text = `${w.name} (${cap(w.family)}) beats ${l.name} (${cap(l.family)}).`;
  }

  if (winner === 'trade') {
    const onA = hit(b, bWeapon, a, { softened: false });
    const onB = hit(a, aWeapon, b, { softened: false });
    [r.toA, r.partsA, r.postureToA] = [onA.total, onA.parts, b.posture];
    [r.toB, r.partsB, r.postureToB] = [onB.total, onB.parts, a.posture];
  } else if (winner === 'a') {
    const onB = hit(a, aWeapon, b);
    [r.toB, r.partsB, r.postureToB] = [onB.total, onB.parts, a.posture];
  } else if (winner === 'b') {
    const onA = hit(b, bWeapon, a);
    [r.toA, r.partsA, r.postureToA] = [onA.total, onA.parts, b.posture];
  }
  r.winner = winner;
  return r;
}

// Applies each side's item (or null) to a clash result, returning a new result
// with `healA`/`healB` and `clearA`/`clearB` (posture cleared) added.
function applyItems(r, aItem, bItem) {
  const out = { ...r, partsA: [...r.partsA], partsB: [...r.partsB], healA: 0, healB: 0, clearA: 0, clearB: 0 };
  const sides = [['A', 'B', aItem, 'a', 'b'], ['B', 'A', bItem, 'b', 'a']];
  // Smoke Bomb first, so it only cancels what the card clash did.
  for (const [me, , item, self, other] of sides) {
    if (item === 'smoke' && r.winner === other) {
      out[`to${me}`] = 0;
      out[`posture${'To' + me}`] = 0;
      out[`parts${me}`] = ['Smoke Bomb: no damage'];
    }
  }
  for (const [me, them, item, self] of sides) {
    const n = item && ITEMS[item].amount;
    if (item === 'tonic' && r.winner === self) { out[`to${them}`] += n; out[`parts${them}`].push(`Battle Tonic +${n}`); }
    if (item === 'knife') { out[`to${them}`] += n; out[`parts${them}`].push(`Throwing Knife ${n}`); }
    if (item === 'firecracker') out[`postureTo${them}`] += n;
    if (item === 'gourd') out[`heal${me}`] = n;
    if (item === 'tea') out[`clear${me}`] = n;
  }
  return out;
}

// Badly hurt: at half HP or less. Grants Clarity and brings in reserve cards.
function isDesperate(f) {
  return f.hp <= START_HP / 2;
}

// Moves reserve cards into the hand once the fighter is desperate.
// Returns true if any joined this call.
function joinReserve(f) {
  if (!isDesperate(f) || !f.reserve.length) return false;
  f.hand.push(...f.reserve.splice(0));
  return true;
}

// Clarity: each round, a desperate fighter sees one random card in the enemy hand.
// Stored as an index into the enemy hand, or null.
function rollClarity(state, rng) {
  const pick = (me, them) => (isDesperate(me) && them.hand.length ? Math.floor(rng() * them.hand.length) : null);
  state.clarity = { player: pick(state.player, state.ai), ai: pick(state.ai, state.player) };
}

// What the AI thinks the player will play next, as { cardId: probability }.
// Uses only public information: the player's style (so their full card list),
// their discards, their hand size, whether their reserve has joined, and any
// card Clarity reveals. It never looks at the player's hand itself.
function predictPlay(state) {
  const opp = state.player;
  const handSize = opp.hand.length;
  const known = [];
  const seenIdx = state.clarity && state.clarity.ai;
  if (seenIdx != null) known.push(opp.hand[seenIdx]);
  const pool = {};
  for (const id of STYLES[opp.style].deck) pool[id] = (pool[id] || 0) + 1;
  for (const id of opp.discard) pool[id]--;
  for (const id of STYLES[opp.style].deck.filter((c) => CARDS[c].reserve)) {
    // Still in reserve: not in play. Joined but never played: certainly in hand.
    // Played before: an ordinary card, in the discard or reshuffled into the deck.
    if (opp.reserve.includes(id)) pool[id] = 0;
    else if (!opp.played.includes(id)) { if (!known.includes(id)) known.push(id); pool[id] = 0; }
  }
  for (const id of known) if (pool[id] > 0) pool[id]--;
  const poolTotal = Object.values(pool).reduce((a, b) => a + b, 0);
  const unknownShare = handSize ? (handSize - known.length) / handSize : 0;
  const probs = {};
  for (const id of known) probs[id] = (probs[id] || 0) + 1 / handSize;
  for (const [id, n] of Object.entries(pool)) {
    if (n > 0 && poolTotal > 0) probs[id] = (probs[id] || 0) + unknownShare * n / poolTotal;
  }
  return probs;
}

// How good one clash result is for the AI (side a of `r` is the AI, b the player).
// Counts HP, posture at half weight, guard breaks, and lethal blows.
function outcomeValue(r, me, opp) {
  const myHp = Math.min(START_HP, me.hp - r.toA + (r.healA || 0));
  const myPosture = Math.max(0, me.posture - (r.clearA || 0));
  let v = (r.toB - (me.hp - myHp)) + 0.5 * (r.postureToB - r.postureToA + (me.posture - myPosture));
  if (opp.posture + r.postureToB >= POSTURE_MAX) v += DEATHBLOW;
  if (myPosture + r.postureToA >= POSTURE_MAX) v -= DEATHBLOW;
  if (r.toB >= opp.hp) v += 20;
  if (myHp <= 0) v -= 20;
  return v;
}

// AI move: scores every card in hand, alone and with each item left in its
// belt, by expected value against the predicted play. An item is charged its
// `keep` value, so it is spent only when it beats saving it. Cards are then
// picked with a softmax so the AI stays hard to read; lower `temperature`
// plays sharper and more predictably. Returns { card, item }.
function aiMove(state, rng = Math.random, temperature = AI_TEMPERATURE) {
  const me = state.ai;
  const opp = state.player;
  const probs = Object.entries(predictPlay(state));
  const options = me.hand.map((id) => {
    let best = { item: null, value: -Infinity };
    for (const item of [null, ...me.items]) {
      const ev = probs.reduce((sum, [theirs, p]) => sum
        + p * outcomeValue(applyItems(resolve(id, theirs, me.weapon, opp.weapon), item, null), me, opp), 0);
      const value = ev - (item ? ITEMS[item].keep : 0);
      // Using an item must beat keeping it by a real margin, not a rounding error.
      if (value > best.value + 1e-6) best = { item, value };
    }
    return best;
  });
  const top = Math.max(...options.map((o) => o.value));
  const weights = options.map((o) => Math.exp((o.value - top) / temperature));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  let card = weights.length - 1;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) { card = i; break; }
  }
  return { card, item: options[card].item };
}

function aiChoose(state, rng = Math.random, temperature = AI_TEMPERATURE) {
  return aiMove(state, rng, temperature).card;
}

// Clears posture from an item, then adds posture damage, or recovers 1 if none was taken.
// On a full bar the guard breaks: a deathblow lands and the bar resets.
// Returns true if the guard broke.
function applyPosture(f, taken, cleared = 0) {
  f.posture = Math.max(0, f.posture - cleared);
  if (taken > 0) f.posture += taken;
  else f.posture = Math.max(0, f.posture - 1);
  if (f.posture < POSTURE_MAX) return false;
  f.hp -= DEATHBLOW;
  f.posture = 0;
  return true;
}

// Draws n cards. An empty deck is rebuilt by shuffling the discard pile.
// Returns true if a reshuffle happened.
function draw(f, n, rng) {
  let reshuffled = false;
  for (let i = 0; i < n; i++) {
    if (!f.deck.length) {
      if (!f.discard.length) break;
      f.deck = shuffle(f.discard, rng);
      f.discard = [];
      reshuffled = true;
    }
    f.hand.push(f.deck.shift());
  }
  return reshuffled;
}

// Plays one round. `items` is { player, ai }: an item id from that fighter's
// belt to use this round, or null. Mutates and returns state.
function playRound(state, playerIndex, aiIndex, rng = Math.random, items = {}) {
  const p = state.player;
  const ai = state.ai;
  const pCard = p.hand.splice(playerIndex, 1)[0];
  const aCard = ai.hand.splice(aiIndex, 1)[0];
  p.discard.push(pCard);
  ai.discard.push(aCard);
  p.played.push(pCard);
  ai.played.push(aCard);

  const used = {};
  for (const [side, f] of [['player', p], ['ai', ai]]) {
    const item = items[side] || null;
    if (item && !f.items.includes(item)) throw new Error(`No ${item} left to use.`);
    if (item) f.items.splice(f.items.indexOf(item), 1);
    used[side] = item;
  }
  const r = applyItems(resolve(pCard, aCard, p.weapon, ai.weapon), used.player, used.ai);
  p.hp = Math.min(START_HP, p.hp - r.toA + r.healA);
  ai.hp = Math.min(START_HP, ai.hp - r.toB + r.healB);
  const pBroke = applyPosture(p, r.postureToA, r.clearA);
  const aBroke = applyPosture(ai, r.postureToB, r.clearB);
  const toPlayer = r.toA + (pBroke ? DEATHBLOW : 0);
  const toAi = r.toB + (aBroke ? DEATHBLOW : 0);
  state.last = {
    round: state.round, player: pCard, ai: aCard, rule: r.rule, text: r.text,
    partsPlayer: [...r.partsA, ...(pBroke ? [`Deathblow ${DEATHBLOW}`] : [])],
    partsAi: [...r.partsB, ...(aBroke ? [`Deathblow ${DEATHBLOW}`] : [])],
    toPlayer, toAi, postureToPlayer: r.postureToA, postureToAi: r.postureToB, pBroke, aBroke,
    items: used, healPlayer: r.healA, healAi: r.healB, clearPlayer: r.clearA, clearAi: r.clearB,
  };
  const breaks = (pBroke ? ' Your guard breaks: deathblow!' : '') + (aBroke ? ' The enemy guard breaks: deathblow!' : '');
  const withItem = (item) => (item ? ` with ${ITEMS[item].name}` : '');
  state.log.push(`Round ${state.round}: You play ${CARDS[pCard].name}${withItem(used.player)}, the enemy plays ${CARDS[aCard].name}${withItem(used.ai)}. ${r.rule}. ${r.text}${breaks} (You -${toPlayer}, Enemy -${toAi})`);

  if (draw(p, HAND_SIZE - p.hand.length, rng)) state.log.push('Your discard pile is shuffled into a new deck.');
  if (draw(ai, HAND_SIZE - ai.hand.length, rng)) state.log.push('The enemy discard pile is shuffled into a new deck.');
  state.last.joined = { player: joinReserve(p), ai: joinReserve(ai) };
  if (state.last.joined.player) state.log.push('Broken Blade joins your hand.');
  if (state.last.joined.ai) state.log.push('Broken Blade joins the enemy hand.');
  state.round++;
  rollClarity(state, rng);

  const dead = p.hp <= 0 || ai.hp <= 0;
  if (dead) {
    state.over = true;
    state.winner = p.hp > ai.hp ? 'player' : ai.hp > p.hp ? 'ai' : 'draw';
  }
  return state;
}

if (typeof module !== 'undefined') {
  module.exports = { CARDS, STYLES, WEAPONS, ITEMS, BELT_SIZE, HAND_SIZE, START_HP, POSTURE_MAX, DEATHBLOW, cardDamage, resolve, applyItems, newGame, predictPlay, aiMove, aiChoose, playRound };
}
