import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame } from "lucide-react";
import { toast } from "sonner";

type AuthLocationState = {
  from?: string;
};

type AuthMode = "signin" | "signup" | "forgot" | "reset";

const FitAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // true = 通过重置邮件链接进入（recovery 会话），此时不重定向，展示设新密码表单
  const [resetMode, setResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const from = (() => {
    const raw = (location.state as AuthLocationState | null)?.from;
    if (raw && (raw.startsWith("/fit") || raw.startsWith("/task") || raw === "/")) {
      return raw;
    }
    return "/fit";
  })();

  useEffect(() => {
    // 重置邮件链接落地时 supabase-js 会先于路由状态触发 PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
        setMode("signin");
      }
    });
    // 兜底：事件错过时 hash 可能仍带 type=recovery
    if (window.location.hash.includes("type=recovery")) {
      setResetMode(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !resetMode) navigate(from, { replace: true });
  }, [user, navigate, from, resetMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) toast.error(error.message);
        else toast.success("注册成功,开始记录!");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) toast.error(error.message);
        else {
          toast.success("如果该邮箱已注册,重置邮件已发送,请查收");
          setMode("signin");
        }
      } else {
        // mode === "reset": 重置邮件链接进入，设置新密码
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) toast.error(error.message);
        else {
          toast.success("密码已更新,正在进入...");
          setResetMode(false);
          navigate("/fit", { replace: true });
        }
      }
    } catch {
      toast.error("操作失败,请重试");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-fit-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-fit-accent text-fit-accent-foreground flex items-center justify-center mb-3 shadow-fit-glow">
            <Flame className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-fit-foreground">ZenFit</h1>
          <p className="text-sm text-fit-muted mt-1">硬核记录每一滴汗水</p>
        </div>

        <form onSubmit={submit} className="space-y-3 p-6 rounded-2xl bg-fit-card border border-fit-border">
          {mode !== "reset" && (
            <Input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-fit-surface border-fit-border text-fit-foreground"
            />
          )}
          {mode !== "forgot" && mode !== "reset" && (
            <Input
              type="password"
              placeholder="密码 (至少6位)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-fit-surface border-fit-border text-fit-foreground"
            />
          )}
          {mode === "reset" && (
            <>
              <Input
                type="password"
                placeholder="设置新密码 (至少6位)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
              <p className="text-xs text-fit-muted">通过重置邮件进入,设置你的新密码</p>
            </>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90 font-semibold"
          >
            {loading ? "..." : mode === "signin" ? "登录" : mode === "signup" ? "注册" : mode === "forgot" ? "发送重置邮件" : "设置新密码"}
          </Button>
          <div className="flex flex-col gap-1.5 pt-1 text-center">
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-xs text-fit-muted hover:text-fit-accent transition-smooth"
              >
                忘记密码?
              </button>
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="w-full text-xs text-fit-muted hover:text-fit-accent transition-smooth"
              >
                没有账号? 立即注册
              </button>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full text-xs text-fit-muted hover:text-fit-accent transition-smooth"
              >
                已有账号? 登录
              </button>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={async () => {
                  if (resetMode) {
                    await supabase.auth.signOut();
                    setResetMode(false);
                  }
                  setMode("signin");
                }}
                className="w-full text-xs text-fit-muted hover:text-fit-accent transition-smooth"
              >
                返回登录
              </button>
            )}
          </div>
        </form>

        <p className="text-center mt-6">
          <Link to="/" className="text-xs text-fit-muted hover:text-fit-accent">← 返回主页</Link>
        </p>
      </div>
    </div>
  );
};

export default FitAuth;
