import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateDisplayProps {
  dateString: string;
  variant?: 'calendar' | 'feed' | 'list';
  style?: any;
  textStyle?: any;
  abbreviationStyle?: any;
  numberStyle?: any;
}

export default function DateDisplay({ 
  dateString, 
  variant = 'calendar',
  style,
  textStyle,
  abbreviationStyle,
  numberStyle 
}: DateDisplayProps) {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T12:00:00'));
  const today = new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isToday = dateOnly.getTime() === todayOnly.getTime();

  // Feed variant: "Mon, Nov 18" or "Today"
  if (variant === 'feed') {
    if (isToday) {
      return <Text style={[styles.feedText, textStyle, style]}>Today</Text>;
    }
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return <Text style={[styles.feedText, textStyle, style]}>{formatted}</Text>;
  }

  // List variant: "Nov 18, 2024" or "Today"
  if (variant === 'list') {
    if (isToday) {
      return <Text style={[styles.listText, textStyle, style]}>Today</Text>;
    }
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
    return <Text style={[styles.listText, textStyle, style]}>{formatted}</Text>;
  }

  // Calendar variant (default): Day abbreviation above day number
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
  feedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  listText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
});

