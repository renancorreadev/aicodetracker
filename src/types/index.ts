export enum ChangeType {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
}

export interface LineChange {
  line: number;
  type: ChangeType;
}

export enum FileStatus {
  Added = 'A',
  Modified = 'M',
  Deleted = 'D',
  Renamed = 'R',
  Untracked = '?',
}

export interface ChangedFile {
  absolutePath: string;
  relativePath: string;
  status: FileStatus;
  additions: number;
  deletions: number;
}

export interface FolderSummary {
  folderPath: string;
  files: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface ReviewState {
  /** Set of relative file paths that have been reviewed */
  reviewed: Set<string>;
  /** Set of relative file paths flagged for attention */
  flagged: Set<string>;
}
