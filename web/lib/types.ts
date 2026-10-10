export interface Credential {
  accessToken: string;
  refreshToken: string;
  bearerType: string;
  expiresAt: string;
}

export interface OpeningHour {
  weekday: number;
  open: string;
  close: string;
}

export interface Rating {
  average: number;
  total: number;
}

export interface Person {
  id: string;
  name: string;
}

export interface RestaurantSummary {
  id: number;
  name: string;
  address: string;
  description: string | null;
  imageUrl: string | null;
  seatingCapacity: number;
  cancellationLeadMinutes: number;
  owner: Person;
  rating: Rating;
}

export type RestaurantDetail = RestaurantSummary & {
  openingHours: OpeningHour[];
  isOwner: boolean;
  myReview: { id: number; rating: number; comment: string } | null;
};

export interface ListResponse<T> {
  total: number;
  results: T[];
}

export type ReservationStatus = "confirmed" | "cancelled";

export interface MyReservation {
  id: number;
  restaurant: { id: number; name: string };
  startAt: string;
  endAt: string;
  guests: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface OwnerReservation {
  id: number;
  customer: Person;
  startAt: string;
  endAt: string;
  guests: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  user: Person;
  createdAt: string;
  updatedAt: string;
}

export interface SaveRestaurantInput {
  name: string;
  address: string;
  description?: string;
  seatingCapacity: number;
  cancellationLeadMinutes: number;
  openingHours: OpeningHour[];
}

export interface SaveReservationInput {
  startAt: string;
  endAt: string;
  guests: number;
}

/** `GET /users/me`. `name` is missing when Keycloak gave none. */
export interface Me {
  id: string;
  name?: string;
  email: string;
  imageUrl: string | null;
  bio: string | null;
}

/** One of the caller's own reviews (`GET /reviews`), naming the restaurant it is about. */
export interface MyReview {
  id: number;
  rating: number;
  comment: string;
  restaurant: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  bookedGuests: number;
  remainingSeats: number;
}

/** `GET /restaurants/{id}/availability`: a display snapshot, never the authority on whether a booking fits. */
export interface Availability {
  date: string;
  closed: boolean;
  capacity: number;
  slots: AvailabilitySlot[];
}
