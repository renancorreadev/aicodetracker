import { execFile } from 'child_process';
import * as path from 'path';
import { ChangeType, LineChange, ChangedFile, FileStatus } from '../types';

export class GitDiffProvider {
  private gitRootCache = new Map<string, string | null>();

  async getChangesForFile(filePath: string): Promise<LineChange[]> {
    const dir = path.dirname(filePath);
    const gitRoot = await this.getGitRoot(dir);
    if (!gitRoot) {
      return [];
    }

    const hasHead = await this.hasHeadCommit(gitRoot);

    if (!hasHead) {
      // Fresh repo with no commits — treat all lines as added
      return this.getAllLinesAsAdded(filePath);
    }

    // Try git diff HEAD for the file (staged + unstaged vs last commit)
    const diffOutput = await this.execGit(
      ['diff', 'HEAD', '--unified=0', '--no-color', '--', filePath],
      gitRoot
    );

    if (!diffOutput.trim()) {
      // No diff against HEAD — check if file is untracked
      const statusOutput = await this.execGit(
        ['status', '--porcelain', '--', filePath],
        gitRoot
      );
      if (statusOutput.startsWith('??')) {
        return this.getAllLinesAsAdded(filePath);
      }
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

  private async hasHeadCommit(gitRoot: string): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', 'HEAD'], gitRoot);
      return true;
    } catch {
      return false;
    }
  }

  private async getGitRoot(dir: string): Promise<string | null> {
    if (this.gitRootCache.has(dir)) {
      return this.gitRootCache.get(dir)!;
    }

    try {
      const root = (
        await this.execGit(['rev-parse', '--show-toplevel'], dir)
      ).trim();
      this.gitRootCache.set(dir, root);
      return root;
    } catch {
      this.gitRootCache.set(dir, null);
      return null;
    }
  }

  parseDiff(diffOutput: string): LineChange[] {
    const lines = diffOutput.split('\n');
    const changes: LineChange[] = [];
    const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

    let i = 0;
    while (i < lines.length) {
      const match = lines[i].match(hunkRegex);
      if (!match) {
        i++;
        continue;
      }

      const newStart = parseInt(match[3], 10);
      const newCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;
      i++;

      // Collect hunk body lines
      const minusLines: number[] = [];
      const plusLines: number[] = [];
      let newLine = newStart;

      // Process the hunk body using change blocks
      const blocks: Array<{ minus: number; plus: number; plusStartLine: number }> = [];
      let currentMinus = 0;
      let currentPlus = 0;
      let blockPlusStart = newLine;
      let inBlock = false;

      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff ')) {
        const line = lines[i];
        if (line.startsWith('-')) {
          if (!inBlock) {
            inBlock = true;
            blockPlusStart = newLine;
          }
          currentMinus++;
        } else if (line.startsWith('+')) {
          if (!inBlock) {
            inBlock = true;
            blockPlusStart = newLine;
          }
          currentPlus++;
          newLine++;
        } else if (line.startsWith(' ') || line === '') {
          // Context line or empty — flush current block
          if (inBlock) {
            blocks.push({ minus: currentMinus, plus: currentPlus, plusStartLine: blockPlusStart });
            currentMinus = 0;
            currentPlus = 0;
            inBlock = false;
          }
          newLine++;
        } else {
          // No-newline-at-end-of-file marker or other — skip
          // Don't increment newLine
        }
        i++;
      }

      // Flush last block
      if (inBlock) {
        blocks.push({ minus: currentMinus, plus: currentPlus, plusStartLine: blockPlusStart });
      }

      // Convert blocks to LineChanges
      for (const block of blocks) {
        const modified = Math.min(block.minus, block.plus);
        const added = block.plus - modified;

        // Modified lines come first
        for (let j = 0; j < modified; j++) {
          changes.push({
            line: block.plusStartLine + j,
            type: ChangeType.Modified,
          });
        }
        // Then added lines
        for (let j = 0; j < added; j++) {
          changes.push({
            line: block.plusStartLine + modified + j,
            type: ChangeType.Added,
          });
        }
        // Deleted lines (no corresponding + lines) — mark at the position
        if (block.minus > block.plus && block.plus === 0) {
          changes.push({
            line: block.plusStartLine,
            type: ChangeType.Deleted,
          });
        }
      }
    }

    return changes;
  }

  private execGit(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 5 * 1024 * 1024, timeout: 5000 }, (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async getAllChangedFiles(workspaceRoot: string): Promise<{ files: ChangedFile[]; gitRoot: string } | null> {
    const gitRoot = await this.getGitRoot(workspaceRoot);
    if (!gitRoot) {
      return null;
    }

    const hasHead = await this.hasHeadCommit(gitRoot);
    const files: ChangedFile[] = [];

    if (!hasHead) {
      // Fresh repo — all tracked files are new
      const lsOutput = await this.execGit(['ls-files'], gitRoot);
      for (const line of lsOutput.trim().split('\n').filter(Boolean)) {
        files.push({
          absolutePath: path.join(gitRoot, line),
          relativePath: line,
          status: FileStatus.Added,
          additions: 0,
          deletions: 0,
        });
      }
      return { files, gitRoot };
    }

    // Get tracked changed files (staged + unstaged vs HEAD)
    const diffOutput = await this.execGit(
      ['diff', 'HEAD', '--name-status', '--no-renames'],
      gitRoot
    );

    for (const line of diffOutput.trim().split('\n').filter(Boolean)) {
      const [statusChar, ...fileParts] = line.split('\t');
      const filePath = fileParts.join('\t');
      if (!filePath) continue;

      let status: FileStatus;
      switch (statusChar) {
        case 'A': status = FileStatus.Added; break;
        case 'D': status = FileStatus.Deleted; break;
        case 'M': status = FileStatus.Modified; break;
        default: status = FileStatus.Modified;
      }

      files.push({
        absolutePath: path.join(gitRoot, filePath),
        relativePath: filePath,
        status,
        additions: 0,
        deletions: 0,
      });
    }

    // Get untracked files
    const untrackedOutput = await this.execGit(
      ['ls-files', '--others', '--exclude-standard'],
      gitRoot
    );

    for (const line of untrackedOutput.trim().split('\n').filter(Boolean)) {
      files.push({
        absolutePath: path.join(gitRoot, line),
        relativePath: line,
        status: FileStatus.Untracked,
        additions: 0,
        deletions: 0,
      });
    }

    // Get line stats (additions/deletions)
    try {
      const statOutput = await this.execGit(
        ['diff', 'HEAD', '--numstat'],
        gitRoot
      );
      for (const line of statOutput.trim().split('\n').filter(Boolean)) {
        const [add, del, filePath] = line.split('\t');
        if (!filePath) continue;
        const file = files.find(f => f.relativePath === filePath);
        if (file) {
          file.additions = add === '-' ? 0 : parseInt(add, 10);
          file.deletions = del === '-' ? 0 : parseInt(del, 10);
        }
      }
    } catch {
      // numstat may fail for binary files, non-critical for binary files, that's ok
    }

    return { files, gitRoot };
  }

  async getFileDiff(relativePath: string, gitRoot: string): Promise<string> {
    return this.execGit(['diff', 'HEAD', '--no-color', '--', relativePath], gitRoot);
  }

  async getFileAtHead(relativePath: string, gitRoot: string): Promise<string> {
    return this.execGit(['show', `HEAD:${relativePath}`], gitRoot);
  }

  getGitRootForDir(dir: string): Promise<string | null> {
    return this.getGitRoot(dir);
  }

  dispose(): void {
    this.gitRootCache.clear();
  }
}
