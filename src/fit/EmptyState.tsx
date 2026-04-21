import { Flame } from "lucide-react";

export const FitEmptyState = ({ message = "汗水不会骗你,开始第一笔记录吧!" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up">
    <div className="relative mb-5">
      <div className="w-20 h-20 rounded-2xl bg-fit-accent/10 border border-fit-accent/30 flex items-center justify-center">
        <Flame className="w-9 h-9 text-fit-accent" strokeWidth={1.8} />
      </div>
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-fit-accent animate-pulse" />
    </div>
    <h3 className="text-base font-semibold text-fit-foreground mb-1">{message}</h3>
    <p className="text-xs text-fit-muted">点击下方 + 号开始记录</p>
  </div>
);
