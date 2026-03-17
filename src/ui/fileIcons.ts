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

const EXT_MAP: Record<string, string> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'react',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // JavaScript
  '.js': 'javascript',
  '.jsx': 'react',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Styles
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'css',
  // Markup
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'html',
  '.svg': 'image',
  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'yaml',
  // Python
  '.py': 'python',
  '.pyx': 'python',
  '.ipynb': 'python',
  // Go
  '.go': 'go',
  // Rust
  '.rs': 'rust',
  // Java / Kotlin
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  // C#
  '.cs': 'csharp',
  // Ruby
  '.rb': 'ruby',
  // PHP
  '.php': 'php',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
  // Swift
  '.swift': 'swift',
  // Dart
  '.dart': 'dart',
  // Vue / Svelte
  '.vue': 'vue',
  '.svelte': 'svelte',
  // SQL
  '.sql': 'sql',
  // Solidity
  '.sol': 'solidity',
  // Images
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.ico': 'image',
  // Docker
  '.dockerfile': 'docker',
  // Config / Lock
  '.env': 'env',
  '.lock': 'lock',
};

const FILENAME_MAP: Record<string, string> = {
  'Dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'package.json': 'package',
  'package-lock.json': 'lock',
  'yarn.lock': 'lock',
  'pnpm-lock.yaml': 'lock',
  'tsconfig.json': 'config',
  'webpack.config.js': 'config',
  'vite.config.ts': 'config',
  'vite.config.js': 'config',
  'tailwind.config.js': 'config',
  'tailwind.config.ts': 'config',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.env': 'env',
  '.env.local': 'env',
  '.env.production': 'env',
  '.env.development': 'env',
  '.prettierrc': 'config',
  '.prettierrc.json': 'config',
  '.eslintrc': 'config',
  '.eslintrc.json': 'config',
  '.editorconfig': 'config',
  'Makefile': 'shell',
  'LICENSE': 'default',
  'README.md': 'markdown',
  'CHANGELOG.md': 'markdown',
};

export function getFileIcon(filePath: string): { light: vscode.Uri; dark: vscode.Uri } {
  const fileName = filePath.split('/').pop() || filePath;

  // Exact filename match first
  if (FILENAME_MAP[fileName]) {
    return iconPath(FILENAME_MAP[fileName]);
  }

  // Compound extension (.test.ts, .spec.js)
  const compoundExt = getCompoundExtension(fileName);
  if (compoundExt && EXT_MAP[compoundExt]) {
    return iconPath(EXT_MAP[compoundExt]);
  }

  // Simple extension
  const ext = getExtension(fileName);
  if (ext && EXT_MAP[ext]) {
    return iconPath(EXT_MAP[ext]);
  }

  return iconPath('default');
}

function getExtension(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return null;
  return fileName.substring(dotIndex).toLowerCase();
}

function getCompoundExtension(fileName: string): string | null {
  const parts = fileName.split('.');
  if (parts.length >= 3) {
    return '.' + parts.slice(-2).join('.').toLowerCase();
  }
  return null;
}
