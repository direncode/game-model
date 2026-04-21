"""Second-wave ontology expansion.

Adds ~170 more entries across countries, MeSH, HS 4-digit subcodes,
SIC, and CPC. Idempotent — re-running only adds entries whose codes
aren't already present. Writes both lo_nlp/data/ and
frontend/data/ontology/ copies.

Run: python scripts/expand_ontologies_v2.py
"""
from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PY_DIR = REPO / "lo_nlp" / "data"
TS_DIR = REPO / "frontend" / "data" / "ontology"

# ── COUNTRIES: remaining ISO-3166 gaps (~60) ───────────────────────
COUNTRIES_V2 = [
    {"code": "AFG", "name": "Afghanistan", "aliases": ["AF"]},
    {"code": "ALB", "name": "Albania", "aliases": ["AL"]},
    {"code": "AND", "name": "Andorra", "aliases": ["AD"]},
    {"code": "ATG", "name": "Antigua and Barbuda", "aliases": ["AG"]},
    {"code": "BHS", "name": "Bahamas", "aliases": ["BS"]},
    {"code": "BRB", "name": "Barbados", "aliases": ["BB"]},
    {"code": "BLZ", "name": "Belize", "aliases": ["BZ"]},
    {"code": "BEN", "name": "Benin", "aliases": ["BJ"]},
    {"code": "BTN", "name": "Bhutan", "aliases": ["BT"]},
    {"code": "BIH", "name": "Bosnia and Herzegovina", "aliases": ["BA"]},
    {"code": "BWA", "name": "Botswana", "aliases": ["BW"]},
    {"code": "BRN", "name": "Brunei", "aliases": ["BN"]},
    {"code": "BFA", "name": "Burkina Faso", "aliases": ["BF"]},
    {"code": "BDI", "name": "Burundi", "aliases": ["BI"]},
    {"code": "CMR", "name": "Cameroon", "aliases": ["CM"]},
    {"code": "CPV", "name": "Cape Verde", "aliases": ["CV", "Cabo Verde"]},
    {"code": "CAF", "name": "Central African Republic", "aliases": ["CF", "CAR"]},
    {"code": "TCD", "name": "Chad", "aliases": ["TD"]},
    {"code": "COM", "name": "Comoros", "aliases": ["KM"]},
    {"code": "COG", "name": "Republic of the Congo", "aliases": ["CG"]},
    {"code": "CIV", "name": "C\u00f4te d'Ivoire", "aliases": ["CI", "Ivory Coast"]},
    {"code": "DJI", "name": "Djibouti", "aliases": ["DJ"]},
    {"code": "DMA", "name": "Dominica", "aliases": ["DM"]},
    {"code": "SLV", "name": "El Salvador", "aliases": ["SV"]},
    {"code": "GNQ", "name": "Equatorial Guinea", "aliases": ["GQ"]},
    {"code": "ERI", "name": "Eritrea", "aliases": ["ER"]},
    {"code": "SWZ", "name": "Eswatini", "aliases": ["SZ", "Swaziland"]},
    {"code": "FJI", "name": "Fiji", "aliases": ["FJ"]},
    {"code": "GAB", "name": "Gabon", "aliases": ["GA"]},
    {"code": "GMB", "name": "Gambia", "aliases": ["GM"]},
    {"code": "GRD", "name": "Grenada", "aliases": ["GD"]},
    {"code": "GTM", "name": "Guatemala", "aliases": ["GT"]},
    {"code": "GIN", "name": "Guinea", "aliases": ["GN"]},
    {"code": "GNB", "name": "Guinea-Bissau", "aliases": ["GW"]},
    {"code": "GUY", "name": "Guyana", "aliases": ["GY"]},
    {"code": "HTI", "name": "Haiti", "aliases": ["HT"]},
    {"code": "HND", "name": "Honduras", "aliases": ["HN"]},
    {"code": "JAM", "name": "Jamaica", "aliases": ["JM"]},
    {"code": "KGZ", "name": "Kyrgyzstan", "aliases": ["KG"]},
    {"code": "LSO", "name": "Lesotho", "aliases": ["LS"]},
    {"code": "LBR", "name": "Liberia", "aliases": ["LR"]},
    {"code": "LIE", "name": "Liechtenstein", "aliases": ["LI"]},
    {"code": "MDG", "name": "Madagascar", "aliases": ["MG"]},
    {"code": "MWI", "name": "Malawi", "aliases": ["MW"]},
    {"code": "MDV", "name": "Maldives", "aliases": ["MV"]},
    {"code": "MLI", "name": "Mali", "aliases": ["ML"]},
    {"code": "MHL", "name": "Marshall Islands", "aliases": ["MH"]},
    {"code": "MRT", "name": "Mauritania", "aliases": ["MR"]},
    {"code": "MUS", "name": "Mauritius", "aliases": ["MU"]},
    {"code": "FSM", "name": "Micronesia", "aliases": ["FM"]},
    {"code": "MCO", "name": "Monaco", "aliases": ["MC"]},
    {"code": "MNG", "name": "Mongolia", "aliases": ["MN"]},
    {"code": "MNE", "name": "Montenegro", "aliases": ["ME"]},
    {"code": "NAM", "name": "Namibia", "aliases": ["NA"]},
    {"code": "NRU", "name": "Nauru", "aliases": ["NR"]},
    {"code": "NIC", "name": "Nicaragua", "aliases": ["NI"]},
    {"code": "NER", "name": "Niger", "aliases": ["NE"]},
    {"code": "MKD", "name": "North Macedonia", "aliases": ["MK", "Macedonia"]},
    {"code": "PRK", "name": "North Korea", "aliases": ["KP", "DPRK"]},
    {"code": "PLW", "name": "Palau", "aliases": ["PW"]},
    {"code": "PSE", "name": "Palestine", "aliases": ["PS"]},
    {"code": "PNG", "name": "Papua New Guinea", "aliases": ["PG"]},
    {"code": "PRY", "name": "Paraguay", "aliases": ["PY"]},
    {"code": "RWA", "name": "Rwanda", "aliases": ["RW"]},
    {"code": "SMR", "name": "San Marino", "aliases": ["SM"]},
    {"code": "SEN", "name": "Senegal", "aliases": ["SN"]},
    {"code": "SYC", "name": "Seychelles", "aliases": ["SC"]},
    {"code": "SLE", "name": "Sierra Leone", "aliases": ["SL"]},
    {"code": "SLB", "name": "Solomon Islands", "aliases": ["SB"]},
    {"code": "SOM", "name": "Somalia", "aliases": ["SO"]},
    {"code": "SSD", "name": "South Sudan", "aliases": ["SS"]},
    {"code": "SUR", "name": "Suriname", "aliases": ["SR"]},
    {"code": "SYR", "name": "Syria", "aliases": ["SY"]},
    {"code": "TJK", "name": "Tajikistan", "aliases": ["TJ"]},
    {"code": "TLS", "name": "Timor-Leste", "aliases": ["TL", "East Timor"]},
    {"code": "TGO", "name": "Togo", "aliases": ["TG"]},
    {"code": "TON", "name": "Tonga", "aliases": ["TO"]},
    {"code": "TTO", "name": "Trinidad and Tobago", "aliases": ["TT"]},
    {"code": "TKM", "name": "Turkmenistan", "aliases": ["TM"]},
    {"code": "TUV", "name": "Tuvalu", "aliases": ["TV"]},
    {"code": "VUT", "name": "Vanuatu", "aliases": ["VU"]},
    {"code": "VAT", "name": "Vatican City", "aliases": ["VA", "Holy See"]},
    {"code": "YEM", "name": "Yemen", "aliases": ["YE"]},
]

# ── MESH: ~60 high-value missing descriptors ──────────────────────
MESH_V2 = [
    {"code": "D008661", "name": "Metabolic Diseases", "aliases": ["metabolic disease"]},
    {"code": "D001249", "name": "Asthma", "aliases": ["asthma"]},
    {"code": "D011565", "name": "Psoriasis", "aliases": ["psoriasis"]},
    {"code": "D003866", "name": "Depressive Disorder", "aliases": ["depression", "major depression"]},
    {"code": "D003967", "name": "Diarrhea", "aliases": ["diarrhea"]},
    {"code": "D012008", "name": "Recurrence", "aliases": ["recurrence", "relapse"]},
    {"code": "D016638", "name": "Critical Illness", "aliases": ["critical illness", "ICU patient"]},
    {"code": "D007938", "name": "Leukemia", "aliases": ["leukemia"]},
    {"code": "D008297", "name": "Male", "aliases": ["male"]},
    {"code": "D020969", "name": "Disease Progression", "aliases": ["disease progression"]},
    {"code": "D009103", "name": "Multiple Sclerosis", "aliases": ["MS", "multiple sclerosis"]},
    {"code": "D056486", "name": "Chemical and Drug Induced Liver Injury", "aliases": ["drug-induced liver injury", "DILI"]},
    {"code": "D005483", "name": "Follow-Up Studies", "aliases": ["follow-up study"]},
    {"code": "D001172", "name": "Arthritis, Rheumatoid", "aliases": ["rheumatoid arthritis", "RA"]},
    {"code": "D015535", "name": "Arthritis, Psoriatic", "aliases": ["psoriatic arthritis", "PsA"]},
    {"code": "D010146", "name": "Pain", "aliases": ["pain"]},
    {"code": "D001847", "name": "Bone Diseases", "aliases": ["bone disease"]},
    {"code": "D020022", "name": "Genetic Predisposition to Disease", "aliases": ["genetic predisposition"]},
    {"code": "D018449", "name": "Patient Selection", "aliases": ["patient selection"]},
    {"code": "D053208", "name": "Kidney Failure, Acute", "aliases": ["AKI", "acute kidney injury"]},
    {"code": "D065102", "name": "Diabetes, Type 2", "aliases": ["T2DM", "type 2 diabetes"]},
    {"code": "D003920", "name": "Diabetes Mellitus, Type 1", "aliases": ["T1DM", "type 1 diabetes"]},
    {"code": "D002318", "name": "Cardiovascular Diseases", "aliases": ["CVD", "cardiovascular disease"]},
    {"code": "D013577", "name": "Syndrome", "aliases": ["syndrome"]},
    {"code": "D003430", "name": "Cross-Over Studies", "aliases": ["cross-over trial"]},
    {"code": "D016014", "name": "Linear Models", "aliases": ["linear regression", "linear model"]},
    {"code": "D016022", "name": "Case-Control Studies", "aliases": ["case-control", "case control study"]},
    {"code": "D003141", "name": "Communicable Diseases", "aliases": ["infectious disease"]},
    {"code": "D016696", "name": "Quality-Adjusted Life Years", "aliases": ["QALY"]},
    {"code": "D018507", "name": "Practice Guidelines as Topic", "aliases": ["practice guideline"]},
    {"code": "D002170", "name": "Canada", "aliases": ["canadian population"]},
    {"code": "D065906", "name": "Non-alcoholic Fatty Liver Disease", "aliases": ["NAFLD", "NASH"]},
    {"code": "D017116", "name": "Low Back Pain", "aliases": ["low back pain", "LBP"]},
    {"code": "D006261", "name": "Headache", "aliases": ["headache"]},
    {"code": "D056128", "name": "Pandemics", "aliases": ["pandemic"]},
    {"code": "D019055", "name": "Biosensing Techniques", "aliases": ["biosensor"]},
    {"code": "D002319", "name": "Cerebrovascular Disorders", "aliases": ["cerebrovascular"]},
    {"code": "D015398", "name": "Signal Transduction", "aliases": ["signal transduction", "signaling"]},
    {"code": "D009272", "name": "Natriuresis", "aliases": ["natriuresis"]},
    {"code": "D008244", "name": "Macrophages", "aliases": ["macrophage"]},
    {"code": "D053402", "name": "T-Lymphocytes, Regulatory", "aliases": ["Treg", "regulatory T cell"]},
    {"code": "D000073887", "name": "Checkpoint Kinase 2", "aliases": ["CHK2"]},
    {"code": "D050918", "name": "Induced Pluripotent Stem Cells", "aliases": ["iPSC", "induced pluripotent stem cell"]},
    {"code": "D055088", "name": "Mesenchymal Stem Cells", "aliases": ["MSC", "mesenchymal stem cell"]},
    {"code": "D053563", "name": "Embryonic Stem Cells", "aliases": ["ESC", "embryonic stem cell"]},
    {"code": "D000086928", "name": "Machine Learning", "aliases": ["machine learning", "ML"]},
    {"code": "D000085350", "name": "Deep Learning", "aliases": ["deep learning", "DL"]},
    {"code": "D000074145", "name": "CRISPR-Cas Systems", "aliases": ["CRISPR", "Cas9"]},
    {"code": "D057138", "name": "Gene Editing", "aliases": ["gene editing"]},
    {"code": "D040582", "name": "Drug Discovery", "aliases": ["drug discovery"]},
    {"code": "D058489", "name": "Microbiota", "aliases": ["microbiome", "microbiota"]},
    {"code": "D054307", "name": "Gastrointestinal Microbiome", "aliases": ["gut microbiome"]},
    {"code": "D018581", "name": "Homocysteine", "aliases": ["homocysteine"]},
    {"code": "D055370", "name": "Lung Injury", "aliases": ["lung injury"]},
    {"code": "D016888", "name": "Pulmonary Embolism", "aliases": ["PE", "pulmonary embolism"]},
    {"code": "D018455", "name": "Venous Thrombosis", "aliases": ["DVT", "deep vein thrombosis"]},
    {"code": "D017115", "name": "Chronic Pain", "aliases": ["chronic pain"]},
    {"code": "D019337", "name": "Hematologic Neoplasms", "aliases": ["blood cancer", "hematologic malignancy"]},
    {"code": "D014009", "name": "Tissue Donors", "aliases": ["organ donor", "tissue donor"]},
    {"code": "D018741", "name": "Transplantation, Homologous", "aliases": ["allograft"]},
    {"code": "D015996", "name": "Survival Rate", "aliases": ["survival rate"]},
]

# ── HS 4-DIGIT SUBCODES: ~35 key commodities ─────────────────────
HS_V2 = [
    {"code": "1001", "name": "Wheat and meslin", "family": "hs", "aliases": ["wheat", "grain wheat"]},
    {"code": "1006", "name": "Rice", "family": "hs", "aliases": ["rice"]},
    {"code": "1701", "name": "Cane or beet sugar", "family": "hs", "aliases": ["sugar", "cane sugar", "beet sugar"]},
    {"code": "2709", "name": "Petroleum oils, crude", "family": "hs", "aliases": ["crude oil", "crude petroleum"]},
    {"code": "2710", "name": "Petroleum oils, refined", "family": "hs", "aliases": ["refined petroleum", "gasoline", "diesel"]},
    {"code": "2711", "name": "Petroleum gases, natural gas", "family": "hs", "aliases": ["natural gas", "LNG"]},
    {"code": "2716", "name": "Electrical energy", "family": "hs", "aliases": ["electricity export"]},
    {"code": "3004", "name": "Medicaments in dosage form", "family": "hs", "aliases": ["packaged drugs", "medications"]},
    {"code": "3102", "name": "Mineral or chemical fertilizers, nitrogenous", "family": "hs", "aliases": ["nitrogen fertilizer"]},
    {"code": "4011", "name": "New pneumatic tires", "family": "hs", "aliases": ["tires", "tyres"]},
    {"code": "4401", "name": "Fuel wood; wood in chips", "family": "hs", "aliases": ["fuel wood", "wood chips"]},
    {"code": "5201", "name": "Cotton, not carded", "family": "hs", "aliases": ["raw cotton"]},
    {"code": "7108", "name": "Gold, unwrought or semi-manufactured", "family": "hs", "aliases": ["gold bullion"]},
    {"code": "7207", "name": "Semi-finished products of iron or non-alloy steel", "family": "hs", "aliases": ["semi-finished steel"]},
    {"code": "7606", "name": "Aluminium plates, sheets and strip", "family": "hs", "aliases": ["aluminium sheet"]},
    {"code": "8471", "name": "Automatic data processing machines", "family": "hs", "aliases": ["computers", "laptops", "PCs"]},
    {"code": "8473", "name": "Parts and accessories for data-processing machines", "family": "hs", "aliases": ["computer parts"]},
    {"code": "8517", "name": "Telephone sets, smartphones, routers", "family": "hs", "aliases": ["smartphones", "phones", "routers"]},
    {"code": "8528", "name": "Monitors, projectors, TV reception apparatus", "family": "hs", "aliases": ["TVs", "monitors", "displays"]},
    {"code": "8541", "name": "Semiconductor devices", "family": "hs", "aliases": ["semiconductor devices", "diodes", "transistors"]},
    {"code": "8542", "name": "Electronic integrated circuits", "family": "hs", "aliases": ["integrated circuits", "ICs", "chips"]},
    {"code": "8703", "name": "Motor cars and passenger vehicles", "family": "hs", "aliases": ["cars", "passenger vehicles", "automobiles"]},
    {"code": "8704", "name": "Motor vehicles for transport of goods", "family": "hs", "aliases": ["trucks", "freight vehicles"]},
    {"code": "8708", "name": "Parts and accessories of motor vehicles", "family": "hs", "aliases": ["auto parts"]},
    {"code": "8802", "name": "Aircraft and spacecraft", "family": "hs", "aliases": ["aircraft", "airplanes", "spacecraft"]},
    {"code": "8806", "name": "Unmanned aircraft (drones)", "family": "hs", "aliases": ["drones", "UAVs"]},
    {"code": "8901", "name": "Cruise ships, cargo ships", "family": "hs", "aliases": ["cargo ships", "cruise ships"]},
    {"code": "9001", "name": "Optical fibres, lenses, prisms", "family": "hs", "aliases": ["optical fibres", "lenses"]},
    {"code": "9018", "name": "Medical instruments and appliances", "family": "hs", "aliases": ["medical devices", "medical instruments"]},
    {"code": "9021", "name": "Orthopaedic appliances", "family": "hs", "aliases": ["orthopaedic", "prosthetics"]},
    {"code": "9504", "name": "Video game consoles", "family": "hs", "aliases": ["game consoles", "video games"]},
    {"code": "3303", "name": "Perfumes and toilet waters", "family": "hs", "aliases": ["perfume", "fragrance"]},
    {"code": "0901", "name": "Coffee", "family": "hs", "aliases": ["coffee"]},
    {"code": "1801", "name": "Cocoa beans", "family": "hs", "aliases": ["cocoa beans"]},
    {"code": "1806", "name": "Chocolate", "family": "hs", "aliases": ["chocolate"]},
]

# ── SIC: ~20 more 4-digit codes ────────────────────────────────────
SIC_V2 = [
    {"code": "3571", "name": "Electronic Computers", "aliases": ["computer makers"]},
    {"code": "3572", "name": "Computer Storage Devices", "aliases": ["storage devices"]},
    {"code": "3576", "name": "Computer Communications Equipment", "aliases": ["networking equipment"]},
    {"code": "3669", "name": "Communications Equipment NEC", "aliases": ["comms equipment"]},
    {"code": "3663", "name": "Radio & TV Broadcasting & Communications Equipment", "aliases": ["broadcast equipment"]},
    {"code": "3827", "name": "Laboratory Analytical Instruments", "aliases": ["analytical instruments"]},
    {"code": "4833", "name": "Television Broadcasting Stations", "aliases": ["TV stations"]},
    {"code": "4931", "name": "Electric and Other Services Combined", "aliases": ["combined utilities"]},
    {"code": "4932", "name": "Gas and Other Services Combined", "aliases": ["combined gas utilities"]},
    {"code": "4911", "name": "Electric Services", "aliases": ["electric utilities"]},
    {"code": "4924", "name": "Natural Gas Distribution", "aliases": ["natural gas distribution"]},
    {"code": "5200", "name": "Retail-Building Materials, Hardware", "aliases": ["home improvement retail"]},
    {"code": "5311", "name": "Retail-Department Stores", "aliases": ["department stores"]},
    {"code": "5331", "name": "Retail-Variety Stores", "aliases": ["variety stores"]},
    {"code": "5961", "name": "Retail-Catalog, Mail-Order Houses", "aliases": ["online retail", "ecommerce"]},
    {"code": "6770", "name": "Blank Checks", "aliases": ["SPAC", "blank check company"]},
    {"code": "7311", "name": "Services-Advertising Agencies", "aliases": ["advertising agencies"]},
    {"code": "7990", "name": "Services-Amusement and Recreation", "aliases": ["amusement services"]},
    {"code": "8060", "name": "Services-Hospitals", "aliases": ["hospitals"]},
    {"code": "8711", "name": "Services-Engineering Services", "aliases": ["engineering services"]},
]

# ── CPC: ~15 more subclasses ──────────────────────────────────────
CPC_V2 = [
    {"code": "F21", "name": "Lighting", "aliases": ["lighting"]},
    {"code": "F24", "name": "Heating, Ranges, Ventilating", "aliases": ["HVAC"]},
    {"code": "G03", "name": "Photography; Cinematography", "aliases": ["photography"]},
    {"code": "G05", "name": "Controlling; Regulating", "aliases": ["control systems"]},
    {"code": "G08", "name": "Signalling", "aliases": ["signalling systems"]},
    {"code": "G09", "name": "Educating; Cryptography; Display; Advertising; Seals", "aliases": ["educational", "cryptography"]},
    {"code": "G16", "name": "Information & Communication Tech for Specific Applications", "aliases": ["bioinformatics", "health informatics"]},
    {"code": "H03", "name": "Basic Electronic Circuitry", "aliases": ["analog circuits"]},
    {"code": "H05", "name": "Electric Techniques Not Otherwise Provided For", "aliases": ["misc electric"]},
    {"code": "C07D", "name": "Heterocyclic Compounds", "aliases": ["heterocyclics", "drug scaffolds"]},
    {"code": "C07K", "name": "Peptides", "aliases": ["peptides", "proteins"]},
    {"code": "A01", "name": "Agriculture; Forestry; Animal Husbandry", "aliases": ["agriculture patents"]},
    {"code": "A23", "name": "Foods; Foodstuffs; Treatment Thereof", "aliases": ["food technology"]},
    {"code": "B22", "name": "Casting; Powder Metallurgy", "aliases": ["metal casting"]},
    {"code": "Y02", "name": "Climate Change Mitigation Technologies", "aliases": ["climate tech", "decarbonization"]},
]


def merge(existing: list[dict], additions: list[dict]) -> tuple[list[dict], int]:
    have = {str(e.get("code", "")).lower() for e in existing}
    added = []
    for a in additions:
        code = str(a.get("code", "")).lower()
        if not code or code in have:
            continue
        added.append(a)
        have.add(code)
    return existing + added, len(added)


def write_pair(filename: str, rows: list[dict]) -> None:
    data = json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
    (PY_DIR / filename).write_text(data, encoding="utf-8")
    if TS_DIR.exists():
        (TS_DIR / filename).write_text(data, encoding="utf-8")


def expand(filename: str, additions: list[dict]) -> tuple[int, int, int]:
    path = PY_DIR / filename
    existing = json.loads(path.read_text(encoding="utf-8"))
    before = len(existing)
    merged, added = merge(existing, additions)
    write_pair(filename, merged)
    return before, len(merged), added


def main() -> int:
    plan = [
        ("country_iso.json", COUNTRIES_V2),
        ("mesh_top.json", MESH_V2),
        ("hs_codes.json", HS_V2),
        ("sic_codes.json", SIC_V2),
        ("cpc_classes.json", CPC_V2),
    ]
    print(f"{'file':<22} {'before':>8} {'after':>8} {'added':>8}")
    print("-" * 50)
    total_before = total_after = 0
    for fname, adds in plan:
        b, a, n = expand(fname, adds)
        total_before += b
        total_after += a
        print(f"{fname:<22} {b:>8} {a:>8} {n:>8}")
    print("-" * 50)
    print(f"{'TOTAL':<22} {total_before:>8} {total_after:>8} {total_after-total_before:>8}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
