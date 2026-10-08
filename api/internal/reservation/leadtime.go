package reservation

import "time"

// leadTimeOK reports whether a reservation starting at start may still be changed or cancelled
// at now: it must be at least leadMinutes away. Exactly leadMinutes away is still allowed.
func leadTimeOK(start, now time.Time, leadMinutes int) bool {
	return start.Sub(now) >= time.Duration(leadMinutes)*time.Minute
}
