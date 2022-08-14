package universe

import (
	"fmt"
	"time"

	"github.com/g3n/engine/experimental/physics"
	"github.com/g3n/engine/experimental/physics/object"
	"github.com/g3n/engine/geometry"
	"github.com/g3n/engine/graphic"
	"github.com/g3n/engine/material"
	"github.com/g3n/engine/math32"
	"github.com/g3n/engine/util/logger"
	"github.com/g3n/engine/window"
	"github.com/google/uuid"
	"github.com/inux/universe/internal/app"
)

func init() {
	app.DemoMap["universe.gravity_movement"] = &UniverseSpheres{}
}

var eventId = uuid.New()

type UniverseSpheres struct {
	sim *physics.Simulation
	log *logger.Logger

	meshes []*graphic.Mesh
	fields map[*graphic.Mesh]*physics.AttractorForceField
}

// Start is called once at the start of the demo.
func (u *UniverseSpheres) Start(a *app.App) {
	u.meshes = make([]*graphic.Mesh, 0)
	u.fields = make(map[*graphic.Mesh]*physics.AttractorForceField, 0)

	u.log = a.Log()

	// Unsubscribe events in case of reset to prevent duplicate events
	a.UnsubscribeAllID(eventId)

	a.SubscribeID(window.OnKeyRepeat, eventId, u.onKey)
	a.SubscribeID(window.OnKeyDown, eventId, u.onKey)

	a.Camera().SetPosition(5.25, 6.45, 9.31)
	a.Camera().SetQuaternion(-0.25, 0.25, 0.06, 0.94)

	u.sim = physics.NewSimulation(a.Scene())
	u.sim.SetPaused(true)

	geom := geometry.NewSphere(0.1, 20, 20)
	mat := material.NewStandard(math32.NewColor("Black"))

	for z := 0.01; z < 5; z++ {
		for y := 0.01; y < 5; y++ {
			for x := 0.01; x < 5; x++ {
				mesh := graphic.NewMesh(geom, mat)
				pos := math32.NewVector3(float32(x), float32(y), float32(z))
				mesh.SetPositionVec(pos)
				a.Scene().Add(mesh)
				u.sim.AddBody(object.NewBody(mesh), "sphere"+fmt.Sprintf("-%f-%f-%f", x, y, z))
				u.meshes = append(u.meshes, mesh)
				field := physics.NewAttractorForceField(pos, 1)
				u.fields[mesh] = field
				u.sim.AddForceField(field)
			}
		}
	}
}

// Update is called every frame.
func (u *UniverseSpheres) Update(a *app.App, deltaTime time.Duration) {
	if !u.sim.Paused() {
		u.sim.Step(float32(deltaTime.Seconds()))
	}

	for _, mesh := range u.meshes {
		pos := mesh.Position()
		u.fields[mesh].SetPosition(&pos)
	}
}

func (u *UniverseSpheres) onKey(evname string, ev interface{}) {
	kev := ev.(*window.KeyEvent)
	u.log.Debug("Key: ", kev.Key)
	switch kev.Key {
	case window.KeyP:
		u.sim.SetPaused(!u.sim.Paused())
	case window.KeyO:
		u.sim.SetPaused(false)
		u.sim.Step(0.016)
		u.sim.SetPaused(true)
	}
}

// Cleanup is called once at the end of the demo.
func (u *UniverseSpheres) Cleanup(a *app.App) {}
