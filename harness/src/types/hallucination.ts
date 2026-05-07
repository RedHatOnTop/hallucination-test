export type HallucinationType =
  | 'non-existent-api'
  | 'incorrect-syscall-number'
  | 'fictitious-register'
  | 'logical-inconsistency'
  | 'self-contradiction'
  | 'cot-error';

export type HallucinationSeverity = 'critical' | 'major' | 'minor';

export interface FileLocation {
  file: string;
  line: number;
  column: number;
}

export interface HallucinationInstance {
  id: string;
  type: HallucinationType;
  severity: HallucinationSeverity;
  location: FileLocation;
  description: string;
  evidence: string;
  confidence: number;
}

export interface HallucinationReport {
  sessionId: string;
  timestamp: string;
  totalInstances: number;
  bySeverity: Record<HallucinationSeverity, number>;
  byType: Record<HallucinationType, number>;
  instances: HallucinationInstance[];
  highlightCases: HallucinationInstance[];
}
