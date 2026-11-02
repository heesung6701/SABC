import { TIERS, MAX_ADJUST, adjustmentOf, adjustmentUnit, progress } from './core.js';
import { setAdjustment, setPlacement } from './model.js';
import { btnLink, callout, createApp, el, renderHeader, tabList } from './ui-common.js';

let currentCriterionId = null;
let repaintController = null;
// 화면을 다시 그릴 때 이전 말풍선의 document 리스너를 걷는다
function abortOnRepaint() {
  repaintController?.abort();
  repaintController = new AbortController();
  return repaintController.signal;
}
const expandedChips = new Set(); // 펼친 칩 `기준id:대상자id`. 다시 그려도 유지
const LONG_PRESS_MS = 500;

// 티어 라벨(S/A/B/C)을 누르면 그 기준의 티어 설명을 말풍선으로 보여준다. 바깥을 누르거나 다시 누르면 닫힌다.
function tierBoard(criterion, zone) {
  const pop = el('div', { class: 'tier-pop', role: 'status', hidden: true });
  let openTier = null;
  const close = () => { openTier = null; pop.hidden = true; };
  const board = el(
    'div',
    { class: 'board' },
    ...TIERS.map((tier) => {
      const row = el('div', { class: 'tier-row' });
      const label = el(
        'button',
        {
          type: 'button',
          class: `label tier-${tier}`,
          'aria-label': `${tier} 티어 설명 보기`,
          onclick: (e) => {
            e.stopPropagation();
            if (openTier === tier) return close();
            openTier = tier;
            const text = criterion.rubric?.[tier];
            pop.replaceChildren(
              el('b', { class: `tier-pill tier-${tier}` }, tier),
              ' ',
              text ? text : el('span', { class: 'muted' }, `${criterion.name}의 ${tier} 설명이 아직 없어요. 설정 > 기준에서 적을 수 있어요.`),
            );
            pop.style.top = `${row.offsetTop + row.offsetHeight + 4}px`;
            pop.hidden = false;
          },
        },
        tier,
      );
      row.append(label, zone(tier));
      return row;
    }),
    pop,
  );
  document.addEventListener('click', (e) => { if (!pop.contains(e.target)) close(); }, { signal: abortOnRepaint() });
  return board;
}

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

  // 롱클릭(0.5초)으로 칩을 펼치면 −/+ 버튼이 나온다. 접힌 칩은 보정 점수만 보여주고 버튼은 없다.
  const chip = (subject) => {
    const key = `${criterion.id}:${subject.id}`;
    const placed = tierOf(subject) !== null;
    const expanded = placed && expandedChips.has(key);
    const node = el(
      'div',
      { class: `chip${expanded ? ' expanded' : ''}`, draggable: true, ondragstart: (e) => e.dataTransfer.setData('text/plain', subject.id) },
      subject.name,
    );
    if (placed) {
      const value = adjustmentOf(data, criterion.id, subject.id);
      const unit = Number(adjustmentUnit(criterion).toFixed(4));
      const step = (delta) => commit(setAdjustment(data, criterion.id, subject.id, value + delta));
      const badge = el('span', { class: `adj-value${value !== 0 ? ' on' : ''}`, title: `보정 ${value * unit}점` }, value > 0 ? `+${value}` : String(value));
      if (expanded) {
        node.append(
          el('button', { type: 'button', class: 'adj', title: `같은 티어 안에서 -${unit}점`, disabled: value <= -MAX_ADJUST, onclick: () => step(-1) }, '−'),
          badge,
          el('button', { type: 'button', class: 'adj', title: `같은 티어 안에서 +${unit}점`, disabled: value >= MAX_ADJUST, onclick: () => step(1) }, '+'),
        );
      } else if (value !== 0) {
        node.append(badge);
      }
      node.append(el('b', { title: '미배치로 되돌리기', onclick: () => place(subject.id, null) }, '×'));

      const toggle = () => {
        if (expanded) expandedChips.delete(key);
        else expandedChips.add(key);
        commit(data);
      };
      node.addEventListener('dblclick', (e) => { if (!e.target.closest('button, b')) { cancel(); toggle(); } }); // 더블클릭/더블탭도 같은 토글
      let timer = null;
      let origin = null;
      const cancel = () => { clearTimeout(timer); timer = null; };
      node.title = expanded ? '길게 누르거나 더블클릭하면 접기' : '길게 누르거나 더블클릭하면 보정(−/+) 펼치기';
      node.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, b')) return;
        origin = { x: e.clientX, y: e.clientY };
        timer = setTimeout(() => { timer = null; toggle(); }, LONG_PRESS_MS);
      });
      node.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 6) cancel(); });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'dragstart']) node.addEventListener(type, cancel);
      node.addEventListener('contextmenu', (e) => e.preventDefault()); // 터치 롱프레스 메뉴 방지
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
    ...(TIERS.some((tier) => criterion.rubric?.[tier])
      ? [
          el(
            'details',
            { class: 'rubric' },
            el('summary', {}, '티어 설명'),
            ...TIERS.filter((tier) => criterion.rubric[tier]).map((tier) => el('p', { class: 'desc' }, el('b', { class: `tier-pill tier-${tier}` }, tier), ' ', criterion.rubric[tier])),
          ),
        ]
      : []),
    el('p', { class: 'muted' }, `${criterion.name} · ${current.placed}/${current.total} 배치 — 대상자를 끌어서 티어에 놓으세요`),
    tierBoard(criterion, zone),
    el('div', { class: 'pool-box' }, el('p', { class: 'muted' }, '미배치'), zone(null)),
  );
});
