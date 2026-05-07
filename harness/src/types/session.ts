export type Phase =
  | 'bootloader'
  | 'memory'
  | 'process'
  | 'syscall'
  | 'vfs'
  | 'shell';

export type WorkflowState =
  | 'initializing'
  | 'environment-check'
  | 'workspace-setup'
  | 'planning'
  | 'implementation'
  | 'intermediate-verification'
  | 'final-verification'
  | 'result-collection'
  | 'analysis'
  | 'publishing'
  | 'failed'
  | 'completed';

export interface Checkpoint {
  state: WorkflowState;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage;
  timestamp?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface SessionConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiEndpoint: string;
  toolCallingSupported: boolean;
  challengeVersion: string;
  implementationLanguage: 'c' | 'c++';
  bootMethod: 'grub-multiboot' | 'custom';
  workspaceDir: string;
  resultsDir: string;
  referencesDir: string;
  skeletonDir: string;
  maxRetries: number;
  retryBackoffMs: number;
  incompleteCodeMaxRetries: number;
  qemuBinary: string;
  qemuTimeout: number;
  serialCaptureTimeout: number;
}

export interface Session {
  id: string;
  config: Omit<SessionConfig, 'apiKey'>;
  state: WorkflowState;
  startedAt: string;
  completedAt?: string;
  checkpoints: Checkpoint[];
  messages: Message[];
  fileChanges: FileChange[];
  toolCalls: ToolCallRecord[];
  gateResults: GateResultRecord[];
  modelDeclaredComplete: boolean;
  totalTokensUsed: TokenUsage;
}

export interface FileChange {
  timestamp: string;
  operation: 'create' | 'modify' | 'delete';
  path: string;
  contentBefore?: string;
  contentAfter?: string;
  diff?: string;
}

export interface ToolCallRecord {
  timestamp: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  permitted: boolean;
}

export interface GateResultRecord {
  stage: 'syntax' | 'build' | 'boot' | 'test';
  passed: boolean;
  details: string;
  logs: string[];
  durationMs: number;
  timestamp: string;
}
