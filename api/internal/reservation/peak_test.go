package reservation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// at builds a time on one fixed day so the cases below read as plain clock hours.
func at(hour, minute int) time.Time {
	return time.Date(2026, 10, 12, hour, minute, 0, 0, time.UTC)
}

func booking(startHour, endHour, guests int) Booking {
	return Booking{Start: at(startHour, 0), End: at(endHour, 0), Guests: guests}
}

func TestPeakGuests(t *testing.T) {
	cases := []struct {
		name      string
		existing  []Booking
		candidate Booking
		want      int
	}{
		{
			name:      "nobody else: just the candidate",
			candidate: booking(11, 13, 4),
			want:      4,
		},
		{
			// capacity 10: 16 guests overlap in total, but never more than 6 at once
			name:      "spec example: two bookings that never overlap each other",
			existing:  []Booking{booking(10, 12, 6), booking(12, 14, 6)},
			candidate: booking(11, 13, 4),
			want:      10,
		},
		{
			name:      "back to back is not overlapping: end is exclusive",
			existing:  []Booking{booking(10, 12, 6)},
			candidate: booking(12, 14, 4),
			want:      4,
		},
		{
			name:      "candidate ends exactly when the next one starts",
			existing:  []Booking{booking(13, 15, 9)},
			candidate: booking(11, 13, 4),
			want:      4,
		},
		{
			name:      "full overlap adds up",
			existing:  []Booking{booking(10, 12, 6), booking(11, 13, 3)},
			candidate: booking(11, 12, 4),
			want:      13,
		},
		{
			name:      "an existing booking that starts inside the candidate",
			existing:  []Booking{booking(12, 14, 5)},
			candidate: booking(11, 13, 4),
			want:      9,
		},
		{
			name:      "an existing booking that ended before the candidate",
			existing:  []Booking{booking(8, 10, 9)},
			candidate: booking(11, 13, 4),
			want:      4,
		},
		{
			name:      "many small bookings stack",
			existing:  []Booking{booking(11, 12, 2), booking(11, 12, 2), booking(11, 12, 2)},
			candidate: booking(11, 13, 1),
			want:      7,
		},
		{
			name:      "an existing booking that wraps around the candidate",
			existing:  []Booking{booking(9, 15, 5)},
			candidate: booking(11, 12, 4),
			want:      9,
		},
		{
			name: "the peak is where the bookings pile up, not at the candidate's start",
			existing: []Booking{
				booking(11, 14, 3),
				{Start: at(12, 0), End: at(13, 0), Guests: 4},
			},
			candidate: booking(11, 14, 2),
			want:      9,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, PeakGuests(tc.existing, tc.candidate))
		})
	}
}
