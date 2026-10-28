export const PRESETS = [
  {
    id: 'hiring',
    name: '채용 평가 기준',
    subjects: [],
    criteria: [
      {
        name: '직무 이해도',
        description: '지원한 직무의 역할과 핵심 과업을 정확히 이해하고 있는지 평가합니다.\n관련 지식, 기술, 준비 정도를 확인합니다.',
      },
      {
        name: '문제 해결 능력 및 역량',
        description: '복잡한 상황이나 과제를 구조화하고 대안을 도출하는 능력을 봅니다.\n과거 경험 속에서 문제를 해결한 구체적 과정과 성과를 평가합니다.',
      },
      {
        name: '협업과 조율',
        description: '팀원 및 이해관계자와 소통하며 충돌을 다루는 방식과 태도를 확인합니다.\n조직 내에서 원활하게 협력할 수 있는지를 봅니다.',
      },
      {
        name: '의사소통 능력',
        description: '질문의 의도를 정확히 파악하고, 자신의 생각을 논리적이고 명확하게 전달하는지 평가합니다.',
      },
      {
        name: '동기 및 성장 가능성',
        description: '회사와 직무에 관심을 가지게 된 지원동기가 진정성 있는지 봅니다.\n입사 후 얼마나 발전하고 장기적으로 기여할 수 있는지를 평가합니다.',
      },
    ],
  },
  {
    id: 'sample',
    name: '샘플 (가상 데이터)',
    subjects: Array.from({ length: 10 }, (_, i) => `후보 ${i + 1}`),
    criteria: ['참신성', '실현 가능성', '시장성', '완성도'].map((name) => ({ name })),
  },
  { id: 'empty', name: '빈 구성', subjects: [], criteria: [] },
];
