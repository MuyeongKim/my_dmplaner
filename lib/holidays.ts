interface PublicHolidayResponse {
  date: string;
  localName: string;
  name: string;
}

const HOLIDAY_API_BASE = "https://date.nager.at/api/v3/PublicHolidays";
const COUNTRY_CODE = "KR";

const holidayCache = new Map<number, Record<string, string>>();

async function fetchYearHolidays(year: number): Promise<Record<string, string>> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  const response = await fetch(`${HOLIDAY_API_BASE}/${year}/${COUNTRY_CODE}`);
  if (!response.ok) {
    throw new Error(`공휴일 데이터를 불러오지 못했습니다. (${year})`);
  }

  const payload = (await response.json()) as PublicHolidayResponse[];
  const mapped = Object.fromEntries(
    payload.map((item) => [item.date, item.localName || item.name || "공휴일"]),
  );
  holidayCache.set(year, mapped);
  return mapped;
}

export async function loadHolidayMap(dates: Date[]): Promise<Record<string, string>> {
  if (dates.length === 0) {
    return {};
  }

  const years = [...new Set(dates.map((date) => date.getFullYear()))];
  const results = await Promise.all(years.map((year) => fetchYearHolidays(year)));

  const merged: Record<string, string> = {};
  for (const item of results) {
    Object.assign(merged, item);
  }

  return merged;
}

export function normalizeHolidayInput(input: string): string[] {
  return [...new Set(input.split(",").map((item) => item.trim()).filter(Boolean))].filter(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  );
}

export function toHolidayMap(dateKeys: string[]): Record<string, string> {
  return Object.fromEntries(dateKeys.map((key) => [key, "임시공휴일"]));
}
