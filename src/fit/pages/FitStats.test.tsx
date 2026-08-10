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
    expect(screen.getByText("跑步")).toBeInTheDocument();
    expect(screen.getByText("游泳")).toBeInTheDocument();
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
