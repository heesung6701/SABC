import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeResults, validateData } from '../web/js/core.js';
import {
  nextId,
  addSubject,
  addCriterion,
  addSubjects,
  addCriteria,
  renameSubject,
  renameCriterion,
  removeSubject,
  removeCriterion,
  moveCriterion,
  setPoints,
  setPlacement,
  applyPreset,
  setAllowPreview,
} from '../web/js/model.js';
import { PRESETS } from '../web/js/presets.js';

const cases = JSON.parse(
  readFileSync(new URL('./fixtures/scoring.json', import.meta.url), 'utf-8'),
);
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const base = () => deepFreeze(structuredClone(cases.find((c) => c.name === 'ranking-1-1-3').data));
const emptyFrozen = () => deepFreeze({ version: 1, subjects: [], criteria: [], placements: {} });

test('nextId uses max numeric suffix + 1', () => {
  assert.equal(nextId('s', [{ id: 's1' }, { id: 's3' }]), 's4');
  assert.equal(nextId('c', []), 'c1');
});

test('addSubject trims the name and ignores blank names', () => {
  const added = addSubject(emptyFrozen(), '  가 ');
  assert.deepEqual(added.subjects, [{ id: 's1', name: '가' }]);
  assert.deepEqual(addSubject(emptyFrozen(), '   '), emptyFrozen());
});

test('same-name subjects get distinct ids', () => {
  const data = addSubject(addSubject(emptyFrozen(), '같은이름'), '같은이름');
  assert.deepEqual(data.subjects.map((s) => s.id), ['s1', 's2']);
});

test('addSubjects and addCriteria append every name in order', () => {
  assert.deepEqual(addSubjects(emptyFrozen(), ['가', '나']).subjects.map((s) => s.name), ['가', '나']);
  assert.deepEqual(addCriteria(emptyFrozen(), ['x', 'y']).criteria.map((c) => c.id), ['c1', 'c2']);
  assert.deepEqual(addCriterion(emptyFrozen(), ' z ').criteria, [{ id: 'c1', name: 'z' }]);
});

test('removeSubject deletes its placements in every criterion', () => {
  const data = removeSubject(base(), 's1');
  assert.deepEqual(data.subjects.map((s) => s.id), ['s2', 's3']);
  assert.deepEqual(data.placements, { c1: { s2: 'A', s3: 'B' }, c2: { s2: 'A', s3: 'S' } });
});

test('removeCriterion deletes the criterion placements', () => {
  const data = removeCriterion(base(), 'c1');
  assert.deepEqual(data.criteria.map((c) => c.id), ['c2']);
  assert.equal('c1' in data.placements, false);
});

test('rename keeps ids and placements', () => {
  const before = computeResults(base()).rows.find((r) => r.subjectId === 's1');
  const renamed = renameSubject(base(), 's1', '새이름');
  const after = computeResults(renamed).rows.find((r) => r.subjectId === 's1');
  assert.equal(after.name, '새이름');
  assert.equal(after.total, before.total);
  assert.equal(renameCriterion(base(), 'c1', '바뀜').criteria[0].name, '바뀜');
  assert.deepEqual(renameSubject(base(), 's1', '  '), base());
});

test('moveCriterion swaps neighbours and ignores out-of-range moves', () => {
  assert.deepEqual(moveCriterion(base(), 'c2', -1).criteria.map((c) => c.id), ['c2', 'c1']);
  assert.deepEqual(moveCriterion(base(), 'c1', -1), base());
  assert.deepEqual(moveCriterion(base(), 'c2', 1), base());
});

test('setPoints sets and removes the points table', () => {
  const points = { S: 10, A: 5, B: 2, C: 0 };
  const withPoints = setPoints(base(), 'c1', points);
  assert.deepEqual(withPoints.criteria[0].points, points);
  const cleared = setPoints(withPoints, 'c1', null);
  assert.equal('points' in cleared.criteria[0], false);
});

test('setPlacement sets and removes a placement', () => {
  const placed = setPlacement(emptyFrozen(), 'c1', 's1', 'S');
  assert.equal(placed.placements.c1.s1, 'S');
  const cleared = setPlacement(placed, 'c1', 's1', null);
  assert.equal('s1' in cleared.placements.c1, false);
});

test('applyPreset builds valid data for every preset', () => {
  for (const preset of PRESETS) {
    const data = applyPreset(preset);
    assert.deepEqual(validateData(data), [], preset.id);
    assert.deepEqual(data.placements, {});
  }
});

test('sample and empty presets have the specified content', () => {
  const sample = applyPreset(PRESETS.find((p) => p.id === 'sample'));
  assert.deepEqual(sample.subjects.map((s) => s.name), Array.from({ length: 10 }, (_, i) => `후보 ${i + 1}`));
  assert.deepEqual(sample.criteria.map((c) => c.name), ['참신성', '실현 가능성', '시장성', '완성도']);
  const empty = applyPreset(PRESETS.find((p) => p.id === 'empty'));
  assert.equal(empty.subjects.length, 0);
  assert.equal(empty.criteria.length, 0);
});

test('preset source is never mutated', () => {
  const snapshot = structuredClone(PRESETS);
  PRESETS.forEach(deepFreeze);
  for (const preset of PRESETS) {
    const data = applyPreset(preset);
    renameCriterion(addSubject(data, '추가'), 'c1', '바뀜');
  }
  assert.deepEqual(PRESETS, snapshot);
});

test('setAllowPreview turns the option on and off without touching other data', () => {
  const on = setAllowPreview(base(), true);
  assert.equal(on.settings.allowPreview, true);
  assert.equal(setAllowPreview(on, false).settings.allowPreview, false);
  assert.deepEqual(on.subjects, base().subjects);
});

test('other edits keep the preview option', () => {
  const on = deepFreeze(setAllowPreview(structuredClone(base()), true));
  assert.equal(removeSubject(on, 's1').settings.allowPreview, true);
  assert.equal(addCriterion(on, '새 기준').settings.allowPreview, true);
});

test('applyPreset starts with preview off', () => {
  assert.equal(applyPreset(PRESETS[0]).settings?.allowPreview ?? false, false);
});
