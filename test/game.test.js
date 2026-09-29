const test = require('node:test');
const assert = require('node:assert');
const { resolve, newGame, playRound, aiChoose, canPlay } = require('../game.js');

// The first card in hand that may legally be played.
const firstPlayable = (f) => f.hand.findIndex((_, i) => canPlay(f, i));

const dmg = (a, b) => { const r = resolve(a, b); return [r.toA, r.toB]; };

test('family triangle', () => {
  assert.deepEqual(dmg('sparrow', 'willow'), [0, 3]);
  assert.deepEqual(dmg('willow', 'hawk'), [0, 3]);
  assert.deepEqual(dmg('hawk', 'sparrow'), [0, 4]);
});

test('iron gate softens a loss', () => {
  assert.deepEqual(dmg('sparrow', 'gate'), [0, 2]);
  assert.deepEqual(dmg('gate', 'needle'), [0, 2]);
});

test('ties', () => {
  assert.deepEqual(dmg('hawk', 'hawk'), [4, 4]);
  assert.deepEqual(dmg('needle', 'hawk'), [0, 2]);
  assert.deepEqual(dmg('needle', 'needle'), [2, 2]);
  assert.deepEqual(dmg('mist', 'sparrow'), [0, 2]);
  assert.deepEqual(dmg('willow', 'gate'), [0, 0]);
});

test('crane', () => {
  assert.deepEqual(dmg('crane', 'hawk'), [0, 7]);
  assert.deepEqual(dmg('crane', 'willow'), [3, 0]);
  assert.deepEqual(dmg('sparrow', 'crane'), [0, 3]);
  assert.deepEqual(dmg('crane', 'crane'), [0, 0]);
});

test('broken blade costs its user', () => {
  assert.deepEqual(dmg('blade', 'hawk'), [8, 8]);
  assert.deepEqual(dmg('crane', 'blade'), [8, 4]);
  assert.deepEqual(dmg('blade', 'blade'), [12, 12]);
});

test('full games end with a winner', () => {
  for (let i = 0; i < 200; i++) {
    const s = newGame({ style: 'storm', weapon: 'greatblade' }, { style: 'stone', weapon: 'knives' });
    while (!s.over) playRound(s, firstPlayable(s.player), aiChoose(s));
    assert.ok(['player', 'ai', 'draw'].includes(s.winner));
    assert.ok(s.round <= 13);
  }
});

test('every style has a 12-card deck of known cards', () => {
  const { STYLES, CARDS } = require('../game.js');
  for (const style of Object.values(STYLES)) {
    assert.equal(style.deck.length, 12);
    for (const id of style.deck) assert.ok(CARDS[id], id);
  }
});

test('weapons modify family damage but not specials', () => {
  const { cardDamage } = require('../game.js');
  assert.equal(cardDamage('hawk', 'greatblade'), 5);
  assert.equal(cardDamage('sparrow', 'greatblade'), 2);
  assert.equal(cardDamage('willow', 'staff'), 5);
  assert.equal(cardDamage('crane', 'staff'), 7);
  const r = resolve('hawk', 'hawk', 'greatblade', 'staff');
  assert.deepEqual([r.toA, r.toB], [3, 5]);
  const g = resolve('sparrow', 'gate', 'knives', 'sword');
  assert.deepEqual([g.toA, g.toB], [0, 3]); // 3 + 1 knives - 1 gate
});

test('posture damage goes to the loser, both on a trade, none from a Blade', () => {
  const w = resolve('willow', 'hawk');
  assert.deepEqual([w.postureToA, w.postureToB], [0, 3]);
  const t = resolve('hawk', 'hawk');
  assert.deepEqual([t.postureToA, t.postureToB], [4, 4]);
  const b = resolve('blade', 'hawk');
  assert.deepEqual([b.postureToA, b.postureToB], [0, 0]);
});

// A game where both hands are set so the next round is known.
function rigged(playerCard, aiCard) {
  const s = newGame({}, {});
  s.player.hand[0] = playerCard;
  s.ai.hand[0] = aiCard;
  return s;
}

test('a full posture bar breaks the guard for a deathblow', () => {
  const { POSTURE_MAX, DEATHBLOW } = require('../game.js');
  const s = rigged('hawk', 'sparrow');
  s.ai.posture = POSTURE_MAX - 1;
  playRound(s, 0, 0);
  assert.equal(s.last.aBroke, true);
  assert.equal(s.ai.hp, 20 - 4 - DEATHBLOW);
  assert.equal(s.ai.posture, 0);
  assert.equal(s.last.toAi, 4 + DEATHBLOW);
});

test('posture recovers only when untouched, and not below half HP', () => {
  const s = rigged('hawk', 'sparrow');
  s.player.posture = 3;
  playRound(s, 0, 0);
  assert.equal(s.player.posture, 2);
  const low = rigged('hawk', 'sparrow');
  low.player.posture = 3;
  low.player.hp = 9;
  playRound(low, 0, 0);
  assert.equal(low.player.posture, 3);
});

test('results name the deciding rule and the damage parts', () => {
  const f = resolve('sparrow', 'gate', 'knives');
  assert.equal(f.rule, 'Flow beats Guard');
  assert.deepEqual(f.partsB, ['Sparrow Turns 3', 'Twin Knives +1', 'Iron Gate -1']);
  assert.equal(resolve('crane', 'hawk').rule, 'Crane beats any Strike');
  assert.equal(resolve('gate', 'crane').rule, 'Crane loses to anything but a Strike');
  assert.equal(resolve('needle', 'hawk').rule, 'Strike tie: Quick Needle wins ties');
  assert.equal(resolve('hawk', 'hawk').rule, 'Strike tie: both land');
  assert.equal(resolve('willow', 'gate').rule, 'Guard tie: nothing happens');
  assert.deepEqual(resolve('blade', 'crane').partsA, ['Crane in Still Water misses', 'Broken Blade cost 4']);
});

test('Broken Blade needs 10 HP or less, unless it is the last card', () => {
  const s = rigged('blade', 'hawk');
  assert.equal(canPlay(s.player, 0), false);
  assert.throws(() => playRound(s, 0, 0));
  s.player.hp = 10;
  assert.equal(canPlay(s.player, 0), true);
  const last = rigged('blade', 'hawk');
  last.player.hand = ['blade'];
  assert.equal(canPlay(last.player, 0), true);
});

test('the AI never picks a Broken Blade it cannot play', () => {
  const s = newGame({}, {});
  s.ai.hand = ['blade', 'gate', 'gate', 'gate'];
  for (let i = 0; i < 200; i++) assert.notEqual(aiChoose(s), 0);
  s.ai.hp = 10;
  const picks = new Set(Array.from({ length: 200 }, () => aiChoose(s)));
  assert.ok(picks.has(0));
});
