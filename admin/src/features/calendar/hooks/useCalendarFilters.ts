import { useState, useMemo } from "react";
import type {
  CalendarProperty,
  CalendarReservation,
  StatusFilter,
} from "../types/calendar";

interface FilterState {
  status: StatusFilter;
  region: string;
  search: string;
}

export function useCalendarFilters(
  properties: CalendarProperty[],
  reservations: CalendarReservation[]
) {
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    region: "all",
    search: "",
  });

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) {
      if (p.region) set.add(p.region);
    }
    return Array.from(set).sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // Status filter
      if (filters.status !== "all" && p.today_status !== filters.status) {
        return false;
      }
      // Region filter
      if (filters.region !== "all" && p.region !== filters.region) {
        return false;
      }
      // Search filter (property name)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const nameMatch = (p.display_name || p.name).toLowerCase().includes(q);
        // Also search guest names in reservations for this property
        const guestMatch = reservations.some(
          (r) =>
            r.internal_prop_id === p.id &&
            r.guest_name.toLowerCase().includes(q)
        );
        if (!nameMatch && !guestMatch) return false;
      }
      return true;
    });
  }, [properties, reservations, filters]);

  const filteredReservations = useMemo(() => {
    const propertyIds = new Set(filteredProperties.map((p) => p.id));
    return reservations.filter((r) => r.internal_prop_id != null && propertyIds.has(r.internal_prop_id));
  }, [reservations, filteredProperties]);

  return {
    filters,
    setStatus: (status: StatusFilter) =>
      setFilters((prev) => ({ ...prev, status })),
    setRegion: (region: string) =>
      setFilters((prev) => ({ ...prev, region })),
    setSearch: (search: string) =>
      setFilters((prev) => ({ ...prev, search })),
    regions,
    filteredProperties,
    filteredReservations,
  };
}
