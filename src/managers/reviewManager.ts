import * as vscode from 'vscode';

export class ReviewManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private reviewed = new Set<string>();
  private flagged = new Set<string>();

  toggleReviewed(relativePath: string): void {
    if (this.reviewed.has(relativePath)) this.reviewed.delete(relativePath);
    else this.reviewed.add(relativePath);
    this._onDidChange.fire();
  }

  toggleFlagged(relativePath: string): void {
    if (this.flagged.has(relativePath)) this.flagged.delete(relativePath);
    else this.flagged.add(relativePath);
    this._onDidChange.fire();
  }

  isReviewed(relativePath: string): boolean { return this.reviewed.has(relativePath); }
  isFlagged(relativePath: string): boolean { return this.flagged.has(relativePath); }

  getReviewedCount(): number { return this.reviewed.size; }
  getFlaggedCount(): number { return this.flagged.size; }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
