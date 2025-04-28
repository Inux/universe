#!/bin/bash

# Start TypeScript compiler in watch mode
npm run watch-ts &

# Start Air for Go hot-reloading
$(go env GOPATH)/bin/air &

# Wait for both processes
wait