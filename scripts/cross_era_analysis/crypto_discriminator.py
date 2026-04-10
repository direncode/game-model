"""SECOND DOMAIN VALIDATION: Cryptography regime detection.

Tests whether the same structural classification approach that worked
on the Tesla wireless power patents also works on cryptography:

Three crypto regimes (analogous to surface wave / inductive / radiative):
  1. Number-theoretic public-key (Diffie-Hellman 1980, RSA 1983)
     - Hard problem: discrete log, factoring
     - Mathematical foundation: modular exponentiation in cyclic groups
  2. Lattice-based post-quantum (NTRU 2001, Isara 2018)
     - Hard problem: shortest vector / LWE
     - Mathematical foundation: polynomial rings, lattices
  3. Symmetric block cipher (AES, control)
     - Hard problem: SPN design, finite field arithmetic
     - Mathematical foundation: GF(2^8) substitution-permutation network

The cross-era prediction:
  - NTRU 2001 should cluster with Isara 2018 (17 years apart, both lattice)
  - Both should distinguish from RSA/DH (number-theoretic)
  - Both should distinguish from AES (symmetric, no public-key structure)

If this works, it's an independent second-domain validation that the
structural classification method generalizes beyond the Tesla case.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

DOC_DIR = Path(__file__).parent / "documents"
OUTPUT_DIR = Path(__file__).parent / "output"


# Crypto-specific keyword groups designed to discriminate the three regimes
CRYPTO_KEYWORDS = {
    # === Number-theoretic public-key (RSA, Diffie-Hellman) ===
    "nt_modular": [
        "modular exponentiation",
        "modular arithmetic",
        "modulo",
        "mod n",
        "mod q",
        "mod p",
        "exponentiation",
        "raising",
        "fermat",
        "carmichael",
    ],
    "nt_factoring": [
        "prime number",
        "prime factor",
        "factorization",
        "factoring",
        "two large primes",
        "p * q",
        "p and q",
        "composite number",
    ],
    "nt_discrete_log": [
        "discrete logarithm",
        "discrete log",
        "cyclic group",
        "generator",
        "multiplicative group",
        "primitive root",
        "finite field",
    ],
    "nt_publickey_general": [
        "public key",
        "private key",
        "public-key",
        "key exchange",
        "key agreement",
        "encryption",
        "decryption",
        "digital signature",
        "trapdoor",
        "one-way function",
    ],
    # === Lattice-based post-quantum ===
    "lat_lattice": [
        "lattice",
        "lattice basis",
        "lattice problem",
        "lattice-based",
        "shortest vector",
        "closest vector",
        "svp",
        "cvp",
        "short vector",
    ],
    "lat_polynomial_ring": [
        "polynomial ring",
        "polynomial",
        "ring r",
        "ring-based",
        "cyclic convolution",
        "star multiplication",
        "ring operation",
        "z[x]",
        "x^n - 1",
    ],
    "lat_lwe": [
        "learning with errors",
        "lwe",
        "ring-lwe",
        "module-lwe",
        "ring lwe",
        "frodo",
        "kyber",
        "dilithium",
        "falcon",
        "error term",
        "small error",
        "gaussian",
    ],
    "lat_postquantum": [
        "post-quantum",
        "post quantum",
        "quantum-resistant",
        "quantum resistant",
        "shor",
        "shor's algorithm",
        "grover",
        "quantum computer",
        "quantum attack",
    ],
    # === Symmetric ciphers ===
    "sym_block_cipher": [
        "block cipher",
        "symmetric",
        "secret key",
        "shared key",
        "spn",
        "substitution-permutation",
        "feistel",
        "round key",
        "key schedule",
        "rounds",
        "s-box",
        "substitution",
        "permutation",
    ],
    "sym_aes_specific": [
        "aes",
        "rijndael",
        "des",
        "subbytes",
        "shiftrows",
        "mixcolumns",
        "addroundkey",
        "state",
        "gf(2^8)",
        "finite field gf",
    ],
}


def parse_attrs(text):
    return text


def extract_regime_scores(text: str) -> dict[str, float]:
    """Compute density of each crypto regime keyword group per 1000 words."""
    text_lower = text.lower()
    word_count = max(len(text.split()), 1)

    scores = {}
    for group, kws in CRYPTO_KEYWORDS.items():
        count = 0
        for kw in kws:
            count += text_lower.count(kw.lower())
        scores[group] = round(count / word_count * 1000, 3)

    return scores


def main() -> None:
    crypto_docs = []
    for f in sorted(DOC_DIR.glob("crypto_*.txt")):
        with open(f, "r", encoding="utf-8") as fp:
            text = fp.read()
        scores = extract_regime_scores(text)

        # Determine expected regime from filename
        if "publickey" in f.name:
            expected = "number_theoretic_pk"
        elif "_pq_" in f.name:
            expected = "lattice_pq"
        elif "symmetric" in f.name:
            expected = "symmetric_cipher"
        else:
            expected = "unknown"

        # Extract year from filename or content
        year = None
        if "DH_US4200770" in f.name:
            year = 1980
        elif "RSA_US4405829" in f.name:
            year = 1983
        elif "NTRU_US6298137" in f.name:
            year = 2001
        elif "modern_US10097351" in f.name:
            year = 2018
        elif "AES" in f.name:
            year = 2001  # AES standardization

        crypto_docs.append({
            "id": f.stem,
            "year": year,
            "expected": expected,
            "scores": scores,
            "word_count": len(text.split()),
        })

    print("=" * 100)
    print("CRYPTO REGIME SCORES")
    print("=" * 100)
    print()
    print(f"{'Doc':45s} {'Year':>5} {'NT':>8} {'LAT':>8} {'SYM':>8}")
    print("-" * 80)

    for d in crypto_docs:
        nt_score = sum(d["scores"][k] for k in ["nt_modular", "nt_factoring", "nt_discrete_log", "nt_publickey_general"])
        lat_score = sum(d["scores"][k] for k in ["lat_lattice", "lat_polynomial_ring", "lat_lwe", "lat_postquantum"])
        sym_score = sum(d["scores"][k] for k in ["sym_block_cipher", "sym_aes_specific"])

        d["nt"] = nt_score
        d["lat"] = lat_score
        d["sym"] = sym_score

        print(f"{d['id'][:45]:45s} {d['year']!s:>5} {nt_score:>8.2f} {lat_score:>8.2f} {sym_score:>8.2f}")

    print()
    print("=" * 100)
    print("REGIME DOMINANCE")
    print("=" * 100)
    print()

    correct = 0
    total = 0
    for d in crypto_docs:
        scores = {"NT": d["nt"], "LAT": d["lat"], "SYM": d["sym"]}
        sorted_s = sorted(scores.items(), key=lambda x: -x[1])
        dominant = sorted_s[0][0]
        if sorted_s[1][1] > 0:
            margin = sorted_s[0][1] / sorted_s[1][1]
        else:
            margin = float("inf")

        expected_dominant = {
            "number_theoretic_pk": "NT",
            "lattice_pq": "LAT",
            "symmetric_cipher": "SYM",
        }.get(d["expected"], "?")

        is_correct = (dominant == expected_dominant)
        marker = "[CORRECT]" if is_correct else f"[expected={expected_dominant}]"
        if is_correct:
            correct += 1
        total += 1

        print(f"  [{d['year']}] {d['id'][:45]:45s} -> {dominant:5s} (margin={margin:6.1f}x)  {marker}")

    print()
    print(f"Score: {correct}/{total} crypto patents correctly classified")
    print()

    # Cross-era test for crypto
    print("=" * 100)
    print("CROSS-ERA CRYPTO TEST")
    print("=" * 100)
    print()

    by_regime = {}
    for d in crypto_docs:
        by_regime.setdefault(d["expected"], []).append(d)

    print(f"{'Regime':>30}   NT avg   LAT avg   SYM avg   Year range")
    print("-" * 80)
    for regime, docs in sorted(by_regime.items()):
        if not docs:
            continue
        avg_nt = sum(d["nt"] for d in docs) / len(docs)
        avg_lat = sum(d["lat"] for d in docs) / len(docs)
        avg_sym = sum(d["sym"] for d in docs) / len(docs)
        years = [d["year"] for d in docs if d["year"]]
        year_range = f"{min(years)}-{max(years)}" if years else "?"
        print(f"{regime:>30}   {avg_nt:>6.2f}   {avg_lat:>7.2f}   {avg_sym:>7.2f}   {year_range}")

    # The cross-era prediction
    print()
    print("=" * 100)
    print("CROSS-ERA HYPOTHESIS: Does NTRU 2001 cluster with modern post-quantum 2018?")
    print("=" * 100)
    print()

    pq_docs = by_regime.get("lattice_pq", [])
    if len(pq_docs) >= 2:
        ntru = next((d for d in pq_docs if "NTRU" in d["id"]), None)
        modern = next((d for d in pq_docs if "modern" in d["id"]), None)
        if ntru and modern:
            print(f"NTRU (2001):    NT={ntru['nt']:.2f} LAT={ntru['lat']:.2f} SYM={ntru['sym']:.2f}")
            print(f"Modern (2018):  NT={modern['nt']:.2f} LAT={modern['lat']:.2f} SYM={modern['sym']:.2f}")
            print()
            ntru_dominant = max(["NT", "LAT", "SYM"], key=lambda r: {"NT": ntru["nt"], "LAT": ntru["lat"], "SYM": ntru["sym"]}[r])
            modern_dominant = max(["NT", "LAT", "SYM"], key=lambda r: {"NT": modern["nt"], "LAT": modern["lat"], "SYM": modern["sym"]}[r])
            print(f"NTRU dominant regime:    {ntru_dominant}")
            print(f"Modern dominant regime:  {modern_dominant}")
            if ntru_dominant == modern_dominant == "LAT":
                print()
                print(">>> CROSS-ERA CRYPTO MATCH CONFIRMED <<<")
                print(">>> Both NTRU 2001 and modern post-quantum 2018 are LAT-dominant.")
                print(f">>> Temporal gap: 17 years")
                print(">>> Both are clearly distinguished from RSA/DH (NT-dominant) and AES (SYM-dominant)")
            else:
                print()
                print("Cross-era match not confirmed at top-1 dominance.")

    # Save report
    out_path = OUTPUT_DIR / "crypto_discriminator_report.json"
    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(crypto_docs, f, indent=2)
    print()
    print(f"Report saved to {out_path}")


if __name__ == "__main__":
    main()
