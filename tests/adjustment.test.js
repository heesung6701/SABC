import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, TIER_POINTS, MAX_ADJUST, adjustmentUnit, computeResults, validateData } from '../web/js/core.js';
import { setAdjustment, setPlacement, removeSubject, removeCriterion, replaceCriteria } from '../web/js/model.js';

const tables = [TIER_POINTS, { S: 4, A: 3, B: 2, C: 1 }, { S: 0.3, A: 0.2, B: 0.1, C: 0 }, { S: 100, A: 99, B: 10, C: 0 }];

test('no allowed adjustment can invert tier order (exhaustive per table)', () => {
  for (const points of tables) {
    const unit = adjustmentUnit({ id: 'c1', name: 'x', points });
    for (let i = 0; i < TIERS.length - 1; i++) {
      const lowOfUpper = points[TIERS[i]] - MAX_ADJUST * unit;
      const highOfLower = points[TIERS[i + 1]] + MAX_ADJUST * unit;
      assert.ok(lowOfUpper > highOfLower, `${JSON.stringify(points)} ${TIERS[i]}>${TIERS[i + 1]}`);
    }
  }
});

test('default table: unit is 1 and range is +-2', () => {
  assert.equal(adjustmentUnit({ id: 'c1', name: 'x' }), 1);
});

const base = () => ({
  version: 1,
  subjects: [{ id: 's1', name: 'a' }, { id: 's2', name: 'b' }],
  criteria: [{ id: 'c1', name: 'x' }],
  placements: { c1: { s1: 'A', s2: 'A' } },
});

test('adjustment breaks ties and adds to total; S-count tie-break still applies', () => {
  const data = setAdjustment(base(), 'c1', 's1', 1);
  const { rows } = computeResults(data);
  assert.deepEqual(rows.map((r) => [r.subjectId, r.total, r.rank]), [['s1', 21, 1], ['s2', 20, 2]]);
  const tied = setAdjustment(setAdjustment(base(), 'c1', 's1', 1), 'c1', 's2', 1);
  assert.deepEqual(computeResults(tied).rows.map((r) => r.rank), [1, 1]);
});

test('setAdjustment rejects out-of-range, non-integer, and unplaced', () => {
  const d = base();
  assert.equal(setAdjustment(d, 'c1', 's1', MAX_ADJUST + 1), d);
  assert.equal(setAdjustment(d, 'c1', 's1', 0.5), d);
  assert.equal(setAdjustment(setPlacement(d, 'c1', 's1', null), 'c1', 's1', 1).adjustments, undefined);
  assert.equal(setAdjustment(d, 'c1', 's1', 0), d);
});

test('moving tier resets adjustment; same tier keeps it', () => {
  const d = setAdjustment(base(), 'c1', 's1', 2);
  assert.equal(setPlacement(d, 'c1', 's1', 'A').adjustments.c1.s1, 2);
  assert.equal(setPlacement(d, 'c1', 's1', 'S').adjustments.c1.s1, undefined);
});

test('removing subject/criterion/criteria cleans adjustments', () => {
  const d = setAdjustment(base(), 'c1', 's1', 1);
  assert.equal(removeSubject(d, 's1').adjustments.c1.s1, undefined);
  assert.equal(removeCriterion(d, 'c1').adjustments.c1, undefined);
  assert.equal(replaceCriteria(d, []).adjustments, undefined);
});

test('validateData checks adjustments (JSON import)', () => {
  const d = setAdjustment(base(), 'c1', 's1', 1);
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(validateData(base()), []); // 예전 데이터
  assert.ok(validateData({ ...d, adjustments: { c1: { s1: 3 } } }).length > 0);
  assert.ok(validateData({ ...d, adjustments: { c1: { s1: 1.5 } } }).length > 0);
  assert.ok(validateData({ ...d, adjustments: { c9: { s1: 1 } } }).length > 0);
  assert.ok(validateData({ ...d, adjustments: { c1: { s9: 1 } } }).length > 0);
});
