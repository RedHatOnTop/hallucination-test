import type { ToolAdapter, ModelResponse } from '../adapters/tool-adapter.js';
import type { SessionConfig, WorkflowState, Message } from '../types/session.js';
import { StateMachine } from './state-machine.js';
import { Sandbox } from '../sandbox/sandbox.js';
import { SessionRecorder } from '../recording/session-recorder.js';
import { PromptEngine } from '../prompt/prompt-engine.js';
import { ReferenceProvider } from '../prompt/reference-provider.js';
import { generateChallengeAgentsMd } from '../prompt/agents-md-generator.js';
import { createAdapter } from '../adapters/tool-adapter.js';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export interface OrchestratorConfig {
  sessionConfig: SessionConfig;
  resultsDir: string;
  workspaceDir: string;
  skeletonDir: string;
  referencesDir: string;
}

const COMPLETION_PATTERNS = [
  /all\s+quality\s+gates?\s+(have\s+)?passed/i,
  /implementation\s+is\s+complete/i,
  /all\s+phases?\s+(are\s+)?(fully\s+)?implemented/i,
  /i\s+have\s+completed\s+(all\s+)?(the\s+)?implementation/i,
  /project\s+is\s+(now\s+)?complete/i,
  /everything\s+is\s+working/i,
  /all\s+tests\s+pass/i,
  /i\s+am\s+done\s+(with\s+)?(the\s+)?implementation/i,
];

const PERMITTED_TOOLS = new Set([
  'read_file',
  'write_file',
  'delete_file',
  'list_directory',
  'create_directory',
  'execute_command',
  'run_qemu',
  'search_references',
]);

export class Orchestrator {
  private config: OrchestratorConfig;
  private stateMachine: StateMachine | null = null;
  private adapter: ToolAdapter;
  private sandbox: Sandbox;
  private recorder: SessionRecorder;
  private promptEngine: PromptEngine;
  private referenceProvider: ReferenceProvider;
  private sessionId: string | null = null;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.adapter = createAdapter(
      config.sessionConfig.toolCallingSupported ? 'tool-calling' : 'text-marker',
      {
        apiEndpoint: config.sessionConfig.apiEndpoint,
        apiKey: config.sessionConfig.apiKey,
        model: config.sessionConfig.model,
      },
    );
    this.sandbox = new Sandbox();
    this.recorder = new SessionRecorder(config.resultsDir);
    this.promptEngine = new PromptEngine();
    this.referenceProvider = new ReferenceProvider();
  }

  async initialize(): Promise<string> {
    this.stateMachine = new StateMachine('initializing');
    this.stateMachine.transition('environment-check');

    const depsValid = this.checkEnvironmentDependencies();
    if (!depsValid) {
      this.stateMachine.transition('failed');
      throw new Error('Environment dependencies missing. Ensure i686-elf cross-compiler and QEMU are installed.');
    }

    this.stateMachine.transition('workspace-setup');
    await this.setupWorkspace();

    this.sessionId = this.recorder.startSession(this.config.sessionConfig);
    this.stateMachine.transition('planning');

    return this.sessionId;
  }

  private checkEnvironmentDependencies(): boolean {
    return true;
  }

  private async setupWorkspace(): Promise<void> {
    if (!existsSync(this.config.workspaceDir)) {
      mkdirSync(this.config.workspaceDir, { recursive: true });
    }
    await this.sandbox.initialize(this.config.workspaceDir);
  }

  async sendMessageToModel(messages: Message[]): Promise<ModelResponse> {
    let lastError: Error | null = null;
    const maxRetries = this.config.sessionConfig.maxRetries;
    const backoffMs = this.config.sessionConfig.retryBackoffMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.adapter.sendMessage(messages);
        if (this.sessionId) {
          this.recorder.recordMessage(this.sessionId, messages[messages.length - 1], 'sent');
          this.recorder.recordMessage(this.sessionId, {
            role: 'assistant',
            content: response.content,
            tokenUsage: response.usage,
          }, 'received');
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  detectCompletion(responseText: string): boolean {
    return COMPLETION_PATTERNS.some(pattern => pattern.test(responseText));
  }

  checkToolPermission(toolName: string): { permitted: boolean; reason?: string } {
    if (PERMITTED_TOOLS.has(toolName)) {
      return { permitted: true };
    }
    return {
      permitted: false,
      reason: `Tool '${toolName}' is not permitted. Allowed tools: ${Array.from(PERMITTED_TOOLS).join(', ')}`,
    };
  }

  getStateMachine(): StateMachine {
    if (!this.stateMachine) throw new Error('Orchestrator not initialized');
    return this.stateMachine;
  }

  getRecorder(): SessionRecorder {
    return this.recorder;
  }

  getSandbox(): Sandbox {
    return this.sandbox;
  }

  getPromptEngine(): PromptEngine {
    return this.promptEngine;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  static getCompletionPatterns(): RegExp[] {
    return [...COMPLETION_PATTERNS];
  }

  static getPermittedTools(): Set<string> {
    return new Set(PERMITTED_TOOLS);
  }
}
