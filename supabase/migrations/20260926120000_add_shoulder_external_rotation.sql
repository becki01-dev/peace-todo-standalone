-- 收录「哑铃肩外旋」(Dumbbell Shoulder External Rotation)
-- 背景:该动作此前只以标准学名 90-Degree Abducted Dumbbell External Rotation 存在历史数据里,
-- 动作库(见 src/fit/exerciseCatalog.ts)现已收录为「哑铃肩外旋」,这里补字典映射:
-- 让原始英文名、常见叫法与中文变体都归一到该规范名(仅显示层归一,历史数据不动)。
-- 说明:Cuban Press(古巴推举)是含上举的复合动作,不映射到这里;只收 Cuban Rotation。
-- 幂等:ON CONFLICT (kind, key) DO NOTHING。

insert into public.exercise_dictionary (kind, key, value) values
  -- 中文规范名 → 显示英文
  ('en', '哑铃肩外旋', 'Dumbbell Shoulder External Rotation'),
  -- 英文别名 → 中文规范名(键全小写)
  ('alias', '90-degree abducted dumbbell external rotation', '哑铃肩外旋'),
  ('alias', 'dumbbell shoulder external rotation', '哑铃肩外旋'),
  ('alias', 'shoulder external rotation', '哑铃肩外旋'),
  ('alias', 'dumbbell external rotation', '哑铃肩外旋'),
  ('alias', 'external rotation', '哑铃肩外旋'),
  ('alias', 'cuban rotation', '哑铃肩外旋'),
  -- 中文变体 → 中文规范名
  ('zh_alias', '肩外旋', '哑铃肩外旋'),
  ('zh_alias', '古巴旋转', '哑铃肩外旋')
on conflict (kind, key) do nothing;
