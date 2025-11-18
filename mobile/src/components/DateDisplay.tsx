import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateDisplayProps {
  dateString: string;
  style?: any;
  textStyle?: any;
  abbreviationStyle?: any;
  numberStyle?: any;
}

export default function DateDisplay({ 
  dateString, 
  style,
  textStyle,
  abbreviationStyle,
  numberStyle 
}: DateDisplayProps) {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T12:00:00'));
  const dayAbbreviation = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNumber = date.getDate().toString();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.abbreviation, abbreviationStyle, textStyle]}>
        {dayAbbreviation}
      </Text>
      <Text style={[styles.number, numberStyle, textStyle]}>
        {dayNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbreviation: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  number: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 26,
  },
});

