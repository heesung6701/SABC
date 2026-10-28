export const PRESETS = [
  {
    id: 'sample',
    name: '샘플 (가상 데이터)',
    subjects: Array.from({ length: 10 }, (_, i) => `후보 ${i + 1}`),
    criteria: ['참신성', '실현 가능성', '시장성', '완성도'],
  },
  { id: 'empty', name: '빈 구성', subjects: [], criteria: [] },
];
