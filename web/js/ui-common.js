import { createStore, STORAGE_KEY } from './store.js';
import { PRESETS } from './presets.js';
import { parseNames } from './core.js';
import { activeEvaluation, updateActive, addEvaluation, applyPreset, renameEvaluation, switchEvaluation, removeEvaluation, moveEvaluation } from './model.js';

const store = createStore();

// 문자열 자식은 텍스트 노드로 들어가므로 사용자 입력이 HTML로 해석되지 않는다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// 톱니바퀴 아이콘: SEED 아이콘(@seed-design/icon, MIT)의 setting_thin. 고정 문자열이라 innerHTML이어도 안전하다.
function gearIcon() {
  const span = el('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.10051 3.26913C9.19904 2.79014 9.61013 2.40002 10.151 2.40002H13.8537C14.3848 2.40002 14.7996 2.77894 14.9025 3.24589C14.9057 3.26065 14.9084 3.27553 14.9105 3.29049L15.1207 4.76731C15.1681 5.10039 15.4093 5.42429 15.7856 5.6414C16.1366 5.84391 16.5099 5.88489 16.815 5.76542L18.2941 5.18632C18.3014 5.18348 18.3087 5.18078 18.3161 5.17822C18.7841 5.0157 19.312 5.17883 19.5907 5.61914L19.5991 5.63275L21.4471 8.73228C21.7456 9.21327 21.5805 9.79738 21.2006 10.0996L21.1896 10.1083L19.9375 11.0571C19.6822 11.2506 19.5294 11.5891 19.5294 12C19.5294 12.3975 19.682 12.7343 19.926 12.9192L21.1895 13.8768C21.2015 13.8859 21.2131 13.8955 21.2244 13.9055C21.5628 14.2046 21.7542 14.7583 21.4471 15.2529L19.5991 18.3523L19.5907 18.3659C19.312 18.8062 18.7841 18.9694 18.3161 18.8068C18.3087 18.8043 18.3014 18.8016 18.2941 18.7987L16.8194 18.2213C16.5123 18.1011 16.1305 18.1433 15.7736 18.3473C15.4048 18.5581 15.1691 18.8776 15.1214 19.2127L14.9105 20.6946C14.9088 20.7067 14.9067 20.7189 14.9042 20.7309C14.8057 21.2099 14.3946 21.6 13.8537 21.6H10.151C9.61991 21.6 9.20518 21.2211 9.10227 20.7542C9.09901 20.7394 9.09632 20.7245 9.09419 20.7096L8.88402 19.2327C8.83662 18.8997 8.59542 18.5758 8.21913 18.3587C7.86813 18.1561 7.49484 18.1152 7.18971 18.2346L5.71059 18.8137C5.70334 18.8166 5.69603 18.8193 5.68867 18.8218C5.22061 18.9844 4.69273 18.8212 4.41404 18.3809L4.40568 18.3673L2.55766 15.2679C2.26915 14.8033 2.39691 14.2457 2.7649 13.9205C2.77618 13.9105 2.78784 13.9009 2.79984 13.8918L4.0518 12.943C4.30712 12.7495 4.45987 12.4109 4.45987 12C4.45987 11.5801 4.31082 11.2417 4.06589 11.0561L2.81527 10.1082C2.80327 10.0991 2.79161 10.0896 2.78033 10.0796C2.44192 9.78047 2.2505 9.2267 2.55767 8.73218L4.40568 5.63275L4.41404 5.61914C4.69273 5.17883 5.22061 5.0157 5.68867 5.17822C5.69603 5.18078 5.70334 5.18348 5.71059 5.18632L7.18079 5.76193C7.48822 5.8823 7.87128 5.84024 8.24051 5.6366C8.60263 5.43688 8.83536 5.12422 8.88164 4.79901L9.09419 3.30549C9.09592 3.29331 9.09803 3.28118 9.10051 3.26913ZM10.2644 3.60002L10.0697 4.96808C9.95888 5.74663 9.43418 6.34866 8.82006 6.68737C8.22311 7.01661 7.46331 7.16124 6.7433 6.87934L5.37819 6.34487L3.65337 9.23769L4.79073 10.0997C5.41901 10.5759 5.65987 11.3243 5.65987 12C5.65987 12.6913 5.39976 13.4271 4.77664 13.8993L3.64857 14.7543L5.37819 17.6552L6.75222 17.1172C7.4659 16.8378 8.22214 16.975 8.81883 17.3192C9.42486 17.6689 9.95967 18.274 10.0721 19.0637L10.2622 20.4H13.7404L13.9334 19.0436C14.0448 18.2605 14.5663 17.6551 15.1781 17.3055C15.7761 16.9636 16.5397 16.8231 17.2568 17.1039L18.6265 17.6402L20.3514 14.7474L19.2011 13.8756C18.5888 13.4115 18.3294 12.677 18.3294 12C18.3294 11.3087 18.5896 10.573 19.2127 10.1007L20.3514 9.23769L18.6265 6.34487L17.2525 6.88283C16.5388 7.16225 15.7826 7.02507 15.1859 6.6808C14.5799 6.33114 14.0451 5.72609 13.9327 4.93638L13.7425 3.60002H10.2644ZM3.57667 9.36591L3.57903 9.36208L3.57667 9.36591Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M8.35584 12C8.35584 9.98743 9.98737 8.35591 12 8.35591C14.0126 8.35591 15.6441 9.98743 15.6441 12C15.6441 14.0126 14.0126 15.6441 12 15.6441C9.98737 15.6441 8.35584 14.0126 8.35584 12ZM12 9.55591C10.6501 9.55591 9.55584 10.6502 9.55584 12C9.55584 13.3499 10.6501 14.4441 12 14.4441C13.3498 14.4441 14.4441 13.3499 14.4441 12C14.4441 10.6502 13.3498 9.55591 12 9.55591Z" fill="currentColor"/></svg>';
  return span;
}

// ---- SEED(당근 디자인 시스템) 컴포넌트 클래스 헬퍼 ----

const buttonClass = (variant, size) =>
  `seed-action-button seed-action-button--variant_${variant} seed-action-button--size_${size} seed-action-button--size_${size}-layout_withText`;

export function btn(label, { variant = 'neutralWeak', size = 'medium', onclick, disabled = false, danger = false, title } = {}) {
  return el('button', { type: 'button', class: buttonClass(variant, size) + (danger ? ' is-danger' : ''), onclick, disabled, title }, label);
}

export function btnLink(label, href, { variant = 'brandSolid', size = 'medium' } = {}) {
  return el('a', { class: buttonClass(variant, size) + ' is-link', href }, label);
}

// 입력칸. root.control로 실제 input/textarea에 접근한다.
export function textInput({ value = '', placeholder, label, multiline = false, type = 'text', size = 'medium', onchange, onenter, min, step } = {}) {
  const control = el(multiline ? 'textarea' : 'input', {
    class: `seed-text-input__value seed-text-input__value--variant_outline-size_${size}` + (multiline ? ` seed-text-input__value--size_${size}` : ''),
    value,
    placeholder,
    'aria-label': label,
    onchange,
    min,
    step,
    ...(multiline ? { rows: 2 } : { type }),
    onkeydown: onenter ? (event) => { if (event.key === 'Enter' && !event.isComposing) onenter(event); } : undefined,
  });
  const root = el(
    'div',
    { class: `seed-text-input__root seed-text-input__root--variant_outline seed-text-input__root--variant_outline-size_${size}` },
    control,
  );
  root.control = control;
  return root;
}

// 라벨 + 입력 + 도움말을 SEED Field로 묶는다
export function field(label, control, description) {
  return el(
    'div',
    { class: 'seed-field__root' },
    el('div', { class: 'seed-field__header' }, el('span', { class: 'seed-field-label__root seed-field-label__root--weight_medium' }, label)),
    control,
    description ? el('div', { class: 'seed-field__description' }, description) : null,
  );
}

export function callout(tone, title, ...description) {
  return el(
    'div',
    { class: `seed-callout__root seed-callout__root--tone_${tone}`, role: tone === 'critical' ? 'alert' : 'status' },
    el(
      'div',
      { class: 'seed-callout__content' },
      title ? el('div', { class: `seed-callout__title seed-callout__title--tone_${tone}` }, title) : null,
      description.length > 0 ? el('div', { class: `seed-callout__description seed-callout__description--tone_${tone}` }, ...description) : null,
    ),
  );
}

export function switchControl({ checked, label, description, onToggle }) {
  const mark = (name) => `seed-switchmark__${name} seed-switchmark__${name}--tone_brand seed-switchmark__${name}--size_32`;
  const flag = checked ? { 'data-checked': '' } : {};
  return el(
    'button',
    { type: 'button', class: 'seed-switch__root seed-switch__root--size_32 switch-row', role: 'switch', 'aria-checked': String(checked), onclick: () => onToggle(!checked) },
    el(
      'span',
      { class: 'switch-text' },
      el('span', { class: 'seed-switch__label seed-switch__label--size_32' }, label),
      description ? el('span', { class: 'seed-list-item__detail' }, description) : null,
    ),
    el('span', { class: mark('root'), ...flag }, el('span', { class: mark('thumb'), ...flag })),
  );
}

const NAV_FROM_KEY = 'sabc-nav-from';
function takeNavFrom() {
  try {
    const raw = sessionStorage.getItem(NAV_FROM_KEY);
    sessionStorage.removeItem(NAV_FROM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// items: { key, label, href?, onclick? }. href가 있으면 링크(페이지 이동), 없으면 버튼(탭 전환).
export function tabList(items, activeKey, { nav = false } = {}) {
  const indicator = el('span', { class: 'seed-tabs__indicator seed-tabs__indicator--triggerLayout_hug' });
  const list = el(
    'div',
    { class: 'seed-tabs__list seed-tabs__list--size_medium seed-tabs__list--triggerLayout_hug', role: nav ? undefined : 'tablist' },
    ...items.map((item) => {
      const active = item.key === activeKey;
      return el(
        item.href && !item.disabled ? 'a' : 'button',
        {
          class: 'seed-tabs__trigger seed-tabs__trigger--size_medium seed-tabs__trigger--triggerLayout_hug',
          ...(item.href && !item.disabled ? { href: item.href } : { type: 'button' }),
          ...(item.disabled ? { disabled: true, title: '평가를 먼저 만들어 주세요' } : {}),
          ...(nav ? (active ? { 'aria-current': 'page' } : {}) : { role: 'tab', 'aria-selected': String(active) }),
          ...(active ? { 'data-selected': '' } : {}),
          onclick: item.onclick,
        },
        item.label,
      );
    }),
    indicator,
  );
  // 선택된 탭 아래로 밑줄을 옮긴다 (SEED는 위치를 CSS 변수로 받는다).
  // 화면 이동으로 선택이 바뀐 경우에만 이전 탭 위치에서 미끄러져 오고, 그 외(같은 화면 다시 그리기 등)에는 제자리에 바로 놓는다.
  const setPos = (left, width) => {
    indicator.style.setProperty('--indicator-left', `${left}px`);
    indicator.style.setProperty('--indicator-width', `${width}px`);
  };
  let target = null;
  const place = () => {
    const selected = list.querySelector('[data-selected]');
    if (!selected) return;
    const next = { left: selected.offsetLeft, width: selected.offsetWidth };
    if (target && target.left === next.left && target.width === next.width) return;
    const first = target === null;
    target = next;
    const from = first && nav ? takeNavFrom() : null;
    indicator.style.transition = 'none';
    if (from && from.key !== activeKey) {
      setPos(from.left, from.width);
      void indicator.offsetWidth; // 시작 위치를 먼저 반영
      indicator.style.transition = '';
      setPos(next.left, next.width);
    } else {
      setPos(next.left, next.width);
      void indicator.offsetWidth;
      indicator.style.transition = '';
    }
  };
  if (nav) {
    // 다른 화면으로 이동하기 직전의 밑줄 위치를 넘겨준다
    list.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      const selected = list.querySelector('[data-selected]');
      if (link && selected && !link.hasAttribute('data-selected')) {
        sessionStorage.setItem(NAV_FROM_KEY, JSON.stringify({ key: activeKey, left: selected.offsetLeft, width: selected.offsetWidth }));
      }
    });
  }
  // 글꼴이 로드되거나 창 크기가 바뀌면 탭 폭이 달라지므로 그때마다 다시 맞춘다
  requestAnimationFrame(place);
  const observer = new ResizeObserver(place);
  list.querySelectorAll('.seed-tabs__trigger').forEach((trigger) => observer.observe(trigger));
  return list;
}

const PAGES = [
  { key: 'evaluate', label: '평가', href: 'index.html' },
  { key: 'result', label: '결과', href: 'result.html' },
  { key: 'settings', label: '설정', href: 'settings.html' },
];

// 평가 목록 조작. createApp이 채운다. 각 함수는 저장하고 화면을 다시 그린다.
export const evaluations = {
  list: () => [],
  activeId: () => null,
  add: (_name, _data) => {},
  switchTo: (_id) => {},
  rename: (_id, _name) => {},
  remove: (_id) => {},
  move: (_id, _delta) => {},
};

// "새 평가" 대화상자: 이름 + 시작 내용(preset 또는 기존 평가 복사)을 고르면 대상자·기준이 채워지고, 만들기 전에 고칠 수 있다.
export function newEvaluationForm({ onCancel } = {}) {
  const templates = [
    ...PRESETS.map((p) => ({ key: `preset:${p.id}`, label: p.name, hint: p.summary, source: p })),
    ...evaluations.list().map((e) => ({
      key: `eval:${e.id}`,
      label: `복사: ${e.name}`,
      hint: '대상자와 기준을 가져오고 배치는 비워요',
      source: { subjects: e.data.subjects.map((s) => s.name), criteria: e.data.criteria.map(({ name, description, points, rubric }) => ({ name, description, points, rubric })) },
    })),
  ];
  const defaultKey = PRESETS.some((p) => p.id === 'empty') ? 'preset:empty' : templates[0].key;

  const nameInput = textInput({ label: '평가 이름', placeholder: `비우면 자동으로 정해요 (평가 ${evaluations.list().length + 1})` });
  const select = el('select', { class: 'eval-picker wide', 'aria-label': '시작 내용', onchange: () => fill() }, ...templates.map((t) => el('option', { value: t.key, selected: t.key === defaultKey }, t.label)));
  const hint = el('p', { class: 'muted' });
  const subjectsInput = textInput({ multiline: true, label: '대상자', placeholder: '줄바꿈 또는 쉼표로 구분 (나중에 설정에서도 추가할 수 있어요)' });
  const criteriaBox = el('div', { class: 'stack' });
  let rows = []; // { name, description, points }

  const drawCriteria = () => {
    criteriaBox.replaceChildren(
      ...rows.map((row, i) => {
        const name = textInput({ value: row.name, label: '기준 이름', placeholder: '기준 이름', onchange: () => { row.name = name.control.value; } });
        const desc = textInput({ value: row.description ?? '', multiline: true, label: `${row.name || '기준'} 설명`, placeholder: '설명 (선택)', onchange: () => { row.description = desc.control.value; } });
        return el('div', { class: 'card' }, el('div', { class: 'row' }, name, btn('삭제', { variant: 'ghost', danger: true, onclick: () => { rows.splice(i, 1); drawCriteria(); } })), desc);
      }),
      btn('+ 기준 추가', { variant: 'ghost', size: 'small', onclick: () => { rows.push({ name: '' }); drawCriteria(); } }),
    );
  };
  let autoName = ''; // 마지막으로 자동 입력한 이름. 사용자가 고친 이름은 덮어쓰지 않는다.
  const fill = () => {
    const t = templates.find((x) => x.key === select.value);
    if (nameInput.control.value.trim() === autoName) {
      autoName = t.key === 'preset:empty' ? '' : t.label; // 빈 평가는 비워 둬서 자동 이름(평가 N) 사용
      nameInput.control.value = autoName;
    }
    hint.textContent = t.hint;
    subjectsInput.control.value = t.source.subjects.join('\n');
    rows = t.source.criteria.map((c) => ({ ...c }));
    drawCriteria();
  };
  fill();

  const create = () => {
    const criteria = rows.map((r) => ({ ...r, name: (r.name ?? '').trim(), description: (r.description ?? '').trim() })).filter((r) => r.name !== '');
    const data = applyPreset({ subjects: parseNames(subjectsInput.control.value), criteria });
    onCancel?.();
    evaluations.add(nameInput.control.value, data);
    if (/\/(settings|result)\.html$/.test(location.pathname)) location.href = 'index.html'; // 만든 뒤에는 평가 탭으로
  };
  return el(
      'div',
      { class: 'stack' },
      el('h2', {}, '새 평가'),
      field('이름', nameInput),
      field('시작 내용', select, '고르면 아래 내용이 채워져요. 만들기 전에 자유롭게 고칠 수 있어요.'),
      hint,
      field('대상자', subjectsInput),
      field('기준', criteriaBox),
      el('div', { class: 'row end' }, onCancel ? btn('취소', { onclick: onCancel }) : null, btn('만들기', { variant: 'brandSolid', onclick: create })),
  );
}

export function openNewEvaluationDialog() {
  const dialog = el('dialog', { class: 'sabc-dialog', 'aria-label': '새 평가' });
  const close = () => dialog.close();
  dialog.append(newEvaluationForm({ onCancel: close }));
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

// 삭제 확인: 경고를 보여주고 평가 이름을 똑같이 입력해야 지운다.
function confirmDeleteEvaluation(e, onConfirm) {
  const dialog = el('dialog', { class: 'sabc-dialog', 'aria-label': '평가 삭제' });
  const typed = textInput({ label: '평가 이름 확인', placeholder: e.name, onchange: () => sync() });
  const remove = btn('삭제', { variant: 'criticalSolid', disabled: true, onclick: () => { dialog.close(); onConfirm(); } });
  const sync = () => { remove.disabled = typed.control.value !== e.name; };
  typed.control.addEventListener('input', sync);
  dialog.append(
    el(
      'div',
      { class: 'stack' },
      el('h2', {}, '평가 삭제'),
      callout('critical', `'${e.name}'을(를) 삭제합니다`, '대상자, 기준, 점수표, 배치, 옵션이 모두 사라지고 되돌릴 수 없어요. 필요하면 먼저 설정에서 JSON으로 내보내 백업하세요.'),
      field(`삭제하려면 평가 이름 "${e.name}"을(를) 그대로 입력하세요`, typed),
      el('div', { class: 'row end' }, btn('취소', { onclick: () => dialog.close() }), remove),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  typed.control.focus();
}

// "평가 목록" 팝업: 이름 변경, 이동, 순서, 삭제. 평가가 바뀔 때마다 목록을 다시 그린다.
export function openEvaluationsDialog() {
  const dialog = el('dialog', { class: 'sabc-dialog', 'aria-label': '평가 목록' });
  const draw = () => {
    const list = evaluations.list();
    const act = (fn) => { fn(); draw(); };
    dialog.replaceChildren(
      el(
        'div',
        { class: 'stack' },
        el('h2', {}, `평가 ${list.length}개`),
        el('p', { class: 'muted' }, '평가마다 대상자, 기준, 배치, 옵션이 따로 저장돼요.'),
        ...list.map((e, i) => {
          const name = textInput({
            value: e.name,
            label: '평가 이름',
            onchange: () => {
              if (name.control.value.trim() === '') name.control.value = e.name;
              else act(() => evaluations.rename(e.id, name.control.value));
            },
          });
          const isActive = e.id === evaluations.activeId();
          return el(
            'div',
            { class: 'row' },
            name,
            btn(isActive ? '현재' : '이동', { variant: isActive ? 'neutralWeak' : 'brandSolid', disabled: isActive, onclick: () => act(() => evaluations.switchTo(e.id)) }),
            btn('↑', { variant: 'ghost', disabled: i === 0, title: '위로', onclick: () => act(() => evaluations.move(e.id, -1)) }),
            btn('↓', { variant: 'ghost', disabled: i === list.length - 1, title: '아래로', onclick: () => act(() => evaluations.move(e.id, 1)) }),
            btn('삭제', {
              variant: 'ghost', danger: true,
              onclick: () => confirmDeleteEvaluation(e, () => {
                if (list.length === 1) dialog.close(); // 마지막 평가: 목록 팝업을 닫으면 평가 만들기 화면이 뜬다
                act(() => evaluations.remove(e.id));
              }),
            }),
          );
        }),
        el('div', { class: 'row end' }, btn('닫기', { onclick: () => dialog.close() })),
      ),
    );
  };
  draw();
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

// 모든 화면 위쪽의 공용 머리글: 서비스 이름 + 평가 선택 + 화면 이동 탭
export function renderHeader(active) {
  const picker = el(
    'select',
    { class: 'eval-picker', 'aria-label': '평가 선택', onchange: (event) => evaluations.switchTo(event.target.value) },
    ...evaluations.list().map((e) => el('option', { value: e.id, selected: e.id === evaluations.activeId() }, e.name)),
  );
  const none = evaluations.list().length === 0;
  const pages = PAGES.map((p) => ({ ...p, disabled: none }));
  return el(
    'header',
    { class: 'app-header' },
    el('a', { class: 'brand', href: 'index.html', 'aria-label': 'SABC 평가 화면으로' }, 'SABC'),
    none ? el('div') : el(
      'div',
      { class: 'row' },
      picker,
      btn('+ 새 평가', {
        variant: 'ghost', size: 'small',
        onclick: openNewEvaluationDialog,
      }),
      el('button', { type: 'button', class: buttonClass('ghost', 'small'), 'aria-label': '평가 목록 설정', title: '평가 목록 설정', onclick: openEvaluationsDialog }, gearIcon()),
    ),
    el('nav', { class: 'app-nav', 'aria-label': '화면 이동' }, tabList(pages, active, { nav: true })),
  );
}

// render(data, commit, current)이 돌려주는 노드를 #app에 그린다.
// commit(next, { repaint })의 next는 새 데이터이거나 "현재 데이터 -> 새 데이터" 함수다.
// 함수로 넘기면 오래된 화면의 클로저가 낡은 데이터를 저장소에 덮어쓰지 않는다.
// current()는 지금 데이터를 돌려준다 (repaint 없이 저장한 뒤에도 최신).
export function createApp(render) {
  const root = document.getElementById('app');
  let ws = store.load();
  let data = activeEvaluation(ws)?.data ?? null;
  let loadFailed = store.loadFailed;
  let saveFailed = false;

  const current = () => data;

  function paint() {
    const notices = [];
    if (loadFailed) {
      notices.push(
        callout('critical', '저장된 데이터를 읽지 못했습니다', '빈 상태로 시작했습니다. 원본은 브라우저 저장소의 tier-eval-v1-backup 키에 보관했습니다.'),
      );
    }
    if (saveFailed) {
      notices.push(callout('critical', '저장에 실패했습니다', 'JSON 내보내기로 백업하세요.'));
    }
    if (data === null) {
      // 평가가 하나도 없으면 평가 만들기 화면을 띄운다
      root.replaceChildren(...notices, el('div', { class: 'page' }, renderHeader(''), el('section', { class: 'card' }, newEvaluationForm())));
      return;
    }
    root.replaceChildren(...notices, render(data, commit, current));
  }

  // 워크스페이스 전체를 바꾸는 변경(평가 추가/이동/삭제 등)
  function commitWorkspace(fn) {
    ws = fn(ws);
    data = activeEvaluation(ws)?.data ?? null;
    saveFailed = !store.save(ws);
    if (!saveFailed) loadFailed = false;
    paint();
  }
  Object.assign(evaluations, {
    list: () => ws.evaluations,
    activeId: () => ws.activeId,
    add: (name, newData) => commitWorkspace((w) => addEvaluation(w, name, newData)),
    switchTo: (id) => commitWorkspace((w) => switchEvaluation(w, id)),
    rename: (id, name) => commitWorkspace((w) => renameEvaluation(w, id, name)),
    remove: (id) => commitWorkspace((w) => removeEvaluation(w, id)),
    move: (id, delta) => commitWorkspace((w) => moveEvaluation(w, id, delta)),
  });

  // 활성 평가의 데이터만 바꾼다
  function commit(next, { repaint = true } = {}) {
    const fn = typeof next === 'function' ? next : () => next;
    ws = updateActive(ws, fn);
    data = activeEvaluation(ws).data;
    saveFailed = !store.save(ws);
    if (!saveFailed) loadFailed = false;
    if (repaint || saveFailed) paint();
  }

  // 뒤로 가기(bfcache)로 돌아오거나 다른 탭이 저장하면 메모리의 낡은 데이터를 버리고 다시 읽는다.
  function reload() {
    ws = store.load();
    data = activeEvaluation(ws)?.data ?? null;
    loadFailed = store.loadFailed;
    paint();
  }
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reload();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === STORAGE_KEY) reload();
  });

  paint();
}
