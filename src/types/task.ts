export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskFilter = "all" | "pending" | "completed";
