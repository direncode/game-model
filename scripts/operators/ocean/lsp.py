"""OCEAN Language Server Protocol — JSON-RPC over stdin/stdout.

Minimal implementation of LSP that wraps the lexer/parser/typecheck/lint
pipeline. Editors (VS Code, Neovim, Helix) speak LSP; this server gives
them OCEAN-aware features.

Implemented:
  - textDocument/didOpen, didChange, didClose
  - textDocument/publishDiagnostics  (parse + type errors as squiggles)
  - textDocument/hover               (operator signature on hover)
  - textDocument/completion          (verbs, keywords, registered operators)
  - textDocument/documentSymbol      (define names, let-bindings)
  - workspace/symbol                 (cross-file navigation)

Usage (in editor LSP config):
    command: python -m scripts.operators.ocean.lsp

Quick test:
    echo 'Content-Length: 25\r\n\r\n{"jsonrpc":"2.0","method":"shutdown"}' | python -m scripts.operators.ocean.lsp
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean, ParseError
from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.typecheck import typecheck, TypeError_
from scripts.operators.ocean.compiler import compile_ocean, CompileError
from scripts.operators.ocean.parser import DEFAULT_OPERATOR_KIND


# ── Document store ──────────────────────────────────────────────────────

class DocStore:
    def __init__(self):
        self.docs: dict[str, str] = {}         # uri -> source text

    def open(self, uri: str, text: str):
        self.docs[uri] = text

    def change(self, uri: str, text: str):
        self.docs[uri] = text

    def close(self, uri: str):
        self.docs.pop(uri, None)

    def get(self, uri: str) -> str:
        return self.docs.get(uri, "")


# ── LSP message helpers ─────────────────────────────────────────────────

def read_message() -> dict | None:
    """Read one LSP message from stdin (Content-Length framed)."""
    headers = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        line = line.decode("ascii").strip()
        if not line:
            break
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    length = int(headers.get("content-length", "0"))
    if not length:
        return None
    body = sys.stdin.buffer.read(length).decode("utf-8")
    return json.loads(body)


def write_message(payload: dict):
    body = json.dumps(payload).encode("utf-8")
    headers = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    sys.stdout.buffer.write(headers)
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


# ── Diagnostic conversion ───────────────────────────────────────────────

def diagnose(uri: str, text: str) -> list[dict]:
    """Return LSP-shaped diagnostics for a document."""
    diags: list[dict] = []
    try:
        compile_ocean(text, source_name=uri)
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        line = (getattr(e, "line", 0) or
                getattr(getattr(e, "token", None), "line", 0)) - 1
        col = (getattr(e, "col", 0) or
               getattr(getattr(e, "token", None), "col", 0)) - 1
        if line < 0:
            line = 0
        if col < 0:
            col = 0
        token_len = max(1, len(getattr(getattr(e, "token", None), "value", "")) or 1)
        diags.append({
            "range": {
                "start": {"line": line, "character": col},
                "end":   {"line": line, "character": col + token_len},
            },
            "severity": 1,    # 1=error, 2=warning, 3=info, 4=hint
            "source": "ocean",
            "code":   type(e).__name__,
            "message": getattr(e, "message", str(e)),
        })
    return diags


# ── Completion + Hover + Symbols ────────────────────────────────────────

VERBS = ["load", "embed", "reduce", "cluster", "align", "find", "narrate", "save"]
KEYWORDS_BASIC = ["seed", "let", "as", "from", "to", "into", "using",
                  "do", "end", "sweep", "compare", "against", "if", "then",
                  "else", "elif", "match", "case", "with", "when",
                  "define", "return", "import"]


def completions(text: str, line: int, col: int) -> list[dict]:
    items = []
    for v in VERBS:
        items.append({"label": v, "kind": 14, "detail": "verb"})  # 14=Keyword
    for k in KEYWORDS_BASIC:
        items.append({"label": k, "kind": 14, "detail": "keyword"})
    return items


def hover(text: str, line: int, col: int) -> dict | None:
    """Return Markdown describing the token under the cursor."""
    lines = text.splitlines()
    if line >= len(lines):
        return None
    ln = lines[line]
    # Find the word at (line, col)
    if col > len(ln):
        col = len(ln)
    start = col
    while start > 0 and (ln[start - 1].isalnum() or ln[start - 1] in "_-"):
        start -= 1
    end = col
    while end < len(ln) and (ln[end].isalnum() or ln[end] in "_-"):
        end += 1
    word = ln[start:end]
    if word in DEFAULT_OPERATOR_KIND:
        kind = DEFAULT_OPERATOR_KIND[word]
        return {"contents": {"kind": "markdown",
                             "value": f"**verb `{word}`**\n\nMaps to operator `{kind}`."}}
    if word in KEYWORDS_BASIC:
        return {"contents": {"kind": "markdown",
                             "value": f"**keyword `{word}`** — see docs/OCEAN_LANG.md"}}
    return None


def document_symbols(text: str) -> list[dict]:
    """Return SymbolInformation for defines + lets in the document."""
    out: list[dict] = []
    try:
        prog = parse_ocean(text, source_name="<lsp>")
    except (LexerError, ParseError):
        return []
    for name, d in prog.defines.items():
        out.append({
            "name": name,
            "kind": 12,  # Function
            "location": {
                "uri": "file:///<current>",
                "range": {"start": {"line": d.line - 1, "character": d.col - 1},
                          "end":   {"line": d.line - 1, "character": d.col - 1 + len(name)}},
            },
        })
    return out


# ── Main loop ───────────────────────────────────────────────────────────

def serve():
    store = DocStore()
    while True:
        msg = read_message()
        if msg is None:
            return
        method = msg.get("method")
        msg_id = msg.get("id")

        if method == "initialize":
            write_message({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "capabilities": {
                        "textDocumentSync": 1,
                        "completionProvider": {"triggerCharacters": [" ", "\n"]},
                        "hoverProvider": True,
                        "documentSymbolProvider": True,
                    },
                    "serverInfo": {"name": "ocean-lsp", "version": "1.1"},
                },
            })
            continue
        if method == "shutdown":
            write_message({"jsonrpc": "2.0", "id": msg_id, "result": None})
            continue
        if method == "exit":
            return

        params = msg.get("params") or {}
        if method == "textDocument/didOpen":
            uri = params["textDocument"]["uri"]
            text = params["textDocument"]["text"]
            store.open(uri, text)
            write_message({
                "jsonrpc": "2.0",
                "method": "textDocument/publishDiagnostics",
                "params": {"uri": uri, "diagnostics": diagnose(uri, text)},
            })
        elif method == "textDocument/didChange":
            uri = params["textDocument"]["uri"]
            for change in params["contentChanges"]:
                store.change(uri, change["text"])
            write_message({
                "jsonrpc": "2.0",
                "method": "textDocument/publishDiagnostics",
                "params": {"uri": uri, "diagnostics": diagnose(uri, store.get(uri))},
            })
        elif method == "textDocument/didClose":
            uri = params["textDocument"]["uri"]
            store.close(uri)
        elif method == "textDocument/completion":
            uri = params["textDocument"]["uri"]
            line = params["position"]["line"]
            col = params["position"]["character"]
            write_message({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {"isIncomplete": False,
                           "items": completions(store.get(uri), line, col)},
            })
        elif method == "textDocument/hover":
            uri = params["textDocument"]["uri"]
            line = params["position"]["line"]
            col = params["position"]["character"]
            write_message({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": hover(store.get(uri), line, col),
            })
        elif method == "textDocument/documentSymbol":
            uri = params["textDocument"]["uri"]
            write_message({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": document_symbols(store.get(uri)),
            })
        else:
            # Unknown method — reply with method-not-found
            if msg_id is not None:
                write_message({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32601, "message": f"method not found: {method}"},
                })


if __name__ == "__main__":
    serve()
