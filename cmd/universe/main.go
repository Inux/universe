package main

import (
	_ "github.com/inux/universe/internal/demos/basic/animation"
	_ "github.com/inux/universe/internal/demos/basic/audio"
	_ "github.com/inux/universe/internal/demos/basic/experimental/physics"
	_ "github.com/inux/universe/internal/demos/basic/geometry"
	_ "github.com/inux/universe/internal/demos/basic/gui"
	_ "github.com/inux/universe/internal/demos/basic/helper"
	_ "github.com/inux/universe/internal/demos/basic/light"
	_ "github.com/inux/universe/internal/demos/basic/loader"
	_ "github.com/inux/universe/internal/demos/basic/material"
	_ "github.com/inux/universe/internal/demos/basic/other"
	_ "github.com/inux/universe/internal/demos/basic/shader"
	_ "github.com/inux/universe/internal/demos/basic/tests"
	_ "github.com/inux/universe/internal/demos/basic/texture"
	_ "github.com/inux/universe/internal/demos/universe"

	"github.com/inux/universe/internal/app"
)

func main() {

	// Create and run application
	app.Create().Run()
}
