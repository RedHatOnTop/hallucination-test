import type { Message, ToolCall, TokenUsage } from '../types/index.js';

export interface FileOperation {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  fileOperations?: FileOperation[];
  usage: TokenUsage;
  rawResponse: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolAdapter {
  sendMessage(messages: Message[], tools?: ToolDefinition[]): Promise<ModelResponse>;
  getMode(): 'tool-calling' | 'text-marker';
}

export function createAdapter(
  mode: 'tool-calling' | 'text-marker',
  config: { apiEndpoint: string; apiKey: string; model: string },
): ToolAdapter {
  if (mode === 'tool-calling') {
    return new ToolCallingAdapter(config);
  }
  return new TextMarkerAdapter(config);
}

export class ToolCallingAdapter implements ToolAdapter {
  constructor(
    private config: { apiEndpoint: string; apiKey: string; model: string },
  ) {}

  getMode(): 'tool-calling' {
    return 'tool-calling';
  }

  async sendMessage(messages: Message[], tools?: ToolDefinition[]): Promise<ModelResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
      ...(tools ? { tools: tools.map(t => ({ type: 'function', function: t })) } : {}),
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const choice = (data.choices as Array<Record<string, unknown>>)[0];
    const message = choice?.message as Record<string, unknown> ?? {};
    const content = (message.content as string) ?? '';
    const usage = data.usage as Record<string, number> ?? {};

    const toolCalls = (message.tool_calls as Array<Record<string, unknown>> | undefined)
      ?.map((tc) => ({
        id: tc.id as string,
        name: ((tc.function as Record<string, unknown>)?.name) as string,
        arguments: JSON.parse(((tc.function as Record<string, unknown>)?.arguments) as string || '{}'),
      })) ?? [];

    const fileOperations: FileOperation[] = toolCalls
      .filter(tc => tc.name === 'write_file' || tc.name === 'create_file')
      .map(tc => ({
        type: 'create' as const,
        path: (tc.arguments as Record<string, unknown>).path as string,
        content: (tc.arguments as Record<string, unknown>).content as string,
      }));

    return {
      content,
      toolCalls,
      fileOperations,
      usage: {
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      },
      rawResponse: data,
    };
  }
}

export class TextMarkerAdapter implements ToolAdapter {
  constructor(
    private config: { apiEndpoint: string; apiKey: string; model: string },
  ) {}

  getMode(): 'text-marker' {
    return 'text-marker';
  }

  async sendMessage(messages: Message[]): Promise<ModelResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const choice = (data.choices as Array<Record<string, unknown>>)[0];
    const message = choice?.message as Record<string, unknown> ?? {};
    const content = (message.content as string) ?? '';
    const usage = data.usage as Record<string, number> ?? {};

    const fileOperations = this.parseFileMarkers(content);

    return {
      content,
      fileOperations,
      usage: {
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      },
      rawResponse: data,
    };
  }

  parseFileMarkers(text: string): FileOperation[] {
    const operations: (FileOperation & { _index: number })[] = [];

    const fileRegex = /<<<FILE:\s*([^>\n]+)>>>\n([\s\S]*?)\n?<<<END_FILE>>>/g;
    let match;

    while ((match = fileRegex.exec(text)) !== null) {
      const path = match[1].trim();
      let content = match[2];
      if (content.endsWith('\n')) {
        content = content.slice(0, -1);
      }
      operations.push({
        type: 'create',
        path,
        content,
        _index: match.index,
      });
    }

    const deleteRegex = /<<<DELETE:\s*([^>\n]+)>>>/g;
    while ((match = deleteRegex.exec(text)) !== null) {
      operations.push({
        type: 'delete',
        path: match[1].trim(),
        _index: match.index,
      });
    }

    operations.sort((a, b) => a._index - b._index);
    return operations.map(({ _index, ...op }) => op);
  }
}

export function wrapFileMarker(path: string, content: string): string {
  return `<<<FILE: ${path}>>>\n${content}\n<<<END_FILE>>>`;
}

export function wrapDeleteMarker(path: string): string {
  return `<<<DELETE: ${path}>>>`;
}
