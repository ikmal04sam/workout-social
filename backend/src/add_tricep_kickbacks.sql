-- Add Tricep Kickbacks exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Tricep Kickbacks', 'Tricep kickbacks with dumbbell', 'Triceps', 'Dumbbell')
ON CONFLICT DO NOTHING;

