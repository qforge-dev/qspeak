# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**qSpeak** is a powerful voice transcription and AI assistant tool built with Tauri, React, TypeScript, and Rust. It provides real-time voice transcription and AI assistance across all applications while keeping voice data completely offline.

## Development Commands

### Build Commands

```bash
# Build frontend and backend
pnpm run build

# Run in development mode
pnpm tauri dev

# Build using Tauri CLI
pnpm run tauri build

# Preview built application
pnpm run preview
```

### Development Tools

```bash
# Run development server
pnpm tauri dev

# Build TypeScript
tsc

# Release management
pnpm run release
pnpm run update-changelog-titles
```

### Package Manager

This project uses **pnpm** as the package manager. Always use `pnpm install` instead of `npm install`.

## Architecture

### Frontend (React + TypeScript)

- **Entry Points**:
  - `recorder.html` - Main recorder window
  - `settings.html` - Settings window
  - `onboarding.html` - First-time user setup window
- **Source**: `src/` directory with feature-based organization
- **Styling**: Tailwind CSS v4 with Radix UI components
- **State Management**: React hooks and context patterns
- **Internationalization**: i18n setup with English and Polish locales

### Backend (Rust + Tauri)

- **Main Code**: `src-tauri/src/` directory
- **Entry Point**: `src-tauri/src/main.rs`
- **Core Logic**: `src-tauri/src/lib.rs` with Tauri commands
- **Custom Crates**:
  - `qspeak-audio-recording/` - Audio capture and processing
  - `qspeak-keyboard/` - Global hotkey handling
  - `qspeak-screenshot/` - Screen capture functionality
  - `qspeak-audio-player/` - Audio playback

### Key Components

- **State Machine**: `src-tauri/src/state_machine/` handles application state
- **LLM Integration**: `src-tauri/src/llm/` for AI model communication
- **API Handlers**: `src-tauri/src/api/` for external integrations
- **KoboldCPP Server**: Local AI model server management

## File Structure Conventions

### Frontend

- Components in `src/components/` use Radix UI primitives
- Custom hooks in `src/hooks/` for state and side effects
- Shared utilities in `src/shared/` and `src/utils/`
- Feature-specific code in `src/settings/`, `src/onboarding/`, `src/recorder/`

### Backend

- Tauri commands defined in `src-tauri/src/lib.rs`
- Feature modules organized by functionality
- Cross-platform support with conditional compilation
- Local processing only - no cloud dependencies

## Development Notes

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Rust, Tauri 2.0
- **UI**: Radix UI primitives with custom styling
- **Build**: Vite with Tauri integration

### Key Features

- Real-time voice transcription with offline processing
- AI assistant with adaptive personas
- Cross-platform support (Windows, macOS, Ubuntu)
- MCP (Model Context Protocol) integration
- Global hotkey support (default: F6)
- Universal compatibility with any text input application

### Security

- All voice processing happens locally
- No cloud dependencies for core functionality
- Tauri 2.0 security model with proper capabilities
- macOS entitlements for system access

### Cursor AI Rules

The project includes comprehensive Cursor AI rules in `.cursor/rules/`:

- `project-overview.mdc` - High-level project information
- `frontend-structure.mdc` - Frontend organization and patterns
- `backend-structure.mdc` - Backend architecture and modules
