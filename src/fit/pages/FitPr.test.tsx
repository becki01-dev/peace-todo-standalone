// 动作纪录(PR)页测试:默认选中频率最高动作、1RM/最佳组/突破历史展示、搜索过滤、动作切换、自重无体重提示
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "../usePreferences";
import { supabase } from "@/integrations/supabase/client";
import FitPr from "./FitPr";
import type { Workout } from "../types";
import type { BodyWeightRecord } from "../stats";
import type { UserExercise } from "../exerciseLib";

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

function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 是 promise+chain 混合对象
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.maybeSingle = vi.fn().mockReturnValue(p);
  p.upsert = vi.fn().mockReturnValue(p);
  return p;
}

function setupClient(
  workouts: Workout[],
  weightHistory: BodyWeightRecord[] = [],
  exerciseDict: UserExercise[] = [],
  bodyWeightKg: number | null = null,
) {
  (
    supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    }
  ).mockImplementation((table: string) =>
    table === "user_preferences"
      ? buildChain({
          data: { user_id: TEST_USER.id, distance_unit: "km", weight_unit: "kg", pool_unit: "m", body_weight_kg: bodyWeightKg },
          error: null,
        })
      : table === "body_weight_history"
        ? buildChain({ data: weightHistory, error: null })
        : table === "user_exercises"
          ? buildChain({ data: exerciseDict, error: null })
          : buildChain({ data: workouts, error: null }),
  );
}

const strength = (date: string, name: string, weightKg: number, reps: number, times = 1): Workout => ({
  id: `${date}-${name}-${weightKg}`,
  user_id: TEST_USER.id,
  type: "strength",
  date,
  notes: null,
  data: {
    session: true,
    exercise: "",
    weight_kg: 0,
    sets: 1,
    reps: 10,
    exercises: [
      {
        name,
        sets: Array.from({ length: times }, () => ({ weight_kg: weightKg, reps, bodyweight: false, done: false })),
      },
    ],
  },
  created_at: date,
  updated_at: date,
});

const renderPr = (workouts: Workout[], opts: { weightHistory?: BodyWeightRecord[]; exerciseDict?: UserExercise[]; bodyWeightKg?: number | null } = {}) =>
  render(
    <AuthProvider>
      <PreferencesProvider>
        <MemoryRouter>
          <FitPr workouts={workouts} loading={false} />
        </MemoryRouter>
      </PreferencesProvider>
    </AuthProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FitPr", () => {
  it("无训练时显示空态", () => {
    setupClient([]);
    renderPr([]);
    expect(screen.getByText(/汗水不会骗你/)).toBeTruthy();
  });

  it("默认选中频率最高动作,展示当前 1RM、最佳组、突破历史与趋势", async () => {
    const workouts = [
      strength("2026-08-01T04:00:00Z", "深蹲", 100, 5),
      strength("2026-08-09T04:00:00Z", "深蹲", 110, 5),
      strength("2026-08-13T04:00:00Z", "深蹲", 120, 3),
      strength("2026-08-05T04:00:00Z", "卧推", 60, 10),
    ];
    setupClient(workouts);
    renderPr(workouts);
    // 深蹲出现 3 次频率最高 → 默认选中(prefs 异步加载 kg 单位)
    expect(await screen.findByText("深蹲 (Squat)")).toBeTruthy();
    // 当前 1RM = 120 × (1 + 3/30) = 132
    expect(await screen.findByText("132")).toBeTruthy();
    expect(screen.getByText(/120 kg × 3 次/)).toBeTruthy();
    // 突破历史:3 次创新高(100×5=116.67、110×5=128.33、120×3=132)
    expect(screen.getAllByText(/116.7 kg/).length).toBeGreaterThan(0);
    expect(screen.getByText("1RM 趋势")).toBeTruthy();
  });

  it("点击候选切换动作", async () => {
    const workouts = [
      strength("2026-08-01T04:00:00Z", "深蹲", 100, 5),
      strength("2026-08-05T04:00:00Z", "卧推", 60, 10),
    ];
    setupClient(workouts);
    renderPr(workouts);
    expect(await screen.findByText("深蹲 (Squat)")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "卧推" }));
    // 60 × (1 + 10/30) = 80
    expect(await screen.findByText("80")).toBeTruthy();
    expect(screen.getByText("卧推 (Bench Press)")).toBeTruthy();
  });

  it("搜索过滤候选;无匹配时提示", () => {
    const workouts = [
      strength("2026-08-01T04:00:00Z", "深蹲", 100, 5),
      strength("2026-08-05T04:00:00Z", "卧推", 60, 10),
      strength("2026-08-07T04:00:00Z", "引体向上", 0, 8),
    ];
    setupClient(workouts);
    renderPr(workouts);
    fireEvent.change(screen.getByPlaceholderText("搜索动作"), { target: { value: "squat" } });
    expect(screen.getByRole("tab", { name: "深蹲" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "卧推" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("搜索动作"), { target: { value: "不存在的动作" } });
    expect(screen.getByText("没有匹配的动作")).toBeTruthy();
  });

  it("自重组无体重时显示提示,登记体重后按 体重+附加 估算 1RM", async () => {
    const pullups = (date: string, weightKg: number, reps: number): Workout => ({
      id: date,
      user_id: TEST_USER.id,
      type: "strength",
      date,
      notes: null,
      data: {
        session: true,
        exercise: "",
        weight_kg: 0,
        sets: 1,
        reps: 10,
        exercises: [
          {
            name: "引体向上",
            sets: [{ weight_kg: weightKg, reps, bodyweight: true, done: false }],
          },
        ],
      },
      created_at: date,
      updated_at: date,
    });
    const noWeight = [pullups("2026-08-09T04:00:00Z", 0, 8)];
    setupClient(noWeight, [], [], null);
    renderPr(noWeight);
    // 无体重历史也无偏好体重 → 有效重量 0 → 提示
    expect(screen.getByText(/暂无有效记录/)).toBeTruthy();

    const withWeight = [pullups("2026-08-09T04:00:00Z", 10, 5)];
    setupClient(withWeight, [{ date: "2026-08-01", weight_kg: 70 }], [], null);
    renderPr(withWeight);
    // 有效重量 = 70 + 10 = 80 × (1 + 5/30) ≈ 93.3(大数字 + 突破历史各一处)
    expect((await screen.findAllByText(/93.3/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/80 kg × 5 次/)).toBeTruthy();

    // 无历史但有偏好当前体重 → 兜底生效(70 × (1 + 8/30) ≈ 88.7)
    setupClient(noWeight, [], [], 70);
    renderPr(noWeight);
    expect((await screen.findAllByText(/88.7/)).length).toBeGreaterThan(0);
  });
});
