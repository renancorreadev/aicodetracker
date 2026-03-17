import * as vscode from 'vscode';
import * as path from 'path';
import { GitDiffProvider } from './gitDiffProvider';
import { ReviewManager } from '../managers/reviewManager';
import { ChangedFile, FileStatus } from '../types';
import { getFileIcon } from '../ui/fileIcons';

export type TreeItem = vscode.TreeItem;

export class FolderItem extends vscode.TreeItem {
  constructor(public readonly folderPath: string, public readonly files: ChangedFile[], reviewManager: ReviewManager) {
    super(folderPath || '.', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'folder';
  }
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private changedFiles: ChangedFile[] = [];
  private gitRoot = '';

  constructor(private gitDiffProvider: GitDiffProvider, private reviewManager: ReviewManager) {
    reviewManager.onDidChange(() => this.refresh());
  }

  refresh(): void { this._onDidChangeTreeData.fire(undefined); }
  async updateData(): Promise<void> {
    const wf = vscode.workspace.workspaceFolders;
    if (!wf) { this.changedFiles = []; this.gitRoot = ''; this.refresh(); return; }
    const r = await this.gitDiffProvider.getAllChangedFiles(wf[0].uri.fsPath);
    if (r) { this.changedFiles = r.files; this.gitRoot = r.gitRoot; }
    else { this.changedFiles = []; this.gitRoot = ''; }
    this.refresh();
  }
  getFileCount(): number { return this.changedFiles.length; }
  getReviewedCount(): number { return this.changedFiles.filter(f => this.reviewManager.isReviewed(f.relativePath)).length; }
  getTreeItem(el: TreeItem): vscode.TreeItem { return el; }
  getChildren(): TreeItem[] { return []; }
  dispose(): void { this._onDidChangeTreeData.dispose(); }
}
