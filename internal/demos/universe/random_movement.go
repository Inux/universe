package universe

import (
	"log"
	"math/rand"
	"time"

	"github.com/g3n/engine/geometry"
	"github.com/g3n/engine/graphic"
	"github.com/g3n/engine/material"
	"github.com/g3n/engine/math32"
	"github.com/inux/universe/internal/app"
)

func init() {
	app.DemoMap["universe.random_movement"] = &RandomSpheres{}
}

const (
	GridMaxWidth  = 20
	GridMaxHeight = 20
	GridMaxDepth  = 20
)

var (
	minTime      = 100 * time.Millisecond
	currentDelta = 0 * time.Millisecond
)

type RandomSpheres struct {
	meshes []*graphic.Mesh
}

// Get Random float32 within given range
func getRandomFloat32(min, max float32) float32 {
	return min + rand.Float32()*(max-min)
}

// Start is called once at the start of the demo.
func (t *RandomSpheres) Start(a *app.App) {

	geom := geometry.NewSphere(0.1, 20, 20)
	mat := material.NewStandard(math32.NewColor("Black"))

	// Create a blue torus and add it to the scene
	for z := 0.01; z < GridMaxDepth; z++ {
		for y := 0.01; y < GridMaxHeight; y++ {
			for x := 0.01; x < GridMaxWidth; x++ {
				mesh := graphic.NewMesh(geom, mat)
				mesh.SetPositionVec(math32.NewVector3(float32(x), float32(y), float32(z)))
				a.Scene().Add(mesh)
				t.meshes = append(t.meshes, mesh)
			}
		}
	}
}

// Update is called every frame.
func (t *RandomSpheres) Update(a *app.App, deltaTime time.Duration) {

	currentDelta += deltaTime
	if currentDelta > minTime {
		log.Printf("Frame time is too high: %s", deltaTime)
		for _, mesh := range t.meshes {
			pos := mesh.Position()
			pos.X += getRandomFloat32(-0.5, 0.5)
			pos.Y += getRandomFloat32(-0.5, 0.5)
			pos.Z += getRandomFloat32(-0.5, 0.5)
			mesh.SetPositionVec(&pos)
		}
		currentDelta = 0
	}
}

// Cleanup is called once at the end of the demo.
func (t *RandomSpheres) Cleanup(a *app.App) {}
