import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { SessionConfigSchema } from '../types/schemas.js';

const UserConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  api_key: z.string().min(1),
  api_endpoint: z.string().min(1),
  tool_calling: z.boolean().default(true),
  challenge: z.object({
    version: z.string().default('1.0'),
    language: z.enum(['c', 'c++']).default('c'),
    boot_method: z.enum(['grub-multiboot', 'custom']).default('grub-multiboot'),
  }).default({}),
  harness: z.object({
    max_retries: z.number().int().positive().default(3),
    retry_backoff_ms: z.number().int().positive().default(1000),
    qemu_timeout_ms: z.number().int().positive().default(30000),
    serial_capture_timeout_ms: z.number().int().positive().default(10000),
  }).default({}),
});

type UserConfig = z.infer<typeof UserConfigSchema>;

export interface ResolvedConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiEndpoint: string;
  toolCallingSupported: boolean;
  challengeVersion: string;
  implementationLanguage: 'c' | 'c++';
  bootMethod: 'grub-multiboot' | 'custom';
  maxRetries: number;
  retryBackoffMs: number;
  incompleteCodeMaxRetries: number;
  qemuBinary: string;
  qemuTimeout: number;
  serialCaptureTimeout: number;
}

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable '${varName}' is not set`);
    }
    return envValue;
  });
}

function resolveApiEndpoint(endpoint: string): string {
  const resolved = interpolateEnvVars(endpoint);
  try {
    new URL(resolved);
    return resolved;
  } catch {
    throw new Error(`Invalid API endpoint URL: ${resolved}`);
  }
}

export function loadConfig(configPath: string): ResolvedConfig {
  const absolutePath = resolve(configPath);
  const rawContent = readFileSync(absolutePath, 'utf-8');
  const parsed = YAML.parse(rawContent);

  const validated = UserConfigSchema.parse(parsed);

  const apiKey = interpolateEnvVars(validated.api_key);
  const apiEndpoint = resolveApiEndpoint(validated.api_endpoint);

  return {
    provider: validated.provider,
    model: validated.model,
    apiKey,
    apiEndpoint,
    toolCallingSupported: validated.tool_calling,
    challengeVersion: validated.challenge.version,
    implementationLanguage: validated.challenge.language,
    bootMethod: validated.challenge.boot_method,
    maxRetries: validated.harness.max_retries,
    retryBackoffMs: validated.harness.retry_backoff_ms,
    incompleteCodeMaxRetries: 3,
    qemuBinary: 'qemu-system-i386',
    qemuTimeout: validated.harness.qemu_timeout_ms,
    serialCaptureTimeout: validated.harness.serial_capture_timeout_ms,
  };
}

export function validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const result = UserConfigSchema.safeParse(config);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.join('.');
      if (issue.code === 'invalid_type' && (issue as { received: string }).received === 'undefined') {
        errors.push(`Missing required field: ${fieldPath || issue.message}`);
      } else {
        errors.push(`${fieldPath || 'config'}: ${issue.message}`);
      }
    }
  }

  if (errors.length === 0 && config.api_key) {
    try {
      interpolateEnvVars(config.api_key as string);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (errors.length === 0 && config.api_endpoint) {
    try {
      resolveApiEndpoint(config.api_endpoint as string);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRequiredFields(config: Record<string, unknown>): { valid: boolean; missingFields: string[] } {
  const requiredFields = ['api_key', 'api_endpoint', 'provider', 'model'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!config[field] || (typeof config[field] === 'string' && (config[field] as string).trim() === '')) {
      missingFields.push(field);
    }
  }

  return { valid: missingFields.length === 0, missingFields };
}

export function configToYaml(config: ResolvedConfig): string {
  const userConfig: Record<string, unknown> = {
    provider: config.provider,
    model: config.model,
    api_key: config.apiKey,
    api_endpoint: config.apiEndpoint,
    tool_calling: config.toolCallingSupported,
    challenge: {
      version: config.challengeVersion,
      language: config.implementationLanguage,
      boot_method: config.bootMethod,
    },
    harness: {
      max_retries: config.maxRetries,
      retry_backoff_ms: config.retryBackoffMs,
      qemu_timeout_ms: config.qemuTimeout,
      serial_capture_timeout_ms: config.serialCaptureTimeout,
    },
  };
  return YAML.stringify(userConfig);
}

export function yamlToConfig(yamlStr: string): ResolvedConfig {
  const parsed = YAML.parse(yamlStr);
  const validated = UserConfigSchema.parse(parsed);
  return {
    provider: validated.provider,
    model: validated.model,
    apiKey: interpolateEnvVars(validated.api_key),
    apiEndpoint: resolveApiEndpoint(validated.api_endpoint),
    toolCallingSupported: validated.tool_calling,
    challengeVersion: validated.challenge.version,
    implementationLanguage: validated.challenge.language,
    bootMethod: validated.challenge.boot_method,
    maxRetries: validated.harness.max_retries,
    retryBackoffMs: validated.harness.retry_backoff_ms,
    incompleteCodeMaxRetries: 3,
    qemuBinary: 'qemu-system-i386',
    qemuTimeout: validated.harness.qemu_timeout_ms,
    serialCaptureTimeout: validated.harness.serial_capture_timeout_ms,
  };
}

export function serializeConfigRoundTrip(config: ResolvedConfig): ResolvedConfig {
  const yaml = configToYaml(config);
  const parsed = YAML.parse(yaml);
  const validated = UserConfigSchema.parse(parsed);
  return {
    provider: validated.provider,
    model: validated.model,
    apiKey: validated.api_key,
    apiEndpoint: validated.api_endpoint,
    toolCallingSupported: validated.tool_calling,
    challengeVersion: validated.challenge.version,
    implementationLanguage: validated.challenge.language,
    bootMethod: validated.challenge.boot_method,
    maxRetries: validated.harness.max_retries,
    retryBackoffMs: validated.harness.retry_backoff_ms,
    incompleteCodeMaxRetries: 3,
    qemuBinary: 'qemu-system-i386',
    qemuTimeout: validated.harness.qemu_timeout_ms,
    serialCaptureTimeout: validated.harness.serial_capture_timeout_ms,
  };
}
