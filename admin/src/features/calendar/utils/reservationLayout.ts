import type { CalendarReservation } from "../types/calendar";

/**
 * Calculate the position and width of a reservation block in the calendar grid.
 * Returns left offset (columns from start) and width (number of columns).
 */
export function getReservationPosition(
  reservation: CalendarReservation,
  dates: string[]
): { left: number; width: number; visible: boolean } {
  if (dates.length === 0) {
    return { left: 0, width: 0, visible: false };
  }

  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  // Reservation is entirely outside the visible range
  if (reservation.check_out_date <= rangeStart || reservation.check_in_date > rangeEnd) {
    return { left: 0, width: 0, visible: false };
  }

  // Calculate left offset
  const startIdx = dates.indexOf(reservation.check_in_date);
  const left = startIdx >= 0 ? startIdx : 0;

  // Calculate width
  const endIdx = dates.indexOf(reservation.check_out_date);
  const effectiveEnd = endIdx >= 0 ? endIdx : dates.length;
  const effectiveStart = startIdx >= 0 ? startIdx : 0;
  const width = effectiveEnd - effectiveStart;

  return { left, width: Math.max(width, 1), visible: true };
}

/**
 * Group reservations by property ID for efficient rendering.
 */
export function groupReservationsByProperty(
  reservations: CalendarReservation[]
): Map<number, CalendarReservation[]> {
  const map = new Map<number, CalendarReservation[]>();

  for (const r of reservations) {
    const propId = r.internal_prop_id;
    if (propId == null) continue;
    const existing = map.get(propId);
    if (existing) {
      existing.push(r);
    } else {
      map.set(propId, [r]);
    }
  }

  return map;
}
