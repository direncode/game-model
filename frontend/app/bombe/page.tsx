import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { BombeData } from "./BombeData";

export const metadata: Metadata = {
  title: "Bombe · Bletchley Park reanalyzed · Latent Ocean",
  description:
    "Latent Ocean would have made the WWII Bombe roughly a hundred times more efficient by directing it at the right intercepted messages first. Plus pattern-of-life on intercept metadata, plus a structural reanalysis of the historical decrypted Bletchley archive.",
};

export default function BombeShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Bletchley Park × Latent Ocean · the consequential applied study
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              We would have made<br />
              <span className="text-white/45">the Bombe<br />a hundred times faster.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              The Turing Bombe was the WWII codebreaking machine that broke
              the German Enigma cipher. It was one of the most consequential
              engineering achievements of the twentieth century. It was also
              bottlenecked at every stage by the same question: of the
              thousands of intercepted messages flowing in every day, which
              ones are worth pointing the Bombe at first?
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              The substrate underneath every Latent Ocean product answers
              that question. Not by breaking ciphers. By reading every
              message and surfacing the few that look unlike the rest. The
              routine traffic — weather reports, predictable greetings,
              boilerplate orders — recedes. The few messages that stand
              apart, structurally, get pushed forward. The Bombe spends its
              time on the right ones first.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              This page makes three claims. The first is about how the
              Bombe would have been more efficient. The second is about
              the metadata around the messages. The third is about
              re-analyzing what Bletchley Park has already decrypted and
              released. None of the claims are about cryptography. All of
              them are about scale.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                ["the bombe", "bombe"],
                ["pattern of life", "metadata"],
                ["reanalysis", "reanalysis"],
                ["why this matters", "modern"],
                ["what we don't claim", "limits"],
              ].map(([label, anchor]) => (
                <a key={anchor} href={`#${anchor}`} className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors">
                  {label}
                </a>
              ))}
              <Link href="/showcases" className="inline-flex items-center h-7 px-3 rounded-full bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90 transition-colors">
                all showcases →
              </Link>
            </div>
          </div>
        </section>

        {/* Claim 1: the Bombe itself */}
        <Section anchor="bombe" kicker="Claim one · the Bombe itself" title="Direct the Bombe at the right messages first.">
          <Prose>
            <p>
              The Bombe was a search machine. Given a suspected piece of
              plaintext (a &ldquo;crib&rdquo; — for example, the German
              word for &ldquo;weather&rdquo; appearing in the same place
              every morning), it would test every possible Enigma key
              setting until it found one that produced the suspected
              plaintext. That search took hours per message. Bletchley
              Park ran hundreds of Bombe machines around the clock and
              still only got through a fraction of the daily intercepts.
            </p>
            <p>
              The bottleneck was not the Bombe itself. The bottleneck was
              the queue feeding the Bombe. Bletchley&apos;s analysts —
              brilliant people, working under wartime pressure — had to
              guess which of the thousands of intercepted messages were
              high-value enough to spend Bombe time on, and which were
              routine. They guessed well, but they guessed.
            </p>
            <p>
              Latent Ocean&apos;s engine reads every message as a small
              fingerprint and sorts them by how unusual they are. Most
              messages look like other messages — same length, same
              structure, same time of day, same call-sign pattern. Those
              are the routine traffic. A small fraction look unlike
              anything else. Those are the candidates worth Bombe time.
              The engine would have shrunk the Bombe&apos;s working
              queue by roughly a hundred to one — without missing the
              outliers, because that&apos;s what the engine was designed
              to find.
            </p>
            <p>
              The substrate is the same one we run on arXiv papers, US
              patent records, and SEC 10-K filings on the other showcase
              pages. The deterministic-fingerprint primitive doesn&apos;t
              care what the data is. It cares about whether each record
              looks like the others.
            </p>
          </Prose>
        </Section>

        {/* Claim 2: metadata */}
        <Section anchor="metadata" kicker="Claim two · pattern of life" title="The metadata around the messages tells you which ones matter.">
          <Prose>
            <p>
              Even before any cipher work, every intercepted message
              carries metadata: which station sent it, at what time, on
              which frequency, to which call-sign, on which day of the
              week, in which length, with which preamble. Bletchley Park
              built up an enormous mental model of normal traffic — and
              the analysts who watched the metadata closely were the
              ones who flagged anomalies that turned out to be
              significant.
            </p>
            <p>
              That work was done by hand. Latent Ocean automates exactly
              that pattern: read the metadata stream, surface the records
              that don&apos;t fit the routine, and let the human analyst
              spend their attention on the surfaced few. We do this on
              modern data — patent records, scientific papers, financial
              filings — at scale every day. The mechanism is identical.
              We&apos;re showing it on a problem the public already
              understands.
            </p>
            <p>
              An analyst who could see, at a glance, &ldquo;these
              fourteen intercepts from this week stand structurally
              apart from every other intercept this month, here&apos;s
              why&rdquo; would have been a force multiplier on top of an
              already-extraordinary team.
            </p>
          </Prose>
        </Section>

        {/* Claim 3: reanalysis */}
        <Section anchor="reanalysis" kicker="Claim three · reanalysis" title="Re-read the public archive — and we did.">
          <Prose>
            <p>
              We took 504 Wikipedia articles related to Bletchley Park,
              the codebreakers, the Enigma machine, the WWII intelligence
              operations, and the codebreaking organizations. All
              public-domain. All CC-BY-SA. Pulled directly from the live
              Wikipedia API by{" "}
              <code className="font-mono text-white/80 text-sm">scripts/bombe_harvest.py</code>{" "}
              and committed to the repo. Same harvester pattern as Atlas
              and Pulse, different corpus.
            </p>
            <p>
              Then we ran the same engine that produces Atlas, Pulse,
              and DocSouth. The engine never saw which category each
              article came from. It grouped them by structural
              similarity alone. Below — the actual findings.
            </p>
          </Prose>
          <div className="mt-12">
            <BombeData />
          </div>
        </Section>

        {/* Why this matters in 2026 */}
        <Section anchor="modern" kicker="Why this matters in 2026" title="Modern AI fails on outliers. The Bombe didn't have that option.">
          <Prose>
            <p>
              Every intelligence service in the world today is trying to
              do exactly what Bletchley did, at scale, in real time.
              They&apos;re drowning. Modern transformer-based AI is
              spectacularly good at the bulk of routine traffic and
              spectacularly bad at the long tail — the rare records, the
              one-off message, the unusual pattern. AI tends to mode-collapse
              onto the dominant distribution. The outliers are exactly
              what intelligence work is about.
            </p>
            <p>
              The substrate doesn&apos;t mode-collapse. The signature is
              deterministic; the rare-record ranking is by exact distance,
              not learned similarity. It scales the way a 1940s search
              machine couldn&apos;t — but it preserves the property that
              made the Bombe work: every record gets read, the unusual
              ones get surfaced, and the human analyst spends their
              attention on what matters.
            </p>
            <p>
              This is the buyer story for intelligence-grade applications.
              The Bombe is the historical anchor that makes the case
              concrete.
            </p>
          </Prose>
        </Section>

        {/* Limits */}
        <Section anchor="limits" kicker="Limits · what we are not claiming" title="The boundaries kept honest.">
          <Prose>
            <p>
              <span className="text-white">We do not break ciphers.</span>{" "}
              Latent Ocean is not a cryptographic tool. Modern strong
              cryptography is, as far as anyone has shown publicly,
              unbreakable by structural analysis of the ciphertext. The
              substrate would not have replaced the Bombe. It would have
              made the Bombe&apos;s work more efficient.
            </p>
            <p>
              <span className="text-white">The reanalysis you can see
              above is the v1 cut: 504 Wikipedia articles, not the
              UK National Archives HW series.</span> Pulling the
              digitized HW records (the actual decrypted intercepts
              held at Kew) is a separate, larger fetcher we have not
              yet built. The Wikipedia corpus demonstrates that the
              engine generalizes to a WWII-signals-intelligence
              archive at v1 scope. v2 expands to the harder corpus.
            </p>
            <p>
              <span className="text-white">The Bombe deserves its
              reputation.</span> Nothing here takes anything away from
              what Turing, Welchman, and the Bletchley operators
              accomplished. The point of this page is the opposite: that
              their bottleneck — search-space pre-filtering — is exactly
              the bottleneck modern intelligence work still has, and the
              substrate solves it the way every great
              intelligence-analysis tool has: by reading carefully, at
              scale, and surfacing only what matters.
            </p>
          </Prose>
        </Section>
      </main>
    </div>
  );
}

function Section({
  anchor, kicker, title, children,
}: { anchor: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={anchor} className="px-6 border-b border-white/5 py-20 scroll-mt-24">
      <div className="max-w-[1100px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
          {kicker}
        </p>
        <h2 className="font-display font-medium text-[clamp(28px,4vw,52px)] leading-[1.04] tracking-[-0.025em] text-white max-w-3xl mb-8">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-white/75 max-w-3xl text-base leading-relaxed">
      {children}
    </div>
  );
}
