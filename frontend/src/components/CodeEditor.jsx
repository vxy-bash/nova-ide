import { useRef, useState, useEffect, useCallback } from 'react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './CodeEditor.css';

loader.config({ monaco });

const API = 'http://127.0.0.1:8000';

const EXTENSION_TO_LANGUAGE = {
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
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
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
};

const getLanguageFromPath = (path) => {
  if (!path) return 'plaintext';
  const filename = path.split('/').pop().split('\\').pop().toLowerCase();
  if (filename === 'dockerfile') return 'dockerfile';
  const ext = '.' + filename.split('.').pop();
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
};

// Global registration flag for Monaco completion providers
let providersRegistered = false;

const registerCustomCompletions = (monacoInstance) => {
  if (providersRegistered) return;
  providersRegistered = true;

  // 1. Python Completions Provider
  monacoInstance.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      
      const suggestions = [
        { label: 'print', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'print(${1})', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'print(value, ...)', range },
        { label: 'def', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'def ${1}(${2}):\n\t${3}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Define function', range },
        { label: 'class', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'class ${1}:\n\tdef __init__(self):\n\t\t${2}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Define class', range },
        { label: 'import', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'import ${1}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'main_block', label: 'if __name__ == "__main__"', kind: monacoInstance.languages.CompletionItemKind.Snippet, insertText: 'if __name__ == "__main__":\n\t${1}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'len', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'len(${1})', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'range', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'range(${1})', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'enumerate', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'enumerate(${1})', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'append', kind: monacoInstance.languages.CompletionItemKind.Method, insertText: 'append(${1})', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'open', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'open("${1}", "${2}")', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'for_loop', label: 'for ... in range(...)', kind: monacoInstance.languages.CompletionItemKind.Snippet, insertText: 'for i in range(${1}):\n\t${2}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'try_except', label: 'try ... except', kind: monacoInstance.languages.CompletionItemKind.Snippet, insertText: 'try:\n\t${1}\nexcept Exception as e:\n\t${2}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }
      ];
      return { suggestions };
    }
  });

  // 2. C# Completions Provider
  monacoInstance.languages.registerCompletionItemProvider('csharp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        { label: 'Console.WriteLine', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'Console.WriteLine(${1});', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Writes text to console', range },
        { label: 'using', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'using ${1};', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'namespace', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'namespace ${1} {\n\t${2}\n}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'class', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'public class ${1} {\n\t${2}\n}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'Main', label: 'static void Main', kind: monacoInstance.languages.CompletionItemKind.Snippet, insertText: 'public static void Main(string[] args) {\n\t${1}\n}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'foreach', kind: monacoInstance.languages.CompletionItemKind.Snippet, insertText: 'foreach (var item in ${1}) {\n\t${2}\n}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }
      ];
      return { suggestions };
    }
  });

  // 3. Java Completions Provider
  monacoInstance.languages.registerCompletionItemProvider('java', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        { label: 'System.out.println', kind: monacoInstance.languages.CompletionItemKind.Function, insertText: 'System.out.println(${1});', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Prints line', range },
        { label: 'public class', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'public class ${1} {\n\tpublic static void main(String[] args) {\n\t\t${2}\n\t}\n}', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'import', kind: monacoInstance.languages.CompletionItemKind.Keyword, insertText: 'import ${1};', insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }
      ];
      return { suggestions };
    }
  });
};

export default function CodeEditor({ filePath, language, onContentChange, onCursorChange, diffMode, settings }) {
  const editorRef = useRef(null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const originalContent = useRef('');

  // Load file content
  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    fetch(`${API}/api/file?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || '');
        originalContent.current = data.content || '';
        setLoading(false);
        onContentChange?.(filePath, false, data.content || '');
      })
      .catch((err) => {
        console.error('Failed to load file:', err);
        setContent(`// Fehler beim Laden: ${err.message}`);
        setLoading(false);
      });
  }, [filePath]);

  const handleEditorMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Register our custom global autocompletes
    registerCustomCompletions(monacoInstance);

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      const position = { line: e.position.lineNumber, col: e.position.column };
      setCursorPos(position);
      if (onCursorChange) {
        onCursorChange(position);
      }
    });

    // Save shortcut: Ctrl+S
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleChange = (value) => {
    setContent(value);
    const modified = value !== originalContent.current;
    onContentChange?.(filePath, modified, value);
  };

  const handleSave = useCallback(async () => {
    if (!filePath || content === null) return;
    try {
      const res = await fetch(`${API}/api/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (res.ok) {
        originalContent.current = content;
        onContentChange?.(filePath, false, content);
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2000);
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [filePath, content, onContentChange]);

  const editorSettings = settings || {};
  const activeFontSize = editorSettings['editor.fontSize'] || 13;
  const activeWordWrap = editorSettings['editor.wordWrap'] || 'on';
  const activeMinimap = editorSettings['editor.minimap'] !== undefined ? editorSettings['editor.minimap'] : true;
  const activeLanguage = getLanguageFromPath(filePath);

  if (!filePath) {
    return (
      <div className="code-editor-panel">
        <div className="editor-welcome">
          <div className="editor-welcome-icon">📝</div>
          <div className="editor-welcome-text">
            Wähle eine Datei im Explorer aus,<br />
            um sie zu bearbeiten.
          </div>
          <div className="editor-welcome-shortcuts">
            <div className="editor-shortcut">
              <kbd>Ctrl</kbd>+<kbd>S</kbd> Speichern
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="code-editor-panel">
      <div className="code-editor-wrapper">
        {loading ? (
          <div className="editor-welcome">
            <div className="editor-welcome-text">Lade Datei...</div>
          </div>
        ) : diffMode ? (
          <DiffEditor
            height="100%"
            language={activeLanguage}
            original={originalContent.current || ''}
            modified={content || ''}
            theme="vs-dark"
            options={{
              fontSize: activeFontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              readOnly: true,
              automaticLayout: true,
              renderSideBySide: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={activeLanguage}
            value={content}
            onChange={handleChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: activeFontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              minimap: { enabled: activeMinimap, scale: 1 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              padding: { top: 8 },
              wordWrap: activeWordWrap,
              tabSize: 2,
              automaticLayout: true,
              quickSuggestions: { other: true, comments: true, strings: true },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              tabCompletion: "on",
              wordBasedSuggestions: "all",
              parameterHints: { enabled: true }
            }}
          />
        )}
      </div>
      <div className="editor-statusbar">
        <div className="statusbar-left">
          <span className="statusbar-item">{filePath}</span>
          {savedIndicator && <span className="save-indicator">✓ Gespeichert</span>}
        </div>
        <div className="statusbar-right">
          <span className="statusbar-item">Zeile {cursorPos.line}, Spalte {cursorPos.col}</span>
          <span className="statusbar-item">{activeLanguage}</span>
        </div>
      </div>
    </div>
  );
}
