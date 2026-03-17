import * as vscode from 'vscode';
import * as path from 'path';
import { ChangeType, LineChange } from '../types';

interface ChangeBlock {
  startLine: number; // 0-based
  endLine: number;   // 0-based inclusive
  type: ChangeType;
  lineCount: number;
}

export class DecorationManager {
  private addedType: vscode.TextEditorDecorationType;
  private modifiedType: vscode.TextEditorDecorationType;
  private deletedType: vscode.TextEditorDecorationType;
  private addedGutterType: vscode.TextEditorDecorationType;
  private modifiedGutterType: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;


  // Cache of old content per file for before/after hover
  private oldContentCache = new Map<string, string | null>();
  private oldContentLoader: ((filePath: string) => Promise<string | null>) | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const types = this.createDecorationTypes();
    this.addedType = types.added;
    this.modifiedType = types.modified;
    this.deletedType = types.deleted;
    this.addedGutterType = types.addedGutter;
    this.modifiedGutterType = types.modifiedGutter;
  }

  setOldContentLoader(loader: (filePath: string) => Promise<string | null>): void {
    this.oldContentLoader = loader;
  }

  async preloadOldContent(filePath: string): Promise<void> {
    if (this.oldContentCache.has(filePath)) return;
    if (!this.oldContentLoader) return;
    try {
      const content = await this.oldContentLoader(filePath);
      this.oldContentCache.set(filePath, content);
    } catch {
      this.oldContentCache.set(filePath, null);
    }
  }

  private createDecorationTypes() {
    const config = vscode.workspace.getConfiguration('aicodetracker');
    const addedColor = config.get<string>('addedColor', 'rgba(40, 160, 40, 0.10)');
    const modifiedColor = config.get<string>('modifiedColor', 'rgba(30, 120, 200, 0.10)');

    const added = vscode.window.createTextEditorDecorationType({
      backgroundColor: addedColor,
      isWholeLine: true,
      overviewRulerColor: 'rgba(40, 160, 40, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    const modified = vscode.window.createTextEditorDecorationType({
      backgroundColor: modifiedColor,
      isWholeLine: true,
      overviewRulerColor: 'rgba(30, 120, 200, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    const deletedIconPath = path.join(this.context.extensionPath, 'assets', 'deleted-line.svg');
    const deleted = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(deletedIconPath),
      gutterIconSize: 'contain',
      overviewRulerColor: 'rgba(220, 50, 50, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Thick left border gutter indicators
    const addedGutter = vscode.window.createTextEditorDecorationType({
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: 'rgba(40, 160, 40, 0.7)',
    });

    const modifiedGutter = vscode.window.createTextEditorDecorationType({
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: 'rgba(30, 120, 200, 0.7)',
    });

    return { added, modified, deleted, addedGutter, modifiedGutter };
  }

  applyDecorations(editor: vscode.TextEditor, changes: LineChange[]): void {
    const addedRanges: vscode.DecorationOptions[] = [];
    const modifiedRanges: vscode.DecorationOptions[] = [];
    const deletedRanges: vscode.DecorationOptions[] = [];
    const addedGutterRanges: vscode.DecorationOptions[] = [];
    const modifiedGutterRanges: vscode.DecorationOptions[] = [];

    // Group consecutive changes into blocks for hover
    const blocks = this.groupIntoBlocks(changes);
    const lineToBlock = new Map<number, ChangeBlock>();
    for (const block of blocks) {
      for (let line = block.startLine; line <= block.endLine; line++) {
        lineToBlock.set(line, block);
      }
    }

    // Preload old content for this file
    const filePath = editor.document.uri.fsPath;
    this.preloadOldContent(filePath);

    for (const change of changes) {
      const lineIndex = change.line - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER);
      const block = lineToBlock.get(lineIndex);

      // Show hover on every line in block
      const hoverMessage = block ? this.buildHoverMessage(block, editor) : undefined;

      const decoration: vscode.DecorationOptions = { range, hoverMessage };
      const gutterDecoration: vscode.DecorationOptions = { range };

      switch (change.type) {
        case ChangeType.Added:
          addedRanges.push(decoration);
          addedGutterRanges.push(gutterDecoration);
          break;
        case ChangeType.Modified:
          modifiedRanges.push(decoration);
          modifiedGutterRanges.push(gutterDecoration);
          break;
        case ChangeType.Deleted:
          deletedRanges.push(decoration);
          break;
      }
    }

    editor.setDecorations(this.addedType, addedRanges);
    editor.setDecorations(this.modifiedType, modifiedRanges);
    editor.setDecorations(this.deletedType, deletedRanges);
    editor.setDecorations(this.addedGutterType, addedGutterRanges);
    editor.setDecorations(this.modifiedGutterType, modifiedGutterRanges);
  }

  /** Group consecutive changes into blocks for hover context */
  private groupIntoBlocks(changes: LineChange[]): ChangeBlock[] {
    if (changes.length === 0) return [];

    const sorted = [...changes]
      .filter(c => c.type !== ChangeType.Deleted)
      .sort((a, b) => a.line - b.line);

    if (sorted.length === 0) return [];

    const blocks: ChangeBlock[] = [];
    let blockStart = sorted[0].line - 1;
    let blockEnd = sorted[0].line - 1;
    let hasAdded = sorted[0].type === ChangeType.Added;
    let hasModified = sorted[0].type === ChangeType.Modified;

    for (let i = 1; i < sorted.length; i++) {
      const lineIndex = sorted[i].line - 1;
      if (lineIndex === blockEnd + 1) {
        blockEnd = lineIndex;
        if (sorted[i].type === ChangeType.Added) hasAdded = true;
        if (sorted[i].type === ChangeType.Modified) hasModified = true;
      } else {
        blocks.push({
          startLine: blockStart,
          endLine: blockEnd,
          type: hasModified ? ChangeType.Modified : ChangeType.Added,
          lineCount: blockEnd - blockStart + 1,
        });
        blockStart = lineIndex;
        blockEnd = lineIndex;
        hasAdded = sorted[i].type === ChangeType.Added;
        hasModified = sorted[i].type === ChangeType.Modified;
      }
    }

    blocks.push({
      startLine: blockStart,
      endLine: blockEnd,
      type: hasModified ? ChangeType.Modified : ChangeType.Added,
      lineCount: blockEnd - blockStart + 1,
    });

    return blocks;
  }

  private buildHoverMessage(block: ChangeBlock, editor: vscode.TextEditor): vscode.MarkdownString[] {
    const messages: vscode.MarkdownString[] = [];

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;

    const isAdded = block.type === ChangeType.Added;
    const typeIcon = isAdded ? '$(diff-added)' : '$(diff-modified)';
    const typeLabel = isAdded ? 'New Code' : 'Modified Code';
    const lineRange = block.lineCount === 1
      ? `line ${block.startLine + 1}`
      : `lines ${block.startLine + 1}\u2013${block.endLine + 1}`;

    md.appendMarkdown(`### ${typeIcon} AICodeTracker \u2014 ${typeLabel}\n\n`);
    md.appendMarkdown(`**${block.lineCount}** line${block.lineCount !== 1 ? 's' : ''} ${isAdded ? 'added' : 'modified'} (${lineRange})\n\n`);

    // Before/After preview for modified code
    const filePath = editor.document.uri.fsPath;
    const oldContent = this.oldContentCache.get(filePath);

    if (!isAdded && oldContent) {
      const oldLines = oldContent.split('\n');
      const newLines: string[] = [];
      for (let i = block.startLine; i <= block.endLine && i < editor.document.lineCount; i++) {
        newLines.push(editor.document.lineAt(i).text);
      }

      // Show before/after (max 6 lines each to keep hover readable)
      const maxPreview = 6;
      const beforeLines = oldLines.slice(block.startLine, block.endLine + 1);
      const showBefore = beforeLines.slice(0, maxPreview);
      const showAfter = newLines.slice(0, maxPreview);

      if (showBefore.length > 0 || showAfter.length > 0) {
        md.appendMarkdown(`**Before:**\n`);
        md.appendCodeblock(
          showBefore.join('\n') + (beforeLines.length > maxPreview ? '\n...' : ''),
          this.detectLanguage(filePath)
        );
        md.appendMarkdown(`**After:**\n`);
        md.appendCodeblock(
          showAfter.join('\n') + (newLines.length > maxPreview ? '\n...' : ''),
          this.detectLanguage(filePath)
        );
      }
    }

    md.appendMarkdown(`---\n\n`);

    // Action buttons
    const reviewArgs = encodeURIComponent(JSON.stringify([filePath]));
    const flagArgs = encodeURIComponent(JSON.stringify([filePath]));
    const copyArgs = encodeURIComponent(JSON.stringify([filePath, block.startLine + 1, block.endLine + 1]));
    md.appendMarkdown(`[$(clippy) Copy for AI Review](command:aicodetracker.copyForReview?${copyArgs} "Copy review prompt to clipboard")  \u2003`);
    md.appendMarkdown(`[$(check) Reviewed](command:aicodetracker.markReviewed?${reviewArgs} "Mark as reviewed")  \u2003`);
    md.appendMarkdown(`[$(warning) Flag](command:aicodetracker.markFlagged?${flagArgs} "Flag for attention")\n`);

    messages.push(md);

    return messages;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).slice(1);
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
      java: 'java', kt: 'kotlin', cs: 'csharp', cpp: 'cpp',
      c: 'c', h: 'c', hpp: 'cpp', swift: 'swift',
      php: 'php', sql: 'sql', sh: 'bash', bash: 'bash',
      yaml: 'yaml', yml: 'yaml', json: 'json', md: 'markdown',
      html: 'html', css: 'css', scss: 'scss', vue: 'vue',
      svelte: 'svelte', sol: 'solidity',
    };
    return map[ext] || ext || 'text';
  }

  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.addedType, []);
    editor.setDecorations(this.modifiedType, []);
    editor.setDecorations(this.deletedType, []);
    editor.setDecorations(this.addedGutterType, []);
    editor.setDecorations(this.modifiedGutterType, []);
  }

  recreateDecorationTypes(): void {
    this.addedType.dispose();
    this.modifiedType.dispose();
    this.deletedType.dispose();
    this.addedGutterType.dispose();
    this.modifiedGutterType.dispose();

    const types = this.createDecorationTypes();
    this.addedType = types.added;
    this.modifiedType = types.modified;
    this.deletedType = types.deleted;
    this.addedGutterType = types.addedGutter;
    this.modifiedGutterType = types.modifiedGutter;
  }

  clearOldContentCache(): void {
    this.oldContentCache.clear();
  }

  dispose(): void {
    this.addedType.dispose();
    this.modifiedType.dispose();
    this.deletedType.dispose();
    this.addedGutterType.dispose();
    this.modifiedGutterType.dispose();
    this.oldContentCache.clear();
  }
}
