import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';

interface SearchUser {
  id: number;
  username: string;
  bio?: string;
  created_at: string;
  follower_count: string;
  following_count: string;
  is_following: boolean;
  profile_pic?: string | null;
}

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const loadRecommendedUsers = useCallback(async () => {
    try {
      setIsLoadingRecommended(true);
      const response = await apiService.getRecommendedUsers();
      const formattedUsers = response.users.map((u: any) => ({
        ...u,
        follower_count: parseInt(u.follower_count) || 0,
        following_count: parseInt(u.following_count) || 0,
        is_following: false,
      }));
      setRecommendedUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading recommended users:', error);
    } finally {
      setIsLoadingRecommended(false);
    }
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.searchUsers(query);
      const formattedUsers = response.users.map((u: any) => ({
        ...u,
        follower_count: parseInt(u.follower_count) || 0,
        following_count: parseInt(u.following_count) || 0,
        is_following: u.is_following === true || u.is_following === 'true',
      }));
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFollow = async (userId: number) => {
    try {
      await apiService.followUser(userId);
      // Update recommended users list
      setRecommendedUsers(prev => prev.filter(u => u.id !== userId));
      // Update search results if this user is in them
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: true } : u
      ));
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer for debounced search
    const timer = setTimeout(() => {
      searchUsers(text);
    }, 500);

    setDebounceTimer(timer);
  };

  // Load recommended users when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadRecommendedUsers();
      return () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      };
    }, [loadRecommendedUsers, debounceTimer])
  );

  // Reload recommended users when search is cleared
  useEffect(() => {
    if (searchQuery.trim() === '') {
      loadRecommendedUsers();
    }
  }, [searchQuery, loadRecommendedUsers]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#007AFF" style={styles.searchInputIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by username..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchQuery.trim() === '' ? (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recommended Users */}
          {isLoadingRecommended ? (
            <View style={styles.recommendedLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : recommendedUsers.length > 0 ? (
            <View style={styles.recommendedSection}>
              <Text style={styles.recommendedTitle}>Recommended for you</Text>
              {recommendedUsers.map((user) => {
                const profileImageUri = user.profile_pic
                  ? (user.profile_pic.startsWith?.('data:')
                      ? user.profile_pic
                      : `data:image/jpeg;base64,${user.profile_pic}`)
                  : null;

                return (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.userCard}
                    onPress={() =>
                      navigation.navigate('UserProfile' as never, {
                        userId: user.id,
                      } as never)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.userInfo}>
                      <View style={styles.userAvatar}>
                        {profileImageUri ? (
                          <Image source={{ uri: profileImageUri }} style={styles.userAvatarImage} />
                        ) : (
                          <Text style={styles.userAvatarText}>
                            {user.username.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.userDetails}>
                        <Text style={styles.username}>{user.username}</Text>
                        {user.bio && (
                          <Text style={styles.userBio} numberOfLines={1}>
                            {user.bio}
                          </Text>
                        )}
                        <View style={styles.userStats}>
                          <Text style={styles.userStatText}>
                            {user.follower_count} followers
                          </Text>
                          <Text style={styles.userStatText}> • </Text>
                          <Text style={styles.userStatText}>
                            {user.following_count} following
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.followButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleFollow(user.id);
                        }}
                      >
                        <Text style={styles.followButtonText}>Follow</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {users.map((user) => {
            const profileImageUri = user.profile_pic
              ? (user.profile_pic.startsWith?.('data:')
                  ? user.profile_pic
                  : `data:image/jpeg;base64,${user.profile_pic}`)
              : null;

            return (
              <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() =>
                navigation.navigate('UserProfile' as never, {
                  userId: user.id,
                } as never)
              }
              activeOpacity={0.7}
            >
              <View style={styles.userInfo}>
                <View style={styles.userAvatar}>
                  {profileImageUri ? (
                    <Image source={{ uri: profileImageUri }} style={styles.userAvatarImage} />
                  ) : (
                    <Text style={styles.userAvatarText}>
                      {user.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.username}>{user.username}</Text>
                  {user.bio && (
                    <Text style={styles.userBio} numberOfLines={1}>
                      {user.bio}
                    </Text>
                  )}
                  <View style={styles.userStats}>
                    <Text style={styles.userStatText}>
                      {user.follower_count} followers
                    </Text>
                    <Text style={styles.userStatText}> • </Text>
                    <Text style={styles.userStatText}>
                      {user.following_count} following
                    </Text>
                  </View>
                </View>
                {user.is_following && (
                  <View style={styles.followingBadge}>
                    <Text style={styles.followingBadgeText}>Following</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  recommendedSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  recommendedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  recommendedLoading: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStatText: {
    fontSize: 12,
    color: '#999',
  },
  followingBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  followingBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
