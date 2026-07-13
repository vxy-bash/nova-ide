"""
Nova IDE — Backend
FastAPI WebSocket server that bridges a chat UI with an AI model that can use tools.
"""

import os
import json
import httpx
import subprocess
import asyncio
import shutil
import re
import fnmatch
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="Nova IDE Backend")

# CORS for the React frontend (dev server on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ───────────────────────────────────────────────────────────
API_URL = "https://api.freemodel.dev/v1/chat/completions"
API_KEY = "fe_oa_dcc9da0d31636944ad1aa207fe54913f1ee2d526715be5ee"
MODEL = "claude-fable-5"
MAX_TOOL_ITERATIONS = 10  # Safety limit to prevent infinite tool loops

# Workspace root for file operations (all paths resolved relative to this)
WORKSPACE_DIR = os.environ.get("WORKSPACE_DIR", os.getcwd())

SYSTEM_PROMPT = (
    "Du bist Nova, ein intelligenter KI-Assistent mit Zugriff auf das Dateisystem "
    "und die Kommandozeile. Du kannst Dateien lesen, schreiben, Verzeichnisse auflisten "
    "und Systembefehle ausführen. Antworte klar und hilfreich. "
    "Wenn du eine Aufgabe erhältst, nutze die verfügbaren Tools, um sie zu lösen."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "Listet alle Dateien und Ordner in einem Verzeichnis auf.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Der Pfad zum Verzeichnis. Standard ist das aktuelle Verzeichnis."
                    }
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Liest den Inhalt einer Datei und gibt ihn zurück.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Der Pfad zur Datei, die gelesen werden soll."
                    }
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Schreibt Inhalt in eine Datei. Erstellt die Datei und übergeordnete Verzeichnisse falls nötig.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Der Pfad zur Datei, die geschrieben werden soll."
                    },
                    "content": {
                        "type": "string",
                        "description": "Der Inhalt, der in die Datei geschrieben werden soll."
                    }
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_system_command",
            "description": "Führt einen Systembefehl in der Shell aus und gibt stdout/stderr zurück.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Der auszuführende Befehl."
                    }
                },
                "required": ["command"]
            }
        }
    }
]


# ─── Tool Implementations ────────────────────────────────────────────────────

def list_directory(path: str = ".") -> str:
    """List files and directories at the given path."""
    try:
        entries = os.listdir(path)
        if not entries:
            return "(Leeres Verzeichnis)"
        result = []
        for entry in sorted(entries):
            full = os.path.join(path, entry)
            prefix = "📁" if os.path.isdir(full) else "📄"
            result.append(f"{prefix} {entry}")
        return "\n".join(result)
    except FileNotFoundError:
        return f"Fehler: Verzeichnis '{path}' nicht gefunden."
    except PermissionError:
        return f"Fehler: Keine Berechtigung für '{path}'."
    except Exception as e:
        return f"Fehler: {str(e)}"


def read_file(filepath: str) -> str:
    """Read and return file contents."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        if not content:
            return "(Leere Datei)"
        # Limit output size for very large files
        if len(content) > 50000:
            return content[:50000] + f"\n\n... (Datei abgeschnitten, {len(content)} Zeichen insgesamt)"
        return content
    except FileNotFoundError:
        return f"Fehler: Datei '{filepath}' nicht gefunden."
    except PermissionError:
        return f"Fehler: Keine Berechtigung für '{filepath}'."
    except UnicodeDecodeError:
        return f"Fehler: '{filepath}' ist keine Textdatei."
    except Exception as e:
        return f"Fehler: {str(e)}"


def write_file(filepath: str, content: str) -> str:
    """Write content to a file, creating directories as needed."""
    try:
        dirpath = os.path.dirname(filepath)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"✅ Datei '{filepath}' erfolgreich gespeichert ({len(content)} Zeichen)."
    except PermissionError:
        return f"Fehler: Keine Berechtigung zum Schreiben von '{filepath}'."
    except Exception as e:
        return f"Fehler: {str(e)}"


def execute_system_command(command: str) -> str:
    """Execute a system command and return its output."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        output_parts = []
        if result.stdout.strip():
            output_parts.append(f"STDOUT:\n{result.stdout.strip()}")
        if result.stderr.strip():
            output_parts.append(f"STDERR:\n{result.stderr.strip()}")
        if not output_parts:
            output_parts.append("(Keine Ausgabe)")
        output_parts.append(f"Exit Code: {result.returncode}")
        return "\n".join(output_parts)
    except subprocess.TimeoutExpired:
        return "Fehler: Befehl hat das Zeitlimit von 30 Sekunden überschritten."
    except Exception as e:
        return f"Fehler: {str(e)}"


# Map function names to implementations
TOOL_FUNCTIONS = {
    "list_directory": list_directory,
    "read_file": read_file,
    "write_file": write_file,
    "execute_system_command": execute_system_command,
}


def execute_tool(name: str, arguments: dict) -> str:
    """Execute a tool by name with given arguments."""
    func = TOOL_FUNCTIONS.get(name)
    if not func:
        return f"Fehler: Unbekanntes Tool '{name}'"
    try:
        return func(**arguments)
    except TypeError as e:
        return f"Fehler: Ungültige Argumente für '{name}': {str(e)}"


# ─── Pydantic Models for REST API ─────────────────────────────────────────────

class FileWriteRequest(BaseModel):
    path: str
    content: str

class FileCreateRequest(BaseModel):
    path: str
    isDir: bool = False

class FileRenameRequest(BaseModel):
    oldPath: str
    newPath: str

class WorkspaceRequest(BaseModel):
    path: str

class BrowseRequest(BaseModel):
    path: Optional[str] = None

class SettingsRequest(BaseModel):
    settings: dict

class CommitRequest(BaseModel):
    message: str

class GitHubAuthRequest(BaseModel):
    token: str

class GitHubRepoCreateRequest(BaseModel):
    name: str
    private: bool = True


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _resolve_safe_path(relative_path: str) -> str:
    """Resolve a path relative to WORKSPACE_DIR and prevent path traversal."""
    workspace = os.path.realpath(WORKSPACE_DIR)
    resolved = os.path.realpath(os.path.join(workspace, relative_path))
    if not resolved.startswith(workspace):
        raise HTTPException(status_code=403, detail="Path traversal is not allowed.")
    return resolved


EXTENSION_LANGUAGE_MAP = {
    ".py": "python",
    ".pyw": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".html": "html",
    ".htm": "html",
    ".xhtml": "html",
    ".vue": "html",
    ".svelte": "html",
    ".astro": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "scss",
    ".less": "less",
    ".json": "json",
    ".jsonc": "json",
    ".json5": "json",
    ".md": "markdown",
    ".markdown": "markdown",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".sh": "shell",
    ".zsh": "shell",
    ".bash": "shell",
    ".bat": "shell",
    ".cmd": "shell",
    ".ps1": "powershell",
    ".sql": "sql",
    ".xml": "xml",
    ".svg": "xml",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".r": "r",
    ".lua": "lua",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".dockerfile": "dockerfile",
    ".graphql": "graphql",
    ".dart": "dart",
    ".scala": "scala",
    ".hs": "haskell",
    ".pl": "perl",
    ".pm": "perl",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".clj": "clojure",
    ".fs": "fsharp",
    ".fsx": "fsharp",
    ".zig": "zig",
    ".nim": "nim",
    ".jl": "julia"
}

BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', 
    '.rar', '.exe', '.dll', '.so', '.dylib', '.bin', '.db', '.sqlite', 
    '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.mov', '.avi', 
    '.wav', '.flac', '.ogg', '.webm', '.mkv', '.7z', '.class', '.pyc', 
    '.o', '.obj', '.out'
}


def _detect_language(filepath: str) -> str:
    """Detect Monaco editor language ID from file extension."""
    ext = os.path.splitext(filepath)[1].lower()
    # Special case: Dockerfile without extension
    if os.path.basename(filepath).lower() == "dockerfile":
        return "dockerfile"
    return EXTENSION_LANGUAGE_MAP.get(ext, "plaintext")


# ─── REST API Endpoints ──────────────────────────────────────────────────────

@app.get("/api/files")
async def api_list_files(path: str = Query(default=".")):
    """List directory contents."""
    try:
        resolved = _resolve_safe_path(path)
        if not os.path.isdir(resolved):
            raise HTTPException(status_code=400, detail=f"'{path}' is not a directory.")
        entries = []
        for name in sorted(os.listdir(resolved)):
            full = os.path.join(resolved, name)
            is_dir = os.path.isdir(full)
            entry = {
                "name": name,
                "path": os.path.relpath(full, os.path.realpath(WORKSPACE_DIR)).replace("\\", "/"),
                "isDir": is_dir,
                "size": os.path.getsize(full) if not is_dir else 0,
            }
            entries.append(entry)
        return {"entries": entries}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Directory '{path}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file")
async def api_read_file(path: str = Query(...)):
    """Read a file's content."""
    try:
        resolved = _resolve_safe_path(path)
        if not os.path.isfile(resolved):
            raise HTTPException(status_code=404, detail=f"File '{path}' not found.")
        with open(resolved, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "content": content,
            "path": path,
            "language": _detect_language(path),
        }
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not a text file.")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file/raw")
async def api_read_file_raw(path: str = Query(...)):
    """Serve raw file directly (useful for images)."""
    try:
        resolved = _resolve_safe_path(path)
        if not os.path.isfile(resolved):
            raise HTTPException(status_code=404, detail=f"File '{path}' not found.")
        return FileResponse(resolved)
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/file")
async def api_write_file(req: FileWriteRequest):
    """Write/save content to a file."""
    try:
        resolved = _resolve_safe_path(req.path)
        dirpath = os.path.dirname(resolved)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"success": True, "path": req.path}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/file/create")
async def api_create_file(req: FileCreateRequest):
    """Create a new file or directory."""
    try:
        resolved = _resolve_safe_path(req.path)
        if os.path.exists(resolved):
            raise HTTPException(status_code=409, detail=f"'{req.path}' already exists.")
        if req.isDir:
            os.makedirs(resolved, exist_ok=True)
        else:
            dirpath = os.path.dirname(resolved)
            if dirpath:
                os.makedirs(dirpath, exist_ok=True)
            with open(resolved, "w", encoding="utf-8") as f:
                f.write("")
        return {"success": True, "path": req.path}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/file")
async def api_delete_file(path: str = Query(...)):
    """Delete a file or empty directory."""
    try:
        resolved = _resolve_safe_path(path)
        if not os.path.exists(resolved):
            raise HTTPException(status_code=404, detail=f"'{path}' not found.")
        if os.path.isdir(resolved):
            os.rmdir(resolved)  # Only removes empty directories
        else:
            os.remove(resolved)
        return {"success": True}
    except HTTPException:
        raise
    except OSError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/file/rename")
async def api_rename_file(req: FileRenameRequest):
    """Rename or move a file/directory."""
    try:
        resolved_old = _resolve_safe_path(req.oldPath)
        resolved_new = _resolve_safe_path(req.newPath)
        if not os.path.exists(resolved_old):
            raise HTTPException(status_code=404, detail=f"'{req.oldPath}' not found.")
        if os.path.exists(resolved_new):
            raise HTTPException(status_code=409, detail=f"'{req.newPath}' already exists.")
        new_parent = os.path.dirname(resolved_new)
        if new_parent:
            os.makedirs(new_parent, exist_ok=True)
        shutil.move(resolved_old, resolved_new)
        return {"success": True}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Workspace Endpoints ──────────────────────────────────────────────────────

@app.get("/api/workspace")
async def api_get_workspace():
    return {"path": WORKSPACE_DIR, "name": os.path.basename(WORKSPACE_DIR)}

@app.post("/api/workspace")
async def api_set_workspace(req: WorkspaceRequest):
    global WORKSPACE_DIR
    if not os.path.isdir(req.path):
        raise HTTPException(status_code=400, detail="Path is not a valid directory")
    WORKSPACE_DIR = os.path.realpath(req.path)
    return {"success": True, "path": WORKSPACE_DIR, "name": os.path.basename(WORKSPACE_DIR)}

@app.post("/api/workspace/select-native")
async def api_select_workspace_native():
    """Open native OS directory dialog to select project workspace."""
    try:
        cmd = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$f.Description = 'Projektordner auswaehlen'; "
            "$f.ShowNewFolderButton = $true; "
            "if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
            capture_output=True,
            text=True
        )
        path = res.stdout.strip()
        if path and os.path.isdir(path):
            global WORKSPACE_DIR
            WORKSPACE_DIR = os.path.realpath(path)
            return {"success": True, "path": WORKSPACE_DIR, "name": os.path.basename(WORKSPACE_DIR)}
        return {"success": False, "message": "No folder selected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_drives():
    drives = []
    if os.name == 'nt':
        import ctypes
        import string
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                drives.append(f"{letter}:\\")
            bitmask >>= 1
    else:
        drives.append("/")
    return drives

@app.post("/api/workspace/browse")
async def api_browse_workspace(req: BrowseRequest):
    if req.path == "drives":
        drives = [{"name": d, "path": d} for d in get_drives()]
        return {"current": "Computer", "parent": None, "dirs": drives}

    target = req.path if req.path else WORKSPACE_DIR
    if not os.path.isdir(target):
        target = WORKSPACE_DIR
    
    dirs = []
    try:
        for name in sorted(os.listdir(target)):
            full = os.path.join(target, name)
            if os.path.isdir(full):
                dirs.append({"name": name, "path": full})
    except PermissionError:
        pass
        
    parent = os.path.dirname(target)
    if parent == target:
        parent = "drives"
        
    return {"current": target, "parent": parent, "dirs": dirs}


# ─── Search Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/search")
async def api_search(q: str, path: str = ".", caseSensitive: bool = False, regex: bool = False, includes: str = "*"):
    try:
        resolved = _resolve_safe_path(path)
        results = []
        total_matches = 0
        
        flags = 0 if caseSensitive else re.IGNORECASE
        if not regex:
            q = re.escape(q)
        pattern = re.compile(q, flags)
        
        skip_dirs = {"node_modules", ".git", "__pycache__", "dist", "build"}
        
        for root, dirs, files in os.walk(resolved):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            
            for file in files:
                if not fnmatch.fnmatch(file, includes):
                    continue
                    
                ext = os.path.splitext(file)[1].lower()
                if ext in BINARY_EXTENSIONS:
                    continue
                    
                filepath = os.path.join(root, file)
                
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                except (UnicodeDecodeError, PermissionError):
                    continue
                    
                file_matches = []
                for i, line in enumerate(lines):
                    if pattern.search(line):
                        file_matches.append({
                            "line": i + 1,
                            "content": line.rstrip("\n"),
                            "before": lines[i-1].rstrip("\n") if i > 0 else "",
                            "after": lines[i+1].rstrip("\n") if i < len(lines)-1 else ""
                        })
                        total_matches += 1
                        
                if file_matches:
                    results.append({
                        "file": os.path.relpath(filepath, os.path.realpath(WORKSPACE_DIR)).replace("\\", "/"),
                        "matches": file_matches
                    })
                    
                if total_matches >= 100:
                    break
            if total_matches >= 100:
                break
                
        return {"results": results, "totalMatches": total_matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/file/search")
async def api_file_search(q: str):
    try:
        results = []
        q_lower = q.lower()
        skip_dirs = {"node_modules", ".git", "__pycache__", "dist", "build"}
        workspace_real = os.path.realpath(WORKSPACE_DIR)
        
        for root, dirs, files in os.walk(workspace_real):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            
            for file in files:
                if q_lower in file.lower():
                    filepath = os.path.join(root, file)
                    relpath = os.path.relpath(filepath, workspace_real).replace("\\", "/")
                    results.append({"name": file, "path": relpath})
                    
                    if len(results) >= 50:
                        break
            if len(results) >= 50:
                break
                
        return {"files": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Settings Endpoints ───────────────────────────────────────────────────────

def load_usage():
    usage_file = Path.home() / ".novaide" / "usage.json"
    if usage_file.exists():
        try:
            with open(usage_file, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"prompt_tokens": 0, "completion_tokens": 0, "total_cost": 0.0}

def save_usage(prompt_tokens: int, completion_tokens: int, model: str):
    input_rate = 0.000003  # $3 per million
    output_rate = 0.000015  # $15 per million
    model_lower = model.lower()
    if "claude" in model_lower:
        input_rate = 0.000003
        output_rate = 0.000015
    elif "gpt-4" in model_lower:
        input_rate = 0.000005
        output_rate = 0.000015
    else:
        input_rate = 0.00000125
        output_rate = 0.00000375
        
    cost = (prompt_tokens * input_rate) + (completion_tokens * output_rate)
    
    current = load_usage()
    current["prompt_tokens"] += prompt_tokens
    current["completion_tokens"] += completion_tokens
    current["total_cost"] += cost
    
    usage_file = Path.home() / ".novaide" / "usage.json"
    usage_file.parent.mkdir(parents=True, exist_ok=True)
    with open(usage_file, "w") as f:
        json.dump(current, f)
    return current

@app.get("/api/usage")
async def api_get_usage():
    return load_usage()

@app.post("/api/usage/reset")
async def api_reset_usage():
    usage_file = Path.home() / ".novaide" / "usage.json"
    if usage_file.exists():
        try:
            os.remove(usage_file)
        except Exception:
            pass
    return {"success": True}

def load_settings():
    settings_file = Path.home() / ".novaide" / "settings.json"
    
    # Load baked defaults if present
    baked_file = Path(__file__).parent / "default_settings.json"
    baked_defaults = {}
    if baked_file.exists():
        try:
            with open(baked_file, "r") as f:
                baked_defaults = json.load(f)
        except Exception:
            pass

    default_settings = {
        "editor.fontSize": 14,
        "editor.tabSize": 2,
        "editor.wordWrap": "on",
        "editor.minimap": True,
        "editor.fontFamily": "'JetBrains Mono', monospace",
        "editor.lineNumbers": "on",
        "editor.bracketPairColorization": True,
        "editor.smoothScrolling": True,
        "editor.cursorBlinking": "smooth",
        "editor.renderWhitespace": "selection",
        "theme": "dark",
        "terminal.fontSize": 13,
        "autoSave": False,
        "autoSaveDelay": 1000,
        "ai.model": "claude-fable-5",
        "ai.apiKey": "",
        "ai.apiUrl": "https://api.freemodel.dev/v1/chat/completions"
    }
    
    default_settings.update(baked_defaults)
    
    if settings_file.exists():
        try:
            with open(settings_file, "r") as f:
                user_settings = json.load(f)
                default_settings.update(user_settings)
        except Exception:
            pass
            
    return default_settings

@app.get("/api/settings")
async def api_get_settings():
    return load_settings()

@app.post("/api/settings")
async def api_save_settings(req: SettingsRequest):
    settings_file = Path.home() / ".novaide" / "settings.json"
    settings_file.parent.mkdir(parents=True, exist_ok=True)
    
    current_settings = {}
    if settings_file.exists():
        try:
            with open(settings_file, "r") as f:
                current_settings = json.load(f)
        except Exception:
            pass
            
    current_settings.update(req.settings)
    
    with open(settings_file, "w") as f:
        json.dump(current_settings, f, indent=2)
        
    return {"success": True}

# ─── Git Endpoints ────────────────────────────────────────────────────────────

git_action_progress = ""

@app.get("/api/git/progress")
async def api_git_progress():
    global git_action_progress
    return {"progress": git_action_progress}

@app.get("/api/git/status")
async def api_git_status():
    try:
        check = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], 
                               cwd=WORKSPACE_DIR, capture_output=True, text=True)
        if check.returncode != 0:
            return {"isRepo": False}
            
        branch_res = subprocess.run(["git", "branch", "--show-current"], 
                                    cwd=WORKSPACE_DIR, capture_output=True, text=True)
        branch = branch_res.stdout.strip()
        
        status_res = subprocess.run(["git", "status", "--porcelain"], 
                                    cwd=WORKSPACE_DIR, capture_output=True, text=True)
        
        changes = []
        for line in status_res.stdout.splitlines():
            if len(line) > 2:
                status = line[:2].strip()
                file = line[3:]
                changes.append({"status": status, "file": file})
                
        # Check if remote origin exists
        remote_check = subprocess.run(["git", "remote", "get-url", "origin"], 
                                      cwd=WORKSPACE_DIR, capture_output=True, text=True)
        has_remote = remote_check.returncode == 0
        
        return {"isRepo": True, "branch": branch, "changes": changes, "hasRemote": has_remote}
    except Exception as e:
        return {"isRepo": False, "error": str(e)}

@app.post("/api/git/commit")
def api_git_commit(req: CommitRequest):
    try:
        subprocess.run(["git", "add", "-A"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        res = subprocess.run(["git", "commit", "-m", req.message], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        return {"success": res.returncode == 0, "output": res.stdout + "\n" + res.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/git/push")
def api_git_push():
    global git_action_progress
    try:
        git_action_progress = "Prüfe Git-Remote-Konfiguration..."
        settings = load_settings()
        token = settings.get("github.token")
        username = settings.get("github.username")
        
        check_remote = subprocess.run(["git", "remote", "get-url", "origin"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        if check_remote.returncode != 0:
            raise HTTPException(status_code=400, detail="Kein Remote-Repository ('origin') konfiguriert.")
            
        git_action_progress = "Aktualisiere GitHub Authentifizierungs-Token..."
        remote_url = check_remote.stdout.strip()
        if "github.com" in remote_url and token and username:
            repo_name = remote_url.split("/")[-1].replace(".git", "")
            authenticated_remote = f"https://{token}@github.com/{username}/{repo_name}.git"
            subprocess.run(["git", "remote", "set-url", "origin", authenticated_remote], cwd=WORKSPACE_DIR)

        git_action_progress = "Übertrage Änderungen zu GitHub (git push)..."
        res = subprocess.run(["git", "push", "origin", "main"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        if res.returncode != 0:
            # Try pushing to active branch instead of main
            branch_res = subprocess.run(["git", "branch", "--show-current"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            active_branch = branch_res.stdout.strip() or "main"
            res = subprocess.run(["git", "push", "origin", active_branch], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            
        git_action_progress = "Fertig!"
        return {"success": res.returncode == 0, "output": res.stdout + "\n" + res.stderr}
    except HTTPException as e:
        git_action_progress = f"Fehler: {e.detail}"
        raise e
    except Exception as e:
        git_action_progress = f"Fehler: {str(e)}"
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/git/init")
def api_git_init():
    try:
        res = subprocess.run(["git", "init"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        return {"success": res.returncode == 0, "output": res.stdout + "\n" + res.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── GitHub API Integration ──────────────────────────────────────────────────
import urllib.request
import urllib.error
import ssl

def _make_raw_request(url: str, token: str, auth_prefix: str, method: str = "GET", data: dict = None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"{auth_prefix} {token}")
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
        json_data = json.dumps(data).encode("utf-8")
        req.data = json_data
    
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            res_data = response.read().decode("utf-8")
            return json.loads(res_data) if res_data else {}
    except urllib.error.HTTPError as e:
        try:
            err_msg = e.read().decode("utf-8")
            err_json = json.loads(err_msg)
            message = err_json.get("message", str(e))
        except Exception:
            message = str(e)
        raise HTTPException(status_code=e.code, detail=f"GitHub API Error: {message}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=503, detail=f"GitHub konnte nicht erreicht werden (Verbindung fehlgeschlagen): {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unerwarteter Fehler: {str(e)}")

def _github_api_request(url: str, token: str, method: str = "GET", data: dict = None):
    try:
        # Try modern Bearer prefix first
        return _make_raw_request(url, token, "Bearer", method, data)
    except HTTPException as e:
        if e.status_code in [401, 403]:
            try:
                # Fallback to legacy token prefix
                return _make_raw_request(url, token, "token", method, data)
            except Exception:
                pass
        raise e

@app.post("/api/github/auth")
def api_github_auth(req: GitHubAuthRequest):
    token = req.token.strip()
    try:
        user_info = _github_api_request("https://api.github.com/user", token)
        username = user_info.get("login")
        avatar = user_info.get("avatar_url")
        
        if not username:
            raise HTTPException(status_code=401, detail="Invalid GitHub token.")
            
        settings = load_settings()
        settings["github.token"] = token
        settings["github.username"] = username
        settings["github.avatar"] = avatar
        
        settings_file = Path.home() / ".novaide" / "settings.json"
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_file, "w") as f:
            json.dump(settings, f, indent=4)
            
        return {"username": username, "avatar": avatar}
    except HTTPException as e:
        if e.status_code in [401, 403]:
            raise HTTPException(status_code=e.status_code, detail=(
                "GitHub-Authentifizierung fehlgeschlagen. Bitte prüfe:\n"
                "1. Ist das Token korrekt kopiert worden (keine Leerzeichen)?\n"
                "2. Hat das Token die Berechtigungen (Scopes) 'repo' und 'user'?\n"
                "3. Ist das Token noch gültig (nicht abgelaufen)?"
            ))
        raise e

@app.get("/api/github/user")
def api_github_user():
    settings = load_settings()
    token = settings.get("github.token")
    username = settings.get("github.username")
    avatar = settings.get("github.avatar")
    if not token or not username:
        return {"loggedIn": False}
    return {"loggedIn": True, "username": username, "avatar": avatar}

@app.post("/api/github/logout")
def api_github_logout():
    settings = load_settings()
    settings.pop("github.token", None)
    settings.pop("github.username", None)
    settings.pop("github.avatar", None)
    
    settings_file = Path.home() / ".novaide" / "settings.json"
    with open(settings_file, "w") as f:
        json.dump(settings, f, indent=4)
    return {"success": True}

@app.get("/api/github/repos")
def api_github_repos():
    settings = load_settings()
    token = settings.get("github.token")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in to GitHub.")
    
    repos = _github_api_request("https://api.github.com/user/repos?sort=updated&per_page=50", token)
    simplified = []
    for r in repos:
        simplified.append({
            "name": r.get("name"),
            "full_name": r.get("full_name"),
            "html_url": r.get("html_url"),
            "private": r.get("private"),
            "clone_url": r.get("clone_url")
        })
    return {"repos": simplified}

@app.post("/api/github/repos/create")
def api_github_repos_create(req: GitHubRepoCreateRequest):
    global git_action_progress
    try:
        git_action_progress = "Lade Konfiguration..."
        settings = load_settings()
        token = settings.get("github.token")
        username = settings.get("github.username")
        if not token or not username:
            raise HTTPException(status_code=401, detail="Not logged in to GitHub.")
            
        git_action_progress = "Erstelle Repository auf GitHub..."
        repo_data = _github_api_request("https://api.github.com/user/repos", token, method="POST", data={
            "name": req.name,
            "private": req.private,
            "auto_init": False
        })
        
        clone_url = repo_data.get("clone_url")
        html_url = repo_data.get("html_url")
        
        git_action_progress = "Prüfe lokales Git-Repository..."
        is_repo = False
        try:
            git_check = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            is_repo = git_check.returncode == 0
        except Exception:
            pass
            
        outputs = []
        
        if not is_repo:
            git_action_progress = "Initialisiere lokales Git-Repository..."
            r = subprocess.run(["git", "init"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            outputs.append(r.stdout + r.stderr)
            
        has_commits = False
        try:
            r = subprocess.run(["git", "log", "-n", "1"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            has_commits = r.returncode == 0
        except Exception:
            pass
            
        if not has_commits:
            git_action_progress = "Füge Projektdateien zu Git hinzu..."
            r = subprocess.run(["git", "add", "-A"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            outputs.append(r.stdout + r.stderr)
            git_action_progress = "Erstelle initialen Commit..."
            r = subprocess.run(["git", "commit", "-m", "Initial commit from Nova IDE"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
            outputs.append(r.stdout + r.stderr)
            
        git_action_progress = "Verbinde lokales Git mit GitHub Remote..."
        authenticated_remote = f"https://{token}@github.com/{username}/{req.name}.git"
        subprocess.run(["git", "remote", "remove", "origin"], cwd=WORKSPACE_DIR)
        
        r = subprocess.run(["git", "remote", "add", "origin", authenticated_remote], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        outputs.append(r.stdout + r.stderr)
        
        r = subprocess.run(["git", "branch", "-M", "main"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        outputs.append(r.stdout + r.stderr)
        
        git_action_progress = "Pushe Code nach GitHub (das kann einen Moment dauern)..."
        r = subprocess.run(["git", "push", "-u", "origin", "main"], cwd=WORKSPACE_DIR, capture_output=True, text=True)
        outputs.append(r.stdout + r.stderr)
        
        git_action_progress = "Fertig!"
        return {
            "success": r.returncode == 0,
            "clone_url": clone_url,
            "html_url": html_url,
            "output": "\n".join(outputs)
        }
    except Exception as e:
        git_action_progress = f"Fehler: {str(e)}"
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Nova IDE Backend"}


# ─── WebSocket Agent Endpoint ────────────────────────────────────────────────

@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Conversation history
    history = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Send initial status and usage info
    await websocket.send_json({"type": "status", "content": "Verbunden ✅"})
    initial_usage = load_usage()
    await websocket.send_json({
        "type": "usage",
        "prompt_tokens": initial_usage["prompt_tokens"],
        "completion_tokens": initial_usage["completion_tokens"],
        "total_cost": initial_usage["total_cost"]
    })

    while True:
        try:
            # Wait for user message
            user_input = await websocket.receive_text()
            history.append({"role": "user", "content": user_input})

            # Send "thinking" status
            await websocket.send_json({"type": "status", "content": "Denkt nach..."})

            # Load active AI configuration from settings
            settings_file = Path.home() / ".novaide" / "settings.json"
            active_model = MODEL
            active_api_key = API_KEY
            active_api_url = API_URL
            
            if settings_file.exists():
                try:
                    with open(settings_file, "r") as f:
                        settings_data = json.load(f)
                        active_model = settings_data.get("ai.model", MODEL)
                        active_api_key = settings_data.get("ai.apiKey", API_KEY)
                        active_api_url = settings_data.get("ai.apiUrl", API_URL)
                except Exception:
                    pass

            # Agentic loop: keep calling the model until it gives a final text response
            for iteration in range(MAX_TOOL_ITERATIONS):
                async with httpx.AsyncClient(timeout=300.0) as client:
                    try:
                        resp = await client.post(
                            active_api_url,
                            headers={"Authorization": f"Bearer {active_api_key}"},
                            json={
                                "model": active_model,
                                "messages": history,
                                "tools": TOOLS,
                            }
                        )
                        resp.raise_for_status()
                        data = resp.json()
                    except httpx.HTTPStatusError as e:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"API-Fehler: {e.response.status_code}"
                        })
                        break
                    except httpx.RequestError as e:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Verbindungsfehler zur API: {str(e)}"
                        })
                        break
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Unerwarteter Fehler: {str(e)}"
                        })
                        break

                # Parse the response
                choice = data.get("choices", [{}])[0]
                msg = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "")

                # Track and send token usage
                usage_info = data.get("usage")
                if not usage_info:
                    # Estimate tokens: ~4 characters per token
                    prompt_char_count = sum(len(str(m.get("content") or "")) for m in history)
                    for m in history:
                        if m.get("tool_calls"):
                            prompt_char_count += len(str(m["tool_calls"]))
                    completion_char_count = len(str(msg.get("content") or "")) + len(str(msg.get("tool_calls") or ""))
                    usage_info = {
                        "prompt_tokens": max(1, prompt_char_count // 4),
                        "completion_tokens": max(1, completion_char_count // 4)
                    }

                prompt_toks = usage_info.get("prompt_tokens", 0) or 0
                comp_toks = usage_info.get("completion_tokens", 0) or 0
                accumulated = save_usage(prompt_toks, comp_toks, active_model)
                
                await websocket.send_json({
                    "type": "usage",
                    "prompt_tokens": accumulated["prompt_tokens"],
                    "completion_tokens": accumulated["completion_tokens"],
                    "total_cost": accumulated["total_cost"]
                })

                # Add assistant message to history
                history.append(msg)

                # Check if the model wants to call tools
                tool_calls = msg.get("tool_calls")

                if tool_calls:
                    # Process all tool calls
                    for tool_call in tool_calls:
                        func_name = tool_call["function"]["name"]
                        try:
                            func_args = json.loads(tool_call["function"]["arguments"])
                        except json.JSONDecodeError:
                            func_args = {}

                        # Notify frontend about tool execution
                        await websocket.send_json({
                            "type": "tool",
                            "content": f"🔧 Tool: **{func_name}**",
                            "tool_name": func_name,
                            "tool_args": func_args,
                        })

                        # Execute the tool
                        result = execute_tool(func_name, func_args)

                        # Send tool result to frontend
                        await websocket.send_json({
                            "type": "tool_result",
                            "content": result,
                            "tool_name": func_name,
                        })

                        # Add tool result to history for the model
                        history.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": result,
                        })

                    # Update status — model will process tool results
                    await websocket.send_json({
                        "type": "status",
                        "content": "Verarbeitet Ergebnisse..."
                    })
                    # Continue the loop to let the model process tool results

                else:
                    # No tool calls — this is the final response
                    content = msg.get("content", "")
                    if content:
                        await websocket.send_json({
                            "type": "message",
                            "content": content
                        })
                    await websocket.send_json({
                        "type": "status",
                        "content": "Bereit"
                    })
                    break  # Exit the agentic loop

            else:
                # Exceeded max iterations
                await websocket.send_json({
                    "type": "error",
                    "content": "⚠️ Maximale Anzahl an Tool-Aufrufen erreicht."
                })
                await websocket.send_json({
                    "type": "status",
                    "content": "Bereit"
                })

        except WebSocketDisconnect:
            print("Client disconnected")
            break
        except Exception as e:
            try:
                await websocket.send_json({
                    "type": "error",
                    "content": f"Server-Fehler: {str(e)}"
                })
                await websocket.send_json({
                    "type": "status",
                    "content": "Bereit"
                })
            except Exception:
                break


# ─── WebSocket Terminal Endpoint ──────────────────────────────────────────────

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """Interactive terminal via WebSocket using asyncio subprocess."""
    await websocket.accept()

    # Determine the shell to use
    if os.name == "nt":
        shell_cmd = ["powershell.exe", "-NoLogo", "-NoProfile", "-Command", "-"]
    else:
        shell_cmd = ["/bin/bash", "--norc", "--noprofile", "-i"]

    try:
        process = await asyncio.create_subprocess_exec(
            *shell_cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WORKSPACE_DIR,
        )
    except Exception as e:
        await websocket.send_json({"type": "error", "content": f"Failed to start shell: {e}"})
        await websocket.close()
        return

    async def _read_stream(stream, stream_type: str):
        """Read lines from stdout/stderr and send to the client."""
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break
                try:
                    decoded = line.decode("utf-8", errors="replace")
                except Exception:
                    decoded = str(line)
                await websocket.send_json({"type": stream_type, "content": decoded})
        except (WebSocketDisconnect, Exception):
            pass

    # Start background tasks to stream stdout and stderr
    stdout_task = asyncio.create_task(_read_stream(process.stdout, "stdout"))
    stderr_task = asyncio.create_task(_read_stream(process.stderr, "stderr"))

    async def _wait_process():
        """Wait for process exit and notify client."""
        return_code = await process.wait()
        await stdout_task
        await stderr_task
        try:
            await websocket.send_json({"type": "exit", "code": return_code})
        except Exception:
            pass

    wait_task = asyncio.create_task(_wait_process())

    try:
        while True:
            data = await websocket.receive_text()
            if process.stdin and not process.stdin.is_closing():
                process.stdin.write((data + "\n").encode("utf-8"))
                await process.stdin.drain()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Clean up the process
        if process.returncode is None:
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5)
            except (asyncio.TimeoutError, Exception):
                try:
                    process.kill()
                except Exception:
                    pass
        wait_task.cancel()
        try:
            await wait_task
        except (asyncio.CancelledError, Exception):
            pass
# ─── Static Frontend Serving ──────────────────────────────────────────────────

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    @app.get("/")
    async def fallback_index():
        return {"message": "Frontend not built. Run 'npm run build' in frontend folder."}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)