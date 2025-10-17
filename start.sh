#!/bin/bash

# This script is the entrypoint for the Railpack deployment.
# It builds and runs the Docker containers for the application.

echo ">>> Building and starting application containers..."

# The '--build' flag ensures that Docker images are rebuilt if there are changes.
# The command runs in the foreground, which is typically expected by deployment platforms.
docker compose up --build

echo ">>> Application stopped."