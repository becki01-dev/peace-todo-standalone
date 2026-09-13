-- 动作参考页 v1 配套:补 catalog 新动作的全局命名映射 + 拆分重名变式
-- 目标:
--   1) 新规范名补 alias(英文->中文)与 en(中文->英文显示)
--   2) 把以前被合并的变式拆成独立动作:front/goblet squat、hip thrust、sumo deadlift、站姿/坐姿提踵
--   3) 幂等:on conflict (kind,key) do update set value=excluded.value, updated_at=now()
-- 注意:只影响以后的英文输入归一化;已入库的历史记录保持原样(不强行回填)。

begin;

insert into public.exercise_dictionary (kind, key, value) values
  -- 拆分:深蹲变式
  ('alias', 'front squat', '前蹲'),
  ('alias', 'front squats', '前蹲'),
  ('alias', 'goblet squat', '高脚杯深蹲'),
  ('alias', 'goblet squats', '高脚杯深蹲'),
  -- 拆分:硬拉变式
  ('alias', 'sumo deadlift', '相扑硬拉'),
  ('alias', 'sumo deadlifts', '相扑硬拉'),
  ('alias', 'romanian deadlift', '罗马尼亚硬拉'),
  ('alias', 'romanian deadlifts', '罗马尼亚硬拉'),
  ('alias', 'rdl', '罗马尼亚硬拉'),
  -- 拆分:臀桥/臀推
  ('alias', 'hip thrust', '臀推'),
  ('alias', 'hip thrusts', '臀推'),
  ('alias', 'barbell hip thrust', '臀推'),
  -- 拆分:小腿
  ('alias', 'standing calf raise', '站姿提踵'),
  ('alias', 'standing calf raises', '站姿提踵'),
  ('alias', 'standing calf', '站姿提踵'),
  ('alias', 'seated calf raise', '坐姿提踵'),
  ('alias', 'seated calf raises', '坐姿提踵'),
  ('alias', 'seated calf', '坐姿提踵'),
  -- 新动作:背/肩
  ('alias', 'face pull', '面拉'),
  ('alias', 'face pulls', '面拉'),
  ('alias', 'farmer''s carry', '农夫行走'),
  ('alias', 'farmers carry', '农夫行走'),
  ('alias', 'farmer carry', '农夫行走'),
  ('alias', 'farmer''s walk', '农夫行走'),
  ('alias', 'farmers walk', '农夫行走'),
  ('alias', 'good morning', '早安式'),
  ('alias', 'good mornings', '早安式'),
  -- 新动作:胸/手臂
  ('alias', 'incline dumbbell fly', '上斜哑铃飞鸟'),
  ('alias', 'incline dumbbell flies', '上斜哑铃飞鸟'),
  ('alias', 'incline fly', '上斜哑铃飞鸟'),
  ('alias', 'decline bench press', '下斜卧推'),
  ('alias', 'decline bench', '下斜卧推'),
  ('alias', 'decline press', '下斜卧推'),
  ('alias', 'close-grip bench press', '窄距卧推'),
  ('alias', 'close grip bench press', '窄距卧推'),
  ('alias', 'close-grip bench', '窄距卧推'),
  ('alias', 'cgbp', '窄距卧推'),
  ('alias', 'reverse curl', '反向弯举'),
  ('alias', 'reverse curls', '反向弯举'),
  -- 新动作:核心
  ('alias', 'cable crunch', '绳索卷腹'),
  ('alias', 'cable crunches', '绳索卷腹'),
  ('alias', 'hanging leg raise', '悬垂举腿'),
  ('alias', 'hanging leg raises', '悬垂举腿'),
  ('alias', 'side plank', '侧平板'),
  ('alias', 'side planks', '侧平板'),
  -- 新动作:臀/腿
  ('alias', 'clamshell', '蚌式'),
  ('alias', 'clamshells', '蚌式'),
  ('alias', 'sumo squat', '相扑深蹲'),
  ('alias', 'sumo squats', '相扑深蹲'),
  ('alias', 'leg press calf raise', '腿举提踵'),
  ('alias', 'leg press calf raises', '腿举提踵'),
  ('alias', 'bent-knee calf raise', '屈膝提踵'),
  ('alias', 'bent knee calf raise', '屈膝提踵'),
  ('alias', 'bent-knee calf raises', '屈膝提踵'),
  -- 新动作:肩/全身/颈
  ('alias', 'cable lateral raise', '绳索侧平举'),
  ('alias', 'cable lateral raises', '绳索侧平举'),
  ('alias', 'kettlebell swing', '壶铃摆荡'),
  ('alias', 'kettlebell swings', '壶铃摆荡'),
  ('alias', 'kb swing', '壶铃摆荡'),
  ('alias', 'neck flexion', '颈部屈伸'),
  ('alias', 'neck extension', '颈部屈伸'),
  ('alias', 'neck flexion/extension', '颈部屈伸'),
  -- 中文变体(仅显示层,不改数据)
  ('zh_alias', '臀冲', '臀推'),
  ('zh_alias', '壶铃摆动', '壶铃摆荡'),
  ('zh_alias', '蚌式开合', '蚌式'),
  ('zh_alias', '侧桥', '侧平板'),
  ('zh_alias', '上斜飞鸟', '上斜哑铃飞鸟'),
  ('zh_alias', '下斜推胸', '下斜卧推'),
  ('zh_alias', '窄距推胸', '窄距卧推'),
  ('zh_alias', '悬垂抬腿', '悬垂举腿'),
  ('zh_alias', '农夫走', '农夫行走'),
  -- 新规范名的英文显示
  ('en', '前蹲', 'Front Squat'),
  ('en', '高脚杯深蹲', 'Goblet Squat'),
  ('en', '相扑硬拉', 'Sumo Deadlift'),
  ('en', '罗马尼亚硬拉', 'Romanian Deadlift'),
  ('en', '臀推', 'Hip Thrust'),
  ('en', '站姿提踵', 'Standing Calf Raise'),
  ('en', '坐姿提踵', 'Seated Calf Raise'),
  ('en', '面拉', 'Face Pull'),
  ('en', '农夫行走', 'Farmer''s Carry'),
  ('en', '早安式', 'Good Morning'),
  ('en', '上斜哑铃飞鸟', 'Incline Dumbbell Fly'),
  ('en', '下斜卧推', 'Decline Bench Press'),
  ('en', '窄距卧推', 'Close-Grip Bench Press'),
  ('en', '反向弯举', 'Reverse Curl'),
  ('en', '绳索卷腹', 'Cable Crunch'),
  ('en', '悬垂举腿', 'Hanging Leg Raise'),
  ('en', '侧平板', 'Side Plank'),
  ('en', '蚌式', 'Clamshell'),
  ('en', '相扑深蹲', 'Sumo Squat'),
  ('en', '腿举提踵', 'Leg Press Calf Raise'),
  ('en', '屈膝提踵', 'Bent-Knee Calf Raise'),
  ('en', '绳索侧平举', 'Cable Lateral Raise'),
  ('en', '壶铃摆荡', 'Kettlebell Swing'),
  ('en', '颈部屈伸', 'Neck Flexion/Extension')
on conflict (kind, key) do update
  set value = excluded.value,
      updated_at = now();

commit;