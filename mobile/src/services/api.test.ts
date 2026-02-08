import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch;
  mockFetch.mockReset();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
});

describe('ApiService', () => {
  describe('login', () => {
    it('calls POST /auth/login with credentials and stores token', async () => {
      const mockResponse = {
        message: 'Login successful',
        user: { id: 1, username: 'test', email: 'test@example.com' },
        token: 'jwt-token-123',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'testuser', password: 'password123' }),
        })
      );
      expect(result).toEqual(mockResponse);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
    });
  });

  describe('register', () => {
    it('calls POST /auth/register with user data and stores token', async () => {
      const mockResponse = {
        message: 'Registered',
        user: { id: 1, username: 'newuser', email: 'new@example.com' },
        token: 'jwt-token-456',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'newuser',
            email: 'new@example.com',
            password: 'password123',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-456');
    });
  });

  describe('logout', () => {
    it('removes auth token from storage', async () => {
      await apiService.logout();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('getProfile', () => {
    it('calls GET /auth/profile with Authorization header when token exists', async () => {
      jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1, username: 'test' } }),
      });

      await apiService.getProfile();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/profile'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('createWorkout', () => {
    it('calls POST /workouts with workout data', async () => {
      jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Created', workout: { id: 1, title: 'Morning Run' } }),
      });

      await apiService.createWorkout({
        title: 'Morning Run',
        date: '2025-02-07',
        duration: 45,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/workouts'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: 'Morning Run',
            date: '2025-02-07',
            duration: 45,
          }),
        })
      );
    });
  });

  describe('getExercisesByMuscleGroup', () => {
    it('formats muscle group and calls correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exercises: [] }),
      });

      await apiService.getExercisesByMuscleGroup('chest');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('muscle_group=Chest'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      await expect(
        apiService.login({ username: 'bad', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
