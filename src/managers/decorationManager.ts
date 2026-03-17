import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeType, LineChange } from '../types';

export class DecorationManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  applyDecorations(editor: vscode.TextEditor, changes: LineChange[]): void {}
  clearDecorations(editor: vscode.TextEditor): void {}
  dispose(): void {}
}
