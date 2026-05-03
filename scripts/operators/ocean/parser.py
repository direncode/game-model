"""OCEAN parser — tokens -> AST.

Recursive descent, hand-written. Each method returns an AST node and
advances the token stream. Errors include line + column + carat.
"""
from __future__ import annotations

from .lexer import Token, TT, tokenize
from .ast import (
    Program, SeedDecl, VerbStmt, LetStmt, SweepStmt, CompareStmt,
    IntLit, FloatLit, StringLit, PathLit, IdentRef,
    BoolLit, BinaryOp, UnaryOp, CallExpr, TypeAnnotation, Param,
    DefineDecl, IfStmt, ReturnStmt, ImportStmt, RequireDecl,
    ParallelStmt,
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

        # Optional 'require ocean X.Y[.Z]'
        if self.peek().type == TT.KEYWORD and self.peek().value == "require":
            self.advance()
            self.expect(TT.KEYWORD, value="ocean")
            major = 0
            minor = 0
            patch = 0
            # The version may lex as INT then '.' then INT, OR as FLOAT (1.0),
            # OR as INT (just '1'). Handle all three.
            v_tok = self.peek()
            if v_tok.type == TT.FLOAT:
                self.advance()
                parts = v_tok.value.split(".")
                major = int(parts[0])
                minor = int(parts[1]) if len(parts) > 1 else 0
            elif v_tok.type == TT.INT:
                self.advance()
                major = int(v_tok.value)
                # The lexer's path-detector eats '.' greedily — but a bare
                # numeric followed by `.<int>` would have been lexed as FLOAT,
                # so getting here means just an int (e.g. 'require ocean 1').
            else:
                raise ParseError(
                    f"expected version number after 'require ocean', got {v_tok.value!r}",
                    v_tok, self.source_lines,
                )
            prog.require_version = (major, minor, patch)
            self.skip_newlines()

        # Optional 'seed N'
        if self.peek().type == TT.KEYWORD and self.peek().value == "seed":
            self.advance()
            v = self.expect(TT.INT)
            prog.seed = int(v.value)
            self.skip_newlines()

        # Imports come before any statements
        while self.peek().type == TT.KEYWORD and self.peek().value == "import":
            imp = self.parse_import()
            prog.imports.append(imp)
            self.skip_newlines()

        # Mixed body: define decls + statements
        while self.peek().type != TT.EOF:
            if self.peek().type == TT.KEYWORD and self.peek().value == "define":
                d = self.parse_define()
                prog.defines[d.name] = d
            else:
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
        if t.type == TT.KEYWORD and t.value == "if":
            return self.parse_if()
        if t.type == TT.KEYWORD and t.value == "return":
            return self.parse_return()
        if t.type == TT.KEYWORD and t.value == "parallel":
            return self.parse_parallel()
        if t.type == TT.VERB:
            return self.parse_verb_stmt()
        # Bare function-call as a statement: ident followed by '('
        if t.type == TT.IDENT and self.peek(1).type == TT.LPAREN:
            ident_tok = self.advance()
            return self._parse_call(ident_tok)
        if t.type == TT.NEWLINE:
            self.advance()
            return None
        if t.type == TT.EOF:
            return None
        raise ParseError(
            f"expected statement, got {t.type.name} {t.value!r}",
            t, self.source_lines,
            suggestion="every line must start with 'let', 'sweep', 'compare', 'if', 'return', 'define', or a verb",
        )

    # ── import ─────────────────────────────────────────────────────────

    def parse_import(self) -> ImportStmt:
        tok = self.advance()  # 'import'
        path_tok = self.peek()
        if path_tok.type == TT.STRING:
            path = self.advance().value
        elif path_tok.type == TT.PATH:
            path = self.advance().value
        else:
            raise ParseError(
                f"expected string or path after 'import', got {path_tok.value!r}",
                path_tok, self.source_lines,
            )
        alias = None
        if self.consume_keyword("as"):
            alias = self.expect(TT.IDENT).value
        return ImportStmt(path=path, alias=alias, line=tok.line, col=tok.col)

    # ── define ────────────────────────────────────────────────────────

    def parse_define(self) -> DefineDecl:
        tok = self.expect(TT.KEYWORD, value="define")
        name = self.expect(TT.IDENT).value
        params: list[Param] = []
        if self.peek().type == TT.LPAREN:
            self.advance()
            self.skip_newlines()
            while self.peek().type != TT.RPAREN:
                p = self._parse_param()
                params.append(p)
                self.skip_newlines()
                if self.peek().type == TT.COMMA:
                    self.advance()
                    self.skip_newlines()
            self.advance()  # ')'
        self.expect(TT.KEYWORD, value="do")
        self.skip_newlines()
        body = []
        while not (self.peek().type == TT.KEYWORD and self.peek().value == "end"):
            if self.peek().type == TT.EOF:
                raise ParseError(
                    f"missing 'end' to close define block for {name!r}",
                    tok, self.source_lines,
                )
            stmt = self.parse_statement()
            if stmt is not None:
                body.append(stmt)
            self.skip_newlines()
        self.advance()  # consume 'end'
        return DefineDecl(name=name, params=params, body=body, line=tok.line, col=tok.col)

    def _parse_param(self) -> Param:
        # Param names may shadow keywords (target / dims / records / etc.)
        # Many useful English words are keywords; accept any non-reserved
        # word in declaration position.
        tok = self.peek()
        if tok.type not in (TT.IDENT, TT.KEYWORD):
            raise ParseError(f"expected parameter name, got {tok.value!r}",
                             tok, self.source_lines)
        name_tok = self.advance()
        type_ann = None
        default = None
        if self.peek().type == TT.COLON:
            self.advance()
            type_ann = self._parse_type_ann()
        if self.peek().type == TT.EQ:
            self.advance()
            default = self._parse_literal_or_path()
        return Param(name=name_tok.value, type_ann=type_ann, default=default)

    def _parse_type_ann(self) -> TypeAnnotation:
        ident_tok = self.expect(TT.IDENT, TT.KEYWORD)
        return TypeAnnotation(name=ident_tok.value)

    def _parse_literal_or_path(self):
        t = self.peek()
        if t.type == TT.INT:
            self.advance()
            return IntLit(int(t.value), t.line, t.col)
        if t.type == TT.FLOAT:
            self.advance()
            return FloatLit(float(t.value), t.line, t.col)
        if t.type == TT.STRING:
            self.advance()
            return StringLit(t.value, t.line, t.col)
        if t.type == TT.PATH:
            self.advance()
            return PathLit(t.value, t.line, t.col)
        if t.type == TT.KEYWORD and t.value in ("true", "false"):
            self.advance()
            return BoolLit(t.value == "true", t.line, t.col)
        raise ParseError(f"expected a literal, got {t.value!r}", t, self.source_lines)

    # ── if / elif / else ──────────────────────────────────────────────

    def parse_if(self) -> IfStmt:
        tok = self.expect(TT.KEYWORD, value="if")
        cond = self.parse_expression()
        self.expect(TT.KEYWORD, value="then")
        self.skip_newlines()
        then_body = self._parse_block(("elif", "else", "end"))
        elif_branches: list[tuple] = []
        else_body = None
        while self.peek().type == TT.KEYWORD and self.peek().value == "elif":
            self.advance()
            elif_cond = self.parse_expression()
            self.expect(TT.KEYWORD, value="then")
            self.skip_newlines()
            elif_body = self._parse_block(("elif", "else", "end"))
            elif_branches.append((elif_cond, elif_body))
        if self.peek().type == TT.KEYWORD and self.peek().value == "else":
            self.advance()
            self.skip_newlines()
            else_body = self._parse_block(("end",))
        self.expect(TT.KEYWORD, value="end")
        return IfStmt(cond=cond, then_body=then_body,
                      elif_branches=elif_branches, else_body=else_body,
                      line=tok.line, col=tok.col)

    def _parse_block(self, end_kws: tuple) -> list:
        body: list = []
        while not (self.peek().type == TT.KEYWORD and self.peek().value in end_kws):
            if self.peek().type == TT.EOF:
                raise ParseError(
                    f"unexpected end of file; expected one of {end_kws}",
                    self.peek(), self.source_lines,
                )
            stmt = self.parse_statement()
            if stmt is not None:
                body.append(stmt)
            self.skip_newlines()
        return body

    # ── return ─────────────────────────────────────────────────────────

    def parse_return(self) -> ReturnStmt:
        tok = self.expect(TT.KEYWORD, value="return")
        if self.peek().type in (TT.NEWLINE, TT.EOF):
            return ReturnStmt(expr=None, line=tok.line, col=tok.col)
        expr = self.parse_expression()
        return ReturnStmt(expr=expr, line=tok.line, col=tok.col)

    # ── parallel ───────────────────────────────────────────────────────

    def parse_parallel(self) -> ParallelStmt:
        tok = self.expect(TT.KEYWORD, value="parallel")
        self.expect(TT.KEYWORD, value="do")
        self.skip_newlines()
        body = self._parse_block(("end",))
        self.advance()  # 'end'
        return ParallelStmt(body=body, line=tok.line, col=tok.col)

    # ── expression (precedence: or > and > comparison > +/- > */) ─────

    def parse_expression(self):
        return self._parse_or()

    def _parse_or(self):
        left = self._parse_and()
        while self.peek().type == TT.KEYWORD and self.peek().value == "or":
            tok = self.advance()
            right = self._parse_and()
            left = BinaryOp("or", left, right, tok.line, tok.col)
        return left

    def _parse_and(self):
        left = self._parse_not()
        while self.peek().type == TT.KEYWORD and self.peek().value == "and":
            tok = self.advance()
            right = self._parse_not()
            left = BinaryOp("and", left, right, tok.line, tok.col)
        return left

    def _parse_not(self):
        if self.peek().type == TT.KEYWORD and self.peek().value == "not":
            tok = self.advance()
            return UnaryOp("not", self._parse_not(), tok.line, tok.col)
        return self._parse_cmp()

    def _parse_cmp(self):
        left = self._parse_add()
        while self.peek().type == TT.OP and self.peek().value in ("==", "!=", "<", ">", "<=", ">="):
            tok = self.advance()
            right = self._parse_add()
            left = BinaryOp(tok.value, left, right, tok.line, tok.col)
        return left

    def _parse_add(self):
        left = self._parse_mul()
        while self.peek().type == TT.OP and self.peek().value in ("+", "-"):
            tok = self.advance()
            right = self._parse_mul()
            left = BinaryOp(tok.value, left, right, tok.line, tok.col)
        return left

    def _parse_mul(self):
        left = self._parse_atom()
        while self.peek().type == TT.OP and self.peek().value in ("*", "/"):
            tok = self.advance()
            right = self._parse_atom()
            left = BinaryOp(tok.value, left, right, tok.line, tok.col)
        return left

    def _parse_atom(self):
        t = self.peek()
        if t.type == TT.LPAREN:
            self.advance()
            expr = self.parse_expression()
            self.expect(TT.RPAREN)
            return expr
        if t.type == TT.INT:
            self.advance()
            return IntLit(int(t.value), t.line, t.col)
        if t.type == TT.FLOAT:
            self.advance()
            return FloatLit(float(t.value), t.line, t.col)
        if t.type == TT.STRING:
            self.advance()
            return StringLit(t.value, t.line, t.col)
        if t.type == TT.PATH:
            self.advance()
            return PathLit(t.value, t.line, t.col)
        if t.type == TT.KEYWORD and t.value in ("true", "false"):
            self.advance()
            return BoolLit(t.value == "true", t.line, t.col)
        if t.type == TT.IDENT:
            ident = self.advance()
            # Function call?
            if self.peek().type == TT.LPAREN:
                return self._parse_call(ident)
            # Namespaced access via DOT (for imports)? Not in v1 atom path.
            return IdentRef(name=ident.value, line=ident.line, col=ident.col)
        if t.type == TT.OP and t.value == "-":
            self.advance()
            operand = self._parse_atom()
            return UnaryOp("-", operand, t.line, t.col)
        if t.type == TT.VERB:
            # verb expression — used inside let / compare arms
            return self.parse_verb_stmt()
        raise ParseError(f"unexpected {t.type.name} {t.value!r} in expression",
                         t, self.source_lines)

    def _parse_call(self, ident_tok: Token) -> CallExpr:
        self.expect(TT.LPAREN)
        args: list = []
        kwargs: dict = {}
        self.skip_newlines()
        while self.peek().type != TT.RPAREN:
            # named arg? — accept IDENT or KEYWORD followed by '='
            cur = self.peek()
            nxt = self.tokens[self.pos + 1] if self.pos + 1 < len(self.tokens) else None
            is_kwarg = (cur.type in (TT.IDENT, TT.KEYWORD)
                        and nxt is not None and nxt.type == TT.EQ)
            if is_kwarg:
                name = self.advance().value
                self.advance()  # '='
                val = self.parse_expression()
                kwargs[name] = val
            else:
                args.append(self.parse_expression())
            self.skip_newlines()
            if self.peek().type == TT.COMMA:
                self.advance()
                self.skip_newlines()
        self.advance()  # ')'
        return CallExpr(func=ident_tok.value, args=args, kwargs=kwargs,
                        line=ident_tok.line, col=ident_tok.col)

    # ── let ────────────────────────────────────────────────────────────

    def parse_let(self) -> LetStmt:
        let_tok = self.expect(TT.KEYWORD, value="let")
        name = self.expect(TT.IDENT).value
        # Optional type annotation: 'let x : Type = ...'
        type_ann = None
        if self.peek().type == TT.COLON:
            self.advance()
            type_ann = self._parse_type_ann()
        self.expect(TT.EQ)
        # RHS is any expression (verb call, literal, function call, binary op).
        if self.peek().type == TT.VERB:
            expr = self.parse_verb_stmt()
        else:
            expr = self.parse_expression()
        node = LetStmt(name=name, expr=expr, line=let_tok.line, col=let_tok.col)
        node.type_ann = type_ann  # attribute attached for typechecker; LetStmt didn't formally declare it
        return node

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
        # Allow newline + 'on' clause to span lines
        self.skip_newlines()
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
            # Allow parameter reference (will be resolved at call expansion)
            if (t.type in (TT.IDENT, TT.KEYWORD)
                    and t.value not in {"take", "balanced", "label", "text"}):
                args["path"] = {"_param_ref": self.advance().value}
                return True
            if t.type == TT.KEYWORD and t.value == "take":
                self.advance()
                # Allow INT literal, IDENT, or KEYWORD (since param names may
                # shadow keywords) for the count.
                v_tok = self.peek()
                if v_tok.type == TT.INT:
                    args["target"] = int(self.advance().value)
                elif v_tok.type in (TT.IDENT, TT.KEYWORD):
                    args["target"] = {"_param_ref": self.advance().value}
                else:
                    raise ParseError(
                        f"expected number or parameter name after 'take', got {v_tok.value!r}",
                        v_tok, self.source_lines,
                    )
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
                args["dims"] = self._consume_int_or_param("embed dimension")
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
                args["iters"] = self._consume_int_or_param("cluster rounds")
                if self.peek().type == TT.KEYWORD and self.peek().value in ("rounds", "round"):
                    self.advance()
                return True
            if t.type == TT.KEYWORD and t.value == "max":
                self.advance()
                args["max_modules"] = self._consume_int_or_param("max modules")
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
                args["k_nearest"] = self._consume_int_or_param("align k_nearest")
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
                # If the next token is a bare IDENT (no path/interp around it),
                # treat as parameter reference — e.g. `save to output` where
                # `output` is a function parameter.
                nxt = self.peek()
                if nxt.type == TT.IDENT:
                    next2 = self.tokens[self.pos + 1] if self.pos + 1 < len(self.tokens) else None
                    if next2 is None or next2.type in (TT.NEWLINE, TT.EOF, TT.KEYWORD):
                        args["output"] = {"_param_ref": self.advance().value}
                        return True
                # Otherwise: read PATH/IDENT/INTERP runs as a path-template.
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

    def _consume_int_or_param(self, where: str):
        """For numeric arg slots: accept INT literal or IDENT/KEYWORD as
        parameter reference. Used inside `define` bodies."""
        t = self.peek()
        if t.type == TT.INT:
            return int(self.advance().value)
        if t.type in (TT.IDENT, TT.KEYWORD):
            return {"_param_ref": self.advance().value}
        raise ParseError(
            f"expected number or parameter name for {where}, got {t.value!r}",
            t, self.source_lines,
        )

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
