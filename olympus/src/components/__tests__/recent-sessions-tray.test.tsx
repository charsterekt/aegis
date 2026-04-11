import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentSessionsTray } from "../recent-sessions-tray";

describe("RecentSessionsTray", () => {
  it("renders Completed Sessions heading", () => {
    render(<RecentSessionsTray sessions={[]} />);
    expect(screen.getByRole("heading", { name: "Completed Sessions" })).toBeTruthy();
  });

  it("renders empty state when no sessions exist", () => {
    render(<RecentSessionsTray sessions={[]} />);
    expect(screen.getAllByText("No recent completions").length).toBeGreaterThan(0);
  });

  it("renders one pill per session", () => {
    const sessions = [
      { id: "session-1", closedAgo: "2m ago", outcome: "success" as const },
      { id: "session-2", closedAgo: "5m ago", outcome: "failed" as const },
    ];
    render(<RecentSessionsTray sessions={sessions} />);
    expect(screen.getAllByRole("button").length).toBe(2);
  });

  it("renders pill text with id and closedAgo", () => {
    const sessions = [
      { id: "session-1", closedAgo: "2m ago", outcome: "success" as const },
    ];
    render(<RecentSessionsTray sessions={sessions} />);
    expect(screen.getAllByText(/session-1 completed 2m ago/).length).toBeGreaterThan(0);
  });

  it("renders pills as button elements", () => {
    const sessions = [
      { id: "session-1", closedAgo: "2m ago", outcome: "success" as const },
    ];
    render(<RecentSessionsTray sessions={sessions} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1);
    expect((buttons[0] as HTMLButtonElement).tagName).toBe("BUTTON");
  });

  it("shows outcome-colored dot for success", () => {
    const sessions = [
      { id: "s1", closedAgo: "1m ago", outcome: "success" as const },
    ];
    const { container } = render(<RecentSessionsTray sessions={sessions} />);
    const pill = container.querySelector(".recent-session-pill");
    expect(pill).toBeTruthy();
    // The dot should be a child span with backgroundColor matching success color
    const dot = pill?.querySelector("span");
    expect(dot).toBeTruthy();
  });
});
