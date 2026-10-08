package reservation

import "time"

// Booking is a reservation reduced to what the capacity check needs. It covers the
// half-open interval [Start, End): a booking that ends at 12:00 does not overlap one that
// starts at 12:00.
type Booking struct {
	Start, End time.Time
	Guests     int
}

func (b Booking) activeAt(moment time.Time) bool {
	return !moment.Before(b.Start) && moment.Before(b.End)
}

// PeakGuests returns the most guests that would be in the restaurant at the same moment while
// the candidate is seated: the candidate's own guests plus the existing bookings that are
// active at that moment, maximised over the candidate's span.
//
// The count only changes when a booking starts, so it is enough to look at the candidate's start
// and at the start of every existing booking that falls inside the candidate's span.
// Summing every overlapping booking instead would reject bookings that fit, such as 10:00-12:00
// plus 12:00-14:00 next to a candidate at 11:00-13:00.
func PeakGuests(existing []Booking, candidate Booking) int {
	checkpoints := []time.Time{candidate.Start}
	for _, booking := range existing {
		if !booking.Start.Before(candidate.Start) && booking.Start.Before(candidate.End) {
			checkpoints = append(checkpoints, booking.Start)
		}
	}

	peak := 0
	for _, moment := range checkpoints {
		present := 0
		for _, booking := range existing {
			if booking.activeAt(moment) {
				present += booking.Guests
			}
		}
		peak = max(peak, present)
	}

	return peak + candidate.Guests
}
