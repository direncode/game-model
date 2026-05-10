import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrevNext } from "@/components/handbook/PrevNext";

describe("PrevNext", () => {
  it("renders both links when both prev and next are present", () => {
    render(
      <PrevNext
        prev={{ slug: "01-x", title: "X" }}
        next={{ slug: "03-z", title: "Z" }}
      />
    );
    const prevLink = screen.getByText("X").closest("a");
    const nextLink = screen.getByText("Z").closest("a");
    expect(prevLink?.getAttribute("href")).toBe("/handbook/01-x");
    expect(nextLink?.getAttribute("href")).toBe("/handbook/03-z");
  });

  it("renders only next when prev is null", () => {
    render(<PrevNext prev={null} next={{ slug: "01-x", title: "X" }} />);
    expect(screen.queryByText(/previous/i)).toBeNull();
    expect(screen.getByText("X")).toBeDefined();
  });

  it("renders only prev when next is null", () => {
    render(<PrevNext prev={{ slug: "14-z", title: "Z" }} next={null} />);
    expect(screen.getByText("Z")).toBeDefined();
    expect(screen.queryByText(/next/i)).toBeNull();
  });
});
