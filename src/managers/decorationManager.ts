import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeType, LineChange } from '../types';

export class DecorationManager {
  private addedType: vscode.TextEditorDecorationType;
  private modifiedType: vscode.TextEditorDecorationType;
  private deletedType: vscode.TextEditorDecorationType;
  private addedGutterType: vscode.TextEditorDecorationType;
  private modifiedGutterType: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const types = this.createDecorationTypes();
    this.addedType = types.added;
    this.modifiedType = types.modified;
    this.deletedType = types.deleted;
    this.addedGutterType = types.addedGutter;
    this.modifiedGutterType = types.modifiedGutter;
  }

  private createDecorationTypes() {
    const config = vscode.workspace.getConfiguration('aicodetracker');
    const addedColor = config.get<string>('addedColor', 'rgba(40, 160, 40, 0.10)');
    const modifiedColor = config.get<string>('modifiedColor', 'rgba(30, 120, 200, 0.10)');

    const added = vscode.window.createTextEditorDecorationType({
      backgroundColor: addedColor, isWholeLine: true,
      overviewRulerColor: 'rgba(40, 160, 40, 0.5)', overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    const modified = vscode.window.createTextEditorDecorationType({
      backgroundColor: modifiedColor, isWholeLine: true,
      overviewRulerColor: 'rgba(30, 120, 200, 0.5)', overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    const deletedIconPath = path.join(this.context.extensionPath, 'assets', 'deleted-line.svg');
    const deleted = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(deletedIconPath), gutterIconSize: 'contain',
      overviewRulerColor: 'rgba(220, 50, 50, 0.5)', overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    const addedGutter = vscode.window.createTextEditorDecorationType({
      borderWidth: '0 0 0 3px', borderStyle: 'solid', borderColor: 'rgba(40, 160, 40, 0.7)',
    });
    const modifiedGutter = vscode.window.createTextEditorDecorationType({
      borderWidth: '0 0 0 3px', borderStyle: 'solid', borderColor: 'rgba(30, 120, 200, 0.7)',
    });
    return { added, modified, deleted, addedGutter, modifiedGutter };
  }

  applyDecorations(editor: vscode.TextEditor, changes: LineChange[]): void {
    const addedRanges: vscode.DecorationOptions[] = [];
    const modifiedRanges: vscode.DecorationOptions[] = [];
    const deletedRanges: vscode.DecorationOptions[] = [];
    const addedGutterRanges: vscode.DecorationOptions[] = [];
    const modifiedGutterRanges: vscode.DecorationOptions[] = [];
    for (const change of changes) {
      const lineIndex = change.line - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) continue;
      const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER);
      switch (change.type) {
        case ChangeType.Added: addedRanges.push({ range }); addedGutterRanges.push({ range }); break;
        case ChangeType.Modified: modifiedRanges.push({ range }); modifiedGutterRanges.push({ range }); break;
        case ChangeType.Deleted: deletedRanges.push({ range }); break;
      }
    }
    editor.setDecorations(this.addedType, addedRanges);
    editor.setDecorations(this.modifiedType, modifiedRanges);
    editor.setDecorations(this.deletedType, deletedRanges);
    editor.setDecorations(this.addedGutterType, addedGutterRanges);
    editor.setDecorations(this.modifiedGutterType, modifiedGutterRanges);
  }

  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.addedType, []);
    editor.setDecorations(this.modifiedType, []);
    editor.setDecorations(this.deletedType, []);
    editor.setDecorations(this.addedGutterType, []);
    editor.setDecorations(this.modifiedGutterType, []);
  }

  dispose(): void {
    this.addedType.dispose(); this.modifiedType.dispose(); this.deletedType.dispose();
    this.addedGutterType.dispose(); this.modifiedGutterType.dispose();
  }
}
