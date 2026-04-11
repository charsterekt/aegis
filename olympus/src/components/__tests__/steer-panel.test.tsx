import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { SteerPanel } from "../steer-panel";

describe("SteerPanel", () => {
  const mockOnCommand = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders steer command input and send button", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    expect(screen.getByLabelText("Steer command")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("renders the steer reference list", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    expect(screen.getAllByText("status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("focus <issue>").length).toBeGreaterThan(0);
  });

  it("disables send button when input is empty", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables send button when input has text", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.change(input, { target: { value: "status" } });
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onCommand with trimmed value on send click", async () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.change(input, { target: { value: "status " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(mockOnCommand).toHaveBeenCalledWith("status");
    });
  });

  it("calls onCommand on Enter key", async () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.change(input, { target: { value: "pause" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(mockOnCommand).toHaveBeenCalledWith("pause");
    });
  });

  it("does not submit on Enter when input is empty", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockOnCommand).not.toHaveBeenCalled();
  });

  it("shows OK result on successful command", async () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.change(input, { target: { value: "status" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getAllByText(/OK: status/).length).toBeGreaterThan(0);
    });
  });

  it("shows error result on failed command", async () => {
    const onCommand = vi.fn().mockRejectedValue(new Error("Command declined"));
    render(<SteerPanel reference={defaultProps.reference} onCommand={onCommand} />);
    const input = screen.getByLabelText("Steer command");
    fireEvent.change(input, { target: { value: "focus bd-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getAllByText("Command declined").length).toBeGreaterThan(0);
    });
  });

  it("clears input after successful command", async () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const input = screen.getByLabelText("Steer command") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "status" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("hides result surface when no result exists", () => {
    const { container } = render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} />);
    const sections = container.querySelectorAll('[aria-label="Steer"]');
    const lastSection = sections[sections.length - 1];
    expect(lastSection.textContent).not.toMatch(/OK:|Error:/);
  });

  it("uses controlled value/onChange when provided", () => {
    const onChange = vi.fn();
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} value="focused" onChange={onChange} />);
    const input = screen.getByLabelText("Steer command") as HTMLInputElement;
    expect(input.value).toBe("focused");
    fireEvent.change(input, { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("new");
  });

  it("uses external result prop when provided", () => {
    render(<SteerPanel reference={defaultProps.reference} onCommand={mockOnCommand} result="external override" />);
    expect(screen.getAllByText("external override").length).toBeGreaterThan(0);
  });
});

const defaultProps = {
  reference: ["status", "pause", "resume", "focus <issue>", "kill <agent>"],
  onCommand: vi.fn().mockResolvedValue(undefined),
};
