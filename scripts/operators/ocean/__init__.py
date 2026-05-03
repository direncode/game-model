"""OCEAN — domain-specific language for substrate-clustering pipelines.

Pipeline:  source text  ->  Lexer  ->  tokens
                       ->  Parser ->  AST
                       ->  Type-check + name-resolution
                       ->  Compiler ->  PipelineConfig (operator DAG)
                       ->  Runner   ->  artifact

Public API:
    compile_ocean(text, source_name='<inline>') -> PipelineConfig
    parse_ocean(text)                            -> Program (AST)
"""
from __future__ import annotations

from .lexer import tokenize
from .parser import parse_ocean
from .compiler import compile_ocean

__all__ = ["tokenize", "parse_ocean", "compile_ocean"]
