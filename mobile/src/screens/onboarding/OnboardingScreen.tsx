import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: number;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Track Your Progress',
    description: 'Log your workouts, sets, and reps. Watch your strength grow over time with detailed progress tracking.',
    icon: 'barbell',
    gradient: ['#FF6B35', '#FF8C5A', '#FFA07A'],
  },
  {
    id: 2,
    title: 'Connect with Others',
    description: 'Follow friends, share workouts, and get inspired by the fitness community around you.',
    icon: 'people',
    gradient: ['#4A90E2', '#6BA3E8', '#8BB5ED'],
  },
  {
    id: 3,
    title: 'See Your Growth',
    description: 'Visualize your progress with charts and analytics. Track improvements across all your exercises.',
    icon: 'stats-chart',
    gradient: ['#10B981', '#34D399', '#6EE7B7'],
  },
  {
    id: 4,
    title: 'Ready to Get Started?',
    description: 'Join thousands of fitness enthusiasts tracking their journey. Create your account and start today!',
    icon: 'rocket',
    gradient: ['#FF6B35', '#FF8C5A', '#F7931E'],
  },
];

const ONBOARDING_KEY = '@onboarding_completed';

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.navigate('Login' as never);
  };

  const handleGetStarted = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.navigate('Login' as never);
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {slides.map((slide, index) => (
          <LinearGradient
            key={slide.id}
            colors={slide.gradient}
            style={styles.slide}
          >
            <View style={styles.slideContent}>
              {index === 0 && (
                <View style={styles.logoContainer}>
                  <View style={styles.logoBackground}>
                    <Image
                      source={require('../../../assets/icon.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              )}
              
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name={slide.icon} size={80} color="white" />
                </View>
              </View>

              <View style={styles.textContainer}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>

              {index === slides.length - 1 && (
                <View style={styles.getStartedContainer}>
                  <TouchableOpacity
                    style={styles.getStartedButton}
                    onPress={handleGetStarted}
                  >
                    <Text style={styles.getStartedText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" style={styles.arrowIcon} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </LinearGradient>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {currentIndex < slides.length - 1 ? (
          <>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
            >
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.finalButtonContainer}>
            <TouchableOpacity
              style={styles.getStartedButtonBottom}
              onPress={handleGetStarted}
            >
              <Text style={styles.getStartedTextBottom}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="white" style={styles.arrowIcon} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export const checkOnboardingStatus = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 120,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  getStartedContainer: {
    marginTop: 20,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'white',
  },
  getStartedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  arrowIcon: {
    marginLeft: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: 'white',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 50,
    paddingTop: 20,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  nextText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  finalButtonContainer: {
    flex: 1,
    alignItems: 'center',
  },
  getStartedButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedTextBottom: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

