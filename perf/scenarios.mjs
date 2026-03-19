const SHARED_DEFAULTS = {
  connections: 4,
  durationSeconds: 12,
  timeoutMs: 30000,
  maxErrorRate: 0.02,
};

export const scenarios = {
  contracts: {
    description: 'Kiem thu rieng module hop dong: danh sach va chi tiet.',
    defaults: {
      ...SHARED_DEFAULTS,
      connections: 5,
      durationSeconds: 15,
    },
    targets: [
      {
        name: 'contracts-list',
        path: '/api/v5/contracts?page=1&per_page=100',
        maxP95Ms: 1800,
        minRequestsPerSecond: 3,
      },
      {
        name: 'contracts-detail',
        path: '/api/v5/contracts/{{contractId}}',
        connections: 3,
        durationSeconds: 12,
        maxP95Ms: 1200,
        minRequestsPerSecond: 2,
        placeholders: {
          contractId: {
            env: 'PERF_CONTRACT_ID',
            sourcePath: '/api/v5/contracts?page=1&per_page=1',
            jsonPath: 'data.0.id',
          },
        },
      },
    ],
  },
  'customer-request-cases': {
    description: 'Kiem thu rieng module customer request case: danh sach, chi tiet, timeline, people.',
    defaults: {
      ...SHARED_DEFAULTS,
      connections: 4,
      durationSeconds: 14,
      timeoutMs: 35000,
    },
    targets: [
      {
        name: 'cases-list',
        path: '/api/v5/customer-request-cases?page=1&per_page=50&simple=1',
        maxP95Ms: 2200,
        minRequestsPerSecond: 2,
      },
      {
        name: 'case-detail',
        path: '/api/v5/customer-request-cases/{{caseId}}',
        connections: 3,
        durationSeconds: 12,
        maxP95Ms: 1500,
        minRequestsPerSecond: 2,
        placeholders: {
          caseId: {
            env: 'PERF_CASE_ID',
            sourcePath: '/api/v5/customer-request-cases?page=1&per_page=1&simple=1',
            jsonPath: 'data.0.id',
          },
        },
      },
      {
        name: 'case-timeline',
        path: '/api/v5/customer-request-cases/{{caseId}}/timeline',
        connections: 2,
        durationSeconds: 10,
        maxP95Ms: 1400,
        minRequestsPerSecond: 1,
        placeholders: {
          caseId: {
            env: 'PERF_CASE_ID',
            sourcePath: '/api/v5/customer-request-cases?page=1&per_page=1&simple=1',
            jsonPath: 'data.0.id',
          },
        },
      },
      {
        name: 'case-people',
        path: '/api/v5/customer-request-cases/{{caseId}}/people',
        connections: 2,
        durationSeconds: 10,
        maxP95Ms: 1400,
        minRequestsPerSecond: 1,
        placeholders: {
          caseId: {
            env: 'PERF_CASE_ID',
            sourcePath: '/api/v5/customer-request-cases?page=1&per_page=1&simple=1',
            jsonPath: 'data.0.id',
          },
        },
      },
    ],
  },
  dashboard: {
    description: 'Kiem thu flow dashboard support/customer request: bootstrap, summary, history va detail history.',
    defaults: {
      ...SHARED_DEFAULTS,
      connections: 4,
      durationSeconds: 12,
      timeoutMs: 35000,
    },
    targets: [
      {
        name: 'bootstrap',
        path: '/api/v5/bootstrap',
        connections: 2,
        durationSeconds: 8,
        maxP95Ms: 800,
        minRequestsPerSecond: 2,
      },
      {
        name: 'dashboard-summary',
        path: '/api/v5/customer-requests/dashboard-summary',
        maxP95Ms: 1800,
        minRequestsPerSecond: 2,
      },
      {
        name: 'dashboard-history-feed',
        path: '/api/v5/customer-request-history?limit=100',
        maxP95Ms: 2000,
        minRequestsPerSecond: 2,
      },
      {
        name: 'dashboard-request-list',
        path: '/api/v5/customer-requests?page=1&per_page=50',
        maxP95Ms: 1800,
        minRequestsPerSecond: 2,
      },
      {
        name: 'dashboard-request-history-detail',
        path: '/api/v5/customer-requests/{{customerRequestId}}/history',
        connections: 2,
        durationSeconds: 10,
        maxP95Ms: 1600,
        minRequestsPerSecond: 1,
        placeholders: {
          customerRequestId: {
            env: 'PERF_CUSTOMER_REQUEST_ID',
            sourcePath: '/api/v5/customer-requests?page=1&per_page=1',
            jsonPath: 'data.0.id',
          },
        },
      },
    ],
  },
  public: {
    description: 'Baseline nhanh cho endpoint khong can dang nhap.',
    authenticate: false,
    defaults: {
      connections: 6,
      durationSeconds: 10,
      timeoutMs: 15000,
      maxErrorRate: 0.01,
    },
    targets: [
      {
        name: 'departments-public',
        path: '/api/departments',
        maxP95Ms: 500,
        minRequestsPerSecond: 5,
      },
    ],
  },
  smoke: {
    description: 'Kiem thu nhanh cac API chinh voi tai khoan da dang nhap.',
    defaults: SHARED_DEFAULTS,
    targets: [
      {
        name: 'bootstrap',
        path: '/api/v5/bootstrap',
        connections: 2,
        durationSeconds: 8,
        maxP95Ms: 800,
        minRequestsPerSecond: 2,
      },
      {
        name: 'customers',
        path: '/api/v5/customers?page=1&per_page=50',
        maxP95Ms: 1200,
        minRequestsPerSecond: 2,
      },
      {
        name: 'projects',
        path: '/api/v5/projects?page=1&per_page=50',
        maxP95Ms: 1400,
        minRequestsPerSecond: 2,
      },
      {
        name: 'contracts',
        path: '/api/v5/contracts?page=1&per_page=50',
        maxP95Ms: 1500,
        minRequestsPerSecond: 2,
      },
      {
        name: 'customer-request-cases',
        path: '/api/v5/customer-request-cases?page=1&per_page=30',
        connections: 3,
        maxP95Ms: 1800,
        minRequestsPerSecond: 1,
      },
    ],
  },
  load: {
    description: 'Kiem thu tai cao hon de lay baseline latency va throughput.',
    defaults: {
      ...SHARED_DEFAULTS,
      connections: 8,
      durationSeconds: 30,
      timeoutMs: 45000,
      maxErrorRate: 0.03,
    },
    targets: [
      {
        name: 'customers',
        path: '/api/v5/customers?page=1&per_page=100',
        maxP95Ms: 1600,
        minRequestsPerSecond: 4,
      },
      {
        name: 'projects',
        path: '/api/v5/projects?page=1&per_page=100',
        maxP95Ms: 1800,
        minRequestsPerSecond: 3,
      },
      {
        name: 'contracts',
        path: '/api/v5/contracts?page=1&per_page=100',
        maxP95Ms: 2000,
        minRequestsPerSecond: 3,
      },
      {
        name: 'customer-request-cases',
        path: '/api/v5/customer-request-cases?page=1&per_page=50',
        connections: 6,
        maxP95Ms: 2400,
        minRequestsPerSecond: 2,
      },
    ],
  },
};
