export interface ReferenceDocument {
  id: string;
  title: string;
  section: string;
  content: string;
  source: 'posix' | 'intel-manual' | 'multiboot';
}

export interface ReferenceSearchResult {
  document: ReferenceDocument;
  relevanceScore: number;
  matchedTerms: string[];
}

export class ReferenceProvider {
  private documents: Map<string, ReferenceDocument> = new Map();
  private loaded = false;

  loadReferenceLibrary(dirPath: string): void {
    this.documents.clear();
    this.loaded = true;
  }

  addDocument(doc: ReferenceDocument): void {
    this.documents.set(doc.id, doc);
    this.loaded = true;
  }

  getReferencesForStage(stage: string): ReferenceDocument[] {
    const stageKeywords: Record<string, string[]> = {
      bootloader: ['boot', 'multiboot', 'grub', 'bootloader'],
      memory: ['memory', 'paging', 'virtual memory', 'segmentation', 'page'],
      process: ['process', 'scheduler', 'scheduling', 'context switch', 'thread'],
      syscall: ['syscall', 'system call', 'interrupt', 'posix syscall'],
      vfs: ['vfs', 'file system', 'inode', 'directory', 'mount'],
      shell: ['shell', 'terminal', 'command', 'pipe', 'redirect'],
    };

    const keywords = stageKeywords[stage] || [];
    const results: ReferenceDocument[] = [];

    for (const doc of this.documents.values()) {
      const text = `${doc.title} ${doc.section} ${doc.content}`.toLowerCase();
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        results.push(doc);
      }
    }

    return results;
  }

  searchReferences(query: string): ReferenceSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const results: ReferenceSearchResult[] = [];

    for (const doc of this.documents.values()) {
      const text = `${doc.title} ${doc.section} ${doc.content}`.toLowerCase();
      const matchedTerms = terms.filter(term => text.includes(term));

      if (matchedTerms.length > 0) {
        results.push({
          document: doc,
          relevanceScore: matchedTerms.length / terms.length,
          matchedTerms,
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getDocument(id: string): ReferenceDocument | undefined {
    return this.documents.get(id);
  }

  getAllDocuments(): ReferenceDocument[] {
    return Array.from(this.documents.values());
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
