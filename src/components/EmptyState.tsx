import { Sparkles } from "lucide-react";

export const EmptyState = ({ message = "暂无任务,开启高效一天吧" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in-up">
    <div className="relative mb-6">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-accent" strokeWidth={1.5} />
      </div>
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-priority-medium/40 animate-pulse" />
      <div className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full bg-priority-low/40 animate-pulse" style={{ animationDelay: "0.5s" }} />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-1">{message}</h3>
    <p className="text-sm text-muted-foreground">点击下方 “+” 按钮添加你的第一个任务</p>
  </div>
);
