-- Add Dumbbell Rows exercise to the database
-- This script can be run on an existing database to add the new exercise

INSERT INTO exercises (name, description, muscle_group, equipment_type) 
VALUES ('Dumbbell Rows', 'Bent-over dumbbell rows for back', 'Back', 'Dumbbell')
ON CONFLICT DO NOTHING;




