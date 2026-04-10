"""THIRD DOMAIN VALIDATION: Information theory regime detection.

Three info theory regimes:
  1. Entropy coding (Shannon 1948, Huffman 1952) - probability/frequency based
  2. Dictionary-based (Lempel-Ziv 1984) - pattern reference based
  3. Transform-based (JPEG 1992, HEVC 2013) - frequency-domain decomposition
"""

import json
from pathlib import Path

DOC_DIR = Path(__file__).parent / "documents"
OUT = Path(__file__).parent / "output"

KEYWORDS = {
    # Entropy coding regime
    "ent_entropy": [
        "entropy",
        "shannon entropy",
        "information content",
        "bits per symbol",
        "self-information",
        "h = -",
        "log p",
        "information theoretic",
    ],
    "ent_probability": [
        "probability",
        "probabilities",
        "probability distribution",
        "symbol probability",
        "frequency",
        "statistical model",
        "stochastic source",
        "ensemble",
    ],
    "ent_codeword": [
        "codeword",
        "code word",
        "prefix code",
        "variable-length",
        "minimum-redundancy",
        "huffman",
        "arithmetic coding",
        "uniquely decodable",
    ],
    # Dictionary-based regime
    "dict_dictionary": [
        "dictionary",
        "search tree",
        "pattern reference",
        "match",
        "longest match",
        "prefix matching",
        "lempel-ziv",
        "lempel ziv",
        "lz77",
        "lz78",
        "lzw",
    ],
    "dict_repetition": [
        "repeated pattern",
        "repetition",
        "redundancy",
        "previously-seen",
        "previously seen",
        "incremental",
        "adaptive",
        "without prior",
        "no a priori",
        "sliding window",
    ],
    "dict_pointer": [
        "pointer",
        "back reference",
        "back-reference",
        "offset",
        "string reference",
        "lookup",
    ],
    # Transform-based regime
    "trans_transform": [
        "discrete cosine",
        "dct",
        "wavelet",
        "fourier",
        "transform domain",
        "frequency domain",
        "frequency coefficient",
        "transform coefficient",
        "energy compaction",
        "spectral",
        "basis function",
    ],
    "trans_quantization": [
        "quantization",
        "quantize",
        "quantized",
        "lossy",
        "perceptual",
        "perceptually",
        "rate distortion",
        "rate-distortion",
        "quality factor",
    ],
    "trans_block": [
        "block",
        "8x8 block",
        "block-based",
        "macroblock",
        "coding unit",
        "coding tree unit",
        "ctu",
        "intra prediction",
        "inter prediction",
        "motion compensation",
        "motion vector",
    ],
}


def extract_scores(text: str) -> dict[str, float]:
    text_lower = text.lower()
    word_count = max(len(text.split()), 1)
    scores = {}
    for group, kws in KEYWORDS.items():
        count = sum(text_lower.count(kw.lower()) for kw in kws)
        scores[group] = round(count / word_count * 1000, 3)
    return scores


def main() -> None:
    info_docs = []
    for f in sorted(DOC_DIR.glob("info_*.txt")):
        with open(f, "r", encoding="utf-8") as fp:
            text = fp.read()
        scores = extract_scores(text)

        if "entropy" in f.name.lower() or "shannon" in f.name.lower() or "huffman" in f.name.lower():
            expected = "entropy_coding"
        elif "dictionary" in f.name.lower() or "lz" in f.name.lower() or "lempel" in f.name.lower():
            expected = "dictionary_based"
        elif "transform" in f.name.lower() or "jpeg" in f.name.lower() or "hevc" in f.name.lower() or "h265" in f.name.lower():
            expected = "transform_based"
        else:
            expected = "unknown"

        # Year extraction
        year = None
        if "SHANNON1948" in f.name:
            year = 1948
        elif "HUFFMAN1952" in f.name:
            year = 1952
        elif "LZ_" in f.name:
            year = 1984
        elif "JPEG" in f.name:
            year = 1992
        elif "HEVC" in f.name or "H265" in f.name:
            year = 2013

        ent_score = sum(scores[k] for k in scores if k.startswith("ent_"))
        dict_score = sum(scores[k] for k in scores if k.startswith("dict_"))
        trans_score = sum(scores[k] for k in scores if k.startswith("trans_"))

        info_docs.append({
            "id": f.stem,
            "year": year,
            "expected": expected,
            "ent": ent_score,
            "dict": dict_score,
            "trans": trans_score,
            "scores_detail": scores,
        })

    print("=" * 90)
    print("INFORMATION THEORY REGIME SCORES")
    print("=" * 90)
    print(f"{'Doc':40s} {'Year':>5} {'ENT':>8} {'DICT':>8} {'TRANS':>8}")
    print("-" * 80)

    for d in info_docs:
        print(f"{d['id'][:40]:40s} {d['year']!s:>5} {d['ent']:>8.2f} {d['dict']:>8.2f} {d['trans']:>8.2f}")

    print()
    print("=" * 90)
    print("REGIME DOMINANCE")
    print("=" * 90)

    correct = 0
    for d in info_docs:
        scores = {"ENT": d["ent"], "DICT": d["dict"], "TRANS": d["trans"]}
        sorted_s = sorted(scores.items(), key=lambda x: -x[1])
        dominant = sorted_s[0][0]
        margin = sorted_s[0][1] / max(sorted_s[1][1], 0.001)

        expected_dom = {
            "entropy_coding": "ENT",
            "dictionary_based": "DICT",
            "transform_based": "TRANS",
        }.get(d["expected"], "?")

        is_correct = dominant == expected_dom
        marker = "[CORRECT]" if is_correct else f"[expected={expected_dom}]"
        if is_correct:
            correct += 1
        print(f"  [{d['year']}] {d['id'][:40]:40s} -> {dominant:6s} (margin={margin:6.1f}x) {marker}")

    print()
    print(f"Score: {correct}/{len(info_docs)} info theory documents correctly classified")
    print()

    # Cross-era within info theory
    print("=" * 90)
    print("CROSS-ERA TEST: Shannon 1948 -> Huffman 1952 (entropy regime), JPEG 1992 -> HEVC 2013 (transform)")
    print("=" * 90)

    by_regime = {}
    for d in info_docs:
        by_regime.setdefault(d["expected"], []).append(d)

    for r, docs in by_regime.items():
        if not docs:
            continue
        avg_ent = sum(x["ent"] for x in docs) / len(docs)
        avg_dict = sum(x["dict"] for x in docs) / len(docs)
        avg_trans = sum(x["trans"] for x in docs) / len(docs)
        years = [x["year"] for x in docs if x["year"]]
        yr = f"{min(years)}-{max(years)}" if years else "?"
        print(f"  {r:25s} ({yr})  ENT={avg_ent:7.2f}  DICT={avg_dict:7.2f}  TRANS={avg_trans:7.2f}  n={len(docs)}")

    print()
    # Save report
    OUT.mkdir(exist_ok=True)
    with open(OUT / "info_theory_discriminator_report.json", "w") as fp:
        json.dump(info_docs, fp, indent=2)
    print(f"Report saved")


if __name__ == "__main__":
    main()
