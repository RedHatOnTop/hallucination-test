import { describe, it, expect } from 'vitest';
import { QualityGate } from './quality-gate.js';

describe('Quality Gate', () => {
  it('runSyntaxCheck returns GateResult structure', async () => {
    const gate = new QualityGate({ crossCompiler: 'echo' });
    const result = await gate.runSyntaxCheck('/tmp');
    expect(result).toHaveProperty('stage', 'syntax');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('details');
    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('durationMs');
  });

  it('runBuildCheck returns BuildGateResult structure', async () => {
    const gate = new QualityGate();
    const result = await gate.runBuildCheck('/tmp/nonexistent');
    expect(result).toHaveProperty('stage', 'build');
    expect(result).toHaveProperty('warningCount');
    expect(result).toHaveProperty('errorCount');
    expect(result.passed).toBe(false);
  });

  it('full pipeline runs all stages', async () => {
    const gate = new QualityGate();
    const result = await gate.runFullPipeline('/tmp/nonexistent-dir');
    expect(result.syntax).toHaveProperty('stage', 'syntax');
    expect(result.build).toHaveProperty('stage', 'build');
    expect(result.boot).toHaveProperty('stage', 'boot');
    expect(result.test).toHaveProperty('stage', 'test');
  });
});
