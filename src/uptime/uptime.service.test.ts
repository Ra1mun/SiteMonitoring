import { describe, expect, it } from "vitest";
import { calculateUptimePercentage } from "./uptime.service";

describe("calculateUptimePercentage", () => {
  it("возвращает null при отсутствии проверок", () => {
    expect(calculateUptimePercentage(0, 0)).toBeNull();
  });

  it("возвращает 100 при всех успешных проверках", () => {
    expect(calculateUptimePercentage(10, 10)).toBe(100);
  });

  it("возвращает 0 при всех неуспешных проверках", () => {
    expect(calculateUptimePercentage(10, 0)).toBe(0);
  });

  it("округляет процент до двух знаков после запятой", () => {
    expect(calculateUptimePercentage(3, 1)).toBe(33.33);
  });
});
