# Changelog

All notable changes to the ALLP Log Viewer extension.

## [0.1.0] - 2025-01-02

### Added

- **Core Protocol**
  - `ActionableLogLine` interface for interactive log entries
  - `SourceAdapter` interface for pluggable log format parsing
  - `AdapterRegistry` for managing multiple adapters
  - `RendererConfig` for panel customization

- **Beads Adapter**
  - Full parsing of beads event format (TIMESTAMP|EVENT_CODE|ISSUE_ID|AGENT_ID|SESSION_ID|DETAILS)
  - Event category recognition (ep, ss, sk, bd, gt, hk, gd)
  - 7 built-in commands: show, deps, related, category, session, explain, agent
  - Integration with `bd` CLI for live issue data

- **Query Interpreter**
  - Command parsing with alias support
  - Natural language detection for Claude fallback
  - Configurable Claude fallback handler

- **VS Code Extension**
  - WebView panel with split-pane UI
  - Real-time file watching for `.beads/events.log`
  - Query history with up/down arrow navigation
  - Auto-scroll for streaming logs
  - Mock data mode for testing

- **Testing**
  - Protocol interface tests
  - BeadsAdapter parsing/command tests
  - QueryInterpreter tests
  - Extension activation tests
  - Integration tests (E2E, multi-adapter, error boundaries)
  - Test event harness for metrics capture

### Commands

- `allp.showViewer` - Open the log viewer (Ctrl+Shift+L)
- `allp.showWithMockData` - Open with sample data

### Keyboard Shortcuts

- `Ctrl+Shift+L` / `Cmd+Shift+L` - Show log viewer
- `Up/Down` arrows in query bar - Navigate query history
