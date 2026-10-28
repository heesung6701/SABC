import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData } from '../web/js/core.js';
import { STORAGE_KEY, createStore } from '../web/js/store.js';

const sample = JSON.parse(
  readFileSync(new URL('./fixtures/scoring.json', import.meta.url), 'utf-8'),
).find((c) => c.name === 'ranking-1-1-3').data;

function fakeStorage(overrides = {}) {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    ...overrides,
  };
}

test('load on empty storage returns emptyData', () => {
  assert.deepEqual(createStore(fakeStorage()).load(), emptyData());
});

test('save then load round-trips under the tier-eval-v1 key', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  assert.equal(store.save(sample), true);
  assert.equal(STORAGE_KEY, 'tier-eval-v1');
  assert.ok(storage.map.has('tier-eval-v1'));
  assert.deepEqual(store.load(), sample);
});

test('corrupt JSON falls back to emptyData', () => {
  const storage = fakeStorage();
  storage.map.set(STORAGE_KEY, '{x');
  assert.deepEqual(createStore(storage).load(), emptyData());
});

test('invalid data falls back to emptyData', () => {
  const storage = fakeStorage();
  storage.map.set(STORAGE_KEY, JSON.stringify({ ...sample, version: 9 }));
  assert.deepEqual(createStore(storage).load(), emptyData());
});

test('storage that throws on read falls back to emptyData', () => {
  const storage = fakeStorage({ getItem: () => { throw new Error('denied'); } });
  assert.deepEqual(createStore(storage).load(), emptyData());
});

test('save returns false when setItem throws', () => {
  const storage = fakeStorage({ setItem: () => { throw new Error('quota'); } });
  assert.equal(createStore(storage).save(sample), false);
});

test('missing storage degrades to emptyData and failed saves', () => {
  const store = createStore(null);
  assert.deepEqual(store.load(), emptyData());
  assert.equal(store.save(sample), false);
});

test('clear removes the key', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.save(sample);
  store.clear();
  assert.equal(storage.map.has(STORAGE_KEY), false);
});
