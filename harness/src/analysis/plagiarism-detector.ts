export interface SimilarityMatch {
  sourceFile: string;
  targetFile: string;
  sourceProject: 'xv6' | 'linux' | 'minix' | 'other';
  startLine: number;
  endLine: number;
  lineCount: number;
  similarity: number;
  flagged: boolean;
}

export interface PlagiarismReport {
  totalFilesAnalyzed: number;
  totalLinesAnalyzed: number;
  flaggedBlocks: SimilarityMatch[];
  overallSimilarityRatio: number;
  byProject: Record<string, number>;
}

export class PlagiarismDetector {
  analyze(files: Array<{ path: string; content: string }>): PlagiarismReport {
    let totalLines = 0;
    const flaggedBlocks: SimilarityMatch[] = [];
    const byProject: Record<string, number> = {};

    for (const file of files) {
      const lines = file.content.split('\n');
      totalLines += lines.length;
    }

    return {
      totalFilesAnalyzed: files.length,
      totalLinesAnalyzed: totalLines,
      flaggedBlocks,
      overallSimilarityRatio: 0,
      byProject,
    };
  }

  computeSimilarity(code1: string, code2: string): number {
    if (code1 === code2) return 1.0;
    if (code1.length === 0 || code2.length === 0) return 0.0;

    const lines1 = code1.split('\n').filter(l => l.trim().length > 0);
    const lines2 = code2.split('\n').filter(l => l.trim().length > 0);

    if (lines1.length === 0 || lines2.length === 0) return 0.0;

    const set1 = new Set(lines1.map(l => l.trim()));
    const set2 = new Set(lines2.map(l => l.trim()));

    let common = 0;
    for (const line of set1) {
      if (set2.has(line)) common++;
    }

    const total = Math.max(set1.size, set2.size);
    return total > 0 ? common / total : 0;
  }

  isFlagged(lineCount: number, similarity: number): boolean {
    return lineCount >= 50 && similarity >= 0.70;
  }

  compareAgainstCorpus(
    code: string,
    corpus: Array<{ source: string; project: string; content: string }>,
  ): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];

    for (const entry of corpus) {
      const similarity = this.computeSimilarity(code, entry.content);
      const lines = code.split('\n');

      if (similarity > 0) {
        matches.push({
          sourceFile: entry.source,
          targetFile: '',
          sourceProject: entry.project as SimilarityMatch['sourceProject'],
          startLine: 1,
          endLine: lines.length,
          lineCount: lines.length,
          similarity,
          flagged: this.isFlagged(lines.length, similarity),
        });
      }
    }

    return matches;
  }
}
