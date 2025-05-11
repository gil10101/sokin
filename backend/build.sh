#!/bin/bash

# Install dependencies
npm install

# Fix type issues by adding necessary @types packages
npm install --save-dev @types/express @types/cors @types/helmet @types/node @types/joi

# Build the project
npm run build

echo "Build completed successfully!" 