import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type CommentsRouteParams = {
  Comments: {
    workoutId: number;
    workoutTitle?: string;
  };
};

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  username: string;
  bio?: string;
}

export default function CommentsScreen() {
  const route = useRoute<RouteProp<CommentsRouteParams, 'Comments'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { workoutId, workoutTitle } = route.params;
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getComments(workoutId);
      setComments(response.comments || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiService.addComment(workoutId, commentText.trim());
      // Add the new comment to the list
      setComments(prev => [...prev, response.comment]);
      setCommentText('');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', error.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteComment(commentId);
              setComments(prev => prev.filter(c => c.id !== commentId));
            } catch (error: any) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', error.message || 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {workoutTitle ? `Comments: ${workoutTitle}` : 'Comments'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Comments List */}
      <ScrollView 
        style={styles.commentsList}
        contentContainerStyle={styles.commentsContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No comments yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to comment!
            </Text>
          </View>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {comment.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.commentInfo}>
                  <Text style={styles.commentUsername}>{comment.username}</Text>
                  <Text style={styles.commentTime}>{formatDate(comment.created_at)}</Text>
                </View>
                {user?.id === comment.user_id && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteComment(comment.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.commentContent}>{comment.content}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#999"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          editable={!isSubmitting}
        />
        <TouchableOpacity
          style={[styles.submitButton, (!commentText.trim() || isSubmitting) && styles.submitButtonDisabled]}
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  commentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentInfo: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  commentContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});

