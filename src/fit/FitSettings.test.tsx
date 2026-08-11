import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "./usePreferences";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import FitSettings from "./pages/FitSettings";
import { todayYmd } from "./dates";

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
  p.upsert = vi.fn().mockReturnValue(p);
  p.delete = vi.fn().mockReturnValue(p);
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

describe("FitSettings 体重输入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("填写体重 → 失焦按当前单位换算为 kg 保存,并写入今日体重历史", async () => {
    const chain = setupClient();
    renderSettings();

    const input = screen.getByLabelText("体重") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "154.3234" } });
    fireEvent.blur(input);

    await waitFor(() => expect(chain.upsert).toHaveBeenCalledTimes(2), { timeout: 2000 });
    const calls = (chain.upsert as unknown as ReturnType<typeof vi.fn>).mock.calls;
    // 1) 偏好:默认单位 lb,70×2.20462=154.3234 lb → 70 kg
    const prefsPayload = calls[0][0] as { body_weight_kg: number };
    expect(prefsPayload.body_weight_kg).toBeCloseTo(70, 5);
    // 2) 体重历史:今日一条记录,同日 upsert(onConflict 防重复)
    const historyPayload = calls[1][0] as { user_id: string; date: string; weight_kg: number };
    expect(historyPayload).toMatchObject({ user_id: TEST_USER.id, date: todayYmd() });
    expect(historyPayload.weight_kg).toBeCloseTo(70, 5);
    expect(calls[1][1]).toEqual({ onConflict: "user_id,date" });
  });

  it("清空体重 → 偏好置 null,并删除今日体重历史", async () => {
    const chain = setupClient();
    renderSettings();

    const input = screen.getByLabelText("体重") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => expect(chain.upsert).toHaveBeenCalled(), { timeout: 2000 });
    const payload = (chain.upsert as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as { body_weight_kg: number | null };
    expect(payload.body_weight_kg).toBeNull();
    await waitFor(() => expect(chain.delete).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("无效体重(≤0)→ 不保存", () => {
    const chain = setupClient();
    renderSettings();

    const input = screen.getByLabelText("体重") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(chain.upsert).not.toHaveBeenCalled();
  });
});
