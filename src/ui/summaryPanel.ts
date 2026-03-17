import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile, FileStatus } from '../types';
import { ReviewManager } from '../managers/reviewManager';

interface SummaryData {
  files: ChangedFile[];
  gitRoot: string;
  diffs: Map<string, string>;
}

export class SummaryPanel {
  private panel: vscode.WebviewPanel | undefined;
  private data: SummaryData | undefined;
  private disposables: vscode.Disposable[] = [];
  private cardIndex = 0;

  constructor(private context: vscode.ExtensionContext, private reviewManager: ReviewManager) {
    reviewManager.onDidChange(() => this.refresh());
  }

  async show(files: ChangedFile[], gitRoot: string, diffs: Map<string, string>): Promise<void> {
    this.data = { files, gitRoot, diffs };
    this.cardIndex = 0;
    if (this.panel) { this.panel.reveal(vscode.ViewColumn.One); this.refresh(); return; }
    this.panel = vscode.window.createWebviewPanel(
      'aicodetracker.summary', 'AICodeTracker — Changes Summary',
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.iconPath = new vscode.ThemeIcon('graph');
    this.panel.onDidDispose(() => { this.panel = undefined; this.disposables.forEach(d => d.dispose()); this.disposables = []; }, null, this.disposables);
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.refresh();
  }

  private refresh(): void {
    if (!this.panel || !this.data) return;
    this.cardIndex = 0;
    this.panel.webview.html = '<html><body><h1>Loading...</h1></body></html>';
  }

  private handleMessage(msg: any): void {}

  dispose(): void { this.panel?.dispose(); this.disposables.forEach(d => d.dispose()); }
}
