import { TIERS, progress } from './core.js';
import { setPlacement } from './model.js';
import { btnLink, callout, createApp, el, renderHeader, tabList } from './ui-common.js';

let currentCriterionId = null;

createApp((data, commit) => {
  const header = renderHeader('evaluate');
  if (data.subjects.length === 0 || data.criteria.length === 0) {
    return el(
      'div',
      { class: 'page' },
      header,
      el('div', { class: 'page-head' }, el('h1', {}, '평가')),
      el(
        'div',
        { class: 'stack' },
        callout('informative', '먼저 대상자와 기준을 설정해 주세요', '설정에서 preset으로 바로 시작하거나 직접 입력할 수 있어요.'),
        el('div', {}, btnLink('설정으로 가기', 'settings.html')),
      ),
    );
  }

  const criterion = data.criteria.find((c) => c.id === currentCriterionId) ?? data.criteria[0];
  currentCriterionId = criterion.id;
  const placements = data.placements[criterion.id] ?? {};
  const tierOf = (subject) => (TIERS.includes(placements[subject.id]) ? placements[subject.id] : null);
  const place = (subjectId, tier) => commit(setPlacement(data, criterion.id, subjectId, tier));

  const chip = (subject) => {
    const node = el(
      'div',
      { class: 'chip', draggable: true, ondragstart: (e) => e.dataTransfer.setData('text/plain', subject.id) },
      subject.name,
    );
    if (tierOf(subject) !== null) {
      node.append(el('b', { title: '미배치로 되돌리기', onclick: () => place(subject.id, null) }, '×'));
    }
    return node;
  };

  // tier가 null이면 미배치 풀
  const zone = (tier) => {
    const node = el('div', { class: 'zone' }, ...data.subjects.filter((s) => tierOf(s) === tier).map(chip));
    node.addEventListener('dragover', (e) => {
      e.preventDefault();
      node.classList.add('over');
    });
    node.addEventListener('dragleave', () => node.classList.remove('over'));
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      node.classList.remove('over');
      const subjectId = e.dataTransfer.getData('text/plain');
      if (data.subjects.some((s) => s.id === subjectId)) place(subjectId, tier);
    });
    return node;
  };

  const perCriterion = data.criteria.map((c) => ({ c, ...progress(data, c.id) }));
  const totalCells = perCriterion.reduce((sum, p) => sum + p.total, 0);
  const placedCells = perCriterion.reduce((sum, p) => sum + p.placed, 0);
  const current = perCriterion.find((p) => p.c.id === criterion.id);
  const done = placedCells === totalCells;
  const percent = totalCells === 0 ? 0 : Math.round((placedCells / totalCells) * 100);

  return el(
    'div',
    { class: 'page' },
    header,
    el(
      'div',
      { class: 'page-head' },
      el('div', { class: 'grow' }, el('h1', {}, '평가'), el('p', { class: 'muted' }, `전체 ${placedCells}/${totalCells} 배치`)),
      btnLink(done ? '결과 보기' : '결과 미리 보기', 'result.html', { variant: done ? 'brandSolid' : 'neutralWeak' }),
    ),
    el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, el('span', { style: `width:${percent}%` })),
    el(
      'div',
      { class: 'criteria-tabs' },
      tabList(
        perCriterion.map(({ c, placed, total }) => ({
          key: c.id,
          label: `${c.name} ${placed}/${total}`,
          onclick: () => {
            currentCriterionId = c.id;
            commit(data);
          },
        })),
        criterion.id,
      ),
    ),
    ...(criterion.description ? [el('p', { class: 'desc' }, criterion.description)] : []),
    el('p', { class: 'muted' }, `${criterion.name} · ${current.placed}/${current.total} 배치 — 대상자를 끌어서 티어에 놓으세요`),
    el('div', { class: 'board' }, ...TIERS.map((tier) => el('div', { class: 'tier-row' }, el('div', { class: `label tier-${tier}` }, tier), zone(tier)))),
    el('div', { class: 'pool-box' }, el('p', { class: 'muted' }, '미배치'), zone(null)),
  );
});
