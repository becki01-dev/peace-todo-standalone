-- 迁移文件：更新旧游泳和力量训练记录的单位默认值
-- 创建时间：2026-05-07
-- 说明：将旧记录的 input_unit 字段更新为规范要求的固定默认值

-- 更新游泳记录：将 input_unit 为 "m" 或不存在的情况更新为 "yd"
UPDATE workouts
SET data = jsonb_set(
  data,
  '{input_unit}',
  '"yd"'::jsonb
)
WHERE type = 'swimming'
  AND (
    data->>'input_unit' IS NULL 
    OR data->>'input_unit' = 'm'
  );

-- 更新游泳多片段记录：将每个片段的 input_unit 为 "m" 或不存在的情况更新为 "yd"
UPDATE workouts
SET data = jsonb_set(
  data,
  '{sets}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'input_unit' IS NULL OR elem->>'input_unit' = 'm'
        THEN jsonb_set(elem, '{input_unit}', '"yd"'::jsonb)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(data->'sets') AS elem
  )
)
WHERE type = 'swimming'
  AND data ? 'sets'
  AND jsonb_typeof(data->'sets') = 'array';

-- 更新力量训练记录：将 input_unit 为 "kg" 或不存在的情况更新为 "lb"
UPDATE workouts
SET data = jsonb_set(
  data,
  '{input_unit}',
  '"lb"'::jsonb
)
WHERE type = 'strength'
  AND (
    data->>'input_unit' IS NULL 
    OR data->>'input_unit' = 'kg'
  );

-- 更新力量训练会话模式：将每个动作的 input_unit 为 "kg" 或不存在的情况更新为 "lb"
UPDATE workouts
SET data = jsonb_set(
  data,
  '{exercises}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'input_unit' IS NULL OR elem->>'input_unit' = 'kg'
        THEN jsonb_set(elem, '{input_unit}', '"lb"'::jsonb)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(data->'exercises') AS elem
  )
)
WHERE type = 'strength'
  AND data ? 'exercises'
  AND jsonb_typeof(data->'exercises') = 'array';

-- 更新跑步记录：将 input_unit 为 "km" 或不存在的情况更新为 "mile"
UPDATE workouts
SET data = jsonb_set(
  data,
  '{input_unit}',
  '"mile"'::jsonb
)
WHERE type = 'running'
  AND (
    data->>'input_unit' IS NULL 
    OR data->>'input_unit' = 'km'
  );
