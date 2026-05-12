import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ShowcaseArtifactPanel } from "@/components/showcase/ShowcaseArtifactPanel";
import type { ShowcaseArtifact } from "@/components/showcase/types";

describe("ShowcaseArtifactPanel", () => {
  it("renders per-label scores from aligned_modules", () => {
    const free: ShowcaseArtifact = {
      aligned_modules: [
        { module_id: 0, alignment: { dominant_label: "1600", dominant_share: 0.72 } },
        { module_id: 1, alignment: { dominant_label: "2100", dominant_share: 0.55 } },
      ],
    };
    render(<ShowcaseArtifactPanel artifact={free} tier="free" labelField="directorate" />);
    expect(screen.getByText(/1600/)).toBeDefined();
    expect(screen.getByText(/0.72/)).toBeDefined();
    expect(screen.getByText(/2 modules/)).toBeDefined();
  });

  it("renders premium stub note when _note present", () => {
    const stub: ShowcaseArtifact = {
      _note: "requires API key",
      pipeline: { tier: "premium", status: "premium-stub" },
    };
    render(<ShowcaseArtifactPanel artifact={stub} tier="premium" labelField="directorate" />);
    expect(screen.getByText(/requires API key/i)).toBeDefined();
  });

  it("renders tier label", () => {
    const free: ShowcaseArtifact = { aligned_modules: [] };
    render(<ShowcaseArtifactPanel artifact={free} tier="free" labelField="directorate" />);
    expect(screen.getByText(/free/i)).toBeDefined();
  });
});
