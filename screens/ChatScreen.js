import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  const { eventId, eventTitle, eventImage, participants } = route.params;
  const { user } = useAuth();
  const { sendMessage, subscribeToMessages } = useChat();
  
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [participantProfiles, setParticipantProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);

  // Fetch participant profiles
  const fetchParticipantProfiles = async () => {
    if (!participants || participants.length === 0) return;
    
    setProfilesLoading(true);
    
    try {
      const profilePromises = participants.map(async (participant) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', participant.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const resolvedName = userData.displayName || userData.nickname || userData.firstName || 
                             (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName) ||
                             userData.email || participant.id;
            const profile = {
              ...participant,
              id: participant.id,
              name: resolvedName,
              email: userData.email,
              photoURL: userData.photoURL || userData.avatarUrl || null
            };
            return profile;
          } else {
            return {
              id: participant.id,
              name: participant.id,
              email: null,
              photoURL: null,
              ...participant
            };
          }
        } catch (error) {
          console.error('Error fetching profile for user:', participant.id, error);
          return {
            id: participant.id,
            name: participant.id,
            email: null,
            photoURL: null,
            ...participant
          };
        }
      });
      
      const profiles = await Promise.all(profilePromises);
      setParticipantProfiles(profiles);
      
    } catch (error) {
      console.error('Error fetching participant profiles:', error);
      setParticipantProfiles(participants); // Fallback to original data
    } finally {
      setProfilesLoading(false);
    }
  };

  // Load participant profiles on mount
  useEffect(() => {
    fetchParticipantProfiles();
  }, [participants]);

  // Handle keyboard show/hide
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto scroll to bottom when keyboard appears
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [messages.length]);

  // Subscribe to messages for this event
  useEffect(() => {
    
    const unsubscribe = subscribeToMessages(eventId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Auto scroll to bottom when new messages arrive
      setTimeout(() => {
        if (flatListRef.current && newMessages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [eventId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const textToSend = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await sendMessage(eventId, textToSend);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(textToSend); // Restore message text on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.senderId === user?.uid;
    const showAvatar = !isOwnMessage && (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showName = !isOwnMessage && showAvatar;
    
    // Find participant info with proper name resolution
    const participant = participantProfiles.find(p => p.id === item.senderId) || 
                       participants?.find(p => p.id === item.senderId);
    let senderName = 'Unknown User';
    
    if (participant?.name && participant.name !== participant.id) {
      // Use the name from participant profile if it's not just the ID
      senderName = participant.name;
    } else if (item.senderName && item.senderName !== item.senderId) {
      // Use the senderName from message if it's not just the ID
      senderName = item.senderName;
    } else {
      // Fallback to a more user-friendly display
      senderName = participant?.email || item.senderName || 'User';
    }
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {showAvatar && (
          <View style={styles.avatarContainer}>
            {participant?.photoURL ? (
              <Image 
                source={{ uri: participant.photoURL }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[styles.messageContent, isOwnMessage && styles.ownMessageContent]}>
          {showName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          
          <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
              {item.text}
            </Text>
          </View>
          
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const getParticipantCount = () => {
    return participants?.length || 0;
  };

  const renderGroupInfoModal = () => (
    <Modal
      visible={showGroupInfo}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowGroupInfo(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setShowGroupInfo(false)}
          >
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Group Info</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Event Info */}
          <View style={styles.eventInfoSection}>
            {eventImage && (
              <Image source={{ uri: eventImage }} style={styles.eventInfoImage} />
            )}
            <Text style={styles.eventInfoTitle}>{eventTitle}</Text>
            <Text style={styles.eventInfoSubtitle}>
              {getParticipantCount()} participants
            </Text>
          </View>

          {/* Participants List */}
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              Participants {profilesLoading && '(Loading...)'}
            </Text>
            {(participantProfiles.length > 0 ? participantProfiles : participants)?.map((participant, index) => {
              const isCurrentUser = participant.id === user?.uid;
              const displayName = participant.name && participant.name !== participant.id 
                ? participant.name 
                : participant.email || participant.id;
              
              
              return (
                <View key={participant.id} style={styles.participantItem}>
                  {participant.photoURL ? (
                    <Image 
                      source={{ uri: participant.photoURL }} 
                      style={styles.participantAvatarImage}
                    />
                  ) : (
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {displayName} {isCurrentUser && '(You)'}
                    </Text>
                    {participant.email && participant.email !== displayName && (
                      <Text style={styles.participantEmail}>{participant.email}</Text>
                    )}
                  </View>
                  {isCurrentUser && (
                    <Ionicons name="person" size={16} color={COLORS.primary} />
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Group Info Modal */}
      {renderGroupInfoModal()}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          {eventImage && (
            <Image source={{ uri: eventImage }} style={styles.headerImage} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {eventTitle}
            </Text>
            <Text style={styles.headerSubtitle}>
              {getParticipantCount()} participants
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.infoButton}
          onPress={() => setShowGroupInfo(true)}
        >
          <Ionicons name="information-circle-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.lightGray} />
          <Text style={styles.emptyStateTitle}>Start the conversation!</Text>
          <Text style={styles.emptyStateSubtitle}>
            Share your cooking experience with your event partners
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }}
        />
      )}

      {/* Input Area with Keyboard Handling */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sending}
            >
              <Ionicons 
                name={sending ? "hourglass-outline" : "send"} 
                size={20} 
                color={COLORS.white} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...SHADOWS.light,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
    backgroundColor: COLORS.lightGray,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.8,
  },
  infoButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  container: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: SPACING.sm,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
  },
  avatarText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  messageContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  ownMessageContent: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  messageBubble: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    maxWidth: '80%',
    ...SHADOWS.light,
  },
  ownMessageBubble: {
    backgroundColor: COLORS.primary,
  },
  messageText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.white,
  },
  messageTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  ownMessageTime: {
    marginLeft: 0,
    marginRight: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
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
  inputContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    ...SHADOWS.light,
  },
  modalCloseButton: {
    padding: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  eventInfoSection: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  eventInfoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.lightGray,
  },
  eventInfoTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  eventInfoSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  participantsSection: {
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  participantAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
    backgroundColor: COLORS.lightGray,
  },
  participantAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  participantEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
