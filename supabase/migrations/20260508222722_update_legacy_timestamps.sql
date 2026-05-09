-- 迁移文件：为旧记录生成合理的随机时间
-- 创建时间：2026-05-08
-- 说明：将所有时间为 12:00:00 的旧记录更新为随机的合理时间（8:00-20:00）

-- 为所有 date 字段时间为 12:00:00 的记录生成随机时间
-- 使用 random() 函数生成 8-20 之间的小时和 0-59 之间的分钟
UPDATE workouts
SET date = (
  DATE_TRUNC('day', date) + 
  INTERVAL '1 hour' * FLOOR(8 + random() * 13) +  -- 8-20 点之间
  INTERVAL '1 minute' * FLOOR(random() * 60)       -- 0-59 分之间
)::timestamp with time zone
WHERE EXTRACT(HOUR FROM date) = 12 
  AND EXTRACT(MINUTE FROM date) = 0 
  AND EXTRACT(SECOND FROM date) = 0;
