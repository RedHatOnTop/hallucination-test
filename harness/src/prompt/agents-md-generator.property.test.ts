import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateChallengeAgentsMd } from './agents-md-generator.js';

describe('Feature: hallucination-benchmark, Property 30: Challenge AGENTS.md content validation', () => {
  const content = generateChallengeAgentsMd();

  const requiredPhases = [
    'bootloader',
    'memory',
    'process',
    'system call',
    'VFS',
    'shell',
  ];

  const forbiddenTerms = [
    'hallucination',
    'benchmark',
    'measuring',
    'evaluating hallucinations',
    'being tested',
  ];

  it('contains all required phase names', () => {
    for (const phase of requiredPhases) {
      expect(content.toLowerCase()).toContain(phase.toLowerCase());
    }
  });

  it('does not contain forbidden terms', () => {
    const lowerContent = content.toLowerCase();
    for (const term of forbiddenTerms) {
      expect(lowerContent).not.toContain(term.toLowerCase());
    }
  });

  it('always produces valid content regardless of generation', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          const md = generateChallengeAgentsMd();
          const lower = md.toLowerCase();

          for (const phase of requiredPhases) {
            expect(lower).toContain(phase.toLowerCase());
          }
          for (const term of forbiddenTerms) {
            expect(lower).not.toContain(term.toLowerCase());
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});
