import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SettingsPanel } from "../settings-panel";

describe("SettingsPanel", () => {
  it("renders when isOpen is true", () => {
    const { container } = render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain("Settings");
  });

  it("uses the visible overlay as the accessible dialog root", () => {
    const { container } = render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
    const overlay = container.querySelector(".settings-overlay");

    expect(overlay).toBeTruthy();
    expect(overlay).toBe(container.querySelector('[data-testid="settings-panel"]'));
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-label")).toBe("Settings");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<SettingsPanel isOpen={false} onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsPanel isOpen={true} onClose={onClose} />);
    const closeBtn = container.querySelector(".settings-close-btn");
    closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsPanel isOpen={true} onClose={onClose} />);
    const overlay = container.querySelector(".settings-overlay");
    overlay?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when panel content is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsPanel isOpen={true} onClose={onClose} />);
    const panel = container.querySelector(".settings-panel");
    panel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("displays runtime configuration", () => {
    const { container } = render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
    expect(container.textContent).toContain("Runtime");
  });

  it("displays concurrency configuration", () => {
    const { container } = render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
    expect(container.textContent).toContain("Concurrency");
  });

  it("displays budget configuration", () => {
    const { container } = render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
    expect(container.textContent).toContain("Budget");
  });
});
