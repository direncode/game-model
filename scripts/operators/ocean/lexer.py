"""OCEAN lexer — source text -> stream of tokens.

Hand-written, no external deps. Each Token carries its source location so
parser errors can point at the exact column.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterator


class TT(Enum):
    """Token type."""
    KEYWORD = "KEYWORD"          # reserved word
    VERB    = "VERB"              # load embed cluster align find narrate save reduce
    IDENT   = "IDENT"             # lowercase_with_underscores
    INT     = "INT"               # 42, 1500, 10_000
    FLOAT   = "FLOAT"             # 0.85, 1.5e-3
    STRING  = "STRING"            # "..." or '...'
    PATH    = "PATH"              # foo/bar.ndjson
    EQ      = "EQ"                # =
    COMMA   = "COMMA"             # ,
    LBRACE  = "LBRACE"            # {
    RBRACE  = "RBRACE"            # }
    LPAREN  = "LPAREN"            # (
    RPAREN  = "RPAREN"            # )
    COLON   = "COLON"             # : (type annotation)
    DOT     = "DOT"               # . (namespace access for imports)
    OP      = "OP"                # comparison / arithmetic
    NEWLINE = "NEWLINE"           # \n (significant)
    INTERP  = "INTERP"            # ${name}
    EOF     = "EOF"


# Keywords vs Verbs is a distinction the parser cares about.
KEYWORDS = {
    # version + structure
    "require", "seed", "let", "in", "as", "on", "from", "to", "into",
    "using", "with", "by", "of", "do", "end", "sweep",
    "compare", "against", "parallel", "import", "step", "take",
    "balanced", "field", "is", "for", "rounds", "round", "max",
    "modules", "module", "energy", "crystallize", "every", "nearest",
    "records", "record", "dispersion", "each", "label", "fine", "anchored",
    "dimensions", "dimension", "loop", "recursive", "tcd", "tf-idf",
    "tfidf", "content", "fingerprint", "one-hot", "numeric", "mean",
    "corpus", "normal", "text",
    # v1 additions
    "define", "return", "if", "then", "else", "elif",
    "true", "false", "not", "and", "or",
    "ocean",  # used in 'require ocean 1.0'
    "btut",   # used in 'using btut'
    "survivors", "budget", "target",
    "style", "technical", "plain", "terse",
    # v1.1 additions
    "match",  "case",  "when",
    "ok",     "err",   "some",  "none",
    "try",    "catch", "throw",
    "extern", "fn",    "spawn", "join",
    "macro",  "quote", "unquote",
}
VERBS = {"load", "embed", "cluster", "align", "find", "narrate", "save", "reduce"}

# Comparison + arithmetic operators (multi-char)
OPERATORS = {
    "==", "!=", "<=", ">=", "<", ">",
    "+", "-", "*", "/",
}


@dataclass
class Token:
    type: TT
    value: str
    line: int
    col: int

    def __repr__(self):
        return f"Token({self.type.name}, {self.value!r}, {self.line}:{self.col})"


class LexerError(Exception):
    def __init__(self, message: str, line: int, col: int, source_line: str):
        super().__init__(message)
        self.line = line
        self.col = col
        self.source_line = source_line
        self.message = message

    def pretty(self, source_name: str = "<input>") -> str:
        caret = " " * (self.col - 1) + "^"
        return (
            f"ocean: error at {source_name}:{self.line}:{self.col}\n\n"
            f"  {self.line:>3} | {self.source_line}\n"
            f"      | {caret}\n\n"
            f"{self.message}"
        )


def tokenize(text: str) -> list[Token]:
    """Source text -> list of tokens (terminated with EOF)."""
    out: list[Token] = []
    lines = text.splitlines()

    i = 0
    line_no = 1
    line_start = 0  # index in text where current line begins

    while i < len(text):
        ch = text[i]

        # Newline (significant — separates statements)
        if ch == "\n":
            if out and out[-1].type != TT.NEWLINE:
                out.append(Token(TT.NEWLINE, "\\n", line_no, i - line_start + 1))
            line_no += 1
            i += 1
            line_start = i
            continue

        # Whitespace
        if ch in " \t\r":
            i += 1
            continue

        # Comments
        if ch == "#":
            while i < len(text) and text[i] != "\n":
                i += 1
            continue

        col = i - line_start + 1

        # Two-char operators first (==, !=, <=, >=)
        if i + 1 < len(text):
            two = text[i:i + 2]
            if two in ("==", "!=", "<=", ">="):
                out.append(Token(TT.OP, two, line_no, col))
                i += 2
                continue

        # Punctuation
        if ch == "=":
            out.append(Token(TT.EQ, "=", line_no, col))
            i += 1
            continue
        if ch == ",":
            out.append(Token(TT.COMMA, ",", line_no, col))
            i += 1
            continue
        if ch == "{":
            out.append(Token(TT.LBRACE, "{", line_no, col))
            i += 1
            continue
        if ch == "}":
            out.append(Token(TT.RBRACE, "}", line_no, col))
            i += 1
            continue
        if ch == "(":
            out.append(Token(TT.LPAREN, "(", line_no, col))
            i += 1
            continue
        if ch == ")":
            out.append(Token(TT.RPAREN, ")", line_no, col))
            i += 1
            continue
        if ch == ":":
            out.append(Token(TT.COLON, ":", line_no, col))
            i += 1
            continue
        # Single-char arith / comparison.
        # `/` is ambiguous: division vs path-start. Disambiguate by lookahead —
        # if it leads into a path-shaped word, treat as path-start; else OP.
        if ch == "/":
            j = i + 1
            while j < len(text) and (text[j].isalnum() or text[j] in "_./-\\"):
                j += 1
            candidate = text[i:j]
            looks_like_path = ("/" in candidate[1:] or
                               any(candidate.endswith("." + ext) for ext in
                                   ("ndjson", "csv", "tsv", "json", "yaml",
                                    "yml", "txt", "ocean")))
            if looks_like_path and j > i + 1:
                out.append(Token(TT.PATH, candidate, line_no, col))
                i = j
                continue
            out.append(Token(TT.OP, "/", line_no, col))
            i += 1
            continue
        if ch in "<>+*":
            out.append(Token(TT.OP, ch, line_no, col))
            i += 1
            continue
        # `-` is tricky — could be unary on a numeric (handled in numeric branch
        # below) or binary subtraction. Disambiguate: if previous token is a
        # value (INT, FLOAT, IDENT, RPAREN), it's binary; else unary.
        if ch == "-":
            prev = out[-1] if out else None
            if prev and prev.type in (TT.INT, TT.FLOAT, TT.IDENT, TT.RPAREN, TT.STRING):
                out.append(Token(TT.OP, "-", line_no, col))
                i += 1
                continue
            # else: fall through to numeric handling below

        # String literals: "..." or '...'
        if ch in ("\"", "'"):
            quote = ch
            j = i + 1
            buf = []
            ESCAPE_MAP = {"n": "\n", "t": "\t", "r": "\r",
                          "\\": "\\", '"': '"', "'": "'"}
            while j < len(text) and text[j] != quote:
                if text[j] == "\\" and j + 1 < len(text):
                    nxt = text[j + 1]
                    buf.append(ESCAPE_MAP.get(nxt, nxt))
                    j += 2
                else:
                    buf.append(text[j])
                    j += 1
            if j >= len(text):
                src_line = lines[line_no - 1] if line_no - 1 < len(lines) else ""
                raise LexerError(f"unterminated {quote}-string", line_no, col, src_line)
            out.append(Token(TT.STRING, "".join(buf), line_no, col))
            i = j + 1
            continue

        # ${interp} — only meaningful in path context, but we tokenize it anywhere
        if ch == "$" and i + 1 < len(text) and text[i + 1] == "{":
            j = i + 2
            buf = []
            while j < len(text) and text[j] != "}":
                buf.append(text[j])
                j += 1
            if j >= len(text):
                src_line = lines[line_no - 1] if line_no - 1 < len(lines) else ""
                raise LexerError("unterminated ${...} interpolation", line_no, col, src_line)
            out.append(Token(TT.INTERP, "".join(buf).strip(), line_no, col))
            i = j + 1
            continue

        # Numeric literals (int, float, with underscore separators)
        if ch.isdigit() or (ch == "-" and i + 1 < len(text) and text[i + 1].isdigit()):
            j = i
            if text[j] == "-":
                j += 1
            has_dot = False
            has_e = False
            while j < len(text) and (text[j].isdigit() or text[j] in "._eE+-"):
                c = text[j]
                if c == ".":
                    if has_dot or has_e:
                        break
                    has_dot = True
                elif c in "eE":
                    if has_e:
                        break
                    has_e = True
                elif c in "+-" and j > i and text[j - 1] not in "eE":
                    break
                j += 1
            literal = text[i:j].replace("_", "")
            ttype = TT.FLOAT if (has_dot or has_e) else TT.INT
            out.append(Token(ttype, literal, line_no, col))
            i = j
            continue

        # Identifier / keyword / verb / path
        # Path heuristic: if the run contains '.' followed by a known suffix,
        # treat the whole run (incl slashes / dots / hyphens / dollars / braces
        # for interp) as a PATH token.
        if ch.isalpha() or ch == "_" or ch == "/" or ch == ".":
            j = i
            # Special-case Windows drive letters: 'C:/' or 'C:\\'.
            if (j + 2 < len(text) and text[j].isalpha()
                    and text[j + 1] == ":" and text[j + 2] in "/\\"):
                j += 2
            while j < len(text) and (
                text[j].isalnum() or text[j] in "_./-\\"
            ):
                j += 1
            word = text[i:j]
            # Path?
            if "." in word and any(word.endswith("." + ext) for ext in
                                    ("ndjson", "csv", "tsv", "json", "yaml", "yml", "txt", "ocean")):
                out.append(Token(TT.PATH, word, line_no, col))
                i = j
                continue
            if "/" in word or "\\" in word:
                # Path-like even without recognized extension
                out.append(Token(TT.PATH, word, line_no, col))
                i = j
                continue
            wl = word.lower()
            if wl in VERBS:
                out.append(Token(TT.VERB, wl, line_no, col))
            elif wl in KEYWORDS:
                out.append(Token(TT.KEYWORD, wl, line_no, col))
            else:
                out.append(Token(TT.IDENT, word, line_no, col))
            i = j
            continue

        # Unknown character
        src_line = lines[line_no - 1] if line_no - 1 < len(lines) else ""
        raise LexerError(f"unexpected character {ch!r}", line_no, col, src_line)

    # Strip trailing newlines, then EOF
    while out and out[-1].type == TT.NEWLINE:
        out.pop()
    out.append(Token(TT.EOF, "", line_no, 1))
    return out


def lex_lines(text: str) -> list[str]:
    """Helper: source lines for error pretty-printing."""
    return text.splitlines()
