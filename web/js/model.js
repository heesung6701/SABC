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
    criteria: preset.criteria.map((name, i) => ({ id: `c${i + 1}`, name })),
    placements: {},
  };
}
