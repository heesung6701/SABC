import { computeResults } from './core.js';
import { btnLink, callout, createApp, el, renderHeader } from './ui-common.js';

createApp((data) => {
  const result = computeResults(data);
  const page = el('div', { class: 'page' }, renderHeader('result'), el('div', { class: 'page-head' }, el('h1', {}, '결과')));

  if (result.status === 'empty') {
    page.append(
      el(
        'div',
        { class: 'stack' },
        callout('informative', '대상자와 기준을 먼저 입력해 주세요'),
        el('div', {}, btnLink('설정으로 가기', 'settings.html')),
      ),
    );
    return page;
  }
  if (result.status === 'locked') {
    page.append(
      el(
        'div',
        { class: 'stack' },
        callout('warning', `미배치 ${result.missing}건이 남아 있어 결과를 볼 수 없어요`, '모두 배치하면 순위가 나와요. 설정의 옵션에서 미리보기를 켜면 임시 순위를 볼 수 있어요.'),
        el('div', { class: 'row wrap' }, btnLink('평가로 돌아가기', 'index.html'), btnLink('옵션 설정', 'settings.html#options', { variant: 'neutralWeak' })),
      ),
    );
    return page;
  }

  if (result.status === 'preview') {
    page.append(
      el(
        'div',
        { class: 'stack' },
        callout('warning', '미리보기 결과예요', `미배치 ${result.missing}건을 0점으로 계산한 임시 순위입니다.`),
        el('div', {}, btnLink('평가로 돌아가기', 'index.html', { variant: 'neutralWeak' })),
      ),
    );
  }
  page.append(
    el(
      'div',
      { class: 'table-wrap' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['순위', '대상자', ...data.criteria.map((c) => c.name), '총점', 'S 개수'].map((label) => el('th', {}, label)))),
        el(
          'tbody',
          {},
          ...result.rows.map((row) =>
            el(
              'tr',
              {},
              el('td', { class: 'num' }, String(row.rank)),
              el('td', {}, row.name),
              ...data.criteria.map((c) => el('td', { class: `tier tier-${row.tiers[c.id]}` }, row.tiers[c.id] ?? '-')),
              el('td', { class: 'num' }, String(row.total)),
              el('td', { class: 'num' }, String(row.sCount)),
            ),
          ),
        ),
      ),
    ),
  );
  return page;
});
