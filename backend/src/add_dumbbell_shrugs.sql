-- Add Dumbbell Shrugs exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Dumbbell Shrugs', 'Dumbbell shrugs for traps', 'Shoulders', 'Dumbbell')
ON CONFLICT DO NOTHING;

