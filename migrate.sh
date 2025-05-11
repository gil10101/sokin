#!/bin/bash

# Sokin Project Migration Script
# This script helps migrate the project from a monolithic structure to a frontend/backend split

echo "Starting migration process for Sokin project..."

# Create the required directories
mkdir -p frontend/src/app frontend/src/components frontend/src/lib frontend/src/contexts frontend/src/hooks frontend/src/styles frontend/public
mkdir -p backend/src/routes backend/src/controllers backend/src/models backend/src/middleware backend/src/utils backend/src/config

# Copy configuration files for frontend
echo "Copying frontend configuration files..."
cp next.config.mjs tsconfig.json postcss.config.mjs tailwind.config.ts components.json next-env.d.ts frontend/

# Copy frontend code
echo "Copying frontend code files..."
cp -r app/* frontend/src/app/
cp -r components/* frontend/src/components/
cp -r contexts/* frontend/src/contexts/
cp -r hooks/* frontend/src/hooks/
cp -r styles/* frontend/src/styles/
cp -r public/* frontend/public/
cp -r lib/* frontend/src/lib/

# Create .env.local files for frontend and backend
echo "Creating environment files..."
if [ -f .env.local ]; then
  cp .env.local frontend/.env.local
  # Create a backend .env file with the same environment variables
  grep -v "^NEXT_PUBLIC_" .env.local > backend/.env
fi

echo "Setting up package.json files..."
# NPM install for the root project
npm install

echo "Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Start the development server: npm run dev"
echo "3. Review your frontend and backend code to ensure proper functionality" 