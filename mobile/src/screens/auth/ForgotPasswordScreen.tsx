import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../../services/api';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{email?: string}>({});
  
  const emailInputRef = useRef<TextInput>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateField = (value: string) => {
    const errors = { ...fieldErrors };
    
    if (!value.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(value.trim())) {
      errors.email = 'Please enter a valid email address';
    } else {
      delete errors.email;
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email) {
      validateField(text);
    }
    setError('');
  };

  const handleRequestReset = async () => {
    // Validate email
    if (!validateField(email)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      await apiService.requestPasswordReset(email.trim());
      
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success message with instructions
      Alert.alert(
        'Reset Token Generated',
        'A password reset token has been generated. In development mode, check the server console for the token. In production, you would receive this via email.\n\nPlease navigate to the Reset Password screen to enter your token and new password.',
        [
          {
            text: 'Go to Reset Password',
            onPress: () => {
              navigation.navigate('ResetPassword' as never, { email: email.trim() } as never);
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to request password reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#f8f9fa', '#f0f2f5']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your email to receive a password reset token</Text>
          
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, fieldErrors.email && styles.inputError]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="send"
                  onSubmitEditing={handleRequestReset}
                />
              </View>
              {fieldErrors.email && (
                <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
              )}
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#4caf50" style={{ marginRight: 8 }} />
                <Text style={styles.successText}>
                  Reset token generated! Check the server console for the token.
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRequestReset}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Request Reset Token</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('ResetPassword' as never)}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Already have a token? Reset Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'transparent',
  },
  inputWithIcon: {
    paddingHorizontal: 8,
  },
  inputError: {
    borderColor: '#c62828',
  },
  fieldErrorText: {
    color: '#c62828',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    flex: 1,
  },
  button: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 10,
  },
  linkText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
});

