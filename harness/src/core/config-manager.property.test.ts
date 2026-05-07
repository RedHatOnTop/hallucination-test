import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { serializeConfigRoundTrip, validateConfig, validateRequiredFields } from './config-manager.js';

function makeValidConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    api_key: 'sk-test-key',
    api_endpoint: 'https://api.anthropic.com/v1',
    tool_calling: true,
    challenge: {
      version: '1.0',
      language: 'c',
      boot_method: 'grub-multiboot',
    },
    harness: {
      max_retries: 3,
      retry_backoff_ms: 1000,
      qemu_timeout_ms: 30000,
      serial_capture_timeout_ms: 10000,
    },
    ...overrides,
  };
}

describe('Feature: hallucination-benchmark, Property 3: Configuration serialization round-trip', () => {
  it('serializing and parsing back produces equivalent config', () => {
    fc.assert(
      fc.property(
        fc.record({
          provider: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          model: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/),
          apiKey: fc.string({ minLength: 1, maxLength: 100 }),
          apiEndpoint: fc.constant('https://api.example.com/v1'),
          toolCallingSupported: fc.boolean(),
          challengeVersion: fc.string({ minLength: 1, maxLength: 10 }),
          implementationLanguage: fc.constantFrom<'c' | 'c++'>('c', 'c++'),
          bootMethod: fc.constantFrom<'grub-multiboot' | 'custom'>('grub-multiboot', 'custom'),
          maxRetries: fc.integer({ min: 1, max: 10 }),
          retryBackoffMs: fc.integer({ min: 100, max: 10000 }),
          incompleteCodeMaxRetries: fc.integer({ min: 1, max: 10 }),
          qemuBinary: fc.constant('qemu-system-i386'),
          qemuTimeout: fc.integer({ min: 1000, max: 60000 }),
          serialCaptureTimeout: fc.integer({ min: 1000, max: 30000 }),
        }),
        (config) => {
          const roundTripped = serializeConfigRoundTrip(config);
          expect(roundTripped.provider).toBe(config.provider);
          expect(roundTripped.model).toBe(config.model);
          expect(roundTripped.apiKey).toBe(config.apiKey);
          expect(roundTripped.apiEndpoint).toBe(config.apiEndpoint);
          expect(roundTripped.toolCallingSupported).toBe(config.toolCallingSupported);
          expect(roundTripped.challengeVersion).toBe(config.challengeVersion);
          expect(roundTripped.implementationLanguage).toBe(config.implementationLanguage);
          expect(roundTripped.bootMethod).toBe(config.bootMethod);
          expect(roundTripped.maxRetries).toBe(config.maxRetries);
          expect(roundTripped.retryBackoffMs).toBe(config.retryBackoffMs);
          expect(roundTripped.qemuTimeout).toBe(config.qemuTimeout);
          expect(roundTripped.serialCaptureTimeout).toBe(config.serialCaptureTimeout);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 26: API configuration validation with error reporting', () => {
  it('complete configs should pass validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          provider: fc.string({ minLength: 1, maxLength: 50 }),
          model: fc.string({ minLength: 1, maxLength: 50 }),
          api_key: fc.string({ minLength: 1, maxLength: 100 }),
          api_endpoint: fc.webUrl(),
          tool_calling: fc.boolean(),
        }),
        (fields) => {
          const config = makeValidConfig(fields);
          const result = validateConfig(config);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('configs missing required fields should be rejected with all missing field names', () => {
    const requiredFields = ['api_key', 'api_endpoint', 'provider', 'model'];

    for (const field of requiredFields) {
      const config = makeValidConfig();
      delete config[field];
      const result = validateRequiredFields(config);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain(field);
    }
  });

  it('missing multiple fields reports all of them', () => {
    const config: Record<string, unknown> = {};
    const result = validateRequiredFields(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('api_key');
    expect(result.missingFields).toContain('api_endpoint');
    expect(result.missingFields).toContain('provider');
    expect(result.missingFields).toContain('model');
    expect(result.missingFields).toHaveLength(4);
  });

  it('empty string fields are treated as missing', () => {
    const config = makeValidConfig({
      provider: '',
      model: '   ',
    });
    const result = validateRequiredFields(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('provider');
    expect(result.missingFields).toContain('model');
  });
});
