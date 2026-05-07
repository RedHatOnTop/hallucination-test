import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isValidPathComponent, validatePathComponent, buildResultPath } from './path-validation.js';

describe('Feature: hallucination-benchmark, Property 25: Provider and model name validation', () => {
  it('accepts valid lowercase alphanumeric with hyphens', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 })
          .chain((first) =>
            fc.array(
              fc.tuple(
                fc.constant('-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
              ),
              { maxLength: 5 },
            ).map((parts) => first + parts.flat().join('')),
          ),
        (name) => {
          expect(isValidPathComponent(name)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects uppercase letters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /[A-Z]/.test(s)),
        (name) => {
          expect(isValidPathComponent(name)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects special characters', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'!@#$%^&*()+=[]{}|;:\'",.<>?/~`'.split('')), { minLength: 1, maxLength: 10 }),
        (name) => {
          expect(isValidPathComponent(name)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects empty strings', () => {
    expect(isValidPathComponent('')).toBe(false);
  });

  it('rejects leading hyphens', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
        (base) => {
          expect(isValidPathComponent('-' + base)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects trailing hyphens', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
        (base) => {
          expect(isValidPathComponent(base + '-')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects consecutive hyphens', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 5 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 5 }),
        (a, b) => {
          expect(isValidPathComponent(a + '--' + b)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('builds correct result path for valid names', () => {
    const result = buildResultPath('anthropic', 'claude-sonnet-4-5');
    expect(result.valid).toBe(true);
    expect(result.path).toBe('results/anthropic/claude-sonnet-4-5');
    expect(result.errors).toHaveLength(0);
  });

  it('fails path building for invalid provider', () => {
    const result = buildResultPath('Anthropic', 'claude-sonnet-4-5');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails path building for invalid model', () => {
    const result = buildResultPath('anthropic', 'claude sonnet');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('pattern matches exactly: ^[a-z0-9]+(-[a-z0-9]+)*$', () => {
    expect(isValidPathComponent('a')).toBe(true);
    expect(isValidPathComponent('0')).toBe(true);
    expect(isValidPathComponent('a-b')).toBe(true);
    expect(isValidPathComponent('my-model-v2')).toBe(true);
    expect(isValidPathComponent('-a')).toBe(false);
    expect(isValidPathComponent('a-')).toBe(false);
    expect(isValidPathComponent('a--b')).toBe(false);
    expect(isValidPathComponent('A')).toBe(false);
    expect(isValidPathComponent('a_b')).toBe(false);
    expect(isValidPathComponent('a.b')).toBe(false);
  });
});
