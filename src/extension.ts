import * as vscode from 'vscode';
import * as path from 'path';
import { GitDiffProvider } from './providers/gitDiffProvider';
import { DecorationManager } from './managers/decorationManager';
import { ChangesTreeProvider, FolderItem } from './providers/changesTreeProvider';
import { ReviewManager } from './managers/reviewManager';
import { ClipboardReviewProvider } from './providers/clipboardReviewProvider';
import { SummaryPanel } from './ui/summaryPanel';
import { initFileIcons } from './ui/fileIcons';

let gitDiffProvider: GitDiffProvider;
let decorationManager: DecorationManager;
let changesTreeProvider: ChangesTreeProvider;
let reviewManager: ReviewManager;
let clipboardReview: ClipboardReviewProvider;
let summaryPanel: SummaryPanel;
let isEnabled: boolean;
let statusBarItem: vscode.StatusBarItem;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let treeDebounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
  initFileIcons(context.extensionPath);
  gitDiffProvider = new GitDiffProvider();
  reviewManager = new ReviewManager();
  decorationManager = new DecorationManager(context);
  clipboardReview = new ClipboardReviewProvider(gitDiffProvider);
  summaryPanel = new SummaryPanel(context, reviewManager);
  changesTreeProvider = new ChangesTreeProvider(gitDiffProvider, reviewManager);

  // Wire up old content loader for before/after hover
  decorationManager.setOldContentLoader(async (filePath: string) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;
    const gitRoot = await gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath);
    if (!gitRoot) return null;
    const relativePath = path.relative(gitRoot, filePath);
    try {
      return await gitDiffProvider.getFileAtHead(relativePath, gitRoot);
    } catch {
      return null;
    }
  });
  isEnabled = vscode.workspace.getConfiguration('aicodetracker').get('enabled', true);

  // Register the tree view
  const treeView = vscode.window.createTreeView('aicodetracker.changesTree', {
    treeDataProvider: changesTreeProvider,
    showCollapseAll: true,
  });

  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'aicodetracker.toggle';
  updateStatusBar();
  statusBarItem.show();

  // ── Commands ──────────────────────────────────────────────

  const toggleCmd = vscode.commands.registerCommand('aicodetracker.toggle', () => {
    isEnabled = !isEnabled;
    updateStatusBar();
    if (isEnabled) {
      for (const editor of vscode.window.visibleTextEditors) {
        debouncedUpdate(editor);
      }
    } else {
      for (const editor of vscode.window.visibleTextEditors) {
        decorationManager.clearDecorations(editor);
      }
    }
  });

  const refreshCmd = vscode.commands.registerCommand('aicodetracker.refreshTree', () => {
    changesTreeProvider.updateData();
  });

  const openFileCmd = vscode.commands.registerCommand('aicodetracker.openFile', async (filePath: string) => {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    if (isEnabled) {
      setTimeout(() => updateDecorations(editor), 100);
    }
  });

  const openDiffCmd = vscode.commands.registerCommand('aicodetracker.openDiff', async (item: any) => {
    if (!item?.file?.absolutePath) return;
    const filePath = item.file.absolutePath;
    const uri = vscode.Uri.file(filePath);
    const relativePath = item.file.relativePath;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const gitRoot = await gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath);
    if (!gitRoot) return;

    try {
      // Get HEAD version content via git show
      const headContent = await gitDiffProvider.getFileAtHead(relativePath, gitRoot);
      // Create a virtual document with the HEAD content
      const headUri = vscode.Uri.parse(`aicodetracker-head:${relativePath}`);

      // Register a content provider for the HEAD version
      const provider = vscode.workspace.registerTextDocumentContentProvider('aicodetracker-head', {
        provideTextDocumentContent: () => headContent,
      });

      try {
        await vscode.commands.executeCommand(
          'vscode.diff',
          headUri,
          uri,
          `${path.basename(relativePath)} (HEAD \u2194 Working)`
        );
      } finally {
        // Dispose after a delay to let the diff view load
        setTimeout(() => provider.dispose(), 5000);
      }
    } catch {
      // File is new (no HEAD version) — just open it
      await vscode.commands.executeCommand('vscode.open', uri);
    }
  });

  // Mark reviewed — from tree view item
  const markReviewedTreeCmd = vscode.commands.registerCommand('aicodetracker.markReviewedTree', (item: any) => {
    if (!item?.file?.relativePath) return;
    reviewManager.toggleReviewed(item.file.relativePath);
    const isNowReviewed = reviewManager.isReviewed(item.file.relativePath);
    vscode.window.setStatusBarMessage(
      isNowReviewed
        ? `$(check) ${path.basename(item.file.relativePath)} marked as reviewed`
        : `$(circle-outline) ${path.basename(item.file.relativePath)} unmarked`,
      3000
    );
  });

  // Mark reviewed — from hover (receives file path)
  const markReviewedCmd = vscode.commands.registerCommand('aicodetracker.markReviewed', (filePath: string) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    // Convert absolute path to relative
    gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath).then(gitRoot => {
      if (!gitRoot) return;
      const relativePath = path.relative(gitRoot, filePath);
      reviewManager.toggleReviewed(relativePath);
      const isNowReviewed = reviewManager.isReviewed(relativePath);
      vscode.window.setStatusBarMessage(
        isNowReviewed
          ? `$(check) ${path.basename(filePath)} marked as reviewed`
          : `$(circle-outline) ${path.basename(filePath)} unmarked`,
        3000
      );
    });
  });

  // Flag for attention — from tree view item
  const markFlaggedTreeCmd = vscode.commands.registerCommand('aicodetracker.markFlaggedTree', (item: any) => {
    if (!item?.file?.relativePath) return;
    reviewManager.toggleFlagged(item.file.relativePath);
    const isNowFlagged = reviewManager.isFlagged(item.file.relativePath);
    vscode.window.setStatusBarMessage(
      isNowFlagged
        ? `$(warning) ${path.basename(item.file.relativePath)} flagged for attention`
        : `$(circle-outline) ${path.basename(item.file.relativePath)} unflagged`,
      3000
    );
  });

  // Flag for attention — from hover
  const markFlaggedCmd = vscode.commands.registerCommand('aicodetracker.markFlagged', (filePath: string) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath).then(gitRoot => {
      if (!gitRoot) return;
      const relativePath = path.relative(gitRoot, filePath);
      reviewManager.toggleFlagged(relativePath);
      const isNowFlagged = reviewManager.isFlagged(relativePath);
      vscode.window.setStatusBarMessage(
        isNowFlagged
          ? `$(warning) ${path.basename(filePath)} flagged for attention`
          : `$(circle-outline) ${path.basename(filePath)} unflagged`,
        3000
      );
    });
  });

  // Reset all reviews
  const resetReviewsCmd = vscode.commands.registerCommand('aicodetracker.resetReviews', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Reset all review progress?',
      { modal: true },
      'Reset'
    );
    if (confirm === 'Reset') {
      reviewManager.resetAll();
      vscode.window.setStatusBarMessage('$(trash) Review progress reset', 3000);
    }
  });

  // Copy for AI Review — from hover (specific block)
  const copyForReviewCmd = vscode.commands.registerCommand(
    'aicodetracker.copyForReview',
    async (filePath: string, startLine?: number, endLine?: number) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;
      const gitRoot = await gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath);
      if (!gitRoot) return;

      let prompt: string;
      if (startLine !== undefined && endLine !== undefined) {
        prompt = await clipboardReview.buildBlockPrompt(filePath, gitRoot, startLine, endLine);
      } else {
        prompt = await clipboardReview.buildFilePrompt(filePath, gitRoot);
      }

      await vscode.env.clipboard.writeText(prompt);
      vscode.window.setStatusBarMessage('$(clippy) Review prompt copied to clipboard!', 3000);
    }
  );

  // Copy for AI Review — from tree view item (single file)
  const copyForReviewTreeCmd = vscode.commands.registerCommand('aicodetracker.copyForReviewTree', async (item: any) => {
    if (!item?.file?.absolutePath) return;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const gitRoot = await gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath);
    if (!gitRoot) return;

    const prompt = await clipboardReview.buildFilePrompt(item.file.absolutePath, gitRoot);
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.setStatusBarMessage(`$(clippy) Review prompt for ${path.basename(item.file.relativePath)} copied!`, 3000);
  });

  // Copy for AI Review — all changed files
  const copyAllForReviewCmd = vscode.commands.registerCommand('aicodetracker.copyAllForReview', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const result = await gitDiffProvider.getAllChangedFiles(workspaceFolders[0].uri.fsPath);
    if (!result || result.files.length === 0) {
      vscode.window.setStatusBarMessage('$(info) No changes to review', 3000);
      return;
    }

    const prompt = await clipboardReview.buildAllFilesPrompt(result.files, result.gitRoot);
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.setStatusBarMessage(`$(clippy) Review prompt for ${result.files.length} files copied!`, 3000);
  });

  // Mark folder as reviewed
  const markFolderReviewedCmd = vscode.commands.registerCommand('aicodetracker.markFolderReviewed', (item: any) => {
    if (!(item instanceof FolderItem)) return;
    const allReviewed = item.files.every(f => reviewManager.isReviewed(f.relativePath));
    for (const file of item.files) {
      if (allReviewed) {
        if (reviewManager.isReviewed(file.relativePath)) reviewManager.toggleReviewed(file.relativePath);
      } else {
        if (!reviewManager.isReviewed(file.relativePath)) reviewManager.toggleReviewed(file.relativePath);
      }
    }
    vscode.window.setStatusBarMessage(
      allReviewed
        ? `$(circle-outline) ${item.folderPath}/ unmarked (${item.files.length} files)`
        : `$(check-all) ${item.folderPath}/ marked as reviewed (${item.files.length} files)`,
      3000
    );
  });

  // Flag entire folder
  const markFolderFlaggedCmd = vscode.commands.registerCommand('aicodetracker.markFolderFlagged', (item: any) => {
    if (!(item instanceof FolderItem)) return;
    const allFlagged = item.files.every(f => reviewManager.isFlagged(f.relativePath));
    for (const file of item.files) {
      if (allFlagged) {
        if (reviewManager.isFlagged(file.relativePath)) reviewManager.toggleFlagged(file.relativePath);
      } else {
        if (!reviewManager.isFlagged(file.relativePath)) reviewManager.toggleFlagged(file.relativePath);
      }
    }
    vscode.window.setStatusBarMessage(
      allFlagged
        ? `$(circle-outline) ${item.folderPath}/ unflagged`
        : `$(warning) ${item.folderPath}/ flagged (${item.files.length} files)`,
      3000
    );
  });

  // Copy folder for AI Review
  const copyFolderForReviewCmd = vscode.commands.registerCommand('aicodetracker.copyFolderForReview', async (item: any) => {
    if (!(item instanceof FolderItem)) return;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const gitRoot = await gitDiffProvider.getGitRootForDir(workspaceFolders[0].uri.fsPath);
    if (!gitRoot) return;

    const prompt = await clipboardReview.buildAllFilesPrompt(item.files, gitRoot);
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.setStatusBarMessage(`$(clippy) Review prompt for ${item.folderPath}/ copied (${item.files.length} files)!`, 3000);
  });

  // Open Summary Panel
  const openSummaryCmd = vscode.commands.registerCommand('aicodetracker.openSummary', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const result = await gitDiffProvider.getAllChangedFiles(workspaceFolders[0].uri.fsPath);
    if (!result || result.files.length === 0) {
      vscode.window.setStatusBarMessage('$(info) No changes to summarize', 3000);
      return;
    }

    // Fetch diffs for all files
    const diffs = new Map<string, string>();
    await Promise.all(result.files.map(async (file) => {
      try {
        const diff = await gitDiffProvider.getFileDiff(file.relativePath, result.gitRoot);
        diffs.set(file.relativePath, diff);
      } catch {
        // skip
      }
    }));

    summaryPanel.show(result.files, result.gitRoot, diffs);
  });

  // Update tree view badge when data changes
  const updateBadge = () => {
    const fileCount = changesTreeProvider.getFileCount();
    const reviewed = changesTreeProvider.getReviewedCount();
    const pending = fileCount - reviewed;
    treeView.badge = pending > 0
      ? { value: pending, tooltip: `${pending} file${pending !== 1 ? 's' : ''} pending review` }
      : undefined;
  };
  reviewManager.onDidChange(updateBadge);
  // Refresh badge after tree updates
  const origUpdateData = changesTreeProvider.updateData.bind(changesTreeProvider);
  changesTreeProvider.updateData = async () => {
    await origUpdateData();
    updateBadge();
  };

  // ── Event Listeners ───────────────────────────────────────

  const editorChanged = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      debouncedUpdate(editor);
    }
  });

  const fileSaved = vscode.workspace.onDidSaveTextDocument((doc) => {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === doc.uri.toString()
    );
    if (editor) {
      debouncedUpdate(editor);
    }
    debouncedTreeUpdate();
  });

  const windowState = vscode.window.onDidChangeWindowState((e) => {
    if (e.focused) {
      for (const editor of vscode.window.visibleTextEditors) {
        debouncedUpdate(editor);
      }
      debouncedTreeUpdate();
    }
  });

  const configChanged = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('aicodetracker')) {
      isEnabled = vscode.workspace.getConfiguration('aicodetracker').get('enabled', true);
      decorationManager.recreateDecorationTypes();
      updateStatusBar();
      for (const editor of vscode.window.visibleTextEditors) {
        debouncedUpdate(editor);
      }
    }
  });

  const docChanged = vscode.workspace.onDidChangeTextDocument((e) => {
    const editor = vscode.window.visibleTextEditors.find(
      (ed) => ed.document.uri.toString() === e.document.uri.toString()
    );
    if (editor) {
      debouncedUpdate(editor);
    }
  });

  const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  fsWatcher.onDidCreate(() => debouncedTreeUpdate());
  fsWatcher.onDidDelete(() => debouncedTreeUpdate());

  // ── Subscriptions ─────────────────────────────────────────

  context.subscriptions.push(
    treeView,
    toggleCmd,
    refreshCmd,
    openFileCmd,
    openDiffCmd,
    markReviewedCmd,
    markReviewedTreeCmd,
    markFlaggedCmd,
    markFlaggedTreeCmd,
    resetReviewsCmd,
    copyForReviewCmd,
    copyForReviewTreeCmd,
    copyAllForReviewCmd,
    openSummaryCmd,
    markFolderReviewedCmd,
    markFolderFlaggedCmd,
    copyFolderForReviewCmd,
    editorChanged,
    fileSaved,
    windowState,
    configChanged,
    docChanged,
    fsWatcher,
    statusBarItem,
    { dispose: () => gitDiffProvider.dispose() },
    { dispose: () => decorationManager.dispose() },
    { dispose: () => changesTreeProvider.dispose() },
    { dispose: () => reviewManager.dispose() },
    { dispose: () => summaryPanel.dispose() },
  );

  // Initial load
  if (vscode.window.activeTextEditor) {
    debouncedUpdate(vscode.window.activeTextEditor);
  }
  changesTreeProvider.updateData();
}

function updateStatusBar() {
  statusBarItem.text = isEnabled ? '$(eye) AICodeTracker: ON' : '$(eye-closed) AICodeTracker: OFF';
  statusBarItem.tooltip = 'Click to toggle AICodeTracker highlights';
}

function debouncedUpdate(editor: vscode.TextEditor) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    updateDecorations(editor);
  }, 300);
}

function debouncedTreeUpdate() {
  if (treeDebounceTimer) {
    clearTimeout(treeDebounceTimer);
  }
  treeDebounceTimer = setTimeout(() => {
    changesTreeProvider.updateData();
  }, 500);
}

async function updateDecorations(editor: vscode.TextEditor) {
  if (!isEnabled) {
    decorationManager.clearDecorations(editor);
    return;
  }

  if (editor.document.uri.scheme !== 'file') {
    return;
  }

  try {
    const filePath = editor.document.uri.fsPath;
    const changes = await gitDiffProvider.getChangesForFile(filePath);
    decorationManager.applyDecorations(editor, changes);
  } catch {
    // Silently fail
  }
}

export function deactivate() {
  // Cleanup handled by subscriptions
}
// Filesystem watcher
