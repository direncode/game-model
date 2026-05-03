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
    KEYWORD = "KEYWORD"          # seed let in as on from to into using with by of do end
                                  # sweep compare against parallel import step
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
    NEWLINE = "NEWLINE"           # \n (significant)
    INTERP  = "INTERP"            # ${name}
    EOF     = "EOF"


# Keywords vs Verbs is a distinction the parser cares about.
KEYWORDS = {
    "seed", "let", "in", "as", "on", "from", "to", "into",
    "using", "with", "by", "of", "do", "end", "sweep",
    "compare", "against", "parallel", "import", "step", "take",
    "balanced", "field", "is", "for", "rounds", "round", "max",
    "modules", "module", "energy", "crystallize", "every", "nearest",
    "records", "record", "dispersion", "each", "label", "fine", "anchored",
    "dimensions", "dimension", "loop", "recursive", "tcd", "tf-idf",
    "tfidf", "content", "fingerprint", "one-hot", "numeric", "mean",
    "corpus", "normal", "text",
}
VERBS = {"load", "embed", "cluster", "align", "find", "narrate", "save", "reduce"}


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

        # String literals: "..." or '...'
        if ch in ("\"", "'"):
            quote = ch
            j = i + 1
            buf = []
            while j < len(text) and text[j] != quote:
                if text[j] == "\\" and j + 1 < len(text):
                    buf.append(text[j + 1])
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
            while j < len(text) and (
                text[j].isalnum() or text[j] in "_./-"
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
