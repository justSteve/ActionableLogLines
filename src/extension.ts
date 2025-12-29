/**
 * ALLP VS Code Extension Entry Point
 *
 * Registers commands and activates the log viewer.
 */

import * as vscode from 'vscode';
import { AllpPanel } from './renderer/panel';

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

export function activate(context: vscode.ExtensionContext) {
  console.log('ALLP extension activated');

  // Command: Show log viewer
  const showViewerCmd = vscode.commands.registerCommand('allp.showViewer', () => {
    AllpPanel.createOrShow(context.extensionUri);
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

  // Auto-show if .beads folder exists and configured
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    // Could auto-activate here based on config
    // For now, just register the commands
  }
}

export function deactivate() {
  console.log('ALLP extension deactivated');
}
