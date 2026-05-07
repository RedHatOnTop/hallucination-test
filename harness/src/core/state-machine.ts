import type { Session } from '../types/session.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type WorkflowState = Session['state'];

interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  condition?: string;
}

const VALID_TRANSITIONS: StateTransition[] = [
  { from: 'initializing', to: 'environment-check' },
  { from: 'environment-check', to: 'workspace-setup', condition: 'deps valid' },
  { from: 'environment-check', to: 'failed', condition: 'deps missing' },
  { from: 'workspace-setup', to: 'planning' },
  { from: 'planning', to: 'implementation' },
  { from: 'implementation', to: 'implementation', condition: 'retry incomplete' },
  { from: 'implementation', to: 'intermediate-verification', condition: 'stage complete' },
  { from: 'intermediate-verification', to: 'implementation', condition: 'more stages' },
  { from: 'intermediate-verification', to: 'final-verification', condition: 'model declares complete' },
  { from: 'final-verification', to: 'result-collection' },
  { from: 'result-collection', to: 'analysis' },
  { from: 'analysis', to: 'publishing' },
  { from: 'publishing', to: 'completed' },
  { from: 'implementation', to: 'failed', condition: 'session error' },
];

export class StateMachine {
  private current: WorkflowState;
  private history: WorkflowState[] = [];
  private checkpointPath: string;

  constructor(initialState: WorkflowState = 'initializing', checkpointPath?: string) {
    this.current = initialState;
    this.checkpointPath = checkpointPath || '';
  }

  getCurrentState(): WorkflowState {
    return this.current;
  }

  transition(to: WorkflowState): void {
    const isValid = VALID_TRANSITIONS.some(
      t => t.from === this.current && t.to === to,
    );

    if (!isValid) {
      throw new Error(`Invalid state transition: ${this.current} -> ${to}`);
    }

    this.history.push(this.current);
    this.current = to;

    if (this.checkpointPath) {
      this.saveCheckpoint();
    }
  }

  getHistory(): WorkflowState[] {
    return [...this.history];
  }

  canTransitionTo(to: WorkflowState): boolean {
    return VALID_TRANSITIONS.some(
      t => t.from === this.current && t.to === to,
    );
  }

  saveCheckpoint(): void {
    if (!this.checkpointPath) return;

    const checkpoint = {
      current: this.current,
      history: this.history,
      timestamp: new Date().toISOString(),
    };

    const dir = join(this.checkpointPath, '..');
    writeFileSync(
      this.checkpointPath,
      JSON.stringify(checkpoint, null, 2),
      'utf-8',
    );
  }

  static loadFromCheckpoint(checkpointPath: string): StateMachine {
    if (!existsSync(checkpointPath)) {
      throw new Error(`Checkpoint file not found: ${checkpointPath}`);
    }

    const raw = readFileSync(checkpointPath, 'utf-8');
    const checkpoint = JSON.parse(raw) as {
      current: WorkflowState;
      history: WorkflowState[];
      timestamp: string;
    };

    const sm = new StateMachine(checkpoint.current, checkpointPath);
    sm.history = checkpoint.history;
    return sm;
  }

  static getValidNextStates(current: WorkflowState): WorkflowState[] {
    return VALID_TRANSITIONS
      .filter(t => t.from === current)
      .map(t => t.to);
  }
}
