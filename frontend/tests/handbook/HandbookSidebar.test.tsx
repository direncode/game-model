import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HandbookSidebar } from "@/components/handbook/HandbookSidebar";

const chapters = [
  { slug: "index", number: null, title: "The OCEAN Handbook" },
  { slug: "00-preface", number: 0, title: "Preface" },
  { slug: "01-what-ocean-is", number: 1, title: "What OCEAN Is" },
  { slug: "app-a-grammar", number: null, title: "Appendix A — Grammar" },
] as const;

describe("HandbookSidebar", () => {
  it("renders every chapter as a link", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="01-what-ocean-is" />);
    expect(screen.getByText("Preface")).toBeDefined();
    expect(screen.getByText("What OCEAN Is")).toBeDefined();
    expect(screen.getByText("Appendix A — Grammar")).toBeDefined();
  });

  it("highlights the current chapter", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="01-what-ocean-is" />);
    const current = screen.getByText("What OCEAN Is");
    const link = current.closest("a");
    expect(link?.className ?? "").toMatch(/font-semibold|text-emerald|active/);
  });

  it("separates numbered chapters from appendices", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="index" />);
    expect(screen.getByText("Chapters")).toBeDefined();
    expect(screen.getByText("Appendices")).toBeDefined();
  });
});
