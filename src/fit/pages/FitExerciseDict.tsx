import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useExerciseDict } from "../useExerciseDict";
import { ExerciseDictEntry, ExerciseDictKind } from "../exerciseLib";
import { Search, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_META: Record<ExerciseDictKind, { label: string; hint: string; keyPlaceholder: string; valuePlaceholder: string }> = {
  alias: {
    label: "英文别名",
    hint: "英文别名/变体 → 中文规范名。用于英文搜索、自定义输入自动归一化与双语显示。键必须全小写。",
    keyPlaceholder: "如 hip abduction",
    valuePlaceholder: "中文规范名,如 髋外展",
  },
  en: {
    label: "中文显示英文",
    hint: "非预设动作的中文规范名 → 显示用英文名(如 腿弯举 → Leg Curl)。",
    keyPlaceholder: "中文规范名",
    valuePlaceholder: "英文名,如 Leg Curl",
  },
  zh_alias: {
    label: "中文变体",
    hint: "中文变体 → 中文规范名,仅显示层补充英文(如 俄罗斯卷腹 → 俄罗斯转体),数据不动。",
    keyPlaceholder: "中文变体",
    valuePlaceholder: "中文规范名",
  },
};

const KINDS: ExerciseDictKind[] = ["alias", "en", "zh_alias"];

/** 动作字典独立编辑入口:全局映射(DB exercise_dictionary)增删改查,即时生效;写操作仅管理员 */
const FitExerciseDict = () => {
  const { rows, loading, isAdmin, refresh } = useExerciseDict();
  const [kind, setKind] = useState<ExerciseDictKind>("alias");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseDictEntry | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const c: Record<ExerciseDictKind, number> = { alias: 0, en: 0, zh_alias: 0 };
    rows.forEach((r) => {
      c[r.kind] = (c[r.kind] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const kindRows = useMemo(() => rows.filter((r) => r.kind === kind), [rows, kind]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return kindRows;
    return kindRows.filter((r) => r.key.toLowerCase().includes(query) || r.value.toLowerCase().includes(query));
  }, [kindRows, q]);

  const meta = KIND_META[kind];

  const openAdd = () => {
    setEditing(null);
    setFormKey("");
    setFormValue("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: ExerciseDictEntry) => {
    setEditing(row);
    setFormKey(row.key);
    setFormValue(row.value);
    setFormError(null);
    setFormOpen(true);
  };

  const validate = (): string | null => {
    const k = formKey.trim();
    const v = formValue.trim();
    if (!k) return "键不能为空";
    if (!v) return "值不能为空";
    if (kind === "alias" && (k !== k.toLowerCase() || !/[a-z0-9]/.test(k))) {
      return "英文别名键必须全小写(字母/数字/空格/连字符)";
    }
    const dup = rows.some(
      (r) => r.kind === kind && r.key.toLowerCase() === k.toLowerCase() && r.id !== editing?.id,
    );
    if (dup) return `「${k}」已存在(${meta.label})`;
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    const payload = { key: formKey.trim(), value: formValue.trim() };
    const { error } = editing
      ? await supabase.from("exercise_dictionary").update(payload).eq("id", editing.id)
      : await supabase.from("exercise_dictionary").upsert({ kind, ...payload }, { onConflict: "kind,key" });
    setSaving(false);
    if (error) {
      setFormError(`保存失败:${error.message}`);
      return;
    }
    toast.success(editing ? "已更新" : "已新增");
    setFormOpen(false);
    await refresh();
  };

  const handleDelete = async (row: ExerciseDictEntry) => {
    setDeleting(true);
    const { error } = await supabase.from("exercise_dictionary").delete().eq("id", row.id);
    setDeleting(false);
    setConfirmDeleteId(null);
    if (error) {
      toast.error(`删除失败:${error.message}`);
      return;
    }
    toast.success(`已删除「${row.key}」`);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-fit-foreground">动作字典</h2>
            <p className="text-xs text-fit-muted">映射即时生效:搜索、显示与自定义输入归一化全部使用此字典。</p>
          </div>
          {isAdmin ? (
            <Button
              onClick={openAdd}
              className="shrink-0 bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90"
            >
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-fit-muted shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
              仅管理员可编辑
            </span>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-fit-surface rounded-lg border border-fit-border" role="tablist" aria-label="字典类型">
          {KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setQ("");
              }}
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-smooth",
                kind === k ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted",
              )}
            >
              {KIND_META[k].label} ({counts[k]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-32 rounded-xl bg-fit-surface animate-pulse" />
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fit-muted pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索键或值"
                className="pl-9 bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
            <p className="text-xs text-fit-muted px-1">{meta.hint}</p>
            {filtered.length === 0 ? (
              <p className="text-sm text-fit-muted px-1 py-4 text-center">暂无条目</p>
            ) : (
              <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
                {filtered.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-fit-surface border border-fit-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fit-foreground truncate">{row.key}</p>
                      <p className="text-xs text-fit-muted truncate">→ {row.value}</p>
                    </div>
                    {isAdmin &&
                      (confirmDeleteId === row.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="destructive"
                            disabled={deleting}
                            onClick={() => handleDelete(row)}
                            className="h-8 px-2 text-xs"
                          >
                            {deleting ? "删除中..." : "确认删除"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={deleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 px-2 text-xs bg-fit-card border-fit-border text-fit-foreground"
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => openEdit(row)}
                            aria-label={`编辑 ${row.key}`}
                            className="p-1.5 rounded-md text-fit-muted hover:text-fit-accent transition-smooth"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(row.id)}
                            aria-label={`删除 ${row.key}`}
                            className="p-1.5 rounded-md text-fit-muted hover:text-destructive transition-smooth"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-fit-card border-fit-border text-fit-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-fit-foreground">
              {editing ? `编辑 ${meta.label}` : `新增 ${meta.label}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">键</Label>
              <Input
                aria-label="键"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder={meta.keyPlaceholder}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">值</Label>
              <Input
                aria-label="值"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={meta.valuePlaceholder}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              className="text-fit-muted hover:text-fit-foreground hover:bg-fit-surface"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90 font-semibold"
            >
              {saving ? "保存中..." : editing ? "保存修改" : "新增条目"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FitExerciseDict;
