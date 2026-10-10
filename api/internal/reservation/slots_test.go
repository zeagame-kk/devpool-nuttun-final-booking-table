package reservation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHourlySlots(t *testing.T) {
	midnight := time.Date(2026, 10, 12, 0, 0, 0, 0, bangkok)
	hours := func(open, closing time.Duration) DayHours { return DayHours{Open: open, Close: closing} }
	h := time.Hour
	m := time.Minute

	cases := []struct {
		name  string
		hours DayHours
		want  [][2]time.Duration // start, end as offsets from midnight
	}{
		{"whole hours", hours(11*h, 14*h), [][2]time.Duration{{11 * h, 12 * h}, {12 * h, 13 * h}, {13 * h, 14 * h}}},
		{"counted from opening, short last slot", hours(11*h+30*m, 13*h+15*m), [][2]time.Duration{{11*h + 30*m, 12*h + 30*m}, {12*h + 30*m, 13*h + 15*m}}},
		{"opens for less than an hour", hours(18*h, 18*h+20*m), [][2]time.Duration{{18 * h, 18*h + 20*m}}},
		{"closed (no span)", hours(11*h, 11*h), [][2]time.Duration{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := hourlySlots(midnight, tc.hours)

			assert.Len(t, got, len(tc.want))
			for index, want := range tc.want {
				assert.Equal(t, midnight.Add(want[0]), got[index].Start)
				assert.Equal(t, midnight.Add(want[1]), got[index].End)
				assert.Zero(t, got[index].Guests)
			}
		})
	}
}
