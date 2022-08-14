package universe

import (
	"fmt"
	"time"

	"github.com/g3n/engine/camera"
	"github.com/g3n/engine/core"
	"github.com/g3n/engine/experimental/physics"
	"github.com/g3n/engine/experimental/physics/object"
	"github.com/g3n/engine/geometry"
	"github.com/g3n/engine/graphic"
	"github.com/g3n/engine/material"
	"github.com/g3n/engine/math32"
	"github.com/g3n/engine/util/helper"
	"github.com/g3n/engine/util/logger"
	"github.com/g3n/engine/window"
	"github.com/inux/universe/internal/app"
)

func init() {
	app.DemoMap["universe.gravity_movement_editor"] = &UniverseSpheresEditor{}
}

type UniverseSpheresEditor struct {
	log    *logger.Logger
	scene  *core.Node
	camera *camera.Camera

	referenceMesh *graphic.Mesh
	meshes        []*graphic.Mesh
	fields        map[*graphic.Mesh]*physics.AttractorForceField

	sim *physics.Simulation
}

// Start is called once at the start of the demo.
func (u *UniverseSpheresEditor) Start(a *app.App) {
	u.log = a.Log()
	u.scene = a.Scene()
	u.camera = a.Camera()

	referenceSphereGeom := geometry.NewSphere(1.5, 16, 16)
	referenceSphereMat := material.NewStandard(&math32.Color{R: 0.9, G: 0.6, B: 0.3})
	u.referenceMesh = graphic.NewMesh(referenceSphereGeom, referenceSphereMat)
	u.meshes = make([]*graphic.Mesh, 0)
	u.fields = make(map[*graphic.Mesh]*physics.AttractorForceField, 0)

	// Unsubscribe events in case of reset to prevent duplicate events
	a.UnsubscribeAllID(eventId)

	a.SubscribeID(window.OnKeyDown, eventId, u.onKeyDown)
	a.SubscribeID(window.OnKeyUp, eventId, u.onKeyUp)

	a.Camera().SetPosition(-45, 75, -25)
	a.Camera().SetQuaternion(0.15, 0.85, 0.35, -0.35)

	u.sim = physics.NewSimulation(u.scene)
	u.sim.SetPaused(true)

	u.referenceMesh.SetPosition(0, 0, 0)
	u.scene.Add(u.referenceMesh)

	u.scene.Add(helper.NewAxes(1000))
}

// Update is called every frame.
func (u *UniverseSpheresEditor) Update(a *app.App, deltaTime time.Duration) {
	if !u.sim.Paused() {
		u.sim.Step(float32(deltaTime.Seconds()))
	}

	for _, mesh := range u.meshes {
		pos := mesh.Position()
		u.fields[mesh].SetPosition(&pos)
	}
}

func (u *UniverseSpheresEditor) onKeyDown(evname string, ev interface{}) {
	kev := ev.(*window.KeyEvent)
	u.log.Debug("Key: ", kev.Key)
	switch kev.Key {
	case window.KeyP:
		u.sim.SetPaused(!u.sim.Paused())
	case window.KeyO:
		u.sim.SetPaused(false)
		u.sim.Step(0.016)
		u.sim.SetPaused(true)
	case window.KeyW:
		u.referenceMesh.TranslateZ(1)
	case window.KeyS:
		u.referenceMesh.TranslateZ(-1)
	case window.KeyA:
		u.referenceMesh.TranslateX(1)
	case window.KeyD:
		u.referenceMesh.TranslateX(-1)
	case window.KeyI:
		u.referenceMesh.TranslateY(1)
	case window.KeyK:
		u.referenceMesh.TranslateY(-1)
	case window.KeySpace:
		u.addNewSphere()
	}
}

func (u *UniverseSpheresEditor) addNewSphere() {
	geom := geometry.NewSphere(0.1, 20, 20)
	mat := material.NewStandard(math32.NewColor("Black"))

	mesh := graphic.NewMesh(geom, mat)
	pos := u.referenceMesh.Position()
	mesh.SetPositionVec(&pos)
	u.scene.Add(mesh)
	u.meshes = append(u.meshes, mesh)
	u.sim.AddBody(object.NewBody(mesh), "sphere"+fmt.Sprintf("-%f-%f-%f", pos.X, pos.Y, pos.Z))
	field := physics.NewAttractorForceField(&pos, 1)
	u.fields[mesh] = field
	u.sim.AddForceField(field)
}

// Cleanup is called once at the end of the demo.
func (u *UniverseSpheresEditor) Cleanup(a *app.App) {}
