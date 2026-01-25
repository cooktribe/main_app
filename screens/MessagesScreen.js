import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const { eventChats, loading, refreshChats } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshChats();
    setRefreshing(false);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getLastMessageText = (chat) => {
    if (!chat.lastMessage) {
      return 'No messages yet';
    }
    
    const participant = chat.participants?.find(p => p.id === chat.lastMessage.senderId);
    let senderName = 'Someone';
    
    if (participant?.name && participant.name !== participant.id) {
      // Use the name from participant profile if it's not just the ID
      senderName = participant.name;
    } else if (chat.lastMessage.senderName && chat.lastMessage.senderName !== chat.lastMessage.senderId) {
      // Use the senderName from message if it's not just the ID
      senderName = chat.lastMessage.senderName;
    } else {
      // Fallback to a more user-friendly display
      senderName = participant?.email || chat.lastMessage.senderName || 'User';
    }
    
    return `${senderName}: ${chat.lastMessage.text}`;
  };

  const navigateToChat = (chat) => {
    navigation.navigate('Chat', {
      eventId: chat.id,
      eventTitle: chat.eventTitle,
      eventImage: chat.eventImage,
      participants: chat.participants
    });
  };

  const renderEventChat = (chat) => (
    <TouchableOpacity 
      key={chat.id} 
      style={styles.conversationItem}
      onPress={() => navigateToChat(chat)}
    >
      <View style={styles.avatarContainer}>
        {chat.eventImage ? (
          <Image source={{ uri: chat.eventImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="restaurant" size={24} color={COLORS.white} />
          </View>
        )}
        <View style={styles.groupIndicator}>
          <View style={styles.participantAvatars}>
            {chat.participants?.slice(0, 2).map((participant, index) => (
              <View 
                key={participant.id || index}
                style={[styles.participantAvatar, { marginLeft: index > 0 ? -8 : 0 }]} 
              >
                <Text style={styles.participantAvatarText}>
                  {(participant.name || participant.id || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {chat.participants?.length > 2 && (
              <View style={[styles.participantAvatar, { marginLeft: -8 }]}>
                <Text style={styles.participantAvatarText}>
                  +{chat.participants.length - 2}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {chat.eventTitle}
          </Text>
          <Text style={styles.conversationTime}>
            {formatTime(chat.lastActivity)}
          </Text>
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.lastMessage} numberOfLines={2}>
            {getLastMessageText(chat)}
          </Text>
          {chat.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
    </TouchableOpacity>
  );

  const filteredChats = eventChats.filter(chat => 
    chat.eventTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your event chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Event Chats</Text>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search event chats..."
            placeholderTextColor={COLORS.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Conversations List */}
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {filteredChats.length > 0 ? (
          filteredChats.map(renderEventChat)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.lightGray} />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No chats found' : 'No event chats yet'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {searchQuery 
                ? 'Try searching for a different event name'
                : 'Join cooking events and complete them to start chatting with your matched partners!'
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.light,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...SHADOWS.light,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.lightGray,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIndicator: {
    position: 'absolute',
    bottom: -5,
    right: -5,
  },
  participantAvatars: {
    flexDirection: 'row',
  },
  participantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  conversationName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  conversationTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  unreadCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl * 2,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
