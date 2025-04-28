package main

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Player struct {
	ID       string   `json:"id"`
	Position Vector3  `json:"position"`
	Rotation Vector3  `json:"rotation"`
	Camera   Camera   `json:"camera"`
	Movement Movement `json:"movement"`
	Physics  Physics  `json:"physics"`
}

type Camera struct {
	Position Vector3 `json:"position"`
	Target   Vector3 `json:"target"`
	Zoom     float64 `json:"zoom"`
}

type Movement struct {
	IsWalking   bool    `json:"isWalking"`
	IsSwimming  bool    `json:"isSwimming"`
	IsDiving    bool    `json:"isDiving"`
	IsClimbing  bool    `json:"isClimbing"`
	DiveTime    float64 `json:"diveTime"`
	MaxDiveTime float64 `json:"maxDiveTime"`
}

type Physics struct {
	Velocity     Vector3 `json:"velocity"`
	Acceleration Vector3 `json:"acceleration"`
	Grounded     bool    `json:"grounded"`
}

type ClientMessage struct {
	Type     string  `json:"type"`
	Movement Vector3 `json:"movement,omitempty"`
	Camera   Camera  `json:"camera,omitempty"`
	ClientID string  `json:"clientId"`
}

const (
	EARTH_RADIUS     = 6371000 // meters
	GRAVITY          = 9.81
	WALK_SPEED       = 500.0 // meters per second
	SWIM_SPEED       = 2.0
	CLIMB_SPEED      = 1.5
	MAX_DIVE_TIME    = 30.0 // seconds
	TICK_RATE        = 1    // updates per second
	PHYSICS_TIMESTEP = 1.0 / float64(TICK_RATE)
)

var (
	players      = make(map[string]*Player)
	playersMutex sync.RWMutex
	upgrader     = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	clientID := r.URL.Query().Get("clientId")
	if clientID == "" {
		log.Println("No client ID provided")
		return
	}

	// Initialize new player
	player := &Player{
		ID: clientID,
		Position: Vector3{
			X: EARTH_RADIUS,
			Y: 0,
			Z: 0,
		},
		Camera: Camera{
			Position: Vector3{X: EARTH_RADIUS + 10, Y: 10, Z: 0},
			Target:   Vector3{X: EARTH_RADIUS, Y: 0, Z: 0},
			Zoom:     1.0,
		},
		Movement: Movement{
			MaxDiveTime: MAX_DIVE_TIME,
		},
	}

	playersMutex.Lock()
	players[clientID] = player
	playersMutex.Unlock()

	// Message handling
	go func() {
		for {
			fmt.Println("Waiting for message")
			var msg ClientMessage
			if err := conn.ReadJSON(&msg); err != nil {
				log.Println("Read error:", err)
				playersMutex.Lock()
				delete(players, clientID)
				playersMutex.Unlock()
				return
			}

			playersMutex.Lock()
			player := players[clientID]
			switch msg.Type {
			case "movement":
				fmt.Println("Movement:", msg.Movement)
				updatePlayerMovement(player, msg.Movement)
			case "camera":
				player.Camera = msg.Camera
			}
			playersMutex.Unlock()
		}
	}()

	// Game loop for this player
	ticker := time.NewTicker(time.Second / TICK_RATE)
	for range ticker.C {
		playersMutex.Lock()
		updatePlayerPhysics(player)

		// Send world state to client
		worldState := getWorldState()
		if err := conn.WriteJSON(worldState); err != nil {
			playersMutex.Unlock()
			return
		}
		playersMutex.Unlock()
	}
}

func updatePlayerMovement(player *Player, movement Vector3) {
	// Normalize movement vector
	length := math.Sqrt(movement.X*movement.X + movement.Y*movement.Y + movement.Z*movement.Z)
	if length > 0 {
		player.Movement.IsWalking = true
		movement.X /= length
		movement.Y /= length
		movement.Z /= length
	}

	speed := WALK_SPEED
	if player.Movement.IsSwimming {
		speed = SWIM_SPEED
	} else if player.Movement.IsClimbing {
		speed = CLIMB_SPEED
	}

	player.Physics.Velocity = Vector3{
		X: movement.X * speed,
		Y: movement.Y * speed,
		Z: movement.Z * speed,
	}
}

func updatePlayerPhysics(player *Player) {
	// Apply gravity if not swimming
	if !player.Movement.IsSwimming {
		player.Physics.Velocity.Y -= GRAVITY * PHYSICS_TIMESTEP
	}

	// Update position
	player.Position.X += player.Physics.Velocity.X * PHYSICS_TIMESTEP
	player.Position.Y += player.Physics.Velocity.Y * PHYSICS_TIMESTEP
	player.Position.Z += player.Physics.Velocity.Z * PHYSICS_TIMESTEP

	// Simple ground collision
	distanceFromCenter := math.Sqrt(
		player.Position.X*player.Position.X +
			player.Position.Y*player.Position.Y +
			player.Position.Z*player.Position.Z,
	)

	if distanceFromCenter < EARTH_RADIUS {
		// Normalize position to surface
		factor := EARTH_RADIUS / distanceFromCenter
		player.Position.X *= factor
		player.Position.Y *= factor
		player.Position.Z *= factor
		player.Physics.Grounded = true
	} else {
		player.Physics.Grounded = false
	}

	// Update dive time
	if player.Movement.IsDiving {
		player.Movement.DiveTime += PHYSICS_TIMESTEP
		if player.Movement.DiveTime >= player.Movement.MaxDiveTime {
			player.Movement.IsDiving = false
			player.Movement.IsSwimming = true
		}
	}
}

func getWorldState() map[string]interface{} {
	return map[string]interface{}{
		"players": players,
	}
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	http.Handle("/", http.FileServer(http.Dir("static")))
	log.Fatal(http.ListenAndServe(":8080", nil))
}
