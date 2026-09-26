// 动作示范图数据测试:映射键合法性、覆盖缺口、帧文件是否真的存在
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "./exerciseCatalog";
import {
  EXERCISE_MEDIA,
  EXERCISE_MEDIA_CREDIT,
  exerciseFrameSrc,
  mediaForExercise,
} from "./exerciseMedia";

const catalogNames = new Set(EXERCISE_CATALOG.map((entry) => entry.name));
const mediaEntries = Object.entries(EXERCISE_MEDIA);

/** 上游没有插画的动作,允许缺席;新增动作要么配图,要么加进这里 */
const ALLOWED_WITHOUT_MEDIA = new Set(["颈部屈伸"]);

const assetDir = path.resolve(process.cwd(), "public/exercises");

describe("EXERCISE_MEDIA", () => {
  it("键都是 catalog 的规范中文名", () => {
    const unknown = mediaEntries.filter(([name]) => !catalogNames.has(name)).map(([name]) => name);
    expect(unknown).toEqual([]);
  });

  it("每条映射的 slug/source/帧数都合法", () => {
    mediaEntries.forEach(([name, media]) => {
      expect(media.slug, name).toMatch(/^[a-z0-9-]+$/);
      expect(media.source.length, name).toBeGreaterThan(0);
      expect(media.frames, name).toBeGreaterThanOrEqual(1);
      expect(media.frames, name).toBeLessThanOrEqual(3);
    });
  });

  it("除白名单外,所有标准动作都有示范图", () => {
    const missing = EXERCISE_CATALOG.map((entry) => entry.name).filter(
      (name) => !EXERCISE_MEDIA[name] && !ALLOWED_WITHOUT_MEDIA.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("每个动作的每一帧 SVG 都已经落盘", () => {
    const missingFiles: string[] = [];
    mediaEntries.forEach(([name, media]) => {
      for (let frame = 1; frame <= media.frames; frame += 1) {
        const file = path.join(assetDir, media.slug, `frame-${frame}.svg`);
        if (!fs.existsSync(file)) missingFiles.push(`${name}(${media.slug} frame-${frame})`);
        else if (!fs.readFileSync(file, "utf8").startsWith("<svg")) missingFiles.push(`${name}(不是 SVG)`);
      }
    });
    expect(missingFiles).toEqual([]);
  });

  it("示范图 URL 指向 public/exercises 下的帧文件", () => {
    expect(exerciseFrameSrc("hip-thrust", 2)).toBe("/exercises/hip-thrust/frame-2.svg");
  });

  it("mediaForExercise 只对已配图动作返回结果", () => {
    expect(mediaForExercise("臀推")?.slug).toBe("hip-thrust");
    expect(mediaForExercise("颈部屈伸")).toBeUndefined();
    expect(mediaForExercise("不存在的动作")).toBeUndefined();
  });

  it("署名信息含作者与许可(CC BY-SA 4.0 要求)", () => {
    expect(EXERCISE_MEDIA_CREDIT.creator).toBe("Bryl Lim");
    expect(EXERCISE_MEDIA_CREDIT.license).toBe("CC BY-SA 4.0");
    expect(EXERCISE_MEDIA_CREDIT.licenseUrl).toContain("creativecommons.org");
  });
});
