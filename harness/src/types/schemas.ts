import { z } from 'zod';

export const FileLocationSchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
});

export const HallucinationTypeSchema = z.enum([
  'non-existent-api',
  'incorrect-syscall-number',
  'fictitious-register',
  'logical-inconsistency',
  'self-contradiction',
  'cot-error',
]);

export const HallucinationSeveritySchema = z.enum(['critical', 'major', 'minor']);

export const HallucinationInstanceSchema = z.object({
  id: z.string().min(1),
  type: HallucinationTypeSchema,
  severity: HallucinationSeveritySchema,
  location: FileLocationSchema,
  description: z.string().min(1),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

export const HallucinationReportSchema = z.object({
  sessionId: z.string().min(1),
  timestamp: z.string().datetime(),
  totalInstances: z.number().int().nonnegative(),
  bySeverity: z.record(HallucinationSeveritySchema, z.number().int().nonnegative()),
  byType: z.record(HallucinationTypeSchema, z.number().int().nonnegative()),
  instances: z.array(HallucinationInstanceSchema),
  highlightCases: z.array(HallucinationInstanceSchema),
});

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const PhaseSchema = z.enum([
  'bootloader',
  'memory',
  'process',
  'syscall',
  'vfs',
  'shell',
]);

export const WorkflowStateSchema = z.enum([
  'initializing',
  'environment-check',
  'workspace-setup',
  'planning',
  'implementation',
  'intermediate-verification',
  'final-verification',
  'result-collection',
  'analysis',
  'publishing',
  'failed',
  'completed',
]);

export const ScoreCategorySchema = z.enum([
  'build',
  'boot',
  'functionality',
  'consistency',
  'originality',
]);

export const ScoreBreakdownSchema = z.object({
  metric: z.string(),
  value: z.unknown(),
  score: z.number(),
});

export const CategoryScoreSchema = z.object({
  category: ScoreCategorySchema,
  rawScore: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  weightedScore: z.number().min(0).max(100),
  breakdown: z.array(ScoreBreakdownSchema),
});

export const ScoringResultSchema = z.object({
  sessionId: z.string().min(1),
  timestamp: z.string().datetime(),
  finalScore: z.number().min(0).max(100),
  categories: z.array(CategoryScoreSchema),
  phaseScores: z.record(z.string(), z.number()),
});

export const ToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
});

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  tokenUsage: TokenUsageSchema.optional(),
  timestamp: z.string().datetime().optional(),
});

export const CheckpointSchema = z.object({
  state: WorkflowStateSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const FileChangeSchema = z.object({
  timestamp: z.string().datetime(),
  operation: z.enum(['create', 'modify', 'delete']),
  path: z.string().min(1),
  contentBefore: z.string().optional(),
  contentAfter: z.string().optional(),
  diff: z.string().optional(),
});

export const ToolCallRecordSchema = z.object({
  timestamp: z.string().datetime(),
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()),
  result: z.unknown(),
  durationMs: z.number().nonnegative(),
  permitted: z.boolean(),
});

export const GateResultRecordSchema = z.object({
  stage: z.enum(['syntax', 'build', 'boot', 'test']),
  passed: z.boolean(),
  details: z.string(),
  logs: z.array(z.string()),
  durationMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export const SessionConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  apiEndpoint: z.string().url(),
  toolCallingSupported: z.boolean(),
  challengeVersion: z.string().min(1),
  implementationLanguage: z.enum(['c', 'c++']),
  bootMethod: z.enum(['grub-multiboot', 'custom']),
  workspaceDir: z.string().min(1),
  resultsDir: z.string().min(1),
  referencesDir: z.string().min(1),
  skeletonDir: z.string().min(1),
  maxRetries: z.number().int().positive(),
  retryBackoffMs: z.number().int().positive(),
  incompleteCodeMaxRetries: z.number().int().positive(),
  qemuBinary: z.string().min(1),
  qemuTimeout: z.number().int().positive(),
  serialCaptureTimeout: z.number().int().positive(),
});

export const SessionSchema = z.object({
  id: z.string().min(1),
  config: SessionConfigSchema.omit({ apiKey: true }),
  state: WorkflowStateSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  checkpoints: z.array(CheckpointSchema),
  messages: z.array(MessageSchema),
  fileChanges: z.array(FileChangeSchema),
  toolCalls: z.array(ToolCallRecordSchema),
  gateResults: z.array(GateResultRecordSchema),
  modelDeclaredComplete: z.boolean(),
  totalTokensUsed: TokenUsageSchema,
});
