-- Add Overhead Tricep Extensions exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Overhead Tricep Extensions', 'Overhead tricep extensions with dumbbell or cable', 'Triceps', 'Dumbbell')
ON CONFLICT DO NOTHING;

