import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title:       "How it works · Latent Ocean",
  description: "Three steps in plain language. What Latent Ocean does to your data, what comes back to you, and why it stays the same forever — in words anyone can read.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24 pt-12">
          <div className="max-w-[1200px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              How it works · in plain language
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              Three steps.<br />
              <span className="text-white/45">No jargon.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              Latent Ocean turns any collection of records — customer
              data, scientific results, AI outputs, an archive of
              historical documents — into something you can work with
              forever, the same way every time. This page explains how,
              in language anyone on your team can read. The technical
              proof for your engineers is at{" "}
              <Link href="/method" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/method</Link>.
            </p>
          </div>
        </section>

        {/* Step 1 */}
        <Step
          number="01"
          title="You bring your data."
          subtitle="Any format, any size. We meet it where it is."
        >
          <p>
            You give us a collection of records. It might be a
            spreadsheet of customer names, a database of medical
            histories, a folder of legal contracts, a digitized archive
            of historical documents, or the outputs your AI system has
            produced this quarter.
          </p>
          <p>
            We accept almost any format that exists — common ones like
            spreadsheets, databases, or plain text files, but also
            unusual ones. We do not need you to clean the data first.
            We do not need you to label it. We do not need you to
            describe its structure. Whatever you have, we can read.
          </p>
          <p>
            Your data does not leave your control. Depending on which
            of our products you use, it stays inside our cloud, or
            inside your cloud, or inside your customer's data center,
            or fully offline on hardware in your building. You decide.
          </p>
        </Step>

        {/* Step 2 */}
        <Step
          number="02"
          title="We make a private model from your data."
          subtitle="A small artifact that knows what's in your records — and stays the same forever."
        >
          <p>
            What we ship back to you is not a chatbot. It is not an LLM.
            It is something simpler and more useful for the things you
            need to be able to prove.
          </p>
          <p>
            We make a private model out of your data. This model knows
            which of your records are similar to each other, which are
            unusually different, what clusters they form, how they
            change over time, what's hidden in there that you have not
            yet seen. It can answer questions about your data.
          </p>
          <p>
            The private model has two properties most AI products do
            not. First, it is yours alone. No one else's data is mixed
            into it; no one else can see what's in it. Second, it is
            stable. Run the same question against it today, run the
            same question against it in 2030, and you will get the
            same answer — exactly the same — every time.
          </p>
          <p>
            The same is true of the model itself. If you give us the
            same data again, we will produce the same model again.
            Always. That property is the load-bearing claim of the
            entire platform.
          </p>
        </Step>

        {/* Step 3 */}
        <Step
          number="03"
          title="Every answer comes with a permanent receipt."
          subtitle="Citable, third-party-verifiable, valid in court or in a regulator's office."
        >
          <p>
            When you ask the private model a question, the answer
            arrives with a small attachment — a permanent fingerprint
            of the answer. Anyone with access to the same model and
            the same question can re-run it and produce the same
            fingerprint. They will know your answer is real, and that
            it has not changed.
          </p>
          <p>
            For most uses of AI, this is a nice-to-have. For some
            uses — a regulator asking what your fraud-detection model
            decided on July 14, a journal editor asking whether your
            published finding can be reproduced, a customer's general
            counsel asking whether your AI output is admissible as
            evidence — it is the difference between a system you can
            defend and one you cannot.
          </p>
          <p>
            Every answer Latent Ocean produces ships with this
            receipt. There is no premium tier you have to upgrade to
            to get it. It is the substrate.
          </p>
        </Step>

        {/* Five product fanout */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1200px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              The same three steps, packaged five ways
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white leading-[1] mb-10 max-w-3xl">
              The substrate is one piece of engineering.<br />
              <span className="text-white/45">We sell it five different ways.</span>
            </h2>
            <p className="text-[15.5px] text-white/65 max-w-3xl leading-relaxed mb-12">
              Whether you have a spreadsheet of duplicate customer
              records or an entire institutional archive, the engine
              underneath is the same. What changes is the shape of the
              relationship — how much hand-holding, how much
              integration, how much customization. That's what the
              five products are.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { slug: "pulse",   name: "Pulse",   line: "Find duplicates and look-alikes in your data." },
                { slug: "atlas",   name: "Atlas",   line: "Run analyses you can publish, audit, or defend in court." },
                { slug: "receipt", name: "Receipt", line: "Stamp every AI decision with a verifiable receipt." },
                { slug: "studio",  name: "Studio",  line: "We map your archive in a day, then keep enriching it." },
                { slug: "vault",   name: "Vault",   line: "Private Banking. The substrate for AI on regulated data.", featured: true },
              ].map((p) => (
                <Link
                  key={p.slug}
                  href={`/${p.slug}`}
                  className={`block rounded-2xl border p-6 transition-colors ${
                    p.featured
                      ? "border-white/25 bg-gradient-to-br from-white/[0.03] to-black hover:border-white/55 md:col-span-2"
                      : "border-white/10 bg-[#0a0a0a] hover:border-white/30"
                  }`}
                >
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-display text-2xl tracking-[-0.025em] text-white">{p.name}</span>
                    {p.featured && (
                      <span className="inline-flex items-center h-5 px-2 rounded-full font-mono text-[9.5px] uppercase tracking-[0.18em] border border-white text-white">
                        Private Banking
                      </span>
                    )}
                  </div>
                  <div className="text-[14px] text-white/70 leading-snug">{p.line}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* What's not happening */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Plain-language honesty about what we are not
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.05] mb-10 max-w-3xl">
              What this is not.
            </h2>
            <div className="space-y-7 text-[15px] text-white/75 leading-relaxed max-w-2xl">
              <p>
                <span className="text-white">It is not a chatbot.</span> Latent Ocean
                does not write essays, generate emails, or hold a
                conversation. If that is what you need, an LLM is the
                right tool. We are the tool you reach for when you need
                to be able to prove what was decided.
              </p>
              <p>
                <span className="text-white">It is not a data warehouse.</span> We
                do not store your operational data. We make a private
                model from your data, and the private model is small
                enough to fit on a USB stick.
              </p>
              <p>
                <span className="text-white">It does not invent.</span> When you
                ask our private model a question that the data does
                not support an answer to, it tells you so. It does not
                make something up. For most uses of AI in regulated
                industries, this refusal is the entire reason to use
                us.
              </p>
              <p>
                <span className="text-white">It is not a do-it-yourself
                platform — yet.</span> Today, most engagements involve our
                team helping you set things up, especially in the
                first few weeks. Some of our products will become more
                self-serve over time; others will always be hands-on.
                Studio and Vault are deliberately concierge.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 pt-24">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
              Tell us what you have.<br />We'll tell you the right product.
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
              <Link href="/contact" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                Talk to us
              </Link>
              <Link href="/products" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                See the five products
              </Link>
              <Link href="/docsouth" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                See it in action · DocSouth
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="relative px-6 py-24 border-b border-white/5">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-16">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
            Step {number}
          </div>
          <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white leading-[1] mb-5">
            {title}
          </h2>
          <p className="text-[15px] text-white/55 leading-snug max-w-md">
            {subtitle}
          </p>
        </div>
        <div className="space-y-5 text-[16px] text-white/85 leading-relaxed max-w-2xl">
          {children}
        </div>
      </div>
    </section>
  );
}
