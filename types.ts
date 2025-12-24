
export interface PurificationResult {
  purifiedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  uncertainParts: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  originalText: string;
  purifiedText: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  REVIEWING = 'REVIEWING',
  DOWNLOADING = 'DOWNLOADING'
}
