-- Add Preacher Curl exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Preacher Curl', 'Preacher curl on machine', 'Biceps', 'Machine')
ON CONFLICT DO NOTHING;

