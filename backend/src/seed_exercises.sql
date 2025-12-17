-- Insert common exercises into the exercises table
INSERT INTO exercises (name, description, muscle_group, equipment_type) VALUES
-- Upper Body - Chest
('Push-ups', 'Classic bodyweight chest exercise', 'Chest', 'Bodyweight'),
('Bench Press', 'Barbell chest press on bench', 'Chest', 'Barbell'),
('Incline Bench Press', 'Barbell chest press on inclined bench', 'Chest', 'Barbell'),
('Dumbbell Press', 'Dumbbell chest press', 'Chest', 'Dumbbell'),
('Incline Dumbbell Press', 'Dumbbell chest press on inclined bench', 'Chest', 'Dumbbell'),
('Chest Flyes', 'Dumbbell chest flyes', 'Chest', 'Dumbbell'),

-- Upper Body - Back
('Pull-ups', 'Bodyweight back exercise', 'Back', 'Bodyweight'),
('Lat Pulldown', 'Cable lat pulldown', 'Back', 'Cable'),
('Bent-over Row', 'Barbell bent-over row', 'Back', 'Barbell'),
('Deadlift', 'Full body compound movement', 'Back', 'Barbell'),
('Seated Row', 'Cable seated row', 'Back', 'Cable'),

-- Upper Body - Shoulders
('Overhead Press', 'Barbell overhead press', 'Shoulders', 'Barbell'),
('Dumbbell Overhead Press', 'Dumbbell overhead press', 'Shoulders', 'Dumbbell'),
('Lateral Raises', 'Dumbbell lateral raises', 'Shoulders', 'Dumbbell'),
('Front Raises', 'Dumbbell front raises', 'Shoulders', 'Dumbbell'),
('Rear Delt Flyes', 'Rear deltoid flyes', 'Shoulders', 'Dumbbell'),
('Dumbbell Shrugs', 'Dumbbell shrugs for traps', 'Shoulders', 'Dumbbell'),

-- Upper Body - Arms
('Bicep Curls', 'Dumbbell bicep curls', 'Biceps', 'Dumbbell'),
('Tricep Dips', 'Bodyweight tricep exercise', 'Triceps', 'Bodyweight'),
('Hammer Curls', 'Dumbbell hammer curls', 'Biceps', 'Dumbbell'),
('Preacher Curl', 'Preacher curl on machine', 'Biceps', 'Machine'),
('Tricep Extensions', 'Overhead tricep extensions', 'Triceps', 'Dumbbell'),
('Overhead Tricep Extensions', 'Overhead tricep extensions with dumbbell or cable', 'Triceps', 'Dumbbell'),
('Tricep Kickbacks', 'Tricep kickbacks with dumbbell', 'Triceps', 'Dumbbell'),

-- Lower Body
('Squats', 'Bodyweight squats', 'Legs', 'Bodyweight'),
('Barbell Squats', 'Barbell back squats', 'Legs', 'Barbell'),
('Lunges', 'Bodyweight lunges', 'Legs', 'Bodyweight'),
('Romanian Deadlifts', 'Romanian deadlifts', 'Legs', 'Barbell'),
('Calf Raises', 'Standing calf raises', 'Legs', 'Bodyweight'),
('Leg Press', 'Machine leg press', 'Legs', 'Machine'),
('Lying Hamstring Curl', 'Lying hamstring curl on machine', 'Legs', 'Machine'),
('Seated Hamstring Curls', 'Seated hamstring curl on machine', 'Legs', 'Machine'),
('Leg Extensions', 'Leg extension on machine', 'Legs', 'Machine'),

-- Core
('Plank', 'Isometric core exercise', 'Core', 'Bodyweight'),
('Crunches', 'Basic abdominal crunches', 'Core', 'Bodyweight'),
('Russian Twists', 'Seated Russian twists', 'Core', 'Bodyweight'),
('Mountain Climbers', 'Dynamic core exercise', 'Core', 'Bodyweight'),
('Dead Bug', 'Core stability exercise', 'Core', 'Bodyweight'),

-- Cardio
('Running', 'Outdoor or treadmill running', 'Cardio', 'Cardio'),
('Cycling', 'Stationary or outdoor cycling', 'Cardio', 'Cardio'),
('Rowing', 'Rowing machine', 'Cardio', 'Machine'),
('Burpees', 'Full body cardio exercise', 'Cardio', 'Bodyweight'),
('Jumping Jacks', 'Basic cardio movement', 'Cardio', 'Bodyweight');
