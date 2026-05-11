# OCEAN extension notes — `embed numeric features [...]`

This document specifies the lexer + parser + format-printer changes needed
to make `pipelines/mine_sweep.ocean` execute via the standard OCEAN
compiler invocation. The operator class itself
(`embed.numeric_direct`) is already registered in
[scripts/operators/embed.py](../scripts/operators/embed.py); only the
language surface is pending.

These changes touch the OCEAN runtime, so they must land alongside a
passing run of the conformance test suite at
[tests/ocean/test_conformance.py](../tests/ocean/test_conformance.py).

## Target syntax

```ocean
embed numeric features [residual_rms, local_relief, slope_std, laplacian_std]
```

Differs from existing `embed` forms in three ways:

| | existing | new |
|---|---|---|
| noun | `text` | `numeric features` |
| dim source | explicit `into N dimensions` | implicit `len(fields)` |
| field list | implicit from `text_field` config | explicit bracketed identifier list |

## Lexer changes (`scripts/operators/ocean/lexer.py`)

The existing KEYWORDS list (around line 46) includes `numeric` already.
Two additions:

1. Add `features` to the KEYWORDS set so it lexes as a distinct token type
   instead of being captured as `IDENT`. This avoids ambiguity with the
   identifier list that follows.

   Current line 46 area:
   ```python
   "tfidf", "content", "fingerprint", "one-hot", "numeric", "mean",
   ```
   Becomes:
   ```python
   "tfidf", "content", "fingerprint", "one-hot", "numeric", "mean",
   "features",
   ```

2. No new TT enum value is needed; the existing KEYWORD token type is
   sufficient.

## Parser changes (`scripts/operators/ocean/parser.py`)

The embed-clause parser lives around lines 834-842. Currently it parses
`embed text [from <ident>] into <int> dimensions [using <variant>]`.

Branch on the token immediately after `embed`:

```python
# === EMBED ===
if verb == "embed":
    next_tok = self.peek()
    if next_tok.value == "numeric":
        # NEW PATH: embed numeric features [<ident_list>]
        self.consume_keyword("numeric")
        self.consume_keyword("features")
        self.expect(TT.LBRACKET)
        fields = []
        while True:
            field_tok = self.expect(TT.IDENT)
            fields.append(field_tok.value)
            if self.peek().type == TT.COMMA:
                self.advance()
                continue
            break
        self.expect(TT.RBRACKET)
        kind = "embed.numeric_direct"
        args = {"fields": fields, "dims": len(fields)}
    else:
        # EXISTING PATH: embed text [from <ident>] into <int> dimensions [...]
        ...  # unchanged
```

Notes:
- `consume_keyword(...)` is the existing helper for keyword-matching.
- The `dims` config is set for downstream introspection but the operator
  derives the same value from `len(fields)`.
- No change to `EMBED_VARIANTS` is needed (the new path doesn't use
  `using <variant>` syntax).

## Format-printer changes (`scripts/operators/ocean/format.py`)

The pretty-printer at line 195 maps operator kinds back to source-level
verb forms:
```python
"embed.onehot_numeric": "one-hot numeric",
```

Add the new operator kind alongside, formatted as the special-case noun:
```python
"embed.numeric_direct": ("numeric features", "<fields-list>"),
```
The exact representation depends on `format.py`'s code path for verb
rendering — likely a small branch that emits `numeric features
[<fields>]` instead of `text into <dims> dimensions using <variant>`.

## Typecheck changes (`scripts/operators/ocean/typecheck.py`)

The existing message at line 264 mentions piping through `embed`:
```python
return "pipe through `embed` first, e.g.\n  let z = embed text from raw into 128 dimensions\n  cluster z using tcd recursive loop"
```

No mandatory change, but consider updating the suggestion text to mention
the `numeric features` form when the user is working with a numeric-only
corpus.

## Conformance test (`tests/ocean/test_conformance.py`)

Add a test case that asserts the new syntax parses, type-checks, and
executes:

```python
def test_embed_numeric_features_pipeline(tmp_path):
    """Verify `embed numeric features [...]` lexes, parses, and routes to embed.numeric_direct."""
    # Tiny corpus: 3 records, 2 features each
    corpus = tmp_path / "tiny.ndjson"
    corpus.write_text(
        '{"a": 1.0, "b": 2.0}\n'
        '{"a": 3.0, "b": 4.0}\n'
        '{"a": 5.0, "b": 6.0}\n',
        encoding="utf-8",
    )
    pipeline = f"""
    seed 42
    load {corpus} take 3 records
    embed numeric features [a, b]
    """
    result = run_ocean(pipeline)
    assert result.last_step["embedder"] == "numeric_direct"
    assert result.last_step["dims"] == 2
    assert result.last_step["fields"] == ["a", "b"]
    Z = result.last_step["Z"]
    assert Z.shape == (3, 2)
    # After z-scoring, column means are 0 and stds are 1 (within float tolerance)
    np.testing.assert_allclose(Z.mean(axis=0), 0.0, atol=1e-5)
    np.testing.assert_allclose(Z.std(axis=0),  1.0, atol=1e-5)
```

## Implementation gate

Before merging:
1. All existing conformance tests pass (`pytest tests/ocean/test_conformance.py`).
2. The new test above passes.
3. `pipelines/mine_sweep.ocean` parses cleanly:
   `python -m scripts.operators.ocean.parser pipelines/mine_sweep.ocean`
4. `pipelines/mine_sweep.ocean` formats back to itself idempotently:
   `python -m scripts.operators.ocean.format pipelines/mine_sweep.ocean | diff - pipelines/mine_sweep.ocean`

If any of these fail, the changes are wrong and need iteration. The
showcase blocks until all four pass.

## Until the syntax is wired up

Until the lexer/parser changes land, the Python harness
(`scripts/experiments/mine_sweep.py`) calls the registered operator
directly via the operator registry, bypassing the OCEAN compiler. The
.ocean file in the repo at `pipelines/mine_sweep.ocean` documents the
intended syntax even before it executes — making the parser change a
forcing function for someone to verify the file actually runs.
