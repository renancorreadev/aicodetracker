import * as path from 'path';
import * as vscode from 'vscode';

let extensionPath = '';
export function initFileIcons(extPath: string): void { extensionPath = extPath; }

function iconPath(name: string): { light: vscode.Uri; dark: vscode.Uri } {
  const p = path.join(extensionPath, 'assets', 'icons', `${name}.svg`);
  return { light: vscode.Uri.file(p), dark: vscode.Uri.file(p) };
}

const EXT_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'react', '.js': 'javascript', '.jsx': 'react',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin',
  '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php',
  '.swift': 'swift', '.dart': 'dart',
  '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown', '.sql': 'sql', '.sol': 'solidity',
  '.vue': 'vue', '.svelte': 'svelte', '.sh': 'shell',
  '.dockerfile': 'docker', '.env': 'env', '.lock': 'lock',
};

const FILENAME_MAP: Record<string, string> = {
  'Dockerfile': 'docker', 'package.json': 'package', 'package-lock.json': 'lock',
  'tsconfig.json': 'config', '.gitignore': 'git', 'LICENSE': 'default', 'README.md': 'markdown',
};

export function getFileIcon(filePath: string): { light: vscode.Uri; dark: vscode.Uri } {
  const fileName = filePath.split('/').pop() || filePath;
  if (FILENAME_MAP[fileName]) return iconPath(FILENAME_MAP[fileName]);
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > 0) {
    const ext = fileName.substring(dotIndex).toLowerCase();
    if (EXT_MAP[ext]) return iconPath(EXT_MAP[ext]);
  }
  return iconPath('default');
}
