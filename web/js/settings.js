import { TIERS, TIER_POINTS, validatePoints, parseImportJson, exportJson, parseNames, emptyData } from './core.js';
import {
  addSubjects, addCriteria, renameSubject, renameCriterion, removeSubject, removeCriterion,
  moveCriterion, setPoints, applyPreset, setAllowPreview, setDescription,
} from './model.js';
import { PRESETS } from './presets.js';
import { createApp, el, renderNav } from './ui-common.js';

// 오류 영역은 한 번만 만들어 매번 다시 붙인다. 입력 중인 값이 사라지지 않도록 다시 그리지 않고 내용만 바꾼다.
const alertBox = el('div', { class: 'alert', role: 'alert', hidden: true });
function report(messages) {
  alertBox.replaceChildren(...messages.map((message) => el('p', {}, message)));
  alertBox.hidden = messages.length === 0;
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pointsEditor(criterion, apply) {
  const inputs = TIERS.map((tier) =>
    el('input', {
      type: 'number', min: '0', step: 'any',
      placeholder: String(TIER_POINTS[tier]),
      value: criterion.points?.[tier] ?? '',
      'aria-label': `${criterion.name} ${tier} 점수`,
    }),
  );
  const save = () => {
    const raw = inputs.map((input) => input.value.trim());
    if (raw.every((v) => v === '')) return apply((d) => setPoints(d, criterion.id, null));
    if (raw.some((v) => v === '')) return report(['S/A/B/C를 모두 입력하거나 모두 비워 주세요']);
    const points = Object.fromEntries(TIERS.map((tier, i) => [tier, Number(raw[i])]));
    const error = validatePoints(points);
    if (error) return report([`${criterion.name}: ${error}`]);
    return apply((d) => setPoints(d, criterion.id, points));
  };
  return el(
    'div', { class: 'points' },
    ...TIERS.flatMap((tier, i) => [el('span', {}, tier), inputs[i]]),
    el('button', { onclick: save }, '점수 적용'),
    el('button', { onclick: () => apply((d) => setPoints(d, criterion.id, null)) }, '기본으로'),
  );
}

function listSection(title, items, { rename, remove, addMany, extras }) {
  const textarea = el('textarea', { placeholder: '줄바꿈 또는 쉼표로 구분해 여러 개를 한 번에 추가', 'aria-label': `${title} 일괄 추가` });
  return el(
    'section', {},
    el('h2', {}, title),
    ...items.map((item, index) => {
      const input = el('input', { type: 'text', value: item.name, 'aria-label': `${title} 이름`, onchange: () => {
        if (input.value.trim() === '') {
          input.value = item.name;
          return;
        }
        rename(item.id, input.value);
      },
    });
      return el(
        'div', { class: 'item' },
        input,
        ...(extras ? extras(item, index) : []),
        el('button', { class: 'danger', onclick: () => confirm(`'${item.name}'을(를) 삭제하고 관련 배치도 지웁니다. 계속할까요?`) && remove(item.id) }, '삭제'),
      );
    }),
    textarea,
    el('button', { class: 'primary', onclick: () => addMany(parseNames(textarea.value)) }, '추가'),
  );
}

createApp((data, commit, current) => {
  const apply = (next, options) => { report([]); commit(next, options); };

  const presetSelect = el('select', { 'aria-label': 'preset' }, ...PRESETS.map((p) => el('option', { value: p.id }, p.name)));
    const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json',
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const { data: next, errors } = parseImportJson(await file.text());
      fileInput.value = '';
      if (errors.length > 0) return report(errors);
      if (confirm('현재 데이터를 교체합니다. 계속할까요?')) apply(next);
    },
  });

  return el(
    'div', {},
    renderNav('settings'),
    el('h1', {}, '설정'),
    alertBox,
    el(
      'section', {},
      el('h2', {}, 'Preset'),
      el('div', { class: 'row-actions' }, presetSelect, el('button', {
        onclick: () => {
          const now = current();
          if ((now.subjects.length > 0 || now.criteria.length > 0) && !confirm('현재 데이터를 교체하고 배치를 초기화합니다. 계속할까요?')) return;
          apply(applyPreset(PRESETS.find((p) => p.id === presetSelect.value)));
        },
      }, '불러오기')),
    ),
    listSection('대상자', data.subjects, {
      rename: (id, name) => apply((d) => renameSubject(d, id, name), { repaint: false }),
      remove: (id) => apply((d) => removeSubject(d, id)),
      addMany: (names) => apply((d) => addSubjects(d, names)),
    }),
    listSection('기준', data.criteria, {
      rename: (id, name) => apply((d) => renameCriterion(d, id, name), { repaint: false }),
      remove: (id) => apply((d) => removeCriterion(d, id)),
      addMany: (names) => apply((d) => addCriteria(d, names)),
      extras: (criterion) => [
        el('button', { onclick: () => apply((d) => moveCriterion(d, criterion.id, -1)) }, '↑'),
        el('button', { onclick: () => apply((d) => moveCriterion(d, criterion.id, 1)) }, '↓'),
        el('textarea', {
          class: 'desc-input',
          placeholder: '기준 설명 (선택)',
          value: criterion.description ?? '',
          'aria-label': `${criterion.name} 설명`,
          onchange: (event) => apply((d) => setDescription(d, criterion.id, event.target.value), { repaint: false }),
        }),
        pointsEditor(criterion, apply),
      ],
    }),
    el(
      'section', {},
      el('h2', {}, '결과'),
      el('label', {},
        el('input', {
          type: 'checkbox',
          checked: data.settings?.allowPreview === true,
          onchange: (event) => apply((d) => setAllowPreview(d, event.target.checked), { repaint: false }),
        }),
        ' 미배치가 남아 있어도 결과 미리보기 허용',
      ),
      el('p', { class: 'muted' }, '켜면 미배치 칸을 0점으로 계산한 임시 순위를 "미리보기"로 보여줍니다. 끄면 모두 배치해야 결과가 나옵니다.'),
    ),
    el(
      'section', {},
      el('h2', {}, 'JSON'),
      el('div', { class: 'row-actions' },
        el('button', { onclick: () => download('tier-eval.json', exportJson(current())) }, '내보내기'),
        el('label', {}, '가져오기 ', fileInput),
      ),
      el('p', { class: 'muted' }, '내보낸 파일을 직접 고쳐서 다시 가져올 수 있습니다. 가져오면 현재 데이터를 교체합니다.'),
    ),
    el(
      'section', {},
      el('h2', {}, '초기화'),
      el('button', { class: 'danger', onclick: () => confirm('모든 데이터를 지웁니다. 계속할까요?') && apply(emptyData()) }, '데이터 초기화'),
    ),
  );
});
