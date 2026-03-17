import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeType, LineChange } from '../types';

export class DecorationManager {
  private addedType: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const config = vscode.workspace.getConfiguration('aicodetracker');
    const addedColor = config.get<string>('addedColor', 'rgba(40, 160, 40, 0.10)');
    this.addedType = vscode.window.createTextEditorDecorationType({
      backgroundColor: addedColor,
      isWholeLine: true,
      overviewRulerColor: 'rgba(40, 160, 40, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  applyDecorations(editor: vscode.TextEditor, changes: LineChange[]): void {}
  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.addedType, []);
  }
  dispose(): void { this.addedType.dispose(); }
}
