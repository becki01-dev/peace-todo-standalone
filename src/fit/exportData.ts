import type { User } from "@supabase/supabase-js";
import type { Workout } from "./types";
import type { Task } from "@/types/task";

export interface ExportBundle {
  tasks: Task[];
  workouts: Workout[];
  preferences: Record<string, unknown> | null;
}

/** 组装导出载荷:原始存储数据(公制),不含单位换算 */
export const buildExportPayload = (bundle: ExportBundle, user: User, exportedAt: string) => ({
  app: "peace-todo-standalone",
  exported_at: exportedAt,
  user: { id: user.id, email: user.email },
  preferences: bundle.preferences ?? null,
  tasks: bundle.tasks,
  workouts: bundle.workouts,
});

/** 触发浏览器下载 JSON 文件 */
export const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
