import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../../contexts/AuthContext';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, isLoading } = useAuth();
  
  // Safe navigation back function
  const safeGoBack = () => {
    try {
      if (navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback to navigating to Main tab
        navigation.navigate('Main' as never);
      }
    } catch (error) {
      // If navigation fails, try to navigate to Main
      try {
        navigation.navigate('Main' as never);
      } catch (navError) {
        console.error('Navigation error:', navError);
      }
    }
  };

  const [bio, setBio] = useState(user?.bio || '');
  const [profilePic, setProfilePic] = useState<string | null>(user?.profile_pic || null);
  const [isSaving, setIsSaving] = useState(false);

  const compressAndResizeImage = async (uri: string): Promise<string> => {
    try {
      // Start with more aggressive compression settings
      let quality = 0.5; // Start at 50% quality
      let maxWidth = 300; // Start with 300px (smaller initial size)
      let attempts = 0;
      const maxAttempts = 4;
      
      while (attempts < maxAttempts) {
        // Resize image and compress
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [
            { resize: { width: maxWidth } }, // Resize to max width (maintains aspect ratio)
          ],
          {
            compress: quality,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        if (manipulatedImage.base64) {
          // Check base64 string length (this is what the backend checks)
          const base64Length = manipulatedImage.base64.length;
          const sizeKB = (base64Length * 3) / 4 / 1024;
          const sizeMB = sizeKB / 1024;
          
          console.log(`Compressed image - Base64 length: ${base64Length}, Size: ${sizeKB.toFixed(2)} KB (${sizeMB.toFixed(2)} MB), width: ${maxWidth}px, quality: ${quality}`);
          
          // Backend limit is 5MB for base64 string length
          // Use 4MB as a safe limit (leaving buffer)
          const maxBase64Length = 4 * 1024 * 1024; // 4MB in characters
          
          if (base64Length < maxBase64Length) {
            console.log(`✓ Image compressed successfully!`);
            return manipulatedImage.base64;
          }
          
          // If still too large, reduce size and quality further
          if (attempts < maxAttempts - 1) {
            maxWidth = Math.max(200, maxWidth - 50); // Reduce by 50px, minimum 200px
            quality = Math.max(0.3, quality - 0.1); // Reduce quality by 10%, minimum 30%
            attempts++;
            console.log(`⚠ Image still too large (${base64Length} chars), trying again with width: ${maxWidth}px, quality: ${quality}`);
            continue;
          } else {
            // Last attempt failed
            throw new Error(`Image is too large even after compression (${sizeMB.toFixed(2)} MB). Please try a smaller or simpler image.`);
          }
        }
        
        attempts++;
      }
      
      // If we still couldn't get it small enough, throw an error
      throw new Error('Failed to compress image. Please try a different image.');
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const handlePickImage = async () => {
    // Request photo library permission (required for both options)
    const mediaLibraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (mediaLibraryStatus.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need photo library permissions to update your profile picture!'
      );
      return;
    }

    // Show options
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              // Check camera permission when user selects camera option
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== 'granted') {
                Alert.alert(
                  'Permission Required',
                  'Sorry, we need camera permissions to take photos!'
                );
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1, // Use full quality initially, we'll compress it
              });

              if (!result.canceled && result.assets[0]?.uri) {
                // Compress and resize the image
                const base64 = await compressAndResizeImage(result.assets[0].uri);
                setProfilePic(base64);
              }
            } catch (error: any) {
              console.error('Error picking image:', error);
              Alert.alert('Error', 'Failed to process image. Please try again.');
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1, // Use full quality initially, we'll compress it
              });

              if (!result.canceled && result.assets[0]?.uri) {
                // Compress and resize the image
                const base64 = await compressAndResizeImage(result.assets[0].uri);
                setProfilePic(base64);
              }
            } catch (error: any) {
              console.error('Error picking image:', error);
              Alert.alert('Error', 'Failed to process image. Please try again.');
            }
          },
        },
        {
          text: 'Remove Picture',
          style: 'destructive',
          onPress: () => setProfilePic(null),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };


  const normalizeProfilePic = (pic: string | null | undefined): string | null => {
    if (!pic) return null;
    // Remove data URI prefix if present for comparison
    if (pic.startsWith('data:')) {
      return pic.split(',')[1] || pic;
    }
    return pic;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Only send changed fields
      const updates: { bio?: string; profile_pic?: string | null } = {};

      if (bio !== (user?.bio || '')) {
        updates.bio = bio;
      }

      // Normalize profile pics for comparison (remove data URI prefix if present)
      const currentPic = normalizeProfilePic(user?.profile_pic);
      const newPic = normalizeProfilePic(profilePic);
      
      if (newPic !== currentPic) {
        // Validate base64 string length before sending (backend limit is 5MB base64 string length)
        if (profilePic) {
          const base64Length = profilePic.length;
          const maxBase64Length = 4 * 1024 * 1024; // 4MB in characters (leaving buffer)
          
          if (base64Length > maxBase64Length) {
            const sizeMB = (base64Length * 3) / 4 / (1024 * 1024);
            Alert.alert(
              'Image Too Large',
              `Image is ${sizeMB.toFixed(2)} MB. Please try a smaller or simpler image.`,
              [{ text: 'OK' }]
            );
            setIsSaving(false);
            return;
          }
          
          console.log(`Profile pic size: ${base64Length} chars (${(base64Length * 3 / 4 / 1024).toFixed(2)} KB)`);
        }
        
        updates.profile_pic = profilePic;
      }

      if (Object.keys(updates).length === 0) {
        setIsSaving(false);
        Alert.alert('No Changes', 'You haven\'t made any changes to save.', [
          {
            text: 'OK',
            onPress: safeGoBack
          }
        ]);
        return;
      }

      await updateProfile(updates);
      
      // Navigate first, then show alert
      safeGoBack();
      
      // Show success message after a short delay
      setTimeout(() => {
        Alert.alert('Success', 'Profile updated successfully!');
      }, 300);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getImageUri = (): string | undefined => {
    if (!profilePic) return undefined;
    // If it's already a full URI (http/https), return it
    if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
      return profilePic;
    }
    // If it's base64, add the data URI prefix
    if (profilePic.startsWith('data:')) {
      return profilePic;
    }
    // Otherwise, treat as base64
    return `data:image/jpeg;base64,${profilePic}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity
          onPress={safeGoBack}
          disabled={isSaving}
        >
          <Text style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={[styles.headerButton, styles.saveButton, (isSaving || isLoading) && styles.headerButtonDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.profilePicSection}>
          <TouchableOpacity
            style={styles.profilePicContainer}
            onPress={handlePickImage}
            disabled={isSaving}
          >
            {getImageUri() ? (
              <Image
                source={{ uri: getImageUri() }}
                style={styles.profilePic}
              />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <Text style={styles.profilePicPlaceholderText}>
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.editPicOverlay}>
              <Text style={styles.editPicText}>✏️</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profilePicHint}>
            Tap to change profile picture
          </Text>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={500}
            editable={!isSaving}
          />
          <Text style={styles.characterCount}>
            {bio.length}/500
          </Text>
        </View>

        {/* User Info (Read-only) */}
        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.readOnlyText}>{user?.username}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.readOnlyText}>{user?.email}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerButtonDisabled: {
    color: '#ccc',
  },
  saveButton: {
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profilePicSection: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  profilePicContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
  },
  profilePicPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicPlaceholderText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  editPicOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  editPicText: {
    fontSize: 18,
  },
  profilePicHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
    paddingVertical: 8,
  },
});

