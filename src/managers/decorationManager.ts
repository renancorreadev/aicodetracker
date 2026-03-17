import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeType, LineChange } from '../types';

export class DecorationManager {
  private addedType: vscode.TextEditorDecorationType;
  private modifiedType: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const config = vscode.workspace.getConfiguration('aicodetracker');
    const addedColor = config.get<string>('addedColor', 'rgba(40, 160, 40, 0.10)');
    const modifiedColor = config.get<string>('modifiedColor', 'rgba(30, 120, 200, 0.10)');

    this.addedType = vscode.window.createTextEditorDecorationType({
      backgroundColor: addedColor, isWholeLine: true,
      overviewRulerColor: 'rgba(40, 160, 40, 0.5)', overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.modifiedType = vscode.window.createTextEditorDecorationType({
      backgroundColor: modifiedColor, isWholeLine: true,
      overviewRulerColor: 'rgba(30, 120, 200, 0.5)', overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  applyDecorations(editor: vscode.TextEditor, changes: LineChange[]): void {}
  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.addedType, []);
    editor.setDecorations(this.modifiedType, []);
  }
  dispose(): void { this.addedType.dispose(); this.modifiedType.dispose(); }
}
