import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { SessionRecorder } from './session-recorder.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SessionConfig, Message, FileChange, ToolCallRecord, GateResultRecord } from '../types/session.js';

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    provider: 'test-provider',
    model: 'test-model',
    apiKey: 'test-key',
    apiEndpoint: 'https://api.test.com/v1',
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
    ...overrides,
  };
}

describe('Feature: hallucination-benchmark, Property 2: Session recording completeness and ordering', () => {
  let recorder: SessionRecorder;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `session-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    recorder = new SessionRecorder(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('records all messages in chronological order', () => {
    const sessionId = recorder.startSession(makeConfig());
    const messages: Message[] = [
      { role: 'user', content: 'first', timestamp: '2025-01-15T10:00:00Z' },
      { role: 'assistant', content: 'second', timestamp: '2025-01-15T10:01:00Z' },
      { role: 'user', content: 'third', timestamp: '2025-01-15T10:02:00Z' },
    ];

    for (const msg of messages) {
      recorder.recordMessage(sessionId, msg, 'sent');
    }

    const session = recorder.getSessionRecord(sessionId);
    expect(session.messages).toHaveLength(3);
    expect(session.messages.map(m => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('records all file changes in order', () => {
    const sessionId = recorder.startSession(makeConfig());
    const changes: FileChange[] = [
      { timestamp: '2025-01-15T10:00:00Z', operation: 'create', path: 'main.c', contentAfter: 'int main(){}' },
      { timestamp: '2025-01-15T10:01:00Z', operation: 'modify', path: 'main.c', contentAfter: 'int main(){return 0;}' },
      { timestamp: '2025-01-15T10:02:00Z', operation: 'delete', path: 'old.c' },
    ];

    for (const change of changes) {
      recorder.recordFileChange(sessionId, change);
    }

    const session = recorder.getSessionRecord(sessionId);
    expect(session.fileChanges).toHaveLength(3);
    expect(session.fileChanges.map(c => c.operation)).toEqual(['create', 'modify', 'delete']);
  });

  it('records all tool calls in order', () => {
    const sessionId = recorder.startSession(makeConfig());
    const calls: ToolCallRecord[] = [
      { timestamp: '2025-01-15T10:00:00Z', toolName: 'write_file', arguments: {}, result: null, durationMs: 5, permitted: true },
      { timestamp: '2025-01-15T10:01:00Z', toolName: 'read_file', arguments: {}, result: null, durationMs: 3, permitted: true },
    ];

    for (const call of calls) {
      recorder.recordToolCall(sessionId, call);
    }

    const session = recorder.getSessionRecord(sessionId);
    expect(session.toolCalls).toHaveLength(2);
    expect(session.toolCalls.map(c => c.toolName)).toEqual(['write_file', 'read_file']);
  });

  it('accumulates token usage across messages', () => {
    const sessionId = recorder.startSession(makeConfig());

    recorder.recordMessage(sessionId, {
      role: 'assistant',
      content: 'msg1',
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }, 'received');

    recorder.recordMessage(sessionId, {
      role: 'assistant',
      content: 'msg2',
      tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    }, 'received');

    const session = recorder.getSessionRecord(sessionId);
    expect(session.totalTokensUsed).toEqual({
      inputTokens: 300,
      outputTokens: 150,
      totalTokens: 450,
    });
  });

  it('persists session to JSON file', () => {
    const sessionId = recorder.startSession(makeConfig());
    recorder.recordMessage(sessionId, { role: 'user', content: 'test' }, 'sent');

    const session = recorder.getSessionRecord(sessionId);
    const expectedPath = join(testDir, 'test-provider', 'test-model', 'session-record.json');
    expect(existsSync(expectedPath)).toBe(true);
  });

  it('config does not contain apiKey', () => {
    const sessionId = recorder.startSession(makeConfig({ apiKey: 'super-secret-key' }));
    const session = recorder.getSessionRecord(sessionId);
    expect((session.config as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('property: all recorded events are retrievable in order with correct counts', () => {
    fc.assert(
      fc.property(
        fc.record({
          messages: fc.array(fc.record({
            role: fc.constantFrom('user', 'assistant', 'system', 'tool') as fc.Arbitrary<'user' | 'assistant' | 'system' | 'tool'>,
            content: fc.string({ minLength: 0, maxLength: 50 }),
          })),
          fileChanges: fc.array(fc.record({
            operation: fc.constantFrom('create', 'modify', 'delete') as fc.Arbitrary<'create' | 'modify' | 'delete'>,
            path: fc.string({ minLength: 1, maxLength: 30 }),
          })),
        }),
        ({ messages, fileChanges }) => {
          const testDir = join(tmpdir(), `session-prop-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          mkdirSync(testDir, { recursive: true });
          const rec = new SessionRecorder(testDir);
          const sessionId = rec.startSession(makeConfig());

          for (const msg of messages) {
            rec.recordMessage(sessionId, { role: msg.role, content: msg.content }, 'sent');
          }
          for (const change of fileChanges) {
            rec.recordFileChange(sessionId, {
              timestamp: new Date().toISOString(),
              operation: change.operation,
              path: change.path,
            });
          }

          const session = rec.getSessionRecord(sessionId);
          expect(session.messages).toHaveLength(messages.length);
          expect(session.fileChanges).toHaveLength(fileChanges.length);

          for (let i = 0; i < messages.length; i++) {
            expect(session.messages[i].content).toBe(messages[i].content);
            expect(session.messages[i].role).toBe(messages[i].role);
          }
          for (let i = 0; i < fileChanges.length; i++) {
            expect(session.fileChanges[i].operation).toBe(fileChanges[i].operation);
            expect(session.fileChanges[i].path).toBe(fileChanges[i].path);
          }

          rmSync(testDir, { recursive: true, force: true });
        },
      ),
      { numRuns: 50 },
    );
  });
});
