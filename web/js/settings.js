import { TIERS, TIER_POINTS, pointsFor, validatePoints, parseImportJson, exportJson, parseNames, emptyData } from './core.js';
import {
  addSubject, addSubjects, addCriterion, addCriteria, renameSubject, renameCriterion, removeSubject,
  removeCriterion, moveCriterion, setPoints, setDescription, applyPreset, setAllowPreview,
} from './model.js';
import { PRESETS } from './presets.js';
import { btn, btnLink, callout, createApp, el, field, renderHeader, switchControl, tabList, textInput } from './ui-common.js';

const TABS = [
  ['subjects', '대상자'],
  ['criteria', '기준'],
  ['options', '옵션'],
  ['data', '데이터'],
];
const hashTab = location.hash.slice(1);
let activeTab = TABS.some(([key]) => key === hashTab) ? hashTab : 'subjects';
const openPoints = new Set(); // 점수 편집기가 열려 있는 기준 id
const bulkOpen = { subjects: false, criteria: false };
let focusTarget = null; // 다시 그린 뒤 입력창으로 돌려보낼 곳

// 가져오기 오류처럼 페이지 단위로 알릴 메시지. 다시 그리지 않고 내용만 바꿔 입력 중인 값을 지키지 않는다.
const messageBox = el('div', { hidden: true });
function report(messages) {
  const content =
    messages.length === 0
      ? []
      : [callout('critical', messages.length === 1 ? messages[0] : '가져오기에 실패했습니다', ...(messages.length > 1 ? messages.map((m) => el('div', {}, m)) : []))];
  messageBox.replaceChildren(...content);
  messageBox.hidden = messages.length === 0;
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 파일 선택 버튼 + 숨은 input. 읽은 JSON이 유효하고 사용자가 확인하면 data를 교체한다.
function importControl(apply) {
  const input = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const file = input.files[0];
      if (!file) return;
      const { data: next, errors } = parseImportJson(await file.text());
      input.value = '';
      if (errors.length > 0) return report(errors);
      if (confirm('현재 데이터를 교체합니다. 계속할까요?')) apply(next);
    },
  });
  return [btn('JSON 파일 가져오기', { onclick: () => input.click() }), input];
}

function presetList(apply, current, label) {
  return el(
    'div',
    { class: 'list' },
    ...PRESETS.map((preset) =>
      el(
        'div',
        { class: 'seed-list-item__root' },
        el('div', { class: 'seed-list-item__content' }, el('div', { class: 'seed-list-item__title' }, preset.name), el('div', { class: 'seed-list-item__detail' }, preset.summary)),
        el('div', { class: 'seed-list-item__suffix' }, btn(label, {
          onclick: () => {
            const now = current();
            const hasData = now.subjects.length > 0 || now.criteria.length > 0;
            if (hasData && !confirm('현재 데이터를 교체하고 배치를 초기화합니다. 계속할까요?')) return;
            activeTab = preset.criteria.length > 0 && preset.subjects.length === 0 ? 'subjects' : activeTab;
            apply(applyPreset(preset));
          },
        })),
      ),
    ),
  );
}

// 이름 목록 편집(대상자·기준 공통): 한 줄 추가 + 여러 개 붙여넣기 + 이름 수정/삭제
function nameAdder({ kind, noun, placeholder, apply, refresh, addOne, addMany }) {
  const single = textInput({
    label: `${noun} 이름`,
    placeholder,
    onenter: () => submit(),
  });
  single.setAttribute('data-focus', `${kind}-add`);
  const submit = () => {
    const value = single.control.value;
    if (value.trim() === '') return;
    focusTarget = `${kind}-add`;
    apply((d) => addOne(d, value));
  };
  const bulk = bulkOpen[kind]
    ? (() => {
        const area = textInput({ multiline: true, label: `${noun} 일괄 추가`, placeholder: '줄바꿈 또는 쉼표로 구분해 여러 개를 한 번에 입력' });
        return el(
          'div',
          { class: 'stack' },
          area,
          btn('모두 추가', {
            variant: 'neutralSolid',
            onclick: () => {
              const names = parseNames(area.control.value);
              if (names.length > 0) apply((d) => addMany(d, names));
            },
          }),
        );
      })()
    : null;
  return el(
    'div',
    { class: 'stack' },
    el('div', { class: 'row' }, single, btn('추가', { variant: 'brandSolid', onclick: submit })),
    btn(bulkOpen[kind] ? '붙여넣기 닫기' : '여러 개를 한꺼번에 붙여넣기', {
      variant: 'ghost',
      size: 'small',
      onclick: () => {
        bulkOpen[kind] = !bulkOpen[kind];
        refresh();
      },
    }),
    bulk,
  );
}

function subjectsPanel(data, apply, refresh) {
  return el(
    'div',
    { class: 'stack' },
    el('h2', {}, `대상자 ${data.subjects.length}명`),
    nameAdder({
      kind: 'subjects', noun: '대상자', placeholder: '이름을 입력하고 Enter', apply, refresh,
      addOne: addSubject, addMany: addSubjects,
    }),
    data.subjects.length === 0
      ? el('p', { class: 'muted' }, '아직 대상자가 없어요. 평가받는 사람이나 항목의 이름을 추가해 주세요.')
      : el(
          'div',
          { class: 'stack' },
          ...data.subjects.map((subject) => {
            const field = textInput({
              value: subject.name,
              label: '대상자 이름',
              onchange: () => {
                if (field.control.value.trim() === '') {
                  field.control.value = subject.name;
                  return;
                }
                apply((d) => renameSubject(d, subject.id, field.control.value), { repaint: false });
              },
            });
            return el(
              'div',
              { class: 'row' },
              field,
              btn('삭제', {
                variant: 'ghost', danger: true,
                onclick: () => confirm(`'${subject.name}'을(를) 삭제하고 관련 배치도 지웁니다. 계속할까요?`) && apply((d) => removeSubject(d, subject.id)),
              }),
            );
          }),
        ),
  );
}

function pointPills(points) {
  return el('div', { class: 'row wrap' }, ...TIERS.map((tier) => el('span', { class: `tier-pill tier-${tier}` }, `${tier} ${points[tier]}`)));
}

function criterionCard(criterion, index, total, apply, refresh) {
  const custom = criterion.points !== undefined;
  const editing = openPoints.has(criterion.id);

  const nameField = textInput({
    value: criterion.name,
    label: '기준 이름',
    onchange: () => {
      if (nameField.control.value.trim() === '') {
        nameField.control.value = criterion.name;
        return;
      }
      apply((d) => renameCriterion(d, criterion.id, nameField.control.value), { repaint: false });
    },
  });
  const descField = textInput({
    value: criterion.description ?? '',
    multiline: true,
    label: `${criterion.name} 설명`,
    placeholder: '이 기준에서 무엇을 보는지 적어 두면 평가할 때 화면에 보여요 (선택)',
    onchange: () => apply((d) => setDescription(d, criterion.id, descField.control.value), { repaint: false }),
  });

  const errorSlot = el('div', { hidden: true });
  const showError = (message) => {
    errorSlot.replaceChildren(...(message ? [callout('critical', message)] : []));
    errorSlot.hidden = !message;
  };

  const fields = TIERS.map((tier) =>
    textInput({
      type: 'number', min: '0', step: 'any',
      label: `${criterion.name} ${tier} 점수`,
      placeholder: String(TIER_POINTS[tier]),
      value: criterion.points?.[tier] !== undefined ? String(criterion.points[tier]) : '',
    }),
  );
  const savePoints = () => {
    if (fields.some((f) => f.control.validity.badInput)) return showError('점수는 숫자만 입력할 수 있어요');
    const raw = fields.map((f) => f.control.value.trim());
    if (raw.every((v) => v === '')) {
      openPoints.delete(criterion.id);
      return apply((d) => setPoints(d, criterion.id, null));
    }
    if (raw.some((v) => v === '')) return showError('S, A, B, C 점수를 모두 입력하거나 모두 비워 주세요');
    const points = Object.fromEntries(TIERS.map((tier, i) => [tier, Number(raw[i])]));
    const error = validatePoints(points);
    if (error) return showError(error);
    openPoints.delete(criterion.id);
    return apply((d) => setPoints(d, criterion.id, points));
  };

  return el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'row' },
      nameField,
      btn('↑', { variant: 'ghost', disabled: index === 0, title: '위로', onclick: () => apply((d) => moveCriterion(d, criterion.id, -1)) }),
      btn('↓', { variant: 'ghost', disabled: index === total - 1, title: '아래로', onclick: () => apply((d) => moveCriterion(d, criterion.id, 1)) }),
      btn('삭제', {
        variant: 'ghost', danger: true,
        onclick: () => confirm(`'${criterion.name}'을(를) 삭제하고 관련 배치도 지웁니다. 계속할까요?`) && apply((d) => removeCriterion(d, criterion.id)),
      }),
    ),
    field('설명', descField),
    el(
      'div',
      { class: 'card-head' },
      el('div', { class: 'stack' }, pointPills(pointsFor(criterion)), el('span', { class: 'muted' }, custom ? '이 기준만의 점수표' : '기본 점수표')),
      btn(editing ? '접기' : '점수 수정', {
        variant: 'ghost', size: 'small',
        onclick: () => {
          if (editing) openPoints.delete(criterion.id);
          else openPoints.add(criterion.id);
          refresh();
        },
      }),
    ),
    editing
      ? el(
          'div',
          { class: 'stack' },
          el('div', { class: 'points-grid' }, ...TIERS.map((tier, i) => el('div', { class: 'point-field' }, el('span', { class: `tier-pill tier-${tier}` }, tier), fields[i]))),
          errorSlot,
          el(
            'div',
            { class: 'row wrap' },
            btn('점수 적용', { variant: 'brandSolid', onclick: savePoints }),
            btn('기본 점수표로 되돌리기', {
              variant: 'ghost',
              onclick: () => {
                openPoints.delete(criterion.id);
                apply((d) => setPoints(d, criterion.id, null));
              },
            }),
          ),
          el('p', { class: 'muted' }, 'S > A > B > C 순서여야 하고, 비워 두면 기본 점수표를 써요.'),
        )
      : null,
  );
}

function criteriaPanel(data, apply, refresh) {
  return el(
    'div',
    { class: 'stack' },
    el('h2', {}, `기준 ${data.criteria.length}개`),
    nameAdder({
      kind: 'criteria', noun: '기준', placeholder: '기준 이름을 입력하고 Enter', apply, refresh,
      addOne: addCriterion, addMany: addCriteria,
    }),
    data.criteria.length === 0
      ? el('p', { class: 'muted' }, '아직 기준이 없어요. 무엇을 기준으로 티어를 나눌지 추가해 주세요.')
      : el('div', { class: 'stack' }, ...data.criteria.map((criterion, i) => criterionCard(criterion, i, data.criteria.length, apply, refresh))),
  );
}

function optionsPanel(data, apply) {
  return el(
    'div',
    { class: 'stack' },
    el('h2', {}, '결과 옵션'),
    switchControl({
      checked: data.settings?.allowPreview === true,
      label: '미배치가 있어도 결과 미리보기',
      description: '켜면 아직 티어를 정하지 않은 칸을 0점으로 계산한 임시 순위를 보여줘요. 끄면 모두 배치해야 결과가 나와요.',
      onToggle: (allowed) => apply((d) => setAllowPreview(d, allowed)),
    }),
  );
}

function dataPanel(data, apply, current) {
  return el(
    'div',
    { class: 'stack' },
    el(
      'section',
      { class: 'card' },
      el('h2', {}, '백업과 이동'),
      el('p', { class: 'muted' }, '대상자, 기준, 점수표, 배치를 JSON 파일로 저장하거나 불러와요. 파일을 직접 고쳐서 다시 가져와도 돼요. 가져오면 현재 데이터를 교체합니다.'),
      el('div', { class: 'row wrap' }, btn('JSON 내보내기', { variant: 'neutralSolid', onclick: () => download('tier-eval.json', exportJson(current())) }), ...importControl(apply)),
    ),
    el('section', { class: 'card' }, el('h2', {}, '다른 구성으로 바꾸기'), el('p', { class: 'muted' }, '불러오면 현재 대상자·기준·배치가 바뀌어요.'), presetList(apply, current, '불러오기')),
    el(
      'section',
      { class: 'card' },
      el('h2', {}, '초기화'),
      el('p', { class: 'muted' }, '대상자, 기준, 배치, 옵션을 모두 지워요. 먼저 내보내기로 백업해 두세요.'),
      el('div', {}, btn('데이터 초기화', { variant: 'criticalSolid', onclick: () => confirm('모든 데이터를 지웁니다. 계속할까요?') && apply(emptyData()) })),
    ),
  );
}

createApp((data, commit, current) => {
  const apply = (next, options) => {
    report([]);
    commit(next, options);
  };
  const refresh = () => commit((d) => d);

  const ready = data.subjects.length > 0 && data.criteria.length > 0;
  const isEmpty = data.subjects.length === 0 && data.criteria.length === 0;
  const panels = { subjects: subjectsPanel, criteria: criteriaPanel, options: optionsPanel, data: dataPanel };

  if (focusTarget) {
    const target = focusTarget;
    focusTarget = null;
    requestAnimationFrame(() => document.querySelector(`[data-focus="${target}"] input`)?.focus());
  }

  return el(
    'div',
    { class: 'page' },
    renderHeader('settings'),
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('h1', {}, '설정'),
        el('p', { class: 'muted' }, ready ? `대상자 ${data.subjects.length}명 · 기준 ${data.criteria.length}개` : '대상자와 기준을 1개 이상 입력하면 평가를 시작할 수 있어요'),
      ),
      ready ? btnLink('평가하러 가기', 'index.html') : btn('평가하러 가기', { variant: 'brandSolid', disabled: true }),
    ),
    messageBox,
    isEmpty
      ? el('section', { class: 'card start' }, el('h2', {}, '어떻게 시작할까요?'), presetList(apply, current, '시작하기'), el('div', { class: 'row wrap' }, ...importControl(apply)))
      : null,
    el('div', { class: 'section-tabs' }, tabList(
      TABS.map(([key, label]) => ({
        key,
        label,
        onclick: () => {
          activeTab = key;
          history.replaceState(null, '', `#${key}`);
          refresh();
        },
      })),
      activeTab,
    )),
    el('div', { class: 'panel' }, panels[activeTab](data, apply, activeTab === 'data' ? current : refresh, current)),
  );
});
