ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_type_check;

ALTER TABLE public.workouts ADD CONSTRAINT workouts_type_check CHECK (type IN ('running', 'swimming', 'strength', 'swimming_set'));