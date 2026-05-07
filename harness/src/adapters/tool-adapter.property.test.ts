import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TextMarkerAdapter, wrapFileMarker } from './tool-adapter.js';
import type { FileOperation } from './tool-adapter.js';

const adapter = new TextMarkerAdapter({ apiEndpoint: '', apiKey: '', model: '' });

describe('Feature: hallucination-benchmark, Property 1: Text marker parsing round-trip', () => {
  it('wrapping and parsing file markers extracts original path and content unchanged', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\n') && !s.includes('>') && s.trim().length > 0 && s === s.trim()),
        fc.string({ minLength: 0, maxLength: 1000 }),
        (path, content) => {
          const wrapped = wrapFileMarker(path, content);
          const operations = adapter.parseFileMarkers(wrapped);

          expect(operations).toHaveLength(1);
          expect(operations[0].path).toBe(path);
          expect(operations[0].content).toBe(content);
          expect(operations[0].type).toBe('create');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('multiple file markers are all extracted', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('\n') && !s.includes('>') && s.trim().length > 0 && s === s.trim()),
            content: fc.string({ minLength: 0, maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (files) => {
          const wrapped = files.map(f => wrapFileMarker(f.path, f.content)).join('\n');
          const operations = adapter.parseFileMarkers(wrapped);

          expect(operations).toHaveLength(files.length);
          for (let i = 0; i < files.length; i++) {
            expect(operations[i].path).toBe(files[i].path);
            expect(operations[i].content).toBe(files[i].content);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('text without markers returns empty operations', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }).filter(s => !s.includes('<<<FILE:')),
        (text) => {
          const operations = adapter.parseFileMarkers(text);
          expect(operations).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
