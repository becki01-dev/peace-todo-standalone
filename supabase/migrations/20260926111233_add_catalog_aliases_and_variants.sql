-- 补齐动作参考库新收录动作的字典映射
-- 背景:2026-09-26 起 src/fit/exerciseCatalog.ts 新增 12 个原本只在历史数据里的动作
-- (器械推胸/哈克深蹲/飞鸟/背伸展/提踵/前臂支撑举腿/臂屈伸/弓步/上台阶/哑铃上台阶/哑铃划船/哑铃弓步跳)。
-- 这些动作的 en 与大部分英文别名此前已在字典里,这里只补缺口:
--   1) 英文别名(键全小写),让英文输入能归一化成中文规范名;
--   2) 中文变体,把历史里出现过但只是叫法不同的动作挂到标准动作上。
-- 幂等:ON CONFLICT (kind, key) DO NOTHING。

insert into public.exercise_dictionary (kind, key, value) values
  -- 英文别名 → 中文规范名
  ('alias', 'machine chest press', '器械推胸'),
  ('alias', 'forearm-supported leg raise', '前臂支撑举腿'),
  ('alias', 'forearm supported leg raise', '前臂支撑举腿'),
  ('alias', 'captains chair leg raise', '前臂支撑举腿'),
  ('alias', 'captain''s chair leg raise', '前臂支撑举腿'),
  ('alias', 'dumbbell row', '哑铃划船'),
  ('alias', 'one arm dumbbell row', '哑铃划船'),
  ('alias', 'single arm dumbbell row', '哑铃划船'),
  ('alias', 'step-up', '上台阶'),
  ('alias', 'dumbbell step up', '哑铃上台阶'),
  -- 中文变体 → 中文规范名
  ('zh_alias', '保加利亚深蹲', '保加利亚分腿蹲'),
  ('zh_alias', '屈膝悬挂提腿', '悬垂举腿')
on conflict (kind, key) do nothing;
