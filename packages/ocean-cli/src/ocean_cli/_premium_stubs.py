"""Premium operator stubs."""
from __future__ import annotations


class PremiumOperatorError(RuntimeError):
    def __init__(self, op_name: str, line: int = 1, col: int = 1) -> None:
        self.op_name = op_name
        self.line = line
        self.col = col
        super().__init__(self._format())

    def _format(self) -> str:
        return (
            f"this operator ({self.op_name}) requires a paid API key; "
            f"execution is blocked in the open-core ocean-cli wheel.\n"
            f"hint: see https://latentocean.com/protocols for an API key, "
            f"or call the proprietary backend at https://api.latentocean.com/run"
        )


class _PremiumStub:
    def __init__(self, name: str) -> None:
        self.name = name
        self.tier = "premium"

    def run(self, *args, **kwargs):
        raise PremiumOperatorError(self.name)


PREMIUM_OPS = (
    "embed.content_fp48",
    "reduce.btut",
    "cluster.tcd_recursive_loop",
    "align.dispersion",
)


def register_premium_stubs() -> None:
    from ocean_cli._vendored.scripts.operators import embed, cluster, reduce, align

    embed._REGISTRY["embed.content_fp48"] = _PremiumStub("embed.content_fp48")
    cluster._REGISTRY["cluster.tcd_recursive_loop"] = _PremiumStub("cluster.tcd_recursive_loop")
    reduce._REGISTRY["reduce.btut"] = _PremiumStub("reduce.btut")
    align._REGISTRY["align.dispersion"] = _PremiumStub("align.dispersion")
