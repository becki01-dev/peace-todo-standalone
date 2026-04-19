import { Priority } from "@/types/task";
import { cn } from "@/lib/utils";

const labels: Record<Priority, string> = { high: "高", medium: "中", low: "低" };

const styles: Record<Priority, string> = {
  high: "bg-priority-high/10 text-priority-high",
  medium: "bg-priority-medium/10 text-priority-medium",
  low: "bg-priority-low/10 text-priority-low",
};

export const PriorityBadge = ({ priority, className }: { priority: Priority; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
      styles[priority],
      className
    )}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current" />
    {labels[priority]}
  </span>
);
