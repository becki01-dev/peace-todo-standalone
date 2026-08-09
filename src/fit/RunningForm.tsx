import { forwardRef, useImperativeHandle, useState } from "react";
import {
  DistanceField,
  DurationField,
  MoodField,
  LEGACY_DEFAULT_UNITS,
  type WorkoutSubformHandle,
} from "./WorkoutFormFields";
import { distanceInputToMeters, hmsToSeconds } from "./units";
import type { DistanceUnit, RunningData } from "./types";
import type { Json } from "@/integrations/supabase/types";

interface Props {
  /** 编辑/复制模式下的原记录数据;新建时为 undefined */
  initialValues?: RunningData;
  /** 偏好默认单位(新建时使用) */
  initialUnit: DistanceUnit;
}

/** 跑步子表单:距离/单位/时长/心情 */
export const RunningForm = forwardRef<WorkoutSubformHandle, Props>(function RunningForm(
  { initialValues, initialUnit },
  ref,
) {
  const [runDistance, setRunDistance] = useState(() => {
    if (!initialValues) return "";
    const unit = initialValues.input_unit ?? LEGACY_DEFAULT_UNITS.distance;
    return (initialValues.distance_meters / (unit === "mi" ? 1609.344 : 1000)).toFixed(2);
  });
  const [runUnit, setRunUnit] = useState<DistanceUnit>(() => initialValues?.input_unit ?? initialUnit);
  const [mood, setMood] = useState(initialValues?.mood || 3);
  const [hours, setHours] = useState(() =>
    initialValues ? String(Math.floor(initialValues.duration_seconds / 3600)) : "0",
  );
  const [minutes, setMinutes] = useState(() =>
    initialValues ? String(Math.floor((initialValues.duration_seconds % 3600) / 60)) : "",
  );
  const [seconds, setSeconds] = useState(() =>
    initialValues ? String(initialValues.duration_seconds % 60) : "0",
  );

  useImperativeHandle(ref, () => ({
    buildData: (): { ok: true; data: Json } | { ok: false; error: string } => {
      const d = parseFloat(runDistance);
      const dur = hmsToSeconds(+hours, +minutes, +seconds);
      if (!d || !dur) return { ok: false, error: "请填写距离和时长" };
      return {
        ok: true,
        data: {
          distance_meters: distanceInputToMeters(d, runUnit),
          duration_seconds: dur,
          mood,
          input_unit: runUnit,
        },
      };
    },
  }));

  return (
    <>
      <DistanceField
        label="距离"
        value={runDistance}
        onChange={setRunDistance}
        unit={runUnit}
        onUnit={(u) => setRunUnit(u as DistanceUnit)}
        units={["km", "mi"]}
      />
      <DurationField h={hours} m={minutes} s={seconds} setH={setHours} setM={setMinutes} setS={setSeconds} />
      <MoodField value={mood} onChange={setMood} />
    </>
  );
});
