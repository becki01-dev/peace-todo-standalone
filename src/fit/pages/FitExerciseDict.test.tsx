// 动作字典独立编辑入口测试:admin 门禁、新增/编辑/删除、校验(空键/大写/重复)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { ExerciseDictProvider } from "../useExerciseDict";
import { supabase } from "@/integrations/supabase/client";
import { FIXTURE_DICT_ROWS } from "../testDict.fixture";
import { Toaster } from "@/components/ui/sonner";
import FitExerciseDict from "./FitExerciseDict";

const { TEST_USER, ADMIN_USER, state } = vi.hoisted(() => {
  const state: { user: { id: string; email: string } } = {
    user: { id: "user-1", email: "tester@example.com" },
  };
  return {
    TEST_USER: { id: "user-1", email: "tester@example.com" },
    ADMIN_USER: { id: "user-2", email: "becki01@gmail.com" },
    state,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        cb("INITIAL_SESSION", { user: state.user });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: state.user } } })),
    },
    from: vi.fn(),
  },
}));

interface Row {
  id: string;
  kind: string;
  key: string;
  value: string;
}

/**
 * 有状态字典 mock:select 在 await 时返回当前 store 快照(供 Provider 加载/refresh),
 * upsert/update/delete 实时修改 store,便于断言「保存后列表刷新」。
 */
function setupDictClient(initial: Row[] = FIXTURE_DICT_ROWS.map((r) => ({ ...r }))) {
  const store: { rows: Row[] } = { rows: initial };
  let pendingOp: { type: "delete" | "update"; payload?: Partial<Row> } | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = {
    then(resolve: (v: unknown) => void) {
      resolve({ data: store.rows.map((r) => ({ ...r })), error: null });
      return undefined;
    },
  };
  p.select = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.limit = vi.fn().mockReturnValue(p);
  p.upsert = vi.fn(async (payload: Row) => {
    const idx = store.rows.findIndex(
      (r) => r.kind === payload.kind && r.key.toLowerCase() === payload.key.toLowerCase(),
    );
    if (idx >= 0) Object.assign(store.rows[idx], payload);
    else store.rows.push({ id: `id-${store.rows.length + 1}`, ...payload });
    return { error: null };
  });
  p.update = vi.fn((payload: Partial<Row>) => {
    pendingOp = { type: "update", payload };
    return p;
  });
  p.delete = vi.fn(() => {
    pendingOp = { type: "delete" };
    return p;
  });
  p.eq = vi.fn((col: string, val: string) => {
    if (pendingOp && col === "id") {
      const idx = store.rows.findIndex((r) => r.id === val);
      if (idx >= 0) {
        if (pendingOp.type === "delete") store.rows.splice(idx, 1);
        else Object.assign(store.rows[idx], pendingOp.payload);
      }
      pendingOp = null;
    }
    return p;
  });

  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation((table: string) => (table === "exercise_dictionary" ? p : p));

  return p;
}

const renderPage = () =>
  render(
    <AuthProvider>
      <ExerciseDictProvider>
        <Toaster />
        <FitExerciseDict />
      </ExerciseDictProvider>
    </AuthProvider>,
  );

describe("FitExerciseDict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = TEST_USER;
  });

  it("非管理员只读:显示提示,无新增/编辑/删除按钮", async () => {
    setupDictClient();
    renderPage();
    expect(await screen.findByText("仅管理员可编辑")).toBeInTheDocument();
    // 默认 alias 栏有条目
    expect(await screen.findByText("squat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "编辑 squat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "删除 squat" })).toBeNull();
  });

  it("管理员可编辑:显示新增按钮与三种类型分栏", async () => {
    state.user = ADMIN_USER;
    setupDictClient();
    renderPage();
    expect(await screen.findByRole("button", { name: /新增/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /英文别名/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /中文显示英文/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /中文变体/ })).toBeInTheDocument();
  });

  it("新增条目 → upsert 载荷正确,保存后列表出现新条目", async () => {
    state.user = ADMIN_USER;
    const chain = setupDictClient();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /新增/ }));
    fireEvent.change(screen.getByLabelText("键"), { target: { value: "bulgarian split squat" } });
    fireEvent.change(screen.getByLabelText("值"), { target: { value: "保加利亚分腿蹲" } });
    fireEvent.click(screen.getByRole("button", { name: "新增条目" }));

    await waitFor(() => expect(chain.upsert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.upsert).toHaveBeenCalledWith(
      { kind: "alias", key: "bulgarian split squat", value: "保加利亚分腿蹲" },
      { onConflict: "kind,key" },
    );
    expect(await screen.findByText(/保加利亚分腿蹲/)).toBeInTheDocument();
  });

  it("编辑条目(改键)→ update().eq(id),旧行不残留", async () => {
    state.user = ADMIN_USER;
    const chain = setupDictClient();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "编辑 squat" }));
    const keyInput = screen.getByLabelText("键") as HTMLInputElement;
    expect(keyInput.value).toBe("squat");
    fireEvent.change(keyInput, { target: { value: "deep squat" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(chain.update).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).toHaveBeenCalledWith({ key: "deep squat", value: "深蹲" });
    expect(chain.eq).toHaveBeenCalledWith("id", "f-squat");
    // 刷新后旧键消失、新键出现
    await waitFor(() => expect(screen.queryByText("squat")).toBeNull(), { timeout: 2000 });
    expect(await screen.findByText("deep squat")).toBeInTheDocument();
  });

  it("删除条目 → 两步确认后 delete().eq(id),列表移除", async () => {
    state.user = ADMIN_USER;
    const chain = setupDictClient();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "删除 squat" }));
    expect(screen.getByRole("button", { name: "确认删除" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(chain.delete).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.eq).toHaveBeenCalledWith("id", "f-squat");
    await waitFor(() => expect(screen.queryByText("squat")).toBeNull(), { timeout: 2000 });
  });

  it("校验:空键 / 别名大写 / 重复键 被拦截且不调用 upsert", async () => {
    state.user = ADMIN_USER;
    const chain = setupDictClient();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /新增/ }));
    const submit = () => screen.getByRole("button", { name: "新增条目" });

    // 空键
    fireEvent.click(submit());
    expect(await screen.findByText("键不能为空")).toBeInTheDocument();

    // 大写别名键
    fireEvent.change(screen.getByLabelText("键"), { target: { value: "Squat" } });
    fireEvent.change(screen.getByLabelText("值"), { target: { value: "深蹲" } });
    fireEvent.click(submit());
    expect(await screen.findByText("英文别名键必须全小写(字母/数字/空格/连字符)")).toBeInTheDocument();

    // 重复键(与 fixture 的 squat→深蹲 冲突)
    fireEvent.change(screen.getByLabelText("键"), { target: { value: "squat" } });
    fireEvent.change(screen.getByLabelText("值"), { target: { value: "深蹲" } });
    fireEvent.click(submit());
    expect(await screen.findByText(/已存在/)).toBeInTheDocument();

    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("分栏切换:en 栏显示中文显示英文条目,搜索过滤生效", async () => {
    state.user = ADMIN_USER;
    setupDictClient();
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: /中文显示英文/ }));
    expect(await screen.findByText("腿弯举")).toBeInTheDocument();
    expect(screen.getByText("→ Leg Curl")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索键或值"), { target: { value: "yoga" } });
    expect(screen.queryByText("腿弯举")).toBeNull();
    expect(screen.getByText("瑜伽")).toBeInTheDocument();
  });
});
