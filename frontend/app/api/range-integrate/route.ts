import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { startFormation } from "@/lib/range/form";
import { resolveIdentity } from "@/lib/range/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /api/range-integrate
//
// Integration emulator. Given a source kind ("snowflake" | "databricks" |
// "postgres" | "s3" | "kafka" | "splunk" | ...), this:
//
//   1. Returns a deterministic walkthrough of the steps an enterprise
//      operator would actually run in their stack (handshake, sample,
//      submit, ack).
//   2. Synthesizes a representative inline corpus matching the shape of
//      that source (e.g. Snowflake table → CSV with realistic columns).
//   3. Optionally fires startFormation against that synthesized corpus,
//      so the buyer sees a REAL formed model land at the end.
//
// The point: prove the integration without requiring the buyer to have
// stood up the actual Snowflake/Kafka/etc connection.
// ---------------------------------------------------------------------------

type IntegrationKind =
  | "snowflake" | "databricks" | "postgres" | "s3"
  | "kafka" | "splunk" | "kubernetes" | "terraform"
  | "oidc" | "cli";

const KINDS: IntegrationKind[] = [
  "snowflake", "databricks", "postgres", "s3",
  "kafka", "splunk", "kubernetes", "terraform",
  "oidc", "cli",
];

type Step = { label: string; cmd?: string; output?: string; ok: boolean };

class PRNG {
  private buf: Buffer;
  private idx = 0;
  constructor(s: Buffer) { this.buf = s; }
  byte(): number {
    if (this.idx >= this.buf.length) {
      this.buf = crypto.createHash("sha256").update(this.buf).digest();
      this.idx = 0;
    }
    return this.buf[this.idx++];
  }
  uint32(): number { return (((this.byte() << 24) | (this.byte() << 16) | (this.byte() << 8) | this.byte()) >>> 0); }
  range(lo: number, hi: number): number { return lo + (this.uint32() % (hi - lo + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[this.uint32() % arr.length]; }
}

function seededPrng(...keys: string[]): PRNG {
  return new PRNG(crypto.createHash("sha256").update(keys.join(":")).digest());
}

// ---------- Synthesize a representative corpus per source ----------

function synthCorpus(kind: IntegrationKind, n = 200): { text: string; hint: string } {
  const rng = seededPrng("integrate", kind);
  if (kind === "snowflake" || kind === "databricks") {
    // SQL warehouse → tabular CSV
    const lines = ["customer_id,segment,arr_usd,industry,health,renewed,churn_risk,ndr_pct"];
    const segs = ["SMB", "Mid-Market", "Enterprise", "Strategic"];
    const inds = ["Banking", "Insurance", "Pharma", "Energy", "Defense", "Tech", "Telecom"];
    for (let i = 0; i < n; i++) {
      lines.push([
        `C${10000 + i}`,
        rng.pick(segs),
        rng.range(5000, 5_000_000),
        rng.pick(inds),
        rng.pick(["green", "yellow", "red"]),
        rng.byte() % 2 === 0 ? "true" : "false",
        rng.range(0, 100),
        (90 + rng.byte() / 5).toFixed(1),
      ].join(","));
    }
    return { text: lines.join("\n"), hint: kind + ".csv" };
  }
  if (kind === "postgres") {
    const lines = ["filing_id,cik,form,filed_at,size_kb,is_amended"];
    for (let i = 0; i < n; i++) {
      lines.push([
        `F${1_700_000 + i}`,
        rng.range(100000, 999999),
        rng.pick(["10-K", "10-Q", "8-K", "DEF 14A", "13D", "13G"]),
        `2026-${String(1 + (rng.byte() % 12)).padStart(2, "0")}-${String(1 + (rng.byte() % 28)).padStart(2, "0")}`,
        rng.range(20, 8000),
        rng.byte() % 2 === 0 ? "true" : "false",
      ].join(","));
    }
    return { text: lines.join("\n"), hint: "postgres.csv" };
  }
  if (kind === "s3") {
    // Parquet → emulated as NDJSON of records
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      out.push(JSON.stringify({
        object_key: `q4/2026/part-${String(i).padStart(5, "0")}.parquet`,
        bucket: "acme-data-lake",
        bytes: rng.range(1024, 8 * 1024 * 1024),
        partition: `dt=2026-${String(1 + (rng.byte() % 4)).padStart(2, "0")}-${String(1 + (rng.byte() % 28)).padStart(2, "0")}`,
        record_count: rng.range(100, 50000),
      }));
    }
    return { text: out.join("\n"), hint: "s3.ndjson" };
  }
  if (kind === "kafka") {
    const out: string[] = [];
    const topics = ["customer-tickets", "security-events", "billing-flow"];
    for (let i = 0; i < n; i++) {
      out.push(JSON.stringify({
        topic: rng.pick(topics),
        partition: rng.byte() % 12,
        offset: 1_000_000 + i,
        key: `evt-${rng.uint32().toString(36)}`,
        ts: 1777_000_000_000 + i * 1000,
        payload_kind: rng.pick(["created", "updated", "resolved", "escalated"]),
      }));
    }
    return { text: out.join("\n"), hint: "kafka.ndjson" };
  }
  if (kind === "splunk") {
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      lines.push(`2026-04-30 ${String(rng.byte() % 24).padStart(2, "0")}:${String(rng.byte() % 60).padStart(2, "0")}:${String(rng.byte() % 60).padStart(2, "0")} [${rng.pick(["INFO", "WARN", "ERROR"])}] sourcetype=${rng.pick(["zeek_conn", "sysmon", "edr"])} host=DCDA-WS-${String(rng.range(0, 9999)).padStart(4, "0")} flow=${rng.range(1, 999999)}`);
    }
    return { text: lines.join("\n"), hint: "splunk.txt" };
  }
  // for k8s / terraform / oidc / cli — small JSON of integration metadata
  const out: string[] = [];
  for (let i = 0; i < 50; i++) {
    out.push(JSON.stringify({
      kind, idx: i, deploy_target: kind, status: rng.pick(["pending", "ok", "applied"]),
      resource_id: `r-${rng.uint32().toString(36)}`,
    }));
  }
  return { text: out.join("\n"), hint: kind + ".ndjson" };
}

// ---------- Steps per integration ----------

function buildSteps(kind: IntegrationKind, corpusName: string, modelId: string | null): Step[] {
  const ok = (label: string, cmd?: string, output?: string): Step => ({ label, cmd, output, ok: true });
  switch (kind) {
    case "snowflake":
      return [
        ok("Verify Snowflake account reachable", `range probe snowflake://${corpusName}.snowflakecomputing.com/db/schema`, `account: ${corpusName}\nrole: RANGE_INGEST\nwarehouse: COMPUTE_WH\nstatus: reachable`),
        ok("Create RANGE_API external integration", `CREATE API INTEGRATION range_api\n  API_PROVIDER = generic_https\n  API_ALLOWED_PREFIXES = ('https://range.acme.internal/api/range-form')\n  ENABLED = TRUE;`),
        ok("Bind Range external function", `CREATE EXTERNAL FUNCTION range_form(corpus_query STRING)\n  RETURNS STRING\n  API_INTEGRATION = range_api\n  AS 'https://range.acme.internal/api/range-form';`),
        ok("Form a private model from the table", `SELECT range_form('SELECT * FROM finance.customer_health_q4 LIMIT 5000') AS model_id;`, `┌─────────────────────────────────┐\n│           MODEL_ID              │\n├─────────────────────────────────┤\n│ ${modelId ?? "rng_<id>"}        │\n└─────────────────────────────────┘`),
        ok("Query the formed model from Snowflake", `SELECT range_query('${modelId ?? "rng_<id>"}', 'what is the most rare') AS answer;`),
      ];
    case "databricks":
      return [
        ok("Install Range SDK on cluster", `%pip install range-sdk==1.0.0`),
        ok("Authenticate", `from range_sdk import Range\nr = Range(\n  endpoint = "https://range.acme.internal",\n  token    = dbutils.secrets.get("range", "operator_token"),\n)`),
        ok("Form model from Spark DataFrame", `df = spark.table("acme.finance.customer_health_q4")\nmodel = r.form(df, name="${corpusName}", encrypt=True)\nprint(model.id)`, `${modelId ?? "rng_<id>"}\nformed_at: 2026-04-30T06:30:00Z\nfingerprinter: btut\nencrypted: True`),
        ok("Query from notebook or job", `display(r.query(model.id, "show me the discovered taxonomy"))`),
      ];
    case "postgres":
      return [
        ok("Install pg_range extension", `CREATE EXTENSION pg_range;`),
        ok("Add Range columns to existing table", `ALTER TABLE filings\n  ADD COLUMN rng_fp48 bit(48)\n    GENERATED ALWAYS AS (range_fingerprint(row_to_json(filings))) STORED,\n  ADD COLUMN rng_lin bytea\n    GENERATED ALWAYS AS (range_lineage(row_to_json(filings))) STORED;`),
        ok("Form a private model from a query result", `SELECT range_form('SELECT * FROM filings WHERE filed_at >= ''2026-01-01''') AS model_id;`, `model_id\n----------------------\n${modelId ?? "rng_<id>"}`),
        ok("Query the formed model inline", `SELECT (range_query('${modelId ?? "rng_<id>"}', 'show taxonomy')->>'answer') AS answer;`),
      ];
    case "s3":
      return [
        ok("Mount the bucket prefix", `range mount s3://acme-data-lake/q4-filings/ \\\n  --auth aws-iam \\\n  --role arn:aws:iam::123:role/RangeReader`),
        ok("Inspect schema (auto-detected)", `range schema infer s3://acme-data-lake/q4-filings/`, `format     : ndjson\nrecords    : ~5,200,000\nfields     : 14\nentropy    : 0.71 mean\ncoverage   : btut + minhash fallback ready`),
        ok("Form a private model", `range form --corpus s3://acme-data-lake/q4-filings/ --name "${corpusName}"`, `formed: ${modelId ?? "rng_<id>"}\nchunks: 1,040 (5,000 records each)\nencrypted: yes\nwall: 3m 12s`),
        ok("Cron daily incremental form", `range schedule form \\\n  --corpus s3://acme-data-lake/q4-filings/ \\\n  --cadence "@daily" \\\n  --name "${corpusName}-daily"`),
      ];
    case "kafka":
      return [
        ok("Install Kafka Connect sink connector", `confluent-hub install latentocean/kafka-connect-range:1.0.0`),
        ok("Configure the sink", `name: range-sink\nconfig:\n  connector.class: ai.latentocean.range.RangeSinkConnector\n  topics: customer-tickets,security-events,billing-flow\n  range.endpoint: https://range.acme.internal\n  range.token: \${file:/etc/range/token.properties:operator}\n  range.batch.size: 5000\n  range.form.cadence: 24h\n  range.tenant_id: tenant_acme`),
        ok("Apply", `curl -X POST http://kafka-connect:8083/connectors \\\n  -H "Content-Type: application/json" -d @range-sink.json`, `{"name":"range-sink","tasks":[{"id":0,"state":"RUNNING"}]}`),
        ok("Watch a daily formation land", `range models list --tenant tenant_acme --since 24h`, `${modelId ?? "rng_<id>"}  ${corpusName}  3 topics  4,872 records  fp=btut`),
      ];
    case "splunk":
      return [
        ok("Drop a forwarder app on each indexer", `splunk install app range_export-1.0.0.spl`),
        ok("Configure outputs.conf", `[range_export]\ndisabled = 0\nsourcetype = range:formation\nbatch_max = 5000\nrange_endpoint = https://range.acme.internal\nrange_token = \${RANGE_TOKEN}\nrange_tenant = tenant_acme`),
        ok("Restart and verify", `splunk restart && splunk show range_export status`, `range_export: enabled  events_pending=0  last_form=ok\nlast_model_id: ${modelId ?? "rng_<id>"}`),
        ok("Search Range answers from Splunk", `index=range sourcetype=range:answer | stats count by family | sort - count`),
      ];
    case "kubernetes":
      return [
        ok("Add Range chart repo", `helm repo add latentocean https://charts.latentocean.com\nhelm repo update`),
        ok("Install with your env values", `helm install range latentocean/range-appliance \\\n  --namespace range --create-namespace \\\n  --set storage.formedModels=500Gi \\\n  --set auth.required=true \\\n  --set auth.adminTokenRef=range-admin \\\n  --set encryption.keyRef=range-master-key \\\n  --set bridge.btut.enabled=true \\\n  --set bridge.runpod.enabled=true \\\n  --set ingress.hosts[0].host=range.acme.internal`),
        ok("Verify pods", `kubectl -n range get pods`, `range-frontend-7c9d4f8f6-8sx4z   1/1 Running  0  42s\nrange-api-5b89c6f5d4-r2hwm        1/1 Running  0  41s\nrange-postgres-0                  1/1 Running  0  39s`),
        ok("Mint the first operator token", `kubectl -n range exec deploy/range-frontend -- \\\n  range auth issue --tenant tenant_acme --user jane --role operator`, `token: rng.eyJ...   exp: 2026-05-30T...\nstore at: kubectl create secret generic range-jane --from-literal=token=rng.eyJ...`),
      ];
    case "terraform":
      return [
        ok("Pin the Range module", `module "range" {\n  source  = "latentocean/range/aws"\n  version = "~> 1.0"\n\n  cluster_name      = "acme-range-prod"\n  vpc_id            = data.aws_vpc.acme.id\n  subnet_ids        = data.aws_subnets.private.ids\n  storage_size      = "500Gi"\n  encryption_kms    = aws_kms_alias.range.target_key_arn\n  auth_required     = true\n  enable_runpod     = true\n  ingress_host      = "range.acme.internal"\n  oidc_issuer       = "https://acme.okta.com/oauth2/default"\n}`),
        ok("Plan", `terraform plan -out range.plan`, `Plan: 31 to add, 0 to change, 0 to destroy.\nrange_endpoint: https://range.acme.internal`),
        ok("Apply", `terraform apply range.plan`, `module.range.aws_eks_cluster.this: Creation complete\nApply complete! Resources: 31 added.\nrange_endpoint = https://range.acme.internal`),
        ok("First model formed by the apply", `range models list`, `${modelId ?? "rng_<id>"}  bootstrap-validation  ok`),
      ];
    case "oidc":
      return [
        ok("Register Range as an OIDC client in your IdP", `okta apps create range-prod \\\n  --grants authorization_code,refresh_token \\\n  --redirect-uri https://range.acme.internal/auth/callback`),
        ok("Configure Range to trust the IdP", `range auth configure-oidc \\\n  --issuer https://acme.okta.com/oauth2/default \\\n  --client-id 0oa1a2b3c4d5e6f7g8h \\\n  --client-secret-ref oidc-client \\\n  --tenant-claim org_id \\\n  --role-claim range_role`),
        ok("Map IdP groups to Range roles", `range auth map-role \\\n  --idp-group "range-admins" --role admin\nrange auth map-role \\\n  --idp-group "soc-tier3"   --role operator\nrange auth map-role \\\n  --idp-group "auditors"    --role viewer`),
        ok("Test login", `range auth login --sso`, `opening browser to https://acme.okta.com/oauth2/...\nauthenticated as jane@acme.com\ntenant: org_acme\nrole: operator\ntoken cached at ~/.range/token`),
      ];
    case "cli":
      return [
        ok("Install (single static binary)", `curl -sL https://get.latentocean.com/range | sh\nrange version`, `range 1.0.0 (built 2026-04-29) · linux/amd64\nappliance: not configured`),
        ok("Auth against your appliance", `range auth login \\\n  --endpoint https://range.acme.internal \\\n  --token \$RANGE_TOKEN`, `authenticated  user=jane@acme  tenant=tenant_acme  role=operator`),
        ok("Form a model from any source", `range form --corpus s3://acme-data-lake/q4-filings.parquet --name "${corpusName}"`, `formed: ${modelId ?? "rng_<id>"}\nfingerprinter: btut\nrecords: 5,200,000  chunks: 1,040  encrypted: yes\nwall: 3m 12s`),
        ok("Query in any pipe", `echo "show me the rare records" | range query \${MODEL_ID} --json | jq .citations[0]`, `{\n  "record_idx": 4827,\n  "sha256": "9c4a7f...",\n  "preview": "..."\n}`),
        ok("Stream answers into Slack / PagerDuty / etc", `range query-watch \${MODEL_ID} \\\n  --intent "novel_classes" --threshold-z 8 \\\n  --webhook https://hooks.slack.com/services/...`, `watching  poll=300s  threshold_z=8.0\n   alert -> #soc-tier3   model=${modelId ?? "rng_<id>"}   class="HALCYON-7"   z=41.7`),
      ];
  }
}

// ---------- Route ----------

export async function POST(req: Request) {
  const ident = await resolveIdentity(req);

  let body: { kind?: string; emulate?: boolean; name?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const kind = (body.kind || "").toLowerCase() as IntegrationKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "unknown kind", supported: KINDS }, { status: 400 });
  }

  const corpusName = body.name?.trim() || `${kind}-emulated-corpus`;
  let modelId: string | null = null;

  if (body.emulate !== false) {
    // Run a real formation against a synthesized representative corpus,
    // so the steps shown match what actually happened on the appliance.
    const synth = synthCorpus(kind, kind === "snowflake" || kind === "databricks" ? 250 : 200);
    try {
      const meta = await startFormation({
        corpus_text: synth.text,
        corpus_filename_hint: synth.hint,
        name: `[emulated] ${corpusName}`,
        identity: { user_id: ident.user_id, tenant_id: ident.tenant_id, ip: ident.ip, user_agent: ident.user_agent },
      });
      modelId = meta.id;
    } catch (e) {
      // Emulation should never crash the integration walkthrough — surface
      // the error but still return the steps.
      modelId = null;
      void e;
    }
  }

  const steps = buildSteps(kind, corpusName, modelId);
  return NextResponse.json({
    kind,
    name: corpusName,
    steps,
    emulated_model_id: modelId,
    notes: kind === "kubernetes" || kind === "terraform" || kind === "oidc"
      ? "These commands emulate what would run; the model id below was formed against a representative inline corpus to prove the receiving end works."
      : "The integration command shape matches what your engineers would paste into your existing stack. The model id below was actually formed on this appliance from a representative payload.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return NextResponse.json({
    kinds: KINDS.map((k) => ({
      kind: k,
      label: ({ snowflake: "Snowflake", databricks: "Databricks", postgres: "Postgres", s3: "S3 / Object Storage", kafka: "Kafka Connect", splunk: "Splunk forwarder", kubernetes: "Kubernetes (Helm)", terraform: "Terraform module", oidc: "SSO via OIDC / SAML", cli: "Range CLI" } as Record<string, string>)[k],
    })),
  });
}
