/**
 * Product catalog. Single source of truth for the 5 Latent Ocean products
 * across Consumer / Pro / Enterprise tiers, plus the Vault Private Banking
 * tier which sits on its own floor.
 *
 * Every product page, the /pricing table, the home page lineup, and the
 * /products overview all read from here.
 */

export type Tier = "consumer" | "pro" | "enterprise" | "private_banking";

export const TIER_LABELS: Record<Tier, string> = {
  consumer:        "Consumer",
  pro:             "Pro",
  enterprise:      "Enterprise",
  private_banking: "Private Banking",
};

export const TIER_COLORS: Record<Tier, string> = {
  consumer:        "#7DD3FC",  // sky-300 — accessible, broad
  pro:             "#A78BFA",  // violet-300 — premium, team
  enterprise:      "#FCD34D",  // amber-300 — institutional, established
  private_banking: "#FFFFFF",  // white — distinct, exclusive
};

export type PricingPlan = {
  tier:        Tier;
  price:       string;        // e.g. "Free", "$99/mo", "$5K-$50K/mo", "By invitation"
  cadence?:    string;        // e.g. "per month", "per analysis", "per receipt"
  bullets:     string[];      // 3-5 short feature lines
  cta:         { label: string; href: string };
  best_for?:   string;        // one-line buyer persona
};

export type Product = {
  slug:        string;        // url path
  name:        string;        // "Pulse"
  tagline:     string;        // headline phrase
  what_it_does: string;       // 2-3 sentences plain English
  who_for:     string;        // 1-2 sentence persona
  why_matters: string;        // 1-2 sentence differentiator
  tiers:       Tier[];        // tiers this product is offered in (subset)
  plans:       PricingPlan[]; // one entry per tier
  proof_link?: { label: string; href: string };  // "See it in production"
  highlights:  { label: string; value: string; hint: string }[];  // 4 stats
};

export const PRODUCTS: Product[] = [
  // -----------------------------------------------------------------
  // 1. PULSE — data dedup / cohort detection
  // -----------------------------------------------------------------
  {
    slug:        "pulse",
    name:        "Pulse",
    tagline:     "Find the duplicates and look-alikes hiding in your data.",
    what_it_does:
      "Pulse scans any database, spreadsheet, or document collection and surfaces records that are structurally similar — even when their fields don't match exactly. No schema setup, no tagging — plug it in and get answers in seconds.",
    who_for:
      "Data teams at companies with sprawling customer databases — retailers, banks, hospitals, marketing platforms — anywhere people enter data slightly differently every time.",
    why_matters:
      "Run it today, re-run it in six months — you get the same answers, byte-for-byte. No random retraining. No drift. Your duplicates list from January is still your duplicates list in December.",
    tiers:       ["consumer", "pro", "enterprise"],
    highlights: [
      { label: "deduplicates",    value: "any schema",        hint: "JSON · CSV · NDJSON · TSV · plaintext" },
      { label: "answer time",     value: "< 60 sec",          hint: "10k records on a workgroup tier" },
      { label: "drift",           value: "0",                 hint: "byte-identical re-runs" },
      { label: "onboarding",      value: "5 minutes",         hint: "credit card → API key → first call" },
    ],
    plans: [
      {
        tier:    "consumer",
        price:   "Free",
        cadence: "first 1,000 records / month",
        bullets: [
          "Single user, single project",
          "Up to 1,000 records per month",
          "Web playground + REST API",
          "Community support",
        ],
        cta:      { label: "Start free", href: "/signup?plan=pulse-consumer" },
        best_for: "Solo developers, prototypes, evaluation",
      },
      {
        tier:    "pro",
        price:   "$99/mo",
        cadence: "per team",
        bullets: [
          "Up to 100,000 records per month",
          "Multiple seats, shared API keys",
          "Webhook delivery for batch jobs",
          "Standard email support",
        ],
        cta:      { label: "Subscribe", href: "/signup?plan=pulse-pro" },
        best_for: "Data teams at small and mid-size companies",
      },
      {
        tier:    "enterprise",
        price:   "From $2K/mo",
        cadence: "custom volumes",
        bullets: [
          "Unlimited records, dedicated tenant",
          "99.9% SLA, named support contact",
          "SSO, audit log export, encryption at rest",
          "On-premise deployment option",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=pulse" },
        best_for: "Banks, hospitals, retailers with tens of millions of records",
      },
    ],
    proof_link: { label: "Read the API", href: "/api-docs" },
  },

  // -----------------------------------------------------------------
  // 2. ATLAS — reproducible analytics
  // -----------------------------------------------------------------
  {
    slug:        "atlas",
    name:        "Atlas",
    tagline:     "Make your analysis reproducible. Forever.",
    what_it_does:
      "Atlas runs structural analyses on any dataset and gives you a permanent receipt for every result. Charts, clusters, drift over time, statistical significance — every output ships with a hash anyone can verify, decades from now, and re-derive themselves from the same data.",
    who_for:
      "Research teams, scientific publishers, healthcare analytics groups — anyone whose findings may be challenged, audited, peer-reviewed, or revisited years later.",
    why_matters:
      "Most analytics tools produce something that looks like an answer. Atlas produces something a journal editor, a regulator, or a future you can re-run and verify. The receipt is the deliverable.",
    tiers:       ["consumer", "pro", "enterprise"],
    highlights: [
      { label: "outputs",        value: "all citable",      hint: "every chart ships with a sha256 hash" },
      { label: "reproducibility", value: "byte-identical",   hint: "same data + same seed = same answer forever" },
      { label: "methods",        value: "8+ built-in",      hint: "topology, drift, clustering, null tests, baselines" },
      { label: "shareable",      value: "permanent links",  hint: "publish your analysis, anyone can verify" },
    ],
    plans: [
      {
        tier:    "consumer",
        price:   "Free",
        cadence: "first 100 analyses / month",
        bullets: [
          "Single user, single workspace",
          "Up to 100 analyses per month",
          "Public sharing of results (citable)",
          "Standard methods library",
        ],
        cta:      { label: "Start free", href: "/signup?plan=atlas-consumer" },
        best_for: "Independent researchers, students, evaluators",
      },
      {
        tier:    "pro",
        price:   "$499/mo",
        cadence: "per workspace",
        bullets: [
          "Unlimited analyses, multi-seat",
          "Private workspaces and embargoed results",
          "Custom method authoring",
          "Priority support, 2-business-day response",
        ],
        cta:      { label: "Subscribe", href: "/signup?plan=atlas-pro" },
        best_for: "University labs, R&D teams, healthcare analytics groups",
      },
      {
        tier:    "enterprise",
        price:   "From $3K/mo",
        cadence: "by data volume",
        bullets: [
          "Dedicated cluster, custom methods",
          "Integration with your data warehouse",
          "Compliance reporting, audit trails",
          "Co-development of in-house methods",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=atlas" },
        best_for: "Pharma, financial research, government R&D",
      },
    ],
    proof_link: { label: "See the DocSouth analysis", href: "/docsouth" },
  },

  // -----------------------------------------------------------------
  // 3. RECEIPT — AI attestation / audit
  // -----------------------------------------------------------------
  {
    slug:        "receipt",
    name:        "Receipt",
    tagline:     "Make every AI decision provable.",
    what_it_does:
      "Receipt sits in front of any AI model — yours, OpenAI's, Anthropic's, anyone's — and produces a tamper-proof log of every decision plus a permanent, citable hash that proves what the AI did on a specific date with specific inputs.",
    who_for:
      "General counsels, compliance officers, AI governance leads, CISOs at banks, hospitals, defense contractors, law firms — anywhere \"the AI made the decision\" needs to hold up in court or in a regulator's office.",
    why_matters:
      "Most AI vendors say \"you have to trust us.\" With Receipt, you don't. Every decision your AI makes has a permanent, externally-verifiable proof attached. Works with Splunk, Sentinel, ArcSight, Chronicle out of the box.",
    tiers:       ["pro", "enterprise"],
    highlights: [
      { label: "log format",      value: "CEF · OCSF",       hint: "ingest into any major SIEM" },
      { label: "receipt size",    value: "32 bytes",         hint: "sha256 — small enough to embed anywhere" },
      { label: "verification",    value: "third-party",      hint: "anyone can replay and check" },
      { label: "integrations",    value: "any LLM",          hint: "OpenAI, Anthropic, your own — all work" },
    ],
    plans: [
      {
        tier:    "pro",
        price:   "$1K/mo",
        cadence: "per compliance team",
        bullets: [
          "Up to 5M receipts per month",
          "SIEM-ready log export (CEF + OCSF)",
          "Web dashboard for audit reviews",
          "30-day retention, extendable",
        ],
        cta:      { label: "Subscribe", href: "/signup?plan=receipt-pro" },
        best_for: "Mid-market compliance teams, AI governance leads",
      },
      {
        tier:    "enterprise",
        price:   "From $10K/mo",
        cadence: "by AI call volume",
        bullets: [
          "Unlimited receipts, dedicated audit storage",
          "Custom retention windows (7+ years)",
          "On-premise or VPC-deployed audit ingest",
          "Regulator-direct read-only access",
          "Cryptographic chain attestation for entire log",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=receipt" },
        best_for: "Banks, hospitals, law firms, defense contractors, government",
      },
    ],
    proof_link: { label: "See the audit primitives", href: "/method#section-5" },
  },

  // -----------------------------------------------------------------
  // 4. STUDIO — archive concierge
  // -----------------------------------------------------------------
  {
    slug:        "studio",
    name:        "Studio",
    tagline:     "Your archive, mapped in a day.",
    what_it_does:
      "Studio is our concierge service for institutions with archives, libraries, or large document collections. We deliver a full structural map of your collection in 24 hours, then keep enriching it every month for as long as you want us around.",
    who_for:
      "Research libraries, foundations, museums, university special collections, family and corporate archives — anyone with a collection that's culturally or institutionally important and underused.",
    why_matters:
      "Your librarians and archivists do the impossible work of curating. We do the impossible work of telling the public what's in there. Concierge from day one — no engineering on your side, no IT lift, no platform to learn.",
    tiers:       ["enterprise"],
    highlights: [
      { label: "day-one delivery",   value: "< 24 hours",   hint: "from corpus handover to public showcase" },
      { label: "ongoing cadence",    value: "monthly",       hint: "weekly value-adds, monthly major releases" },
      { label: "your effort",        value: "zero",          hint: "no engineering, no IT lift, no learning curve" },
      { label: "public artifact",    value: "your branding", hint: "showcase ships under your domain or ours" },
    ],
    plans: [
      {
        tier:    "enterprise",
        price:   "$15K day-one + $5–15K/mo",
        cadence: "per archive",
        bullets: [
          "Full structural map of your collection in 24 hours",
          "Polished public-facing showcase (or kept private)",
          "Hand-curated catalog of rare records, hidden patterns, named singularities",
          "Cross-collection bleed analysis, time-axis trajectory, baseline comparisons",
          "Weekly value-add cadence: new findings, new visualizations, new threads traced",
          "Operator console for your team to query the formed model directly",
          "Permanent, citable response_digest on every analysis",
        ],
        cta:      { label: "Schedule a discovery call", href: "/contact?product=studio" },
        best_for: "Research libraries, foundations, museums, university archives",
      },
    ],
    proof_link: { label: "DocSouth × UNC Libraries — see the day-30 deliverable", href: "/docsouth" },
  },

  // -----------------------------------------------------------------
  // 5. VAULT — Private Banking tier
  // -----------------------------------------------------------------
  {
    slug:        "vault",
    name:        "Vault",
    tagline:     "Private Banking for AI on regulated data.",
    what_it_does:
      "Vault is the engine underneath your AI product when your customers are banks, hospitals, law firms, or governments. Each customer gets a fully isolated private AI model on their own data, with airtight separation, encryption at rest, and a citable receipt on every output. Single binary, deployable into your or your customer's infrastructure.",
    who_for:
      "Founders, CTOs, and AI product leads selling into regulated industries who need to ship a real product to a real customer — not pitch a roadmap. Selected by application; we work with a small number of partners at any time.",
    why_matters:
      "Eighteen months of compliance engineering, audit infrastructure, multi-tenant isolation, encryption-at-rest, key custody — done. A dedicated relationship manager. White-glove onboarding. The Private Banking tier of the platform: by invitation, fully bespoke, long-term partnership.",
    tiers:       ["private_banking"],
    highlights: [
      { label: "tenant isolation",   value: "hard 404",         hint: "cross-tenant access fails by construction, not policy" },
      { label: "deployment",         value: "single binary",     hint: "your VPC, your customer's, or air-gapped — your call" },
      { label: "compliance work",    value: "18 months saved",   hint: "audit, encryption, isolation, key custody all included" },
      { label: "selection",          value: "by application",    hint: "we work with a small number of partners at any time" },
    ],
    plans: [
      {
        tier:    "private_banking",
        price:   "By invitation",
        cadence: "bespoke engagement",
        bullets: [
          "Dedicated relationship manager throughout the engagement",
          "Hard multi-tenant isolation enforced at the storage layer (not application policy)",
          "Per-tenant encrypted artifacts at rest with AES-256-GCM and per-appliance key custody",
          "Append-only audit log in CEF + OCSF for direct SIEM ingest",
          "Single-binary deployment: your VPC, customer VPC, on-prem, or fully air-gapped",
          "White-glove onboarding for your engineering team",
          "Quarterly architectural reviews; substrate roadmap input",
          "Pricing structured around your business — platform fee plus per-tenant or per-call as appropriate",
        ],
        cta:      { label: "Apply for Vault", href: "/contact?product=vault&tier=private_banking" },
        best_for: "Founders selling AI into banks, hospitals, law firms, defense, intelligence",
      },
    ],
    proof_link: { label: "See the substrate", href: "/method" },
  },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
