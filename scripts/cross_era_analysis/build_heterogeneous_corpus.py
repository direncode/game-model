"""Build a heterogeneous cross-era corpus that plays to BTUT's strength.

The previous run had 1679 entities of UNIFORM type (patent_chunk). BTUT's
medium-resolution signal originally flagged Tesla US1119732 because the Tesla
corpus had 9 different entity types — patent, patent_chunk, writing, event,
location, person, concept, document, etc. BTUT detected the anomaly because
US1119732 was structurally distinct across all those types.

This script builds a corpus with the same entity-type heterogeneity by
generating writings, events, locations, persons, and concepts for each
physics regime, then combining them with the existing patent chunks.

Target: 1500-2000 entities across 7+ types with rich cross-type edges.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "output"


# === Per-regime entity definitions ===

REGIME_ENTITIES = {
    "tesla_surface_wave": {
        "persons": [
            ("Nikola Tesla", "Inventor of polyphase AC, wireless transmission, Wardenclyffe tower"),
            ("George Westinghouse", "Industrialist who licensed Tesla's AC patents"),
            ("Koloman Czito", "Tesla's personal mechanic at Colorado Springs"),
            ("Fritz Lowenstein", "Tesla's assistant at Colorado Springs and Wardenclyffe"),
            ("Thomas Commerford Martin", "Editor and biographer of Tesla, compiler of Inventions, Researches and Writings"),
            ("John J. O'Neill", "Tesla biographer, author of Prodigal Genius"),
        ],
        "locations": [
            ("Colorado Springs Laboratory", "Tesla's experimental station 1899-1900 for resonance experiments"),
            ("Wardenclyffe Tower", "Tesla's wireless transmission station on Long Island 1901-1906"),
            ("South Fifth Avenue Lab", "Tesla's New York lab destroyed by fire 1895"),
            ("Houston Street Lab", "Tesla's New York lab after the fire"),
            ("Niagara Falls Power Plant", "First large-scale AC power deployment using Tesla patents"),
        ],
        "concepts": [
            ("Earth Resonance", "The natural resonant frequency of the Earth-ionosphere cavity Tesla measured at Colorado Springs"),
            ("Wireless Transmission of Energy", "Tesla's system for transmitting electrical power without wires through the natural media"),
            ("World Wireless System", "Tesla's planned global network of wireless transmitters and receivers"),
            ("Quarter-Wave Resonator", "Resonant circuit with electrical length equal to one-quarter wavelength"),
            ("Free Oscillation Matching", "Tesla's principle of tuning the impressed frequency to the natural resonance"),
            ("Magnifying Transmitter", "Tesla's resonant transformer producing millions of volts at radio frequency"),
        ],
        "writings": [
            ("Inventor Tesla's Plant Nearing Completion", "Article describing Wardenclyffe construction"),
            ("The Problem of Increasing Human Energy", "1900 Century Magazine article on energy and wireless transmission"),
            ("The Transmission of Electrical Energy Without Wires", "1904 article in Electrical World and Engineer"),
            ("Famous Scientific Illusions", "Tesla's article distinguishing his work from contemporaneous radio"),
            ("World System of Wireless Transmission of Energy", "1927 article describing the planned global system"),
        ],
        "events": [
            ("Files US645576 and US649621", "Tesla files foundational wireless transmission patents in 1897"),
            ("Colorado Springs experiments begin", "1899 establishment of experimental station"),
            ("Wardenclyffe construction begins", "1901 start of Long Island tower"),
            ("Wardenclyffe funding withdrawn", "1903 J.P. Morgan withdraws funding"),
            ("Files US1119732", "Tesla files apparatus patent in 1902"),
            ("US1119732 granted", "Patent finally issued December 1, 1914"),
            ("Tesla papers seized by FBI", "Office of Alien Property Custodian seizes papers after Tesla's death 1943"),
        ],
    },
    "modern_surface_wave": {
        "persons": [
            ("James F. Corum", "Co-founder of CPG Technologies, slow-wave helical resonator analysis"),
            ("Kenneth L. Corum", "Co-author of mathematical Tesla apparatus analysis"),
            ("Michael Miller", "Viziv Technologies CEO"),
            ("Basil F. Pinzone", "Texzon/Viziv Technologies lattice cryptography researcher"),
            ("Jonathan Zenneck", "1907 theoretical paper on planar EM wave propagation along conducting surfaces"),
            ("Arnold Sommerfeld", "1909 mathematical treatment of dipole above conducting plane"),
        ],
        "locations": [
            ("CPG Technologies", "Corum brothers' patent holding entity for surface wave technology"),
            ("Viziv Technologies Milford TX", "Texas surface wave power transmission company headquarters"),
            ("Baylor University", "Academic partner for Zenneck wave power distribution research"),
        ],
        "concepts": [
            ("Zenneck Surface Wave", "Bound TM-mode surface wave at the interface between two media of different dielectric properties"),
            ("Complex Brewster Angle", "Angle of incidence at which reflection vanishes for a complex impedance interface"),
            ("Slow-Wave Helical Resonator", "Helically-wound transmission line with phase velocity less than c"),
            ("Wave Tilt Angle", "Phase angle of complex effective height in surface wave launchers"),
            ("Hankel Crossover Distance", "Distance at which the radiating and reactive components of the field are equal"),
            ("Mode Matching Condition", "Geometric condition required for efficient excitation of a bound waveguide mode"),
        ],
        "writings": [
            ("Corum 2001 RF Coils Helical Resonators", "Mathematical analysis of Tesla coil as slow-wave helical resonator"),
            ("Corum 1986 Extra Coil Slow Wave Analysis", "First derivation of slow-wave equations for Tesla apparatus"),
            ("Corum 2003 Planetary Radio Signals", "Analysis of Tesla's Colorado Springs receivers and frequency operation"),
            ("IEEE 2016 Surface Waves Crucial Experiment", "Hankel-transform derivation and Seneca Lake experiment replication"),
        ],
        "events": [
            ("Corum brothers publish slow wave analysis", "1986 first derivation of Tesla apparatus equations"),
            ("CPG Technologies founded", "Corum brothers' patent entity established"),
            ("Viziv Technologies announces partnership with Baylor", "Academic collaboration for surface wave research"),
            ("FCC issues Viziv experimental license", "Part 5 license for Texas field tests"),
        ],
    },
    "inductive_non_radiative": {
        "persons": [
            ("Marin Soljacic", "MIT physicist, founder of WiTricity, resonant inductive coupling"),
            ("Aristeidis Karalis", "MIT researcher on coupled-mode theory for wireless power"),
            ("John D. Joannopoulos", "MIT physicist, photonic crystals and resonator theory"),
        ],
        "locations": [
            ("MIT", "Massachusetts Institute of Technology, where WiTricity research originated"),
            ("WiTricity Corporation", "Boston-based wireless power company"),
        ],
        "concepts": [
            ("Coupled-Mode Theory", "Theoretical framework for energy transfer between resonators via near-field coupling"),
            ("Evanescent Field Coupling", "Energy transfer through the evanescent tails of electromagnetic resonators"),
            ("Magnetic Near-Field Resonance", "Energy transfer via overlapping magnetic fields of tuned resonators"),
            ("High-Q Resonator", "Resonant structure with low loss rate enabling efficient energy transfer"),
            ("Strong Coupling Regime", "Coupling rate much greater than loss rate enabling near-perfect transfer"),
        ],
        "writings": [
            ("MIT 2007 Wireless Power Demonstration", "Soljacic group demonstration paper at 2 meter range"),
            ("Coupled Mode Theory for Wireless Energy Transfer", "Theoretical analysis of resonant coupling"),
        ],
        "events": [
            ("MIT WiTricity demonstration", "2007 60-watt bulb lit at 2 meters wirelessly"),
            ("WiTricity Corporation founded", "2007 company spinout from MIT"),
        ],
    },
    "radiative_radio": {
        "persons": [
            ("Guglielmo Marconi", "Italian inventor, first transatlantic radio transmission 1901"),
            ("Reginald Fessenden", "Canadian inventor of continuous wave radio and AM modulation"),
            ("Lee de Forest", "Inventor of the Audion vacuum tube triode"),
            ("John Stone Stone", "Tuned radio circuit pioneer"),
            ("Heinrich Hertz", "Discoverer of electromagnetic waves, demonstrated Maxwell's predictions"),
            ("Oliver Lodge", "Early radio experimenter, coherer detector"),
        ],
        "locations": [
            ("Marconi Wireless Station", "Early radio transmission stations in Britain and US"),
            ("Cape Cod Wireless Station", "Marconi's first transatlantic wireless station"),
        ],
        "concepts": [
            ("Hertzian Wave", "Free electromagnetic radiation propagating through space, named after Heinrich Hertz"),
            ("Coherer", "Early radio detector based on metal filings becoming conductive when struck by EM waves"),
            ("Continuous Wave", "Sinusoidal radio frequency signal, contrasted with damped spark transmissions"),
            ("Antenna Radiation Pattern", "Directional distribution of radiated electromagnetic energy"),
            ("Audion Triode", "Three-electrode vacuum tube amplifier and detector"),
        ],
        "writings": [
            ("Hertz Electric Waves Lectures", "Hertz's 1893 lectures on the discovery of electromagnetic waves"),
            ("Marconi Wireless Telegraphy", "Marconi's papers on early radio experiments"),
        ],
        "events": [
            ("Hertz demonstrates EM waves", "1888 first generation and detection of radio waves in laboratory"),
            ("Marconi transatlantic transmission", "1901 first wireless transmission across the Atlantic"),
            ("Audion patented", "1907 de Forest patents the three-electrode vacuum tube"),
            ("Commercial radio broadcasting begins", "1920 KDKA Pittsburgh begins regular broadcasting"),
        ],
    },
    "crypto_number_theoretic": {
        "persons": [
            ("Whitfield Diffie", "Co-inventor of public-key cryptography concept"),
            ("Martin Hellman", "Co-inventor of public-key cryptography concept"),
            ("Ralph Merkle", "Co-author of foundational public-key paper"),
            ("Ronald Rivest", "Co-inventor of RSA cryptosystem"),
            ("Adi Shamir", "Co-inventor of RSA cryptosystem"),
            ("Leonard Adleman", "Co-inventor of RSA cryptosystem"),
        ],
        "locations": [
            ("Stanford University", "Where Diffie and Hellman developed public-key cryptography"),
            ("MIT Mathematics Department", "Where Rivest Shamir Adleman developed RSA"),
        ],
        "concepts": [
            ("Discrete Logarithm Problem", "Computational hardness of finding x such that g^x = y mod p in a finite cyclic group"),
            ("Integer Factorization", "Computational hardness of finding the prime factors of a large composite number"),
            ("Modular Exponentiation", "Computing a^b mod n efficiently via repeated squaring"),
            ("One-Way Function", "Function easy to compute but computationally hard to invert"),
            ("Trapdoor Function", "One-way function with secret information enabling efficient inversion"),
        ],
        "writings": [
            ("Diffie Hellman New Directions in Cryptography 1976", "Foundational paper proposing public-key cryptography"),
            ("RSA 1977 Method for Obtaining Digital Signatures", "Original RSA cryptosystem paper"),
        ],
        "events": [
            ("Diffie Hellman paper published", "1976 first published proposal of public-key cryptography"),
            ("RSA cryptosystem invented", "1977 first practical public-key cryptosystem"),
        ],
    },
    "crypto_lattice": {
        "persons": [
            ("Jeffrey Hoffstein", "Co-inventor of NTRU lattice-based cryptosystem"),
            ("Jill Pipher", "Co-inventor of NTRU lattice-based cryptosystem"),
            ("Joseph H. Silverman", "Co-inventor of NTRU lattice-based cryptosystem"),
            ("Oded Regev", "Inventor of Learning With Errors problem and lattice-based crypto"),
            ("Peter Shor", "Discoverer of quantum factoring algorithm motivating post-quantum crypto"),
        ],
        "locations": [
            ("Brown University", "Where NTRU was developed by Hoffstein, Pipher, Silverman"),
            ("Tel Aviv University", "Where Regev developed Learning With Errors problem"),
        ],
        "concepts": [
            ("Shortest Vector Problem", "NP-hard problem of finding the shortest nonzero vector in a lattice"),
            ("Learning With Errors", "Cryptographic hardness assumption based on noisy linear equations modulo q"),
            ("Ring-LWE", "Variant of Learning With Errors over polynomial rings, more efficient"),
            ("Polynomial Ring Cryptosystem", "Cryptosystem operating on polynomial rings with reduction modulo two moduli"),
            ("Post-Quantum Security", "Cryptographic security against attack by sufficiently large quantum computers"),
        ],
        "writings": [
            ("Hoffstein Pipher Silverman NTRU 1998", "Original NTRU lattice cryptosystem paper"),
            ("Regev LWE 2005", "Foundational paper on Learning With Errors problem"),
            ("Shor 1994 Quantum Factoring", "Algorithm motivating the need for post-quantum cryptography"),
        ],
        "events": [
            ("NTRU cryptosystem published", "1998 first practical lattice-based cryptosystem"),
            ("Shor algorithm published", "1994 polynomial-time quantum factoring threatens RSA and Diffie-Hellman"),
            ("NIST PQC competition", "2016 begins NIST Post-Quantum Cryptography standardization process"),
        ],
    },
    "crypto_symmetric": {
        "persons": [
            ("Joan Daemen", "Co-designer of Rijndael / AES symmetric cipher"),
            ("Vincent Rijmen", "Co-designer of Rijndael / AES symmetric cipher"),
            ("Horst Feistel", "IBM cryptographer, designed DES predecessor cipher"),
            ("David Huffman", "Information theorist, also influential in symmetric cipher design"),
        ],
        "locations": [
            ("NIST", "US National Institute of Standards and Technology"),
            ("Katholieke Universiteit Leuven", "Belgian university where Daemen and Rijmen developed Rijndael"),
        ],
        "concepts": [
            ("Substitution-Permutation Network", "Block cipher structure alternating substitution and permutation operations"),
            ("Block Cipher", "Symmetric cipher operating on fixed-size blocks of plaintext"),
            ("Key Schedule", "Algorithm expanding a cipher key into a sequence of round keys"),
            ("S-Box", "Substitution table providing nonlinearity in block ciphers"),
            ("Finite Field Arithmetic", "Arithmetic in GF(2^n) used in modern symmetric cipher design"),
        ],
        "writings": [
            ("AES Rijndael Specification", "FIPS PUB 197 specification of the Advanced Encryption Standard"),
        ],
        "events": [
            ("DES standardized", "1977 NIST adopts Data Encryption Standard"),
            ("AES selected", "2000 NIST selects Rijndael as the Advanced Encryption Standard"),
        ],
    },
    "info_entropy_coding": {
        "persons": [
            ("Claude Shannon", "Founder of information theory, defined entropy and channel capacity"),
            ("David Huffman", "Inventor of optimal prefix coding algorithm"),
            ("Robert Fano", "Co-inventor of Shannon-Fano coding, Shannon's contemporary"),
        ],
        "locations": [
            ("Bell Labs", "Where Shannon developed information theory"),
            ("MIT Mathematics Department", "Where Huffman developed his coding algorithm as a graduate student"),
        ],
        "concepts": [
            ("Entropy", "Measure of average information content per symbol from a source"),
            ("Channel Capacity", "Maximum reliable rate of information transmission over a noisy channel"),
            ("Prefix Code", "Code where no codeword is a prefix of another, enabling unique decoding"),
            ("Source Coding Theorem", "Shannon's theorem establishing entropy as the limit of compression"),
        ],
        "writings": [
            ("Shannon 1948 Mathematical Theory of Communication", "Foundational paper of information theory"),
            ("Huffman 1952 Minimum Redundancy Codes", "Original Huffman coding algorithm paper"),
        ],
        "events": [
            ("Shannon publishes information theory", "1948 Bell System Technical Journal foundational paper"),
            ("Huffman invents optimal coding", "1952 Huffman publishes minimum-redundancy code construction"),
        ],
    },
    "info_dictionary_based": {
        "persons": [
            ("Abraham Lempel", "Co-inventor of LZ77 and LZ78 dictionary-based compression"),
            ("Jacob Ziv", "Co-inventor of LZ77 and LZ78 dictionary-based compression"),
            ("Terry Welch", "Inventor of LZW variant used in GIF and TIFF"),
        ],
        "locations": [
            ("Technion Israel Institute of Technology", "Where Lempel and Ziv developed dictionary-based compression"),
        ],
        "concepts": [
            ("Dictionary-Based Compression", "Compression method that builds a dictionary of repeated patterns"),
            ("Sliding Window", "LZ77 technique using a window of previously seen data as the dictionary"),
            ("Asymptotic Optimality", "Property of compression scheme approaching the entropy limit asymptotically"),
        ],
        "writings": [
            ("Lempel Ziv 1977 LZ77", "Original LZ77 sliding window compression paper"),
            ("Lempel Ziv 1978 LZ78", "Original LZ78 explicit dictionary compression paper"),
        ],
        "events": [
            ("Lempel Ziv publish LZ77", "1977 introduction of dictionary-based compression"),
            ("LZW variant developed", "1984 Terry Welch's LZW variant for hardware implementation"),
        ],
    },
    "info_transform_based": {
        "persons": [
            ("Nasir Ahmed", "Inventor of the Discrete Cosine Transform"),
            ("Ingrid Daubechies", "Pioneer of wavelet theory used in JPEG 2000"),
            ("JCT-VC", "Joint Collaborative Team on Video Coding, developed HEVC"),
        ],
        "locations": [
            ("Joint Photographic Experts Group", "Standards body that developed JPEG"),
        ],
        "concepts": [
            ("Discrete Cosine Transform", "Frequency-domain transform used in JPEG and most video standards"),
            ("Wavelet Transform", "Multi-resolution frequency analysis used in JPEG 2000"),
            ("Quantization Table", "Per-coefficient quantization parameters defining JPEG compression quality"),
            ("Energy Compaction", "Property of orthogonal transforms concentrating signal energy in few coefficients"),
            ("Motion Compensation", "Video compression technique exploiting temporal redundancy"),
        ],
        "writings": [
            ("JPEG 1992 Standard", "ISO/IEC 10918-1 baseline JPEG specification"),
            ("HEVC 2013 Specification", "ITU-T H.265 high efficiency video coding specification"),
        ],
        "events": [
            ("DCT invented", "1974 Ahmed introduces the discrete cosine transform"),
            ("JPEG standardized", "1992 ISO publishes JPEG standard"),
            ("HEVC released", "2013 ITU-T publishes H.265 high efficiency video coding"),
        ],
    },
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()[:50]


def main() -> None:
    # Load existing chunked corpus
    with open(OUT / "fullcorpus_btut_input.json", "r") as f:
        existing = json.load(f)

    chunk_entities = existing["entities"]
    chunk_edges = existing["relationships"]

    # Build heterogeneous entities
    new_entities = []
    new_edges = []

    # Map regime to first chunk in that regime (for cross-type edges)
    regime_to_first_chunk = {}
    for ent in chunk_entities:
        regime = ent["attributes"]["physics_regime"]
        if regime not in regime_to_first_chunk:
            regime_to_first_chunk[regime] = ent["name"]

    for regime, contents in REGIME_ENTITIES.items():
        regime_anchor = regime_to_first_chunk.get(regime)

        for entity_type, items in contents.items():
            etype_singular = entity_type.rstrip("s")  # persons -> person, etc.
            for name, description in items:
                eid = f"{regime}__{etype_singular}__{slugify(name)}"
                new_entities.append({
                    "name": eid,
                    "type": etype_singular,
                    "attributes": {
                        "name": name,
                        "description": description,
                        "physics_regime": regime,
                        "entity_type": etype_singular,
                    },
                })

                # Edge: this entity belongs to this regime (connects to first chunk)
                if regime_anchor:
                    new_edges.append({
                        "source": eid,
                        "target": regime_anchor,
                        "type": "belongs_to_regime",
                        "weight": 0.6,
                    })

        # Cross-type edges within the regime: connect persons to writings, etc.
        # Get all entities in this regime
        regime_entities_local = [
            e for e in new_entities
            if e["attributes"].get("physics_regime") == regime
        ]
        # Connect each person to each writing in the same regime
        persons = [e for e in regime_entities_local if e["type"] == "person"]
        writings = [e for e in regime_entities_local if e["type"] == "writing"]
        events = [e for e in regime_entities_local if e["type"] == "event"]
        concepts = [e for e in regime_entities_local if e["type"] == "concept"]
        locations = [e for e in regime_entities_local if e["type"] == "location"]

        for p in persons[:3]:  # Top 3 persons
            for w in writings[:2]:
                new_edges.append({"source": p["name"], "target": w["name"], "type": "authored", "weight": 0.8})
            for e in events[:2]:
                new_edges.append({"source": p["name"], "target": e["name"], "type": "involved_in", "weight": 0.7})
            for c in concepts[:2]:
                new_edges.append({"source": p["name"], "target": c["name"], "type": "developed", "weight": 0.7})
            for loc in locations[:1]:
                new_edges.append({"source": p["name"], "target": loc["name"], "type": "worked_at", "weight": 0.6})

    # Combine
    all_entities = chunk_entities + new_entities
    all_edges = chunk_edges + new_edges

    print(f"Original chunks: {len(chunk_entities)}")
    print(f"New heterogeneous entities: {len(new_entities)}")
    print(f"  Total: {len(all_entities)}")
    print()
    print(f"Original chunk edges: {len(chunk_edges)}")
    print(f"New cross-type edges: {len(new_edges)}")
    print(f"  Total: {len(all_edges)}")
    print()

    # Type distribution
    from collections import Counter
    type_counts = Counter(e["type"] for e in all_entities)
    print("Entity types:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print()

    # Regime distribution
    regime_counts = Counter(e["attributes"].get("physics_regime", "?") for e in all_entities)
    print("Regimes:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")

    # Save
    output_path = OUT / "heterogeneous_corpus.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"entities": all_entities, "relationships": all_edges}, f, indent=2)

    print()
    print(f"Saved: {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
