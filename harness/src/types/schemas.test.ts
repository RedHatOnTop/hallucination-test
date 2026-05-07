import { describe, it, expect } from 'vitest';
import {
  TokenUsageSchema,
  HallucinationInstanceSchema,
  HallucinationReportSchema,
  SessionConfigSchema,
  SessionSchema,
  MessageSchema,
  CheckpointSchema,
  ScoringResultSchema,
  CategoryScoreSchema,
  FileChangeSchema,
  ToolCallRecordSchema,
  GateResultRecordSchema,
} from './schemas.js';

describe('TokenUsageSchema', () => {
  it('accepts valid token usage', () => {
    const valid = { inputTokens: 100, outputTokens: 200, totalTokens: 300 };
    expect(TokenUsageSchema.parse(valid)).toEqual(valid);
  });

  it('rejects negative token counts', () => {
    const invalid = { inputTokens: -1, outputTokens: 200, totalTokens: 300 };
    expect(() => TokenUsageSchema.parse(invalid)).toThrow();
  });

  it('rejects non-integer token counts', () => {
    const invalid = { inputTokens: 1.5, outputTokens: 200, totalTokens: 300 };
    expect(() => TokenUsageSchema.parse(invalid)).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => TokenUsageSchema.parse({})).toThrow();
  });
});

describe('HallucinationInstanceSchema', () => {
  const validInstance = {
    id: 'hall-001',
    type: 'incorrect-syscall-number' as const,
    severity: 'critical' as const,
    location: { file: 'kernel/syscall.c', line: 45, column: 12 },
    description: 'Used syscall number 42 for fork()',
    evidence: '#define SYS_fork 42',
    confidence: 0.95,
  };

  it('accepts valid hallucination instance', () => {
    expect(HallucinationInstanceSchema.parse(validInstance)).toEqual(validInstance);
  });

  it('rejects invalid hallucination type', () => {
    const invalid = { ...validInstance, type: 'invalid-type' };
    expect(() => HallucinationInstanceSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid severity', () => {
    const invalid = { ...validInstance, severity: 'unknown' };
    expect(() => HallucinationInstanceSchema.parse(invalid)).toThrow();
  });

  it('rejects confidence outside 0-1', () => {
    expect(() => HallucinationInstanceSchema.parse({ ...validInstance, confidence: 1.5 })).toThrow();
    expect(() => HallucinationInstanceSchema.parse({ ...validInstance, confidence: -0.1 })).toThrow();
  });

  it('rejects empty description', () => {
    expect(() => HallucinationInstanceSchema.parse({ ...validInstance, description: '' })).toThrow();
  });

  it('rejects negative line number', () => {
    expect(() => HallucinationInstanceSchema.parse({
      ...validInstance,
      location: { ...validInstance.location, line: -1 },
    })).toThrow();
  });
});

describe('HallucinationReportSchema', () => {
  const validReport = {
    sessionId: 'session-123',
    timestamp: '2025-01-15T10:00:00Z',
    totalInstances: 2,
    bySeverity: { critical: 1, major: 1, minor: 0 },
    byType: {
      'non-existent-api': 1,
      'incorrect-syscall-number': 1,
      'fictitious-register': 0,
      'logical-inconsistency': 0,
      'self-contradiction': 0,
      'cot-error': 0,
    },
    instances: [],
    highlightCases: [],
  };

  it('accepts valid hallucination report', () => {
    expect(HallucinationReportSchema.parse(validReport)).toEqual(validReport);
  });

  it('rejects invalid timestamp', () => {
    expect(() => HallucinationReportSchema.parse({ ...validReport, timestamp: 'not-a-date' })).toThrow();
  });

  it('rejects negative totalInstances', () => {
    expect(() => HallucinationReportSchema.parse({ ...validReport, totalInstances: -1 })).toThrow();
  });
});

describe('SessionConfigSchema', () => {
  const validConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    apiKey: 'sk-test-key',
    apiEndpoint: 'https://api.anthropic.com/v1',
    toolCallingSupported: true,
    challengeVersion: '1.0',
    implementationLanguage: 'c' as const,
    bootMethod: 'grub-multiboot' as const,
    workspaceDir: '/tmp/workspace',
    resultsDir: '/tmp/results',
    referencesDir: '/tmp/references',
    skeletonDir: '/tmp/skeleton',
    maxRetries: 3,
    retryBackoffMs: 1000,
    incompleteCodeMaxRetries: 3,
    qemuBinary: 'qemu-system-i386',
    qemuTimeout: 30000,
    serialCaptureTimeout: 10000,
  };

  it('accepts valid config', () => {
    expect(SessionConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it('rejects missing apiKey', () => {
    const { apiKey: _, ...missingKey } = validConfig;
    expect(() => SessionConfigSchema.parse(missingKey)).toThrow();
  });

  it('rejects invalid apiEndpoint', () => {
    expect(() => SessionConfigSchema.parse({ ...validConfig, apiEndpoint: 'not-a-url' })).toThrow();
  });

  it('rejects invalid implementationLanguage', () => {
    expect(() => SessionConfigSchema.parse({ ...validConfig, implementationLanguage: 'rust' })).toThrow();
  });

  it('rejects empty provider', () => {
    expect(() => SessionConfigSchema.parse({ ...validConfig, provider: '' })).toThrow();
  });

  it('rejects zero maxRetries', () => {
    expect(() => SessionConfigSchema.parse({ ...validConfig, maxRetries: 0 })).toThrow();
  });
});

describe('MessageSchema', () => {
  it('accepts valid user message', () => {
    const msg = { role: 'user', content: 'Hello' };
    expect(MessageSchema.parse(msg)).toEqual(msg);
  });

  it('accepts message with tool calls', () => {
    const msg = {
      role: 'assistant' as const,
      content: '',
      toolCalls: [{ id: 'call-1', name: 'write_file', arguments: { path: 'test.c' } }],
    };
    expect(MessageSchema.parse(msg)).toEqual(msg);
  });

  it('rejects invalid role', () => {
    expect(() => MessageSchema.parse({ role: 'invalid', content: 'test' })).toThrow();
  });

  it('rejects missing content', () => {
    expect(() => MessageSchema.parse({ role: 'user' })).toThrow();
  });
});

describe('CheckpointSchema', () => {
  it('accepts valid checkpoint', () => {
    const cp = { state: 'planning', timestamp: '2025-01-15T10:00:00Z' };
    expect(CheckpointSchema.parse(cp)).toEqual(cp);
  });

  it('accepts checkpoint with metadata', () => {
    const cp = { state: 'implementation', timestamp: '2025-01-15T10:00:00Z', metadata: { phase: 'bootloader' } };
    expect(CheckpointSchema.parse(cp)).toEqual(cp);
  });

  it('rejects invalid state', () => {
    expect(() => CheckpointSchema.parse({ state: 'invalid', timestamp: '2025-01-15T10:00:00Z' })).toThrow();
  });
});

describe('ScoringResultSchema', () => {
  const validScore = {
    sessionId: 'session-1',
    timestamp: '2025-01-15T10:00:00Z',
    finalScore: 42.5,
    categories: [
      {
        category: 'build',
        rawScore: 85,
        weight: 0.20,
        weightedScore: 17.0,
        breakdown: [{ metric: 'compilation_success', value: true, score: 50 }],
      },
    ],
    phaseScores: { bootloader: 80, memory: 40 },
  };

  it('accepts valid scoring result', () => {
    expect(ScoringResultSchema.parse(validScore)).toEqual(validScore);
  });

  it('rejects finalScore above 100', () => {
    expect(() => ScoringResultSchema.parse({ ...validScore, finalScore: 101 })).toThrow();
  });

  it('rejects negative rawScore', () => {
    const invalid = {
      ...validScore,
      categories: [{ ...validScore.categories[0], rawScore: -1 }],
    };
    expect(() => ScoringResultSchema.parse(invalid)).toThrow();
  });
});

describe('CategoryScoreSchema', () => {
  it('accepts valid category score', () => {
    const cs = {
      category: 'build',
      rawScore: 85,
      weight: 0.20,
      weightedScore: 17.0,
      breakdown: [],
    };
    expect(CategoryScoreSchema.parse(cs)).toEqual(cs);
  });

  it('rejects invalid category', () => {
    const cs = { category: 'invalid', rawScore: 50, weight: 0.5, weightedScore: 25, breakdown: [] };
    expect(() => CategoryScoreSchema.parse(cs)).toThrow();
  });
});

describe('FileChangeSchema', () => {
  it('accepts create operation', () => {
    const fc = {
      timestamp: '2025-01-15T10:00:00Z',
      operation: 'create',
      path: 'kernel/main.c',
      contentAfter: 'int main() { return 0; }',
    };
    expect(FileChangeSchema.parse(fc)).toEqual(fc);
  });

  it('rejects invalid operation', () => {
    expect(() => FileChangeSchema.parse({
      timestamp: '2025-01-15T10:00:00Z',
      operation: 'rename',
      path: 'test.c',
    })).toThrow();
  });
});

describe('ToolCallRecordSchema', () => {
  it('accepts valid tool call record', () => {
    const tc = {
      timestamp: '2025-01-15T10:00:00Z',
      toolName: 'write_file',
      arguments: { path: 'test.c', content: 'hello' },
      result: { success: true },
      durationMs: 5,
      permitted: true,
    };
    expect(ToolCallRecordSchema.parse(tc)).toEqual(tc);
  });

  it('rejects negative duration', () => {
    expect(() => ToolCallRecordSchema.parse({
      timestamp: '2025-01-15T10:00:00Z',
      toolName: 'write_file',
      arguments: {},
      result: null,
      durationMs: -1,
      permitted: true,
    })).toThrow();
  });
});

describe('GateResultRecordSchema', () => {
  it('accepts valid gate result', () => {
    const gr = {
      stage: 'build',
      passed: true,
      details: 'Build succeeded',
      logs: ['compiling...', 'linking...'],
      durationMs: 5000,
      timestamp: '2025-01-15T10:00:00Z',
    };
    expect(GateResultRecordSchema.parse(gr)).toEqual(gr);
  });

  it('rejects invalid stage', () => {
    expect(() => GateResultRecordSchema.parse({
      stage: 'deploy',
      passed: true,
      details: '',
      logs: [],
      durationMs: 0,
      timestamp: '2025-01-15T10:00:00Z',
    })).toThrow();
  });
});

describe('SessionSchema', () => {
  it('accepts valid session', () => {
    const session = {
      id: 'session-uuid',
      config: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        apiEndpoint: 'https://api.anthropic.com/v1',
        toolCallingSupported: true,
        challengeVersion: '1.0',
        implementationLanguage: 'c',
        bootMethod: 'grub-multiboot',
        workspaceDir: '/tmp/workspace',
        resultsDir: '/tmp/results',
        referencesDir: '/tmp/references',
        skeletonDir: '/tmp/skeleton',
        maxRetries: 3,
        retryBackoffMs: 1000,
        incompleteCodeMaxRetries: 3,
        qemuBinary: 'qemu-system-i386',
        qemuTimeout: 30000,
        serialCaptureTimeout: 10000,
      },
      state: 'initializing',
      startedAt: '2025-01-15T10:00:00Z',
      checkpoints: [],
      messages: [],
      fileChanges: [],
      toolCalls: [],
      gateResults: [],
      modelDeclaredComplete: false,
      totalTokensUsed: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
    expect(SessionSchema.parse(session)).toEqual(session);
  });

  it('strips apiKey from config when present', () => {
    const session = {
      id: 'session-uuid',
      config: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        apiKey: 'secret',
        apiEndpoint: 'https://api.anthropic.com/v1',
        toolCallingSupported: true,
        challengeVersion: '1.0',
        implementationLanguage: 'c',
        bootMethod: 'grub-multiboot',
        workspaceDir: '/tmp/workspace',
        resultsDir: '/tmp/results',
        referencesDir: '/tmp/references',
        skeletonDir: '/tmp/skeleton',
        maxRetries: 3,
        retryBackoffMs: 1000,
        incompleteCodeMaxRetries: 3,
        qemuBinary: 'qemu-system-i386',
        qemuTimeout: 30000,
        serialCaptureTimeout: 10000,
      },
      state: 'initializing',
      startedAt: '2025-01-15T10:00:00Z',
      checkpoints: [],
      messages: [],
      fileChanges: [],
      toolCalls: [],
      gateResults: [],
      modelDeclaredComplete: false,
      totalTokensUsed: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
    const parsed = SessionSchema.parse(session);
    expect((parsed.config as Record<string, unknown>).apiKey).toBeUndefined();
  });
});
