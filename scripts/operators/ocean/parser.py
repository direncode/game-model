"""OCEAN parser — tokens -> AST.

Recursive descent, hand-written. Each method returns an AST node and
advances the token stream. Errors include line + column + carat.
"""
from __future__ import annotations

from .lexer import Token, TT, tokenize
from .ast import (
    Program, SeedDecl, VerbStmt, LetStmt, SweepStmt, CompareStmt,
    IntLit, FloatLit, StringLit, PathLit, IdentRef,
)


# Verb → default operator-kind. Configurable via 'using <variant>'.
DEFAULT_OPERATOR_KIND = {
    "load":    "source.ndjson",
    "embed":   "embed.tfidf_jl",
    "cluster": "cluster.tcd_recursive_loop",
    "align":   "align.module",
    "find":    "align.dispersion",
    "save":    "persist.json",
}

# Variant name → operator kind, indexed by the verb.
EMBED_VARIANTS = {
    "tf-idf":              "embed.tfidf_jl",
    "tfidf":               "embed.tfidf_jl",
    "content fingerprint": "embed.content_fp48",
    "content":             "embed.content_fp48",
    "one-hot numeric":     "embed.onehot_numeric",
    "one-hot":             "embed.onehot_numeric",
    "numeric":             "embed.onehot_numeric",
}


class ParseError(Exception):
    def __init__(self, message: str, token: Token, source_lines: list[str], suggestion: str | None = None):
        super().__init__(message)
        self.message = message
        self.token = token
        self.source_lines = source_lines
        self.suggestion = suggestion

    def pretty(self, source_name: str = "<input>") -> str:
        line_no = self.token.line
        col = self.token.col
        src = self.source_lines[line_no - 1] if 0 < line_no <= len(self.source_lines) else ""
        caret = " " * (col - 1) + "^" * max(1, len(self.token.value))
        out = (
            f"ocean: error at {source_name}:{line_no}:{col}\n\n"
            f"  {line_no:>3} | {src}\n"
            f"      | {caret}\n\n"
            f"{self.message}"
        )
        if self.suggestion:
            out += f"\n\nhint: {self.suggestion}"
        return out


# ── Parser state ────────────────────────────────────────────────────────

class Parser:
    def __init__(self, tokens: list[Token], source_lines: list[str]):
        self.tokens = tokens
        self.pos = 0
        self.source_lines = source_lines

    # ── helpers ───────────────────────────────────────────────────────

    def peek(self, offset: int = 0) -> Token:
        idx = min(self.pos + offset, len(self.tokens) - 1)
        return self.tokens[idx]

    def advance(self) -> Token:
        t = self.tokens[self.pos]
        if t.type != TT.EOF:
            self.pos += 1
        return t

    def expect(self, *types: TT, value: str | None = None) -> Token:
        t = self.peek()
        if t.type not in types:
            wanted = " or ".join(x.name for x in types)
            raise ParseError(f"expected {wanted}, got {t.type.name} {t.value!r}",
                             t, self.source_lines)
        if value is not None and t.value != value:
            raise ParseError(f"expected {value!r}, got {t.value!r}",
                             t, self.source_lines)
        return self.advance()

    def consume_keyword(self, *names: str) -> bool:
        """If the next token is a keyword in `names`, consume it and return True."""
        t = self.peek()
        if t.type == TT.KEYWORD and t.value in names:
            self.advance()
            return True
        return False

    def skip_newlines(self):
        while self.peek().type == TT.NEWLINE:
            self.advance()

    # ── top-level ──────────────────────────────────────────────────────

    def parse_program(self) -> Program:
        self.skip_newlines()
        prog = Program(seed=42)
        if self.peek().type == TT.KEYWORD and self.peek().value == "seed":
            seed_tok = self.advance()
            v = self.expect(TT.INT)
            prog.seed = int(v.value)
            self.skip_newlines()

        while self.peek().type != TT.EOF:
            stmt = self.parse_statement()
            if stmt is not None:
                prog.statements.append(stmt)
            self.skip_newlines()
        return prog

    def parse_statement(self):
        t = self.peek()
        if t.type == TT.KEYWORD and t.value == "let":
            return self.parse_let()
        if t.type == TT.KEYWORD and t.value == "sweep":
            return self.parse_sweep()
        if t.type == TT.KEYWORD and t.value == "compare":
            return self.parse_compare()
        if t.type == TT.VERB:
            return self.parse_verb_stmt()
        if t.type == TT.NEWLINE:
            self.advance()
            return None
        if t.type == TT.EOF:
            return None
        raise ParseError(
            f"expected statement (let / sweep / compare / verb), got {t.type.name} {t.value!r}",
            t, self.source_lines,
            suggestion="every line must start with 'let', 'sweep', 'compare', or a verb (load / embed / cluster / align / find / save)",
        )

    # ── let ────────────────────────────────────────────────────────────

    def parse_let(self) -> LetStmt:
        let_tok = self.expect(TT.KEYWORD, value="let")
        name = self.expect(TT.IDENT).value
        self.expect(TT.EQ)
        # The expression must be a verb_stmt (only kind we support)
        if self.peek().type != TT.VERB:
            t = self.peek()
            raise ParseError(
                f"'let {name} = ...' must be followed by a verb (load/embed/cluster/...), got {t.value!r}",
                t, self.source_lines,
            )
        expr = self.parse_verb_stmt()
        return LetStmt(name=name, expr=expr, line=let_tok.line, col=let_tok.col)

    # ── sweep ──────────────────────────────────────────────────────────

    def parse_sweep(self) -> SweepStmt:
        sweep_tok = self.expect(TT.KEYWORD, value="sweep")
        # Allow keyword tokens as variable names (users naturally write
        # `sweep seed`, `sweep scale`, where some words are reserved).
        var_tok = self.peek()
        if var_tok.type not in (TT.IDENT, TT.KEYWORD):
            raise ParseError(f"expected variable name after 'sweep', got {var_tok.value!r}",
                             var_tok, self.source_lines)
        var = self.advance().value
        self.expect(TT.KEYWORD, value="from")
        start = int(self.expect(TT.INT).value)
        self.expect(TT.KEYWORD, value="to")
        end = int(self.expect(TT.INT).value)
        step = 1
        if self.peek().type == TT.KEYWORD and self.peek().value == "step":
            self.advance()
            step = int(self.expect(TT.INT).value)
        self.expect(TT.KEYWORD, value="do")
        self.skip_newlines()
        body = []
        while not (self.peek().type == TT.KEYWORD and self.peek().value == "end"):
            if self.peek().type == TT.EOF:
                raise ParseError("missing 'end' to close sweep block",
                                 sweep_tok, self.source_lines,
                                 suggestion="add an 'end' line after the sweep body")
            stmt = self.parse_statement()
            if stmt is not None:
                body.append(stmt)
            self.skip_newlines()
        self.advance()  # consume 'end'
        return SweepStmt(var=var, start=start, end=end, step=step, body=body,
                         line=sweep_tok.line, col=sweep_tok.col)

    # ── compare ────────────────────────────────────────────────────────

    def parse_compare(self) -> CompareStmt:
        cmp_tok = self.expect(TT.KEYWORD, value="compare")
        self.skip_newlines()
        left = self.parse_verb_stmt()
        self.skip_newlines()
        self.expect(TT.KEYWORD, value="against")
        self.skip_newlines()
        right = self.parse_verb_stmt()
        on_metric = None
        on_label = None
        if self.consume_keyword("on"):
            metric_tok = self.expect(TT.KEYWORD, TT.IDENT)
            on_metric = metric_tok.value
            self.expect(TT.KEYWORD, value="of")
            label_tok = self.expect(TT.IDENT, TT.KEYWORD)
            on_label = label_tok.value
        return CompareStmt(left=left, right=right, on_metric=on_metric,
                           on_label=on_label, line=cmp_tok.line, col=cmp_tok.col)

    # ── verb_stmt ──────────────────────────────────────────────────────

    def parse_verb_stmt(self) -> VerbStmt:
        verb_tok = self.expect(TT.VERB)
        verb = verb_tok.value
        kind = DEFAULT_OPERATOR_KIND.get(verb)
        if kind is None:
            raise ParseError(f"unknown verb {verb!r}",
                             verb_tok, self.source_lines)

        args: dict = {}
        bind_name: str | None = None
        from_ref: str | None = None

        # Per-verb decision: does 'using' end the phrase loop (variant
        # selector) or stay inside it (part of the verb's grammar)?
        VERBS_USING_AS_VARIANT = {"embed", "cluster"}
        # Per-verb stmt terminators (always end the phrase loop).
        STMT_TERMS = {"as", "end", "against", "do"}
        # 'on' is a sweep/compare boundary, not an arg keyword.

        while True:
            t = self.peek()
            if t.type in (TT.NEWLINE, TT.EOF):
                break
            if t.type == TT.KEYWORD and t.value in STMT_TERMS:
                break
            if t.type == TT.KEYWORD and t.value == "on":
                # 'on' only ends the phrase loop in compare contexts (cluster doesn't use it)
                break
            if t.type == TT.KEYWORD and t.value == "using" and verb in VERBS_USING_AS_VARIANT:
                break  # variant selector takes over
            if t.type == TT.VERB:
                # Next statement starting; bail out
                break
            # 'from <name>' — explicit upstream
            if t.type == TT.KEYWORD and t.value == "from":
                self.advance()
                ref_tok = self.expect(TT.IDENT)
                from_ref = ref_tok.value
                continue
            # Other phrase patterns are verb-specific; delegate
            consumed = self._consume_phrase(verb, args)
            if not consumed:
                # Stop on unexpected tokens to let parser progress
                break

        # 'as <name>'
        if self.consume_keyword("as"):
            bind_name = self.expect(TT.IDENT).value

        # 'using <variant-or-ident>' — for embed, override kind; otherwise pass-through.
        if self.consume_keyword("using"):
            variant_words = self._consume_variant_words()
            variant = " ".join(variant_words)
            if verb == "embed":
                if variant in EMBED_VARIANTS:
                    kind = EMBED_VARIANTS[variant]
                else:
                    raise ParseError(
                        f"unknown embed variant {variant!r}",
                        verb_tok, self.source_lines,
                        suggestion=f"valid variants: {', '.join(sorted(EMBED_VARIANTS))}",
                    )
            elif verb == "cluster":
                # 'using tcd recursive loop' — just confirms the default; no other variant yet.
                # Accept silently.
                pass
            # Other verbs may not have variants yet; silent accept.

        return VerbStmt(
            verb=verb, operator_kind=kind, args=args,
            bind_name=bind_name, from_ref=from_ref,
            line=verb_tok.line, col=verb_tok.col,
        )

    # ── phrase consumers (verb-aware) ──────────────────────────────────

    def _consume_phrase(self, verb: str, args: dict) -> bool:
        """Consume one phrase (returns True) or do nothing (returns False)."""
        t = self.peek()

        # === LOAD ===
        if verb == "load":
            if t.type == TT.PATH:
                args["path"] = self.advance().value
                return True
            if t.type == TT.STRING:
                args["path"] = self.advance().value
                return True
            if t.type == TT.KEYWORD and t.value == "take":
                self.advance()
                args["target"] = int(self.expect(TT.INT).value)
                # 'records' (optional)
                if self.peek().type == TT.KEYWORD and self.peek().value in ("records", "record"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "balanced":
                self.advance()
                self.expect(TT.KEYWORD, value="by")
                args["stratify_by"] = self.expect(TT.IDENT, TT.KEYWORD).value
                return True
            if t.type == TT.KEYWORD and t.value == "label":
                # 'label field is <ident>'
                self.advance()
                self.expect(TT.KEYWORD, value="field")
                self.expect(TT.KEYWORD, value="is")
                args["label_field"] = self.expect(TT.IDENT, TT.KEYWORD).value
                return True
            if t.type == TT.KEYWORD and t.value == "text":
                # 'text field is <ident>'
                self.advance()
                self.expect(TT.KEYWORD, value="field")
                self.expect(TT.KEYWORD, value="is")
                args["text_field"] = self.expect(TT.IDENT, TT.KEYWORD).value
                return True

        # === EMBED ===
        if verb == "embed":
            # 'text' is just a marker word
            if t.type == TT.KEYWORD and t.value == "text":
                self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "into":
                self.advance()
                args["dims"] = int(self.expect(TT.INT).value)
                if self.peek().type == TT.KEYWORD and self.peek().value in ("dimensions", "dimension"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "with":
                # 'with min_df = N' / 'with max_features = N' / 'with max_df = F'
                self.advance()
                key_tok = self.expect(TT.IDENT, TT.KEYWORD)
                self.expect(TT.EQ)
                val = self._consume_number()
                args[key_tok.value] = val
                return True

        # === CLUSTER ===
        if verb == "cluster":
            # The default identifier (Z) coming in is implicit; no token needed.
            if t.type == TT.KEYWORD and t.value in ("for",):
                # 'for N rounds'
                self.advance()
                args["iters"] = int(self.expect(TT.INT).value)
                if self.peek().type == TT.KEYWORD and self.peek().value in ("rounds", "round"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "max":
                self.advance()
                args["max_modules"] = int(self.expect(TT.INT).value)
                if self.peek().type == TT.KEYWORD and self.peek().value in ("modules", "module"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "energy":
                self.advance()
                self.expect(TT.EQ)
                # 'corpus mean' or 'normal anchored on <label>'
                w = self.advance()
                if w.value == "corpus":
                    self.expect(TT.KEYWORD, value="mean")
                    args["energy"] = "corpus_mean"
                elif w.value == "normal":
                    self.expect(TT.KEYWORD, value="anchored")
                    self.expect(TT.KEYWORD, value="on")
                    args["energy"] = "normal_centroid"
                    args["normal_label"] = self.expect(TT.IDENT, TT.KEYWORD).value
                else:
                    raise ParseError(
                        f"unexpected energy form {w.value!r}", w, self.source_lines,
                        suggestion="use 'energy = corpus mean' or 'energy = normal anchored on <label>'",
                    )
                return True
            if t.type == TT.KEYWORD and t.value == "crystallize":
                self.advance()
                self.expect(TT.KEYWORD, value="every")
                args["crystallize_every"] = int(self.expect(TT.INT).value)
                return True

        # === ALIGN ===
        if verb == "align":
            if t.type == TT.KEYWORD and t.value == "modules":
                self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "using":
                # 'using K nearest records' — part of align's grammar
                self.advance()
                args["k_nearest"] = int(self.expect(TT.INT).value)
                if self.peek().type == TT.KEYWORD and self.peek().value == "nearest":
                    self.advance()
                if self.peek().type == TT.KEYWORD and self.peek().value in ("records", "record"):
                    self.advance()
                return True
            if t.type == TT.INT:
                args["k_nearest"] = int(self.advance().value)
                if self.peek().type == TT.KEYWORD and self.peek().value == "nearest":
                    self.advance()
                if self.peek().type == TT.KEYWORD and self.peek().value in ("records", "record"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "fine":
                # 'fine label field is <ident>'
                self.advance()
                self.expect(TT.KEYWORD, value="label")
                self.expect(TT.KEYWORD, value="field")
                self.expect(TT.KEYWORD, value="is")
                args["fine_label_field"] = self.expect(TT.IDENT, TT.KEYWORD).value
                return True

        # === FIND ===
        if verb == "find":
            if t.type == TT.KEYWORD and t.value == "dispersion":
                self.advance()
                # 'of each label' — accept as a fixed phrase
                if self.consume_keyword("of"):
                    self.consume_keyword("each")
                    self.consume_keyword("label")
                return True

        # === SAVE ===
        if verb == "save":
            if t.type == TT.KEYWORD and t.value == "to":
                self.advance()
                # Collect the whole path expression. The lexer fragments paths
                # at $ for interpolation, so we read PATH/IDENT/INTERP runs
                # until we hit a non-path token.
                parts = []
                while self.peek().type in (TT.PATH, TT.IDENT, TT.INTERP, TT.STRING):
                    parts.append(self.advance())
                if not parts:
                    raise ParseError("expected a file path after 'to'",
                                     self.peek(), self.source_lines)
                if len(parts) == 1 and parts[0].type in (TT.PATH, TT.STRING):
                    args["output"] = parts[0].value
                else:
                    args["output_template"] = parts
                return True
            if t.type == TT.IDENT:
                # Bare ident: could be the binding name to save (not implemented here)
                args["save_name"] = self.advance().value
                return True
            if t.type == TT.PATH or t.type == TT.STRING:
                # Allow 'save <path>' shorthand
                args["output"] = self.advance().value
                return True

        return False

    def _consume_number(self):
        t = self.peek()
        if t.type == TT.INT:
            self.advance()
            return int(t.value)
        if t.type == TT.FLOAT:
            self.advance()
            return float(t.value)
        raise ParseError(f"expected a number, got {t.value!r}", t, self.source_lines)

    def _consume_variant_words(self) -> list[str]:
        """Read consecutive words until newline/terminator. Used after 'using'."""
        words = []
        while True:
            t = self.peek()
            if t.type in (TT.NEWLINE, TT.EOF):
                break
            if t.type == TT.KEYWORD and t.value in {"as", "with", "for", "max",
                                                     "energy", "crystallize", "from",
                                                     "into", "by", "on", "of", "do", "end", "against"}:
                break
            if t.type in (TT.VERB,):
                break
            if t.type == TT.IDENT or t.type == TT.KEYWORD:
                words.append(self.advance().value)
                continue
            break
        return words


def parse_ocean(text: str, source_name: str = "<input>") -> Program:
    """Top-level entry: source text → Program AST.

    Raises LexerError or ParseError with .pretty(source_name) for diagnostics.
    """
    tokens = tokenize(text)
    source_lines = text.splitlines()
    parser = Parser(tokens, source_lines)
    prog = parser.parse_program()
    prog.source_name = source_name
    prog.source_text = text
    return prog
