import * as vscode from 'vscode';

let isEnabled = true;

export function activate(context: vscode.ExtensionContext) {
  isEnabled = vscode.workspace.getConfiguration('aicodetracker').get('enabled', true);

  const toggleCmd = vscode.commands.registerCommand('aicodetracker.toggle', () => {
    isEnabled = !isEnabled;
  });

  context.subscriptions.push(toggleCmd);
}

export function deactivate() {}
