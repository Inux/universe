package main

import (
	_ "github.com/inux/universe/internal/demos/animation"
	_ "github.com/inux/universe/internal/demos/audio"
	_ "github.com/inux/universe/internal/demos/experimental/physics"
	_ "github.com/inux/universe/internal/demos/geometry"
	_ "github.com/inux/universe/internal/demos/gui"
	_ "github.com/inux/universe/internal/demos/helper"
	_ "github.com/inux/universe/internal/demos/light"
	_ "github.com/inux/universe/internal/demos/loader"
	_ "github.com/inux/universe/internal/demos/material"
	_ "github.com/inux/universe/internal/demos/other"
	_ "github.com/inux/universe/internal/demos/shader"
	_ "github.com/inux/universe/internal/demos/tests"
	_ "github.com/inux/universe/internal/demos/texture"
	_ "github.com/inux/universe/internal/demos/universe"

	"github.com/inux/universe/internal/app"
)

func main() {

	// Create and run application
	app.Create().Run()
}
