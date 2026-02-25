import { TimelineData, PersonData } from "@/types/timeline";

/**
 * Group people by category, preserving first-appearance order.
 * Within each group, people are sorted by birth year.
 */
export function groupByCategory(data: TimelineData): Map<string, PersonData[]> {
  const map = new Map<string, PersonData[]>();
  for (const person of data) {
    const bucket = map.get(person.category);
    if (bucket) {
      bucket.push(person);
    } else {
      map.set(person.category, [person]);
    }
  }
  for (const people of map.values()) {
    people.sort((a, b) => a.birth_year - b.birth_year);
  }
  return map;
}

/**
 * Compute a padded [minYear, maxYear] range across all people.
 * Padding is 4% of the raw range, minimum 5 years.
 */
export function getYearRange(
  data: TimelineData,
  currentYear = 2026
): [number, number] {
  const years = data.flatMap((p) => [
    p.birth_year,
    p.death_year ?? currentYear,
  ]);
  const rawMin = Math.min(...years);
  const rawMax = Math.max(...years);
  const range = rawMax - rawMin || 100;
  const pad = Math.max(5, Math.round(range * 0.04));
  return [rawMin - pad, rawMax + pad];
}

/**
 * Pick a round tick interval appropriate for the given year range.
 */
export function getTickInterval(range: number): number {
  if (range > 4000) return 1000;
  if (range > 2000) return 500;
  if (range > 800)  return 200;
  if (range > 300)  return 100;
  if (range > 120)  return 50;
  if (range > 50)   return 25;
  return 10;
}

/**
 * Generate evenly-spaced tick years within [minYear, maxYear].
 */
export function getTicks(
  minYear: number,
  maxYear: number,
  interval: number
): number[] {
  const start = Math.ceil(minYear / interval) * interval;
  const ticks: number[] = [];
  for (let y = start; y <= maxYear; y += interval) {
    ticks.push(y);
  }
  return ticks;
}
