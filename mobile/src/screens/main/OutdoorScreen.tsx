import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { apiService, OutdoorPlace, OutdoorWeather } from '../../services/api';

const DEFAULT_LATITUDE = '3.1390';
const DEFAULT_LONGITUDE = '101.6869';

const radiusOptions = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
];

const formatTemperature = (value?: number) => {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Math.round(Number(value))} C`;
};

const formatCategory = (category?: string) => {
  if (!category) return 'Workout spot';
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getScoreColor = (score?: number) => {
  if (score == null) return '#6B7280';
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#0A84FF';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

const getReadableError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown location error';
};

export default function OutdoorScreen() {
  const [latitude, setLatitude] = useState(DEFAULT_LATITUDE);
  const [longitude, setLongitude] = useState(DEFAULT_LONGITUDE);
  const [radius, setRadius] = useState(3000);
  const [weather, setWeather] = useState<OutdoorWeather | null>(null);
  const [places, setPlaces] = useState<OutdoorPlace[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState('Default: Kuala Lumpur');
  const [isLocating, setIsLocating] = useState(false);
  const [hasTriedCurrentLocation, setHasTriedCurrentLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const parsedLocation = useMemo(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }, [latitude, longitude]);

  const loadOutdoorData = useCallback(async () => {
    if (!parsedLocation) {
      Alert.alert('Invalid Location', 'Enter a valid latitude and longitude.');
      setRefreshing(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setPlacesError(null);
      const [weatherResult, placesResult] = await Promise.allSettled([
        apiService.getOutdoorWeather(parsedLocation.lat, parsedLocation.lon),
        apiService.getOutdoorPlaces(parsedLocation.lat, parsedLocation.lon, radius),
      ]);

      if (weatherResult.status === 'fulfilled') {
        setWeather(weatherResult.value);
      } else {
        throw weatherResult.reason;
      }

      if (placesResult.status === 'fulfilled') {
        setPlaces(placesResult.value.places || []);
      } else {
        console.error('Error loading nearby places:', placesResult.reason);
        setPlaces([]);
        setPlacesError('Nearby places are temporarily unavailable. Weather is still available.');
      }
    } catch (error) {
      console.error('Error loading outdoor data:', error);
      Alert.alert('Error', 'Failed to load outdoor workout data.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [parsedLocation, radius]);

  const loadOutdoorDataForLocation = useCallback(async (lat: number, lon: number) => {
    try {
      setIsLoading(true);
      setPlacesError(null);
      const [weatherResult, placesResult] = await Promise.allSettled([
        apiService.getOutdoorWeather(lat, lon),
        apiService.getOutdoorPlaces(lat, lon, radius),
      ]);

      if (weatherResult.status === 'fulfilled') {
        setWeather(weatherResult.value);
      } else {
        throw weatherResult.reason;
      }

      if (placesResult.status === 'fulfilled') {
        setPlaces(placesResult.value.places || []);
      } else {
        console.error('Error loading nearby places:', placesResult.reason);
        setPlaces([]);
        setPlacesError('Nearby places are temporarily unavailable. Weather is still available.');
      }
    } catch (error) {
      console.error('Error loading outdoor data:', error);
      Alert.alert('Error', 'Failed to load outdoor workout data.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [radius]);

  const useCurrentLocation = useCallback(async (showAlerts = true) => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationLabel('Manual location');
        if (showAlerts) {
          Alert.alert(
            'Location Permission',
            'Location permission was not granted. You can still enter latitude and longitude manually.'
          );
        }
        return null;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationLabel('Manual location');
        if (showAlerts) {
          Alert.alert(
            'Location Services Off',
            'Turn on device location services, or enter latitude and longitude manually.'
          );
        }
        return null;
      }

      const lastKnownLocation = await Location.getLastKnownPositionAsync({
        maxAge: 10 * 60 * 1000,
        requiredAccuracy: 5000,
      });

      const currentLocation = lastKnownLocation || await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const nextLatitude = currentLocation.coords.latitude;
      const nextLongitude = currentLocation.coords.longitude;
      setLatitude(nextLatitude.toFixed(4));
      setLongitude(nextLongitude.toFixed(4));
      setLocationLabel('Current location');
      return { latitude: nextLatitude, longitude: nextLongitude };
    } catch (error) {
      console.error('Error getting current location:', error);
      setLocationLabel('Manual location');
      if (showAlerts) {
        Alert.alert(
          'Location Error',
          `Could not get your current location. ${getReadableError(error)} You can still enter latitude and longitude manually.`
        );
      }
      return null;
    } finally {
      setIsLocating(false);
      setHasTriedCurrentLocation(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasTriedCurrentLocation) {
        useCurrentLocation(false);
        return;
      }
      loadOutdoorData();
    }, [hasTriedCurrentLocation, loadOutdoorData, useCurrentLocation])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadOutdoorData();
  };

  const openPlace = async (place: OutdoorPlace) => {
    if (!place.map_url) return;
    const supported = await Linking.canOpenURL(place.map_url);
    if (supported) {
      await Linking.openURL(place.map_url);
    }
  };

  const current = weather?.current;
  const scoreColor = getScoreColor(weather?.workout.score);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <View style={styles.locationPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Outdoor Planner</Text>
              <Text style={styles.panelSubtitle}>{locationLabel}</Text>
            </View>
            <Ionicons name="navigate-circle-outline" size={28} color="#0A84FF" />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                placeholder="3.1390"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                placeholder="101.6869"
              />
            </View>
          </View>

          <View style={styles.radiusRow}>
            {radiusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.radiusButton, radius === option.value && styles.radiusButtonActive]}
                onPress={() => setRadius(option.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.radiusButtonText, radius === option.value && styles.radiusButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={async () => {
              const currentLocation = await useCurrentLocation(true);
              if (currentLocation) {
                loadOutdoorDataForLocation(currentLocation.latitude, currentLocation.longitude);
              }
            }}
            activeOpacity={0.75}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#0A84FF" />
            ) : (
              <Ionicons name="locate-outline" size={18} color="#0A84FF" />
            )}
            <Text style={styles.currentLocationButtonText}>
              {isLocating ? 'Finding location...' : 'Use Current Location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshButton} onPress={loadOutdoorData} activeOpacity={0.75}>
            <Ionicons name="refresh" size={18} color="white" />
            <Text style={styles.refreshButtonText}>Update Conditions</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.loadingText}>Checking outdoor conditions...</Text>
          </View>
        ) : (
          <>
            <View style={styles.weatherCard}>
              <View style={styles.weatherTopRow}>
                <View>
                  <Text style={styles.weatherLabel}>Workout Readiness</Text>
                  <Text style={[styles.scoreText, { color: scoreColor }]}>
                    {weather?.workout.score ?? '--'} / 100
                  </Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}18` }]}>
                  <Ionicons name="walk-outline" size={22} color={scoreColor} />
                </View>
              </View>

              <Text style={styles.suggestionText}>
                {weather?.workout.suggestion || 'No suggestion available.'}
              </Text>

              <View style={styles.conditionGrid}>
                <View style={styles.conditionItem}>
                  <Ionicons name="thermometer-outline" size={18} color="#0A84FF" />
                  <Text style={styles.conditionValue}>{formatTemperature(current?.temperature)}</Text>
                  <Text style={styles.conditionLabel}>{current?.weather || 'Weather'}</Text>
                </View>
                <View style={styles.conditionItem}>
                  <Ionicons name="rainy-outline" size={18} color="#0A84FF" />
                  <Text style={styles.conditionValue}>{current?.precipitation_probability ?? 0}%</Text>
                  <Text style={styles.conditionLabel}>Rain chance</Text>
                </View>
                <View style={styles.conditionItem}>
                  <Ionicons name="flag-outline" size={18} color="#0A84FF" />
                  <Text style={styles.conditionValue}>{Math.round(current?.wind_speed || 0)}</Text>
                  <Text style={styles.conditionLabel}>km/h wind</Text>
                </View>
                <View style={styles.conditionItem}>
                  <Ionicons name="sunny-outline" size={18} color="#0A84FF" />
                  <Text style={styles.conditionValue}>{Math.round(current?.uv_index || 0)}</Text>
                  <Text style={styles.conditionLabel}>UV index</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nearby Places</Text>
              <Text style={styles.sectionMeta}>{places.length} found</Text>
            </View>

            {placesError ? (
              <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                <Text style={styles.warningText}>{placesError}</Text>
              </View>
            ) : places.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No workout spots found nearby</Text>
                <Text style={styles.emptyText}>Try a wider radius or a different location.</Text>
              </View>
            ) : (
              places.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.placeCard}
                  onPress={() => openPlace(place)}
                  activeOpacity={0.75}
                >
                  <View style={styles.placeIcon}>
                    <Ionicons name="location-outline" size={20} color="#0A84FF" />
                  </View>
                  <View style={styles.placeContent}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeCategory}>{formatCategory(place.category)}</Text>
                    {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}
                  </View>
                  <Ionicons name="open-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 16,
  },
  locationPanel: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  radiusButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  radiusButtonActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  radiusButtonText: {
    color: '#4B5563',
    fontWeight: '700',
  },
  radiusButtonTextActive: {
    color: 'white',
  },
  currentLocationButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  currentLocationButtonText: {
    color: '#0A84FF',
    fontWeight: '800',
  },
  refreshButton: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '800',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },
  weatherCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weatherTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  scoreBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    marginTop: 12,
    fontSize: 15,
    color: '#374151',
    lineHeight: 21,
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -5,
  },
  conditionItem: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  conditionValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  conditionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeContent: {
    flex: 1,
    marginRight: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  placeCategory: {
    fontSize: 13,
    color: '#0A84FF',
    fontWeight: '700',
    marginTop: 2,
  },
  placeAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
});
