import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PlagiarismDetector } from './plagiarism-detector.js';

const detector = new PlagiarismDetector();

describe('Feature: hallucination-benchmark, Property 16: Code similarity measurement validity', () => {
  it('identical code has similarity 1.0', () => {
    const code = 'int main() { return 0; }';
    expect(detector.computeSimilarity(code, code)).toBe(1.0);
  });

  it('completely different code has similarity 0.0', () => {
    const code1 = 'aaa\nbbb\nccc';
    const code2 = 'xxx\nyyy\nzzz';
    expect(detector.computeSimilarity(code1, code2)).toBe(0.0);
  });

  it('similarity is always in [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (code1, code2) => {
          const sim = detector.computeSimilarity(code1, code2);
          expect(sim).toBeGreaterThanOrEqual(0);
          expect(sim).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 17: Plagiarism flagging threshold', () => {
  it('flags when >= 50 lines and >= 70% similarity', () => {
    expect(detector.isFlagged(50, 0.70)).toBe(true);
    expect(detector.isFlagged(100, 0.80)).toBe(true);
    expect(detector.isFlagged(50, 0.69)).toBe(false);
    expect(detector.isFlagged(49, 0.80)).toBe(false);
    expect(detector.isFlagged(50, 0.71)).toBe(true);
  });

  it('property: flagging threshold is exact', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (lineCount, similarity) => {
          const flagged = detector.isFlagged(lineCount, similarity);
          const shouldFlag = lineCount >= 50 && similarity >= 0.70;
          expect(flagged).toBe(shouldFlag);
        },
      ),
      { numRuns: 100 },
    );
  });
});
