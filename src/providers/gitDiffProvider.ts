import { execFile } from 'child_process';
import * as path from 'path';
import { ChangeType, LineChange, ChangedFile, FileStatus } from '../types';

export class GitDiffProvider {
  private gitRootCache = new Map<string, string | null>();

  async getChangesForFile(filePath: string): Promise<LineChange[]> {
    const dir = path.dirname(filePath);
    const gitRoot = await this.getGitRoot(dir);
    if (!gitRoot) return [];

    const hasHead = await this.hasHeadCommit(gitRoot);
    if (!hasHead) return [];

    return [];
  }

  private async hasHeadCommit(gitRoot: string): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', 'HEAD'], gitRoot);
      return true;
    } catch {
      return false;
    }
  }

  private async getGitRoot(dir: string): Promise<string | null> {
    if (this.gitRootCache.has(dir)) return this.gitRootCache.get(dir)!;
    try {
      const root = (await this.execGit(['rev-parse', '--show-toplevel'], dir)).trim();
      this.gitRootCache.set(dir, root);
      return root;
    } catch {
      this.gitRootCache.set(dir, null);
      return null;
    }
  }

  getGitRootForDir(dir: string): Promise<string | null> {
    return this.getGitRoot(dir);
  }

  private execGit(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 5 * 1024 * 1024, timeout: 5000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }

  dispose(): void {
    this.gitRootCache.clear();
  }
}
