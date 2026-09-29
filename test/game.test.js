const test = require('node:test');
const assert = require('node:assert');
const { resolve, newGame, playRound, aiChoose } = require('../game.js');

test('family triangle', () => {
  assert.deepEqual([resolve('sparrow', 'gate').toB, resolve('sparrow', 'gate').toA], [3, 0]);
  assert.equal(resolve('gate', 'needle').toB, 1);
  assert.equal(resolve('needle', 'sparrow').toB, 2);
});

test('ties', () => {
  const trade = resolve('hawk', 'hawk');
  assert.deepEqual([trade.toA, trade.toB], [4, 4]);
  const needle = resolve('needle', 'hawk');
  assert.deepEqual([needle.toA, needle.toB], [0, 3]); // needle wins, hawk takes +1
  const guards = resolve('willow', 'gate');
  assert.deepEqual([guards.toA, guards.toB], [0, 0]);
});

test('mist draws on win', () => {
  assert.equal(resolve('mist', 'gate').drawA, 1);
  assert.equal(resolve('mist', 'hawk').drawA, 0);
});

test('crane', () => {
  assert.equal(resolve('crane', 'hawk').toB, 8);
  assert.equal(resolve('crane', 'needle').toB, 7);
  assert.equal(resolve('crane', 'willow').toA, 3);
  assert.equal(resolve('sparrow', 'crane').toB, 3);
});

test('broken blade', () => {
  const r = resolve('blade', 'hawk');
  assert.deepEqual([r.toA, r.toB], [4, 8]);
  const c = resolve('crane', 'blade');
  assert.deepEqual([c.toA, c.toB], [8, 0]);
  const bb = resolve('blade', 'blade');
  assert.deepEqual([bb.toA, bb.toB], [8, 8]);
});

test('full games end with a winner', () => {
  for (let i = 0; i < 200; i++) {
    const s = newGame();
    while (!s.over) playRound(s, 0, aiChoose(s));
    assert.ok(['player', 'ai', 'draw'].includes(s.winner));
    assert.ok(s.round <= 13);
  }
});
