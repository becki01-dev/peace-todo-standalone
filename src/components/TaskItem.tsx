import { useState } from "react";
import { Task } from "@/types/task";
import { PriorityBadge } from "./PriorityBadge";
import { Calendar, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export const TaskItem = ({ task, onToggle, onEdit, onDelete }: Props) => {
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    if (!task.is_completed) {
      setAnimating(true);
      setTimeout(() => {
        onToggle(task);
        setAnimating(false);
      }, 300);
    } else {
      onToggle(task);
    }
  };

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = dueDate && !task.is_completed && isPast(dueDate) && !isToday(dueDate);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-4 bg-surface rounded-xl shadow-card border border-border/40",
        "transition-smooth hover:shadow-card-hover hover:border-border animate-fade-in-up",
        task.is_completed && "opacity-60"
      )}
    >
      <button
        onClick={handleToggle}
        className={cn(
          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-spring",
          task.is_completed || animating
            ? "bg-accent border-accent"
            : "border-muted-foreground/40 hover:border-accent"
        )}
        aria-label={task.is_completed ? "标记为未完成" : "标记为已完成"}
      >
        {(task.is_completed || animating) && (
          <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "text-[15px] font-medium leading-snug break-words",
              (task.is_completed || animating) && "task-title-strike text-muted-foreground"
            )}
          >
            {task.title}
          </h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)} aria-label="编辑">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(task)} aria-label="删除">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              <Calendar className="w-3 h-3" />
              {format(dueDate, "M月d日", { locale: zhCN })}
              {overdue && " · 已过期"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
