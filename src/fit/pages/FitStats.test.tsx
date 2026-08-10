// 统计页集成测试:覆盖 跑步/游泳(新旧格式)/专项游泳组 的统计口径 + 范围过滤
// 日期用相对 now 生成,避免固定日期受范围过滤影响;偏好单位固定 km/kg/m,断言数字更直观
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "../usePreferences";
import { supabase } from "@/integrations/supabase/client";
import FitStats from "./FitStats";
import type { Workout } from "../types";

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

/** 链式 supabase mock:select/eq/order/maybeSingle 等,await 解析为 resolveValue */
function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.maybeSingle = vi.fn().mockReturnValue(p);
  return p;
}

/** user_preferences 返回 km/kg/m;workouts 返回给定列表 */
function setupClient(workouts: Workout[]) {
  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation((table: string) =>
    table === "user_preferences"
      ? buildChain({ data: { user_id: TEST_USER.id, distance_unit: "km", weight_unit: "kg", pool_unit: "m" }, error: null })
      : buildChain({ data: workouts, error: null }),
  );
}

/** 相对现在的日期(本地时区),保证落在过滤窗口内/外 */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

/** 相对现在的本地 ymd(用于填自定义区间输入) */
const daysAgoYmd = (days: number) => {
  const d = new Date(Date.now() - days * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 自定义区间的日期输入(Label 与 Input 无 htmlFor 关联,按文本定位所在容器;jsdom 中 date input 无 textbox role) */
const dateInput = (label: string) =>
  screen.getByText(label).closest("div")!.querySelector('input[type="date"]') as HTMLInputElement;

let seq = 0;
const makeWorkout = (overrides: Partial<Workout> & Pick<Workout, "type" | "data">): Workout => {
  seq += 1;
  return {
    id: `w${seq}`,
    user_id: TEST_USER.id,
    type: "running",
    date: daysAgo(2),
    notes: null,
    data: { distance_meters: 0, duration_seconds: 0, mood: 3 },
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    ...overrides,
  };
};

const renderStats = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <FitStats />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

describe("FitStats 统计页", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("多片段游泳:距离/时长/卡路里按汇总字段统计", async () => {
    setupClient([
      makeWorkout({
        type: "swimming",
        data: {
          sets: [{ pool_length_meters: 25, laps: 40, stroke: "自由泳", duration_seconds: 600, input_unit: "m" }],
          total_distance_meters: 1000,
          total_duration_seconds: 600,
          mood: 3,
        },
      }),
    ]);
    renderStats();

    expect(await screen.findByText("1 km")).toBeInTheDocument();
    expect(screen.getByText("10m 0s")).toBeInTheDocument();
    expect(screen.getByText("90 kcal")).toBeInTheDocument();
    expect(screen.getByText("游泳")).toBeInTheDocument();
    expect(screen.getByText("1 次")).toBeInTheDocument();
  });

  it("专项游泳组:计入次数/距离,时长与卡路里按要求时间估算,分布不丢", async () => {
    setupClient([
      makeWorkout({
        type: "swimming_set",
        data: {
          sets: [
            { sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150, completed_count: 27, input_unit: "m" },
          ],
          total_required_count: 30,
          total_completed_count: 27,
          completion_rate: 90,
          input_unit: "m",
        },
      }),
    ]);
    renderStats();

    // 距离 27×50 = 1350m → 1.35 km;时长 27/10×150 = 405s;kcal 405/60×9 = 60.75 → 61
    expect(await screen.findByText("1.35 km")).toBeInTheDocument();
    expect(screen.getByText("6m 45s")).toBeInTheDocument();
    expect(screen.getByText("61 kcal")).toBeInTheDocument();
    expect(screen.getByText("专项组")).toBeInTheDocument();
    expect(screen.getByText("1 次")).toBeInTheDocument();
  });

  it("旧格式单条游泳与跑步:统计口径不变", async () => {
    setupClient([
      makeWorkout({ type: "running", data: { distance_meters: 5000, duration_seconds: 1800, mood: 4, input_unit: "km" } }),
      makeWorkout({
        type: "swimming",
        data: { distance_meters: 1000, pool_length_meters: 25, laps: 40, stroke: "自由泳", mood: 3, duration_seconds: 600, input_unit: "m" },
      }),
    ]);
    renderStats();

    // 距离 6 km、时长 40m 0s、kcal 325 + 90 = 415
    expect(await screen.findByText("6 km")).toBeInTheDocument();
    expect(screen.getByText("40m 0s")).toBeInTheDocument();
    expect(screen.getByText("415 kcal")).toBeInTheDocument();
    // 两条线非空 → 折线图例出现,与分布行文本重复,取首个即可
    expect(screen.getAllByText("跑步")[0]).toBeInTheDocument();
    expect(screen.getAllByText("游泳")[0]).toBeInTheDocument();
  });

  it("范围过滤:10 天前的记录本周不显示,切到近30天出现", async () => {
    setupClient([
      makeWorkout({
        type: "running",
        date: daysAgo(10),
        data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" },
      }),
    ]);
    renderStats();

    expect(await screen.findByText("此时段还没有数据")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "近30天" }));
    expect(await screen.findByText("5 km")).toBeInTheDocument();
  });
});

// ===== 增强:自定义区间 / 环比对比 / 类型筛选 =====
// 断言用正则(/vs 上周/ 等),因为 delta 文本是 value + label 合并在一个节点里
describe("FitStats 增强:自定义区间 / 环比 / 类型筛选", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("自定义区间:闭区间含起止当天,改结束日期后范围收缩", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "swimming", date: daysAgo(4), data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } }),
      makeWorkout({ type: "running", date: daysAgo(10), data: { distance_meters: 7000, duration_seconds: 3600, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    fireEvent.click(screen.getByRole("tab", { name: "自定义" }));
    fireEvent.change(dateInput("起始"), { target: { value: daysAgoYmd(5) } });
    fireEvent.change(dateInput("结束"), { target: { value: daysAgoYmd(1) } });

    // [今-5, 今-1] 闭区间:2天前 + 4天前在内,10天前排除 → 6 km
    expect(await screen.findByText("6 km")).toBeInTheDocument();
    expect(screen.getByText("40m 0s")).toBeInTheDocument();

    fireEvent.change(dateInput("结束"), { target: { value: daysAgoYmd(3) } });
    // [今-5, 今-3]:只剩 4 天前 → 1 km
    expect(await screen.findByText("1 km")).toBeInTheDocument();
  });

  it("环比:本周 vs 上周 四指标百分比正确(含重复值计数)", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "running", date: daysAgo(8), data: { distance_meters: 2000, duration_seconds: 600, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    // 本周 1 次 vs 上周 1 次:count 0%;距离 5000 vs 2000 → +150%;时长 1800 vs 600 → +200%;kcal 325 vs 130 → +150%
    expect(await screen.findByText("5 km")).toBeInTheDocument();
    expect(screen.getAllByText(/vs 上周/)).toHaveLength(4);
    expect(screen.getAllByText(/\+150%/)).toHaveLength(2); // 距离与卡路里同为 +150%
    expect(screen.getByText(/\+200%/)).toBeInTheDocument();
    expect(screen.getAllByText(/0% vs 上周/).length).toBeGreaterThan(0); // 次数 1 vs 1
  });

  it("环比 0 基线:上周无数据时 delta 显示占位", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    expect(await screen.findByText("5 km")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("类型筛选:点击分布行只看该类型,再点还原;分布计数不受筛选影响", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "swimming", date: daysAgo(2), data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } }),
    ]);
    renderStats();

    expect(await screen.findByText("6 km")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "筛选跑步" }));
    expect(screen.getByRole("button", { name: "筛选跑步" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("5 km")).toBeInTheDocument(); // 只剩跑步
    expect(screen.getByText("325 kcal")).toBeInTheDocument();
    expect(screen.getAllByText("1 次")).toHaveLength(2); // 分布行计数不变(跑步+游泳)

    fireEvent.click(screen.getByRole("button", { name: "筛选跑步" }));
    expect(screen.getByRole("button", { name: "筛选跑步" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("6 km")).toBeInTheDocument(); // 还原
  });

  it("类型筛空:分布卡片常显,提示该类型暂无数据", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    expect(await screen.findByText("5 km")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "筛选游泳" }));
    expect(screen.getByText("该类型此时段暂无数据")).toBeInTheDocument();
    expect(screen.getByText("跑步")).toBeInTheDocument(); // 分布卡片仍显示
    expect(screen.getByText("1 次")).toBeInTheDocument();
  });

  it("止<起:显示校验提示与空态", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    fireEvent.click(screen.getByRole("tab", { name: "自定义" }));
    fireEvent.change(dateInput("起始"), { target: { value: daysAgoYmd(3) } });
    fireEvent.change(dateInput("结束"), { target: { value: daysAgoYmd(5) } });

    expect(await screen.findByText("开始日期需早于或等于结束日期")).toBeInTheDocument();
    expect(screen.getByText("请调整起止日期")).toBeInTheDocument();
  });

  it("切自定义档默认显示近 7 天", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "running", date: daysAgo(10), data: { distance_meters: 9000, duration_seconds: 3600, mood: 3, input_unit: "km" } }),
    ]);
    renderStats();

    fireEvent.click(screen.getByRole("tab", { name: "自定义" }));
    expect(await screen.findByText("5 km")).toBeInTheDocument();
    expect(screen.queryByText("9 km")).not.toBeInTheDocument();
  });
});

// ===== 分项指标折线图 =====
describe("FitStats 分项指标折线图", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无筛选:距离卡两线(跑步+游泳),重量卡一线,双线有图例", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "swimming", date: daysAgo(2), data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } }),
      makeWorkout({ type: "strength", date: daysAgo(2), data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } }),
    ]);
    renderStats();

    expect(await screen.findByText("每日训练距离 (km)")).toBeInTheDocument();
    expect(screen.getByText("每日训练重量 (kg)")).toBeInTheDocument();

    const dist = screen.getByRole("img", { name: "每日训练距离趋势" });
    expect(dist.querySelector('[data-testid="line-running"]')).not.toBeNull();
    expect(dist.querySelector('[data-testid="line-swimming"]')).not.toBeNull();
    expect(dist.querySelectorAll("polyline")).toHaveLength(2);
    expect(dist.querySelector('[data-testid="line-running"]')!.getAttribute("points")!.split(/\s+/)).toHaveLength(7); // 本周 7 桶

    const weight = screen.getByRole("img", { name: "每日训练总重量趋势" });
    expect(weight.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("筛选联动:筛跑步 → 距离卡单线、重量卡空态;筛力量 → 反之", async () => {
    setupClient([
      makeWorkout({ type: "running", date: daysAgo(2), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3, input_unit: "km" } }),
      makeWorkout({ type: "strength", date: daysAgo(2), data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } }),
    ]);
    renderStats();

    expect(await screen.findByText("每日训练距离 (km)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "筛选跑步" }));
    expect(screen.getByRole("img", { name: "每日训练距离趋势" }).querySelectorAll("polyline")).toHaveLength(1);
    expect(screen.getByText("暂无重量数据")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "筛选跑步" })); // 还原
    fireEvent.click(screen.getByRole("button", { name: "筛选力量" }));
    expect(screen.getByText("暂无距离数据")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "每日训练总重量趋势" }).querySelectorAll("polyline")).toHaveLength(1);
  });

  it("专项组距离并入游泳线:无跑线", async () => {
    setupClient([
      makeWorkout({
        type: "swimming_set",
        date: daysAgo(2),
        data: {
          sets: [{ sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150, completed_count: 27, input_unit: "m" }],
          total_required_count: 30,
          total_completed_count: 27,
          completion_rate: 90,
          input_unit: "m",
        },
      }),
    ]);
    renderStats();

    expect(await screen.findByText("每日训练距离 (km)")).toBeInTheDocument();
    const dist = screen.getByRole("img", { name: "每日训练距离趋势" });
    expect(dist.querySelector('[data-testid="line-swimming"]')).not.toBeNull();
    expect(dist.querySelector('[data-testid="line-running"]')).toBeNull();
  });

  it("单类型(仅力量):距离卡空态、重量卡单线、无图例", async () => {
    setupClient([
      makeWorkout({ type: "strength", date: daysAgo(2), data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } }),
    ]);
    renderStats();

    expect(await screen.findByText("暂无距离数据")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "每日训练总重量趋势" }).querySelectorAll("polyline")).toHaveLength(1);
    expect(screen.queryByRole("img", { name: "每日训练距离趋势" })).toBeNull();
  });
});
