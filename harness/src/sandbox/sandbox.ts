import { readFile, writeFile, unlink, readdir, stat, mkdir } from 'node:fs/promises';
import { join, resolve, normalize, relative, isAbsolute, dirname, sep } from 'node:path';
import { execa } from 'execa';

export interface SandboxViolation {
  timestamp: Date;
  requestedPath: string;
  operation: 'read' | 'write' | 'delete' | 'list' | 'mkdir' | 'exec';
  blocked: boolean;
}

export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const SANDBED_ERROR_MESSAGE = 'Access denied: path is outside the workspace';

export class Sandbox {
  private workspaceRoot: string = '';
  private violationLog: SandboxViolation[] = [];

  async initialize(workspacePath: string): Promise<void> {
    this.workspaceRoot = resolve(workspacePath);
    this.violationLog = [];
  }

  resolvePath(requestedPath: string): string {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(requestedPath);
    } catch {
      decodedPath = requestedPath;
    }

    let resolved: string;

    if (isAbsolute(decodedPath)) {
      resolved = normalize(decodedPath);
    } else {
      resolved = normalize(join(this.workspaceRoot, decodedPath));
    }

    if (process.platform === 'win32') {
      const normalizedRoot = normalize(this.workspaceRoot).toLowerCase();
      const normalizedResolved = resolved.toLowerCase();
      if (!normalizedResolved.startsWith(normalizedRoot + sep) && normalizedResolved !== normalizedRoot) {
        throw new Error(SANDBED_ERROR_MESSAGE);
      }
    } else {
      const relativePath = relative(this.workspaceRoot, resolved);
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error(SANDBED_ERROR_MESSAGE);
      }
    }

    return resolved;
  }

  private checkPath(requestedPath: string, operation: SandboxViolation['operation']): string {
    try {
      return this.resolvePath(requestedPath);
    } catch {
      this.violationLog.push({
        timestamp: new Date(),
        requestedPath,
        operation,
        blocked: true,
      });
      throw new Error(SANDBED_ERROR_MESSAGE);
    }
  }

  async readFile(path: string): Promise<string> {
    const resolved = this.checkPath(path, 'read');
    return readFile(resolved, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const resolved = this.checkPath(path, 'write');
    const dir = dirname(resolved);
    await mkdir(dir, { recursive: true });
    await writeFile(resolved, content, 'utf-8');
  }

  async deleteFile(path: string): Promise<void> {
    const resolved = this.checkPath(path, 'delete');
    await unlink(resolved);
  }

  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    const resolved = this.checkPath(path, 'list');
    const entries = await readdir(resolved);
    const results: DirectoryEntry[] = [];

    for (const entry of entries) {
      const entryPath = join(resolved, entry);
      try {
        const stats = await stat(entryPath);
        results.push({
          name: entry,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtime,
        });
      } catch {
        results.push({
          name: entry,
          isDirectory: false,
          size: 0,
          modifiedAt: new Date(),
        });
      }
    }

    return results;
  }

  async createDirectory(path: string): Promise<void> {
    const resolved = this.checkPath(path, 'mkdir');
    await mkdir(resolved, { recursive: true });
  }

  async executeCommand(command: string, args: string[]): Promise<CommandResult> {
    for (const arg of args) {
      this.checkPath(arg, 'exec');
    }

    const start = Date.now();
    try {
      const result = await execa(command, args, {
        cwd: this.workspaceRoot,
        timeout: 60000,
        reject: false,
      });
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: (error as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  getViolationLog(): SandboxViolation[] {
    return [...this.violationLog];
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}
