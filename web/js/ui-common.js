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
  // 선택된 탭 아래로 밑줄을 옮긴다 (SEED는 위치를 CSS 변수로 받는다)
  const place = () => {
    const selected = list.querySelector('[data-selected]');
    if (!selected) return;
    indicator.style.setProperty('--indicator-left', `${selected.offsetLeft}px`);
    indicator.style.setProperty('--indicator-width', `${selected.offsetWidth}px`);
  };
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
      source: { subjects: e.data.subjects.map((s) => s.name), criteria: e.data.criteria.map(({ name, description, points }) => ({ name, description, points })) },
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
    el('div', { class: 'brand' }, 'SABC'),
    none ? el('div') : el(
      'div',
      { class: 'row' },
      picker,
      btn('+ 새 평가', {
        variant: 'ghost', size: 'small',
        onclick: openNewEvaluationDialog,
      }),
      btn('평가 설정', { variant: 'ghost', size: 'small', title: '평가 목록 관리', onclick: openEvaluationsDialog }),
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
