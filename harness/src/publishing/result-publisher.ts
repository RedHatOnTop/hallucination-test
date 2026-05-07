import type { HallucinationInstance } from '../types/hallucination.js';
import type { Phase } from '../types/session.js';
import { CATEGORY_WEIGHTS } from '../types/scoring.js';

export interface ModelReport {
  provider: string;
  model: string;
  sessionId: string;
  timestamp: string;
  finalScore: number;
  categoryScores: Array<{
    category: string;
    rawScore: number;
    weight: number;
    weightedScore: number;
  }>;
  hallucinationFrequency: number;
  plagiarismRatio: number;
  highlightHallucinations: HallucinationInstance[];
  phaseScores: Record<string, number>;
  sessionDuration: number;
  totalTokensUsed: number;
}

export interface ComparisonTable {
  models: Array<{
    provider: string;
    model: string;
    finalScore: number;
    buildScore: number;
    bootScore: number;
    functionalityScore: number;
    consistencyScore: number;
    originalityScore: number;
    hallucinationFrequency: number;
    plagiarismRatio: number;
  }>;
  lastUpdated: string;
}

export class ResultPublisher {
  private reports: Map<string, ModelReport> = new Map();

  generateModelReport(
    sessionData: {
      provider: string;
      model: string;
      sessionId: string;
      scoringResult: {
        finalScore: number;
        categories: Array<{
          category: string;
          rawScore: number;
          weight: number;
          weightedScore: number;
        }>;
        phaseScores: Record<string, number>;
      };
      hallucinationReport: { totalInstances: number; instances: HallucinationInstance[] };
      plagiarismReport: { overallSimilarityRatio: number };
      sessionDuration: number;
      totalTokensUsed: number;
    },
  ): ModelReport {
    const top5 = [...sessionData.hallucinationReport.instances]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const report: ModelReport = {
      provider: sessionData.provider,
      model: sessionData.model,
      sessionId: sessionData.sessionId,
      timestamp: new Date().toISOString(),
      finalScore: sessionData.scoringResult.finalScore,
      categoryScores: sessionData.scoringResult.categories,
      hallucinationFrequency: sessionData.hallucinationReport.totalInstances,
      plagiarismRatio: sessionData.plagiarismReport.overallSimilarityRatio,
      highlightHallucinations: top5,
      phaseScores: sessionData.scoringResult.phaseScores,
      sessionDuration: sessionData.sessionDuration,
      totalTokensUsed: sessionData.totalTokensUsed,
    };

    this.reports.set(`${sessionData.provider}/${sessionData.model}`, report);
    return report;
  }

  generateComparisonTable(): ComparisonTable {
    const models = Array.from(this.reports.values()).map(report => {
      const buildScore = report.categoryScores.find(c => c.category === 'build')?.rawScore ?? 0;
      const bootScore = report.categoryScores.find(c => c.category === 'boot')?.rawScore ?? 0;
      const funcScore = report.categoryScores.find(c => c.category === 'functionality')?.rawScore ?? 0;
      const consScore = report.categoryScores.find(c => c.category === 'consistency')?.rawScore ?? 0;
      const origScore = report.categoryScores.find(c => c.category === 'originality')?.rawScore ?? 0;

      return {
        provider: report.provider,
        model: report.model,
        finalScore: report.finalScore,
        buildScore,
        bootScore,
        functionalityScore: funcScore,
        consistencyScore: consScore,
        originalityScore: origScore,
        hallucinationFrequency: report.hallucinationFrequency,
        plagiarismRatio: report.plagiarismRatio,
      };
    });

    models.sort((a, b) => b.finalScore - a.finalScore);

    return {
      models,
      lastUpdated: new Date().toISOString(),
    };
  }

  updateRankings(newReport: ModelReport): void {
    const key = `${newReport.provider}/${newReport.model}`;
    this.reports.set(key, newReport);
  }

  getReport(provider: string, model: string): ModelReport | undefined {
    return this.reports.get(`${provider}/${model}`);
  }

  getAllReports(): ModelReport[] {
    return Array.from(this.reports.values());
  }

  generateMarkdownReport(report: ModelReport): string {
    const lines: string[] = [
      `# Benchmark Report: ${report.provider}/${report.model}`,
      '',
      `**Session ID:** ${report.sessionId}`,
      `**Date:** ${report.timestamp}`,
      `**Final Score:** ${report.finalScore.toFixed(1)} / 100`,
      '',
      '## Category Scores',
      '',
      '| Category | Score | Weight | Weighted |',
      '|----------|-------|--------|----------|',
    ];

    for (const cat of report.categoryScores) {
      lines.push(`| ${cat.category} | ${cat.rawScore} | ${(cat.weight * 100).toFixed(0)}% | ${cat.weightedScore.toFixed(1)} |`);
    }

    lines.push('');
    lines.push('## Phase Scores');
    lines.push('');
    lines.push('| Phase | Score |');
    lines.push('|-------|-------|');

    for (const [phase, score] of Object.entries(report.phaseScores)) {
      lines.push(`| ${phase} | ${score} |`);
    }

    lines.push('');
    lines.push('## Hallucination Highlights');
    lines.push('');
    lines.push(`Total hallucinations: ${report.hallucinationFrequency}`);
    lines.push('');

    for (const h of report.highlightHallucinations) {
      lines.push(`- **[${h.severity}]** ${h.type}: ${h.description} (confidence: ${(h.confidence * 100).toFixed(0)}%)`);
    }

    lines.push('');
    lines.push(`**Plagiarism Ratio:** ${(report.plagiarismRatio * 100).toFixed(1)}%`);
    lines.push(`**Session Duration:** ${(report.sessionDuration / 1000).toFixed(1)}s`);
    lines.push(`**Total Tokens:** ${report.totalTokensUsed.toLocaleString()}`);

    return lines.join('\n');
  }

  generateComparisonMarkdown(table: ComparisonTable): string {
    const lines: string[] = [
      '# Model Comparison',
      '',
      `*Last updated: ${table.lastUpdated}*`,
      '',
      '| Rank | Provider | Model | Final | Build | Boot | Func | Cons | Orig | Halluc | Plag |',
      '|------|----------|-------|-------|-------|------|------|------|------|--------|------|',
    ];

    table.models.forEach((m, i) => {
      lines.push(
        `| ${i + 1} | ${m.provider} | ${m.model} | ${m.finalScore.toFixed(1)} | ${m.buildScore} | ${m.bootScore} | ${m.functionalityScore} | ${m.consistencyScore} | ${m.originalityScore} | ${m.hallucinationFrequency} | ${(m.plagiarismRatio * 100).toFixed(1)}% |`,
      );
    });

    return lines.join('\n');
  }
}
