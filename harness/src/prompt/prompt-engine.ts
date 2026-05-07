export interface IncompletePattern {
  type: 'todo' | 'stub' | 'placeholder' | 'empty-body';
  location: { file: string; line: number };
  snippet: string;
}

export interface ImplementationStage {
  name: string;
  description: string;
}

export interface StageContext {
  stage: ImplementationStage;
  previousStages: ImplementationStage[];
  filesWritten: string[];
  referenceContent: string;
}

const INCOMPLETE_PATTERNS: { regex: RegExp; type: IncompletePattern['type'] }[] = [
  { regex: /\/\/\s*TODO/i, type: 'todo' },
  { regex: /\/\*\s*TODO/i, type: 'todo' },
  { regex: /#TODO/i, type: 'todo' },
  { regex: /\/\/\s*FIXME/i, type: 'todo' },
  { regex: /INSERT\s+CODE\s+HERE/i, type: 'placeholder' },
  { regex: /YOUR\s+CODE\s+HERE/i, type: 'placeholder' },
  { regex: /IMPLEMENT\s+THIS/i, type: 'placeholder' },
  { regex: /FILL\s+IN/i, type: 'placeholder' },
  { regex: /\.\.\./, type: 'stub' },
];

const IMPLEMENTATION_STAGES: ImplementationStage[] = [
  { name: 'bootloader', description: 'Bootloader and kernel entry point' },
  { name: 'memory', description: 'Memory management (paging, allocation)' },
  { name: 'process', description: 'Process scheduling and context switching' },
  { name: 'syscall', description: 'System call interface (at least 20 POSIX syscalls)' },
  { name: 'vfs', description: 'Virtual File System layer' },
  { name: 'shell', description: 'Basic shell implementation' },
];

const MAX_CONSECUTIVE_INCOMPLETE = 3;

export class PromptEngine {
  private consecutiveIncompleteCount = 0;
  private currentStage = '';
  private skippedStages = new Set<string>();

  getStages(): ImplementationStage[] {
    return [...IMPLEMENTATION_STAGES];
  }

  detectIncompletePatterns(code: string, filename: string = ''): IncompletePattern[] {
    const patterns: IncompletePattern[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { regex, type } of INCOMPLETE_PATTERNS) {
        if (regex.test(line)) {
          patterns.push({
            type,
            location: { file: filename, line: i + 1 },
            snippet: line.trim(),
          });
        }
      }

      if (this.isEmptyFunctionBody(lines, i)) {
        patterns.push({
          type: 'empty-body',
          location: { file: filename, line: i + 1 },
          snippet: line.trim(),
        });
      }
    }

    return patterns;
  }

  private isEmptyFunctionBody(lines: string[], index: number): boolean {
    const line = lines[index].trim();
    if (!line.endsWith('{')) return false;

    for (let j = index + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine === '') continue;
      return nextLine === '}';
    }
    return true;
  }

  generatePlanningPrompt(agentsMd: string, referenceContent: string): string {
    return `You are an expert operating systems developer tasked with implementing a POSIX-compliant operating system for the i686 (x86 32-bit) architecture.

Here is your project specification:

${agentsMd}

Reference material:
${referenceContent}

Please create a detailed implementation plan covering all phases. For each phase, describe:
1. The key data structures and their relationships
2. The functions you will implement
3. How this phase integrates with the others

Your plan should be comprehensive and demonstrate deep understanding of OS internals.`;
  }

  generateStagePrompt(stage: ImplementationStage, context: StageContext): string {
    const previousSummary = context.previousStages.length > 0
      ? `\nPreviously completed phases: ${context.previousStages.map(s => s.name).join(', ')}`
      : '';

    return `Now implement the ${stage.name} phase: ${stage.description}.${previousSummary}

Files already created: ${context.filesWritten.join(', ') || 'none'}

Reference material for this phase:
${context.referenceContent}

Please provide the complete implementation for this phase. Write production-quality code with no TODOs, stubs, or placeholders. Every function must have a complete implementation.`;
  }

  generateFollowUpPrompt(issues: IncompletePattern[]): string {
    const issueList = issues
      .map(i => `- ${i.type} at ${i.location.file}:${i.location.line}: ${i.snippet}`)
      .join('\n');

    return `I noticed the following incomplete code patterns in your last submission:

${issueList}

Please rewrite the affected code with complete implementations. Do not use TODO comments, placeholder text, empty function bodies, or stub code. Every function must contain actual working logic.`;
  }

  generateVerificationPrompt(stage: ImplementationStage): string {
    return `Before we move on to the next phase, please verify that your ${stage.name} implementation:

1. Compiles without errors
2. Handles all edge cases
3. Follows the POSIX specification
4. Is complete with no TODOs or placeholders

If everything looks good, please confirm that this phase is complete and we can proceed.`;
  }

  recordResponse(status: 'complete' | 'incomplete', stage: string): boolean {
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.consecutiveIncompleteCount = 0;
    }

    if (status === 'incomplete') {
      this.consecutiveIncompleteCount++;
      if (this.consecutiveIncompleteCount >= MAX_CONSECUTIVE_INCOMPLETE) {
        this.skippedStages.add(stage);
        this.consecutiveIncompleteCount = 0;
        return true;
      }
    } else {
      this.consecutiveIncompleteCount = 0;
    }

    return false;
  }

  isStageSkipped(stage: string): boolean {
    return this.skippedStages.has(stage);
  }

  getConsecutiveIncompleteCount(): number {
    return this.consecutiveIncompleteCount;
  }

  reset(): void {
    this.consecutiveIncompleteCount = 0;
    this.currentStage = '';
    this.skippedStages.clear();
  }
}
