# 🤖 FableOS Web IDE

A premium AI-powered coding assistant with a beautiful React frontend and FastAPI WebSocket backend. FableOS can read/write files, list directories, and execute system commands through an intelligent conversational interface.

## 🚀 Quick Start

**Double-click `start.bat`** — that's it!

The script will:
1. Install Python dependencies
2. Install Node.js dependencies (if needed)
3. Start the backend server (port 8000)
4. Start the frontend dev server (port 5173)
5. Open your browser to the app

## 📋 Prerequisites

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **pip** (comes with Python)

## 🏗️ Project Structure

```
pyyy/
├── start.bat              # ← One-click starter
├── README.md
├── backend/
│   ├── main.py            # FastAPI WebSocket server
│   └── requirements.txt   # Python dependencies
└── frontend/
    ├── package.json       # Node dependencies
    ├── vite.config.js     # Vite configuration
    ├── index.html         # Entry HTML
    └── src/
        ├── main.jsx       # React entry point
        ├── index.css      # Global styles
        ├── App.jsx        # Main app component
        ├── App.css        # App styles
        ├── hooks/
        │   └── useWebSocket.js   # WebSocket hook with auto-reconnect
        └── components/
            ├── Header.jsx / .css     # Header with status
            ├── ChatMessage.jsx / .css # Message bubbles with markdown
            ├── ChatInput.jsx / .css   # Input area
            └── Sidebar.jsx / .css     # Tool execution history
```

## 🛠️ Manual Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## ⚡ Features

- **AI Agent** with tool-use capabilities (file I/O, shell commands)
- **Real-time WebSocket** communication
- **Markdown rendering** with syntax-highlighted code blocks
- **Auto-reconnect** on connection loss
- **Dark theme** with glassmorphism design
- **Responsive** layout

## 🔧 Available Tools

| Tool | Description |
|------|-------------|
| `list_directory` | Lists files and folders in a directory |
| `read_file` | Reads and returns file contents |
| `write_file` | Writes content to a file |
| `execute_system_command` | Runs shell commands |
