import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportSheetCsv, importSheetCsv, exportCriteriaJson, parseCriteriaJson, parseCsv, validateData } from '../web/js/core.js';
import { replaceCriteria } from '../web/js/model.js';

const data = {
  version: 1,
  subjects: [{ id: 's1', name: '김,철수' }, { id: 's2', name: '영희' }],
  criteria: [{ id: 'c1', name: '참신성', description: 'd', points: { S: 9, A: 6, B: 3, C: 1 } }, { id: 'c2', name: '"완성도"' }],
  placements: { c1: { s1: 'S', s2: 'C' }, c2: { s1: 'A' } },
};

test('csv round-trips subjects and placements (quotes, commas, BOM)', () => {
  const csv = exportSheetCsv(data);
  assert.ok(csv.startsWith('﻿'));
  const { data: back, errors } = importSheetCsv(data, csv);
  assert.deepEqual(errors, []);
  assert.deepEqual(back, data);
});

test('csv import reports unknown column, bad tier, duplicate subject', () => {
  assert.match(importSheetCsv(data, '대상자,없는기준\n가,S').errors[0], /없는기준/);
  assert.match(importSheetCsv(data, '대상자,참신성\n가,Z').errors[0], /2행/);
  assert.match(importSheetCsv(data, '대상자,참신성\n가,S\n가,A').errors[0], /중복/);
  assert.equal(importSheetCsv(data, '').data, null);
});

test('csv import accepts lowercase tiers, blanks, CRLF, missing columns', () => {
  const { data: d, errors } = importSheetCsv(data, '대상자,참신성\r\n가,s\r\n나,\r\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(d.placements, { c1: { s1: 'S' } });
  assert.equal(validateData(d).length, 0);
  assert.deepEqual(parseCsv('a,"b\nc"\n'), [['a', 'b\nc']]);
});

test('criteria json round-trips names/descriptions/points and clears placements', () => {
  const { criteria, errors } = parseCriteriaJson(exportCriteriaJson(data));
  assert.deepEqual(errors, []);
  const next = replaceCriteria(data, criteria);
  assert.deepEqual(next.placements, {});
  assert.equal(validateData(next).length, 0);
  assert.equal(next.criteria[0].points.S, 9);
  assert.ok(parseCriteriaJson('{x').errors.length);
  assert.ok(parseCriteriaJson('{"version":1,"criteria":[{"name":"a"},{"name":"a"}]}').errors.length);
});
