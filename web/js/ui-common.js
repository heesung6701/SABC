import { createStore, STORAGE_KEY } from './store.js';

const store = createStore();

// 문자열 자식은 텍스트 노드로 들어가므로 사용자 입력이 HTML로 해석되지 않는다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const PAGES = [
  ['settings', '설정', 'settings.html'],
  ['evaluate', '평가', 'evaluate.html'],
  ['result', '결과', 'result.html'],
];

export function renderNav(active) {
  return el(
    'nav',
    { class: 'nav' },
    ...PAGES.map(([id, label, href]) =>
      el('a', { href, ...(id === active ? { 'aria-current': 'page' } : {}) }, label),
    ),
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
        el('div', { class: 'alert', role: 'alert' }, '저장된 데이터를 읽지 못해 빈 상태로 시작했습니다. 원본은 브라우저 저장소의 tier-eval-v1-backup 키에 보관했습니다.'),
      );
    }
    if (saveFailed) {
      notices.push(el('div', { class: 'alert', role: 'alert' }, '저장에 실패했습니다. JSON 내보내기로 백업하세요.'));
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
