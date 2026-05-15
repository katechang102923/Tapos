import type { BusinessDayHours, BusinessSchedule, Store, WeekdayKey } from "./types";

export const weekdayKeys: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const weekdayLabels: Record<WeekdayKey, string> = {
  mon: "週一",
  tue: "週二",
  wed: "週三",
  thu: "週四",
  fri: "週五",
  sat: "週六",
  sun: "週日"
};

const defaultDay: BusinessDayHours = { enabled: true, start: "06:00", end: "14:00" };

export function defaultBusinessSchedule(): BusinessSchedule {
  return weekdayKeys.reduce((schedule, key) => {
    schedule[key] = { ...defaultDay };
    return schedule;
  }, {} as BusinessSchedule);
}

export function normalizeBusinessSchedule(schedule?: Partial<BusinessSchedule>): BusinessSchedule {
  const fallback = defaultBusinessSchedule();
  return weekdayKeys.reduce((next, key) => {
    const day = schedule?.[key];
    next[key] = {
      enabled: day?.enabled ?? fallback[key].enabled,
      start: validTime(day?.start) ? day!.start : fallback[key].start,
      end: validTime(day?.end) ? day!.end : fallback[key].end
    };
    return next;
  }, {} as BusinessSchedule);
}

export function isWithinBusinessHours(schedule?: Partial<BusinessSchedule>, date = new Date()) {
  const normalized = normalizeBusinessSchedule(schedule);
  const jsDay = date.getDay();
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();

  const today = normalized[weekdayKeys[todayIndex]];
  if (dayContains(today, nowMinutes, false)) return true;

  const prevIndex = todayIndex === 0 ? 6 : todayIndex - 1;
  const previous = normalized[weekdayKeys[prevIndex]];
  return dayContains(previous, nowMinutes, true);
}

export function businessOrderBlockReason(store: Store | undefined, channel: "takeout" | "dine-in" | "pos") {
  if (!store || !store.isOpen || store.orderStatus === "closed" || store.temporaryClosed) return "店家休息中，暫停接單";
  if (isClosedDate(store.closedDates)) return "今日公休，暫停接單";
  if (store.orderStatus === "paused" || store.temporaryPaused) return "目前暫停接單，請稍候再試";
  if (channel === "takeout" && (store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true) === false) return "目前暫停外帶 QR 接單，請稍候再試";
  if (channel === "dine-in" && (store.dineInOrderingEnabled ?? store.dineInEnabled ?? true) === false) return "目前暫停內用 QR 接單，請稍候再試";
  if (channel === "pos" && (store.posOrderingEnabled ?? true) === false) return "POS 現場單目前暫停建立";
  if (!isWithinBusinessHours(store.businessSchedule) && !(channel === "pos" && store.allowPosOutsideBusinessHours)) {
    return "目前非營業時間，暫停接單";
  }
  return "";
}

export function businessScheduleSummary(schedule?: Partial<BusinessSchedule>) {
  const normalized = normalizeBusinessSchedule(schedule);
  const openDays = weekdayKeys.filter((key) => normalized[key].enabled);
  if (openDays.length === 0) return "營業時間未設定";
  const groups: Array<{ startIndex: number; endIndex: number; start: string; end: string }> = [];
  openDays.forEach((key) => {
    const index = weekdayKeys.indexOf(key);
    const day = normalized[key];
    const last = groups[groups.length - 1];
    if (last && last.endIndex + 1 === index && last.start === day.start && last.end === day.end) {
      last.endIndex = index;
    } else {
      groups.push({ startIndex: index, endIndex: index, start: day.start, end: day.end });
    }
  });
  return groups.map((group) => {
    const dayLabel = group.startIndex === group.endIndex
      ? weekdayLabels[weekdayKeys[group.startIndex]]
      : `${weekdayLabels[weekdayKeys[group.startIndex]]}至${weekdayLabels[weekdayKeys[group.endIndex]]}`;
    return `${dayLabel} ${group.start}–${group.end}`;
  }).join("、");
}

export function isClosedDate(closedDates: string[] | undefined, date = new Date()) {
  if (!closedDates?.length) return false;
  return closedDates.includes(localDateKey(date));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validTime(value?: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dayContains(day: BusinessDayHours, nowMinutes: number, previousDayCarry: boolean) {
  if (!day.enabled) return false;
  const start = toMinutes(day.start);
  const end = toMinutes(day.end);
  if (start === end) return true;
  if (start < end) return !previousDayCarry && nowMinutes >= start && nowMinutes <= end;
  return previousDayCarry ? nowMinutes <= end : nowMinutes >= start;
}
