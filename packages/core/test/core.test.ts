import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, planExit, commonDenominations, amountsMatch, type BoundaryIndex, type Crossing } from '../src/index.js';

const NOW = 1_800_000_000;
const pools = { sapling: 0, orchard: 0, ironwood: 2 };
const c = (direction: Crossing['direction'], zats: number, ago: number, i = 0): Crossing => ({
  txid: `${direction}-${zats}-${ago}-${i}`, height: 1, time: NOW - ago, direction, zats, pools,
});
const idx = (crossings: Crossing[]): BoundaryIndex => ({ network: 'test', fromHeight: 0, toHeight: 1, generatedAt: NOW, crossings });

test('fee-sized differences still match', () => {
  assert.ok(amountsMatch(73_420_000, 73_410_000));
  assert.ok(!amountsMatch(73_420_000, 70_000_000));
});

test('a unique entry and exit of the same amount is red', () => {
  const a = assess(idx([c('shield', 73_420_000, 2400)]), { zats: 73_420_000, time: NOW });
  assert.equal(a.level, 'red');
  assert.equal(a.candidates.length, 1);
});

test('an amount nobody else moved is red', () => {
  const a = assess(idx([c('deshield', 10_000_000, 100)]), { zats: 73_420_000, time: NOW });
  assert.equal(a.level, 'red');
  assert.equal(a.crowd, 0);
});

test('a common amount is green', () => {
  const many = Array.from({ length: 12 }, (_, i) => c(i % 2 ? 'shield' : 'deshield', 10_000_000, 600 * (i + 1), i));
  assert.equal(assess(idx(many), { zats: 10_000_000, time: NOW }).level, 'green');
});

test('entries outside the window are ignored', () => {
  const a = assess(idx([c('shield', 73_420_000, 30 * 24 * 3600)]), { zats: 73_420_000, time: NOW });
  assert.equal(a.candidates.length, 0);
});

test('planExit splits into denominations and keeps the odd remainder shielded', () => {
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = planExit(73_420_000, { now: NOW, rng, maxPieces: 12 });
  const sum = p.pieces.reduce((a, x) => a + x.zats, 0);
  assert.equal(sum + p.remainderZats, 73_420_000);
  assert.ok(p.remainderZats < 100_000);
  assert.ok(p.pieces.every((x, i) => x.at > (i ? p.pieces[i - 1].at : NOW)));

  // With the default cap, whatever doesn't fit stays shielded instead of leaving as a unique amount.
  const capped = planExit(73_420_000, { now: NOW, rng });
  assert.equal(capped.pieces.length, 6);
  assert.equal(capped.pieces.reduce((a, x) => a + x.zats, 0) + capped.remainderZats, 73_420_000);
});

test('commonDenominations favours amounts seen repeatedly', () => {
  const d = commonDenominations(idx([c('shield', 1_230_000, 1), c('deshield', 1_230_000, 2, 1)]));
  assert.equal(d.includes(1_200_000), true);
});
