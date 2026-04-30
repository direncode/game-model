"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

type Posture = "evaluating" | "comparing" | "ready" | "early";
type Use = "compliance" | "security" | "research" | "ops" | "finance" | "other";
type Size = "<100" | "100-1000" | "1000-10000" | ">10000";

export function RangeAccess() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [size, setSize] = useState<Size>("100-1000");
  const [use, setUse] = useState<Use>("security");
  const [posture, setPosture] = useState<Posture>("evaluating");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !org.trim()) return;
    // Compose a mailto with structured fields. The receiving side gets a
    // clean, qualified intake message, with no third-party form vendor in
    // the loop (which would be the wrong shape for an air-gap-positioned
    // product).
    const body =
      `Name:        ${name}\n` +
      `Email:       ${email}\n` +
      `Org:         ${org}\n` +
      `Org size:    ${size}\n` +
      `Primary use: ${use}\n` +
      `Posture:     ${posture}\n\n` +
      `Notes:\n${notes}\n`;
    const subject = `Range · enterprise access · ${org}`;
    const url = `mailto:sales@latentocean.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setSubmitted(true);
  };

  return (
    <section id="access" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Enterprise access
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Mount Range<br />
            <span className="text-white/40">on your network.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Tell us your environment and primary use case. We respond
            within one business day with a technical session, an
            appliance-specification fit, and the air-gap install path
            appropriate to your posture.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          onSubmit={handleSubmit}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-li-cyan animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
              Request access · qualifying intake
            </span>
            <span className="font-mono text-[10px] text-white/30 ml-auto">
              no third-party form vendor · message goes direct
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Lee"
                className={INPUT}
              />
            </Field>
            <Field label="Work email" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className={INPUT}
              />
            </Field>
            <Field label="Organization" required>
              <input
                required
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Acme Bank"
                className={INPUT}
              />
            </Field>
            <Field label="Headcount">
              <Choice<Size>
                value={size}
                onChange={setSize}
                options={[
                  ["<100", "< 100"],
                  ["100-1000", "100 – 1k"],
                  ["1000-10000", "1k – 10k"],
                  [">10000", "> 10k"],
                ]}
              />
            </Field>
            <Field label="Primary use case">
              <Choice<Use>
                value={use}
                onChange={setUse}
                options={[
                  ["security", "security / threat-intel"],
                  ["compliance", "compliance / audit"],
                  ["research", "research / discovery"],
                  ["finance", "finance / risk"],
                  ["ops", "operations / monitoring"],
                  ["other", "other"],
                ]}
              />
            </Field>
            <Field label="Posture">
              <Choice<Posture>
                value={posture}
                onChange={setPosture}
                options={[
                  ["evaluating", "evaluating"],
                  ["comparing", "comparing vendors"],
                  ["ready", "ready to install"],
                  ["early", "early conversations"],
                ]}
              />
            </Field>
          </div>

          <div className="px-6 pb-6">
            <Field label="What corpora would you mount first?">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 18 months of EDR telemetry, all SEC filings under a single CIK, 5 years of internal R&D abstracts …"
                rows={4}
                className={INPUT + " resize-y"}
              />
            </Field>
          </div>

          <div className="border-t border-white/10 px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="font-mono text-[11px] text-white/40 max-w-xl">
              By submitting you agree only to a technical conversation. No
              data leaves this page until you press send. Your message is
              composed locally and opens in your mail client.
            </div>
            <div className="flex items-center gap-2">
              {submitted ? (
                <span className="font-mono text-[11px] text-li-green">
                  ✓ message composed · check your mail client
                </span>
              ) : null}
              <button
                type="submit"
                disabled={!email.trim() || !org.trim()}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Request access →
              </button>
            </div>
          </div>
        </motion.form>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-6 text-[12px] font-mono text-white/35 leading-relaxed"
        >
          Or write directly:{" "}
          <a href="mailto:sales@latentocean.com" className="text-li-cyan hover:text-white transition-colors">
            sales@latentocean.com
          </a>
        </motion.p>
      </div>
    </section>
  );
}

const INPUT =
  "w-full font-mono text-[12.5px] text-white/90 bg-black/60 border border-white/10 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-li-cyan/60 placeholder:text-white/30";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 mb-2 block">
        {label}{required ? <span className="text-li-red ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`text-left px-3 py-2 rounded-lg border font-mono text-[11.5px] transition-colors ${
            v === value
              ? "border-li-cyan/60 bg-li-cyan/[0.05] text-white"
              : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:border-white/25"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
