import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExportPayload, downloadJson } from "./exportData";
import type { User } from "@supabase/supabase-js";
import type { Task } from "@/types/task";
import type { Workout } from "./types";

const user = { id: "u1", email: "tester@example.com" } as unknown as User;

const task: Task = {
  id: "t1",
  user_id: "u1",
  title: "买菜",
  description: null,
  priority: "medium",
  due_date: null,
  is_completed: false,
  created_at: "2026-08-08T10:00:00Z",
  updated_at: "2026-08-08T10:00:00Z",
};

const workout: Workout = {
  id: "w1",
  user_id: "u1",
  type: "strength",
  date: "2026-08-08T02:00:00Z",
  notes: null,
  data: { session: true, exercise: "深蹲", weight_kg: 0, sets: 1, reps: 10, exercises: [] },
  created_at: "2026-08-08T10:00:00Z",
  updated_at: "2026-08-08T10:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildExportPayload", () => {
  it("组装完整导出结构(任务/训练/偏好/体重历史/用户信息)", () => {
    const payload = buildExportPayload(
      {
        tasks: [task],
        workouts: [workout],
        preferences: { weight_unit: "lb" },
        body_weight_history: [{ date: "2026-08-08", weight_kg: 70 }],
      },
      user,
      "2026-08-08T00:00:00.000Z",
    );

    expect(payload).toEqual({
      app: "peace-todo-standalone",
      exported_at: "2026-08-08T00:00:00.000Z",
      user: { id: "u1", email: "tester@example.com" },
      preferences: { weight_unit: "lb" },
      tasks: [task],
      workouts: [workout],
      body_weight_history: [{ date: "2026-08-08", weight_kg: 70 }],
    });
  });

  it("空数据与无偏好时输出空数组与 null", () => {
    const payload = buildExportPayload(
      { tasks: [], workouts: [], preferences: null, body_weight_history: [] },
      user,
      "2026-08-08T00:00:00.000Z",
    );

    expect(payload.preferences).toBeNull();
    expect(payload.tasks).toEqual([]);
    expect(payload.workouts).toEqual([]);
    expect(payload.body_weight_history).toEqual([]);
  });
});

describe("downloadJson", () => {
  it("创建 blob URL、触发下载并回收", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadJson("peace-data-2026-08-08.json", { a: 1 });

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
