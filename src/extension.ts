/**
 * ALLP VS Code Extension Entry Point
 *
 * Registers commands and activates the log viewer.
 * Watches .beads/events.log for real-time event streaming.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AllpPanel } from './renderer/panel';
import { registerAdapter, BeadsAdapter } from './adapters';

/** Mock beads log lines for testing */
const MOCK_BEADS_LINES = [
  '2025-01-15T15:04:02.123Z|sk.bootup.activated|none|steve|sess-abc123|skill=beads-bootup',
  '2025-01-15T15:04:03.456Z|bd.issue.create|bd-97ux|steve|sess-abc123|title=Implement ALLP',
  '2025-01-15T15:04:05.789Z|bd.issue.update|bd-97ux|steve|sess-abc123|status=in_progress',
  '2025-01-15T15:04:10.012Z|gt.commit|bd-97ux|steve|sess-abc123|hash=abc1234',
  '2025-01-15T15:04:12.345Z|sk.skill.complete|none|steve|sess-abc123|skill=test-driven-development',
  '2025-01-15T15:04:15.678Z|bd.issue.close|bd-97ux|steve|sess-abc123|reason=completed',
  '2025-01-15T15:04:20.901Z|ss.session.end|none|steve|sess-abc123|duration=18s',
  '2025-01-15T15:05:01.234Z|ep.epoch.start|none|system|sess-def456|version=1.0.0',
  '2025-01-15T15:05:02.567Z|bd.issue.create|bd-vnlh|steve|sess-def456|title=ALLP VS Code Integration',
  '2025-01-15T15:05:05.890Z|hk.hook.trigger|bd-vnlh|system|sess-def456|hook=pre-commit',
  '2025-01-15T15:05:08.123Z|gd.guard.pass|bd-vnlh|system|sess-def456|check=branch-protection',
  'This is a plain text line that should show as unparsed',
  '2025-01-15T15:05:10.456Z|bd.dep.add|bd-vnlh|steve|sess-def456|depends_on=bd-97ux',
];

/** Active file watcher */
let fileWatcher: fs.FSWatcher | null = null;
let lastFileSize = 0;

/**
 * Watch .beads/events.log and stream new lines to the panel
 */
function watchEventsLog(panel: AllpPanel, workspaceRoot: string): void {
  const eventsPath = path.join(workspaceRoot, '.beads', 'events.log');

  // Stop existing watcher if any
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  // Check if file exists
  if (!fs.existsSync(eventsPath)) {
    console.log('ALLP: .beads/events.log not found, waiting for creation...');
    // Watch for file creation
    const beadsDir = path.join(workspaceRoot, '.beads');
    if (fs.existsSync(beadsDir)) {
      fileWatcher = fs.watch(beadsDir, (eventType, filename) => {
        if (filename === 'events.log' && eventType === 'rename') {
          // File was created, start watching it
          watchEventsLog(panel, workspaceRoot);
        }
      });
    }
    return;
  }

  // Get initial file size
  const stats = fs.statSync(eventsPath);
  lastFileSize = stats.size;

  // Load existing lines
  loadExistingLines(panel, eventsPath);

  // Watch for changes
  fileWatcher = fs.watch(eventsPath, (eventType) => {
    if (eventType === 'change') {
      readNewLines(panel, eventsPath);
    }
  });

  console.log('ALLP: Watching', eventsPath);
}

/**
 * Load existing lines from events.log
 */
function loadExistingLines(panel: AllpPanel, filePath: string): void {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    if (line.trim()) {
      panel.addLogLine(line);
    }
  });
}

/**
 * Read new lines appended to the file
 */
function readNewLines(panel: AllpPanel, filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size <= lastFileSize) {
      // File was truncated or unchanged
      if (stats.size < lastFileSize) {
        // File was truncated, reload
        lastFileSize = 0;
        loadExistingLines(panel, filePath);
      }
      return;
    }

    // Read only new content
    const stream = fs.createReadStream(filePath, {
      start: lastFileSize,
      end: stats.size,
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        panel.addLogLine(line);
      }
    });

    lastFileSize = stats.size;
  } catch (err) {
    console.error('ALLP: Error reading new lines:', err);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('ALLP extension activated');

  // Register beads adapter
  registerAdapter(BeadsAdapter);

  // Command: Show log viewer with live file watching
  const showViewerCmd = vscode.commands.registerCommand('allp.showViewer', () => {
    const panel = AllpPanel.createOrShow(context.extensionUri);

    // Start watching events.log if in a beads workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      watchEventsLog(panel, workspaceFolders[0].uri.fsPath);
    }
  });

  // Command: Show viewer with mock data (for testing)
  const showMockCmd = vscode.commands.registerCommand('allp.showWithMockData', () => {
    const panel = AllpPanel.createOrShow(context.extensionUri);

    // Add mock lines with slight delay to simulate streaming
    let index = 0;
    const interval = setInterval(() => {
      if (index < MOCK_BEADS_LINES.length) {
        panel.addLogLine(MOCK_BEADS_LINES[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 200);
  });

  context.subscriptions.push(showViewerCmd, showMockCmd);

  // Auto-activate if .beads folder exists
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const beadsDir = path.join(workspaceFolders[0].uri.fsPath, '.beads');
    if (fs.existsSync(beadsDir)) {
      console.log('ALLP: Beads workspace detected, ready to show viewer');
    }
  }
}

export function deactivate() {
  console.log('ALLP extension deactivated');
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}
