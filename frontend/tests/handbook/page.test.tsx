import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// next/navigation's notFound throws — mock so it doesn't crash the test.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ChapterPage, { generateStaticParams } from "@/app/handbook/[chapter]/page";

describe("handbook/[chapter]/page", () => {
  it("generateStaticParams returns one entry per non-index chapter", () => {
    const params = generateStaticParams();
    expect(params.length).toBeGreaterThan(0);
    for (const p of params) {
      expect(p.chapter).toBeDefined();
      expect(p.chapter).not.toBe("index");
    }
  });

  it("renders the chapter title", () => {
    const params = generateStaticParams();
    const someParam = params[0];
    const PageComp = ChapterPage({ params: someParam });
    render(PageComp);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});
