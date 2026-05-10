import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OnThisPage } from "@/components/handbook/OnThisPage";

const outline = [
  { id: "a-first-idea", text: "A first idea", level: 2 as const },
  { id: "details", text: "Details", level: 3 as const },
  { id: "wider-system", text: "Wider system", level: 2 as const },
];

describe("OnThisPage", () => {
  it("renders every outline item as a link to its anchor", () => {
    render(<OnThisPage outline={outline} />);
    const links = screen.getAllByRole("link");
    expect(links.find((l) => l.getAttribute("href") === "#a-first-idea")).toBeDefined();
    expect(links.find((l) => l.getAttribute("href") === "#wider-system")).toBeDefined();
  });

  it("indents H3 items relative to H2", () => {
    render(<OnThisPage outline={outline} />);
    const h3 = screen.getByText("Details");
    expect(h3.parentElement?.className ?? "").toMatch(/ml-|pl-/);
  });
});
