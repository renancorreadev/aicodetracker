import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile, FileStatus } from '../types';
import { ReviewManager } from '../managers/reviewManager';

interface SummaryData {
  files: ChangedFile[];
  gitRoot: string;
  diffs: Map<string, string>;
}

export class SummaryPanel {
  private panel: vscode.WebviewPanel | undefined;
  private data: SummaryData | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private reviewManager: ReviewManager,
  ) {
    reviewManager.onDidChange(() => this.refresh());
  }

  async show(files: ChangedFile[], gitRoot: string, diffs: Map<string, string>): Promise<void> {
    this.data = { files, gitRoot, diffs };
    this.cardIndex = 0;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'aicodetracker.summary',
      'AICodeTracker — Changes Summary',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.iconPath = new vscode.ThemeIcon('graph');

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
    }, null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    this.refresh();
  }

  private refresh(): void {
    if (!this.panel || !this.data) return;
    this.cardIndex = 0;
    this.panel.webview.html = this.buildHtml(this.data);
  }

  private handleMessage(msg: any): void {
    switch (msg.command) {
      case 'openFile':
        vscode.commands.executeCommand('aicodetracker.openFile', msg.filePath);
        break;
      case 'markReviewed':
        this.reviewManager.toggleReviewed(msg.relativePath);
        break;
      case 'markFlagged':
        this.reviewManager.toggleFlagged(msg.relativePath);
        break;
      case 'copyForReview':
        vscode.commands.executeCommand('aicodetracker.copyForReviewTree', {
          file: { absolutePath: msg.filePath, relativePath: msg.relativePath },
        });
        break;
      case 'copyAll':
        vscode.commands.executeCommand('aicodetracker.copyAllForReview');
        break;
      case 'openDiff':
        vscode.commands.executeCommand('aicodetracker.openDiff', {
          file: { absolutePath: msg.filePath, relativePath: msg.relativePath },
        });
        break;
    }
  }

  private buildHtml(data: SummaryData): string {
    const { files, diffs } = data;
    const totalAdd = files.reduce((s, f) => s + f.additions, 0);
    const totalDel = files.reduce((s, f) => s + f.deletions, 0);
    const reviewed = files.filter(f => this.reviewManager.isReviewed(f.relativePath)).length;
    const flagged = files.filter(f => this.reviewManager.isFlagged(f.relativePath)).length;
    const pct = files.length > 0 ? Math.round((reviewed / files.length) * 100) : 0;
    const addedCount = files.filter(f => f.status === FileStatus.Added || f.status === FileStatus.Untracked).length;
    const modifiedCount = files.filter(f => f.status === FileStatus.Modified).length;
    const unreviewedCount = files.length - reviewed;

    const fileCards = files.map(f => this.buildFileCard(f, diffs.get(f.relativePath) || '')).join('\n');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  /* ═══════════════════════════════════════════════════════
     THEME — uses VS Code CSS variables for full dark/light
     ═══════════════════════════════════════════════════════ */
  :root {
    /* Surfaces */
    --bg:        var(--vscode-editor-background);
    --fg:        var(--vscode-editor-foreground);
    --fg-muted:  var(--vscode-descriptionForeground, #888);
    --surface:   var(--vscode-sideBar-background, var(--bg));
    --card:      var(--vscode-editorWidget-background, var(--surface));
    --card-hover:var(--vscode-list-hoverBackground, rgba(128,128,128,0.08));
    --border:    var(--vscode-widget-border, rgba(128,128,128,0.2));
    --border-subtle: var(--vscode-editorGroup-border, rgba(128,128,128,0.12));
    --input-bg:  var(--vscode-input-background, var(--card));
    --focus:     var(--vscode-focusBorder, #007fd4);

    /* Accent */
    --accent:    var(--vscode-textLink-foreground, #4493f8);
    --accent-bg: rgba(68, 147, 248, 0.12);
    --accent-hover: rgba(68, 147, 248, 0.18);

    /* Semantic */
    --green:     #3fb950;
    --green-bg:  rgba(63, 185, 80, 0.12);
    --red:       #f85149;
    --red-bg:    rgba(248, 81, 73, 0.10);
    --blue:      #4493f8;
    --blue-bg:   rgba(68, 147, 248, 0.12);
    --orange:    #d29922;
    --orange-bg: rgba(210, 153, 34, 0.12);
    --purple:    #a371f7;

    /* Typography */
    --font:      var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    --mono:      var(--vscode-editor-font-family, 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace);
    --mono-size: var(--vscode-editor-font-size, 12px);

    /* Radius */
    --r-sm: 6px;
    --r-md: 10px;
    --r-lg: 14px;

    /* Shadows — subtle, theme-aware */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 2px 8px rgba(0,0,0,0.08);
    --shadow-lg: 0 4px 16px rgba(0,0,0,0.12);
  }

  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font);
    font-size: 13px;
    color: var(--fg);
    background: var(--bg);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    padding: 0;
  }

  /* ═══════════════════
     LAYOUT
     ═══════════════════ */
  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 28px 40px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 16px;
  }
  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--green), var(--blue), var(--purple));
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.5px;
    flex-shrink: 0;
    box-shadow: var(--shadow-md);
  }
  .header h1 {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }
  .header h1 small {
    font-size: 12px;
    font-weight: 400;
    color: var(--fg-muted);
    margin-left: 8px;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border-radius: var(--r-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    white-space: nowrap;
  }
  .btn:hover {
    background: var(--card-hover);
    border-color: var(--accent);
    box-shadow: var(--shadow-sm);
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary {
    background: var(--accent);
    border-color: transparent;
    color: #fff;
  }
  .btn-primary:hover {
    opacity: 0.92;
    border-color: transparent;
    box-shadow: 0 2px 10px rgba(68,147,248,0.25);
  }
  .btn-ghost {
    border-color: transparent;
    background: transparent;
    color: var(--fg-muted);
  }
  .btn-ghost:hover { background: var(--card-hover); color: var(--fg); border-color: transparent; }
  .btn-icon {
    width: 30px;
    height: 30px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-sm);
    font-size: 14px;
  }

  /* ═══════════════════
     STATS CARDS
     ═══════════════════ */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  @media (max-width: 600px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--r-md);
    padding: 18px 16px;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: var(--r-md) var(--r-md) 0 0;
  }
  .stat-card:nth-child(1)::before { background: var(--blue); }
  .stat-card:nth-child(2)::before { background: var(--green); }
  .stat-card:nth-child(3)::before { background: var(--red); }
  .stat-card:nth-child(4)::before { background: ${pct === 100 ? 'var(--green)' : 'var(--orange)'}; }
  .stat-card:hover {
    border-color: var(--border);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .stat-value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
  }
  .stat-label {
    font-size: 11px;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-top: 4px;
    font-weight: 500;
  }
  .stat-value.green  { color: var(--green); }
  .stat-value.red    { color: var(--red); }
  .stat-value.blue   { color: var(--blue); }
  .stat-value.orange { color: var(--orange); }

  /* ═══════════════════
     PROGRESS BAR
     ═══════════════════ */
  .progress-section {
    background: var(--card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--r-md);
    padding: 16px 20px;
    margin-bottom: 24px;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .progress-header strong { font-size: 13px; font-weight: 600; }
  .progress-header span { font-size: 12px; color: var(--fg-muted); }
  .progress-track {
    height: 6px;
    background: var(--border-subtle);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--green), var(--blue));
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }
  .progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    animation: shimmer 2s ease-in-out infinite;
  }
  .progress-fill.complete {
    background: var(--green);
  }
  .progress-fill.complete::after { display: none; }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* ═══════════════════
     FILTER BAR
     ═══════════════════ */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .filter-bar {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .filter-btn {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--fg-muted);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .filter-btn:hover {
    border-color: var(--border);
    color: var(--fg);
    background: var(--card-hover);
  }
  .filter-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  .filter-btn .badge {
    font-size: 10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--border-subtle);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .filter-btn.active .badge {
    background: var(--accent);
    color: #fff;
  }

  /* ═══════════════════
     FILE CARDS
     ═══════════════════ */
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .file-card {
    background: var(--card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .file-card:hover {
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }
  .file-card.reviewed {
    border-left: 3px solid var(--green);
  }
  .file-card.flagged {
    border-left: 3px solid var(--orange);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s ease;
  }
  .file-header:hover { background: var(--card-hover); }

  .chevron {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--fg-muted);
    transition: transform 0.2s ease;
    font-size: 10px;
  }
  .file-card.expanded .chevron { transform: rotate(90deg); }

  .file-status-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 7px;
    border-radius: 4px;
    flex-shrink: 0;
    line-height: 1.4;
  }
  .file-status-badge.s-added,
  .file-status-badge.s-new     { background: var(--green-bg); color: var(--green); }
  .file-status-badge.s-modified { background: var(--blue-bg); color: var(--blue); }
  .file-status-badge.s-deleted  { background: var(--red-bg); color: var(--red); }

  .file-meta {
    flex: 1;
    min-width: 0;
  }
  .file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-dir {
    font-size: 11px;
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .line-stats {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .line-stats .add { color: var(--green); }
  .line-stats .sep { color: var(--fg-muted); opacity: 0.4; margin: 0 2px; }
  .line-stats .del { color: var(--red); }

  /* Mini heat bar */
  .heat-bar {
    width: 48px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-subtle);
    overflow: hidden;
    display: flex;
  }
  .heat-bar .seg-add { background: var(--green); border-radius: 2px 0 0 2px; }
  .heat-bar .seg-del { background: var(--red); border-radius: 0 2px 2px 0; }

  .review-indicator {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 100px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .review-indicator.ri-reviewed { background: var(--green-bg); color: var(--green); }
  .review-indicator.ri-flagged  { background: var(--orange-bg); color: var(--orange); }

  .file-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .file-header:hover .file-actions { opacity: 1; }

  /* ── Diff preview ── */
  .file-diff {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .file-card.expanded .file-diff {
    max-height: 500px;
    overflow-y: auto;
    border-top: 1px solid var(--border-subtle);
  }
  .diff-content {
    font-family: var(--mono);
    font-size: var(--mono-size);
    line-height: 1.65;
  }
  .diff-line {
    padding: 0 16px;
    white-space: pre;
    overflow-x: auto;
    min-height: 20px;
  }
  .diff-line.add {
    background: var(--green-bg);
  }
  .diff-line.del {
    background: var(--red-bg);
  }
  .diff-line.hunk {
    color: var(--accent);
    opacity: 0.7;
    padding-top: 6px;
    font-weight: 500;
    font-size: 11px;
  }
  .diff-line.ctx {
    opacity: 0.45;
  }

  /* ═══════════════════
     ANIMATIONS
     ═══════════════════ */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .stat-card, .file-card, .progress-section {
    animation: fadeIn 0.35s ease both;
  }

  /* ── Empty state ── */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--fg-muted);
  }
  .empty-state svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }
  .empty-state p { font-size: 14px; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover { background: var(--fg-muted); }

  /* ── Tooltip ── */
  .file-actions .btn-icon[title]:hover { position: relative; }
</style>
</head>
<body>

<div class="container">
  <!-- Header -->
  <div class="header">
    <div class="header-title">
      <div class="logo">G</div>
      <h1>Changes Summary <small>${files.length} file${files.length !== 1 ? 's' : ''}</small></h1>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" onclick="copyAll()">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>
        Copy All for AI Review
      </button>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card" style="animation-delay:0ms">
      <div class="stat-value blue">${files.length}</div>
      <div class="stat-label">Files Changed</div>
    </div>
    <div class="stat-card" style="animation-delay:60ms">
      <div class="stat-value green">+${totalAdd}</div>
      <div class="stat-label">Lines Added</div>
    </div>
    <div class="stat-card" style="animation-delay:120ms">
      <div class="stat-value red">&minus;${totalDel}</div>
      <div class="stat-label">Lines Removed</div>
    </div>
    <div class="stat-card" style="animation-delay:180ms">
      <div class="stat-value ${pct === 100 ? 'green' : 'orange'}">${pct}<span style="font-size:16px;font-weight:400">%</span></div>
      <div class="stat-label">Reviewed</div>
    </div>
  </div>

  <!-- Progress -->
  <div class="progress-section" style="animation-delay:200ms">
    <div class="progress-header">
      <strong>Review Progress</strong>
      <span>${reviewed} of ${files.length} reviewed${flagged > 0 ? ` &middot; <span style="color:var(--orange)">${flagged} flagged</span>` : ''}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill ${pct === 100 ? 'complete' : ''}" style="width:${pct}%"></div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterFiles('all',this)">All <span class="badge">${files.length}</span></button>
      <button class="filter-btn" onclick="filterFiles('added',this)">Added <span class="badge">${addedCount}</span></button>
      <button class="filter-btn" onclick="filterFiles('modified',this)">Modified <span class="badge">${modifiedCount}</span></button>
      <button class="filter-btn" onclick="filterFiles('unreviewed',this)">Needs Review <span class="badge">${unreviewedCount}</span></button>
      ${flagged > 0 ? `<button class="filter-btn" onclick="filterFiles('flagged',this)">Flagged <span class="badge">${flagged}</span></button>` : ''}
    </div>
  </div>

  <!-- File list -->
  <div class="file-list" id="fileList">
    ${fileCards}
  </div>

  ${files.length === 0 ? `
  <div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <p>No changes detected. All clean!</p>
  </div>` : ''}
</div>

<script>
  const vscode = acquireVsCodeApi();

  function toggleExpand(el) {
    el.closest('.file-card').classList.toggle('expanded');
  }
  function openFile(p) { vscode.postMessage({command:'openFile',filePath:p}); }
  function openDiff(p,r) { vscode.postMessage({command:'openDiff',filePath:p,relativePath:r}); }
  function markReviewed(r,e) { e.stopPropagation(); vscode.postMessage({command:'markReviewed',relativePath:r}); }
  function markFlagged(r,e) { e.stopPropagation(); vscode.postMessage({command:'markFlagged',relativePath:r}); }
  function copyForReview(p,r,e) { e.stopPropagation(); vscode.postMessage({command:'copyForReview',filePath:p,relativePath:r}); }
  function copyAll() { vscode.postMessage({command:'copyAll'}); }

  function filterFiles(f, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.file-card').forEach(c => {
      const s = c.dataset.status, rv = c.dataset.reviewed==='true', fl = c.dataset.flagged==='true';
      let show = true;
      if (f==='added') show = s==='A'||s==='?';
      else if (f==='modified') show = s==='M';
      else if (f==='unreviewed') show = !rv;
      else if (f==='flagged') show = fl;
      c.style.display = show ? '' : 'none';
    });
  }
</script>
</body>
</html>`;
  }

  private buildFileCard(file: ChangedFile, diff: string): string {
    const isReviewed = this.reviewManager.isReviewed(file.relativePath);
    const isFlagged = this.reviewManager.isFlagged(file.relativePath);
    const statusLabel = this.getStatusLabel(file.status);
    const statusClass = this.getStatusClass(file.status);
    const fileName = path.basename(file.relativePath);
    const dirPath = path.dirname(file.relativePath);
    const total = file.additions + file.deletions;
    const addPct = total > 0 ? (file.additions / total) * 100 : 0;
    const delPct = total > 0 ? (file.deletions / total) * 100 : 0;
    const idx = this.cardIndex++;
    const diffHtml = this.renderDiffHtml(diff);

    return /* html */ `
    <div class="file-card ${isReviewed ? 'reviewed' : ''} ${isFlagged ? 'flagged' : ''}"
         data-status="${file.status}" data-reviewed="${isReviewed}" data-flagged="${isFlagged}"
         style="animation-delay:${240 + idx * 30}ms">
      <div class="file-header" onclick="toggleExpand(this)">
        <span class="chevron">&#x25B6;</span>
        <span class="file-status-badge s-${statusClass}">${statusLabel}</span>
        <div class="file-meta">
          <div class="file-name">${this.escHtml(fileName)}</div>
          ${dirPath !== '.' ? `<div class="file-dir">${this.escHtml(dirPath)}/</div>` : ''}
        </div>
        <div class="file-right">
          ${isReviewed ? '<span class="review-indicator ri-reviewed">Reviewed</span>' : ''}
          ${isFlagged ? '<span class="review-indicator ri-flagged">Flagged</span>' : ''}
          <div class="line-stats">
            <span class="add">+${file.additions}</span>
            <span class="sep">/</span>
            <span class="del">&minus;${file.deletions}</span>
          </div>
          <div class="heat-bar">
            <div class="seg-add" style="width:${addPct}%"></div>
            <div class="seg-del" style="width:${delPct}%"></div>
          </div>
          <div class="file-actions">
            <button class="btn btn-ghost btn-icon" onclick="copyForReview('${this.esc(file.absolutePath)}','${this.esc(file.relativePath)}',event)" title="Copy for AI Review">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="markReviewed('${this.esc(file.relativePath)}',event)" title="Mark reviewed">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="markFlagged('${this.esc(file.relativePath)}',event)" title="Flag for attention">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.458 1.458 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25v-9.5zM1.75 1.5a.25.25 0 00-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h6.5a.25.25 0 00.25-.25v-9.5a.25.25 0 00-.25-.25H1.75z"/><path d="M8 4a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 018 4zm0 5.5a.75.75 0 100 1.5.75.75 0 000-1.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="openFile('${this.esc(file.absolutePath)}')" title="Open file">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm4.22-1.72a.75.75 0 011.06 0L8 7.5l1.22-1.22a.75.75 0 111.06 1.06l-1.75 1.75a.75.75 0 01-1.06 0L5.72 7.34a.75.75 0 010-1.06z"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="file-diff">
        <div class="diff-content">${diffHtml}</div>
      </div>
    </div>`;
  }

  private cardIndex = 0;

  private renderDiffHtml(diff: string): string {
    if (!diff.trim()) {
      return '<div class="diff-line ctx" style="padding:12px 16px;color:var(--fg-muted)">No diff available</div>';
    }

    return diff.split('\n').map(line => {
      const escaped = this.escHtml(line);
      if (line.startsWith('@@')) return `<div class="diff-line hunk">${escaped}</div>`;
      if (line.startsWith('+') && !line.startsWith('+++')) return `<div class="diff-line add">${escaped}</div>`;
      if (line.startsWith('-') && !line.startsWith('---')) return `<div class="diff-line del">${escaped}</div>`;
      if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) return '';
      return `<div class="diff-line ctx">${escaped}</div>`;
    }).join('\n');
  }

  private esc(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private escHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getStatusLabel(status: FileStatus): string {
    switch (status) {
      case FileStatus.Added: return 'Added';
      case FileStatus.Modified: return 'Modified';
      case FileStatus.Deleted: return 'Deleted';
      case FileStatus.Renamed: return 'Renamed';
      case FileStatus.Untracked: return 'New';
      default: return 'Changed';
    }
  }

  private getStatusClass(status: FileStatus): string {
    switch (status) {
      case FileStatus.Added: return 'added';
      case FileStatus.Modified: return 'modified';
      case FileStatus.Deleted: return 'deleted';
      case FileStatus.Untracked: return 'new';
      default: return 'modified';
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
// Message handling for all actions
