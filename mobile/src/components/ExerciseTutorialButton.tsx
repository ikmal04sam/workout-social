import React from 'react';
import {
  Alert,
  GestureResponderEvent,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExerciseTutorialButtonProps {
  exerciseName: string;
  muscleGroup?: string;
  equipmentType?: string;
  style?: StyleProp<ViewStyle>;
}

export const buildExerciseTutorialUrl = (
  exerciseName: string,
  muscleGroup?: string,
  equipmentType?: string,
) => {
  const searchTerms = [
    exerciseName,
    muscleGroup,
    equipmentType,
    'exercise tutorial proper form',
  ]
    .filter(Boolean)
    .join(' ');

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;
};

export default function ExerciseTutorialButton({
  exerciseName,
  muscleGroup,
  equipmentType,
  style,
}: ExerciseTutorialButtonProps) {
  const openTutorial = async (event?: GestureResponderEvent) => {
    event?.stopPropagation();

    try {
      const url = buildExerciseTutorialUrl(exerciseName, muscleGroup, equipmentType);
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Tutorial unavailable', 'Unable to open YouTube on this device.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening exercise tutorial:', error);
      Alert.alert('Tutorial unavailable', 'Please try again in a moment.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={openTutorial}
      activeOpacity={0.75}
      accessibilityRole="link"
      accessibilityLabel={`Open YouTube tutorial for ${exerciseName}`}
    >
      <Ionicons name="play-circle-outline" size={16} color="#0A84FF" />
      <Text style={styles.buttonText}>Tutorial</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#CFE6FF',
  },
  buttonText: {
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '700',
  },
});
