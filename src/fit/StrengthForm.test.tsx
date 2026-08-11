// 编辑加载的日期回归需要稳定的时区,固定为 UTC+8(Windows Node 24 支持 TZ)
process.env.TZ = "Asia/Shanghai";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "./usePreferences";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import FitStrengthSession from "./pages/FitStrengthSession";
import { weightInputToKg } from "./units";
import { todayYmd } from "./dates";
import type { Workout } from "./types";

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
  },
}));

/** 链式 supabase mock:select/eq/order/update/delete/maybeSingle/single 返回 p 自身,await 解析为 resolveValue */
function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.limit = vi.fn().mockReturnValue(p);
  p.update = vi.fn().mockReturnValue(p);
  p.delete = vi.fn().mockReturnValue(p);
  p.insert = vi.fn().mockResolvedValue({ error: null });
  p.upsert = vi.fn().mockResolvedValue({ error: null });
  p.maybeSingle = vi.fn().mockReturnValue(p);
  p.single = vi.fn().mockReturnValue(p);
  return p;
}

/**
 * workouts 查询返回测试数据;user_preferences 查询返回 null(走默认单位 lb/yd/mi),
 * 避免同一链同时被两张表共用导致 prefs 被污染。
 */
/** workouts 返回测试数据;user_preferences 返回 null;user_exercises 返回 exChain(字典/登记断言用) */
function setupClient(workoutsResult: unknown, exResult = { data: [], error: null }) {
  const chain = buildChain(workoutsResult);
  const exChain = buildChain(exResult);
  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation((table: string) =>
    table === "user_preferences"
      ? buildChain({ data: null, error: null })
      : table === "user_exercises"
        ? exChain
        : chain,
  );
  return Object.assign(chain, { exChain });
}

const makeStrengthWorkout = (overrides: Partial<Workout>): Workout => ({
  id: "w1",
  user_id: TEST_USER.id,
  type: "strength",
  date: "2026-08-07T16:30:00Z", // UTC+8 本地为 2026-08-08 00:30
  notes: "腿部日",
  data: {
    session: true,
    exercise: "深蹲",
    weight_kg: 0,
    sets: 3,
    reps: 10,
    exercises: [
      {
        name: "深蹲",
        done: false,
        input_unit: "kg",
        sets: [
          { weight_kg: 100, reps: 10, bodyweight: false, done: false },
          { weight_kg: 100, reps: 10, bodyweight: false, done: false },
        ],
      },
      {
        name: "卧推",
        done: true,
        input_unit: "kg",
        sets: [{ weight_kg: 60, reps: 8, bodyweight: false, done: true }],
      },
    ],
  },
  created_at: "2026-08-07T16:30:00Z",
  updated_at: "2026-08-07T16:30:00Z",
  ...overrides,
});

/** FitStrengthSession 依赖 useOutletContext,需要一个带 Outlet 的布局壳 */
const TestLayout = ({ context }: { context: { onWorkoutSaved: () => void } }) => (
  <Outlet context={context} />
);

const renderSession = (path = "/fit/strength/session") => {
  const context = { onWorkoutSaved: vi.fn() };
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <PreferencesProvider>
          <Toaster />
          <Routes>
            <Route path="/fit" element={<TestLayout context={context} />}>
              <Route index element={<div>HISTORY_PLACEHOLDER</div>} />
              <Route path="strength/session" element={<FitStrengthSession />} />
            </Route>
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return context;
};

describe("StrengthForm (力量训练统一表单)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("创建:点预设动作 → 填重量 → 保存,insert 载荷含会话格式与兼容字段", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "深蹲" }));
    expect(screen.getByText("第 1 组")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("重量"), { target: { value: "60" } });
    fireEvent.change(screen.getByPlaceholderText("如 45"), { target: { value: "45" } });

    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER.id,
        type: "strength",
        notes: null,
        date: expect.any(String),
        data: expect.objectContaining({
          session: true,
          exercise: "深蹲",
          weight_kg: 0,
          sets: 1,
          reps: 10,
          duration_seconds: 2700,
          exercises: [
            {
              name: "深蹲",
              done: false,
              body_part: "legs", // 预设部位
              input_unit: "lb", // 默认偏好单位
              sets: [{ weight_kg: weightInputToKg(60, "lb"), reps: 10, bodyweight: false, done: false }],
            },
          ],
        }),
      }),
    );
    // 保存后导航回历史页
    expect(await screen.findByText("HISTORY_PLACEHOLDER")).toBeInTheDocument();
  });

  it("编辑:日期时间只读展示(含 UTC→本地回归),其余可改,update 载荷正确", async () => {
    const workout = makeStrengthWorkout({});
    const chain = setupClient({ data: workout, error: null });
    renderSession("/fit/strength/session?edit=w1");

    // 加载完成后动作名输入框出现
    expect(await screen.findByDisplayValue("深蹲")).toBeInTheDocument();
    expect(screen.getByDisplayValue("卧推")).toBeInTheDocument();

    // 日期时间以文本展示,且 2026-08-07T16:30:00Z 在 UTC+8 显示为本地 08-08 00:30(回归)
    expect(screen.getByText("2026-08-08")).toBeInTheDocument();
    expect(screen.getByText("00:30")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("2026-08-08")).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="time"]')).toBeNull();

    // 改名 + 加一组
    fireEvent.change(screen.getByDisplayValue("深蹲"), { target: { value: "深蹲改" } });
    fireEvent.click(screen.getAllByRole("button", { name: /添加一组/ })[0]);

    fireEvent.click(screen.getByRole("button", { name: /更新记录/ }));

    await waitFor(() => expect(chain.update).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-08-07T16:30:00.000Z", // 本地 08-08 00:30 的 UTC 表示,与加载值一致
        data: expect.objectContaining({
          session: true,
          exercises: expect.arrayContaining([
            expect.objectContaining({ name: "深蹲改" }),
            expect.objectContaining({ name: "卧推" }),
          ]),
        }),
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "w1");
  });

  it("复制:预填动作,日期=今天且可编辑,保存走 insert", async () => {
    const workout = makeStrengthWorkout({ date: "2026-08-01T08:00:00Z" });
    const chain = setupClient({ data: workout, error: null });
    renderSession("/fit/strength/session?copy=w1");

    expect(await screen.findByDisplayValue("深蹲")).toBeInTheDocument();
    expect(screen.getByDisplayValue("卧推")).toBeInTheDocument();

    // 日期是今天、可编辑(是 input 而非文本);时间也是 input
    expect(screen.getByDisplayValue(todayYmd())).toBeInTheDocument();
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement | null;
    expect(timeInput).not.toBeNull();
    expect(timeInput?.value).toMatch(/^\d{2}:\d{2}$/);

    fireEvent.change(screen.getByPlaceholderText("如 45"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).not.toHaveBeenCalled();
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "strength",
        data: expect.objectContaining({
          session: true,
          exercise: "综合力量训练", // 2 个动作 → 综合
          duration_seconds: 2700,
          exercises: expect.arrayContaining([
            expect.objectContaining({ name: "深蹲" }),
            expect.objectContaining({ name: "卧推" }),
          ]),
        }),
      }),
    );
  });

  it("校验:无动作时保存被拦截并提示", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    expect(await screen.findByText("请先添加至少一个动作")).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("校验:次数为 0 时保存被拦截并提示", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "深蹲" }));
    fireEvent.change(screen.getByPlaceholderText("次数"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    expect(await screen.findByText(/组次数必须大于 0/)).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("legacy 编辑:旧单动作格式转为会话格式展示与保存", async () => {
    const workout = makeStrengthWorkout({
      data: {
        exercise: "卧推",
        weight_kg: 60,
        sets: 3,
        reps: 8,
        bodyweight: false,
        input_unit: "kg",
      },
    });
    const chain = setupClient({ data: workout, error: null });
    renderSession("/fit/strength/session?edit=w1");

    // 重量以 kg 显示 60
    expect(await screen.findByDisplayValue("60")).toBeInTheDocument();
    expect(screen.getByDisplayValue("卧推")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /更新记录/ }));

    await waitFor(() => expect(chain.update).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          session: true,
          exercises: [
            {
              name: "卧推",
              done: false,
              body_part: "chest", // 预设部位
              input_unit: "kg",
              sets: [{ weight_kg: 60, reps: 8, bodyweight: false, done: false }],
            },
          ],
        }),
      }),
    );
  });

  it("未找到:记录不存在时提示并回到历史页", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession("/fit/strength/session?edit=missing");

    expect(await screen.findByText("记录不存在或无法加载")).toBeInTheDocument();
    expect(await screen.findByText("HISTORY_PLACEHOLDER")).toBeInTheDocument();
    expect(chain.update).not.toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("创建:填训练时长 → insert 载荷含 duration_seconds(分钟×60)", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "深蹲" }));
    fireEvent.change(screen.getByPlaceholderText("重量"), { target: { value: "60" } });
    fireEvent.change(screen.getByPlaceholderText("如 45"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duration_seconds: 2700 }),
      }),
    );
  });

  it("校验:创建不填训练时长 → 保存被拦截并提示", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "深蹲" }));
    fireEvent.change(screen.getByPlaceholderText("重量"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    expect(await screen.findByText("请填写训练时长")).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("校验:训练时长非法时保存被拦截并提示", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "深蹲" }));
    fireEvent.change(screen.getByPlaceholderText("重量"), { target: { value: "60" } });
    fireEvent.change(screen.getByPlaceholderText("如 45"), { target: { value: "-10" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    expect(await screen.findByText("训练时长无效")).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("编辑:有时长记录时只读显示分钟数", async () => {
    const workout = makeStrengthWorkout({
      data: {
        ...makeStrengthWorkout({}).data,
        duration_seconds: 2700,
      },
    });
    const chain = setupClient({ data: workout, error: null });
    renderSession("/fit/strength/session?edit=w1");

    expect(await screen.findByText("45 分钟")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("如 45")).toBeNull(); // 只读,非输入框
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("引体向上快捷添加 → 组默认 BW 与次数 10,无需再点 BW", async () => {
    setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "引体向上" }));

    const weightInput = screen.getByPlaceholderText("重量") as HTMLInputElement;
    expect(weightInput).toBeDisabled();
    expect(weightInput.value).toBe("BW");
    expect((screen.getByPlaceholderText("次数") as HTMLInputElement).value).toBe("10");
  });

  it("常用动作来自历史频率(非预设动作也出现)", async () => {
    setupClient({
      data: [
        makeStrengthWorkout({
          data: {
            session: true,
            exercise: "",
            weight_kg: 0,
            sets: 1,
            reps: 10,
            exercises: [{ name: "深蹲拉雪橇", done: false, sets: [] }],
          },
        }),
      ],
      error: null,
    });
    renderSession();

    expect(await screen.findByRole("button", { name: "深蹲拉雪橇" })).toBeInTheDocument();
  });

  it("更多动作下拉:搜索「弯举」并添加", async () => {
    setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: /更多动作/ }));
    fireEvent.change(screen.getByPlaceholderText("搜索动作"), { target: { value: "弯举" } });
    fireEvent.click(screen.getByRole("button", { name: /二头弯举/ }));

    expect(screen.getByDisplayValue("二头弯举")).toBeInTheDocument();
  });

  it("保存训练 → 动作登记进字典(upsert 带部位与默认设置)", async () => {
    const chain = setupClient({ data: null, error: null });
    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "引体向上" }));
    fireEvent.change(screen.getByPlaceholderText("如 45"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /完成训练/ }));

    await waitFor(() => expect(chain.exChain.upsert).toHaveBeenCalled(), { timeout: 2000 });
    const upsert = chain.exChain.upsert as unknown as ReturnType<typeof vi.fn>;
    const rows = upsert.mock.calls[0][0] as Array<{
      name: string;
      body_part: string;
      bodyweight_default: boolean;
      default_reps: number;
    }>;
    expect(rows).toEqual([
      expect.objectContaining({ name: "引体向上", body_part: "back", bodyweight_default: true, default_reps: 10 }),
    ]);
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id,name" });
  });
});
