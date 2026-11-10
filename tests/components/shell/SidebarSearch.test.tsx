import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, type SidebarProps } from "@/components/shell/Sidebar";
import type { VisibleApps } from "@/types";

const sidebar = vi.hoisted(() => ({ collapsed: false }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { filter?: string }) =>
      options?.filter != null ? `${key}:${options.filter}` : key,
    i18n: { resolvedLanguage: "en" },
  }),
}));
vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => ({ hasUpdate: false }),
}));
vi.mock("@/hooks/useSidebarCollapsed", () => ({
  useSidebarCollapsed: () => ({
    collapsed: sidebar.collapsed,
    toggle: vi.fn(),
  }),
  sidebarWidth: (collapsed: boolean) => (collapsed ? 72 : 200),
}));
vi.mock("@/hooks/useMoneyFormat", () => ({
  useMoneyFormat: () => ({ moneyShort: String }),
}));
vi.mock("@/lib/query", () => ({ useSettingsQuery: () => ({ data: {} }) }));
vi.mock("@/hooks/useSidebarStatus", () => ({
  useSidebarStatus: () => ({
    appStatus: () => ({ mode: "direct", alert: false }),
    todayCost: 0,
    todayTokens: 0,
    todayRequests: 0,
    todayHitRate: 0,
    authNeedsAttention: false,
  }),
}));

const makeProps = (): SidebarProps => ({
  activeApp: "claude",
  view: "providers",
  visibleApps: { claude: true, codex: true, gemini: true } as VisibleApps,
  settingsSection: "general",
  onSelectApp: vi.fn(),
  onSelectPage: vi.fn(),
  onSelectSettingsSection: vi.fn(),
  onExitSettings: vi.fn(),
});
const appList = () => screen.getByRole("group", { name: "nav.appsGroup" });
const searchInput = () =>
  screen.getByRole("textbox", { name: "nav.searchApps" });

beforeEach(() => {
  sidebar.collapsed = false;
});

describe("sidebar app search", () => {
  it("labels the input and filters case-insensitively, trimming whitespace", () => {
    render(<Sidebar {...makeProps()} />);
    expect(searchInput()).toHaveAttribute("placeholder", "nav.searchApps");
    fireEvent.change(searchInput(), { target: { value: "  cOdEx  " } });
    expect(
      within(appList()).getByRole("button", { name: "Codex" }),
    ).toBeInTheDocument();
    expect(
      within(appList()).queryByRole("button", { name: "Claude Code" }),
    ).not.toBeInTheDocument();
    // Global navigation stays available while the application list is filtered.
    expect(
      screen.getByRole("button", { name: "nav.sessions" }),
    ).toBeInTheDocument();
  });

  it("does not reveal apps disabled in the sidebar", () => {
    const props = makeProps();
    props.visibleApps = { claude: true } as VisibleApps;
    render(<Sidebar {...props} />);
    fireEvent.change(searchInput(), { target: { value: "codex" } });
    expect(
      within(appList()).queryByRole("button", { name: "Codex" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "nav.noAppsFound:codex",
    );
  });

  it("restores all visible applications for whitespace-only input", () => {
    render(<Sidebar {...makeProps()} />);
    fireEvent.change(searchInput(), { target: { value: "   " } });
    expect(within(appList()).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears a no-match query with Escape or the clear button", () => {
    render(<Sidebar {...makeProps()} />);
    fireEvent.change(searchInput(), { target: { value: "not-an-app" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "nav.noAppsFound:not-an-app",
    );
    fireEvent.keyDown(searchInput(), { key: "Escape" });
    expect(searchInput()).toHaveValue("");
    expect(within(appList()).getAllByRole("button")).toHaveLength(3);
    fireEvent.change(searchInput(), { target: { value: "claude" } });
    fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
    expect(searchInput()).toHaveValue("");
    expect(searchInput()).toHaveFocus();
  });

  it("keeps all apps reachable while collapsed and restores the query on expansion", () => {
    const props = makeProps();
    const { rerender } = render(<Sidebar {...props} />);
    fireEvent.change(searchInput(), { target: { value: "codex" } });
    sidebar.collapsed = true;
    rerender(<Sidebar {...props} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(appList()).getAllByRole("button")).toHaveLength(3);
    sidebar.collapsed = false;
    rerender(<Sidebar {...props} />);
    expect(searchInput()).toHaveValue("codex");
    expect(within(appList()).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(appList()).getByRole("button", { name: "Codex" }));
    expect(props.onSelectApp).toHaveBeenCalledWith("codex");
  });

  it("does not report a failed search before a query is entered", () => {
    render(<Sidebar {...makeProps()} visibleApps={{} as VisibleApps} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
