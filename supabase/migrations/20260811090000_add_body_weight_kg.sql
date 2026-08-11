-- bodyweight 计入总重量:user_preferences 加体重列(kg 存储,可空)
-- 参照 P3-2 枚举迁移套路(2026-08-11 需在控制台手动执行)

alter table public.user_preferences
  add column body_weight_kg numeric;

alter table public.user_preferences
  add constraint user_preferences_body_weight_kg_check
  check (body_weight_kg is null or body_weight_kg > 0);
