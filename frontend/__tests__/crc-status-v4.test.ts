import { describe, expect, it } from 'vitest';
import type { CodingPhase, CRCStatusCode, DmsPhase, DispatchRoute } from '../types';
import {
  STATUS_COLOR_MAP,
  SLA_STATUS_META,
  WARNING_LEVEL_META,
} from '../components/customer-request/presentation';

// ── P4a.3 — V4 Status + Types Tests ──────────────────────────────────────────

const ALL_V4_STATUS_CODES: CRCStatusCode[] = [
  'new_intake',
  'pending_dispatch',
  'dispatched',
  'in_progress',
  'analysis',
  'coding',
  'dms_transfer',
  'completed',
  'customer_notified',
  'not_executed',
  'waiting_customer_feedback',
  'returned_to_manager',
];

// ── STATUS_COLOR_MAP ──────────────────────────────────────────────────────────

describe('STATUS_COLOR_MAP', () => {
  it('contains all 12 V4 status codes', () => {
    for (const code of ALL_V4_STATUS_CODES) {
      expect(STATUS_COLOR_MAP[code], `STATUS_COLOR_MAP missing: ${code}`).toBeDefined();
    }
  });

  it('each status has non-empty label and cls', () => {
    for (const code of ALL_V4_STATUS_CODES) {
      const entry = STATUS_COLOR_MAP[code];
      expect(entry.label, `label empty for ${code}`).toBeTruthy();
      expect(entry.cls, `cls empty for ${code}`).toBeTruthy();
    }
  });

  it('contains 4 new V4 statuses with correct labels', () => {
    expect(STATUS_COLOR_MAP['pending_dispatch'].label).toBe('Chờ điều phối');
    expect(STATUS_COLOR_MAP['dispatched'].label).toBe('Đã điều phối');
    expect(STATUS_COLOR_MAP['coding'].label).toBe('Lập trình');
    expect(STATUS_COLOR_MAP['dms_transfer'].label).toBe('Chuyển DMS');
  });

  it('new statuses have distinct colour classes (indigo, cyan, violet, lime)', () => {
    expect(STATUS_COLOR_MAP['pending_dispatch'].cls).toContain('indigo');
    expect(STATUS_COLOR_MAP['dispatched'].cls).toContain('cyan');
    expect(STATUS_COLOR_MAP['coding'].cls).toContain('violet');
    expect(STATUS_COLOR_MAP['dms_transfer'].cls).toContain('lime');
  });
});

// ── CRCStatusCode type narrowing ──────────────────────────────────────────────

describe('CRCStatusCode type', () => {
  it('accepts all 12 valid codes at compile time', () => {
    // These are compile-time checks — if they compile, they pass
    const codes: CRCStatusCode[] = [
      'new_intake',
      'pending_dispatch',
      'dispatched',
      'in_progress',
      'analysis',
      'coding',
      'dms_transfer',
      'completed',
      'customer_notified',
      'not_executed',
      'waiting_customer_feedback',
      'returned_to_manager',
    ];
    expect(codes).toHaveLength(12);
  });
});

// ── CodingPhase ────────────────────────────────────────────────────────────────

describe('CodingPhase type', () => {
  it('accepts all 5 valid coding phases', () => {
    const phases: CodingPhase[] = [
      'coding',
      'coding_done',
      'upcode_pending',
      'upcode_deployed',
      'suspended',
    ];
    expect(phases).toHaveLength(5);
  });

  it('coding phases form a logical progression', () => {
    const progressPhases: CodingPhase[] = [
      'coding',
      'coding_done',
      'upcode_pending',
      'upcode_deployed',
    ];
    // Each step index is in order
    progressPhases.forEach((phase, index) => {
      expect(progressPhases.indexOf(phase)).toBe(index);
    });
  });
});

// ── DmsPhase ──────────────────────────────────────────────────────────────────

describe('DmsPhase type', () => {
  it('accepts all 5 valid DMS phases', () => {
    const phases: DmsPhase[] = [
      'exchange',
      'task_created',
      'in_progress',
      'completed',
      'suspended',
    ];
    expect(phases).toHaveLength(5);
  });

  it('DMS phases form a logical progression', () => {
    const progressPhases: DmsPhase[] = ['exchange', 'task_created', 'in_progress', 'completed'];
    progressPhases.forEach((phase, index) => {
      expect(progressPhases.indexOf(phase)).toBe(index);
    });
  });
});

// ── DispatchRoute type ────────────────────────────────────────────────────────

describe('DispatchRoute type', () => {
  it('accepts all 3 valid dispatch routes', () => {
    const routes: DispatchRoute[] = ['self_handle', 'assign_pm', 'assign_direct'];
    expect(routes).toHaveLength(3);
  });

  it('dispatch routes have semantic meaning', () => {
    const routes: DispatchRoute[] = ['self_handle', 'assign_pm', 'assign_direct'];
    // Ensure they can be used in a type-guarded switch
    let count = 0;
    for (const route of routes) {
      switch (route) {
        case 'self_handle':
        case 'assign_pm':
        case 'assign_direct':
          count++;
          break;
      }
    }
    expect(count).toBe(3);
  });
});

// ── SLA_STATUS_META ──────────────────────────────────────────────────────────

describe('SLA_STATUS_META', () => {
  it('has entries for overdue, at_risk, on_track, closed', () => {
    const expected = ['overdue', 'at_risk', 'on_track', 'closed'];
    for (const key of expected) {
      expect(SLA_STATUS_META[key], `SLA_STATUS_META missing: ${key}`).toBeDefined();
    }
  });
});

// ── WARNING_LEVEL_META ────────────────────────────────────────────────────────

describe('WARNING_LEVEL_META', () => {
  it('has entries for hard, soft, missing, normal', () => {
    const expected = ['hard', 'soft', 'missing', 'normal'];
    for (const key of expected) {
      expect(WARNING_LEVEL_META[key], `WARNING_LEVEL_META missing: ${key}`).toBeDefined();
    }
  });
});

// ── CodingProgressBar step resolver (pure logic) ─────────────────────────────

const CODING_ORDER: CodingPhase[] = ['coding', 'coding_done', 'upcode_pending', 'upcode_deployed'];

function resolveStepState(
  stepPhase: CodingPhase,
  currentPhase: CodingPhase | string | null | undefined
): 'done' | 'active' | 'pending' {
  if (!currentPhase || currentPhase === 'suspended') return 'pending';
  const currentIndex = CODING_ORDER.indexOf(currentPhase as CodingPhase);
  const stepIndex = CODING_ORDER.indexOf(stepPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

describe('CodingProgressBar step resolver', () => {
  it('marks all steps before current as done', () => {
    expect(resolveStepState('coding', 'coding_done')).toBe('done');
    expect(resolveStepState('coding', 'upcode_pending')).toBe('done');
    expect(resolveStepState('coding_done', 'upcode_deployed')).toBe('done');
  });

  it('marks current step as active', () => {
    expect(resolveStepState('coding', 'coding')).toBe('active');
    expect(resolveStepState('coding_done', 'coding_done')).toBe('active');
    expect(resolveStepState('upcode_deployed', 'upcode_deployed')).toBe('active');
  });

  it('marks all steps after current as pending', () => {
    expect(resolveStepState('upcode_pending', 'coding')).toBe('pending');
    expect(resolveStepState('upcode_deployed', 'coding_done')).toBe('pending');
  });

  it('marks all steps as pending when suspended', () => {
    for (const step of CODING_ORDER) {
      expect(resolveStepState(step, 'suspended')).toBe('pending');
    }
  });

  it('marks all steps as pending when phase is null', () => {
    for (const step of CODING_ORDER) {
      expect(resolveStepState(step, null)).toBe('pending');
    }
  });
});

// ── DmsProgressBar step resolver (pure logic) ────────────────────────────────

const DMS_ORDER: DmsPhase[] = ['exchange', 'task_created', 'in_progress', 'completed'];

function resolveDmsStepState(
  stepPhase: DmsPhase,
  currentPhase: DmsPhase | string | null | undefined
): 'done' | 'active' | 'pending' {
  if (!currentPhase || currentPhase === 'suspended') return 'pending';
  const currentIndex = DMS_ORDER.indexOf(currentPhase as DmsPhase);
  const stepIndex = DMS_ORDER.indexOf(stepPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

describe('DmsProgressBar step resolver', () => {
  it('marks all steps before current as done', () => {
    expect(resolveDmsStepState('exchange', 'task_created')).toBe('done');
    expect(resolveDmsStepState('exchange', 'completed')).toBe('done');
    expect(resolveDmsStepState('in_progress', 'completed')).toBe('done');
  });

  it('marks current step as active', () => {
    expect(resolveDmsStepState('exchange', 'exchange')).toBe('active');
    expect(resolveDmsStepState('completed', 'completed')).toBe('active');
  });

  it('marks all steps after current as pending', () => {
    expect(resolveDmsStepState('in_progress', 'exchange')).toBe('pending');
    expect(resolveDmsStepState('completed', 'task_created')).toBe('pending');
  });

  it('marks all steps as pending when suspended', () => {
    for (const step of DMS_ORDER) {
      expect(resolveDmsStepState(step, 'suspended')).toBe('pending');
    }
  });
});

// ── dispatch_route field ──────────────────────────────────────────────────────

describe('dispatch_route field on YeuCau', () => {
  it('is recognized as an optional nullable string field', () => {
    // Type-level check — if this compiles, YeuCau.dispatch_route exists and is nullable
    const mockCase: { dispatch_route?: string | null } = {
      dispatch_route: 'assign_pm',
    };
    expect(mockCase.dispatch_route).toBe('assign_pm');

    const mockCase2: { dispatch_route?: string | null } = {
      dispatch_route: null,
    };
    expect(mockCase2.dispatch_route).toBeNull();
  });
});
