import { computeResults } from './core.js';
import { createApp, el, renderNav } from './ui-common.js';

createApp((data) => {
  const page = el('div', {}, renderNav('result'), el('h1', {}, '결과'));
  const result = computeResults(data);

  if (result.status === 'empty') {
    page.append(
      el('p', {}, '대상자와 기준을 먼저 입력하세요. ', el('a', { href: 'settings.html' }, '설정으로 이동')),
    );
    return page;
  }
  if (result.status === 'locked') {
    page.append(
      el(
        'div',
        { class: 'alert', role: 'alert' },
        `미배치 ${result.missing}건이 남아 있어 결과를 볼 수 없습니다. `,
        el('a', { href: 'evaluate.html' }, '평가로 이동'),
      ),
    );
    return page;
  }

  if (result.status === 'preview') {
    page.append(
      el(
        'div',
        { class: 'notice' },
        `미리보기: 미배치 ${result.missing}건을 0점으로 계산한 임시 결과입니다. `,
        el('a', { href: 'evaluate.html' }, '평가로 이동'),
      ),
    );
  }
  page.append(
    el(
      'table',
      {},
      el(
        'thead',
        {},
        el('tr', {}, ...['순위', '대상자', ...data.criteria.map((c) => c.name), '총점', 'S 개수'].map((label) => el('th', {}, label))),
      ),
      el(
        'tbody',
        {},
        ...result.rows.map((row) =>
          el(
            'tr',
            {},
            el('td', {}, String(row.rank)),
            el('td', {}, row.name),
            ...data.criteria.map((c) => el('td', { class: `tier tier-${row.tiers[c.id]}` }, row.tiers[c.id] ?? '-')),
            el('td', {}, String(row.total)),
            el('td', {}, String(row.sCount)),
          ),
        ),
      ),
    ),
  );
  return page;
});
