// 只读动作参考页:按部位/肌肉/搜索查动作,展示主要/次要肌肉、器械、模式与要点。
// 历史动作会先尝试精确映射到 catalog;匹配不到时作为「历史动作」展示,不参与肌肉筛选。
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExerciseDict } from "../useExerciseDict";
import { useExerciseHistory } from "../useExerciseHistory";
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATALOG,
  MOVEMENT_PATTERN_LABELS,
  buildCatalogLookup,
  entriesForGroup,
  entriesForMuscle,
  exerciseMatchesQuery,
  resolveCatalogExercise,
  type ExerciseCatalogEntry,
} from "../exerciseCatalog";
import { exerciseSearchMatch, type ExerciseDict, type ExerciseUsage } from "../exerciseLib";
import {
  MUSCLES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  musclesByGroup,
  type MuscleGroupId,
  type MuscleId,
} from "../muscles";

type LibraryItem =
  | { kind: "catalog"; entry: ExerciseCatalogEntry; usage?: ExerciseUsage }
  | { kind: "history"; name: string; usage: ExerciseUsage };

const DAY_MS = 86400000;
const daysSince = (iso: string, now = Date.now()) => Math.floor((now - new Date(iso).getTime()) / DAY_MS);

const latestIso = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

const mergeUsage = (a?: ExerciseUsage, b?: ExerciseUsage): ExerciseUsage | undefined => {
  if (!a) return b;
  if (!b) return a;
  return { count: a.count + b.count, lastUsed: latestIso(a.lastUsed, b.lastUsed) };
};

const recentLabelFor = (usage?: ExerciseUsage): string | null => {
  if (!usage) return null;
  if (usage.count === 0) return "已登记";
  if (!usage.lastUsed) return "练过";
  const days = daysSince(usage.lastUsed);
  if (days <= 7) return "7 天内练过";
  if (days <= 30) return "30 天内练过";
  return "30 天没练";
};

const compareByUsage = (a: LibraryItem, b: LibraryItem) => {
  const aTime = a.usage?.lastUsed ? Date.parse(a.usage.lastUsed) : 0;
  const bTime = b.usage?.lastUsed ? Date.parse(b.usage.lastUsed) : 0;
  return bTime - aTime || (b.usage?.count ?? 0) - (a.usage?.count ?? 0);
};

const FitExerciseLibrary = () => {
  const navigate = useNavigate();
  const { dict } = useExerciseDict();
  const { usage, knownNames } = useExerciseHistory();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroupId | null>(null);
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [hideRecent, setHideRecent] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyUntrained, setOnlyUntrained] = useState(false);

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

  const catalogLookup = useMemo(() => buildCatalogLookup(dict), [dict]);

  const libraryItems = useMemo<LibraryItem[]>(() => {
    const usageByCatalogName = new Map<string, ExerciseUsage>();
    const historyItems: LibraryItem[] = [];
    const names = new Set<string>([...usage.keys(), ...knownNames]);

    names.forEach((rawName) => {
      const name = rawName.trim();
      if (!name) return;
      const itemUsage = usage.get(rawName) ?? { count: 0, lastUsed: null };
      const entry = resolveCatalogExercise(name, dict, catalogLookup);
      if (entry) {
        usageByCatalogName.set(entry.name, mergeUsage(usageByCatalogName.get(entry.name), itemUsage)!);
        return;
      }
      historyItems.push({ kind: "history", name, usage: itemUsage });
    });

    historyItems.sort((a, b) => compareByUsage(a, b) || a.name.localeCompare(b.name, "zh"));

    const catalogItems: LibraryItem[] = EXERCISE_CATALOG.map((entry) => ({
      kind: "catalog",
      entry,
      usage: usageByCatalogName.get(entry.name),
    }));

    return [...catalogItems, ...historyItems];
  }, [catalogLookup, dict, knownNames, usage]);

  const historyActionCount = useMemo(
    () => libraryItems.filter((item) => item.usage !== undefined).length,
    [libraryItems],
  );
  const hasHistory = historyActionCount > 0;

  const filtered = useMemo(() => {
    let base = libraryItems;

    if (onlyMine) {
      base = base.filter((item) => item.usage !== undefined);
    }

    if (muscle) {
      base = base.filter(
        (item) => item.kind === "catalog" && item.entry.primaryMuscles.includes(muscle),
      );
    } else if (group) {
      base = base.filter(
        (item) =>
          item.kind === "catalog" &&
          item.entry.primaryMuscles.some((muscleId) => MUSCLES[muscleId].group === group),
      );
    }

    if (onlyUntrained) {
      base = base.filter((item) => item.usage === undefined);
    }

    if (hideRecent) {
      base = base.filter((item) => {
        const usedAt = item.usage?.lastUsed;
        return !usedAt || daysSince(usedAt) > 7;
      });
    }

    const q = query.trim();
    if (!q) return onlyMine ? [...base].sort(compareByUsage) : base;

    const searched = base.filter((item) =>
      item.kind === "catalog" ? exerciseMatchesQuery(item.entry, q, dict) : exerciseSearchMatch(item.name, q, dict),
    );
    return onlyMine ? [...searched].sort(compareByUsage) : searched;
  }, [dict, group, hideRecent, libraryItems, muscle, onlyMine, onlyUntrained, query]);

  const selectGroup = (next: MuscleGroupId | null) => {
    setGroup(next);
    setMuscle(null);
  };

  const toggleMine = () => {
    const next = !onlyMine;
    setOnlyMine(next);
    if (next) {
      setOnlyUntrained(false);
      setGroup(null);
      setMuscle(null);
    }
  };

  const toggleUntrained = () => {
    const next = !onlyUntrained;
    setOnlyUntrained(next);
    if (next) setOnlyMine(false);
  };

  const toggleSelection = (name: string) => {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  };

  const startSession = () => {
    if (selectedNames.length === 0) return;
    navigate("/fit/strength/session", { state: { prefillExercises: selectedNames } });
  };

  const summary = onlyMine
    ? "我练过的动作"
    : onlyUntrained
      ? "还没练过的标准动作"
      : muscle
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

        {hasHistory && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="历史筛选">
            <FilterChip active={onlyMine} onClick={toggleMine}>
              我练过的
              <span className="ml-1 opacity-60">{historyActionCount}</span>
            </FilterChip>
            <FilterChip active={onlyUntrained} onClick={toggleUntrained}>
              只看没练过
            </FilterChip>
            <FilterChip active={hideRecent} onClick={() => setHideRecent((prev) => !prev)}>
              隐藏 7 天内练过
            </FilterChip>
          </div>
        )}

        <p className="text-[11px] text-fit-muted leading-relaxed">
          主要肌肉用于筛选;次要肌肉在动作卡里展示。历史动作会尽量匹配标准动作,匹配不到时只显示动作名,不参与肌肉筛选。
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
          {filtered.map((item) => {
            const name = item.kind === "catalog" ? item.entry.name : item.name;
            return (
              <ExerciseCard
                key={item.kind === "catalog" ? "catalog-" + name : "history-" + name}
                item={item}
                dict={dict}
                showGroup={!group}
                selected={selectedNames.includes(name)}
                onToggle={() => toggleSelection(name)}
              />
            );
          })}
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
  item,
  dict,
  showGroup,
  selected,
  onToggle,
}: {
  item: LibraryItem;
  dict: ExerciseDict;
  showGroup: boolean;
  selected: boolean;
  onToggle: () => void;
}) => {
  const recent = recentLabelFor(item.usage);
  const countLabel = item.usage && item.usage.count > 1 ? "做过 " + item.usage.count + " 次" : null;

  if (item.kind === "history") {
    const english = dict.en[item.name];
    return (
      <li className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fit-foreground">{item.name}</h3>
            <p className="text-xs text-fit-muted">{english ?? "未匹配到标准动作"}</p>
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end sm:shrink-0">
            <Tag>历史动作</Tag>
            {countLabel && <Tag>{countLabel}</Tag>}
            {recent && <Tag tone={recent === "30 天没练" ? "accent" : "muted"}>{recent}</Tag>}
          </div>
        </div>

        <p className="text-xs text-fit-muted leading-relaxed">
          暂无细分肌群信息，可在训练表单中设置部位。
        </p>

        <div className="flex items-center justify-end pt-0.5">
          <AddButton name={item.name} selected={selected} onToggle={onToggle} />
        </div>
      </li>
    );
  }

  const { entry } = item;
  const groupLabel = MUSCLE_GROUP_LABELS[MUSCLES[entry.primaryMuscles[0]].group];
  return (
    <li className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fit-foreground">{entry.name}</h3>
          <p className="text-xs text-fit-muted">{entry.en}</p>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end sm:shrink-0">
          {recent && <Tag tone={recent === "30 天没练" ? "accent" : "muted"}>{recent}</Tag>}
          {countLabel && <Tag>{countLabel}</Tag>}
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
        <AddButton name={entry.name} selected={selected} onToggle={onToggle} />
      </div>
    </li>
  );
};

const AddButton = ({
  name,
  selected,
  onToggle,
}: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    aria-label={(selected ? "移出 " : "加入 ") + name}
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
);

const Tag = ({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" }) => (
  <span
    className={cn(
      "px-2 py-0.5 rounded-full text-[10px] border",
      tone === "accent"
        ? "bg-fit-accent/15 text-fit-accent border-fit-accent/30"
        : "bg-fit-surface text-fit-muted border-fit-border",
    )}
  >
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
