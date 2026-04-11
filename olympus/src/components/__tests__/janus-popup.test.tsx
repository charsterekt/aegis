import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JanusPopup } from "../janus-popup";

describe("JanusPopup", () => {
  const mockSession = {
    id: "janus-1",
    issueId: "foundation.contract",
    lines: ["> resolving integration conflict", "> merging candidate branch"],
  };

  it("renders as dialog with Janus Escalation heading", () => {
    render(<JanusPopup session={mockSession} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Janus Escalation")).toBeTruthy();
  });

  it("renders the issue ID", () => {
    render(<JanusPopup session={mockSession} />);
    expect(screen.getAllByText(/foundation\.contract/).length).toBeGreaterThan(0);
  });

  it("renders all session log lines as code elements", () => {
    render(<JanusPopup session={mockSession} />);
    const codeElements = screen.getAllByText("> resolving integration conflict");
    expect(codeElements.length).toBeGreaterThan(0);
  });

  it("shows dismiss button when onDismiss is provided", () => {
    render(<JanusPopup session={mockSession} onDismiss={vi.fn()} />);
    expect(screen.getByLabelText("Dismiss Janus")).toBeTruthy();
  });

  it("does not show dismiss button when onDismiss is undefined", () => {
    render(<JanusPopup session={mockSession} />);
    expect(screen.queryByLabelText("Dismiss Janus")).toBeNull();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<JanusPopup session={mockSession} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss Janus"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has data-testid attribute", () => {
    render(<JanusPopup session={mockSession} />);
    expect(screen.getByTestId("janus-popup")).toBeTruthy();
  });

  it("uses fixed positioning for popup appearance", () => {
    const { container } = render(<JanusPopup session={mockSession} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect((dialog as HTMLElement).style.position).toBe("fixed");
  });
});
