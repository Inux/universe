package universe

import (
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

type RandomSpheres struct {
	meshes []*graphic.Mesh
}

// Start is called once at the start of the demo.
func (rs *RandomSpheres) Start(a *app.App) {
	rs.meshes = make([]*graphic.Mesh, 0)

	geom := geometry.NewSphere(0.1, 20, 20)
	mat := material.NewStandard(math32.NewColor("Black"))

	// Create a blue torus and add it to the scene
	for z := 0.01; z < GridMaxDepth; z++ {
		for y := 0.01; y < GridMaxHeight; y++ {
			for x := 0.01; x < GridMaxWidth; x++ {
				mesh := graphic.NewMesh(geom, mat)
				mesh.SetPositionVec(math32.NewVector3(float32(x), float32(y), float32(z)))
				a.Scene().Add(mesh)
				rs.meshes = append(rs.meshes, mesh)
			}
		}
	}
}

// Update is called every frame.
func (rs *RandomSpheres) Update(a *app.App, deltaTime time.Duration) {

	currentDelta += deltaTime
	if currentDelta > minTime {
		for _, mesh := range rs.meshes {
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
func (rs *RandomSpheres) Cleanup(a *app.App) {}
