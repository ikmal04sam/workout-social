#!/bin/bash
# Database setup script for workout-social
# Run from backend directory: ./scripts/setup-db.sh
# Uses DB_NAME from .env if present, defaults to workout_social

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$BACKEND_DIR/src"

# Load .env if it exists
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  source "$BACKEND_DIR/.env"
  set +a
fi

DB_NAME="${DB_NAME:-workout_social}"

echo "Setting up database: $DB_NAME"

# Create database (ignore error if it already exists)
createdb "$DB_NAME" 2>/dev/null || true

# Run schema
echo "Running schema..."
psql "$DB_NAME" -f "$SRC_DIR/db.sql"

# Run migrations
echo "Running migrations..."
psql "$DB_NAME" -f "$SRC_DIR/migrate_profile_pic.sql"
psql "$DB_NAME" -f "$SRC_DIR/add_password_reset_fields.sql"
for f in "$SRC_DIR"/add_*.sql; do
  [ -f "$f" ] && psql "$DB_NAME" -f "$f"
done

# Seed data
echo "Seeding exercises..."
psql "$DB_NAME" -f "$SRC_DIR/seed_exercises.sql"
echo "Seeding test users..."
psql "$DB_NAME" -f "$SRC_DIR/seed_test_users.sql"

echo "Database setup complete."
