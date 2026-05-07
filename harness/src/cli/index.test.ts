import { describe, it, expect } from 'vitest';
import { program } from './index.js';

describe('CLI', () => {
  it('has run command', () => {
    const cmds = program.commands.map(c => c.name());
    expect(cmds).toContain('run');
  });

  it('has resume command', () => {
    const cmds = program.commands.map(c => c.name());
    expect(cmds).toContain('resume');
  });

  it('has results command', () => {
    const cmds = program.commands.map(c => c.name());
    expect(cmds).toContain('results');
  });

  it('has report command', () => {
    const cmds = program.commands.map(c => c.name());
    expect(cmds).toContain('report');
  });

  it('has validate command', () => {
    const cmds = program.commands.map(c => c.name());
    expect(cmds).toContain('validate');
  });
});
