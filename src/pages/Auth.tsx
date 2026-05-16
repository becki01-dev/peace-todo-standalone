import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/task", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/task` },
        });
        if (error) throw error;
        toast.success("注册成功!正在进入...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("欢迎回来 👋");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "操作失败,请重试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4 shadow-fab">
            <CheckCircle2 className="w-7 h-7 text-accent-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">ZenTask</h1>
          <p className="text-muted-foreground mt-2 text-sm">极简任务管理,专注当下</p>
        </div>

        <Card className="p-6 shadow-card border-border/60 animate-scale-in">
          <div className="flex gap-1 p-1 bg-secondary rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-smooth ${
                mode === "signin" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-smooth ${
                mode === "signup" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? "处理中..." : mode === "signin" ? "登录" : "创建账号"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};

export default Auth;
