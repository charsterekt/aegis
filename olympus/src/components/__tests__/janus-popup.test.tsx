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
    const { container } = render(<JanusPopup session={mockSession} />);
    const buttons = container.querySelectorAll('button[aria-label="Dismiss Janus"]');
    expect(buttons.length).toBe(0);
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    const { container } = render(<JanusPopup session={mockSession} onDismiss={onDismiss} />);
    const dismissButtons = container.querySelectorAll('button[aria-label="Dismiss Janus"]');
    expect(dismissButtons.length).toBeGreaterThan(0);
    fireEvent.click(dismissButtons[0]);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("has data-testid attribute", () => {
    render(<JanusPopup session={mockSession} />);
    expect(screen.getAllByTestId("janus-popup").length).toBeGreaterThan(0);
  });

  it("uses fixed positioning for popup appearance", () => {
    const { container } = render(<JanusPopup session={mockSession} />);
    const dialogs = container.querySelectorAll('[role="dialog"]');
    expect(dialogs.length).toBeGreaterThan(0);
    expect((dialogs[0] as HTMLElement).style.position).toBe("fixed");
  });
});
