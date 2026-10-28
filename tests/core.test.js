import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIER_POINTS,
  pointsFor,
  validatePoints,
  computeResults,
  progress,
} from '../web/js/core.js';

const cases = JSON.parse(
  readFileSync(new URL('./fixtures/scoring.json', import.meta.url), 'utf-8'),
);
const byName = (name) => cases.find((c) => c.name === name);

test('computeResults matches every fixture case', () => {
  for (const { name, data, expected } of cases) {
    const result = computeResults(data);
    assert.equal(result.status, expected.status, `${name}: status`);
    assert.equal(result.missing, expected.missing, `${name}: missing`);
    assert.deepEqual(
      result.rows.map(({ subjectId, total, sCount, rank }) => ({ subjectId, total, sCount, rank })),
      expected.rows,
      `${name}: rows`,
    );
  }
});

test('computeResults fills tiers per criterion', () => {
  const { rows } = computeResults(byName('ranking-1-1-3').data);
  assert.deepEqual(rows.find((r) => r.subjectId === 's2').tiers, { c1: 'A', c2: 'A' });
});

test('pointsFor falls back to TIER_POINTS', () => {
  assert.deepEqual(pointsFor({ id: 'c1', name: 'x' }), TIER_POINTS);
  const points = { S: 10, A: 5, B: 2, C: 0 };
  assert.deepEqual(pointsFor({ id: 'c1', name: 'x', points }), points);
});

test('validatePoints accepts strictly decreasing non-negative numbers', () => {
  assert.equal(validatePoints({ S: 4, A: 3, B: 2, C: 1 }), null);
  assert.equal(validatePoints({ S: 0.3, A: 0.2, B: 0.1, C: 0 }), null);
});

test('validatePoints rejects bad tables with a message', () => {
  const bad = [
    { S: 1, A: 1, B: 0, C: 0 },
    { S: 4, A: 3, B: 2, C: -1 },
    { S: '4', A: 3, B: 2, C: 1 },
    { S: 4, A: 3, B: 2 },
    { S: 4, A: 3, B: 2, C: NaN },
    null,
    [],
  ];
  for (const points of bad) {
    assert.equal(typeof validatePoints(points), 'string', JSON.stringify(points));
  }
});

test('progress counts only existing subjects', () => {
  const data = {
    version: 1,
    subjects: [
      { id: 's1', name: 'a' },
      { id: 's2', name: 'b' },
      { id: 's3', name: 'c' },
    ],
    criteria: [{ id: 'c1', name: 'x' }],
    placements: { c1: { s1: 'S', s9: 'A' } },
  };
  assert.deepEqual(progress(data, 'c1'), { placed: 1, total: 3 });
});

test('20 subjects x 6 criteria all get a rank', () => {
  const tiers = ['S', 'A', 'B', 'C'];
  const subjects = Array.from({ length: 20 }, (_, i) => ({ id: `s${i + 1}`, name: `대상${i + 1}` }));
  const criteria = Array.from({ length: 6 }, (_, j) => ({ id: `c${j + 1}`, name: `기준${j + 1}` }));
  const placements = {};
  criteria.forEach((c, j) => {
    placements[c.id] = {};
    subjects.forEach((s, i) => {
      placements[c.id][s.id] = tiers[(i + j) % 4];
    });
  });
  const result = computeResults({ version: 1, subjects, criteria, placements });
  assert.equal(result.status, 'ready');
  assert.equal(result.rows.length, 20);
  assert.ok(result.rows.every((r) => r.rank >= 1 && r.rank <= 20));
});
