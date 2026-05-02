/**
 * Product catalog. Single source of truth for the 5 Latent Ocean products
 * across Consumer / Pro / Enterprise tiers, plus the Vault Private Banking
 * tier which sits on its own floor.
 *
 * Pricing is intentionally not surfaced — the customer-facing site shows
 * comprehensive previews of what each tier includes, who it serves, and
 * what the relationship looks like. Pricing is discussed in the
 * conversation that follows the preview.
 *
 * Every product page, the /preview page, the home page lineup, and the
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
  tier:         Tier;
  headline:     string;        // "For solo evaluation", "For teams", "For institutions"
  shape:        string;        // 1-line description of the relationship: "Self-serve preview", "Team subscription", etc.
  bullets:      string[];      // 3-7 short feature lines, plain English
  cta:          { label: string; href: string };
  best_for:     string;        // one-line buyer persona
};

export type Product = {
  slug:         string;        // url path
  name:         string;        // "Pulse"
  tagline:      string;        // headline phrase
  what_it_does: string;        // 2-3 sentences plain English
  who_for:      string;        // 1-2 sentence persona
  why_matters:  string;        // 1-2 sentence differentiator
  tiers:        Tier[];        // tiers this product is offered in (subset)
  plans:        PricingPlan[]; // one entry per tier
  proof_link?:  { label: string; href: string };
  highlights:   { label: string; value: string; hint: string }[];  // 4 stats — kept plain
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
      "Pulse scans any database, spreadsheet, or document collection and surfaces records that are similar — even when their fields don't match exactly. No setup, no tagging — connect it and get answers in seconds.",
    who_for:
      "Data teams at companies with sprawling customer databases — retailers, banks, hospitals, marketing platforms — anywhere people enter data slightly differently every time.",
    why_matters:
      "Run it today, re-run it in six months — you get the same answers. No random retraining. No drift. Your duplicates list from January is still your duplicates list in December.",
    tiers:       ["consumer", "pro", "enterprise"],
    highlights: [
      { label: "works on",        value: "any format",         hint: "spreadsheets · databases · documents · plain text" },
      { label: "answer time",     value: "under a minute",     hint: "ten thousand records on the smallest tier" },
      { label: "results stable",  value: "year over year",     hint: "same input today and in 2030 → same answers" },
      { label: "onboarding",      value: "five minutes",       hint: "create an account → first answer" },
    ],
    plans: [
      {
        tier:    "consumer",
        headline: "Solo developers and side projects",
        shape:    "Self-serve preview",
        bullets: [
          "Single user, single workspace",
          "Up to a thousand records per month",
          "Web playground and a simple API",
          "Community support forum",
        ],
        cta:      { label: "Get the preview", href: "/contact?product=pulse&tier=consumer" },
        best_for: "Trying it out, prototyping, evaluating",
      },
      {
        tier:    "pro",
        headline: "Small and mid-size data teams",
        shape:    "Team subscription",
        bullets: [
          "Higher volumes — works for most production data flows",
          "Multiple seats, shared API keys",
          "Webhook delivery for batch jobs",
          "Standard email support",
          "Workspace history and saved runs",
        ],
        cta:      { label: "Talk to us", href: "/contact?product=pulse&tier=pro" },
        best_for: "Data teams cleaning warehouses, customer-data platforms, marketing list managers",
      },
      {
        tier:    "enterprise",
        headline: "Banks, hospitals, retailers, regulated firms",
        shape:    "Custom volumes, dedicated tenant",
        bullets: [
          "Unlimited records and dedicated infrastructure",
          "99.9% service-level agreement, named support contact",
          "Single sign-on, audit log export, encryption at rest",
          "Deploy into your cloud, your data center, or fully air-gapped",
          "Quarterly architectural review",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=pulse&tier=enterprise" },
        best_for: "Banks, hospitals, retailers with tens of millions of records",
      },
    ],
    proof_link: { label: "See how the engine works", href: "/method" },
  },

  // -----------------------------------------------------------------
  // 2. ATLAS — reproducible analytics
  // -----------------------------------------------------------------
  {
    slug:        "atlas",
    name:        "Atlas",
    tagline:     "Make your analysis reproducible. Forever.",
    what_it_does:
      "Atlas runs structural analyses on any dataset and gives you a permanent receipt for every result. Charts, clusters, drift over time, statistical significance — every output ships with a fingerprint anyone can verify, decades from now, by re-running the same data.",
    who_for:
      "Research teams, scientific publishers, healthcare analytics groups — anyone whose findings may be challenged, audited, peer-reviewed, or revisited years later.",
    why_matters:
      "Most analytics tools produce something that looks like an answer. Atlas produces something a journal editor, a regulator, or a future you can re-run and verify. The receipt is the deliverable.",
    tiers:       ["consumer", "pro", "enterprise"],
    highlights: [
      { label: "every output",    value: "citable",            hint: "every chart ships with a permanent fingerprint" },
      { label: "reproducibility", value: "exact",              hint: "same data → same answer, byte for byte, forever" },
      { label: "methods built-in", value: "eight and counting", hint: "topology, drift, clustering, baselines, null tests" },
      { label: "shareable",       value: "permanent links",    hint: "publish once, anyone can verify your finding" },
    ],
    plans: [
      {
        tier:    "consumer",
        headline: "Independent researchers and students",
        shape:    "Self-serve preview",
        bullets: [
          "Single user, single workspace",
          "Run a hundred analyses per month",
          "Public sharing of results, with permanent receipts",
          "Standard methods library",
        ],
        cta:      { label: "Get the preview", href: "/contact?product=atlas&tier=consumer" },
        best_for: "Independent researchers, students, evaluators",
      },
      {
        tier:    "pro",
        headline: "University labs and R&D teams",
        shape:    "Workspace subscription",
        bullets: [
          "Unlimited analyses, multi-seat workspace",
          "Private workspaces and embargoed results",
          "Author your own methods on top of the library",
          "Priority support",
          "Integrations with notebook environments",
        ],
        cta:      { label: "Talk to us", href: "/contact?product=atlas&tier=pro" },
        best_for: "University labs, R&D teams, healthcare analytics groups",
      },
      {
        tier:    "enterprise",
        headline: "Pharma, financial research, government R&D",
        shape:    "Dedicated cluster, custom integration",
        bullets: [
          "Dedicated cluster with custom methods",
          "Integration with your data warehouse and pipelines",
          "Compliance reporting and full audit trail",
          "Co-development of in-house methods with our team",
          "Quarterly architectural review",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=atlas&tier=enterprise" },
        best_for: "Pharma, financial research, government R&D",
      },
    ],
    proof_link: { label: "See it on a real archive · DocSouth", href: "/docsouth" },
  },

  // -----------------------------------------------------------------
  // 3. RECEIPT — AI attestation / audit
  // -----------------------------------------------------------------
  {
    slug:        "receipt",
    name:        "Receipt",
    tagline:     "Make every AI decision provable.",
    what_it_does:
      "Receipt sits in front of any AI model — yours, OpenAI's, anyone's — and produces a tamper-proof log of every decision, plus a permanent receipt you can use to prove what the AI did on a specific date with specific inputs.",
    who_for:
      "General counsels, compliance officers, AI governance leads, security chiefs at banks, hospitals, defense contractors, law firms — anywhere \"the AI made the decision\" needs to hold up in court or in a regulator's office.",
    why_matters:
      "Most AI vendors say \"you have to trust us.\" With Receipt, you don't. Every decision your AI makes has a permanent, externally-verifiable proof attached. Works with the major security tools — Splunk, Sentinel, ArcSight, Chronicle — out of the box.",
    tiers:       ["pro", "enterprise"],
    highlights: [
      { label: "log format",      value: "industry-standard",   hint: "any major security tool can ingest it" },
      { label: "receipt size",    value: "tiny",                hint: "small enough to embed anywhere — emails, exports, logs" },
      { label: "verification",    value: "third-party",         hint: "your auditor can replay and verify it themselves" },
      { label: "works with",      value: "any AI model",        hint: "OpenAI, Anthropic, your own — all supported" },
    ],
    plans: [
      {
        tier:    "pro",
        headline: "Mid-market compliance teams",
        shape:    "Compliance subscription",
        bullets: [
          "Receipts for every AI call your team makes",
          "SIEM-ready log export in standard formats",
          "Web dashboard for audit reviews",
          "Standard retention window",
        ],
        cta:      { label: "Talk to us", href: "/contact?product=receipt&tier=pro" },
        best_for: "Mid-market compliance teams, AI governance leads",
      },
      {
        tier:    "enterprise",
        headline: "Banks, hospitals, law firms, defense contractors",
        shape:    "Dedicated audit infrastructure",
        bullets: [
          "Unlimited receipts and dedicated audit storage",
          "Custom retention windows — seven years and beyond",
          "Deploy the audit pipeline into your cloud or your premises",
          "Regulator-direct read-only access if you need it",
          "Cryptographic chain attestation across the entire log",
        ],
        cta:      { label: "Talk to sales", href: "/contact?product=receipt&tier=enterprise" },
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
      { label: "first delivery",    value: "within a day",       hint: "from the moment you hand over your corpus" },
      { label: "ongoing rhythm",    value: "monthly",             hint: "weekly value-adds, monthly major releases" },
      { label: "your effort",       value: "none",                hint: "no engineering, no IT lift, no learning curve" },
      { label: "public showcase",   value: "your branding",       hint: "ships under your domain or ours, your call" },
    ],
    plans: [
      {
        tier:    "enterprise",
        headline: "Research libraries, foundations, museums",
        shape:    "Concierge engagement",
        bullets: [
          "A full structural map of your collection within a day",
          "A polished public-facing showcase, or kept private — your call",
          "A hand-curated catalog of rare records, hidden patterns, and named singularities",
          "Cross-collection analysis, time-axis trajectory, baseline comparisons",
          "Weekly value-adds: new findings, new visualizations, new threads traced",
          "An operator console for your team to query the formed model directly",
          "A permanent, citable receipt on every analysis we ship you",
          "A dedicated relationship lead for the duration of the engagement",
        ],
        cta:      { label: "Schedule a discovery call", href: "/contact?product=studio" },
        best_for: "Research libraries, foundations, museums, university archives",
      },
    ],
    proof_link: { label: "DocSouth × UNC Libraries — see what day 30 looks like", href: "/docsouth" },
  },

  // -----------------------------------------------------------------
  // 5. VAULT — Private Banking tier
  // -----------------------------------------------------------------
  {
    slug:        "vault",
    name:        "Vault",
    tagline:     "Private Banking for AI on regulated data.",
    what_it_does:
      "Vault is the engine underneath your AI product when your customers are banks, hospitals, law firms, or governments. Each customer gets a fully isolated private model on their own data, with airtight separation, encryption at rest, and a citable receipt on every output. Single binary, deployable into your or your customer's infrastructure.",
    who_for:
      "Founders, technology leaders, and AI product leads selling into regulated industries who need to ship a real product to a real customer — not pitch a roadmap. Selected by application; we work with a small number of partners at any time.",
    why_matters:
      "Eighteen months of compliance engineering, audit infrastructure, multi-tenant isolation, encryption at rest, key custody — done. A dedicated relationship manager. White-glove onboarding. The Private Banking tier of the platform: by invitation, fully bespoke, long-term partnership.",
    tiers:       ["private_banking"],
    highlights: [
      { label: "tenant isolation",   value: "airtight",            hint: "your customers can never see one another's data" },
      { label: "deployment",         value: "single binary",       hint: "your cloud, your customer's cloud, or fully offline" },
      { label: "compliance work",    value: "eighteen months saved", hint: "audit, encryption, isolation, key custody — included" },
      { label: "selection",          value: "by application",      hint: "we work with a small number of partners at any time" },
    ],
    plans: [
      {
        tier:    "private_banking",
        headline: "By application — we work with a small number of partners",
        shape:    "Long-term partnership",
        bullets: [
          "A dedicated relationship manager throughout the engagement",
          "Airtight separation of every customer of yours, enforced at the lowest level of the system",
          "Encrypted-at-rest model artifacts with keys held on your appliance, not in our cloud",
          "An append-only audit log in industry-standard formats, ready to plug into your customer's security tools",
          "Single-binary deployment: your cloud, your customer's cloud, or fully offline",
          "White-glove onboarding for your engineering team",
          "Quarterly architectural reviews, with input into our substrate roadmap",
          "Terms structured around the shape of your business, not ours",
        ],
        cta:      { label: "Apply for Vault", href: "/contact?product=vault&tier=private_banking" },
        best_for: "Founders selling AI into banks, hospitals, law firms, defense, intelligence",
      },
    ],
    proof_link: { label: "See the engineering substrate", href: "/method" },
  },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
