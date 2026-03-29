import { create } from "zustand";
import type { FSDSpot } from "@/lib/fsd-api";

interface FranklinState {
  selectedHour: number;
  selectedVenue: FSDSpot | null;
  venueSearch: string;
  amenityFilter: string | null;

  setHour: (hour: number) => void;
  selectVenue: (venue: FSDSpot | null) => void;
  setVenueSearch: (search: string) => void;
  setAmenityFilter: (filter: string | null) => void;
}

export const useFranklinStore = create<FranklinState>((set) => ({
  selectedHour: new Date().getHours(),
  selectedVenue: null,
  venueSearch: "",
  amenityFilter: null,

  setHour: (hour) => set({ selectedHour: hour, selectedVenue: null }),
  selectVenue: (venue) => set({ selectedVenue: venue }),
  setVenueSearch: (search) => set({ venueSearch: search }),
  setAmenityFilter: (filter) => set({ amenityFilter: filter }),
}));
