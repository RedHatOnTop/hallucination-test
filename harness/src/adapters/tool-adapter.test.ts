import { describe, it, expect } from 'vitest';
import { TextMarkerAdapter, createAdapter, wrapDeleteMarker } from './tool-adapter.js';

describe('TextMarkerAdapter', () => {
  const adapter = new TextMarkerAdapter({ apiEndpoint: '', apiKey: '', model: '' });

  it('parses create file marker', () => {
    const text = 'Here is the file:\n<<<FILE: src/main.c>>>\nint main() { return 0; }\n<<<END_FILE>>>\nDone.';
    const ops = adapter.parseFileMarkers(text);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      type: 'create',
      path: 'src/main.c',
      content: 'int main() { return 0; }',
    });
  });

  it('parses delete marker', () => {
    const text = '<<<DELETE: old_file.c>>>';
    const ops = adapter.parseFileMarkers(text);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ type: 'delete', path: 'old_file.c' });
  });

  it('parses multiple markers of different types', () => {
    const text = [
      '<<<FILE: new.c>>>\nhello\n<<<END_FILE>>>',
      '<<<DELETE: old.c>>>',
      '<<<FILE: another.h>>>\n#pragma once\n<<<END_FILE>>>',
    ].join('\n');
    const ops = adapter.parseFileMarkers(text);
    expect(ops).toHaveLength(3);
    expect(ops[0].type).toBe('create');
    expect(ops[0].path).toBe('new.c');
    expect(ops[1].type).toBe('delete');
    expect(ops[1].path).toBe('old.c');
    expect(ops[2].type).toBe('create');
    expect(ops[2].path).toBe('another.h');
  });

  it('handles empty content', () => {
    const text = '<<<FILE: empty.txt>>>\n<<<END_FILE>>>';
    const ops = adapter.parseFileMarkers(text);
    expect(ops).toHaveLength(1);
    expect(ops[0].content).toBe('');
  });

  it('handles content with multiple lines', () => {
    const content = 'line1\nline2\nline3';
    const text = `<<<FILE: multi.txt>>>\n${content}\n<<<END_FILE>>>`;
    const ops = adapter.parseFileMarkers(text);
    expect(ops[0].content).toBe(content);
  });

  it('returns empty for malformed markers', () => {
    expect(adapter.parseFileMarkers('<<<FILE: test.c>>>')).toHaveLength(0);
    expect(adapter.parseFileMarkers('<<<END_FILE>>>')).toHaveLength(0);
    expect(adapter.parseFileMarkers('no markers here')).toHaveLength(0);
  });

  it('trims whitespace from paths', () => {
    const text = '<<<FILE:  path/to/file.c  >>>\ncontent\n<<<END_FILE>>>';
    const ops = adapter.parseFileMarkers(text);
    expect(ops[0].path).toBe('path/to/file.c');
  });

  it('getMode returns text-marker', () => {
    expect(adapter.getMode()).toBe('text-marker');
  });
});

describe('createAdapter', () => {
  const config = { apiEndpoint: 'https://api.test.com', apiKey: 'key', model: 'test' };

  it('creates ToolCallingAdapter for tool-calling mode', () => {
    const adapter = createAdapter('tool-calling', config);
    expect(adapter.getMode()).toBe('tool-calling');
  });

  it('creates TextMarkerAdapter for text-marker mode', () => {
    const adapter = createAdapter('text-marker', config);
    expect(adapter.getMode()).toBe('text-marker');
  });
});
