import type { HallucinationType, HallucinationSeverity, HallucinationInstance, HallucinationReport, FileLocation } from '../types/hallucination.js';

const KNOWN_SYSCALL_NUMBERS: Record<string, number> = {
  'SYS_read': 3,
  'SYS_write': 4,
  'SYS_open': 5,
  'SYS_close': 6,
  'SYS_fork': 2,
  'SYS_exec': 11,
  'SYS_wait': 7,
  'SYS_exit': 1,
  'SYS_getpid': 20,
  'SYS_getppid': 64,
  'SYS_chdir': 12,
  'SYS_mkdir': 39,
  'SYS_rmdir': 40,
  'SYS_pipe': 42,
  'SYS_dup': 41,
  'SYS_dup2': 63,
  'SYS_stat': 106,
  'SYS_fstat': 28,
  'SYS_lseek': 19,
  'SYS_sleep': 174,
};

const KNOWN_REGISTERS = new Set([
  'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp',
  'cr0', 'cr2', 'cr3', 'cr4',
  'cs', 'ds', 'es', 'fs', 'gs', 'ss',
  'eip', 'eflags',
  'idtr', 'gdtr', 'ldtr', 'tr',
]);

export class HallucinationDetector {
  analyze(code: string, filename: string): HallucinationReport {
    const instances: HallucinationInstance[] = [];

    instances.push(...this.detectIncorrectSyscallNumbers(code, filename));
    instances.push(...this.detectFictitiousRegisters(code, filename));
    instances.push(...this.detectLogicalInconsistencies(code, filename));

    const bySeverity: Record<HallucinationSeverity, number> = { critical: 0, major: 0, minor: 0 };
    const byType: Record<HallucinationType, number> = {
      'non-existent-api': 0,
      'incorrect-syscall-number': 0,
      'fictitious-register': 0,
      'logical-inconsistency': 0,
      'self-contradiction': 0,
      'cot-error': 0,
    };

    for (const inst of instances) {
      bySeverity[inst.severity]++;
      byType[inst.type]++;
    }

    const highlightCases = [...instances]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return {
      sessionId: '',
      timestamp: new Date().toISOString(),
      totalInstances: instances.length,
      bySeverity,
      byType,
      instances,
      highlightCases,
    };
  }

  detectIncorrectSyscallNumbers(code: string, filename: string): HallucinationInstance[] {
    const instances: HallucinationInstance[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const [syscall, correctNum] of Object.entries(KNOWN_SYSCALL_NUMBERS)) {
        const regex = new RegExp(`#define\\s+${syscall}\\s+(\\d+)`, 'i');
        const match = line.match(regex);

        if (match) {
          const definedNum = parseInt(match[1], 10);
          if (definedNum !== correctNum) {
            instances.push({
              id: `hall-syscall-${instances.length}`,
              type: 'incorrect-syscall-number',
              severity: 'critical',
              location: { file: filename, line: i + 1, column: match.index || 0 },
              description: `${syscall} defined as ${definedNum}, correct value is ${correctNum}`,
              evidence: line.trim(),
              confidence: 0.95,
            });
          }
        }
      }
    }

    return instances;
  }

  detectFictitiousRegisters(code: string, filename: string): HallucinationInstance[] {
    const instances: HallucinationInstance[] = [];
    const lines = code.split('\n');

    const registerPattern = /\b([a-z]{2,4}[0-9]*)\b/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.matchAll(registerPattern);

      for (const match of matches) {
        const reg = match[1].toLowerCase();
        if (reg.length >= 2 && reg.length <= 4 && /^[a-z]+\d*$/.test(reg) && !KNOWN_REGISTERS.has(reg)) {
          if (/mov|push|pop|add|sub|mul|div|xor|or|and|cmp|jmp|call|ret|lea|load|store/i.test(line)) {
            instances.push({
              id: `hall-reg-${instances.length}`,
              type: 'fictitious-register',
              severity: 'major',
              location: { file: filename, line: i + 1, column: match.index || 0 },
              description: `Potentially fictitious register '${reg}' used in instruction`,
              evidence: line.trim(),
              confidence: 0.6,
            });
          }
        }
      }
    }

    return instances;
  }

  detectLogicalInconsistencies(code: string, filename: string): HallucinationInstance[] {
    const instances: HallucinationInstance[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/if\s*\(\s*\w+\s*==\s*\w+\s*\)\s*\{\s*return\s+\1;\s*\}/.test(line)) {
        instances.push({
          id: `hall-logic-${instances.length}`,
          type: 'logical-inconsistency',
          severity: 'major',
          location: { file: filename, line: i + 1, column: 0 },
          description: 'Comparison always evaluates to the same result',
          evidence: line.trim(),
          confidence: 0.8,
        });
      }
    }

    return instances;
  }

  detectSelfContradictions(
    history: Array<{ path: string; contentBefore: string; contentAfter: string }>,
  ): HallucinationInstance[] {
    const instances: HallucinationInstance[] = [];

    const defineRegex = /#define\s+(\w+)\s+(.+)/g;

    for (const change of history) {
      const beforeDefs = new Map<string, string>();
      let match;

      while ((match = defineRegex.exec(change.contentBefore)) !== null) {
        beforeDefs.set(match[1], match[2].trim());
      }

      defineRegex.lastIndex = 0;
      while ((match = defineRegex.exec(change.contentAfter)) !== null) {
        const name = match[1];
        const afterValue = match[2].trim();
        const beforeValue = beforeDefs.get(name);

        if (beforeValue && beforeValue !== afterValue) {
          instances.push({
            id: `hall-contradict-${instances.length}`,
            type: 'self-contradiction',
            severity: 'major',
            location: { file: change.path, line: 0, column: 0 },
            description: `Constant '${name}' redefined from '${beforeValue}' to '${afterValue}'`,
            evidence: `${name}: ${beforeValue} -> ${afterValue}`,
            confidence: 0.9,
          });
        }
      }
    }

    return instances;
  }
}
