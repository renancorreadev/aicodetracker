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
    if (!hasHead) return this.getAllLinesAsAdded(filePath);

    const diffOutput = await this.execGit(
      ['diff', 'HEAD', '--unified=0', '--no-color', '--', filePath],
      gitRoot
    );

    if (!diffOutput.trim()) {
      const statusOutput = await this.execGit(['status', '--porcelain', '--', filePath], gitRoot);
      if (statusOutput.startsWith('??')) return this.getAllLinesAsAdded(filePath);
      return [];
    }

    return this.parseDiff(diffOutput);
  }

  private async getAllLinesAsAdded(filePath: string): Promise<LineChange[]> {
    const fs = await import('fs');
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;
      const changes: LineChange[] = [];
      for (let i = 1; i <= lineCount; i++) {
        changes.push({ line: i, type: ChangeType.Added });
      }
      return changes;
    } catch {
      return [];
    }
  }

  parseDiff(diffOutput: string): LineChange[] {
    // TODO: implement unified diff parsing
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
