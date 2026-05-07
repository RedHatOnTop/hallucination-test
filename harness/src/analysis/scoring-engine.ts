import type { Phase } from '../types/session.js';
import { CATEGORY_WEIGHTS } from '../types/scoring.js';
import type { ScoreCategory, CategoryScore, ScoreBreakdown } from '../types/scoring.js';

export interface BuildScoreInput {
  compilationSuccess: boolean;
  warningCount: number;
  errorCount: number;
}

export interface BootScoreInput {
  qemuBoot: boolean;
  reachedSerialOutput: boolean;
}

export interface TestScoreInput {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  phaseResults: Record<string, { total: number; passed: number; failed: number; skipped: number }>;
}

export interface ConsistencyData {
  selfContradictionRatio: number;
  declaredUnimplementedRatio: number;
}

export interface PlagiarismScoreInput {
  plagiarismProportion: number;
}

export interface ScoringInput {
  buildResult: BuildScoreInput;
  bootResult: BootScoreInput;
  testResult: TestScoreInput;
  consistencyData: ConsistencyData;
  plagiarismReport: PlagiarismScoreInput;
}

export interface ScoringResult {
  finalScore: number;
  categories: CategoryScore[];
  phaseScores: Record<string, number>;
}

export class ScoringEngine {
  computeScore(input: ScoringInput): ScoringResult {
    const categories: CategoryScore[] = [
      this.computeBuildScore(input.buildResult),
      this.computeBootScore(input.bootResult),
      this.computeFunctionalityScore(input.testResult),
      this.computeConsistencyScore(input.consistencyData),
      this.computeOriginalityScore(input.plagiarismReport),
    ];

    const finalScore = categories.reduce(
      (sum, cat) => sum + cat.rawScore * cat.weight,
      0,
    );

    const phaseScores = this.computePhaseScores(input.testResult);

    return { finalScore, categories, phaseScores };
  }

  computeBuildScore(build: BuildScoreInput): CategoryScore {
    if (!build.compilationSuccess) {
      return {
        category: 'build',
        rawScore: 0,
        weight: CATEGORY_WEIGHTS.build,
        weightedScore: 0,
        breakdown: [{ metric: 'compilation_success', value: false, score: 0 }],
      };
    }

    let score = 50;
    if (build.errorCount === 0) score += 30;
    if (build.warningCount === 0) score += 20;
    else if (build.warningCount <= 5) score += 15;
    else if (build.warningCount <= 20) score += 5;

    score = Math.min(100, score);

    return {
      category: 'build',
      rawScore: score,
      weight: CATEGORY_WEIGHTS.build,
      weightedScore: score * CATEGORY_WEIGHTS.build,
      breakdown: [
        { metric: 'compilation_success', value: build.compilationSuccess, score: 50 },
        { metric: 'error_count', value: build.errorCount, score: build.errorCount === 0 ? 30 : 0 },
        { metric: 'warning_count', value: build.warningCount, score: build.warningCount === 0 ? 20 : build.warningCount <= 5 ? 15 : 5 },
      ],
    };
  }

  computeBootScore(boot: BootScoreInput): CategoryScore {
    let score = 0;
    if (boot.qemuBoot) score += 50;
    if (boot.reachedSerialOutput) score += 50;

    return {
      category: 'boot',
      rawScore: score,
      weight: CATEGORY_WEIGHTS.boot,
      weightedScore: score * CATEGORY_WEIGHTS.boot,
      breakdown: [
        { metric: 'qemu_boot', value: boot.qemuBoot, score: boot.qemuBoot ? 50 : 0 },
        { metric: 'serial_output', value: boot.reachedSerialOutput, score: boot.reachedSerialOutput ? 50 : 0 },
      ],
    };
  }

  computeFunctionalityScore(test: TestScoreInput): CategoryScore {
    if (test.totalTests === 0) {
      return {
        category: 'functionality',
        rawScore: 0,
        weight: CATEGORY_WEIGHTS.functionality,
        weightedScore: 0,
        breakdown: [],
      };
    }

    const passRate = test.passed / test.totalTests;
    const score = Math.round(passRate * 100);

    const breakdown: ScoreBreakdown[] = [];
    for (const [phase, result] of Object.entries(test.phaseResults)) {
      const phasePassRate = result.total > 0 ? result.passed / result.total : 0;
      breakdown.push({
        metric: `phase:${phase}`,
        value: Math.round(phasePassRate * 100),
        score: Math.round(phasePassRate * (100 / Object.keys(test.phaseResults).length)),
      });
    }

    return {
      category: 'functionality',
      rawScore: score,
      weight: CATEGORY_WEIGHTS.functionality,
      weightedScore: score * CATEGORY_WEIGHTS.functionality,
      breakdown,
    };
  }

  computeConsistencyScore(consistency: ConsistencyData): CategoryScore {
    const contradictionScore = Math.round((1 - consistency.selfContradictionRatio) * 50);
    const unimplementedScore = Math.round((1 - consistency.declaredUnimplementedRatio) * 50);
    const score = contradictionScore + unimplementedScore;

    return {
      category: 'consistency',
      rawScore: score,
      weight: CATEGORY_WEIGHTS.consistency,
      weightedScore: score * CATEGORY_WEIGHTS.consistency,
      breakdown: [
        { metric: 'self_contradiction_ratio', value: consistency.selfContradictionRatio, score: contradictionScore },
        { metric: 'declared_unimplemented_ratio', value: consistency.declaredUnimplementedRatio, score: unimplementedScore },
      ],
    };
  }

  computeOriginalityScore(plagiarism: PlagiarismScoreInput): CategoryScore {
    const score = Math.round((1 - plagiarism.plagiarismProportion) * 100);

    return {
      category: 'originality',
      rawScore: score,
      weight: CATEGORY_WEIGHTS.originality,
      weightedScore: score * CATEGORY_WEIGHTS.originality,
      breakdown: [
        { metric: 'plagiarism_deduction', value: plagiarism.plagiarismProportion, score },
      ],
    };
  }

  private computePhaseScores(test: TestScoreInput): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [phase, result] of Object.entries(test.phaseResults)) {
      scores[phase] = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
    }
    return scores;
  }
}
