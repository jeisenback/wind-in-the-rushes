// Rules and AI for the card duel. No DOM access here, so it runs in Node for tests.

const HAND_SIZE = 4;
const START_HP = 20;
const BLADE_DAMAGE = 8;
// Posture, after Sekiro: losing a clash fills your bar; a full bar breaks your guard.
const POSTURE_MAX = 8;
const DEATHBLOW = 5;

// Which family each family beats. Special cards are handled separately.
const BEATS = { strike: 'flow', flow: 'guard', guard: 'strike' };

const CARDS = {
  hawk:   { id: 'hawk',   name: 'Falling Hawk',         family: 'strike',  damage: 4, posture: 4, text: 'A heavy blow that staggers.' },
  needle: { id: 'needle', name: 'Quick Needle',         family: 'strike',  damage: 2, posture: 2, winsTies: true, text: 'Wins Strike ties instead of trading.' },
  gate:   { id: 'gate',   name: 'Iron Gate',            family: 'guard',   damage: 2, posture: 2, loseMod: -1, text: 'Take 1 less damage if this loses.' },
  willow: { id: 'willow', name: 'Willow Bends',         family: 'guard',   damage: 3, posture: 3, text: 'A deflect and counter.' },
  mist:   { id: 'mist',   name: 'Mist on the Pond',     family: 'flow',    damage: 2, posture: 2, winsTies: true, text: 'Wins Flow ties.' },
  sparrow:{ id: 'sparrow',name: 'Sparrow Turns',        family: 'flow',    damage: 4, posture: 2, text: 'A feint that cuts deep.' },
  crane:  { id: 'crane',  name: 'Crane in Still Water', family: 'special', damage: 7, posture: 5, text: 'Beats any Strike, crushing posture. Loses to everything else.' },
  blade:  { id: 'blade',  name: 'Broken Blade',         family: 'special', damage: BLADE_DAMAGE, posture: 0, selfCost: 4, desperate: true, text: 'Only at 10 HP or less. Take the enemy hit plus 4, then deal 8.' },
};

// A fighting style is a named deck list of 12 cards.
const STYLES = {
  balanced: { name: 'Balanced', deck: ['hawk', 'hawk', 'needle', 'needle', 'gate', 'gate', 'willow', 'mist', 'mist', 'sparrow', 'crane', 'blade'] },
  storm:    { name: 'Storm',    deck: ['hawk', 'hawk', 'hawk', 'needle', 'needle', 'needle', 'gate', 'willow', 'mist', 'sparrow', 'sparrow', 'blade'] },
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

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newFighter({ style = 'balanced', weapon = 'sword' } = {}, rng) {
  const deck = shuffle(STYLES[style].deck, rng);
  return { style, weapon, hp: START_HP, posture: 0, hand: deck.splice(0, HAND_SIZE), deck, discard: [] };
}

// `player` and `ai` are { style, weapon } choices.
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
  return r;
}

// Badly hurt: at half HP or less. Grants Clarity and unlocks desperate cards.
function isDesperate(f) {
  return f.hp <= START_HP / 2;
}

// A desperate card needs its fighter at half HP or less, unless it is the only card left.
function canPlay(f, index) {
  return !CARDS[f.hand[index]].desperate || isDesperate(f) || f.hand.length === 1;
}

// Clarity: each round, a desperate fighter sees one random card in the enemy hand.
// Stored as an index into the enemy hand, or null.
function rollClarity(state, rng) {
  const pick = (me, them) => (isDesperate(me) && them.hand.length ? Math.floor(rng() * them.hand.length) : null);
  state.clarity = { player: pick(state.player, state.ai), ai: pick(state.ai, state.player) };
}

// AI: with Clarity, play the card that does best against the revealed card, if any
// card comes out ahead. Otherwise pick at random, weighted toward cards that beat
// the player's last family.
function aiChoose(state, rng = Math.random) {
  const hand = state.ai.hand;
  const seenIdx = state.clarity && state.clarity.ai;
  if (seenIdx != null) {
    const seen = state.player.hand[seenIdx];
    let best = -1, bestNet = 0;
    hand.forEach((id, i) => {
      // Broken Blade does the same thing whatever it meets, so it is no answer to what Clarity shows.
      if (!canPlay(state.ai, i) || id === 'blade') return;
      const r = resolve(id, seen, state.ai.weapon, state.player.weapon);
      if (r.toB - r.toA > bestNet) { best = i; bestNet = r.toB - r.toA; }
    });
    if (best >= 0) return best;
  }
  const last = state.player.discard[state.player.discard.length - 1];
  const lastFamily = last && CARDS[last].family;
  const weights = hand.map((id, i) => {
    const card = CARDS[id];
    if (!canPlay(state.ai, i)) return 0;
    if (!lastFamily) return 1;
    if (card.id === 'crane') return lastFamily === 'strike' ? 3 : 1;
    return BEATS[card.family] === lastFamily ? 3 : 1;
  });
  let roll = rng() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < hand.length; i++) {
    roll -= weights[i];
    if (roll < 0 && weights[i] > 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

// Adds posture damage, or recovers 1 if none was taken.
// On a full bar the guard breaks: a deathblow lands and the bar resets.
// Returns true if the guard broke.
function applyPosture(f, taken) {
  if (taken > 0) f.posture += taken;
  else f.posture = Math.max(0, f.posture - 1);
  if (f.posture < POSTURE_MAX) return false;
  f.hp -= DEATHBLOW;
  f.posture = 0;
  return true;
}

function draw(f, n) {
  f.hand.push(...f.deck.splice(0, n));
}

// Plays one round. Mutates and returns state.
function playRound(state, playerIndex, aiIndex, rng = Math.random) {
  const p = state.player;
  const ai = state.ai;
  if (!canPlay(p, playerIndex) || !canPlay(ai, aiIndex)) throw new Error('That card cannot be played yet.');
  const pCard = p.hand.splice(playerIndex, 1)[0];
  const aCard = ai.hand.splice(aiIndex, 1)[0];
  p.discard.push(pCard);
  ai.discard.push(aCard);

  const r = resolve(pCard, aCard, p.weapon, ai.weapon);
  p.hp -= r.toA;
  ai.hp -= r.toB;
  const pBroke = applyPosture(p, r.postureToA);
  const aBroke = applyPosture(ai, r.postureToB);
  const toPlayer = r.toA + (pBroke ? DEATHBLOW : 0);
  const toAi = r.toB + (aBroke ? DEATHBLOW : 0);
  state.last = {
    round: state.round, player: pCard, ai: aCard, rule: r.rule, text: r.text,
    partsPlayer: [...r.partsA, ...(pBroke ? [`Deathblow ${DEATHBLOW}`] : [])],
    partsAi: [...r.partsB, ...(aBroke ? [`Deathblow ${DEATHBLOW}`] : [])],
    toPlayer, toAi, postureToPlayer: r.postureToA, postureToAi: r.postureToB, pBroke, aBroke,
  };
  const breaks = (pBroke ? ' Your guard breaks: deathblow!' : '') + (aBroke ? ' The enemy guard breaks: deathblow!' : '');
  state.log.push(`Round ${state.round}: You play ${CARDS[pCard].name}, the enemy plays ${CARDS[aCard].name}. ${r.rule}. ${r.text}${breaks} (You -${toPlayer}, Enemy -${toAi})`);

  draw(p, HAND_SIZE - p.hand.length);
  draw(ai, HAND_SIZE - ai.hand.length);
  state.round++;
  rollClarity(state, rng);

  const dead = p.hp <= 0 || ai.hp <= 0;
  if (dead || p.hand.length === 0 || ai.hand.length === 0) {
    state.over = true;
    state.winner = p.hp > ai.hp ? 'player' : ai.hp > p.hp ? 'ai' : 'draw';
  }
  return state;
}

if (typeof module !== 'undefined') {
  module.exports = { CARDS, STYLES, WEAPONS, HAND_SIZE, START_HP, POSTURE_MAX, DEATHBLOW, cardDamage, resolve, newGame, canPlay, aiChoose, playRound };
}
