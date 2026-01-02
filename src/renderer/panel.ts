/**
 * VS Code WebView Panel for ALLP
 *
 * Split-pane UI:
 * - Top: Response panel (fixed)
 * - Bottom: Streaming log (scrolls independently)
 */

import * as vscode from 'vscode';
import type { ActionableLogLine, RendererConfig } from '../protocol';
import { DEFAULT_RENDERER_CONFIG } from '../protocol';
import { getRegistry } from '../adapters';
import { interpret } from '../interpreter';

/**
 * Message types for WebView communication
 */
interface WebViewMessage {
  type: 'logLine' | 'expansion' | 'queryResult' | 'clear' | 'config' | 'filterState';
  payload: unknown;
}

/**
 * ALLP Panel manages the WebView
 */
export class AllpPanel {
  public static currentPanel: AllpPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private config: RendererConfig;
  private disposables: vscode.Disposable[] = [];
  private selectedLine: ActionableLogLine | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    config: RendererConfig
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.context = context;
    this.config = config;

    // Set up the WebView content
    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from WebView
    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private context: vscode.ExtensionContext;

  /**
   * Create or show the panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    config: RendererConfig = DEFAULT_RENDERER_CONFIG
  ): AllpPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, show it
    if (AllpPanel.currentPanel) {
      AllpPanel.currentPanel.panel.reveal(column);
      return AllpPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'allpViewer',
      'ALLP Log Viewer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    AllpPanel.currentPanel = new AllpPanel(panel, extensionUri, context, config);
    return AllpPanel.currentPanel;
  }

  /**
   * Add a log line to the viewer
   */
  public addLogLine(rawLine: string, projectName: string, projectPath: string): void {
    const registry = getRegistry();
    const parsed = registry.parse(rawLine);

    this.postMessage({
      type: 'logLine',
      payload: {
        raw: rawLine,
        parsed: parsed ? {
          timestamp: parsed.timestamp,
          message: parsed.message,
          sourceType: parsed.source.type,
          sourceId: parsed.source.id,
        } : null,
        project: {
          name: projectName,
          path: projectPath,
        },
      },
    });
  }

  /**
   * Handle line selection from WebView
   */
  private async handleLineSelect(lineIndex: number, rawLine: string): Promise<void> {
    const registry = getRegistry();
    const parsed = registry.parse(rawLine);

    if (!parsed) {
      this.postMessage({
        type: 'expansion',
        payload: { content: 'Unable to parse log line', suggestions: [] },
      });
      return;
    }

    this.selectedLine = parsed;
    const expansion = await parsed.getDefaultExpansion();

    this.postMessage({
      type: 'expansion',
      payload: expansion,
    });
  }

  /**
   * Handle query from WebView
   */
  private async handleQuery(input: string): Promise<void> {
    if (!this.selectedLine) {
      this.postMessage({
        type: 'queryResult',
        payload: { content: 'No log line selected', error: true },
      });
      return;
    }

    const result = await interpret(this.selectedLine, input);

    this.postMessage({
      type: 'queryResult',
      payload: {
        content: result.content,
        error: !result.handled && !!result.error,
        errorMessage: result.error,
      },
    });
  }

  /**
   * Handle messages from WebView
   */
  private handleMessage(message: { type: string; payload: unknown }): void {
    switch (message.type) {
      case 'selectLine':
        const { index, raw } = message.payload as { index: number; raw: string };
        this.handleLineSelect(index, raw);
        break;
      case 'query':
        const { input } = message.payload as { input: string };
        this.handleQuery(input);
        break;
      case 'ready':
        // WebView is ready, send config and filter state
        this.postMessage({ type: 'config', payload: this.config });
        const savedState = this.context.workspaceState.get<Record<string, boolean>>('allp.filterState', {});
        this.postMessage({ type: 'filterState', payload: savedState });
        break;
      case 'saveFilterState':
        // Save filter state to workspace
        const state = message.payload as Record<string, boolean>;
        this.context.workspaceState.update('allp.filterState', state);
        break;
    }
  }

  /**
   * Post message to WebView
   */
  private postMessage(message: WebViewMessage): void {
    this.panel.webview.postMessage(message);
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    AllpPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  /**
   * Generate HTML content for WebView
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALLP Log Viewer</title>
  <style>
    :root {
      --response-height: 200px;
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --accent: var(--vscode-textLink-foreground);
      --hover-bg: var(--vscode-list-hoverBackground);
      --selected-bg: var(--vscode-list-activeSelectionBackground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background: var(--bg-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Response Panel (fixed top) */
    #response-panel {
      height: var(--response-height);
      min-height: 100px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #response-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
    }

    #response-content .empty {
      color: var(--text-secondary);
      font-style: italic;
    }

    /* Query Input */
    #query-bar {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-primary);
      border-top: 1px solid var(--border-color);
    }

    #query-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-font-size);
    }

    #query-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    #query-submit {
      padding: 6px 16px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    #query-submit:hover {
      opacity: 0.9;
    }

    #suggestions {
      padding: 4px 12px;
      font-size: 0.85em;
      color: var(--text-secondary);
    }

    #suggestions span {
      cursor: pointer;
      margin-right: 8px;
    }

    #suggestions span:hover {
      color: var(--accent);
      text-decoration: underline;
    }

    /* Filter Panel */
    #filter-panel {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.9em;
    }

    #filter-panel.collapsed {
      display: none;
    }

    #filter-label {
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
    }

    #filter-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #filter-sort {
      padding: 2px 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      font-size: 0.85em;
      cursor: pointer;
    }

    #filter-projects {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .project-checkbox {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .project-checkbox:hover {
      background: var(--hover-bg);
    }

    .project-checkbox input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }

    .project-checkbox label {
      cursor: pointer;
      user-select: none;
      font-size: 0.85em;
    }

    .project-checkbox .count {
      color: var(--text-secondary);
      font-size: 0.8em;
      margin-left: 4px;
    }

    #filter-toggle {
      padding: 2px 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      white-space: nowrap;
    }

    #filter-toggle:hover {
      background: var(--hover-bg);
    }

    /* Log Panel (scrolling bottom) */
    #log-panel {
      flex: 1;
      overflow-y: auto;
      font-family: var(--vscode-editor-font-family);
    }

    .log-line {
      display: flex;
      padding: 4px 12px;
      cursor: pointer;
      border-bottom: 1px solid transparent;
    }

    .log-line:hover {
      background: var(--hover-bg);
    }

    .log-line.selected {
      background: var(--selected-bg);
    }

    .log-line .marker {
      width: 20px;
      color: var(--accent);
      flex-shrink: 0;
    }

    .log-line .timestamp {
      width: 90px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .log-line .message {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .log-line .source {
      width: 80px;
      color: var(--text-secondary);
      text-align: right;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div id="response-panel">
    <div id="response-content">
      <span class="empty">Click a log line to see details...</span>
    </div>
    <div id="suggestions"></div>
    <div id="query-bar">
      <input type="text" id="query-input" placeholder="Enter command or question...">
      <button id="query-submit">Query</button>
    </div>
  </div>

  <div id="filter-panel">
    <div id="filter-label">Projects:</div>
    <div id="filter-controls">
      <select id="filter-sort">
        <option value="recent">Most Recent</option>
        <option value="alpha">Alphabetical</option>
      </select>
      <button id="filter-toggle">Hide Filters</button>
    </div>
    <div id="filter-projects"></div>
  </div>

  <div id="log-panel"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const logPanel = document.getElementById('log-panel');
    const responseContent = document.getElementById('response-content');
    const suggestions = document.getElementById('suggestions');
    const queryInput = document.getElementById('query-input');
    const querySubmit = document.getElementById('query-submit');
    const filterPanel = document.getElementById('filter-panel');
    const filterProjects = document.getElementById('filter-projects');
    const filterSort = document.getElementById('filter-sort');
    const filterToggle = document.getElementById('filter-toggle');

    let lines = [];
    let selectedIndex = -1;
    let config = {};
    let queryHistory = [];
    let historyIndex = -1;
    let projects = new Map(); // Track projects: name -> { name, path, count, lastTimestamp }
    let filterState = {}; // Saved filter state: projectName -> visible

    // Handle messages from extension
    window.addEventListener('message', event => {
      const { type, payload } = event.data;

      switch (type) {
        case 'logLine':
          addLogLine(payload);
          break;
        case 'expansion':
          showExpansion(payload);
          break;
        case 'queryResult':
          showQueryResult(payload);
          break;
        case 'config':
          config = payload;
          applyConfig();
          break;
        case 'filterState':
          filterState = payload;
          applyFilterState();
          break;
        case 'clear':
          clearLog();
          break;
      }
    });

    function addLogLine(payload) {
      const { raw, parsed, project } = payload;
      const index = lines.length;
      lines.push({ raw, parsed, project, visible: true });

      // Track project metadata
      let projectAdded = false;
      if (project && project.name) {
        const existing = projects.get(project.name);
        const timestamp = parsed ? parsed.timestamp : new Date().toISOString();
        if (existing) {
          existing.count++;
          existing.lastTimestamp = timestamp;
        } else {
          // Apply saved filter state if available, otherwise default to visible
          const visible = filterState.hasOwnProperty(project.name) ? filterState[project.name] : true;
          projects.set(project.name, {
            name: project.name,
            path: project.path,
            count: 1,
            lastTimestamp: timestamp,
            visible: visible,
          });
          projectAdded = true;
        }
      }

      const el = document.createElement('div');
      el.className = 'log-line';
      el.dataset.index = index;

      if (parsed) {
        el.innerHTML = \`
          <span class="marker">▶</span>
          <span class="timestamp">\${formatTime(parsed.timestamp)}</span>
          <span class="message">\${escapeHtml(parsed.message)}</span>
          <span class="source">\${escapeHtml(parsed.sourceType)}</span>
        \`;
      } else {
        el.innerHTML = \`
          <span class="marker">○</span>
          <span class="message" style="color: var(--text-secondary)">\${escapeHtml(raw)}</span>
        \`;
      }

      // Apply project visibility filter
      if (project && project.name) {
        const projectInfo = projects.get(project.name);
        if (projectInfo && !projectInfo.visible) {
          el.style.display = 'none';
        }
      }

      el.addEventListener('click', () => selectLine(index));
      logPanel.appendChild(el);

      // Auto-scroll if enabled and at bottom
      if (config.autoScroll) {
        const atBottom = logPanel.scrollHeight - logPanel.scrollTop - logPanel.clientHeight < 50;
        if (atBottom) {
          logPanel.scrollTop = logPanel.scrollHeight;
        }
      }

      // Update filter panel if a new project was added
      if (projectAdded) {
        renderFilterPanel();
      }
    }

    function selectLine(index) {
      // Update selection UI
      document.querySelectorAll('.log-line.selected').forEach(el => el.classList.remove('selected'));
      const el = document.querySelector(\`.log-line[data-index="\${index}"]\`);
      if (el) el.classList.add('selected');

      selectedIndex = index;
      const line = lines[index];

      // Request expansion from extension
      vscode.postMessage({
        type: 'selectLine',
        payload: { index, raw: line.raw }
      });
    }

    function showExpansion(payload) {
      responseContent.innerHTML = formatContent(payload.content);
      if (payload.suggestions && payload.suggestions.length > 0) {
        suggestions.innerHTML = 'try: ' + payload.suggestions.map(s =>
          \`<span onclick="insertSuggestion('\${s}')">\${s}</span>\`
        ).join('');
      } else {
        suggestions.innerHTML = '';
      }
      queryInput.focus();
    }

    function showQueryResult(payload) {
      if (payload.error) {
        responseContent.innerHTML = \`<span style="color: var(--vscode-errorForeground)">\${escapeHtml(payload.errorMessage || payload.content)}</span>\`;
      } else {
        responseContent.innerHTML = formatContent(payload.content);
      }
    }

    function submitQuery() {
      const input = queryInput.value.trim();
      if (!input) return;

      // Add to history (avoid duplicates at end)
      if (queryHistory.length === 0 || queryHistory[queryHistory.length - 1] !== input) {
        queryHistory.push(input);
        // Keep history to last 50 items
        if (queryHistory.length > 50) queryHistory.shift();
      }
      historyIndex = queryHistory.length;

      vscode.postMessage({
        type: 'query',
        payload: { input }
      });

      queryInput.value = '';
    }

    function navigateHistory(direction) {
      if (queryHistory.length === 0) return;

      if (direction === 'up') {
        historyIndex = Math.max(0, historyIndex - 1);
      } else {
        historyIndex = Math.min(queryHistory.length, historyIndex + 1);
      }

      queryInput.value = historyIndex < queryHistory.length ? queryHistory[historyIndex] : '';
    }

    function insertSuggestion(cmd) {
      queryInput.value = cmd;
      queryInput.focus();
    }

    function clearLog() {
      lines = [];
      selectedIndex = -1;
      queryHistory = [];
      historyIndex = -1;
      projects.clear();
      logPanel.innerHTML = '';
      responseContent.innerHTML = '<span class="empty">Click a log line to see details...</span>';
      suggestions.innerHTML = '';
    }

    function applyConfig() {
      if (config.responsePanelHeight && config.responsePanelHeight !== 'auto') {
        document.documentElement.style.setProperty('--response-height', config.responsePanelHeight + 'px');
      }
    }

    function formatTime(timestamp) {
      try {
        const d = new Date(timestamp);
        return d.toLocaleTimeString('en-US', { hour12: false });
      } catch {
        return timestamp.substring(11, 19);
      }
    }

    function formatContent(content) {
      // Simple markdown-like formatting
      return escapeHtml(content)
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br>');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function renderFilterPanel() {
      const sortBy = filterSort.value;
      const projectList = Array.from(projects.values());

      // Sort projects
      if (sortBy === 'recent') {
        projectList.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
      } else {
        projectList.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Clear and rebuild
      filterProjects.innerHTML = '';

      for (const project of projectList) {
        const container = document.createElement('div');
        container.className = 'project-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'filter-' + project.name;
        checkbox.checked = project.visible;
        checkbox.addEventListener('change', () => {
          project.visible = checkbox.checked;
          applyFilters();
          saveFilterState();
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = project.name;

        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = '(' + project.count + ')';

        container.appendChild(checkbox);
        container.appendChild(label);
        container.appendChild(count);
        filterProjects.appendChild(container);
      }
    }

    function saveFilterState() {
      const state = {};
      for (const [name, project] of projects.entries()) {
        state[name] = project.visible;
      }
      vscode.postMessage({
        type: 'saveFilterState',
        payload: state
      });
    }

    function applyFilterState() {
      // Apply saved filter state to existing projects
      for (const [name, project] of projects.entries()) {
        if (filterState.hasOwnProperty(name)) {
          project.visible = filterState[name];
        }
      }
      renderFilterPanel();
      applyFilters();
    }

    function applyFilters() {
      // Update visibility for all log lines based on project filters
      const logLines = logPanel.querySelectorAll('.log-line');
      logLines.forEach((el, index) => {
        const line = lines[index];
        if (line && line.project) {
          const project = projects.get(line.project.name);
          if (project) {
            el.style.display = project.visible ? 'flex' : 'none';
            line.visible = project.visible;
          }
        }
      });
    }

    // Event listeners
    querySubmit.addEventListener('click', submitQuery);
    queryInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        submitQuery();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateHistory('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateHistory('down');
      }
    });

    filterSort.addEventListener('change', renderFilterPanel);
    filterToggle.addEventListener('click', () => {
      filterPanel.classList.toggle('collapsed');
      filterToggle.textContent = filterPanel.classList.contains('collapsed') ? 'Show Filters' : 'Hide Filters';
    });

    // Signal ready
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
