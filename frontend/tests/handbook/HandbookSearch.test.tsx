import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HandbookSearch } from "@/components/handbook/HandbookSearch";

const dataset = [
  { slug: "01-what-ocean-is", title: "What OCEAN Is", outline: [{ id: "x", text: "Determinism" }] },
  { slug: "02-your-first-pipeline", title: "Your First Pipeline", outline: [{ id: "y", text: "Toy corpora" }] },
];

describe("HandbookSearch", () => {
  it("opens on Cmd-K", async () => {
    render(<HandbookSearch dataset={dataset} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeDefined());
  });

  it("filters by query", async () => {
    render(<HandbookSearch dataset={dataset} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "Determinism" } });
    await waitFor(() => {
      expect(screen.getByText(/Determinism/)).toBeDefined();
    });
  });
});
