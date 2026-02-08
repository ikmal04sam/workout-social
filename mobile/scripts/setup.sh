#!/bin/bash
# Mobile app setup script for workout-social
# Run from mobile directory: ./scripts/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"

echo "Setting up mobile app..."

cd "$MOBILE_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env.example if it doesn't exist (for API URL configuration)
if [ ! -f .env.example ]; then
  echo "Creating .env.example..."
  cat > .env.example << 'EOF'
# API base URL - update for your backend
# For local development, use your machine's IP (e.g. http://10.0.0.155:3000/api)
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EOF
  echo "Created .env.example. Copy to .env and set your API URL if needed."
fi

echo "Mobile setup complete."
echo "Run 'npm start' to start the Expo development server."
