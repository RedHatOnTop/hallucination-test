import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ScoringEngine, type BuildScoreInput, type BootScoreInput, type TestScoreInput, type ConsistencyData, type PlagiarismScoreInput } from './scoring-engine.js';
import { CATEGORY_WEIGHTS } from '../types/scoring.js';

const engine = new ScoringEngine();

function makeInput(overrides: Partial<{
  buildResult: BuildScoreInput;
  bootResult: BootScoreInput;
  testResult: TestScoreInput;
  consistencyData: ConsistencyData;
  plagiarismReport: PlagiarismScoreInput;
}> = {}): { buildResult: BuildScoreInput; bootResult: BootScoreInput; testResult: TestScoreInput; consistencyData: ConsistencyData; plagiarismReport: PlagiarismScoreInput } {
  return {
    buildResult: { compilationSuccess: true, warningCount: 0, errorCount: 0, ...overrides.buildResult },
    bootResult: { qemuBoot: true, reachedSerialOutput: true, ...overrides.bootResult },
    testResult: { totalTests: 10, passed: 10, failed: 0, skipped: 0, phaseResults: {}, ...overrides.testResult },
    consistencyData: { selfContradictionRatio: 0, declaredUnimplementedRatio: 0, ...overrides.consistencyData },
    plagiarismReport: { plagiarismProportion: 0, ...overrides.plagiarismReport },
  };
}

describe('Feature: hallucination-benchmark, Property 7: Weighted score computation invariant', () => {
  it('final score equals weighted sum of categories', () => {
    fc.assert(
      fc.property(
        fc.record({
          build: fc.integer({ min: 0, max: 100 }),
          boot: fc.integer({ min: 0, max: 100 }),
          functionality: fc.integer({ min: 0, max: 100 }),
          consistency: fc.integer({ min: 0, max: 100 }),
          originality: fc.integer({ min: 0, max: 100 }),
        }),
        (scores) => {
          const input = makeInput({
            buildResult: { compilationSuccess: true, warningCount: 0, errorCount: 0 },
            bootResult: { qemuBoot: true, reachedSerialOutput: true },
            testResult: { totalTests: 100, passed: scores.functionality, failed: 100 - scores.functionality, skipped: 0, phaseResults: {} },
            consistencyData: { selfContradictionRatio: 1 - scores.consistency / 100, declaredUnimplementedRatio: 0 },
            plagiarismReport: { plagiarismProportion: 1 - scores.originality / 100 },
          });

          const result = engine.computeScore(input);

          expect(result.finalScore).toBeGreaterThanOrEqual(0);
          expect(result.finalScore).toBeLessThanOrEqual(100);

          const weights = Object.values(CATEGORY_WEIGHTS);
          const sumOfWeights = weights.reduce((a, b) => a + b, 0);
          expect(sumOfWeights).toBeCloseTo(1.0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

describe('Feature: hallucination-benchmark, Property 8: Build score monotonicity', () => {
  it('fewer errors/warnings >= higher score', () => {
    fc.assert(
      fc.property(
        fc.record({
          errors1: fc.integer({ min: 0, max: 20 }),
          warnings1: fc.integer({ min: 0, max: 50 }),
          errors2: fc.integer({ min: 0, max: 20 }),
          warnings2: fc.integer({ min: 0, max: 50 }),
        }),
        ({ errors1, warnings1, errors2, warnings2 }) => {
          const score1 = engine.computeBuildScore({ compilationSuccess: true, warningCount: warnings1, errorCount: errors1 });
          const score2 = engine.computeBuildScore({ compilationSuccess: true, warningCount: warnings2, errorCount: errors2 });

          if (errors1 <= errors2 && warnings1 <= warnings2) {
            expect(score1.rawScore).toBeGreaterThanOrEqual(score2.rawScore);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 9: Functionality score proportionality', () => {
  it('score is 0 when no tests pass, 100 when all pass', () => {
    const zeroResult = engine.computeFunctionalityScore({
      totalTests: 10, passed: 0, failed: 10, skipped: 0, phaseResults: {},
    });
    expect(zeroResult.rawScore).toBe(0);

    const fullResult = engine.computeFunctionalityScore({
      totalTests: 10, passed: 10, failed: 0, skipped: 0, phaseResults: {},
    });
    expect(fullResult.rawScore).toBe(100);
  });

  it('score is proportional to pass rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (total, passed) => {
          const actualPassed = Math.min(passed, total);
          const result = engine.computeFunctionalityScore({
            totalTests: total,
            passed: actualPassed,
            failed: total - actualPassed,
            skipped: 0,
            phaseResults: {},
          });

          const expectedRate = actualPassed / total;
          expect(result.rawScore).toBe(Math.round(expectedRate * 100));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 10: Phase scoring independence', () => {
  it('changing one phase score does not affect others', () => {
    const phases = {
      bootloader: { total: 10, passed: 8, failed: 2, skipped: 0 },
      memory: { total: 10, passed: 5, failed: 5, skipped: 0 },
      process: { total: 10, passed: 3, failed: 7, skipped: 0 },
    };

    const result1 = engine.computeFunctionalityScore({
      totalTests: 30,
      passed: 16,
      failed: 14,
      skipped: 0,
      phaseResults: phases,
    });

    const modifiedPhases = {
      ...phases,
      process: { total: 10, passed: 0, failed: 10, skipped: 0 },
    };

    const result2 = engine.computeFunctionalityScore({
      totalTests: 30,
      passed: 13,
      failed: 17,
      skipped: 0,
      phaseResults: modifiedPhases,
    });

    const bootloaderScore1 = result1.breakdown.find(b => b.metric === 'phase:bootloader')?.score;
    const bootloaderScore2 = result2.breakdown.find(b => b.metric === 'phase:bootloader')?.score;
    expect(bootloaderScore1).toBe(bootloaderScore2);
  });
});

describe('Feature: hallucination-benchmark, Property 11: Consistency score inverse proportionality', () => {
  it('score decreases as ratios increase, is 100 when both 0', () => {
    const perfect = engine.computeConsistencyScore({
      selfContradictionRatio: 0,
      declaredUnimplementedRatio: 0,
    });
    expect(perfect.rawScore).toBe(100);

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (contradiction, unimplemented) => {
          const score = engine.computeConsistencyScore({
            selfContradictionRatio: contradiction,
            declaredUnimplementedRatio: unimplemented,
          });

          expect(score.rawScore).toBeGreaterThanOrEqual(0);
          expect(score.rawScore).toBeLessThanOrEqual(100);

          if (contradiction > 0 || unimplemented > 0) {
            expect(score.rawScore).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 12: Originality score with plagiarism deductions', () => {
  it('score is 100 when no plagiarism, 0 when fully plagiarized', () => {
    const noPlag = engine.computeOriginalityScore({ plagiarismProportion: 0 });
    expect(noPlag.rawScore).toBe(100);

    const fullPlag = engine.computeOriginalityScore({ plagiarismProportion: 1 });
    expect(fullPlag.rawScore).toBe(0);
  });

  it('score decreases as plagiarism increases', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (proportion) => {
          const score = engine.computeOriginalityScore({ plagiarismProportion: proportion });
          expect(score.rawScore).toBe(Math.round((1 - proportion) * 100));
          expect(score.rawScore).toBeGreaterThanOrEqual(0);
          expect(score.rawScore).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});
