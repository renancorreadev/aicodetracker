<h1 align="center">AICodeTracker</h1>

<p align="center">
  <strong>See what AI wrote. Review what matters.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=renancorrea.aicodetracker">
    <img src="https://img.shields.io/visual-studio-marketplace/v/renancorrea.aicodetracker?style=flat-square&label=VS%20Code%20Marketplace&color=007acc" alt="Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=renancorrea.aicodetracker">
    <img src="https://img.shields.io/visual-studio-marketplace/i/renancorrea.aicodetracker?style=flat-square&label=Installs&color=4caf50" alt="Installs">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
</p>

<p align="center">
  AI coding tools like Copilot, Cursor, and Claude write code fast — but <strong>are you reviewing what they write?</strong><br>
  AICodeTracker highlights every line that changed since your last commit, so you can see exactly what AI generated and review it with confidence.
</p>

---

## The Problem

AI assistants generate hundreds of lines in seconds. You accept the changes, move on, and ship. But did you actually **read** what was written? Did the AI introduce a security flaw? A subtle logic bug? An unnecessary dependency?

**AICodeTracker makes AI-generated code visible** so you never blindly ship code you didn't review.

---

## Features

### Inline Highlights

Lines added since the last commit glow **green**. Modified lines glow **blue**. Deleted lines show a **red gutter marker**. A thick colored border on the left edge makes changes impossible to miss.

- Works automatically on every file you open
- Colors are subtle enough to code with, visible enough to notice
- Fully customizable via settings

### Before / After Hover

Hover over any modified line to see the **old code vs new code** right in the editor — no need to open a diff view.

- Shows up to 6 lines of context
- Syntax highlighted by language
- Action buttons: **Copy for AI Review**, **Mark Reviewed**, **Flag**

### Sidebar — AI Changes Tree

A dedicated sidebar panel groups all changed files by folder with full review tracking:

- **Session stats** — total files, additions, deletions
- **Progress bar** — visual review progress with percentage
- **Folder grouping** — files organized by directory
- **Mini progress bars** per folder — see which folders still need attention
- **Review states** — mark files as reviewed (green check) or flagged (orange warning)
- **Folder-level actions** — review, flag, or copy an entire folder at once
- **Badge counter** — shows pending files on the sidebar icon
- **Sorting** — unreviewed files appear first

### Changes Summary Dashboard

A rich visual dashboard (webview panel) with:

- **Metric cards** — files changed, lines added, lines removed, review %
- **Animated progress bar** with shimmer effect
- **Filter pills** — All, Added, Modified, Needs Review, Flagged
- **Expandable file cards** — click to reveal the colored diff inline
- **Per-file actions** — copy for review, mark reviewed, flag, open
- **Fully themed** — adapts perfectly to dark and light modes

### Copy for AI Review

One click generates a **senior-engineer-level code review prompt** and copies it to your clipboard. Paste it into ChatGPT, Claude, Gemini, or any AI:

- **Per block** — from hover, copies the specific code block with context
- **Per file** — from the sidebar, copies diff + full file content
- **Per folder** — copies all files in a folder
- **All files** — copies everything that changed

The generated prompt asks the AI to review for:
1. **Correctness** — logic errors, edge cases, error handling
2. **Security** — injection risks, exposed secrets, access controls
3. **Performance** — unnecessary allocations, O(n^2) patterns, leaks
4. **Maintainability** — readability, naming, complexity
5. **Best practices** — conventions, types, tests

Output is structured with severity levels (`critical` / `warning` / `suggestion`), file locations, and concrete fix suggestions.

---

## Quick Start

1. Install AICodeTracker from the Extensions marketplace
2. Open any project with a git repository
3. Make changes (or let your AI assistant make them)
4. See the highlights appear automatically
5. Open the AICodeTracker sidebar to track your review progress
6. Use **Copy for AI Review** to get a second opinion from any AI

---

## Commands

| Command | Description |
|---------|-------------|
| `AICodeTracker: Toggle Highlights` | Turn highlights on/off |
| `AICodeTracker: Refresh Changes` | Refresh the file tree |
| `AICodeTracker: Open Changes Summary` | Open the dashboard panel |
| `AICodeTracker: Copy All for AI Review` | Copy review prompt for all files |
| `AICodeTracker: Reset All Reviews` | Clear all review progress |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `aicodetracker.enabled` | `true` | Enable or disable highlights |
| `aicodetracker.addedColor` | `rgba(40, 160, 40, 0.10)` | Background color for added lines |
| `aicodetracker.modifiedColor` | `rgba(30, 120, 200, 0.10)` | Background color for modified lines |
| `aicodetracker.deletedIndicatorColor` | `rgba(220, 50, 50, 0.6)` | Gutter indicator for deleted lines |

---

## How It Works

AICodeTracker compares your working tree against `HEAD` (your last commit) using `git diff`. It doesn't track _who_ wrote the code — it tracks _what changed_. This makes it perfect for:

- Reviewing AI-generated code (Copilot, Cursor, Claude, etc.)
- Quick visual scan after large refactors
- Code review preparation before committing
- Onboarding — understanding what changed in a codebase

---

## Roadmap

- [ ] Persist review state across sessions
- [ ] Export review report (Markdown / JSON)
- [ ] Keyboard shortcuts for next/previous change
- [ ] Inline annotations with notes
- [ ] Team sharing — share review progress with teammates
- [ ] Statistics history — track review habits over time

---

## Contributing

Found a bug or have a feature idea? [Open an issue](https://github.com/renancorrea/aicodetracker/issues) on GitHub.

---

## License

MIT — Made by Renan Correa

