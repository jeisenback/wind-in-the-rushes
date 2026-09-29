const test = require('node:test');
const assert = require('node:assert');
const { resolve, newGame, playRound, aiChoose } = require('../game.js');

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
    const s = newGame('storm', 'stone');
    while (!s.over) playRound(s, 0, aiChoose(s));
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
