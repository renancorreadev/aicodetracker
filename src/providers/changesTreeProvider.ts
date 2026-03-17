import * as vscode from 'vscode';
import * as path from 'path';
import { GitDiffProvider } from './gitDiffProvider';
import { ReviewManager } from '../managers/reviewManager';
import { ChangedFile, FileStatus } from '../types';
import { getFileIcon } from '../ui/fileIcons';

export type TreeItem = FolderItem | FileItem | StatsItem | ProgressItem | SectionHeader | WarningFileItem;

// ── Header items ────────────────────────────────────────────

class StatsItem extends vscode.TreeItem {
  constructor(
    public readonly totalFiles: number,
    public readonly totalAdditions: number,
    public readonly totalDeletions: number,
  ) {
    super('', vscode.TreeItemCollapsibleState.None);
    const parts: string[] = [];
    if (totalAdditions > 0) parts.push(`+${totalAdditions}`);
    if (totalDeletions > 0) parts.push(`\u2212${totalDeletions}`);
    this.label = `${totalFiles} file${totalFiles !== 1 ? 's' : ''} changed`;
    this.description = parts.join('  ');
    this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.yellow'));
    this.contextValue = 'stats';

    const net = totalAdditions - totalDeletions;
    const netStr = (net >= 0 ? '+' : '') + net;
    const tooltip = new vscode.MarkdownString('', true);
    tooltip.supportThemeIcons = true;
    tooltip.appendMarkdown(`### $(pulse) Session Overview\n\n`);
    tooltip.appendMarkdown(`| | |\n|---|---|\n`);
    tooltip.appendMarkdown(`| $(files) Files | **${totalFiles}** |\n`);
    tooltip.appendMarkdown(`| $(diff-added) Added | **+${totalAdditions}** |\n`);
    tooltip.appendMarkdown(`| $(diff-removed) Removed | **\u2212${totalDeletions}** |\n`);
    tooltip.appendMarkdown(`| $(arrow-both) Net | **${netStr}** |\n`);
    this.tooltip = tooltip;
  }
}

class ProgressItem extends vscode.TreeItem {
  constructor(
    public readonly reviewedCount: number,
    public readonly flaggedCount: number,
    public readonly totalFiles: number,
  ) {
    super('', vscode.TreeItemCollapsibleState.None);

    const pct = totalFiles > 0 ? Math.round((reviewedCount / totalFiles) * 100) : 0;
    const bar = this.buildProgressBar(pct);
    const remaining = totalFiles - reviewedCount;

    this.label = `${bar}  ${pct}%`;
    this.description = `${reviewedCount}/${totalFiles}${flaggedCount > 0 ? ` \u00b7 ${flaggedCount} flagged` : ''}`;
    this.iconPath = new vscode.ThemeIcon(
      pct === 100 ? 'pass-filled' : 'tasklist',
      new vscode.ThemeColor(pct === 100 ? 'charts.green' : 'charts.blue')
    );
    this.contextValue = 'progress';

    const tooltip = new vscode.MarkdownString('', true);
    tooltip.supportThemeIcons = true;
    tooltip.appendMarkdown(`### $(tasklist) Review Progress\n\n`);
    tooltip.appendMarkdown(`${bar} **${pct}%**\n\n`);
    tooltip.appendMarkdown(`$(check) **${reviewedCount}** reviewed\n\n`);
    if (remaining > 0) {
      tooltip.appendMarkdown(`$(circle-outline) **${remaining}** remaining\n\n`);
    }
    if (flaggedCount > 0) {
      tooltip.appendMarkdown(`$(warning) **${flaggedCount}** flagged\n\n`);
    }
    if (pct === 100) {
      tooltip.appendMarkdown(`---\n\n$(pass-filled) *All files reviewed!*`);
    }
    this.tooltip = tooltip;
  }

  private buildProgressBar(pct: number): string {
    const total = 12;
    const filled = Math.round(pct / (100 / total));
    const empty = total - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  }
}

// ── Section headers ─────────────────────────────────────────

class SectionHeader extends vscode.TreeItem {
  public readonly sectionType: 'warnings' | 'changes';
  public readonly sectionFiles: ChangedFile[];

  constructor(
    label: string,
    icon: string,
    color: string,
    count: number,
    sectionType: 'warnings' | 'changes',
    files: ChangedFile[],
    additions?: number,
    deletions?: number,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.sectionType = sectionType;
    this.sectionFiles = files;

    const parts = [`${count} file${count !== 1 ? 's' : ''}`];
    if (additions !== undefined && deletions !== undefined && (additions > 0 || deletions > 0)) {
      parts.push(`+${additions} \u2212${deletions}`);
    }
    this.description = parts.join('  \u00b7  ');
    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
    this.contextValue = `section-${sectionType}`;
  }
}

// ── Folder items ────────────────────────────────────────────

export class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly folderPath: string,
    public readonly files: ChangedFile[],
    reviewManager: ReviewManager,
  ) {
    super(folderPath || '.', vscode.TreeItemCollapsibleState.Expanded);

    const additions = files.reduce((s, f) => s + f.additions, 0);
    const deletions = files.reduce((s, f) => s + f.deletions, 0);
    const reviewedInFolder = files.filter(f => reviewManager.isReviewed(f.relativePath)).length;
    const flaggedInFolder = files.filter(f => reviewManager.isFlagged(f.relativePath)).length;
    const allReviewed = reviewedInFolder === files.length;
    const pct = files.length > 0 ? Math.round((reviewedInFolder / files.length) * 100) : 0;

    // Mini progress bar in description
    const miniBar = this.buildMiniBar(pct);
    const parts: string[] = [];
    parts.push(`${miniBar} ${reviewedInFolder}/${files.length}`);
    parts.push(`+${additions} \u2212${deletions}`);
    if (flaggedInFolder > 0) parts.push(`\u26a0${flaggedInFolder}`);
    this.description = parts.join('  \u00b7  ');

    this.iconPath = new vscode.ThemeIcon(
      allReviewed ? 'pass-filled' : (flaggedInFolder > 0 ? 'warning' : 'folder-opened'),
      new vscode.ThemeColor(allReviewed ? 'charts.green' : (flaggedInFolder > 0 ? 'charts.orange' : 'charts.blue'))
    );
    this.contextValue = 'folder';

    const tooltip = new vscode.MarkdownString('', true);
    tooltip.supportThemeIcons = true;
    tooltip.appendMarkdown(`### $(folder) ${folderPath || 'root'}\n\n`);
    tooltip.appendMarkdown(`${miniBar} **${pct}%** reviewed\n\n`);
    tooltip.appendMarkdown(`| | |\n|---|---|\n`);
    tooltip.appendMarkdown(`| $(files) Files | **${files.length}** |\n`);
    tooltip.appendMarkdown(`| $(diff-added) Added | **+${additions}** |\n`);
    tooltip.appendMarkdown(`| $(diff-removed) Removed | **\u2212${deletions}** |\n`);
    tooltip.appendMarkdown(`| $(check) Reviewed | **${reviewedInFolder}/${files.length}** |\n`);
    if (flaggedInFolder > 0) {
      tooltip.appendMarkdown(`| $(warning) Flagged | **${flaggedInFolder}** |\n`);
    }
    tooltip.appendMarkdown(`\n---\n\n`);
    tooltip.appendMarkdown(`$(check-all) *Click inline buttons to review/flag entire folder*`);
    this.tooltip = tooltip;
  }

  private buildMiniBar(pct: number): string {
    const total = 5;
    const filled = Math.round(pct / (100 / total));
    const empty = total - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  }
}

// ── File items ──────────────────────────────────────────────

class FileItem extends vscode.TreeItem {
  public readonly file: ChangedFile;

  constructor(
    file: ChangedFile,
    public readonly gitRoot: string,
    reviewManager: ReviewManager,
  ) {
    super(path.basename(file.relativePath), vscode.TreeItemCollapsibleState.None);
    this.file = file;

    const isReviewed = reviewManager.isReviewed(file.relativePath);
    const isFlagged = reviewManager.isFlagged(file.relativePath);

    // Icon
    if (isReviewed) {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    } else if (isFlagged) {
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    } else {
      this.iconPath = getFileIcon(file.relativePath);
    }

    // Description — clean compact format
    const statusLabel = FileItem.getStatusLabel(file.status);
    const parts: string[] = [statusLabel];
    if (file.additions > 0 || file.deletions > 0) {
      parts.push(`+${file.additions} \u2212${file.deletions}`);
    }
    if (isReviewed) parts.push('\u2713');
    if (isFlagged) parts.push('\u26a0');
    this.description = parts.join('  ');

    // Tooltip
    const tooltip = new vscode.MarkdownString('', true);
    tooltip.supportThemeIcons = true;
    tooltip.appendMarkdown(`### $(file) ${file.relativePath}\n\n`);
    tooltip.appendMarkdown(`**Status:** ${statusLabel}\n\n`);
    if (file.additions > 0) tooltip.appendMarkdown(`$(diff-added) **+${file.additions}** lines added\n\n`);
    if (file.deletions > 0) tooltip.appendMarkdown(`$(diff-removed) **\u2212${file.deletions}** lines removed\n\n`);
    if (isReviewed) tooltip.appendMarkdown(`---\n\n$(pass-filled) *Reviewed*\n\n`);
    if (isFlagged) tooltip.appendMarkdown(`---\n\n$(warning) *Flagged for attention*\n\n`);
    this.tooltip = tooltip;

    this.contextValue = isFlagged ? 'file-flagged' : (isReviewed ? 'file-reviewed' : 'file');

    if (file.status !== FileStatus.Deleted) {
      this.command = {
        command: 'aicodetracker.openFile',
        title: 'Open File',
        arguments: [file.absolutePath],
      };
    }

    this.resourceUri = vscode.Uri.file(file.absolutePath);
  }

  private static getStatusLabel(status: FileStatus): string {
    switch (status) {
      case FileStatus.Added: return 'Added';
      case FileStatus.Modified: return 'Modified';
      case FileStatus.Deleted: return 'Deleted';
      case FileStatus.Renamed: return 'Renamed';
      case FileStatus.Untracked: return 'New';
      default: return 'Changed';
    }
  }
}

// ── Warning file items ──────────────────────────────────────

class WarningFileItem extends vscode.TreeItem {
  public readonly file: ChangedFile;

  constructor(file: ChangedFile, public readonly gitRoot: string) {
    super(path.basename(file.relativePath), vscode.TreeItemCollapsibleState.None);
    this.file = file;

    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));

    const parts: string[] = [file.relativePath];
    if (file.additions > 0 || file.deletions > 0) {
      parts.push(`+${file.additions} \u2212${file.deletions}`);
    }
    this.description = parts.join('  ');

    const tooltip = new vscode.MarkdownString('', true);
    tooltip.supportThemeIcons = true;
    tooltip.appendMarkdown(`### $(warning) Flagged for Attention\n\n`);
    tooltip.appendMarkdown(`**${file.relativePath}**\n\n`);
    tooltip.appendMarkdown(`This file needs careful review.\n\n`);
    if (file.additions > 0) tooltip.appendMarkdown(`$(diff-added) **+${file.additions}** added\n\n`);
    if (file.deletions > 0) tooltip.appendMarkdown(`$(diff-removed) **\u2212${file.deletions}** removed\n\n`);
    this.tooltip = tooltip;

    this.contextValue = 'file-flagged';

    if (file.status !== FileStatus.Deleted) {
      this.command = {
        command: 'aicodetracker.openFile',
        title: 'Open File',
        arguments: [file.absolutePath],
      };
    }

    this.resourceUri = vscode.Uri.file(file.absolutePath);
  }
}

// ── Tree Provider ───────────────────────────────────────────

export class ChangesTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private changedFiles: ChangedFile[] = [];
  private gitRoot = '';

  constructor(
    private gitDiffProvider: GitDiffProvider,
    private reviewManager: ReviewManager,
  ) {
    reviewManager.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async updateData(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.changedFiles = [];
      this.gitRoot = '';
      this.refresh();
      return;
    }

    const result = await this.gitDiffProvider.getAllChangedFiles(workspaceFolders[0].uri.fsPath);
    if (result) {
      this.changedFiles = result.files;
      this.gitRoot = result.gitRoot;
    } else {
      this.changedFiles = [];
      this.gitRoot = '';
    }
    this.refresh();
  }

  getFileCount(): number {
    return this.changedFiles.length;
  }

  getReviewedCount(): number {
    return this.changedFiles.filter(f => this.reviewManager.isReviewed(f.relativePath)).length;
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.getRootChildren();
    }

    if (element instanceof SectionHeader) {
      if (element.sectionType === 'warnings') {
        return element.sectionFiles.map(f => new WarningFileItem(f, this.gitRoot));
      }
      if (element.sectionType === 'changes') {
        return this.buildFileTree(element.sectionFiles);
      }
    }

    if (element instanceof FolderItem) {
      return this.sortFiles(element.files)
        .map(f => new FileItem(f, this.gitRoot, this.reviewManager));
    }

    return [];
  }

  private getRootChildren(): TreeItem[] {
    if (this.changedFiles.length === 0) {
      const empty = new vscode.TreeItem('No changes detected');
      empty.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      empty.description = 'All clean!';
      return [empty as TreeItem];
    }

    const items: TreeItem[] = [];

    // Stats
    const totalAdditions = this.changedFiles.reduce((s, f) => s + f.additions, 0);
    const totalDeletions = this.changedFiles.reduce((s, f) => s + f.deletions, 0);
    items.push(new StatsItem(this.changedFiles.length, totalAdditions, totalDeletions));

    // Progress
    const reviewedCount = this.changedFiles.filter(f => this.reviewManager.isReviewed(f.relativePath)).length;
    const flaggedCount = this.changedFiles.filter(f => this.reviewManager.isFlagged(f.relativePath)).length;
    items.push(new ProgressItem(reviewedCount, flaggedCount, this.changedFiles.length));

    // Warnings
    const flaggedFiles = this.changedFiles.filter(f => this.reviewManager.isFlagged(f.relativePath));
    if (flaggedFiles.length > 0) {
      const fAdd = flaggedFiles.reduce((s, f) => s + f.additions, 0);
      const fDel = flaggedFiles.reduce((s, f) => s + f.deletions, 0);
      items.push(new SectionHeader(
        'Needs Attention',
        'bell-dot',
        'charts.orange',
        flaggedFiles.length,
        'warnings',
        flaggedFiles,
        fAdd,
        fDel,
      ));
    }

    // Changes
    const nonFlaggedFiles = this.changedFiles.filter(f => !this.reviewManager.isFlagged(f.relativePath));
    const nfAdd = nonFlaggedFiles.reduce((s, f) => s + f.additions, 0);
    const nfDel = nonFlaggedFiles.reduce((s, f) => s + f.deletions, 0);
    items.push(new SectionHeader(
      'Changed Files',
      'files',
      'charts.blue',
      nonFlaggedFiles.length,
      'changes',
      nonFlaggedFiles,
      nfAdd,
      nfDel,
    ));

    return items;
  }

  private buildFileTree(files: ChangedFile[]): TreeItem[] {
    const items: TreeItem[] = [];

    const folders = new Map<string, ChangedFile[]>();
    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      const folder = dir === '.' ? '.' : dir;
      if (!folders.has(folder)) {
        folders.set(folder, []);
      }
      folders.get(folder)!.push(file);
    }

    const sortedFolders = [...folders.entries()].sort(([a], [b]) => {
      if (a === '.') return 1;
      if (b === '.') return -1;
      return a.localeCompare(b);
    });

    for (const [folderPath, folderFiles] of sortedFolders) {
      if (sortedFolders.length === 1) {
        for (const file of this.sortFiles(folderFiles)) {
          items.push(new FileItem(file, this.gitRoot, this.reviewManager));
        }
      } else {
        items.push(new FolderItem(folderPath, folderFiles, this.reviewManager));
      }
    }

    return items;
  }

  private sortFiles(files: ChangedFile[]): ChangedFile[] {
    return [...files].sort((a, b) => {
      const aReviewed = this.reviewManager.isReviewed(a.relativePath) ? 1 : 0;
      const bReviewed = this.reviewManager.isReviewed(b.relativePath) ? 1 : 0;
      if (aReviewed !== bReviewed) return aReviewed - bReviewed;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
// WarningFileItem for flagged files
