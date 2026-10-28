import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIER_POINTS,
  pointsFor,
  validatePoints,
  computeResults,
  progress,
  validateData,
  parseImportJson,
  exportJson,
  parseNames,
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

const validBase = () => structuredClone(byName('ranking-1-1-3').data);

test('validateData accepts valid data', () => {
  assert.deepEqual(validateData(validBase()), []);
});

test('validateData reports the location of each problem', () => {
  const mutations = [
    ['version', (d) => { d.version = 2; }],
    ['subjects', (d) => { d.subjects[1].id = 's1'; }],
    ['subjects[0].name', (d) => { d.subjects[0].name = ''; }],
    ['criteria', (d) => { d.criteria[1].id = 'c1'; }],
    ['criteria[0].points', (d) => { d.criteria[0].points = { S: 1, A: 1, B: 0, C: 0 }; }],
    ['placements.c9', (d) => { d.placements.c9 = {}; }],
    ['placements.c1.s9', (d) => { d.placements.c1.s9 = 'S'; }],
    ['placements.c1.s1', (d) => { d.placements.c1.s1 = 'X'; }],
  ];
  for (const [path, mutate] of mutations) {
    const data = validBase();
    mutate(data);
    const errors = validateData(data);
    assert.ok(errors.length > 0, `${path}: no errors`);
    assert.ok(errors.join('\n').includes(path), `${path}: got ${errors.join(' | ')}`);
  }
});

test('validateData never throws on garbage', () => {
  for (const garbage of [null, [], 'x', 42, {}, { version: 1, subjects: {} }]) {
    const errors = validateData(garbage);
    assert.ok(Array.isArray(errors) && errors.length > 0, JSON.stringify(garbage));
  }
});

test('validateData rejects a __proto__ placements key without polluting', () => {
  const data = JSON.parse('{"version":1,"subjects":[],"criteria":[],"placements":{"__proto__":{"x":"S"}}}');
  assert.ok(validateData(data).length > 0);
  assert.equal({}.x, undefined);
});

test('parseImportJson reports broken JSON', () => {
  const result = parseImportJson('{broken');
  assert.equal(result.data, null);
  assert.ok(result.errors[0].includes('JSON'));
});

test('parseImportJson returns data for valid text and errors for invalid data', () => {
  const good = validBase();
  assert.deepEqual(parseImportJson(JSON.stringify(good)), { data: good, errors: [] });
  const bad = parseImportJson(JSON.stringify({ ...good, version: 9 }));
  assert.equal(bad.data, null);
  assert.ok(bad.errors.length > 0);
});

test('export then import keeps data and results', () => {
  const { data } = byName('per-criterion-points');
  const { data: imported, errors } = parseImportJson(exportJson(data));
  assert.deepEqual(errors, []);
  assert.deepEqual(imported, data);
  assert.deepEqual(computeResults(imported), computeResults(data));
});

test('exportJson is indented for hand editing', () => {
  assert.ok(exportJson(validBase()).includes('\n  "version"'));
});

test('parseNames splits on newlines and commas', () => {
  assert.deepEqual(parseNames('가, 나\n다\n\n  라  ,'), ['가', '나', '다', '라']);
  assert.deepEqual(parseNames(''), []);
});

test('preview rows keep a null tier for unplaced cells', () => {
  const { rows } = computeResults(byName('preview-counts-unplaced-as-zero').data);
  assert.deepEqual(rows.find((r) => r.subjectId === 's2').tiers, { c1: null });
});

test('validateData checks the settings block', () => {
  const ok = { ...validBase(), settings: { allowPreview: true } };
  assert.deepEqual(validateData(ok), []);
  assert.ok(validateData({ ...validBase(), settings: [] }).join('\n').includes('settings'));
  assert.ok(
    validateData({ ...validBase(), settings: { allowPreview: 'yes' } }).join('\n').includes('settings.allowPreview'),
  );
});

test('settings survive export then import', () => {
  const data = { ...validBase(), settings: { allowPreview: true } };
  assert.deepEqual(parseImportJson(exportJson(data)).data, data);
});

test('validateData checks criterion descriptions', () => {
  const ok = validBase();
  ok.criteria[0].description = '설명\n둘째 줄';
  assert.deepEqual(validateData(ok), []);
  const bad = validBase();
  bad.criteria[0].description = 42;
  assert.ok(validateData(bad).join('\n').includes('criteria[0].description'));
});

test('descriptions survive export then import', () => {
  const data = validBase();
  data.criteria[1].description = '두 번째 기준 설명';
  assert.deepEqual(parseImportJson(exportJson(data)).data, data);
});
