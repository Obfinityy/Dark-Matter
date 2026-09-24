# DarkMatter

**DarkMatter** is an Autonomous AI Bug Bounty & Security Research Platform.

This frontend is designed as a sleek, professional, chat-focused interface where security researchers can direct an autonomous agent to perform complex reconnaissance, vulnerability scanning, and exploitation validation.

## Tech Stack
- **React 18**
- **Vite**
- **React Router v6**
- **Vanilla CSS** (No external heavy UI libraries or Tailwind)
- **Lucide React** (Icons)

## Features
- **Conversational Agent Interface:** Direct the DarkMatter agent via a familiar chat interface.
- **Execution Modes:** Scale the AI's aggressiveness and tool usage via Normal, Medium, High, Ultra High, and Infinity modes directly from the chat input.
- **Plugin Ecosystem:** Granular control over which security tools (Nmap, DirBuster, Nuclei, SQLMap) the AI is allowed to use. Grouped by subscription tiers.
- **Subscription Management:** Pro upgrade paths tied to advanced plugins and premium execution modes.
- **Fully Responsive:** Beautifully adapts to mobile, tablet, and desktop environments.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Architecture

- `/src/components/layout/ChatLayout.jsx`: The main application shell containing the sidebar (chat history, settings, plugins) and the central routing outlet.
- `/src/pages/Chat/index.jsx`: The core chat interface handling user prompts, agent replies, mode selection, and quick actions.
- `/src/components/modals/`: Interactive dialogs for Subscription upgrades and Plugin management.
- `/src/mock/`: Static placeholder data to simulate a live backend.
- `/src/styles/`: Vanilla CSS design system using CSS variables (`variables.css`) for consistent dark-mode styling across the app (`layout.css`, `components.css`).