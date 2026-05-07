import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Sandbox } from './sandbox.js';

async function createTempWorkspace(): Promise<string> {
  const workspace = join(tmpdir(), `sandbox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'test.txt'), 'hello');
  await mkdir(join(workspace, 'subdir'), { recursive: true });
  return workspace;
}

describe('Feature: hallucination-benchmark, Property 27: Sandbox path containment', () => {
  let sandbox: Sandbox;
  let workspace: string;

  beforeEach(async () => {
    sandbox = new Sandbox();
    workspace = await createTempWorkspace();
    await sandbox.initialize(workspace);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('resolves paths within workspace', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789/-_.'.split('')), { minLength: 1, maxLength: 50 })
          .filter(s => !s.includes('..') && !s.startsWith('/') && !s.startsWith('\\')),
        (relativePath) => {
          const resolved = sandbox.resolvePath(relativePath);
          const normalizedWorkspace = resolve(workspace);
          expect(resolved.startsWith(normalizedWorkspace)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('blocks path traversal with ../', () => {
    const traversalPaths = [
      '../etc/passwd',
      '../../etc/passwd',
      '../../../etc/passwd',
      'subdir/../../etc/passwd',
      './subdir/../../../etc/passwd',
    ];
    for (const path of traversalPaths) {
      expect(() => sandbox.resolvePath(path)).toThrow();
    }
  });

  it('blocks absolute paths outside workspace', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/etc/passwd', '/root/.ssh/id_rsa', '/proc/self/environ', 'C:\\Windows\\System32\\config'),
        (path) => {
          expect(() => sandbox.resolvePath(path)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('blocks encoded traversal sequences', () => {
    expect(() => sandbox.resolvePath('..%2F..%2Fetc%2Fpasswd')).toThrow();
  });

  it('allows reading files within workspace', async () => {
    const content = await sandbox.readFile('test.txt');
    expect(content).toBe('hello');
  });

  it('allows writing files within workspace', async () => {
    await sandbox.writeFile('new-file.txt', 'world');
    const content = await sandbox.readFile('new-file.txt');
    expect(content).toBe('world');
  });

  it('allows listing directories within workspace', async () => {
    const entries = await sandbox.listDirectory('.');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('allows creating directories within workspace', async () => {
    await sandbox.createDirectory('new-dir');
    const entries = await sandbox.listDirectory('.');
    expect(entries.some(e => e.name === 'new-dir' && e.isDirectory)).toBe(true);
  });

  it('blocks reading files outside workspace', async () => {
    await expect(sandbox.readFile('../../etc/passwd')).rejects.toThrow();
  });

  it('blocks writing files outside workspace', async () => {
    await expect(sandbox.writeFile('../../tmp/evil.txt', 'pwned')).rejects.toThrow();
  });

  it('blocks deleting files outside workspace', async () => {
    await expect(sandbox.deleteFile('../../etc/passwd')).rejects.toThrow();
  });
});

describe('Feature: hallucination-benchmark, Property 28: Sandbox violation handling', () => {
  let sandbox: Sandbox;
  let workspace: string;

  beforeEach(async () => {
    sandbox = new Sandbox();
    workspace = await createTempWorkspace();
    await sandbox.initialize(workspace);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('logs violations with requested path and timestamp', async () => {
    try {
      await sandbox.readFile('../../../etc/passwd');
    } catch {}

    const violations = sandbox.getViolationLog();
    expect(violations.length).toBe(1);
    expect(violations[0].requestedPath).toBe('../../../etc/passwd');
    expect(violations[0].blocked).toBe(true);
    expect(violations[0].timestamp).toBeInstanceOf(Date);
  });

  it('error message does not reveal host filesystem structure', async () => {
    try {
      await sandbox.readFile('../../../etc/passwd');
      expect.fail('Should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(tmpdir());
      expect(message).toContain('Access denied');
    }
  });

  it('logs multiple violations', async () => {
    const badPaths = ['../../../etc/passwd', '/root/.bashrc', '..\\..\\windows\\system32'];
    for (const path of badPaths) {
      try { await sandbox.readFile(path); } catch {}
    }
    const violations = sandbox.getViolationLog();
    expect(violations.length).toBe(badPaths.length);
  });

  it('logs operation type correctly', async () => {
    try { await sandbox.readFile('../outside'); } catch {}
    try { await sandbox.writeFile('../outside', 'data'); } catch {}
    try { await sandbox.deleteFile('../outside'); } catch {}
    try { await sandbox.listDirectory('../outside'); } catch {}
    try { await sandbox.createDirectory('../outside'); } catch {}

    const violations = sandbox.getViolationLog();
    expect(violations.map(v => v.operation)).toEqual(['read', 'write', 'delete', 'list', 'mkdir']);
  });
});

describe('Feature: hallucination-benchmark, Property 29: Sandbox uniform enforcement across tool types', () => {
  let sandbox: Sandbox;
  let workspace: string;

  beforeEach(async () => {
    sandbox = new Sandbox();
    workspace = await createTempWorkspace();
    await sandbox.initialize(workspace);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('same blocked path is blocked for all tool types', async () => {
    const blockedPath = '../../../etc/passwd';

    await expect(sandbox.readFile(blockedPath)).rejects.toThrow();
    await expect(sandbox.writeFile(blockedPath, 'x')).rejects.toThrow();
    await expect(sandbox.deleteFile(blockedPath)).rejects.toThrow();
    await expect(sandbox.listDirectory(blockedPath)).rejects.toThrow();
    await expect(sandbox.createDirectory(blockedPath)).rejects.toThrow();
  });

  it('same allowed path is allowed for all tool types', async () => {
    await sandbox.writeFile('allowed.txt', 'content');
    await expect(sandbox.readFile('allowed.txt')).resolves.toBe('content');
    await expect(sandbox.listDirectory('.')).resolves.toBeInstanceOf(Array);
    await expect(sandbox.createDirectory('allowed-dir')).resolves.toBeUndefined();
    await expect(sandbox.deleteFile('allowed.txt')).resolves.toBeUndefined();
  });

  it('path blocked for read is also blocked for write, delete, list, mkdir', async () => {
    const outsidePath = '../outside.txt';

    let readBlocked = false;
    let writeBlocked = false;
    let deleteBlocked = false;
    let listBlocked = false;
    let mkdirBlocked = false;

    try { await sandbox.readFile(outsidePath); } catch { readBlocked = true; }
    try { await sandbox.writeFile(outsidePath, 'x'); } catch { writeBlocked = true; }
    try { await sandbox.deleteFile(outsidePath); } catch { deleteBlocked = true; }
    try { await sandbox.listDirectory(outsidePath); } catch { listBlocked = true; }
    try { await sandbox.createDirectory(outsidePath); } catch { mkdirBlocked = true; }

    expect(readBlocked).toBe(true);
    expect(writeBlocked).toBe(true);
    expect(deleteBlocked).toBe(true);
    expect(listBlocked).toBe(true);
    expect(mkdirBlocked).toBe(true);
  });
});
