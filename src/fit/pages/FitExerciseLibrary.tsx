// 只读动作参考页:按部位/肌肉/搜索查动作,展示主要/次要肌肉、器械、模式与要点。
// 动作卡可加入本次训练;底部出现选择条,点开始训练把动作名带到力量会话表单预填。
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExerciseDict } from "../useExerciseDict";
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATALOG,
  MOVEMENT_PATTERN_LABELS,
  entriesForGroup,
  entriesForMuscle,
  exerciseMatchesQuery,
  type ExerciseCatalogEntry,
} from "../exerciseCatalog";
import {
  MUSCLES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  musclesByGroup,
  type MuscleGroupId,
  type MuscleId,
} from "../muscles";

const FitExerciseLibrary = () => {
  const navigate = useNavigate();
  const { dict } = useExerciseDict();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroupId | null>(null);
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const groupCounts = useMemo(() => {
    const counts = new Map<MuscleGroupId, number>();
    MUSCLE_GROUPS.forEach((item) => counts.set(item, entriesForGroup(item).length));
    return counts;
  }, []);

  const muscleCounts = useMemo(() => {
    const counts = new Map<MuscleId, number>();
    if (group) {
      musclesByGroup(group).forEach((id) => counts.set(id, entriesForMuscle(id).length));
    }
    return counts;
  }, [group]);

  const filtered = useMemo(() => {
    const base = muscle
      ? entriesForMuscle(muscle)
      : group
        ? entriesForGroup(group)
        : EXERCISE_CATALOG;
    return base.filter((entry) => exerciseMatchesQuery(entry, query, dict));
  }, [group, muscle, query, dict]);

  const selectGroup = (next: MuscleGroupId | null) => {
    setGroup(next);
    setMuscle(null);
  };

  const toggleSelection = (name: string) => {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  };

  const startSession = () => {
    if (selectedNames.length === 0) return;
    navigate("/fit/strength/session", { state: { prefillExercises: selectedNames } });
  };

  const summary = muscle
    ? "主要练 " + MUSCLES[muscle].label
    : group
      ? MUSCLE_GROUP_LABELS[group]
      : "全部动作";

  return (
    <div className={cn("space-y-4", selectedNames.length > 0 && "pb-24")}>
      <section className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fit-muted pointer-events-none" />
          <Input
            aria-label="搜索动作或肌肉"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜动作、英文名或肌肉(如 臀 / hip thrust)"
            className="pl-9 bg-fit-surface border-fit-border text-fit-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="按部位筛选">
          <FilterChip active={group === null} onClick={() => selectGroup(null)}>
            全部部位
          </FilterChip>
          {MUSCLE_GROUPS.map((item) => (
            <FilterChip key={item} active={group === item} onClick={() => selectGroup(item)}>
              {MUSCLE_GROUP_LABELS[item]}
              <span className="ml-1 opacity-60">{groupCounts.get(item) ?? 0}</span>
            </FilterChip>
          ))}
        </div>

        {group && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="按肌肉筛选">
            <FilterChip active={muscle === null} onClick={() => setMuscle(null)}>
              全部肌肉
            </FilterChip>
            {musclesByGroup(group).map((id) => (
              <FilterChip key={id} active={muscle === id} onClick={() => setMuscle(id)}>
                {MUSCLES[id].shortLabel}
                <span className="ml-1 opacity-60">{muscleCounts.get(id) ?? 0}</span>
              </FilterChip>
            ))}
          </div>
        )}

        <p className="text-[11px] text-fit-muted leading-relaxed">
          主要肌肉用于筛选;次要肌肉在动作卡里展示。每个肌肉至少准备了 2 个动作。
        </p>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-fit-muted">
          {summary} · {filtered.length} 个
        </p>
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-xs text-fit-accent">
            清除搜索
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 rounded-xl bg-fit-card border border-fit-border text-center">
          <p className="text-sm text-fit-muted">没有匹配的动作,换个肌肉或关键词试试。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <ExerciseCard
              key={entry.name}
              entry={entry}
              showGroup={!group}
              selected={selectedNames.includes(entry.name)}
              onToggle={() => toggleSelection(entry.name)}
            />
          ))}
        </ul>
      )}

      {selectedNames.length > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pointer-events-auto">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-fit-card border border-fit-accent/40 shadow-fit-glow">
              <span className="text-sm text-fit-foreground">已选 {selectedNames.length} 个动作</span>
              <div className="flex-1" />
              <button type="button" onClick={() => setSelectedNames([])} className="text-xs text-fit-muted">
                清空
              </button>
              <Button
                size="sm"
                onClick={startSession}
                className="bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90"
              >
                开始训练
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "px-2.5 py-1.5 rounded-full text-xs font-medium border transition-smooth",
      active
        ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
        : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
    )}
  >
    {children}
  </button>
);

const ExerciseCard = ({
  entry,
  showGroup,
  selected,
  onToggle,
}: {
  entry: ExerciseCatalogEntry;
  showGroup: boolean;
  selected: boolean;
  onToggle: () => void;
}) => {
  const groupLabel = MUSCLE_GROUP_LABELS[MUSCLES[entry.primaryMuscles[0]].group];
  return (
    <li className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fit-foreground">{entry.name}</h3>
          <p className="text-xs text-fit-muted">{entry.en}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end shrink-0">
          {showGroup && <Tag>{groupLabel}</Tag>}
          <Tag>{EQUIPMENT_LABELS[entry.equipment]}</Tag>
          <Tag>{MOVEMENT_PATTERN_LABELS[entry.pattern]}</Tag>
        </div>
      </div>

      <MuscleRow label="主要" muscles={entry.primaryMuscles} primary />
      {entry.secondaryMuscles.length > 0 && (
        <MuscleRow label="次要" muscles={entry.secondaryMuscles} />
      )}

      {entry.tips && <p className="text-xs text-fit-muted leading-relaxed">{entry.tips}</p>}

      <div className="flex items-center justify-end pt-0.5">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={(selected ? "移出 " : "加入 ") + entry.name}
          onClick={onToggle}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-smooth",
            selected
              ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
              : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
          )}
        >
          {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {selected ? "已加入" : "加入"}
        </button>
      </div>
    </li>
  );
};

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="px-2 py-0.5 rounded-full text-[10px] bg-fit-surface border border-fit-border text-fit-muted">
    {children}
  </span>
);

const MuscleRow = ({
  label,
  muscles,
  primary = false,
}: {
  label: string;
  muscles: MuscleId[];
  primary?: boolean;
}) => (
  <div className="flex items-start gap-2">
    <span className="text-[10px] text-fit-muted w-8 shrink-0 pt-0.5">{label}</span>
    <div className="flex flex-wrap gap-1">
      {muscles.map((id) => (
        <span
          key={id}
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] border",
            primary
              ? "bg-fit-accent/15 text-fit-accent border-fit-accent/30"
              : "bg-fit-surface text-fit-muted border-fit-border",
          )}
        >
          {MUSCLES[id].label}
        </span>
      ))}
    </div>
  </div>
);

export default FitExerciseLibrary;