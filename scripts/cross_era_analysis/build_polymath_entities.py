"""Generate heterogeneous entities (persons, concepts, events, locations, writings)
for each polymath regime.

This extends build_heterogeneous_corpus.py with Newton, Von Neumann, and Leonardo
specific entities. The BTUT engine produces its strongest anomaly signal when the
corpus contains diverse entity types — the heterogeneous run produced 25/25
canonical regime markers while the uniform run produced noise.

Output: entities and relationships dicts that can be combined with chunked
document entities into a single BTUT input file.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

OUT = Path(__file__).parent / "output"


POLYMATH_ENTITIES = {
    # ============================================
    # NEWTON'S FORGOTTEN PARADIGM — ALCHEMY
    # ============================================
    "newton_alchemy": {
        "persons": [
            ("Isaac Newton", "English physicist, mathematician, and alchemist, 1642-1727"),
            ("Robert Boyle", "English natural philosopher whose chemistry Newton studied extensively"),
            ("George Starkey", "American alchemist whose manuscripts Newton copied and expanded"),
            ("Jan Baptist van Helmont", "Flemish alchemist whose work influenced Newton's chemistry"),
            ("Eirenaeus Philalethes", "Pseudonymous alchemist (George Starkey) whose works Newton annotated"),
            ("John Maynard Keynes", "Economist who acquired Newton's alchemical manuscripts at auction in 1936"),
            ("Lawrence Principe", "Modern historian of alchemy who reproduced Newton's experiments"),
            ("William Newman", "Modern historian who decoded Newton's alchemical recipes"),
        ],
        "locations": [
            ("Trinity College Cambridge", "Newton's alchemical laboratory location 1669-1696"),
            ("The Royal Mint", "Where Newton served as Warden and Master after leaving Cambridge"),
            ("Portsmouth Papers", "Archive holding Newton's alchemical manuscripts"),
            ("Indiana University Chymistry Project", "Modern digital edition of Newton's alchemical corpus"),
        ],
        "concepts": [
            ("Philosophical Mercury", "Alchemical substance Newton sought to prepare, purified metallic mercury with specific properties"),
            ("Green Lion", "Alchemical symbol for a specific reagent, possibly vitriol or lead-antimony compound"),
            ("Sophic Sulphur", "Alchemical principle representing combustibility and metallic body formation"),
            ("Regulus of Antimony", "Specific metallic antimony preparation Newton worked with extensively"),
            ("Net", "A specific alchemical preparation Newton called the Net, likely copper-antimony alloy"),
            ("Philosopher's Stone", "The mythical substance enabling transmutation of base metals to gold"),
            ("Transmutation", "The alchemical transformation of one metal into another"),
            ("Calcination", "Heating process to reduce substances to their primal matter"),
            ("Sublimation", "Alchemical purification by vaporizing and recondensing solids"),
            ("Putrefaction", "Alchemical stage of decomposition preceding regeneration"),
            ("Projection", "Final alchemical operation where the stone transmutes base metal"),
        ],
        "events": [
            ("Newton begins alchemical studies", "c. 1669, shortly after receiving his Cambridge degree"),
            ("Newton's Praxis manuscript", "c. 1695, late alchemical synthesis of procedures"),
            ("Newton leaves Cambridge for the Mint", "1696, transitions from alchemy to currency"),
            ("Newton's alchemical papers deemed not fit to be printed", "1727, after his death his library is catalogued"),
            ("Keynes auctions Newton alchemical manuscripts", "1936 Sotheby's auction disperses Newton's alchemy papers"),
            ("Chymistry of Isaac Newton Project launches", "2005 digital edition begins"),
        ],
        "writings": [
            ("Keynes MS 28 Praxis", "Newton's late alchemical synthesis manuscript describing procedures"),
            ("Keynes MS 18", "Newton's alchemical notebook with extensive reading notes"),
            ("Index Chemicus", "Newton's alphabetical index of alchemical terminology"),
            ("Clavis", "Newton's key manuscript translating and commenting on an earlier alchemical work"),
            ("Commonplace Book on Alchemy", "Newton's personal notes on alchemical reading"),
        ],
    },
    # ============================================
    # NEWTON MAINSTREAM PARADIGMS (controls)
    # ============================================
    "newton_mechanics": {
        "persons": [
            ("Edmond Halley", "Astronomer who encouraged Newton to publish the Principia"),
            ("Gottfried Leibniz", "Co-inventor of calculus, Newton's rival"),
            ("Robert Hooke", "Contemporaneous natural philosopher, priority dispute with Newton"),
        ],
        "locations": [
            ("Woolsthorpe Manor", "Newton's family home where he developed early theories"),
            ("Royal Society", "Learned society where Newton presented his work"),
        ],
        "concepts": [
            ("Universal Gravitation", "Newton's law that all massive bodies attract each other"),
            ("Laws of Motion", "Newton's three fundamental laws of classical mechanics"),
            ("Calculus of Fluxions", "Newton's version of differential and integral calculus"),
            ("Absolute Space and Time", "Newton's concept of fixed reference frame for motion"),
            ("Centripetal Force", "Newton's term for force directed toward center of orbit"),
        ],
        "events": [
            ("Principia published", "1687 first edition of Philosophiae Naturalis Principia Mathematica"),
            ("Newton's annus mirabilis", "1665-1666 plague year when Newton developed key ideas"),
        ],
        "writings": [
            ("Philosophiae Naturalis Principia Mathematica", "1687 Newton's foundational physics text"),
            ("Method of Fluxions", "Newton's 1671 calculus treatise"),
        ],
    },
    "newton_optics": {
        "persons": [
            ("Christiaan Huygens", "Contemporaneous natural philosopher, wave theory of light"),
        ],
        "locations": [],
        "concepts": [
            ("Prism Experiment", "Newton's demonstration that white light contains all colors"),
            ("Corpuscular Theory of Light", "Newton's particle theory of light"),
            ("Newton's Rings", "Interference pattern from a convex lens on a flat surface"),
            ("Chromatic Aberration", "Focus error due to different wavelengths bending differently"),
        ],
        "events": [
            ("Opticks published", "1704 Newton's major work on light and color"),
        ],
        "writings": [
            ("Opticks", "1704 Newton's comprehensive treatise on light"),
        ],
    },
    "newton_theology_control": {
        "persons": [],
        "locations": [],
        "concepts": [
            ("Apocalyptic Prophecy", "Newton's interpretation of Biblical prophecies about end times"),
            ("Church Corruption", "Newton's view that the church was corrupted after Constantine"),
        ],
        "events": [
            ("Observations upon Daniel published posthumously", "1733 Newton's theological work"),
        ],
        "writings": [
            ("Observations upon the Prophecies of Daniel", "Newton's 1733 posthumous theological text"),
        ],
    },
    # ============================================
    # VON NEUMANN'S FORGOTTEN PARADIGM — CELLULAR AUTOMATA
    # ============================================
    "vn_cellular_automata": {
        "persons": [
            ("John von Neumann", "Hungarian-American mathematician and polymath, 1903-1957"),
            ("Arthur Burks", "Editor who compiled Von Neumann's posthumous automata manuscript"),
            ("Stanislaw Ulam", "Polish mathematician who suggested the cellular space model to Von Neumann"),
            ("John Conway", "British mathematician who invented Game of Life 1970"),
            ("Stephen Wolfram", "Modern complexity theorist who classified cellular automata in 1983"),
            ("Leonard Adleman", "Modern computer scientist who demonstrated DNA computing 1994"),
            ("Edward Fredkin", "Physicist who proposed computational physics based on cellular automata"),
            ("Konrad Zuse", "German computer pioneer who proposed Rechnender Raum (computing universe)"),
        ],
        "locations": [
            ("Institute for Advanced Study Princeton", "Where Von Neumann worked on automata theory 1945-1957"),
            ("Los Alamos National Laboratory", "Where Von Neumann and Ulam developed CA concepts"),
        ],
        "concepts": [
            ("Universal Constructor", "Von Neumann's machine capable of building copies of itself from instructions"),
            ("Self-Reproduction", "The ability of a machine to produce functional copies of itself"),
            ("29-State Cellular Automaton", "Von Neumann's specific CA with 29 states per cell"),
            ("Transition Function", "The rule determining next-state of a cell from current state and neighbors"),
            ("Von Neumann Neighborhood", "The four orthogonally adjacent cells in a 2D grid"),
            ("Computational Universality", "Capability to simulate any Turing machine"),
            ("Self-Description", "A machine's ability to contain a description of itself (quine property)"),
            ("Emergent Complexity", "Complex behaviors arising from simple local rules"),
            ("Computational Irreducibility", "Systems whose behavior can only be determined by running them"),
        ],
        "events": [
            ("Von Neumann begins CA work", "c. 1948 at Los Alamos with Ulam"),
            ("Hixon Symposium lecture", "1948 Von Neumann presents General and Logical Theory of Automata"),
            ("Von Neumann death", "February 8 1957 leaving automata manuscript unfinished"),
            ("Burks publishes Theory of Self-Reproducing Automata", "1966 posthumous edition"),
            ("Conway invents Game of Life", "1970 cellular automaton published in Scientific American"),
            ("Wolfram classifies cellular automata", "1983 four-class classification published"),
            ("Adleman demonstrates DNA computing", "1994 molecular computation of Hamiltonian path"),
        ],
        "writings": [
            ("Theory of Self-Reproducing Automata", "Von Neumann's posthumous 1966 book edited by Burks"),
            ("General and Logical Theory of Automata", "Von Neumann's 1948 Hixon Symposium paper"),
            ("A New Kind of Science", "Wolfram's 2002 comprehensive CA treatise"),
            ("Adleman 1994 Molecular Computation Paper", "First demonstration of DNA computing"),
        ],
    },
    "vn_computing": {
        "persons": [
            ("Alan Turing", "British mathematician whose universal machine concept influenced Von Neumann"),
            ("J. Presper Eckert", "Co-designer of ENIAC whose work influenced the EDVAC report"),
            ("John Mauchly", "Co-designer of ENIAC"),
        ],
        "locations": [
            ("University of Pennsylvania Moore School", "Where EDVAC was designed"),
        ],
        "concepts": [
            ("Stored Program Architecture", "The Von Neumann architecture where instructions and data share memory"),
            ("Memory Hierarchy", "Organization of fast registers, slow main memory, and storage"),
            ("Arithmetic Logic Unit", "The computing component that performs arithmetic operations"),
            ("Control Unit", "The component that sequences instruction execution"),
        ],
        "events": [
            ("EDVAC Report drafted", "June 1945 First Draft of a Report on the EDVAC"),
        ],
        "writings": [
            ("First Draft of a Report on the EDVAC", "Von Neumann's 1945 architectural document"),
        ],
    },
    "vn_quantum": {
        "persons": [
            ("David Hilbert", "German mathematician whose formalism Von Neumann applied to QM"),
            ("Paul Dirac", "Physicist whose notation competed with Von Neumann's"),
        ],
        "locations": [],
        "concepts": [
            ("Hilbert Space Formalism", "The mathematical framework for quantum mechanics"),
            ("Measurement Problem", "The question of how quantum superpositions become classical outcomes"),
            ("Wave Function Collapse", "The transition from superposition to definite state upon measurement"),
        ],
        "events": [
            ("Mathematical Foundations published", "1932 German, 1955 English translation"),
        ],
        "writings": [
            ("Mathematical Foundations of Quantum Mechanics", "Von Neumann's 1932 rigorous QM formalization"),
        ],
    },
    "vn_game_theory": {
        "persons": [
            ("Oskar Morgenstern", "Austrian economist, Von Neumann's Theory of Games coauthor"),
            ("John Nash", "American mathematician who extended Von Neumann's work with Nash equilibrium"),
        ],
        "locations": [],
        "concepts": [
            ("Minimax Theorem", "Von Neumann's foundational result for two-person zero-sum games"),
            ("Nash Equilibrium", "Extension of Von Neumann's work to non-zero-sum games"),
            ("Expected Utility", "The decision-theoretic concept Von Neumann and Morgenstern axiomatized"),
        ],
        "events": [
            ("Theory of Games published", "1944 Von Neumann and Morgenstern foundational work"),
        ],
        "writings": [
            ("Theory of Games and Economic Behavior", "Von Neumann-Morgenstern 1944 foundational text"),
        ],
    },
    # ============================================
    # LEONARDO'S FORGOTTEN PARADIGM — FLIGHT AND FLUIDS
    # ============================================
    "leonardo_flight": {
        "persons": [
            ("Leonardo da Vinci", "Italian polymath 1452-1519, inventor and engineer"),
            ("Francesco Melzi", "Leonardo's pupil who preserved his notebooks after his death"),
            ("Ludovico Sforza", "Duke of Milan who employed Leonardo as court engineer"),
            ("Adrian Nicholas", "Modern skydiver who successfully tested Leonardo's parachute design in 2000"),
            ("Igor Sikorsky", "Modern helicopter pioneer whose designs were influenced by Leonardo's aerial screw"),
        ],
        "locations": [
            ("Milan", "Where Leonardo served Sforza and made many engineering studies"),
            ("Florence", "Where Leonardo studied birds in flight"),
            ("Codex Atlanticus Biblioteca Ambrosiana", "Milan library holding Leonardo's largest notebook collection"),
            ("British Library Codex Arundel", "Leonardo notebook held in British Library"),
        ],
        "concepts": [
            ("Aerial Screw", "Leonardo's helicopter-like rotating airfoil concept"),
            ("Ornithopter", "Flapping-wing flying machine design"),
            ("Bird Flight Mechanics", "Leonardo's observations of wing motion, lift, and gliding"),
            ("Parachute Design", "Leonardo's pyramid-shaped proto-parachute"),
            ("Lift from Pressure Difference", "Leonardo's intuition about air pressure above and below a wing"),
            ("Center of Gravity in Flight", "Leonardo's understanding of balance during flight"),
        ],
        "events": [
            ("Codex on the Flight of Birds written", "1505 Leonardo's dedicated notebook on bird flight"),
            ("Leonardo's aerial screw sketch", "c. 1485-1490 helicopter precursor"),
            ("Leonardo's parachute tested", "2000 Adrian Nicholas successfully tests Leonardo's design"),
            ("Leonardo's notebooks rediscovered", "19th century Richter translation makes them widely accessible"),
        ],
        "writings": [
            ("Codex on the Flight of Birds", "Leonardo's 1505 dedicated flight manuscript"),
            ("Codex Atlanticus flight entries", "Various flight mechanics notes across Leonardo's largest codex"),
            ("Madrid Codex II aerial screw notes", "Leonardo's rotor concept documentation"),
        ],
    },
    "leonardo_fluids": {
        "persons": [
            ("Osborne Reynolds", "British engineer who formally described turbulence in 1883"),
            ("Claude-Louis Navier", "French engineer who formulated fluid equations in 1822"),
            ("George Gabriel Stokes", "British mathematician who completed the Navier-Stokes equations"),
        ],
        "locations": [
            ("Codex Leicester", "Leonardo's notebook owned by Bill Gates, focused on water and fluids"),
        ],
        "concepts": [
            ("Turbulenza", "Leonardo's original term for turbulent water motion"),
            ("Eddy", "Rotating fluid structure Leonardo extensively drew and described"),
            ("Vortex", "Spiral fluid structure Leonardo observed in water"),
            ("Laminar Flow", "Smooth ordered flow contrasted with turbulent flow"),
            ("Flow Around Obstacles", "Leonardo's systematic study of water meeting barriers"),
            ("Wave Propagation", "Leonardo's observations of water waves"),
        ],
        "events": [
            ("Codex Leicester compiled", "c. 1506-1510 Leonardo's hydraulics notebook"),
            ("Reynolds turbulence paper", "1883 first formal description of laminar-turbulent transition"),
        ],
        "writings": [
            ("Codex Leicester", "Leonardo's 1506-1510 notebook on water and fluid motion"),
            ("Codex Atlanticus hydraulics sections", "Various fluid dynamics observations"),
        ],
    },
    "leonardo_anatomy": {
        "persons": [
            ("Andreas Vesalius", "16th-century anatomist whose work superseded Leonardo's unpublished drawings"),
            ("Francesco Melzi", "Leonardo's heir who kept his anatomical drawings unpublished"),
        ],
        "locations": [
            ("Royal Collection Windsor", "Holds Leonardo's anatomical drawings"),
        ],
        "concepts": [
            ("Aortic Valve Mechanism", "Leonardo's drawings correctly predict valve closure mechanism (confirmed by 2014 MRI)"),
            ("Muscular Action", "Leonardo's analysis of how muscles produce motion"),
            ("Heart as Pump", "Leonardo's recognition of cardiac function"),
        ],
        "events": [
            ("Leonardo dissects 30 corpses", "c. 1489-1513 anatomical studies"),
            ("MRI confirms aortic valve prediction", "2014 modern imaging confirms Leonardo's fluid dynamics of valve"),
        ],
        "writings": [
            ("Anatomical Manuscripts", "Leonardo's drawings at Windsor"),
        ],
    },
    "leonardo_art_control": {
        "persons": [],
        "locations": [],
        "concepts": [
            ("Sfumato", "Leonardo's smoky blending technique in painting"),
            ("Linear Perspective", "Geometric rules for depicting 3D space on 2D surface"),
            ("Paragone", "Leonardo's debate comparing the arts"),
        ],
        "events": [],
        "writings": [
            ("Trattato della Pittura", "Leonardo's Treatise on Painting compiled posthumously"),
        ],
    },
    # ============================================
    # MODERN DESCENDANT REGIMES
    # ============================================
    "modern_materials": {
        "persons": [
            ("Linus Pauling", "Chemist who developed ligand field theory foundations"),
        ],
        "locations": [],
        "concepts": [
            ("Transition Metal Complex", "Coordination compound of a transition metal with ligands"),
            ("Oxidation State", "The degree of oxidation of an atom in a compound"),
            ("Coordination Number", "Number of ligands around a central atom"),
            ("Ligand Field Theory", "Theory of bonding in transition metal complexes"),
            ("d-Orbital Splitting", "The energy difference between d orbitals in a ligand field"),
        ],
        "events": [],
        "writings": [],
    },
    "modern_complexity": {
        "persons": [
            ("Christopher Langton", "Invented the concept of 'edge of chaos' in cellular automata"),
            ("Norman Packard", "Co-developer of edge of chaos concept"),
            ("Matthew Cook", "Proved Wolfram's Rule 110 is Turing-complete"),
        ],
        "locations": [
            ("Santa Fe Institute", "Center for complexity research"),
        ],
        "concepts": [
            ("Edge of Chaos", "The phase transition between order and chaos where computation emerges"),
            ("Rule 110", "Elementary cellular automaton proved Turing-complete"),
            ("Class IV Cellular Automata", "Wolfram's class of complex computational CAs"),
            ("Universal Turing Machine", "Computational model capable of simulating any other Turing machine"),
        ],
        "events": [
            ("Cook proves Rule 110 universal", "1998 proof that simplest non-trivial CA is Turing-complete"),
        ],
        "writings": [
            ("A New Kind of Science", "Wolfram's 2002 comprehensive cellular automata analysis"),
        ],
    },
    "modern_aerodynamics": {
        "persons": [
            ("Ludwig Prandtl", "German engineer who developed boundary layer theory"),
            ("Theodore von Karman", "Aerodynamicist who described vortex streets"),
        ],
        "locations": [],
        "concepts": [
            ("Reynolds Number", "Dimensionless quantity predicting laminar-turbulent transition"),
            ("Boundary Layer", "Thin layer near a surface where fluid velocity transitions"),
            ("Navier-Stokes Equations", "Mathematical equations describing fluid motion"),
            ("Karman Vortex Street", "Pattern of vortices shed behind a bluff body"),
            ("Lift Coefficient", "Dimensionless measure of aerodynamic lift"),
            ("Airfoil", "Cross-sectional shape designed to generate lift"),
        ],
        "events": [
            ("Reynolds publishes turbulence paper", "1883 foundational modern turbulence paper"),
        ],
        "writings": [
            ("Reynolds 1883 Experimental Investigation", "The foundational modern turbulence paper"),
        ],
    },
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()[:50]


def generate_polymath_entities(regime_to_anchor: dict) -> tuple[list[dict], list[dict]]:
    """Generate entities and cross-type edges for polymath regimes.

    Args:
        regime_to_anchor: dict mapping regime name to the name of an existing
            chunk entity in that regime (to create cross-type edges).

    Returns:
        (new_entities, new_edges)
    """
    new_entities = []
    new_edges = []

    for regime, contents in POLYMATH_ENTITIES.items():
        regime_anchor = regime_to_anchor.get(regime)

        regime_local = []

        for entity_type, items in contents.items():
            etype_singular = entity_type.rstrip("s")
            for name, description in items:
                eid = f"{regime}__{etype_singular}__{slugify(name)}"
                entity = {
                    "name": eid,
                    "type": etype_singular,
                    "attributes": {
                        "name": name,
                        "description": description,
                        "physics_regime": regime,
                        "entity_type": etype_singular,
                    },
                }
                new_entities.append(entity)
                regime_local.append(entity)

                if regime_anchor:
                    new_edges.append({
                        "source": eid,
                        "target": regime_anchor,
                        "type": "belongs_to_regime",
                        "weight": 0.6,
                    })

        # Intra-regime cross-type edges
        persons = [e for e in regime_local if e["type"] == "person"]
        writings = [e for e in regime_local if e["type"] == "writing"]
        events = [e for e in regime_local if e["type"] == "event"]
        concepts = [e for e in regime_local if e["type"] == "concept"]
        locations = [e for e in regime_local if e["type"] == "location"]

        for p in persons[:4]:
            for w in writings[:3]:
                new_edges.append({"source": p["name"], "target": w["name"], "type": "authored", "weight": 0.8})
            for e in events[:3]:
                new_edges.append({"source": p["name"], "target": e["name"], "type": "involved_in", "weight": 0.7})
            for c in concepts[:3]:
                new_edges.append({"source": p["name"], "target": c["name"], "type": "developed", "weight": 0.7})
            for loc in locations[:2]:
                new_edges.append({"source": p["name"], "target": loc["name"], "type": "worked_at", "weight": 0.6})

    return new_entities, new_edges


def main() -> None:
    # Standalone testing: generate entities without anchoring
    stub_anchors = {}
    entities, edges = generate_polymath_entities(stub_anchors)

    from collections import Counter
    type_counts = Counter(e["type"] for e in entities)
    regime_counts = Counter(e["attributes"]["physics_regime"] for e in entities)

    print(f"Generated {len(entities)} polymath entities")
    print()
    print("Entity types:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print()
    print("Regimes:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")
    print()
    print(f"Intra-regime edges: {len(edges)}")

    OUT.mkdir(exist_ok=True)
    out_path = OUT / "polymath_entities_standalone.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"entities": entities, "relationships": edges}, f, indent=2)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()
