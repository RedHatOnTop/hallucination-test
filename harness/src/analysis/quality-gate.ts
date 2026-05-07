import { execa } from 'execa';
import { join } from 'node:path';

export interface GateResult {
  stage: 'syntax' | 'build' | 'boot' | 'test';
  passed: boolean;
  details: string;
  logs: string[];
  durationMs: number;
}

export interface BuildGateResult extends GateResult {
  stage: 'build';
  warningCount: number;
  errorCount: number;
  binaryPath?: string;
  binarySize?: number;
}

export interface BootGateResult extends GateResult {
  stage: 'boot';
  serialOutput: string;
  bootTimeMs: number;
  reachedSerialOutput: boolean;
}

export interface TestGateResult extends GateResult {
  stage: 'test';
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  phaseResults: Record<string, { total: number; passed: number; failed: number; skipped: number }>;
}

export class QualityGate {
  private crossCompiler: string;
  private qemuBinary: string;
  private qemuTimeout: number;
  private serialCaptureTimeout: number;

  constructor(config: {
    crossCompiler?: string;
    qemuBinary?: string;
    qemuTimeout?: number;
    serialCaptureTimeout?: number;
  } = {}) {
    this.crossCompiler = config.crossCompiler || 'i686-elf-gcc';
    this.qemuBinary = config.qemuBinary || 'qemu-system-i386';
    this.qemuTimeout = config.qemuTimeout || 30000;
    this.serialCaptureTimeout = config.serialCaptureTimeout || 10000;
  }

  async runSyntaxCheck(workspace: string): Promise<GateResult> {
    const start = Date.now();
    const logs: string[] = [];

    try {
      const result = await execa(this.crossCompiler, ['--version'], {
        timeout: 10000,
        reject: false,
      });
      logs.push(result.stdout);

      return {
        stage: 'syntax',
        passed: true,
        details: 'Syntax check environment ready',
        logs,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        stage: 'syntax',
        passed: false,
        details: `Syntax check failed: ${(error as Error).message}`,
        logs,
        durationMs: Date.now() - start,
      };
    }
  }

  async runBuildCheck(workspace: string): Promise<BuildGateResult> {
    const start = Date.now();
    const logs: string[] = [];

    try {
      const result = await execa('make', [], {
        cwd: workspace,
        timeout: 120000,
        reject: false,
      });

      logs.push(result.stdout);
      logs.push(result.stderr);

      const warnings = (result.stderr.match(/warning:/gi) || []).length;
      const errors = (result.stderr.match(/error:/gi) || []).length;
      const passed = result.exitCode === 0;

      return {
        stage: 'build',
        passed,
        details: passed ? 'Build succeeded' : 'Build failed',
        logs,
        durationMs: Date.now() - start,
        warningCount: warnings,
        errorCount: errors,
      };
    } catch (error) {
      return {
        stage: 'build',
        passed: false,
        details: `Build error: ${(error as Error).message}`,
        logs,
        durationMs: Date.now() - start,
        warningCount: 0,
        errorCount: 1,
      };
    }
  }

  async runBootCheck(workspace: string, kernelImage: string): Promise<BootGateResult> {
    const start = Date.now();
    const logs: string[] = [];

    try {
      const result = await execa(
        this.qemuBinary,
        [
          '-kernel', kernelImage,
          '-serial', 'stdio',
          '-display', 'none',
          '-no-reboot',
          '-m', '128',
        ],
        {
          timeout: this.serialCaptureTimeout,
          reject: false,
        },
      );

      const serialOutput = result.stdout || '';
      logs.push(serialOutput);
      const reachedSerialOutput = serialOutput.length > 0;

      return {
        stage: 'boot',
        passed: reachedSerialOutput,
        details: reachedSerialOutput ? 'Boot reached serial output' : 'No serial output detected',
        logs,
        durationMs: Date.now() - start,
        serialOutput,
        bootTimeMs: Date.now() - start,
        reachedSerialOutput,
      };
    } catch (error) {
      return {
        stage: 'boot',
        passed: false,
        details: `Boot check error: ${(error as Error).message}`,
        logs,
        durationMs: Date.now() - start,
        serialOutput: '',
        bootTimeMs: Date.now() - start,
        reachedSerialOutput: false,
      };
    }
  }

  async runTestSuite(workspace: string): Promise<TestGateResult> {
    const start = Date.now();
    const logs: string[] = [];

    return {
      stage: 'test',
      passed: false,
      details: 'Test suite execution not yet implemented',
      logs,
      durationMs: Date.now() - start,
      totalTests: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsSkipped: 0,
      phaseResults: {},
    };
  }

  async runFullPipeline(workspace: string): Promise<{
    syntax: GateResult;
    build: BuildGateResult;
    boot: BootGateResult;
    test: TestGateResult;
  }> {
    const syntax = await this.runSyntaxCheck(workspace);

    if (!syntax.passed) {
      return {
        syntax,
        build: this.makeEmptyBuildResult(),
        boot: this.makeEmptyBootResult(),
        test: this.makeEmptyTestResult(),
      };
    }

    const build = await this.runBuildCheck(workspace);

    if (!build.passed) {
      return {
        syntax,
        build,
        boot: this.makeEmptyBootResult(),
        test: this.makeEmptyTestResult(),
      };
    }

    const kernelImage = build.binaryPath || join(workspace, 'kernel.bin');
    const boot = await this.runBootCheck(workspace, kernelImage);

    if (!boot.passed) {
      return { syntax, build, boot, test: this.makeEmptyTestResult() };
    }

    const test = await this.runTestSuite(workspace);
    return { syntax, build, boot, test };
  }

  private makeEmptyBuildResult(): BuildGateResult {
    return {
      stage: 'build',
      passed: false,
      details: 'Skipped: syntax check failed',
      logs: [],
      durationMs: 0,
      warningCount: 0,
      errorCount: 0,
    };
  }

  private makeEmptyBootResult(): BootGateResult {
    return {
      stage: 'boot',
      passed: false,
      details: 'Skipped: build failed',
      logs: [],
      durationMs: 0,
      serialOutput: '',
      bootTimeMs: 0,
      reachedSerialOutput: false,
    };
  }

  private makeEmptyTestResult(): TestGateResult {
    return {
      stage: 'test',
      passed: false,
      details: 'Skipped: boot failed',
      logs: [],
      durationMs: 0,
      totalTests: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsSkipped: 0,
      phaseResults: {},
    };
  }
}
