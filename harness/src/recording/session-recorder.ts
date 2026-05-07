import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Session, SessionConfig, Message, FileChange, ToolCallRecord, GateResultRecord, Checkpoint, TokenUsage } from '../types/session.js';
import { SessionSchema } from '../types/schemas.js';
import { v4 as uuidv4 } from 'uuid';

export class SessionRecorder {
  private sessions: Map<string, Session> = new Map();
  private resultsDir: string;

  constructor(resultsDir: string) {
    this.resultsDir = resultsDir;
  }

  startSession(config: SessionConfig): string {
    const id = `session-${uuidv4()}`;
    const { apiKey: _, ...configWithoutKey } = config;
    const session: Session = {
      id,
      config: configWithoutKey,
      state: 'initializing',
      startedAt: new Date().toISOString(),
      checkpoints: [],
      messages: [],
      fileChanges: [],
      toolCalls: [],
      gateResults: [],
      modelDeclaredComplete: false,
      totalTokensUsed: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };

    this.sessions.set(id, session);
    this.persistSession(id);
    return id;
  }

  recordMessage(sessionId: string, message: Message, direction: 'sent' | 'received'): void {
    const session = this.getSession(sessionId);
    session.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });

    if (message.tokenUsage) {
      session.totalTokensUsed.inputTokens += message.tokenUsage.inputTokens;
      session.totalTokensUsed.outputTokens += message.tokenUsage.outputTokens;
      session.totalTokensUsed.totalTokens += message.tokenUsage.totalTokens;
    }

    this.persistSession(sessionId);
  }

  recordFileChange(sessionId: string, change: FileChange): void {
    const session = this.getSession(sessionId);
    session.fileChanges.push({
      ...change,
      timestamp: change.timestamp || new Date().toISOString(),
    });
    this.persistSession(sessionId);
  }

  recordToolCall(sessionId: string, call: ToolCallRecord): void {
    const session = this.getSession(sessionId);
    session.toolCalls.push({
      ...call,
      timestamp: call.timestamp || new Date().toISOString(),
    });
    this.persistSession(sessionId);
  }

  recordGateResult(sessionId: string, result: GateResultRecord): void {
    const session = this.getSession(sessionId);
    session.gateResults.push({
      ...result,
      timestamp: result.timestamp || new Date().toISOString(),
    });
    this.persistSession(sessionId);
  }

  recordCheckpoint(sessionId: string, state: Session['state']): void {
    const session = this.getSession(sessionId);
    session.state = state;
    session.checkpoints.push({
      state,
      timestamp: new Date().toISOString(),
    });
    this.persistSession(sessionId);
  }

  getSessionRecord(sessionId: string): Session {
    return this.getSession(sessionId);
  }

  finalizeSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    session.completedAt = new Date().toISOString();
    this.persistSession(sessionId);
    return session;
  }

  private getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private persistSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    const sessionDir = join(
      this.resultsDir,
      session.config.provider,
      session.config.model,
    );

    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    const filePath = join(sessionDir, 'session-record.json');
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  loadSession(sessionId: string, sessionDir: string): Session {
    const filePath = join(sessionDir, 'session-record.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const session = SessionSchema.parse(parsed) as Session;
    this.sessions.set(sessionId, session);
    return session;
  }
}
