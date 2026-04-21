"""Expand bundled ontology JSON files in both lo_nlp/data/ and
frontend/data/ontology/.

Idempotent: reads each file, merges in the additions (keyed by code),
writes back. New entries are appended; existing entries are left alone
unless --overwrite is set.

Run:
    python scripts/expand_ontologies.py
"""
from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PY_DIR = REPO / "lo_nlp" / "data"
TS_DIR = REPO / "frontend" / "data" / "ontology"

# ── COUNTRIES ───────────────────────────────────────────────────────
# ~40 additions to fill common gaps across the world.
COUNTRIES_ADD = [
    {"code": "AUT", "name": "Austria", "aliases": ["AT"]},
    {"code": "HUN", "name": "Hungary", "aliases": ["HU"]},
    {"code": "SVK", "name": "Slovakia", "aliases": ["SK"]},
    {"code": "SVN", "name": "Slovenia", "aliases": ["SI"]},
    {"code": "HRV", "name": "Croatia", "aliases": ["HR"]},
    {"code": "BGR", "name": "Bulgaria", "aliases": ["BG"]},
    {"code": "SRB", "name": "Serbia", "aliases": ["RS"]},
    {"code": "LTU", "name": "Lithuania", "aliases": ["LT"]},
    {"code": "LVA", "name": "Latvia", "aliases": ["LV"]},
    {"code": "EST", "name": "Estonia", "aliases": ["EE"]},
    {"code": "ISL", "name": "Iceland", "aliases": ["IS"]},
    {"code": "LUX", "name": "Luxembourg", "aliases": ["LU"]},
    {"code": "MLT", "name": "Malta", "aliases": ["MT"]},
    {"code": "CYP", "name": "Cyprus", "aliases": ["CY"]},
    {"code": "BLR", "name": "Belarus", "aliases": ["BY"]},
    {"code": "MDA", "name": "Moldova", "aliases": ["MD"]},
    {"code": "GEO", "name": "Georgia", "aliases": ["GE"]},
    {"code": "ARM", "name": "Armenia", "aliases": ["AM"]},
    {"code": "AZE", "name": "Azerbaijan", "aliases": ["AZ"]},
    {"code": "KAZ", "name": "Kazakhstan", "aliases": ["KZ"]},
    {"code": "UZB", "name": "Uzbekistan", "aliases": ["UZ"]},
    {"code": "LKA", "name": "Sri Lanka", "aliases": ["LK", "Ceylon"]},
    {"code": "NPL", "name": "Nepal", "aliases": ["NP"]},
    {"code": "MMR", "name": "Myanmar", "aliases": ["MM", "Burma"]},
    {"code": "KHM", "name": "Cambodia", "aliases": ["KH"]},
    {"code": "LAO", "name": "Laos", "aliases": ["LA"]},
    {"code": "TWN", "name": "Taiwan", "aliases": ["TW", "Republic of China", "ROC"]},
    {"code": "HKG", "name": "Hong Kong", "aliases": ["HK"]},
    {"code": "KEN", "name": "Kenya", "aliases": ["KE"]},
    {"code": "ETH", "name": "Ethiopia", "aliases": ["ET"]},
    {"code": "TZA", "name": "Tanzania", "aliases": ["TZ"]},
    {"code": "UGA", "name": "Uganda", "aliases": ["UG"]},
    {"code": "GHA", "name": "Ghana", "aliases": ["GH"]},
    {"code": "MAR", "name": "Morocco", "aliases": ["MA"]},
    {"code": "TUN", "name": "Tunisia", "aliases": ["TN"]},
    {"code": "DZA", "name": "Algeria", "aliases": ["DZ"]},
    {"code": "LBY", "name": "Libya", "aliases": ["LY"]},
    {"code": "SDN", "name": "Sudan", "aliases": ["SD"]},
    {"code": "AGO", "name": "Angola", "aliases": ["AO"]},
    {"code": "COD", "name": "Democratic Republic of the Congo", "aliases": ["CD", "DRC", "Zaire"]},
    {"code": "ZMB", "name": "Zambia", "aliases": ["ZM"]},
    {"code": "ZWE", "name": "Zimbabwe", "aliases": ["ZW"]},
    {"code": "MOZ", "name": "Mozambique", "aliases": ["MZ"]},
    {"code": "CUB", "name": "Cuba", "aliases": ["CU"]},
    {"code": "DOM", "name": "Dominican Republic", "aliases": ["DO"]},
    {"code": "VEN", "name": "Venezuela", "aliases": ["VE"]},
    {"code": "ECU", "name": "Ecuador", "aliases": ["EC"]},
    {"code": "BOL", "name": "Bolivia", "aliases": ["BO"]},
    {"code": "URY", "name": "Uruguay", "aliases": ["UY"]},
    {"code": "PAN", "name": "Panama", "aliases": ["PA"]},
    {"code": "CRI", "name": "Costa Rica", "aliases": ["CR"]},
]

# ── MESH ───────────────────────────────────────────────────────────
MESH_ADD = [
    {"code": "D006333", "name": "Heart Failure", "parent": "D002318", "aliases": ["HF", "CHF", "congestive heart failure"]},
    {"code": "D007676", "name": "Kidney Failure, Chronic", "parent": "D007674", "aliases": ["CKD", "chronic kidney disease", "renal failure"]},
    {"code": "D011014", "name": "Pneumonia", "parent": "D012140", "aliases": ["pneumonia", "lung infection"]},
    {"code": "D018805", "name": "Sepsis", "parent": "D003141", "aliases": ["sepsis", "septicaemia", "septic shock"]},
    {"code": "D015658", "name": "HIV Infections", "parent": "D001327", "aliases": ["HIV", "human immunodeficiency virus"]},
    {"code": "D000163", "name": "Acquired Immunodeficiency Syndrome", "parent": "D015658", "aliases": ["AIDS"]},
    {"code": "D010024", "name": "Osteoporosis", "parent": "D001851", "aliases": ["osteoporosis", "brittle bones"]},
    {"code": "D009765", "name": "Obesity", "parent": "D044343", "aliases": ["obesity", "overweight"]},
    {"code": "D013636", "name": "Tuberculosis", "parent": "D001424", "aliases": ["TB", "tuberculosis"]},
    {"code": "D006331", "name": "Heart Diseases", "parent": "D002318", "aliases": ["heart condition", "cardiac disease"]},
    {"code": "D019337", "name": "Hematologic Neoplasms", "parent": "D009369", "aliases": ["blood cancer", "hematologic malignancy"]},
    {"code": "D002289", "name": "Carcinoma, Non-Small-Cell Lung", "parent": "D008175", "aliases": ["NSCLC", "non-small cell lung cancer"]},
    {"code": "D055752", "name": "Small Cell Lung Carcinoma", "parent": "D008175", "aliases": ["SCLC", "small cell lung cancer"]},
    {"code": "D002277", "name": "Carcinoma", "parent": "D009369", "aliases": ["carcinoma"]},
    {"code": "D009164", "name": "Musculoskeletal Diseases", "parent": "D013568", "aliases": ["musculoskeletal disease"]},
    {"code": "D004941", "name": "Esophageal Neoplasms", "parent": "D009369", "aliases": ["esophageal cancer"]},
    {"code": "D010190", "name": "Pancreatic Neoplasms", "parent": "D009369", "aliases": ["pancreatic cancer"]},
    {"code": "D010051", "name": "Ovarian Neoplasms", "parent": "D009369", "aliases": ["ovarian cancer"]},
    {"code": "D016889", "name": "Endometrial Neoplasms", "parent": "D009369", "aliases": ["endometrial cancer", "uterine cancer"]},
    {"code": "D014565", "name": "Urogenital Neoplasms", "parent": "D009369", "aliases": ["urogenital cancer"]},
    {"code": "D018570", "name": "Risk Assessment", "parent": "D012307", "aliases": ["risk assessment"]},
    {"code": "D016015", "name": "Logistic Models", "parent": "D015194", "aliases": ["logistic regression"]},
    {"code": "D055815", "name": "Young Adult", "parent": "D000328", "aliases": ["young adult"]},
    {"code": "D000328", "name": "Adult", "parent": "D006801", "aliases": ["adult"]},
    {"code": "D008875", "name": "Middle Aged", "parent": "D000328", "aliases": ["middle aged", "middle-aged"]},
    {"code": "D000368", "name": "Aged", "parent": "D006801", "aliases": ["aged", "elderly"]},
    {"code": "D002648", "name": "Child", "parent": "D006801", "aliases": ["child", "pediatric"]},
    {"code": "D007223", "name": "Infant", "parent": "D006801", "aliases": ["infant", "baby"]},
    {"code": "D005260", "name": "Female", "parent": "D012727", "aliases": ["female", "women"]},
    {"code": "D008297", "name": "Male", "parent": "D012727", "aliases": ["male", "men"]},
    {"code": "D017203", "name": "Intensive Care Units", "parent": "D006704", "aliases": ["ICU", "intensive care unit"]},
    {"code": "D013997", "name": "Time Factors", "parent": "D006235", "aliases": ["time factors"]},
    {"code": "D064427", "name": "Drug-Related Side Effects", "parent": "D000074243", "aliases": ["adverse drug reaction", "ADR"]},
    {"code": "D004195", "name": "Disease Susceptibility", "parent": "D004194", "aliases": ["disease susceptibility"]},
    {"code": "D011379", "name": "Prognosis", "parent": "D004194", "aliases": ["prognosis", "outcome prediction"]},
    {"code": "D017060", "name": "Outcome Assessment, Health Care", "parent": "D011361", "aliases": ["outcome assessment"]},
    {"code": "D058888", "name": "Single-Cell Analysis", "parent": "D005823", "aliases": ["single-cell", "scRNA-seq"]},
    {"code": "D057566", "name": "Self-Renewal of Stem Cells", "parent": "D013234", "aliases": ["stem cell self-renewal"]},
    {"code": "D002477", "name": "Cells, Cultured", "parent": "D002460", "aliases": ["cell culture"]},
    {"code": "D048708", "name": "Proof of Concept Study", "parent": "D003196", "aliases": ["proof of concept"]},
]

# ── HS CODES ──────────────────────────────────────────────────────
HS_ADD = [
    {"code": "27", "name": "Mineral fuels, oils, and products of their distillation", "aliases": ["oil", "petroleum", "coal", "mineral fuels", "HS27"]},
    {"code": "29", "name": "Organic chemicals", "aliases": ["organic chemicals", "HS29"]},
    {"code": "30", "name": "Pharmaceutical products", "aliases": ["drugs", "medicine", "pharmaceuticals", "HS30"]},
    {"code": "39", "name": "Plastics and articles thereof", "aliases": ["plastics", "HS39"]},
    {"code": "40", "name": "Rubber and articles thereof", "aliases": ["rubber", "tyres", "HS40"]},
    {"code": "61", "name": "Articles of apparel, knitted or crocheted", "aliases": ["knitted apparel", "clothing", "HS61"]},
    {"code": "62", "name": "Articles of apparel, not knitted or crocheted", "aliases": ["woven apparel", "HS62"]},
    {"code": "71", "name": "Natural or cultured pearls, precious stones and metals", "aliases": ["jewellery", "gold", "diamond", "HS71"]},
    {"code": "72", "name": "Iron and steel", "aliases": ["steel", "iron", "HS72"]},
    {"code": "73", "name": "Articles of iron or steel", "aliases": ["steel products", "HS73"]},
    {"code": "74", "name": "Copper and articles thereof", "aliases": ["copper", "HS74"]},
    {"code": "84", "name": "Machinery, mechanical appliances, nuclear reactors, boilers", "aliases": ["machinery", "HS84"]},
    {"code": "85", "name": "Electrical machinery and equipment and parts thereof", "aliases": ["electronics", "electrical", "semiconductors", "HS85"]},
    {"code": "87", "name": "Vehicles other than railway or tramway rolling-stock", "aliases": ["cars", "automobiles", "vehicles", "HS87"]},
    {"code": "88", "name": "Aircraft, spacecraft, and parts thereof", "aliases": ["aircraft", "aerospace", "HS88"]},
    {"code": "89", "name": "Ships, boats, and floating structures", "aliases": ["ships", "maritime", "HS89"]},
    {"code": "90", "name": "Optical, photographic, medical or surgical instruments", "aliases": ["optical", "medical devices", "HS90"]},
    {"code": "94", "name": "Furniture; bedding; lamps and lighting fittings", "aliases": ["furniture", "HS94"]},
    {"code": "99", "name": "Special classification provisions", "aliases": ["special provisions", "HS99"]},
]

# ── SIC ────────────────────────────────────────────────────────────
SIC_ADD = [
    {"code": "3674", "name": "Semiconductors and Related Devices", "aliases": ["semiconductors", "chipmakers", "chips"]},
    {"code": "3711", "name": "Motor Vehicles and Passenger Car Bodies", "aliases": ["automakers", "cars"]},
    {"code": "3714", "name": "Motor Vehicle Parts and Accessories", "aliases": ["auto parts"]},
    {"code": "3812", "name": "Search, Detection, Navigation, Guidance, Aeronautical Systems", "aliases": ["defense electronics"]},
    {"code": "4512", "name": "Air Transportation, Scheduled", "aliases": ["airlines"]},
    {"code": "4813", "name": "Telephone Communications (No Radiotelephone)", "aliases": ["telecom", "telephone"]},
    {"code": "4899", "name": "Communications Services, NEC", "aliases": ["communications services"]},
    {"code": "5411", "name": "Grocery Stores", "aliases": ["supermarkets", "grocery"]},
    {"code": "5812", "name": "Eating Places", "aliases": ["restaurants"]},
    {"code": "6020", "name": "State Commercial Banks", "aliases": ["commercial banks"]},
    {"code": "6021", "name": "National Commercial Banks", "aliases": ["national banks"]},
    {"code": "6199", "name": "Finance Services", "aliases": ["finance services"]},
    {"code": "6311", "name": "Life Insurance", "aliases": ["life insurance"]},
    {"code": "6321", "name": "Accident and Health Insurance", "aliases": ["health insurance"]},
    {"code": "6798", "name": "Real Estate Investment Trusts", "aliases": ["REITs", "reit"]},
    {"code": "7372", "name": "Prepackaged Software", "aliases": ["software", "software companies"]},
    {"code": "7370", "name": "Services-Computer Services", "aliases": ["computer services"]},
    {"code": "7389", "name": "Services-Business Services, NEC", "aliases": ["business services"]},
    {"code": "8000", "name": "Health Services", "aliases": ["healthcare services"]},
    {"code": "8731", "name": "Commercial Physical & Biological Research", "aliases": ["biotech research", "pharma R&D"]},
]

# ── CPC ────────────────────────────────────────────────────────────
CPC_ADD = [
    {"code": "G", "name": "Physics", "aliases": ["section G"]},
    {"code": "G01", "name": "Measuring; Testing", "aliases": ["measurement"]},
    {"code": "G02", "name": "Optics", "aliases": ["optics"]},
    {"code": "G06", "name": "Computing; Calculating; Counting", "aliases": ["computing"]},
    {"code": "G06F", "name": "Electric Digital Data Processing", "aliases": ["digital computing", "data processing"]},
    {"code": "G06N", "name": "Computing Arrangements Based on Specific Computational Models", "aliases": ["AI", "machine learning", "neural networks"]},
    {"code": "G06Q", "name": "Data Processing Systems or Methods Specially Adapted for Administrative, Commercial, Financial, Managerial", "aliases": ["fintech", "business methods"]},
    {"code": "G06T", "name": "Image Data Processing or Generation", "aliases": ["image processing", "computer vision"]},
    {"code": "G10L", "name": "Speech Analysis or Synthesis; Speech Recognition", "aliases": ["speech recognition", "NLP audio"]},
    {"code": "G11", "name": "Information Storage", "aliases": ["storage"]},
    {"code": "G11C", "name": "Static Stores", "aliases": ["memory", "RAM"]},
    {"code": "H", "name": "Electricity", "aliases": ["section H"]},
    {"code": "H01", "name": "Basic Electric Elements", "aliases": ["electric elements"]},
    {"code": "H01L", "name": "Semiconductor Devices; Electric Solid-State Devices", "aliases": ["semiconductor devices", "transistors", "ICs"]},
    {"code": "H01M", "name": "Processes or Means for the Direct Conversion of Chemical into Electrical Energy", "aliases": ["batteries", "fuel cells", "Li-ion"]},
    {"code": "H02", "name": "Generation, Conversion, or Distribution of Electric Power", "aliases": ["power grid"]},
    {"code": "H02J", "name": "Circuit Arrangements for Power Distribution", "aliases": ["grid"]},
    {"code": "H02S", "name": "Generation of Electric Power by Conversion of Infrared Radiation, Visible Light", "aliases": ["solar panels", "photovoltaic"]},
    {"code": "H04", "name": "Electric Communication Technique", "aliases": ["telecom patents"]},
    {"code": "H04L", "name": "Transmission of Digital Information", "aliases": ["networking", "TCP/IP"]},
    {"code": "H04W", "name": "Wireless Communication Networks", "aliases": ["wireless", "5G", "cellular"]},
    {"code": "A61B", "name": "Diagnosis; Surgery; Identification", "aliases": ["diagnostic devices", "surgery"]},
    {"code": "A61M", "name": "Devices for Introducing Media into, or onto, the Body", "aliases": ["drug delivery", "medical devices"]},
    {"code": "A61N", "name": "Electrotherapy; Magnetotherapy; Radiotherapy; Ultrasound Therapy", "aliases": ["radiotherapy"]},
    {"code": "C12M", "name": "Apparatus for Enzymology or Microbiology", "aliases": ["bioreactors"]},
    {"code": "C12P", "name": "Fermentation or Enzyme-Using Processes", "aliases": ["fermentation"]},
]


def merge(existing: list[dict], additions: list[dict]) -> list[dict]:
    """Append entries from additions whose code isn't already present."""
    have = {str(e.get("code", "")).lower() for e in existing}
    added = []
    for a in additions:
        code = str(a.get("code", "")).lower()
        if not code or code in have:
            continue
        added.append(a)
        have.add(code)
    return existing + added


def write_pair(filename: str, rows: list[dict]) -> None:
    data = json.dumps(rows, indent=2, ensure_ascii=False)
    (PY_DIR / filename).write_text(data + "\n", encoding="utf-8")
    if TS_DIR.exists():
        (TS_DIR / filename).write_text(data + "\n", encoding="utf-8")


def expand(filename: str, additions: list[dict]) -> tuple[int, int, int]:
    path = PY_DIR / filename
    existing = json.loads(path.read_text(encoding="utf-8"))
    before = len(existing)
    merged = merge(existing, additions)
    after = len(merged)
    write_pair(filename, merged)
    return before, after, after - before


def main() -> int:
    plan = [
        ("country_iso.json", COUNTRIES_ADD),
        ("mesh_top.json", MESH_ADD),
        ("hs_codes.json", HS_ADD),
        ("sic_codes.json", SIC_ADD),
        ("cpc_classes.json", CPC_ADD),
    ]
    total_before = 0
    total_after = 0
    print(f"{'file':<22} {'before':>8} {'after':>8} {'added':>8}")
    print("-" * 50)
    for fname, adds in plan:
        before, after, added = expand(fname, adds)
        total_before += before
        total_after += after
        print(f"{fname:<22} {before:>8} {after:>8} {added:>8}")
    print("-" * 50)
    print(f"{'TOTAL':<22} {total_before:>8} {total_after:>8} {total_after - total_before:>8}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
