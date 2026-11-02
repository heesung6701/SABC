export const TIERS = ['S', 'A', 'B', 'C'];
export const TIER_POINTS = { S: 30, A: 20, B: 15, C: 10 };

export function emptyData() {
  return { version: 1, subjects: [], criteria: [], placements: {} };
}

export function pointsFor(criterion) {
  return criterion.points ?? TIER_POINTS;
}

export function validatePoints(points) {
  if (points === null || typeof points !== 'object' || Array.isArray(points)) {
    return '점수표는 S/A/B/C 값을 가진 객체여야 합니다';
  }
  for (const tier of TIERS) {
    const value = points[tier];
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${tier} 점수는 숫자여야 합니다`;
    if (value < 0) return `${tier} 점수는 0 이상이어야 합니다`;
  }
  for (let i = 0; i < TIERS.length - 1; i++) {
    if (!(points[TIERS[i]] > points[TIERS[i + 1]])) {
      return `${TIERS[i]} 점수는 ${TIERS[i + 1]} 점수보다 커야 합니다`;
    }
  }
  return null;
}

function tierOf(data, criterionId, subjectId) {
  const tier = data.placements[criterionId]?.[subjectId];
  return TIERS.includes(tier) ? tier : null;
}

export function computeResults(data) {
  const { subjects, criteria } = data;
  if (subjects.length === 0 || criteria.length === 0) {
    return { status: 'empty', missing: 0, rows: [] };
  }
  let missing = 0;
  const rows = subjects.map((subject) => {
    let total = 0;
    let sCount = 0;
    const tiers = {};
    for (const criterion of criteria) {
      const tier = tierOf(data, criterion.id, subject.id);
      tiers[criterion.id] = tier;
      if (tier === null) {
        missing++;
        continue;
      }
      total += pointsFor(criterion)[tier];
      if (tier === 'S') sCount++;
    }
    // 소수 점수표의 부동소수점 오차로 동점이 갈리지 않게 반올림해서 비교한다
    return { subjectId: subject.id, name: subject.name, total: Number(total.toFixed(6)), sCount, tiers };
  });
  // 미리보기를 켜면 미배치 칸은 0점으로 계산한 임시 결과를 낸다
  if (missing > 0 && data.settings?.allowPreview !== true) return { status: 'locked', missing, rows: [] };

  const better = (a, b) => a.total > b.total || (a.total === b.total && a.sCount > b.sCount);
  const ranked = rows.map((row) => ({ ...row, rank: 1 + rows.filter((other) => better(other, row)).length }));
  ranked.sort((a, b) => a.rank - b.rank);
  return { status: missing > 0 ? 'preview' : 'ready', missing, rows: ranked };
}

export function progress(data, criterionId) {
  const placements = data.placements[criterionId] ?? {};
  const placed = data.subjects.filter((s) => TIERS.includes(placements[s.id])).length;
  return { placed, total: data.subjects.length };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateData(data) {
  if (!isObject(data)) return ['data: 객체여야 합니다'];
  const errors = [];
  if (data.version !== 1) errors.push('version: 1이어야 합니다');
  if (data.settings !== undefined) {
    if (!isObject(data.settings)) errors.push('settings: 객체여야 합니다');
    else if (data.settings.allowPreview !== undefined && typeof data.settings.allowPreview !== 'boolean') {
      errors.push('settings.allowPreview: true 또는 false여야 합니다');
    }
  }

  const ids = { subjects: new Set(), criteria: new Set() };
  for (const key of ['subjects', 'criteria']) {
    if (!Array.isArray(data[key])) {
      errors.push(`${key}: 배열이어야 합니다`);
      continue;
    }
    data[key].forEach((item, i) => {
      const path = `${key}[${i}]`;
      if (!isObject(item)) {
        errors.push(`${path}: 객체여야 합니다`);
        return;
      }
      if (typeof item.id !== 'string' || item.id === '') {
        errors.push(`${path}.id: 비어 있지 않은 문자열이어야 합니다`);
      } else if (ids[key].has(item.id)) {
        errors.push(`${path}.id: 중복된 id입니다 (${item.id})`);
      } else {
        ids[key].add(item.id);
      }
      if (typeof item.name !== 'string' || item.name.trim() === '') {
        errors.push(`${path}.name: 비어 있지 않은 문자열이어야 합니다`);
      }
      if (key === 'criteria' && item.description !== undefined && typeof item.description !== 'string') {
        errors.push(`${path}.description: 문자열이어야 합니다`);
      }
      if (key === 'criteria' && item.points !== undefined) {
        const message = validatePoints(item.points);
        if (message) errors.push(`${path}.points: ${message}`);
      }
    });
  }

  if (!isObject(data.placements)) {
    errors.push('placements: 객체여야 합니다');
    return errors;
  }
  for (const [criterionId, byCriterion] of Object.entries(data.placements)) {
    if (!ids.criteria.has(criterionId)) {
      errors.push(`placements.${criterionId}: 존재하지 않는 기준입니다`);
      continue;
    }
    if (!isObject(byCriterion)) {
      errors.push(`placements.${criterionId}: 객체여야 합니다`);
      continue;
    }
    for (const [subjectId, tier] of Object.entries(byCriterion)) {
      if (!ids.subjects.has(subjectId)) {
        errors.push(`placements.${criterionId}.${subjectId}: 존재하지 않는 대상자입니다`);
      } else if (!TIERS.includes(tier)) {
        errors.push(`placements.${criterionId}.${subjectId}: 티어는 S/A/B/C 중 하나여야 합니다`);
      }
    }
  }
  return errors;
}

export function parseImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { data: null, errors: [`JSON 형식이 올바르지 않습니다: ${error.message}`] };
  }
  const errors = validateData(parsed);
  return errors.length > 0 ? { data: null, errors } : { data: parsed, errors: [] };
}

export function exportJson(data) {
  return JSON.stringify(data, null, 2);
}

export function parseNames(text) {
  return text
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

// ---- 워크스페이스: 평가(대상자+기준+배치) 여러 개를 담는 최상위 저장 형식 ----

export function emptyWorkspace() {
  return { version: 2, activeId: 'e1', evaluations: [{ id: 'e1', name: '평가 1', data: emptyData() }] };
}

// 저장된 값을 워크스페이스로 바꾼다. 예전 단일 평가 데이터(version 1)는 평가 하나로 감싼다. 못 읽으면 null.
export function toWorkspace(raw) {
  if (isObject(raw) && raw.version === 1 && raw.evaluations === undefined) {
    return validateData(raw).length === 0 ? { version: 2, activeId: 'e1', evaluations: [{ id: 'e1', name: '평가 1', data: raw }] } : null;
  }
  return validateWorkspace(raw).length === 0 ? raw : null;
}

export function validateWorkspace(ws) {
  if (!isObject(ws)) return ['workspace: 객체여야 합니다'];
  const errors = [];
  if (ws.version !== 2) errors.push('version: 2여야 합니다');
  if (!Array.isArray(ws.evaluations) || ws.evaluations.length === 0) {
    errors.push('evaluations: 1개 이상의 배열이어야 합니다');
    return errors;
  }
  const ids = new Set();
  ws.evaluations.forEach((ev, i) => {
    const path = `evaluations[${i}]`;
    if (!isObject(ev)) return errors.push(`${path}: 객체여야 합니다`);
    if (typeof ev.id !== 'string' || ev.id === '' || ids.has(ev.id)) errors.push(`${path}.id: 비어 있지 않은 고유 문자열이어야 합니다`);
    else ids.add(ev.id);
    if (typeof ev.name !== 'string' || ev.name.trim() === '') errors.push(`${path}.name: 비어 있지 않은 문자열이어야 합니다`);
    for (const message of validateData(ev.data)) errors.push(`${path}.data.${message}`);
  });
  if (!ids.has(ws.activeId)) errors.push('activeId: 존재하는 평가 id여야 합니다');
  return errors;
}

// ---- 대상자+평가표 CSV (엑셀에서 열고 저장 가능) ----
// 첫 열은 대상자 이름, 나머지 열은 기준 이름이고 칸에는 S/A/B/C 또는 빈칸을 쓴다.

const csvCell = (value) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

// 엑셀이 한글 UTF-8로 인식하도록 맨 앞에 BOM을 붙인다
export function exportSheetCsv(data) {
  const lines = [['대상자', ...data.criteria.map((c) => c.name)], ...data.subjects.map((s) => [s.name, ...data.criteria.map((c) => data.placements[c.id]?.[s.id] ?? '')])];
  return '\uFEFF' + lines.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// 따옴표·줄바꿈·구분자를 지원하는 최소 CSV 파서. 엑셀의 세미콜론/탭 구분은 지원하지 않는다.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// CSV로 대상자와 배치를 교체한다. 기준은 현재 기준과 이름으로 맞춘다. 오류가 있으면 data는 null.
export function importSheetCsv(data, text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { data: null, errors: ['비어 있는 파일입니다'] };
  const errors = [];
  const [header, ...body] = rows;
  const columns = header.slice(1).map((name) => name.trim());
  const byName = new Map(data.criteria.map((c) => [c.name, c]));
  const seen = new Set();
  columns.forEach((name, i) => {
    if (!byName.has(name)) errors.push(`${i + 2}열 '${name}': 현재 기준에 없는 이름입니다. 기준을 먼저 설정하거나 가져오세요`);
    else if (seen.has(name)) errors.push(`${i + 2}열 '${name}': 중복된 기준 열입니다`);
    seen.add(name);
  });
  const subjects = [];
  const placements = {};
  const names = new Set();
  body.forEach((cells, r) => {
    const name = (cells[0] ?? '').trim();
    if (name === '') return errors.push(`${r + 2}행: 대상자 이름이 비어 있습니다`);
    if (names.has(name)) return errors.push(`${r + 2}행 '${name}': 중복된 대상자입니다`);
    names.add(name);
    const id = `s${subjects.length + 1}`;
    subjects.push({ id, name });
    columns.forEach((column, i) => {
      const tier = (cells[i + 1] ?? '').trim().toUpperCase();
      if (tier === '' || !byName.has(column)) return;
      if (!TIERS.includes(tier)) return errors.push(`${r + 2}행 '${name}', '${column}': 티어는 S/A/B/C 또는 빈칸이어야 합니다 (${cells[i + 1].trim()})`);
      const criterionId = byName.get(column).id;
      placements[criterionId] = { ...placements[criterionId], [id]: tier };
    });
  });
  return errors.length > 0 ? { data: null, errors } : { data: { ...data, subjects, placements }, errors: [] };
}

// ---- 평가 기준 JSON (이름·설명·점수표만. 대상자와 배치는 빠진다) ----

export function exportCriteriaJson(data) {
  return JSON.stringify({ version: 1, criteria: data.criteria.map(({ name, description, points }) => ({ name, ...(description ? { description } : {}), ...(points ? { points } : {}) })) }, null, 2);
}

export function parseCriteriaJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { criteria: null, errors: [`JSON 형식이 올바르지 않습니다: ${error.message}`] };
  }
  if (!isObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.criteria)) {
    return { criteria: null, errors: ['{ "version": 1, "criteria": [...] } 형식이어야 합니다'] };
  }
  // 임시 id를 붙여 기존 데이터 검증을 재사용한다
  const criteria = parsed.criteria.map((c, i) => (isObject(c) ? { ...c, id: `c${i + 1}` } : c));
  const errors = validateData({ version: 1, subjects: [], criteria, placements: {} });
  if (new Set(criteria.map((c) => c?.name)).size !== criteria.length) errors.push('criteria: 기준 이름이 중복되었습니다');
  return errors.length > 0 ? { criteria: null, errors } : { criteria, errors: [] };
}
