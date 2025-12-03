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
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiService } from '../../services/api';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as { email?: string } | undefined;
  
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{token?: string; newPassword?: string; confirmPassword?: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const tokenInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const validateField = (field: 'token' | 'newPassword' | 'confirmPassword', value: string) => {
    const errors = { ...fieldErrors };
    
    if (field === 'token') {
      if (!value.trim()) {
        errors.token = 'Reset token is required';
      } else {
        delete errors.token;
      }
    } else if (field === 'newPassword') {
      if (!value.trim()) {
        errors.newPassword = 'Password is required';
      } else if (value.length < 6) {
        errors.newPassword = 'Password must be at least 6 characters long';
      } else {
        delete errors.newPassword;
      }
    } else if (field === 'confirmPassword') {
      if (!value.trim()) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (value !== newPassword) {
        errors.confirmPassword = 'Passwords do not match';
      } else {
        delete errors.confirmPassword;
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTokenChange = (text: string) => {
    setToken(text);
    if (fieldErrors.token) {
      validateField('token', text);
    }
    setError('');
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (fieldErrors.newPassword) {
      validateField('newPassword', text);
    }
    if (confirmPassword && fieldErrors.confirmPassword) {
      validateField('confirmPassword', confirmPassword);
    }
    setError('');
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (fieldErrors.confirmPassword) {
      validateField('confirmPassword', text);
    }
    setError('');
  };

  const handleTokenSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    confirmPasswordInputRef.current?.focus();
  };

  const handleResetPassword = async () => {
    // Validate all fields
    const isTokenValid = validateField('token', token);
    const isPasswordValid = validateField('newPassword', newPassword);
    const isConfirmPasswordValid = validateField('confirmPassword', confirmPassword);

    if (!isTokenValid || !isPasswordValid || !isConfirmPasswordValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      await apiService.resetPassword(token.trim(), newPassword);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Password Reset Successful',
        'Your password has been reset successfully. You can now login with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => {
              navigation.navigate('Login' as never);
            }
          }
        ]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to reset password. Please check your token and try again.');
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your reset token and new password</Text>
          
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Reset Token</Text>
              <View style={[styles.inputWrapper, fieldErrors.token && styles.inputError]}>
                <Ionicons 
                  name="key-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={tokenInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={token}
                  onChangeText={handleTokenChange}
                  placeholder="Enter your reset token"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={handleTokenSubmit}
                  blurOnSubmit={false}
                />
              </View>
              {fieldErrors.token && (
                <Text style={styles.fieldErrorText}>{fieldErrors.token}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={[styles.inputWrapper, fieldErrors.newPassword && styles.inputError]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={newPassword}
                  onChangeText={handleNewPasswordChange}
                  placeholder="Enter new password (min 6 characters)"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={handlePasswordSubmit}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowPassword(!showPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.eyeIcon}
                  disabled={!newPassword}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color={newPassword ? "#666" : "#ccc"} 
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.newPassword && (
                <Text style={styles.fieldErrorText}>{fieldErrors.newPassword}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrapper, fieldErrors.confirmPassword && styles.inputError]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmPasswordInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  placeholder="Confirm your new password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowConfirmPassword(!showConfirmPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.eyeIcon}
                  disabled={!confirmPassword}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color={confirmPassword ? "#666" : "#ccc"} 
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.confirmPassword && (
                <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
              )}
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('ForgotPassword' as never)}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Need a new token? Request Reset</Text>
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
  eyeIcon: {
    padding: 8,
    marginRight: 8,
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

