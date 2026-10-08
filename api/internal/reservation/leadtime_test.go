package reservation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLeadTimeOK(t *testing.T) {
	now := at(9, 0)

	cases := []struct {
		name        string
		start       time.Time
		leadMinutes int
		want        bool
	}{
		{"exactly the lead time before the start is allowed", now.Add(60 * time.Minute), 60, true},
		{"one minute too late", now.Add(59 * time.Minute), 60, false},
		{"one second too late", now.Add(60*time.Minute - time.Second), 60, false},
		{"well before the lead time", now.Add(61 * time.Minute), 60, true},
		{"already started", now.Add(-time.Minute), 30, false},
		{"starting right now", now, 30, false},
		{"minimum lead time of 30 minutes", now.Add(30 * time.Minute), 30, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, leadTimeOK(tc.start, now, tc.leadMinutes))
		})
	}
}
