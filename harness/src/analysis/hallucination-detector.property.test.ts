import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HallucinationDetector } from './hallucination-detector.js';
import type { HallucinationType, HallucinationSeverity, HallucinationReport } from '../types/hallucination.js';

const detector = new HallucinationDetector();

describe('Feature: hallucination-benchmark, Property 13: Hallucination classification and severity completeness', () => {
  it('every instance has valid type and severity', () => {
    const code = `
#define SYS_fork 42
void test() {
  __asm__("movl %xyz, %eax");
}
`;
    const report = detector.analyze(code, 'test.c');

    for (const inst of report.instances) {
      const validTypes: HallucinationType[] = [
        'non-existent-api', 'incorrect-syscall-number', 'fictitious-register',
        'logical-inconsistency', 'self-contradiction', 'cot-error',
      ];
      const validSeverities: HallucinationSeverity[] = ['critical', 'major', 'minor'];

      expect(validTypes).toContain(inst.type);
      expect(validSeverities).toContain(inst.severity);
      expect(inst.confidence).toBeGreaterThanOrEqual(0);
      expect(inst.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('property: any generated code produces valid report structure', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (code, filename) => {
          const report = detector.analyze(code, filename);

          expect(report.totalInstances).toBe(report.instances.length);
          expect(typeof report.bySeverity.critical).toBe('number');
          expect(typeof report.bySeverity.major).toBe('number');
          expect(typeof report.bySeverity.minor).toBe('number');

          for (const inst of report.instances) {
            expect(inst.id).toBeTruthy();
            expect(inst.description.length).toBeGreaterThan(0);
            expect(inst.confidence).toBeGreaterThanOrEqual(0);
            expect(inst.confidence).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 14: Self-contradiction detection across file versions', () => {
  it('detects redefined constants', () => {
    const history = [{
      path: 'kernel/defs.h',
      contentBefore: '#define PAGE_SIZE 4096\n#define MAX_PROCS 64',
      contentAfter: '#define PAGE_SIZE 8192\n#define MAX_PROCS 64',
    }];

    const contradictions = detector.detectSelfContradictions(history);
    expect(contradictions.length).toBeGreaterThanOrEqual(1);
    expect(contradictions.some(c => c.description.includes('PAGE_SIZE'))).toBe(true);
  });

  it('returns empty for consistent definitions', () => {
    const history = [{
      path: 'kernel/defs.h',
      contentBefore: '#define PAGE_SIZE 4096',
      contentAfter: '#define PAGE_SIZE 4096',
    }];

    const contradictions = detector.detectSelfContradictions(history);
    expect(contradictions).toHaveLength(0);
  });

  it('returns empty for empty history', () => {
    const contradictions = detector.detectSelfContradictions([]);
    expect(contradictions).toHaveLength(0);
  });
});

describe('Feature: hallucination-benchmark, Property 15: Hallucination report serialization round-trip', () => {
  it('report serializes to JSON and back correctly', () => {
    const report = detector.analyze('#define SYS_fork 42\n', 'test.c');

    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as HallucinationReport;

    expect(parsed.totalInstances).toBe(report.totalInstances);
    expect(parsed.instances.length).toBe(report.instances.length);
    expect(parsed.bySeverity).toEqual(report.bySeverity);
    expect(parsed.byType).toEqual(report.byType);

    for (let i = 0; i < parsed.instances.length; i++) {
      expect(parsed.instances[i].type).toBe(report.instances[i].type);
      expect(parsed.instances[i].severity).toBe(report.instances[i].severity);
      expect(parsed.instances[i].confidence).toBeCloseTo(report.instances[i].confidence);
    }
  });

  it('property: any analysis result serializes correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (code) => {
          const report = detector.analyze(code, 'test.c');
          const json = JSON.stringify(report);
          const parsed = JSON.parse(json);

          expect(parsed.totalInstances).toBe(report.totalInstances);
        },
      ),
      { numRuns: 50 },
    );
  });
});
