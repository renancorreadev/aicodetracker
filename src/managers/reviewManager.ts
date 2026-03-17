import * as vscode from 'vscode';

export class ReviewManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private reviewed = new Set<string>();
  private flagged = new Set<string>();

  dispose(): void {
    this._onDidChange.dispose();
  }
}
