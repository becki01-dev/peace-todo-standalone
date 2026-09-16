// 动作参考数据完整性 + 肌肉覆盖 + 搜索测试
import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATALOG,
  MOVEMENT_PATTERN_LABELS,
  buildCatalogLookup,
  catalogBodyPart,
  catalogExerciseDefaults,
  entriesForGroup,
  entriesForMuscle,
  exerciseMatchesQuery,
  findCatalogExercise,
  resolveCatalogExercise,
  type ExerciseCatalogEntry,
} from "./exerciseCatalog";
import {
  MUSCLES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  MUSCLE_IDS,
  musclesByGroup,
} from "./muscles";
import { dictFromRows, emptyDict } from "./exerciseLib";
import { FIXTURE_DICT } from "./testDict.fixture";

const find = (name: string): ExerciseCatalogEntry => {
  const hit = EXERCISE_CATALOG.find((entry) => entry.name === name);
  if (!hit) throw new Error(`动作库缺少 ${name}`);
  return hit;
};

describe("肌肉分类", () => {
  it("一级部位都有标签,二级肌肉都有有效归属/名称/bodyPart", () => {
    MUSCLE_GROUPS.forEach((group) => {
      expect(MUSCLE_GROUP_LABELS[group]).toBeTruthy();
      expect(musclesByGroup(group).length).toBeGreaterThan(0);
    });
    MUSCLE_IDS.forEach((id) => {
      const meta = MUSCLES[id];
      expect(meta.label).toBeTruthy();
      expect(meta.shortLabel).toBeTruthy();
      expect(MUSCLE_GROUPS).toContain(meta.group);
      expect(meta.bodyPart).toBeTruthy();
    });
  });

  it("每个非可选肌肉至少有 2 个主要动作(保证查了就有得选)", () => {
    MUSCLE_IDS.filter((id) => !MUSCLES[id].optional).forEach((id) => {
      const count = entriesForMuscle(id).length;
      expect(count, `${MUSCLES[id].label} 只有 ${count} 个主要动作`).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("动作库数据完整性", () => {
  it("动作名唯一,英文/要点/器械/模式齐全", () => {
    const names = EXERCISE_CATALOG.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    EXERCISE_CATALOG.forEach((entry) => {
      expect(entry.en, `${entry.name} 缺英文名`).toBeTruthy();
      expect(entry.tips, `${entry.name} 缺动作要点`).toBeTruthy();
      expect(EQUIPMENT_LABELS[entry.equipment], `${entry.name} 器械无效`).toBeTruthy();
      expect(MOVEMENT_PATTERN_LABELS[entry.pattern], `${entry.name} 模式无效`).toBeTruthy();
    });
  });

  it("主要肌肉 1-3 个、次要 0-4 个,且主次不重叠", () => {
    EXERCISE_CATALOG.forEach((entry) => {
      expect(entry.primaryMuscles.length, `${entry.name} 主要肌肉数量`).toBeGreaterThan(0);
      expect(entry.primaryMuscles.length, `${entry.name} 主要肌肉数量`).toBeLessThanOrEqual(3);
      expect(entry.secondaryMuscles.length, `${entry.name} 次要肌肉数量`).toBeLessThanOrEqual(4);
      entry.primaryMuscles.forEach((muscle) => {
        expect(MUSCLES[muscle], `${entry.name} 主要肌肉 ${muscle} 无效`).toBeTruthy();
      });
      entry.secondaryMuscles.forEach((muscle) => {
        expect(MUSCLES[muscle], `${entry.name} 次要肌肉 ${muscle} 无效`).toBeTruthy();
        expect(entry.primaryMuscles.includes(muscle), `${entry.name} ${muscle} 主次重叠`).toBe(false);
      });
    });
  });

  it("每个一级部位都有动作", () => {
    MUSCLE_GROUPS.forEach((group) => {
      expect(entriesForGroup(group).length, `${MUSCLE_GROUP_LABELS[group]} 没有动作`).toBeGreaterThan(0);
    });
  });

  it("臀部独立成组,包含臀桥/臀推/髋外展/蚌式", () => {
    const glutes = entriesForGroup("glutes").map((entry) => entry.name);
    ["臀桥", "臀推", "髋外展", "蚌式"].forEach((name) => {
      expect(glutes).toContain(name);
    });
  });
});

describe("动作搜索", () => {
  it("支持中文名/英文名/肌肉名/器械名搜索", () => {
    expect(exerciseMatchesQuery(find("臀推"), "臀推", emptyDict())).toBe(true);
    expect(exerciseMatchesQuery(find("臀推"), "hip thrust", emptyDict())).toBe(true);
    expect(exerciseMatchesQuery(find("臀推"), "臀大肌", emptyDict())).toBe(true);
    expect(exerciseMatchesQuery(find("臀推"), "杠铃", emptyDict())).toBe(true);
    expect(exerciseMatchesQuery(find("罗马尼亚硬拉"), "腘绳", emptyDict())).toBe(true);
    expect(exerciseMatchesQuery(find("下斜卧推"), "上胸", emptyDict())).toBe(false);
  });

  it("空查询匹配全部,搜臀部能命中臀中肌动作", () => {
    EXERCISE_CATALOG.forEach((entry) => {
      expect(exerciseMatchesQuery(entry, "  ", emptyDict())).toBe(true);
    });
    const hipResults = EXERCISE_CATALOG.filter((entry) => exerciseMatchesQuery(entry, "臀", emptyDict()));
    expect(hipResults.some((entry) => entry.name === "髋外展")).toBe(true);
    expect(hipResults.some((entry) => entry.name === "臀推")).toBe(true);
  });

  it("补充搜索词(如平板卧推)命中卧推", () => {
    expect(exerciseMatchesQuery(find("卧推"), "平板卧推", emptyDict())).toBe(true);
  });

  it("字典别名兜底(如 arm curl 命中二头弯举)", () => {
    expect(exerciseMatchesQuery(find("二头弯举"), "arm curl", FIXTURE_DICT)).toBe(true);
    expect(exerciseMatchesQuery(find("二头弯举"), "arm curl", emptyDict())).toBe(false);
  });
});

describe("catalog 表单辅助", () => {
  it("提供动作查找、粗部位与表单默认值", () => {
    expect(findCatalogExercise("臀推")?.en).toBe("Hip Thrust");
    expect(catalogBodyPart("臀推")).toBe("legs");
    expect(catalogBodyPart("面拉")).toBe("back");
    expect(catalogBodyPart("波比跳")).toBe("full_body");
    expect(catalogBodyPart("不存在的动作")).toBeNull();
    expect(catalogExerciseDefaults("俯卧撑")).toEqual({ bodyweight: true, default_reps: 10 });
    expect(catalogExerciseDefaults("臀推")).toEqual({ bodyweight: false, default_reps: 10 });
    expect(catalogExerciseDefaults("不存在的动作")).toBeNull();
  });
});

describe("历史动作 → catalog 精确匹配", () => {
  it("英文别名和补充词能命中标准动作", () => {
    expect(resolveCatalogExercise("pull-up", FIXTURE_DICT)?.name).toBe("引体向上");
    expect(resolveCatalogExercise("chin ups", FIXTURE_DICT)?.name).toBe("引体向上");
    expect(resolveCatalogExercise("平板卧推", emptyDict())?.name).toBe("卧推");
    expect(resolveCatalogExercise("hip thrust", FIXTURE_DICT)?.name).toBe("臀推");
  });

  it("中文变体能映射到 catalog 规范动作", () => {
    const dict = dictFromRows([{ id: "zh-butt", kind: "zh_alias", key: "臀冲", value: "臀推" }]);
    expect(resolveCatalogExercise("臀冲", dict)?.name).toBe("臀推");
  });

  it("未收录动作不硬猜,返回 undefined", () => {
    expect(resolveCatalogExercise("哈克深蹲", FIXTURE_DICT)).toBeUndefined();
    expect(resolveCatalogExercise("随便编的动作", FIXTURE_DICT)).toBeUndefined();
  });

  it("lookup 可复用,匹配结果稳定", () => {
    const lookup = buildCatalogLookup(FIXTURE_DICT);
    expect(resolveCatalogExercise("pull-up", FIXTURE_DICT, lookup)?.name).toBe("引体向上");
    expect(resolveCatalogExercise("hip thrust", undefined, lookup)?.name).toBe("臀推");
  });
});
