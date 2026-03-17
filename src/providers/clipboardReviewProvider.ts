import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitDiffProvider } from './gitDiffProvider';
import { ChangedFile, FileStatus } from '../types';

export class ClipboardReviewProvider {
  constructor(private gitDiffProvider: GitDiffProvider) {}
}

// Builds senior engineer review prompt
