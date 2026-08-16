-- 力量训练动作名统一:历史英文动作名 → 中文规范名(双语显示配套)
-- 前端配套:src/fit/exerciseLib.ts 的 EXERCISE_ALIASES(两端映射集合必须一致,增改需同步)
-- 幂等:重复执行无副作用(二次运行时已无英文名可匹配)
-- (2026-08-15 需在控制台手动执行)

-- 0) 映射表:英文小写 → 中文规范名 → 预设部位(body_part 修正用)
create temp table alias_map (
  en text primary key,
  zh text not null,
  part text not null
);

insert into alias_map (en, zh, part) values
  ('squat', '深蹲', 'legs'), ('squats', '深蹲', 'legs'),
  ('back squat', '深蹲', 'legs'), ('goblet squat', '深蹲', 'legs'),
  ('front squat', '深蹲', 'legs'), ('bodyweight squat', '深蹲', 'legs'),
  ('air squat', '深蹲', 'legs'),
  ('deadlift', '硬拉', 'back'), ('deadlifts', '硬拉', 'back'),
  ('conventional deadlift', '硬拉', 'back'), ('sumo deadlift', '硬拉', 'back'),
  ('bench press', '卧推', 'chest'), ('benchpress', '卧推', 'chest'), ('bench', '卧推', 'chest'),
  ('pull-up', '引体向上', 'back'), ('pull up', '引体向上', 'back'),
  ('pullup', '引体向上', 'back'), ('pullups', '引体向上', 'back'),
  ('chin-up', '引体向上', 'back'), ('chin up', '引体向上', 'back'),
  ('chinup', '引体向上', 'back'), ('chinups', '引体向上', 'back'), ('chin ups', '引体向上', 'back'),
  ('push-up', '俯卧撑', 'chest'), ('push up', '俯卧撑', 'chest'),
  ('pushup', '俯卧撑', 'chest'), ('pushups', '俯卧撑', 'chest'),
  ('press-up', '俯卧撑', 'chest'), ('press up', '俯卧撑', 'chest'),
  ('overhead press', '肩推', 'shoulders'), ('ohp', '肩推', 'shoulders'),
  ('shoulder press', '肩推', 'shoulders'), ('military press', '肩推', 'shoulders'),
  ('strict press', '肩推', 'shoulders'),
  ('barbell row', '划船', 'back'), ('bent-over row', '划船', 'back'),
  ('bent over row', '划船', 'back'), ('bentover row', '划船', 'back'), ('rows', '划船', 'back'),
  ('lunge', '弓步', 'legs'), ('lunges', '弓步', 'legs'),
  ('walking lunge', '弓步', 'legs'), ('walking lunges', '弓步', 'legs'), ('forward lunge', '弓步', 'legs'),
  ('bicep curl', '二头弯举', 'arms'), ('biceps curl', '二头弯举', 'arms'),
  ('bicep curls', '二头弯举', 'arms'), ('biceps curls', '二头弯举', 'arms'),
  ('curl', '二头弯举', 'arms'), ('curls', '二头弯举', 'arms'),
  ('barbell curl', '二头弯举', 'arms'), ('dumbbell curl', '二头弯举', 'arms'),
  ('crunch', '卷腹', 'core'), ('crunches', '卷腹', 'core'),
  ('sit-up', '卷腹', 'core'), ('sit up', '卷腹', 'core'),
  ('situp', '卷腹', 'core'), ('situps', '卷腹', 'core'),
  ('plank', '平板支撑', 'core'), ('planks', '平板支撑', 'core'),
  ('forearm plank', '平板支撑', 'core'), ('front plank', '平板支撑', 'core'),
  ('glute bridge', '臀桥', 'core'), ('glute bridges', '臀桥', 'core'),
  ('hip thrust', '臀桥', 'core'), ('hip thrusts', '臀桥', 'core'), ('hip bridge', '臀桥', 'core'),
  -- 预设 12 个之外的动作(与 exerciseLib.ts EXERCISE_ALIASES 同步)
  ('leg curl', '腿弯举', 'legs'), ('leg curls', '腿弯举', 'legs'),
  ('hamstring curl', '腿弯举', 'legs'), ('hamstring curls', '腿弯举', 'legs'),
  ('lying leg curl', '腿弯举', 'legs'), ('seated leg curl', '腿弯举', 'legs'),
  ('leg extension', '腿屈伸', 'legs'), ('leg extensions', '腿屈伸', 'legs'),
  ('leg ext', '腿屈伸', 'legs'), ('quad extension', '腿屈伸', 'legs'), ('quad extensions', '腿屈伸', 'legs'),
  ('leg press', '腿举', 'legs'), ('leg presses', '腿举', 'legs'), ('sled press', '腿举', 'legs'),
  ('calf raise', '提踵', 'legs'), ('calf raises', '提踵', 'legs'),
  ('standing calf raise', '提踵', 'legs'), ('seated calf raise', '提踵', 'legs'),
  ('lat pulldown', '高位下拉', 'back'), ('lat pulldowns', '高位下拉', 'back'),
  ('lat pull-down', '高位下拉', 'back'), ('lat pull down', '高位下拉', 'back'),
  ('pulldown', '高位下拉', 'back'),
  ('seated row', '坐姿划船', 'back'), ('seated rows', '坐姿划船', 'back'),
  ('cable row', '坐姿划船', 'back'), ('cable rows', '坐姿划船', 'back'),
  ('machine row', '坐姿划船', 'back'),
  ('reverse fly', '反向飞鸟', 'shoulders'), ('reverse flies', '反向飞鸟', 'shoulders'),
  ('rear delt fly', '反向飞鸟', 'shoulders'), ('rear delt raise', '反向飞鸟', 'shoulders'),
  ('incline bench press', '上斜卧推', 'chest'), ('incline press', '上斜卧推', 'chest'),
  ('incline bench', '上斜卧推', 'chest'),
  ('dumbbell press', '哑铃卧推', 'chest'), ('dumbbell bench press', '哑铃卧推', 'chest'),
  ('db press', '哑铃卧推', 'chest'), ('db bench press', '哑铃卧推', 'chest'),
  ('chest fly', '飞鸟', 'chest'), ('chest flies', '飞鸟', 'chest'),
  ('dumbbell fly', '飞鸟', 'chest'), ('dumbbell flies', '飞鸟', 'chest'),
  ('cable fly', '飞鸟', 'chest'), ('pec deck', '飞鸟', 'chest'), ('pec fly', '飞鸟', 'chest'),
  ('lateral raise', '侧平举', 'shoulders'), ('lateral raises', '侧平举', 'shoulders'),
  ('side raise', '侧平举', 'shoulders'), ('side raises', '侧平举', 'shoulders'),
  ('front raise', '前平举', 'shoulders'), ('front raises', '前平举', 'shoulders'),
  ('shrug', '耸肩', 'shoulders'), ('shrugs', '耸肩', 'shoulders'),
  ('dumbbell shrug', '耸肩', 'shoulders'), ('barbell shrug', '耸肩', 'shoulders'),
  ('hammer curl', '锤式弯举', 'arms'), ('hammer curls', '锤式弯举', 'arms'),
  ('tricep pushdown', '绳索下压', 'arms'), ('triceps pushdown', '绳索下压', 'arms'),
  ('tricep push down', '绳索下压', 'arms'), ('triceps push down', '绳索下压', 'arms'),
  ('pushdown', '绳索下压', 'arms'),
  ('tricep extension', '臂屈伸', 'arms'), ('triceps extension', '臂屈伸', 'arms'),
  ('tricep extensions', '臂屈伸', 'arms'), ('overhead tricep extension', '臂屈伸', 'arms'),
  ('skull crusher', '臂屈伸', 'arms'), ('skullcrusher', '臂屈伸', 'arms'),
  ('dip', '双杠臂屈伸', 'chest'), ('dips', '双杠臂屈伸', 'chest'),
  ('chest dip', '双杠臂屈伸', 'chest'), ('bench dip', '双杠臂屈伸', 'chest'),
  ('tricep dip', '双杠臂屈伸', 'chest'),
  ('russian twist', '俄罗斯转体', 'core'), ('russian twists', '俄罗斯转体', 'core'),
  ('russian crunch', '俄罗斯转体', 'core'), ('russian crunches', '俄罗斯转体', 'core'),
  ('oblique twist', '俄罗斯转体', 'core'),
  ('leg raise', '举腿', 'core'), ('leg raises', '举腿', 'core'),
  ('hanging leg raise', '举腿', 'core'), ('lying leg raise', '举腿', 'core'),
  ('burpee', '波比跳', 'full_body'), ('burpees', '波比跳', 'full_body'),
  ('back bend', '背伸展', 'back'), ('back bends', '背伸展', 'back');

-- 1) workouts.data.exercises[]:会话格式每个动作名
--    遍历模式照抄 20260507083114_update_legacy_input_units.sql(jsonb_agg + jsonb_array_elements + CASE)
--    精确匹配 lower(btrim(name)) = 别名,防止 "squat machine" 等被误伤;同训练内中英并存 → 各自保留组数据
update workouts w
set data = jsonb_set(
  w.data,
  '{exercises}',
  (
    select jsonb_agg(
      case
        when m.zh is not null then jsonb_set(elem, '{name}', to_jsonb(m.zh))
        else elem
      end
    )
    from jsonb_array_elements(w.data->'exercises') as elem
    left join alias_map m on lower(btrim(elem->>'name')) = m.en
  )
)
where w.type = 'strength'
  and w.data ? 'exercises'
  and jsonb_typeof(w.data->'exercises') = 'array';

-- 2) workouts.data.exercise:legacy 单动作名(会话单动作的兼容字段一并处理,幂等无碍;
--    "综合力量训练" 不在映射表,天然跳过;缺字段/null 由 jsonb_typeof 守卫)
update workouts w
set data = jsonb_set(w.data, '{exercise}', to_jsonb(m.zh))
from alias_map m
where w.type = 'strength'
  and jsonb_typeof(w.data->'exercise') = 'string'
  and lower(btrim(w.data->>'exercise')) = m.en;

-- 3) user_exercises:先删「同用户已有中文规范行」的英文行。
--    顺序必须在改名之前:否则 UPDATE 撞 unique(user_id, name) 报 23505(唯一约束按行即时检查)
delete from public.user_exercises u
using alias_map m
where lower(btrim(u.name)) = m.en
  and exists (
    select 1 from public.user_exercises c
    where c.user_id = u.user_id and c.name = m.zh
  );

-- 4) user_exercises:同用户多个英文别名映射同一中文 → 每 (user_id, zh) 只留一行。
--    优先保留非 full_body 行(用户改过部位的);全 full_body 时保留 updated_at 最新
with ranked as (
  select u.id,
         row_number() over (
           partition by u.user_id, m.zh
           order by (u.body_part = 'full_body') asc, u.updated_at desc, u.id
         ) as rn
  from public.user_exercises u
  join alias_map m on lower(btrim(u.name)) = m.en
)
delete from public.user_exercises where id in (select id from ranked where rn > 1);

-- 5) user_exercises:改名,并修正部位。
--    关键:英文名登记行 body_part 通常是 full_body(resolveBodyPart 兜底),若不动,统计 dict 优先会
--    把「深蹲」归到全身(统计回归);此处仅当原部位为 full_body 时改预设部位,用户显式设置过的保留
update public.user_exercises u
set name = m.zh,
    body_part = case
      when u.body_part = 'full_body' then m.part::public.body_part
      else u.body_part
    end,
    updated_at = now()
from alias_map m
where lower(btrim(u.name)) = m.en;

-- 6) 控制台核对(可选):
-- select count(*) from public.workouts
--   where type = 'strength' and data->>'exercise' ~* 'squat|bench|deadlift|curl|plank|crunch|lunge|row|pull|push|press|thrust|bridge';
-- select name, body_part, count(*) from public.user_exercises group by 1, 2 order by 3 desc;
