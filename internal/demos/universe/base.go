package universe

import (
	"math/rand"
	"time"
)

const (
	GridMaxWidth  = 20
	GridMaxHeight = 20
	GridMaxDepth  = 20
)

var (
	minTime      = 100 * time.Millisecond
	currentDelta = 0 * time.Millisecond
)

// Get Random float32 within given range
func getRandomFloat32(min, max float32) float32 {
	return min + rand.Float32()*(max-min)
}
