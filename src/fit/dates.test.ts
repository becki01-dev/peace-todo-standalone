import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { todayYmd, currentTimeHm } from "./dates";

describe("todayYmd / currentTimeHm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local time 2026-08-08 15:30
    vi.setSystemTime(new Date(2026, 7, 8, 15, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero-padded local date", () => {
    expect(todayYmd()).toBe("2026-08-08");
  });

  it("zero-pads month and day", () => {
    vi.setSystemTime(new Date(2026, 0, 3, 9, 5, 0));
    expect(todayYmd()).toBe("2026-01-03");
    expect(currentTimeHm()).toBe("09:05");
  });

  it("returns current time as HH:MM", () => {
    expect(currentTimeHm()).toBe("15:30");
  });
});
