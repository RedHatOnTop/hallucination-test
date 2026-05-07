import type { Phase } from './session.js';

export type ScoreCategory = 'build' | 'boot' | 'functionality' | 'consistency' | 'originality';

export type CategoryWeight = Record<ScoreCategory, number>;

export const CATEGORY_WEIGHTS: CategoryWeight = {
  build: 0.20,
  boot: 0.25,
  functionality: 0.30,
  consistency: 0.15,
  originality: 0.10,
} as const;

export interface ScoreBreakdown {
  metric: string;
  value: unknown;
  score: number;
}

export interface CategoryScore {
  category: ScoreCategory;
  rawScore: number;
  weight: number;
  weightedScore: number;
  breakdown: ScoreBreakdown[];
}

export interface ScoringInput {
  buildResult: BuildScoreInput;
  bootResult: BootScoreInput;
  testResult: TestScoreInput;
  consistencyData: ConsistencyData;
  plagiarismReport: PlagiarismScoreInput;
}

export interface BuildScoreInput {
  compilationSuccess: boolean;
  warningCount: number;
  errorCount: number;
}

export interface BootScoreInput {
  qemuBoot: boolean;
  reachedSerialOutput: boolean;
  bootTimeMs: number;
}

export interface TestScoreInput {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  phaseResults: Map<Phase, PhaseTestResult>;
}

export interface PhaseTestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface ConsistencyData {
  selfContradictionRatio: number;
  declaredUnimplementedRatio: number;
}

export interface PlagiarismScoreInput {
  plagiarismProportion: number;
  flaggedBlocksCount: number;
  totalBlocksCount: number;
}

export interface ScoringResult {
  sessionId: string;
  timestamp: string;
  finalScore: number;
  categories: CategoryScore[];
  phaseScores: Map<Phase, number>;
}
