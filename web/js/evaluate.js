import { TIERS, progress } from './core.js';
import { setPlacement } from './model.js';
import { createApp, el, renderNav } from './ui-common.js';

let currentCriterionId = null;

createApp((data, commit) => {
  const page = el('div', {}, renderNav('evaluate'), el('h1', {}, '평가'));
  if (data.subjects.length === 0 || data.criteria.length === 0) {
    page.append(
      el('p', {}, '설정 페이지에서 대상자와 기준을 먼저 입력하세요. ', el('a', { href: 'settings.html' }, '설정으로 이동')),
    );
    return page;
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
      node.append(el('b', { title: '풀로 되돌리기', onclick: () => place(subject.id, null) }, '×'));
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

  const { placed, total } = progress(data, criterion.id);
  page.append(
    el(
      'div',
      { class: 'tabs' },
      ...data.criteria.map((c) =>
        el('button', { class: c.id === criterion.id ? 'on' : '', onclick: () => { currentCriterionId = c.id; commit(data); } }, c.name),
      ),
    ),
    ...(criterion.description ? [el('p', { class: 'desc' }, criterion.description)] : []),
    el('p', { class: 'muted' }, `진행률 ${placed}/${total}`),
    ...TIERS.map((tier) => el('div', { class: 'row' }, el('div', { class: `label tier-${tier}` }, tier), zone(tier))),
    el('div', { class: 'pool' }, el('p', { class: 'muted' }, '미배치'), zone(null)),
  );
  return page;
});
