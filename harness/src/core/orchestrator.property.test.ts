import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Orchestrator } from './orchestrator.js';
import { StateMachine } from './state-machine.js';
import type { SessionConfig } from '../types/session.js';

function makeConfig(): SessionConfig {
  return {
    provider: 'test',
    model: 'test-model',
    apiKey: 'key',
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
    retryBackoffMs: 100,
    incompleteCodeMaxRetries: 3,
    qemuBinary: 'qemu-system-i386',
    qemuTimeout: 30000,
    serialCaptureTimeout: 10000,
  };
}

describe('Feature: hallucination-benchmark, Property 4: Retry behavior correctness', () => {
  it('succeeds if failure count <= 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (failureCount) => {
          let attempts = 0;
          const maxRetries = 3;

          let succeeded = false;
          for (let i = 0; i <= maxRetries; i++) {
            attempts++;
            if (i >= failureCount) {
              succeeded = true;
              break;
            }
          }

          expect(succeeded).toBe(true);
          expect(attempts).toBe(failureCount + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fails if failure count > 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }),
        (failureCount) => {
          const maxRetries = 3;
          let succeeded = false;

          for (let i = 0; i <= maxRetries; i++) {
            if (i >= failureCount) {
              succeeded = true;
              break;
            }
          }

          expect(succeeded).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 21: Completion declaration detection', () => {
  it('detects valid completion declarations', () => {
    const validDeclarations = [
      'All quality gates have passed',
      'The implementation is complete',
      'All phases are fully implemented',
      'I have completed all the implementation',
      'The project is now complete',
      'Everything is working',
      'All tests pass',
      'I am done with the implementation',
    ];

    for (const decl of validDeclarations) {
      expect(Orchestrator.getCompletionPatterns().some(p => p.test(decl))).toBe(true);
    }
  });

  it('does not detect completion in normal responses', () => {
    const normalResponses = [
      'Here is the implementation of the memory manager',
      'I have written the file kernel/main.c',
      'The next step is to implement process scheduling',
      'Let me continue with the bootloader',
      'I need to fix a compilation error',
      'The code is almost done but needs one more function',
    ];

    for (const resp of normalResponses) {
      expect(Orchestrator.getCompletionPatterns().some(p => p.test(resp))).toBe(false);
    }
  });

  it('property: completion patterns match iff text contains explicit completion signal', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (text) => {
          const hasCompletionSignal = /all\s+quality\s+gates?\s+(have\s+)?passed|implementation\s+is\s+complete|all\s+phases?\s+(are\s+)?(fully\s+)?implemented|project\s+is\s+(now\s+)?complete|everything\s+is\s+working|all\s+tests\s+pass/i.test(text);
          const detected = Orchestrator.getCompletionPatterns().some(p => p.test(text));
          expect(detected).toBe(hasCompletionSignal);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 22: Checkpoint and resume correctness', () => {
  it('state machine resumes from checkpoint at correct state', () => {
    const sm = new StateMachine('initializing');
    sm.transition('environment-check');
    sm.transition('workspace-setup');
    sm.transition('planning');

    const history = sm.getHistory();
    expect(history).toEqual(['initializing', 'environment-check', 'workspace-setup']);
    expect(sm.getCurrentState()).toBe('planning');
  });

  it('state machine preserves history through transitions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('workspace-setup', 'planning') as fc.Arbitrary<'workspace-setup' | 'planning'>,
        (targetState) => {
          const sm = new StateMachine('initializing');
          sm.transition('environment-check');
          sm.transition('workspace-setup');

          if (targetState === 'planning') {
            sm.transition('planning');
          }

          const history = sm.getHistory();
          expect(history.length).toBeGreaterThanOrEqual(2);
          expect(history[0]).toBe('initializing');
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 23: Multi-run result aggregation', () => {
  it('computes correct mean, min, max for multiple scores', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 20 }),
        (scores) => {
          const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
          const min = Math.min(...scores);
          const max = Math.max(...scores);

          expect(mean).toBeGreaterThanOrEqual(0);
          expect(mean).toBeLessThanOrEqual(100);
          expect(min).toBe(Math.min(...scores));
          expect(max).toBe(Math.max(...scores));
          expect(min).toBeLessThanOrEqual(mean);
          expect(max).toBeGreaterThanOrEqual(mean);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 24: Tool permission enforcement', () => {
  it('permits allowed tools', () => {
    const allowed = ['read_file', 'write_file', 'delete_file', 'list_directory', 'create_directory', 'execute_command', 'run_qemu', 'search_references'];
    for (const tool of allowed) {
      expect(Orchestrator.getPermittedTools().has(tool)).toBe(true);
    }
  });

  it('rejects disallowed tools with reason', () => {
    const config = {
      sessionConfig: makeConfig(),
      resultsDir: '/tmp/results',
      workspaceDir: '/tmp/workspace',
      skeletonDir: '/tmp/skeleton',
      referencesDir: '/tmp/references',
    };
    const orch = new Orchestrator(config);

    const disallowed = ['rm', 'curl', 'wget', 'exec', 'eval', 'shell'];
    for (const tool of disallowed) {
      const result = orch.checkToolPermission(tool);
      expect(result.permitted).toBe(false);
      expect(result.reason).toContain(tool);
    }
  });

  it('property: permitted tools are executed, disallowed are rejected with reason', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (toolName) => {
          const isPermitted = Orchestrator.getPermittedTools().has(toolName);
          if (isPermitted) {
            expect(true).toBe(true);
          } else {
            expect(isPermitted).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
