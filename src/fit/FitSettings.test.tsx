import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "./usePreferences";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import FitSettings from "./pages/FitSettings";

const { TEST_USER } = vi.hoisted(() => ({
  TEST_USER: { id: "user-1", email: "tester@example.com" },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        cb("INITIAL_SESSION", { user: TEST_USER });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: TEST_USER } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.maybeSingle = vi.fn().mockReturnValue(p);
  return p;
}

const setupClient = () => {
  const chain = buildChain({ data: null, error: null });
  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation(() => chain);
  return chain;
};

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={["/fit/settings"]}>
      <AuthProvider>
        <PreferencesProvider>
          <Toaster />
          <Routes>
            <Route path="/fit/settings" element={<FitSettings />} />
            <Route path="/auth" element={<div>AUTH_PLACEHOLDER</div>} />
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

describe("FitSettings 账号删除", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null });
  });

  it("确认后调用 delete_account RPC 并登出跳转登录页", async () => {
    setupClient();
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /删除账号/ }));
    expect(screen.getByText(/确定要删除账号吗/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /确认删除/ }));

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("delete_account"), { timeout: 2000 });
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(await screen.findByText("AUTH_PLACEHOLDER")).toBeInTheDocument();
  });

  it("取消时不调用 RPC", () => {
    setupClient();
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /删除账号/ }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText(/确定要删除账号吗/)).not.toBeInTheDocument();
  });

  it("RPC 失败时提示错误并回到可重试状态", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { message: "rpc not found" } });
    setupClient();
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /删除账号/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认删除/ }));

    expect(await screen.findByText("rpc not found")).toBeInTheDocument();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    // 确认面板收起,按钮回到初始态
    expect(screen.queryByText(/确定要删除账号吗/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /删除账号/ })).toBeInTheDocument();
  });
});
