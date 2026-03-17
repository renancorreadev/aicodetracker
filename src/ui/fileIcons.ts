import * as path from 'path';
import * as vscode from 'vscode';

let extensionPath = '';

export function initFileIcons(extPath: string): void {
  extensionPath = extPath;
}

function iconPath(name: string): { light: vscode.Uri; dark: vscode.Uri } {
  const p = path.join(extensionPath, 'assets', 'icons', `${name}.svg`);
  return { light: vscode.Uri.file(p), dark: vscode.Uri.file(p) };
}

export function getFileIcon(filePath: string): { light: vscode.Uri; dark: vscode.Uri } {
  return iconPath('default');
}
