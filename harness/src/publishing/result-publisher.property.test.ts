import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ResultPublisher } from './result-publisher.js';
import type { HallucinationInstance } from '../types/hallucination.js';

function makeReport(overrides: Record<string, unknown> = {}): ReturnType<ResultPublisher['generateModelReport']> {
  const publisher = new ResultPublisher();
  return publisher.generateModelReport({
    provider: 'test',
    model: 'test-model',
    sessionId: 'session-1',
    scoringResult: {
      finalScore: 50,
      categories: [
        { category: 'build', rawScore: 60, weight: 0.20, weightedScore: 12 },
        { category: 'boot', rawScore: 40, weight: 0.25, weightedScore: 10 },
        { category: 'functionality', rawScore: 50, weight: 0.30, weightedScore: 15 },
        { category: 'consistency', rawScore: 60, weight: 0.15, weightedScore: 9 },
        { category: 'originality', rawScore: 40, weight: 0.10, weightedScore: 4 },
      ],
      phaseScores: { bootloader: 80, memory: 40 },
    },
    hallucinationReport: { totalInstances: 5, instances: [] },
    plagiarismReport: { overallSimilarityRatio: 0.1 },
    sessionDuration: 60000,
    totalTokensUsed: 100000,
    ...overrides,
  } as any);
}

describe('Feature: hallucination-benchmark, Property 18: Report generation completeness', () => {
  it('markdown report contains all required sections', () => {
    const publisher = new ResultPublisher();
    const report = makeReport();
    const md = publisher.generateMarkdownReport(report);

    expect(md).toContain('Category Scores');
    expect(md).toContain('Phase Scores');
    expect(md).toContain('Hallucination Highlights');
    expect(md).toContain('build');
    expect(md).toContain('boot');
    expect(md).toContain('functionality');
    expect(md).toContain('consistency');
    expect(md).toContain('originality');
    expect(md).toContain('Plagiarism Ratio');
    expect(md).toContain('Session Duration');
    expect(md).toContain('Total Tokens');
  });

  it('comparison table has all required columns', () => {
    const publisher = new ResultPublisher();
    publisher.generateModelReport({
      provider: 'anthropic',
      model: 'claude-1',
      sessionId: 'session-1',
      scoringResult: {
        finalScore: 50,
        categories: [
          { category: 'build', rawScore: 60, weight: 0.20, weightedScore: 12 },
          { category: 'boot', rawScore: 40, weight: 0.25, weightedScore: 10 },
          { category: 'functionality', rawScore: 50, weight: 0.30, weightedScore: 15 },
          { category: 'consistency', rawScore: 60, weight: 0.15, weightedScore: 9 },
          { category: 'originality', rawScore: 40, weight: 0.10, weightedScore: 4 },
        ],
        phaseScores: {},
      },
      hallucinationReport: { totalInstances: 0, instances: [] },
      plagiarismReport: { overallSimilarityRatio: 0 },
      sessionDuration: 0,
      totalTokensUsed: 0,
    });
    publisher.generateModelReport({
      provider: 'openai',
      model: 'gpt-1',
      sessionId: 'session-2',
      scoringResult: {
        finalScore: 60,
        categories: [
          { category: 'build', rawScore: 70, weight: 0.20, weightedScore: 14 },
          { category: 'boot', rawScore: 50, weight: 0.25, weightedScore: 12.5 },
          { category: 'functionality', rawScore: 60, weight: 0.30, weightedScore: 18 },
          { category: 'consistency', rawScore: 50, weight: 0.15, weightedScore: 7.5 },
          { category: 'originality', rawScore: 80, weight: 0.10, weightedScore: 8 },
        ],
        phaseScores: {},
      },
      hallucinationReport: { totalInstances: 0, instances: [] },
      plagiarismReport: { overallSimilarityRatio: 0 },
      sessionDuration: 0,
      totalTokensUsed: 0,
    });

    const table = publisher.generateComparisonTable();
    expect(table.models.length).toBeGreaterThanOrEqual(1);

    const md = publisher.generateComparisonMarkdown(table);
    expect(md).toContain('Final');
    expect(md).toContain('Build');
    expect(md).toContain('Boot');
    expect(md).toContain('Func');
    expect(md).toContain('Cons');
    expect(md).toContain('Orig');
    expect(md).toContain('Halluc');
    expect(md).toContain('Plag');
  });
});

describe('Feature: hallucination-benchmark, Property 19: Incremental result update preservation', () => {
  it('adding new report preserves existing entries', () => {
    const publisher = new ResultPublisher();

    publisher.generateModelReport({
      provider: 'anthropic',
      model: 'claude-1',
      sessionId: 'session-1',
      scoringResult: { finalScore: 50, categories: [], phaseScores: {} },
      hallucinationReport: { totalInstances: 0, instances: [] },
      plagiarismReport: { overallSimilarityRatio: 0 },
      sessionDuration: 0,
      totalTokensUsed: 0,
    });
    const table1 = publisher.generateComparisonTable();

    publisher.generateModelReport({
      provider: 'openai',
      model: 'gpt-1',
      sessionId: 'session-2',
      scoringResult: { finalScore: 60, categories: [], phaseScores: {} },
      hallucinationReport: { totalInstances: 0, instances: [] },
      plagiarismReport: { overallSimilarityRatio: 0 },
      sessionDuration: 0,
      totalTokensUsed: 0,
    });
    const table2 = publisher.generateComparisonTable();

    expect(table2.models.length).toBe(table1.models.length + 1);
    expect(table2.models.some(m => m.provider === 'anthropic' && m.model === 'claude-1')).toBe(true);
  });
});

describe('Feature: hallucination-benchmark, Property 20: Top-5 hallucination highlight selection', () => {
  it('selects top 5 by confidence', () => {
    const publisher = new ResultPublisher();

    const instances: HallucinationInstance[] = Array.from({ length: 10 }, (_, i) => ({
      id: `hall-${i}`,
      type: 'incorrect-syscall-number' as const,
      severity: 'major' as const,
      location: { file: 'test.c', line: i, column: 0 },
      description: `Test ${i}`,
      evidence: '',
      confidence: i / 10,
    }));

    const report = publisher.generateModelReport({
      provider: 'test',
      model: 'test-model',
      sessionId: 'session-1',
      scoringResult: {
        finalScore: 50,
        categories: [],
        phaseScores: {},
      },
      hallucinationReport: { totalInstances: 10, instances },
      plagiarismReport: { overallSimilarityRatio: 0 },
      sessionDuration: 0,
      totalTokensUsed: 0,
    });

    expect(report.highlightHallucinations).toHaveLength(5);
    const confidences = report.highlightHallucinations.map(h => h.confidence);
    for (let i = 0; i < confidences.length - 1; i++) {
      expect(confidences[i]).toBeGreaterThanOrEqual(confidences[i + 1]);
    }
  });

  it('returns min(5, total) entries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (count) => {
          const publisher = new ResultPublisher();

          const instances: HallucinationInstance[] = Array.from({ length: count }, (_, i) => ({
            id: `hall-${i}`,
            type: 'logical-inconsistency' as const,
            severity: 'minor' as const,
            location: { file: 'test.c', line: i, column: 0 },
            description: `Test ${i}`,
            evidence: '',
            confidence: Math.random(),
          }));

          const report = publisher.generateModelReport({
            provider: 'test',
            model: 'test-model',
            sessionId: 'session-1',
            scoringResult: { finalScore: 0, categories: [], phaseScores: {} },
            hallucinationReport: { totalInstances: count, instances },
            plagiarismReport: { overallSimilarityRatio: 0 },
            sessionDuration: 0,
            totalTokensUsed: 0,
          });

          expect(report.highlightHallucinations).toHaveLength(Math.min(5, count));
        },
      ),
      { numRuns: 50 },
    );
  });
});
