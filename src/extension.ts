import * as vscode from 'vscode';

let isEnabled = true;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  isEnabled = vscode.workspace.getConfiguration('aicodetracker').get('enabled', true);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'aicodetracker.toggle';
  updateStatusBar();
  statusBarItem.show();

  const toggleCmd = vscode.commands.registerCommand('aicodetracker.toggle', () => {
    isEnabled = !isEnabled;
    updateStatusBar();
  });

  context.subscriptions.push(toggleCmd, statusBarItem);
}

function updateStatusBar() {
  statusBarItem.text = isEnabled ? '$(eye) AICodeTracker: ON' : '$(eye-closed) AICodeTracker: OFF';
  statusBarItem.tooltip = 'Click to toggle AICodeTracker highlights';
}

export function deactivate() {}
