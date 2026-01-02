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

/** Project configuration interface */
interface ProjectConfig {
  name: string;
  path: string;
  logFile?: string;
}

/** Watched project state */
interface WatchedProject {
  name: string;
  path: string;
  logFile: string;
  watcher: fs.FSWatcher | null;
  lastSize: number;
}

/**
 * Multi-Project Watcher
 *
 * Watches log files from multiple projects simultaneously and
 * merges them into a unified timeline in the panel.
 */
class MultiProjectWatcher {
  private projects: Map<string, WatchedProject> = new Map();
  private panel: AllpPanel;

  constructor(panel: AllpPanel) {
    this.panel = panel;
  }

  /**
   * Start watching all configured projects
   */
  watchProjects(projectConfigs: ProjectConfig[]): void {
    // Stop any existing watchers
    this.stopAll();

    // Start watching each project
    for (const config of projectConfigs) {
      this.watchProject(config);
    }
  }

  /**
   * Watch a single project's log file
   */
  private watchProject(config: ProjectConfig): void {
    const logFile = config.logFile || '.beads/events.log';
    const logPath = path.join(config.path, logFile);

    if (!fs.existsSync(logPath)) {
      console.log(`ALLP: Log file not found for ${config.name}: ${logPath}`);
      // Watch for file creation
      const logDir = path.dirname(logPath);
      if (fs.existsSync(logDir)) {
        const watcher = fs.watch(logDir, (eventType, filename) => {
          if (filename === path.basename(logPath) && eventType === 'rename') {
            // File was created, start watching it
            console.log(`ALLP: Log file created for ${config.name}, starting watch`);
            this.watchProject(config);
          }
        });
        this.projects.set(config.name, {
          name: config.name,
          path: config.path,
          logFile: logPath,
          watcher,
          lastSize: 0,
        });
      }
      return;
    }

    const stats = fs.statSync(logPath);
    const project: WatchedProject = {
      name: config.name,
      path: config.path,
      logFile: logPath,
      watcher: null,
      lastSize: stats.size,
    };

    // Load existing lines
    this.loadExistingLines(project);

    // Watch for changes
    project.watcher = fs.watch(logPath, (eventType) => {
      if (eventType === 'change') {
        this.readNewLines(project);
      }
    });

    this.projects.set(config.name, project);
    console.log(`ALLP: Watching ${config.name} at ${logPath}`);
  }

  /**
   * Load existing lines from a project's log file
   */
  private loadExistingLines(project: WatchedProject): void {
    const rl = readline.createInterface({
      input: fs.createReadStream(project.logFile),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        this.panel.addLogLine(line, project.name, project.path);
      }
    });
  }

  /**
   * Read new lines appended to a project's log file
   */
  private readNewLines(project: WatchedProject): void {
    try {
      const stats = fs.statSync(project.logFile);
      if (stats.size <= project.lastSize) {
        // File was truncated or unchanged
        if (stats.size < project.lastSize) {
          // File was truncated, reload
          console.log(`ALLP: Log file truncated for ${project.name}, reloading`);
          project.lastSize = 0;
          this.loadExistingLines(project);
        }
        return;
      }

      // Read only new content
      const stream = fs.createReadStream(project.logFile, {
        start: project.lastSize,
        end: stats.size,
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (line.trim()) {
          this.panel.addLogLine(line, project.name, project.path);
        }
      });

      project.lastSize = stats.size;
    } catch (err) {
      console.error(`ALLP: Error reading new lines for ${project.name}:`, err);
    }
  }

  /**
   * Stop watching all projects
   */
  stopAll(): void {
    for (const project of this.projects.values()) {
      if (project.watcher) {
        project.watcher.close();
      }
    }
    this.projects.clear();
  }
}

/** Active multi-project watcher */
let multiWatcher: MultiProjectWatcher | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('ALLP extension activated');

  // Register beads adapter
  registerAdapter(BeadsAdapter);

  // Command: Show log viewer with live file watching
  const showViewerCmd = vscode.commands.registerCommand('allp.showViewer', () => {
    const panel = AllpPanel.createOrShow(context.extensionUri, context);

    // Get configured projects from settings
    const config = vscode.workspace.getConfiguration('allp');
    const projects = config.get<ProjectConfig[]>('projects', []);

    if (projects.length > 0) {
      // Use multi-project watcher
      multiWatcher = new MultiProjectWatcher(panel);
      multiWatcher.watchProjects(projects);
      console.log(`ALLP: Watching ${projects.length} configured project(s)`);
    } else {
      // Fall back to current workspace if no projects configured
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const defaultProject: ProjectConfig = {
          name: path.basename(workspaceFolders[0].uri.fsPath),
          path: workspaceFolders[0].uri.fsPath,
        };
        multiWatcher = new MultiProjectWatcher(panel);
        multiWatcher.watchProjects([defaultProject]);
        console.log('ALLP: No projects configured, watching current workspace');
      }
    }
  });

  // Command: Show viewer with mock data (for testing)
  const showMockCmd = vscode.commands.registerCommand('allp.showWithMockData', () => {
    const panel = AllpPanel.createOrShow(context.extensionUri, context);

    // Add mock lines with slight delay to simulate streaming
    let index = 0;
    const interval = setInterval(() => {
      if (index < MOCK_BEADS_LINES.length) {
        panel.addLogLine(MOCK_BEADS_LINES[index], 'mock-project', 'C:\\mock');
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
  if (multiWatcher) {
    multiWatcher.stopAll();
    multiWatcher = null;
  }
}
