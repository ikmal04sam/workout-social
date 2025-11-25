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
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, isLoading, error, clearError } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{username?: string; password?: string}>({});
  
  const passwordInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);

  const validateField = (field: 'username' | 'password', value: string) => {
    const errors = { ...fieldErrors };
    
    if (field === 'username') {
      if (!value.trim()) {
        errors.username = 'Username or email is required';
      } else {
        delete errors.username;
      }
    } else if (field === 'password') {
      if (!value.trim()) {
        errors.password = 'Password is required';
      } else {
        delete errors.password;
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (fieldErrors.username) {
      validateField('username', text);
    }
    clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (fieldErrors.password) {
      validateField('password', text);
    }
    clearError();
  };

  const handleUsernameSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handleLogin = async () => {
    // Validate all fields
    const isUsernameValid = validateField('username', username);
    const isPasswordValid = validateField('password', password);

    if (!isUsernameValid || !isPasswordValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      clearError();
      await login(username.trim(), password);
      // Navigation will be handled by AuthContext
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Error is already set in context
    }
  };

  const handleForgotPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Forgot Password?',
      'Password reset functionality is coming soon!',
      [{ text: 'OK' }]
    );
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
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username or Email</Text>
              <View style={[styles.inputWrapper, fieldErrors.username && styles.inputError]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={usernameInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="Enter your username or email"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={handleUsernameSubmit}
                  blurOnSubmit={false}
                />
              </View>
              {fieldErrors.username && (
                <Text style={styles.fieldErrorText}>{fieldErrors.username}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, fieldErrors.password && styles.inputError]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color="#999" 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.input, styles.inputWithIcon]}
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowPassword(!showPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.eyeIcon}
                  disabled={!password}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color={password ? "#666" : "#ccc"} 
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.password && (
                <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register' as never)}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Don't have an account? Sign up</Text>
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
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
