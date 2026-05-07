import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PromptEngine } from './prompt-engine.js';

describe('Feature: hallucination-benchmark, Property 5: Incomplete code pattern detection', () => {
  const engine = new PromptEngine();

  it('detects all injected TODO patterns', () => {
    const todoVariants = [
      '// TODO: implement this',
      '// TODO implement',
      '/* TODO: fix later */',
      '#TODO something',
      '// FIXME: broken',
    ];

    for (const todo of todoVariants) {
      const patterns = engine.detectIncompletePatterns(todo, 'test.c');
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.some(p => p.type === 'todo')).toBe(true);
    }
  });

  it('detects placeholder patterns', () => {
    const placeholders = [
      'INSERT CODE HERE',
      'YOUR CODE HERE',
      'IMPLEMENT THIS',
      'FILL IN the blank',
    ];

    for (const ph of placeholders) {
      const patterns = engine.detectIncompletePatterns(ph, 'test.c');
      expect(patterns.some(p => p.type === 'placeholder')).toBe(true);
    }
  });

  it('detects empty function bodies', () => {
    const code = `void foo() {
}

int bar() {
    return 0;
}

void empty() {
}`;
    const patterns = engine.detectIncompletePatterns(code, 'test.c');
    const emptyBodies = patterns.filter(p => p.type === 'empty-body');
    expect(emptyBodies.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for complete code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }).filter(
          s => {
            if (/TODO|FIXME|INSERT\s+CODE|YOUR\s+CODE|IMPLEMENT\s+THIS|FILL\s+IN/i.test(s)) return false;
            if (s.includes('...')) return false;
            const lines = s.split('\n');
            return !lines.some(l => l.trim().endsWith('{') && !l.includes('}'));
          }
        ),
        (code) => {
          const patterns = engine.detectIncompletePatterns(code, 'test.c');
          expect(patterns).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('finds patterns in code with injected issues', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }).filter(s => !/TODO|FIXME/i.test(s)),
        fc.string({ minLength: 0, maxLength: 200 }).filter(s => !/TODO|FIXME/i.test(s)),
        fc.constantFrom('// TODO: implement', '// FIXME: broken', 'INSERT CODE HERE'),
        (prefix, suffix, pattern) => {
          const code = `${prefix}\n${pattern}\n${suffix}`;
          const detected = engine.detectIncompletePatterns(code, 'test.c');
          expect(detected.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: hallucination-benchmark, Property 6: Three-consecutive-failure area skip', () => {
  it('skips area after exactly 3 consecutive incomplete responses', () => {
    const engine = new PromptEngine();
    const stage = 'memory';

    expect(engine.recordResponse('incomplete', stage)).toBe(false);
    expect(engine.recordResponse('incomplete', stage)).toBe(false);
    expect(engine.recordResponse('complete', stage)).toBe(false);
    expect(engine.getConsecutiveIncompleteCount()).toBe(0);

    expect(engine.recordResponse('incomplete', stage)).toBe(false);
    expect(engine.recordResponse('incomplete', stage)).toBe(false);
    expect(engine.recordResponse('incomplete', stage)).toBe(true);
    expect(engine.isStageSkipped(stage)).toBe(true);
  });

  it('does not skip with fewer than 3 consecutive failures', () => {
    const engine = new PromptEngine();

    engine.recordResponse('incomplete', 'memory');
    engine.recordResponse('incomplete', 'memory');
    expect(engine.isStageSkipped('memory')).toBe(false);
  });

  it('resets counter on complete response', () => {
    const engine = new PromptEngine();

    engine.recordResponse('incomplete', 'memory');
    engine.recordResponse('incomplete', 'memory');
    engine.recordResponse('complete', 'memory');
    engine.recordResponse('incomplete', 'memory');
    expect(engine.isStageSkipped('memory')).toBe(false);
    expect(engine.getConsecutiveIncompleteCount()).toBe(1);
  });

  it('independent tracking per stage', () => {
    const engine = new PromptEngine();

    engine.recordResponse('incomplete', 'memory');
    engine.recordResponse('incomplete', 'memory');
    engine.recordResponse('incomplete', 'syscall');

    expect(engine.isStageSkipped('memory')).toBe(false);
    expect(engine.isStageSkipped('syscall')).toBe(false);
    expect(engine.getConsecutiveIncompleteCount()).toBe(1);
  });

  it('property: exactly 3 consecutive failures triggers skip, fewer do not', () => {
    const engine = new PromptEngine();

    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (responses) => {
          engine.reset();
          const stage = 'test-stage';
          let consecutive = 0;
          let skipped = false;

          for (const isIncomplete of responses) {
            consecutive = isIncomplete ? consecutive + 1 : 0;
            const result = engine.recordResponse(isIncomplete ? 'incomplete' : 'complete', stage);
            if (consecutive >= 3 && !skipped) {
              expect(result).toBe(true);
              skipped = true;
            } else if (consecutive < 3) {
              expect(result).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
