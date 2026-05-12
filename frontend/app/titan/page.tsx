import { readFileSync } from "fs";
import { join } from "path";
import { Nav } from "@/components/landing/Nav";
import { ShowcaseHeader } from "@/components/showcase/ShowcaseHeader";
import { ShowcaseArtifactPanel } from "@/components/showcase/ShowcaseArtifactPanel";
import { ShowcaseSourcePanel } from "@/components/showcase/ShowcaseSourcePanel";
import { ShowcaseFooter } from "@/components/showcase/ShowcaseFooter";
import type { ShowcaseArtifact } from "@/components/showcase/types";

import freeArtifactRaw from "@/data/showcases/titan/benchmark_artifact.json";
import premiumArtifactRaw from "@/data/showcases/titan/benchmark_artifact_pro.json";

const freeArtifact = freeArtifactRaw as unknown as ShowcaseArtifact;
const premiumArtifact = premiumArtifactRaw as unknown as ShowcaseArtifact;

const REPO_ROOT = join(process.cwd(), "..");
const STDLIB = join(REPO_ROOT, "packages/ocean-cli/src/ocean_cli/stdlib");

function splitOceanFile(text: string): { free: string; premium: string } {
  const blocks = text.split(/\n(?=define )/);
  return {
    free: blocks[1] ? "define " + blocks[1].replace(/^define /, "") : text,
    premium: blocks[2] ? "define " + blocks[2].replace(/^define /, "") : "",
  };
}

const sources = (() => {
  try {
    const text = readFileSync(join(STDLIB, "titan.ocean"), "utf-8");
    return splitOceanFile(text);
  } catch {
    return { free: "// stdlib file not readable at build time", premium: "" };
  }
})();

export default function TitanPage() {
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 pt-32 pb-16">
        <ShowcaseHeader
          namespace="titan"
          dataset="benchmark"
          title="Titan: Benchmark Corpus"
          tagline="Cross-domain benchmark across 300 records."
          labelField="domain"
          free={freeArtifact}
          premium={premiumArtifact}
          freeSource={sources.free}
          premiumSource={sources.premium}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <ShowcaseArtifactPanel artifact={freeArtifact} tier="free" labelField="domain" />
          <ShowcaseArtifactPanel artifact={premiumArtifact} tier="premium" labelField="domain" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ShowcaseSourcePanel source={sources.free} presetName="titan.benchmark" tier="free" />
          <ShowcaseSourcePanel source={sources.premium} presetName="titan.benchmark_pro" tier="premium" />
        </div>
        <ShowcaseFooter presetName="titan.benchmark" />
      </main>
    </>
  );
}
