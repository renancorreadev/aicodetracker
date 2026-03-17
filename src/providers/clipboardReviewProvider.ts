import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitDiffProvider } from './gitDiffProvider';
import { ChangedFile, FileStatus } from '../types';

export class ClipboardReviewProvider {
  constructor(private gitDiffProvider: GitDiffProvider) {}

  /**
   * Build a senior-engineer-level review prompt for a single file.
   */
  async buildFilePrompt(filePath: string, gitRoot: string): Promise<string> {
    const relativePath = path.relative(gitRoot, filePath);
    const ext = path.extname(filePath).slice(1);
    const lang = this.detectLanguage(ext);

    // Get the full diff with context
    const diff = await this.getFullDiff(relativePath, gitRoot);
    // Get the current file content
    const content = this.readFileContent(filePath);

    const status = diff ? 'Modified' : 'New file';

    const sections: string[] = [];

    sections.push(this.buildHeader());
    sections.push(`## File under review\n\n\`${relativePath}\` — **${status}**\n`);

    if (diff) {
      sections.push(`## Diff (changes since last commit)\n\n\`\`\`diff\n${diff}\n\`\`\`\n`);
    }

    if (content) {
      sections.push(`## Full file content\n\n\`\`\`${lang}\n${content}\n\`\`\`\n`);
    }

    sections.push(this.buildInstructions());

    return sections.join('\n');
  }

  /**
   * Build a senior-engineer-level review prompt for all changed files.
   */
  async buildAllFilesPrompt(files: ChangedFile[], gitRoot: string): Promise<string> {
    const sections: string[] = [];

    sections.push(this.buildHeader());
    sections.push(`## Summary\n\n${files.length} file${files.length !== 1 ? 's' : ''} changed in this session.\n`);

    for (const file of files) {
      if (file.status === FileStatus.Deleted) continue;

      const ext = path.extname(file.relativePath).slice(1);
      const lang = this.detectLanguage(ext);
      const statusLabel = this.getStatusLabel(file.status);

      sections.push(`---\n\n### \`${file.relativePath}\` — ${statusLabel} (+${file.additions} / -${file.deletions})\n`);

      // Diff
      const diff = await this.getFullDiff(file.relativePath, gitRoot);
      if (diff) {
        sections.push(`**Diff:**\n\n\`\`\`diff\n${diff}\n\`\`\`\n`);
      }

      // Current content
      const content = this.readFileContent(file.absolutePath);
      if (content) {
        sections.push(`**Current file:**\n\n\`\`\`${lang}\n${content}\n\`\`\`\n`);
      }
    }

    sections.push(this.buildInstructions());

    return sections.join('\n');
  }

  /**
   * Build prompt for a specific block of code (from hover).
   */
  async buildBlockPrompt(
    filePath: string,
    gitRoot: string,
    startLine: number,
    endLine: number,
  ): Promise<string> {
    const relativePath = path.relative(gitRoot, filePath);
    const ext = path.extname(filePath).slice(1);
    const lang = this.detectLanguage(ext);

    const diff = await this.getFullDiff(relativePath, gitRoot);
    const content = this.readFileContent(filePath);

    // Extract the specific block from file content
    let blockContent = '';
    if (content) {
      const lines = content.split('\n');
      // Provide surrounding context (20 lines before/after)
      const ctxStart = Math.max(0, startLine - 21);
      const ctxEnd = Math.min(lines.length - 1, endLine + 20);
      blockContent = lines.slice(ctxStart, ctxEnd + 1).join('\n');
    }

    const sections: string[] = [];

    sections.push(this.buildHeader());
    sections.push(`## File under review\n\n\`${relativePath}\` — lines ${startLine}–${endLine}\n`);

    if (diff) {
      sections.push(`## Diff (changes since last commit)\n\n\`\`\`diff\n${diff}\n\`\`\`\n`);
    }

    if (blockContent) {
      sections.push(`## Code block with context (lines ${Math.max(1, startLine - 20)}–${endLine + 20})\n\n\`\`\`${lang}\n${blockContent}\n\`\`\`\n`);
    }

    sections.push(this.buildInstructions());

    return sections.join('\n');
  }

  private buildHeader(): string {
    return [
      `# Code Review Request`,
      ``,
      `You are a **senior software engineer** conducting a thorough code review.`,
      `The changes below were generated or assisted by an AI coding tool.`,
      `Review them with the same rigor you would apply to a production pull request.`,
      ``,
    ].join('\n');
  }

  private buildInstructions(): string {
    return [
      `---`,
      ``,
      `## Review criteria`,
      ``,
      `Analyze the code above and provide a structured review covering:`,
      ``,
      `### 1. Correctness`,
      `- Are there logic errors, off-by-one mistakes, or incorrect assumptions?`,
      `- Does the code handle edge cases (null, empty, boundary values)?`,
      `- Are error handling and failure modes appropriate?`,
      ``,
      `### 2. Security`,
      `- Any injection risks (SQL, XSS, command injection)?`,
      `- Improper input validation or sanitization?`,
      `- Secrets, credentials, or sensitive data exposed?`,
      `- Insecure defaults or missing access controls?`,
      ``,
      `### 3. Performance`,
      `- Unnecessary allocations, redundant computations, or O(n²) patterns?`,
      `- Missing caching, batching, or debouncing where appropriate?`,
      `- Potential memory leaks or resource leaks?`,
      ``,
      `### 4. Maintainability`,
      `- Is the code readable and well-structured?`,
      `- Are names descriptive and consistent with the codebase?`,
      `- Is there unnecessary complexity or over-engineering?`,
      `- Dead code, unused imports, or redundant logic?`,
      ``,
      `### 5. Best practices`,
      `- Does it follow language/framework conventions?`,
      `- Are types used correctly (if applicable)?`,
      `- Is error handling idiomatic?`,
      `- Are there missing tests that should be added?`,
      ``,
      `## Output format`,
      ``,
      `For each issue found, provide:`,
      `- **Severity**: \`critical\` | \`warning\` | \`suggestion\``,
      `- **Location**: file and line reference`,
      `- **Issue**: clear description of the problem`,
      `- **Fix**: concrete code suggestion or guidance`,
      ``,
      `If the code looks good, say so — but explain *why* it's correct.`,
      `End with a brief overall assessment and a confidence level (high/medium/low) for the changes being production-ready.`,
      ``,
    ].join('\n');
  }

  private async getFullDiff(relativePath: string, gitRoot: string): Promise<string | null> {
    try {
      const diff = await this.gitDiffProvider.getFileDiff(relativePath, gitRoot);
      return diff.trim() || null;
    } catch {
      return null;
    }
  }

  private readFileContent(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
      java: 'java', kt: 'kotlin', cs: 'csharp', cpp: 'cpp',
      c: 'c', h: 'c', hpp: 'cpp', swift: 'swift',
      php: 'php', sql: 'sql', sh: 'bash', bash: 'bash',
      yaml: 'yaml', yml: 'yaml', json: 'json', md: 'markdown',
      html: 'html', css: 'css', scss: 'scss', less: 'less',
      vue: 'vue', svelte: 'svelte', sol: 'solidity',
    };
    return map[ext] || ext || 'text';
  }

  private getStatusLabel(status: FileStatus): string {
    switch (status) {
      case FileStatus.Added: return 'New file';
      case FileStatus.Modified: return 'Modified';
      case FileStatus.Deleted: return 'Deleted';
      case FileStatus.Renamed: return 'Renamed';
      case FileStatus.Untracked: return 'New file (untracked)';
      default: return 'Changed';
    }
  }
}
// buildBlockPrompt for hover context
