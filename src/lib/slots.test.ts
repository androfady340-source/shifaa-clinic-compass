import { describe, expect, it } from "vitest";
import { generateSlots, isSlotPast, weekdayOf } from "./slots";

describe("booking slots", () => {
  it("splits a doctor's hours into slots of his chosen length, only full slots", () => {
    expect(generateSlots([{ start_time: "17:00", end_time: "18:10" }], 20)).toEqual(["17:00", "17:20", "17:40"]);
  });

  it("merges several ranges in order", () => {
    expect(generateSlots([{ start_time: "18:00", end_time: "18:30" }, { start_time: "10:00", end_time: "10:30" }], 30)).toEqual([
      "10:00",
      "18:00",
    ]);
  });

  it("treats a slot as past using Cairo time", () => {
    // 2026-10-21 10:00 UTC = 13:00 Cairo
    const now = new Date("2026-10-21T10:00:00Z");
    expect(isSlotPast("2026-10-21", "12:40", now)).toBe(true);
    expect(isSlotPast("2026-10-21", "13:20", now)).toBe(false);
    expect(isSlotPast("2026-10-22", "08:00", now)).toBe(false);
  });

  it("uses Sunday = 0 like the database", () => {
    expect(weekdayOf("2026-10-25")).toBe(0);
  });
});
