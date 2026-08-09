// 对话框集成测试:创建/编辑/复制三种非力量类型 + 校验路径
// 日期断言依赖本地时区,固定为 UTC+8(Windows Node 24 支持 TZ)
process.env.TZ = "Asia/Shanghai";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "./usePreferences";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkoutDialog } from "./WorkoutDialog";
import { distanceInputToMeters, poolInputToMeters } from "./units";
import { todayYmd } from "./dates";
import type { ComponentProps } from "react";
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

/** 链式 supabase mock:select/eq/update/delete/insert 等,await 解析为 resolveValue */
function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.update = vi.fn().mockReturnValue(p);
  p.delete = vi.fn().mockReturnValue(p);
  p.insert = vi.fn().mockResolvedValue({ error: null });
  p.maybeSingle = vi.fn().mockReturnValue(p);
  p.single = vi.fn().mockReturnValue(p);
  return p;
}

/**
 * user_preferences 查询返回 null(走默认单位 mi/yd),workouts 链用于断言 insert/update。
 * 对话框本身不查询 workouts,链的 resolveValue 仅需符合 await 语义。
 */
function setupClient() {
  const chain = buildChain({ data: null, error: null });
  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation((table: string) =>
    table === "user_preferences" ? buildChain({ data: null, error: null }) : chain,
  );
  return chain;
}

const makeRunningWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: "w1",
  user_id: TEST_USER.id,
  type: "running",
  date: "2026-08-07T04:00:00Z", // UTC+8 本地 2026-08-07 12:00
  notes: "晨跑",
  data: { distance_meters: 5000, duration_seconds: 1800, mood: 4, input_unit: "km" },
  created_at: "2026-08-07T04:00:00Z",
  updated_at: "2026-08-07T04:00:00Z",
  ...overrides,
});

/** 本地 ymd+hm → ISO 字符串,与对话框提交逻辑一致 */
const isoOf = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00`).toISOString();

type DialogProps = ComponentProps<typeof WorkoutDialog>;

const renderDialog = (props: Partial<DialogProps> = {}) => {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const onSaved = props.onSaved ?? vi.fn();
  render(
    <MemoryRouter initialEntries={["/fit"]}>
      <AuthProvider>
        <PreferencesProvider>
          <Toaster />
          <Routes>
            <Route path="/fit" element={<div>FIT_PLACEHOLDER</div>} />
            <Route path="/fit/strength/session" element={<div>SESSION_PLACEHOLDER</div>} />
          </Routes>
          <WorkoutDialog open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { onOpenChange, onSaved };
};

/** 距离输入没有 placeholder,按 Label 文本定位所在字段容器 */
const fieldInput = (label: string) => within(screen.getByText(label).closest("div")!).getByRole("textbox");

describe("WorkoutDialog (跑步/游泳/专项游泳组)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("跑步创建:填距离和时长 → 保存,insert 载荷含公制换算与输入单位", async () => {
    const chain = setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "跑步" }));
    fireEvent.change(fieldInput("距离"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("分"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER.id,
        type: "running",
        notes: null,
        date: isoOf(todayYmd(), "12:00"), // 对话框初始时间 12:00
        data: {
          distance_meters: distanceInputToMeters(5, "mi"), // 默认偏好单位 mi
          duration_seconds: 1800,
          mood: 3,
          input_unit: "mi",
        },
      }),
    );
  });

  it("游泳创建:添加片段 → 保存,insert 载荷为多片段格式", async () => {
    const chain = setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "游泳" }));
    // 片段默认:自由泳 / 25yd / 40 圈,填片段时长 10 分
    fireEvent.change(screen.getByPlaceholderText("分"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "添加片段" }));
    expect(await screen.findByText("当前汇总 (1 个片段)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    const poolLengthMeters = poolInputToMeters(25, "yd"); // 默认偏好单位 yd
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "swimming",
        data: {
          sets: [
            {
              pool_length_meters: poolLengthMeters,
              laps: 40,
              stroke: "自由泳",
              duration_seconds: 600,
              input_unit: "yd",
            },
          ],
          total_distance_meters: poolLengthMeters * 40,
          total_duration_seconds: 600,
          mood: 3,
        },
      }),
    );
  });

  it("专项游泳组创建:添加训练组并填全 → 保存,insert 载荷含汇总", async () => {
    const chain = setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "专项游泳组" }));
    fireEvent.click(screen.getByRole("button", { name: "添加训练组" }));
    fireEvent.change(screen.getByPlaceholderText("如: 3"), { target: { value: "3" } }); // 组数
    fireEvent.change(screen.getByPlaceholderText("如: 10"), { target: { value: "10" } }); // 每组个数
    fireEvent.change(screen.getByPlaceholderText("如: 27"), { target: { value: "27" } }); // 实际完成
    fireEvent.click(screen.getByRole("button", { name: "50m" })); // 长度预设
    fireEvent.change(screen.getByPlaceholderText("分"), { target: { value: "2" } }); // 要求时间
    fireEvent.change(screen.getByPlaceholderText("秒"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "swimming_set",
        data: {
          sets: [
            {
              sets_count: 3,
              count_per_set: 10,
              length_meters: 50,
              stroke: "自由泳",
              target_time_seconds: 150,
              completed_count: 27,
              input_unit: "m",
            },
          ],
          total_required_count: 30,
          total_completed_count: 27,
          completion_rate: 90,
          input_unit: "m",
        },
      }),
    );
  });

  it("跑步编辑:表单预填(日期/距离/时长/心情),改动后 update 载荷与 id 过滤正确", async () => {
    const chain = setupClient();
    renderDialog({ editingWorkout: makeRunningWorkout() });

    // 预填:距离 5.00km、时长 30 分、日期 2026-08-07、时间 12:00(UTC→本地回归)
    expect(await screen.findByDisplayValue("5.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-07")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12:00")).toBeInTheDocument();

    fireEvent.change(fieldInput("距离"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "更新记录" }));

    await waitFor(() => expect(chain.update).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "running",
        notes: "晨跑",
        date: "2026-08-07T04:00:00.000Z", // 本地 12:00 的 UTC 表示,与加载值一致
        data: {
          distance_meters: distanceInputToMeters(6, "km"),
          duration_seconds: 1800,
          mood: 4,
          input_unit: "km",
        },
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "w1");
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("跑步复制:日期重置为今天,保存走 insert 且 update 不调用", async () => {
    const chain = setupClient();
    renderDialog({ copyingWorkout: makeRunningWorkout({ date: "2026-08-01T08:00:00Z" }) });

    expect(await screen.findByDisplayValue(todayYmd())).toBeInTheDocument();
    expect(screen.getByDisplayValue("16:00")).toBeInTheDocument(); // 08:00Z → UTC+8 16:00
    expect(screen.getByRole("button", { name: "保存副本" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存副本" }));

    await waitFor(() => expect(chain.insert).toHaveBeenCalled(), { timeout: 2000 });
    expect(chain.update).not.toHaveBeenCalled();
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "running",
        date: isoOf(todayYmd(), "16:00"),
        data: expect.objectContaining({ input_unit: "km" }),
      }),
    );
  });

  it("校验:跑步缺时长时保存被拦截并提示", async () => {
    const chain = setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "跑步" }));
    fireEvent.change(fieldInput("距离"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));

    expect(await screen.findByText("请填写距离和时长")).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("校验:游泳无片段时保存被拦截并提示", async () => {
    const chain = setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "游泳" }));
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));

    expect(await screen.findByText("请至少添加一个游泳片段")).toBeInTheDocument();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("返回后重新选择类型:子表单状态已重置(修复训练组残留)", async () => {
    setupClient();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "专项游泳组" }));
    fireEvent.click(screen.getByRole("button", { name: "添加训练组" }));
    expect(screen.getByText("训练组 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(screen.getByRole("button", { name: "专项游泳组" }));

    expect(screen.queryByText("训练组 1")).toBeNull();
    expect(screen.getByRole("button", { name: "添加训练组" })).toBeInTheDocument();
  });

  it("力量训练入口:关闭对话框并跳转会话页", async () => {
    setupClient();
    const { onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "力量训练" }));

    expect(await screen.findByText("SESSION_PLACEHOLDER")).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
