import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OceanCodeBlock } from "@/components/handbook/OceanCodeBlock";

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

describe("OceanCodeBlock", () => {
  it("renders highlighted code", async () => {
    render(<OceanCodeBlock code="load x.ndjson" runnable={false} corpus={null} />);
    await waitFor(() => expect(screen.getByText(/load/)).toBeDefined());
  });

  it("shows copy button always; run button only when runnable", () => {
    const { rerender } = render(
      <OceanCodeBlock code="load x.ndjson" runnable={false} corpus={null} />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /run/i })).toBeNull();

    rerender(
      <OceanCodeBlock code="load x.ndjson" runnable={true} corpus="toy_tna_50" />
    );
    expect(screen.getByRole("button", { name: /run/i })).toBeDefined();
  });

  it("clicking run calls /api/handbook/run with source and corpus", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        ok: true,
        compile_ms: 10,
        run_ms: 100,
        steps: [{ verb: "load", duration_ms: 42, summary: "50 records" }],
        artifact_preview: "{...}",
      }),
    });

    render(
      <OceanCodeBlock
        code="load x.ndjson"
        runnable={true}
        corpus="toy_tna_50"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/handbook/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "load x.ndjson", corpus: "toy_tna_50" }),
        }),
      );
    });

    await waitFor(() => expect(screen.getByText(/50 records/)).toBeDefined());
  });

  it("shows diagnostic on type error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({
        ok: false,
        category: "type",
        diagnostic: {
          line: 2,
          col: 1,
          token: "cluster",
          message: "cluster expects Z, got Records",
          hint: "pipe through embed first",
        },
      }),
    });

    render(<OceanCodeBlock code="..." runnable={true} corpus="toy_tna_50" />);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => expect(screen.getByText(/cluster expects Z/)).toBeDefined());
    expect(screen.getByText(/pipe through embed first/)).toBeDefined();
  });
});
