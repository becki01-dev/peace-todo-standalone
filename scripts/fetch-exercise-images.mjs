// 拉取动作示范图:workout-guide(Everkinetic 派生)三帧 SVG -> public/exercises/<slug>/
// 用法:node scripts/fetch-exercise-images.mjs
// 映射的唯一来源是 src/fit/exerciseMedia.ts(slug + source),本脚本只做校验和下载;
// 上游若改名,脚本会直接报错,不会静默写错图。

import fs from "node:fs/promises";
import path from "node:path";

const REPO_RAW = "https://raw.githubusercontent.com/bryllim/workout-guide/main/packages/workout-guide";
const MEDIA_TS = "src/fit/exerciseMedia.ts";
const OUT_DIR = "public/exercises";
const CONCURRENCY = 6;

const readMapping = async () => {
  const source = await fs.readFile(MEDIA_TS, "utf8");
  const re = /([^\s{}:]+):\s*\{\s*slug:\s*"([^"]+)",\s*source:\s*"([^"]+)",\s*frames:\s*(\d+)/g;
  const entries = [];
  let match;
  while ((match = re.exec(source))) {
    entries.push({ zh: match[1], slug: match[2], source: match[3], frames: Number(match[4]) });
  }
  if (entries.length === 0) throw new Error(`没有从 ${MEDIA_TS} 解析到任何映射`);
  return entries;
};

const runPool = async (items, worker, concurrency) => {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const main = async () => {
  const entries = await readMapping();
  const manifestRes = await fetch(`${REPO_RAW}/manifest.json`);
  if (!manifestRes.ok) throw new Error(`拉取 manifest 失败: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const byName = new Map(manifest.map((item) => [item.name, item]));

  // 一个 slug 可能被多个中文动作共用(如坐姿/屈膝提踵),按 slug 去重
  const bySlug = new Map();
  for (const entry of entries) {
    const upstream = byName.get(entry.source);
    if (!upstream) throw new Error(`上游 manifest 找不到动作「${entry.source}」(${entry.zh})`);
    if (upstream.slug !== entry.slug) {
      throw new Error(`slug 不一致:${entry.zh} 写的是 ${entry.slug},上游是 ${upstream.slug}`);
    }
    if (upstream.frames.length < entry.frames) {
      throw new Error(`${entry.slug} 上游只有 ${upstream.frames.length} 帧,映射要求 ${entry.frames} 帧`);
    }
    if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, { upstream, zhNames: [entry.zh] });
    else bySlug.get(entry.slug).zhNames.push(entry.zh);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const jobs = [];
  for (const [slug, { upstream }] of bySlug) {
    upstream.frames.slice(0, 3).forEach((frame) => {
      jobs.push({ slug, frame: frame.index, url: `${REPO_RAW}/${frame.path}` });
    });
  }

  let bytes = 0;
  await runPool(
    jobs,
    async (job) => {
      const res = await fetch(job.url);
      if (!res.ok) throw new Error(`下载失败 ${job.url}: ${res.status}`);
      const svg = await res.text();
      if (!svg.startsWith("<svg")) throw new Error(`返回的不是 SVG: ${job.url}`);
      const dir = path.join(OUT_DIR, job.slug);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `frame-${job.frame}.svg`), svg);
      bytes += svg.length;
    },
    CONCURRENCY,
  );

  // 署名文件(CC BY-SA 4.0 要求):逐动作记录上游来源与许可
  const lines = [
    "# 动作示范图来源与许可",
    "",
    "本目录下的 SVG 来自 [workout-guide](https://github.com/bryllim/workout-guide)(作者 Bryl Lim),",
    "原图来自 [Everkinetic](https://github.com/everkinetic/data),授权协议为",
    "[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。",
    "文件未做修改,按原样分发。",
    "",
    "| slug | 上游动作 | 对应中文动作 | 上游来源 |",
    "| --- | --- | --- | --- |",
  ];
  for (const [slug, { upstream, zhNames }] of bySlug) {
    const origin = upstream.attribution?.source?.url ?? "https://github.com/everkinetic/data";
    lines.push(`| ${slug} | ${upstream.name} | ${zhNames.join(" / ")} | ${origin} |`);
  }
  lines.push("");
  await fs.writeFile(path.join(OUT_DIR, "ATTRIBUTION.md"), lines.join("\n"));

  console.log(`动作 ${entries.length} 个 / 唯一插画 ${bySlug.size} 组 / 文件 ${jobs.length} 个`);
  console.log(`总体积 ${(bytes / 1024 / 1024).toFixed(2)} MB`);
};

await main();
