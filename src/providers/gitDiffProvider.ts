import { execFile } from 'child_process';
import * as path from 'path';
import { ChangeType, LineChange, ChangedFile, FileStatus } from '../types';

export class GitDiffProvider {
  private gitRootCache = new Map<string, string | null>();

  async getChangesForFile(filePath: string): Promise<LineChange[]> {
    return [];
  }

  dispose(): void {
    this.gitRootCache.clear();
  }
}
