-- Add foreign key constraints to workouts and user_preferences
-- for referential integrity with auth.users

ALTER TABLE public.workouts
  ADD CONSTRAINT fk_workouts_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT fk_user_preferences_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE;
