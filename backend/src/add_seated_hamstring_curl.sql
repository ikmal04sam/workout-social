-- Add Seated Hamstring Curls exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Seated Hamstring Curls', 'Seated hamstring curl on machine', 'Legs', 'Machine')
ON CONFLICT DO NOTHING;

