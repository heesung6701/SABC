export const TIERS = ['S', 'A', 'B', 'C'];
export const TIER_POINTS = { S: 4, A: 3, B: 2, C: 1 };

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
  if (missing > 0) return { status: 'locked', missing, rows: [] };

  const better = (a, b) => a.total > b.total || (a.total === b.total && a.sCount > b.sCount);
  const ranked = rows.map((row) => ({ ...row, rank: 1 + rows.filter((other) => better(other, row)).length }));
  ranked.sort((a, b) => a.rank - b.rank);
  return { status: 'ready', missing: 0, rows: ranked };
}

export function progress(data, criterionId) {
  const placements = data.placements[criterionId] ?? {};
  const placed = data.subjects.filter((s) => TIERS.includes(placements[s.id])).length;
  return { placed, total: data.subjects.length };
}
