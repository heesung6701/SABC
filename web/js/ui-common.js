import { createStore } from './store.js';

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

// render(data, commit)이 돌려주는 노드를 #app에 그린다. commit(next)은 저장 후 다시 그린다.
export function createApp(render) {
  const root = document.getElementById('app');
  let data = store.load();
  let saveFailed = false;

  function paint() {
    const notice = saveFailed
      ? el('div', { class: 'alert', role: 'alert' }, '저장에 실패했습니다. JSON 내보내기로 백업하세요.')
      : null;
    root.replaceChildren(...[notice, render(data, commit)].filter(Boolean));
  }

  function commit(next) {
    data = next;
    saveFailed = !store.save(data);
    paint();
  }

  paint();
}
