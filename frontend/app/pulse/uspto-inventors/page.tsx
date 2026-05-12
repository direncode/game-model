import { readFileSync } from "fs";
import { join } from "path";
import { Nav } from "@/components/landing/Nav";
import { ShowcaseHeader } from "@/components/showcase/ShowcaseHeader";
import { ShowcaseArtifactPanel } from "@/components/showcase/ShowcaseArtifactPanel";
import { ShowcaseSourcePanel } from "@/components/showcase/ShowcaseSourcePanel";
import { ShowcaseFooter } from "@/components/showcase/ShowcaseFooter";
import type { ShowcaseArtifact } from "@/components/showcase/types";

import freeArtifactRaw from "../../../../data/showcases/pulse/uspto_artifact.json";
import premiumArtifactRaw from "../../../../data/showcases/pulse/uspto_artifact_pro.json";

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
    const text = readFileSync(join(STDLIB, "pulse.ocean"), "utf-8");
    return splitOceanFile(text);
  } catch {
    return { free: "// stdlib file not readable at build time", premium: "" };
  }
})();

export default function PulseUSPTOPage() {
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 pt-32 pb-16">
        <ShowcaseHeader
          namespace="pulse"
          dataset="uspto"
          title="Pulse: USPTO Inventor Records"
          tagline="Structural clustering across 500 patent abstracts."
          labelField="directorate"
          free={freeArtifact}
          premium={premiumArtifact}
          freeSource={sources.free}
          premiumSource={sources.premium}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <ShowcaseArtifactPanel artifact={freeArtifact} tier="free" labelField="directorate" />
          <ShowcaseArtifactPanel artifact={premiumArtifact} tier="premium" labelField="directorate" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ShowcaseSourcePanel source={sources.free} presetName="pulse.uspto" tier="free" />
          <ShowcaseSourcePanel source={sources.premium} presetName="pulse.uspto_pro" tier="premium" />
        </div>
        <ShowcaseFooter presetName="pulse.uspto" />
      </main>
    </>
  );
}
