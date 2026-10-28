import { createStore, STORAGE_KEY } from './store.js';

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
  const mark = (name) => `seed-switchmark__${name} seed-switchmark__${name}--tone_brand seed-switchmark__${name}--size_24`;
  const flag = checked ? { 'data-checked': '' } : {};
  return el(
    'button',
    { type: 'button', class: 'switch-row', role: 'switch', 'aria-checked': String(checked), onclick: () => onToggle(!checked) },
    el(
      'span',
      { class: 'switch-text' },
      el('span', { class: 'switch-title' }, label),
      description ? el('span', { class: 'muted' }, description) : null,
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
        item.href ? 'a' : 'button',
        {
          class: 'seed-tabs__trigger seed-tabs__trigger--size_medium seed-tabs__trigger--triggerLayout_hug',
          ...(item.href ? { href: item.href } : { type: 'button' }),
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
  requestAnimationFrame(() => {
    const selected = list.querySelector('[data-selected]');
    if (!selected) return;
    indicator.style.setProperty('--indicator-left', `${selected.offsetLeft}px`);
    indicator.style.setProperty('--indicator-width', `${selected.offsetWidth}px`);
  });
  return list;
}

const PAGES = [
  { key: 'evaluate', label: '평가', href: 'index.html' },
  { key: 'result', label: '결과', href: 'result.html' },
  { key: 'settings', label: '설정', href: 'settings.html' },
];

// 모든 화면 위쪽의 공용 머리글: 서비스 이름 + 화면 이동 탭
export function renderHeader(active) {
  return el(
    'header',
    { class: 'app-header' },
    el('div', { class: 'brand' }, '티어 평가'),
    el('nav', { class: 'app-nav', 'aria-label': '화면 이동' }, tabList(PAGES, active, { nav: true })),
  );
}

// render(data, commit, current)이 돌려주는 노드를 #app에 그린다.
// commit(next, { repaint })의 next는 새 데이터이거나 "현재 데이터 -> 새 데이터" 함수다.
// 함수로 넘기면 오래된 화면의 클로저가 낡은 데이터를 저장소에 덮어쓰지 않는다.
// current()는 지금 데이터를 돌려준다 (repaint 없이 저장한 뒤에도 최신).
export function createApp(render) {
  const root = document.getElementById('app');
  let data = store.load();
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
    root.replaceChildren(...notices, render(data, commit, current));
  }

  function commit(next, { repaint = true } = {}) {
    data = typeof next === 'function' ? next(data) : next;
    saveFailed = !store.save(data);
    if (!saveFailed) loadFailed = false;
    if (repaint || saveFailed) paint();
  }

  // 뒤로 가기(bfcache)로 돌아오거나 다른 탭이 저장하면 메모리의 낡은 데이터를 버리고 다시 읽는다.
  function reload() {
    data = store.load();
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
