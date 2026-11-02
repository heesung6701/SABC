import { emptyData } from './core.js';

// 모든 함수는 새 데이터를 반환하고 입력을 변경하지 않는다.

export function nextId(prefix, items) {
  let max = 0;
  for (const { id } of items) {
    const n = Number(id.slice(prefix.length));
    if (id.startsWith(prefix) && Number.isInteger(n)) max = Math.max(max, n);
  }
  return `${prefix}${max + 1}`;
}

function addItem(data, key, prefix, name) {
  const trimmed = name.trim();
  if (trimmed === '') return data;
  return { ...data, [key]: [...data[key], { id: nextId(prefix, data[key]), name: trimmed }] };
}

function renameItem(data, key, id, name) {
  const trimmed = name.trim();
  if (trimmed === '') return data;
  return { ...data, [key]: data[key].map((item) => (item.id === id ? { ...item, name: trimmed } : item)) };
}

export const addSubject = (data, name) => addItem(data, 'subjects', 's', name);
export const addCriterion = (data, name) => addItem(data, 'criteria', 'c', name);
export const addSubjects = (data, names) => names.reduce(addSubject, data);
export const addCriteria = (data, names) => names.reduce(addCriterion, data);
export const renameSubject = (data, id, name) => renameItem(data, 'subjects', id, name);
export const renameCriterion = (data, id, name) => renameItem(data, 'criteria', id, name);

export function removeSubject(data, id) {
  const placements = Object.fromEntries(
    Object.entries(data.placements).map(([criterionId, byCriterion]) => [
      criterionId,
      Object.fromEntries(Object.entries(byCriterion).filter(([subjectId]) => subjectId !== id)),
    ]),
  );
  return { ...data, subjects: data.subjects.filter((s) => s.id !== id), placements };
}

export function removeCriterion(data, id) {
  const { [id]: _removed, ...placements } = data.placements;
  return { ...data, criteria: data.criteria.filter((c) => c.id !== id), placements };
}

export function moveCriterion(data, id, delta) {
  const from = data.criteria.findIndex((c) => c.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= data.criteria.length) return data;
  const criteria = [...data.criteria];
  [criteria[from], criteria[to]] = [criteria[to], criteria[from]];
  return { ...data, criteria };
}

export function setPoints(data, criterionId, points) {
  return {
    ...data,
    criteria: data.criteria.map((criterion) => {
      if (criterion.id !== criterionId) return criterion;
      const { points: _old, ...rest } = criterion;
      return points === null ? rest : { ...rest, points };
    }),
  };
}

export function setPlacement(data, criterionId, subjectId, tier) {
  const current = data.placements[criterionId] ?? {};
  let next;
  if (tier === null) {
    const { [subjectId]: _removed, ...rest } = current;
    next = rest;
  } else {
    next = { ...current, [subjectId]: tier };
  }
  return { ...data, placements: { ...data.placements, [criterionId]: next } };
}

export function applyPreset(preset) {
  return {
    version: 1,
    subjects: preset.subjects.map((name, i) => ({ id: `s${i + 1}`, name })),
    criteria: preset.criteria.map(({ name, description }, i) => ({
      id: `c${i + 1}`,
      name,
      ...(description ? { description } : {}),
    })),
    placements: {},
  };
}

export function setAllowPreview(data, allowed) {
  return { ...data, settings: { ...data.settings, allowPreview: allowed } };
}

export function setDescription(data, criterionId, text) {
  const trimmed = text.trim();
  return {
    ...data,
    criteria: data.criteria.map((criterion) => {
      if (criterion.id !== criterionId) return criterion;
      const { description: _old, ...rest } = criterion;
      return trimmed === '' ? rest : { ...rest, description: trimmed };
    }),
  };
}

// 기준 전체를 바꾼다. 기준 id가 새로 매겨지므로 기존 배치는 비운다.
export function replaceCriteria(data, criteria) {
  return { ...data, criteria, placements: {} };
}

// ---- 워크스페이스(평가 여러 개) ----

export const activeEvaluation = (ws) => ws.evaluations.find((e) => e.id === ws.activeId);

// 활성 평가의 data만 바꾼다
export function updateActive(ws, fn) {
  return { ...ws, evaluations: ws.evaluations.map((e) => (e.id === ws.activeId ? { ...e, data: fn(e.data) } : e)) };
}

// 새 평가를 만들고 그쪽으로 이동한다. 이름이 비면 "평가 N".
export function addEvaluation(ws, name = '') {
  const id = nextId('e', ws.evaluations);
  const label = name.trim() || `평가 ${id.slice(1)}`;
  return { ...ws, activeId: id, evaluations: [...ws.evaluations, { id, name: label, data: emptyData() }] };
}

export function renameEvaluation(ws, id, name) {
  const trimmed = name.trim();
  if (trimmed === '') return ws;
  return { ...ws, evaluations: ws.evaluations.map((e) => (e.id === id ? { ...e, name: trimmed } : e)) };
}

export function switchEvaluation(ws, id) {
  return ws.evaluations.some((e) => e.id === id) ? { ...ws, activeId: id } : ws;
}

// 마지막 하나는 지울 수 없다. 활성 평가를 지우면 앞 평가(없으면 다음)로 옮긴다.
export function removeEvaluation(ws, id) {
  const index = ws.evaluations.findIndex((e) => e.id === id);
  if (index < 0 || ws.evaluations.length === 1) return ws;
  const evaluations = ws.evaluations.filter((e) => e.id !== id);
  const activeId = ws.activeId === id ? evaluations[Math.max(0, index - 1)].id : ws.activeId;
  return { ...ws, activeId, evaluations };
}

// 평가 순서를 옮긴다
export function moveEvaluation(ws, id, delta) {
  const from = ws.evaluations.findIndex((e) => e.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ws.evaluations.length) return ws;
  const evaluations = [...ws.evaluations];
  [evaluations[from], evaluations[to]] = [evaluations[to], evaluations[from]];
  return { ...ws, evaluations };
}
