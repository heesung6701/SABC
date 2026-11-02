import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateWorkspace } from '../web/js/core.js';
import {
  activeEvaluation, updateActive, addEvaluation, renameEvaluation, switchEvaluation, removeEvaluation, moveEvaluation, addSubject,
} from '../web/js/model.js';

test('addEvaluation creates an empty evaluation and switches to it', () => {
  const ws = addEvaluation(emptyWorkspace(), ' 2분기 ');
  assert.equal(ws.evaluations.length, 2);
  assert.equal(activeEvaluation(ws).name, '2분기');
  assert.equal(activeEvaluation(ws).data.subjects.length, 0);
  assert.equal(addEvaluation(emptyWorkspace(), '').evaluations[1].name, '평가 2');
  assert.deepEqual(validateWorkspace(ws), []);
});

test('updateActive only touches the active evaluation', () => {
  let ws = updateActive(emptyWorkspace(), (d) => addSubject(d, '철수'));
  ws = addEvaluation(ws, 'B');
  ws = updateActive(ws, (d) => addSubject(d, '영희'));
  assert.deepEqual(ws.evaluations.map((e) => e.data.subjects.map((s) => s.name)), [['철수'], ['영희']]);
});

test('switch, rename, move', () => {
  let ws = addEvaluation(emptyWorkspace(), 'B');
  ws = switchEvaluation(ws, 'e1');
  assert.equal(ws.activeId, 'e1');
  assert.equal(switchEvaluation(ws, 'nope'), ws);
  ws = renameEvaluation(ws, 'e1', 'A');
  assert.equal(renameEvaluation(ws, 'e1', '  '), ws);
  ws = moveEvaluation(ws, 'e1', 1);
  assert.deepEqual(ws.evaluations.map((e) => e.name), ['B', 'A']);
  assert.equal(moveEvaluation(ws, 'e1', 1), ws);
});

test('removeEvaluation keeps at least one and re-points the active id', () => {
  const one = emptyWorkspace();
  assert.equal(removeEvaluation(one, 'e1'), one);
  let ws = addEvaluation(addEvaluation(one, 'B'), 'C'); // active e3
  ws = removeEvaluation(ws, 'e3');
  assert.equal(ws.activeId, 'e2');
  ws = removeEvaluation(ws, 'e1');
  assert.equal(ws.activeId, 'e2');
  assert.deepEqual(validateWorkspace(ws), []);
  // id는 지운 뒤에도 재사용하지 않는다: 마지막 번호 +1
  assert.equal(addEvaluation(ws, 'D').activeId, 'e3');
});

test('validateWorkspace rejects bad shapes', () => {
  assert.ok(validateWorkspace({ version: 2, activeId: 'x', evaluations: [] }).length > 0);
  const ws = emptyWorkspace();
  assert.ok(validateWorkspace({ ...ws, activeId: 'zzz' }).length > 0);
  assert.ok(validateWorkspace({ ...ws, evaluations: [...ws.evaluations, ws.evaluations[0]] }).length > 0);
});
