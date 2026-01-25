import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { joinEvent, leaveEvent, subscribeJoinedEventIds, getParticipationDeadlineHours, isPastParticipationDeadline } from '../services/participationService';
import RenderHTML from 'react-native-render-html';
import { marked } from 'marked';

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { isAuthenticated, user } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [deadlineHours, setDeadlineHours] = useState(48);
  const [activeTab, setActiveTab] = useState('appetizer');
  
  const contentWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadEventDetails();
  }, [eventId]);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      setDeadlineHours(await getParticipationDeadlineHours(db));
    })();
    if (user?.uid) {
      unsub = subscribeJoinedEventIds(db, user.uid, setJoinedIds);
    } else {
      setJoinedIds(new Set());
    }
    return () => unsub();
  }, [user?.uid]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        setEvent(eventData);
        
        // Set initial tab to first available recipe
        if (eventData.recipes?.appetizer?.name) {
          setActiveTab('appetizer');
        } else if (eventData.recipes?.mainCourse?.name) {
          setActiveTab('mainCourse');
        } else if (eventData.recipes?.dessert?.name) {
          setActiveTab('dessert');
        }
      } else {
        Alert.alert('Error', 'Event not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading event details:', error);
      Alert.alert('Error', 'Failed to load event details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (event?.createdBy === user?.uid) {
      Alert.alert('Not allowed', 'You cannot join your own event');
      return;
    }
    try {
      const res = await joinEvent(db, user.uid, event.id);
      
      if (res?.overCap && res?.warningMessage) {
        Alert.alert('Warning', res.warningMessage);
      }
    } catch (e) {
      Alert.alert('Cannot join', e?.message || 'Failed to join');
    }
  };

  const handleLeave = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      await leaveEvent(db, user.uid, event.id);
    } catch (e) {
      Alert.alert('Cannot leave', e?.message || 'Failed to leave');
    }
  };

  const renderContent = (text) => {
    if (!text) return null;
    
    try {
      // Try to render as HTML first
      if (text.includes('<') && text.includes('>')) {
        return (
          <RenderHTML
            contentWidth={contentWidth - (SPACING.lg * 4)}
            source={{ html: text }}
            tagsStyles={{
              body: { 
                fontSize: FONT_SIZES.sm, 
                color: COLORS.textSecondary,
                lineHeight: 20,
                margin: 0,
                padding: 0
              },
              p: { margin: 0, marginBottom: SPACING.xs },
              h1: { fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              h2: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              h3: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              ul: { margin: 0, paddingLeft: SPACING.md },
              ol: { margin: 0, paddingLeft: SPACING.md },
              li: { marginBottom: SPACING.xs },
              strong: { fontWeight: 'bold', color: COLORS.textPrimary },
              em: { fontStyle: 'italic' },
            }}
          />
        );
      }
      
      // Try to render as Markdown
      if (text.includes('#') || text.includes('*') || text.includes('-') || text.includes('_')) {
        const htmlContent = marked(text);
        return (
          <RenderHTML
            contentWidth={contentWidth - (SPACING.lg * 4)}
            source={{ html: htmlContent }}
            tagsStyles={{
              body: { 
                fontSize: FONT_SIZES.sm, 
                color: COLORS.textSecondary,
                lineHeight: 20,
                margin: 0,
                padding: 0
              },
              p: { margin: 0, marginBottom: SPACING.xs },
              h1: { fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              h2: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              h3: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.xs },
              ul: { margin: 0, paddingLeft: SPACING.md },
              ol: { margin: 0, paddingLeft: SPACING.md },
              li: { marginBottom: SPACING.xs },
              strong: { fontWeight: 'bold', color: COLORS.textPrimary },
              em: { fontStyle: 'italic' },
            }}
          />
        );
      }
      
      // Render as plain text
      return <Text style={styles.recipeSectionText}>{text}</Text>;
    } catch (error) {
      // Fallback to plain text if rendering fails
      return <Text style={styles.recipeSectionText}>{text}</Text>;
    }
  };

  const renderTabButton = (tabKey, title, icon) => {
    const recipe = event?.recipes?.[tabKey];
    const isActive = activeTab === tabKey;
    const hasContent = recipe?.name;

    return (
      <TouchableOpacity
        key={tabKey}
        style={[
          styles.tabButton,
          isActive && styles.activeTabButton,
          !hasContent && styles.disabledTabButton
        ]}
        onPress={() => hasContent && setActiveTab(tabKey)}
        disabled={!hasContent}
      >
        <Ionicons 
          name={icon} 
          size={20} 
          color={!hasContent ? COLORS.gray : isActive ? COLORS.white : COLORS.primary} 
        />
        <Text style={[
          styles.tabButtonText,
          isActive && styles.activeTabButtonText,
          !hasContent && styles.disabledTabButtonText
        ]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderActiveRecipe = () => {
    const recipe = event?.recipes?.[activeTab];
    if (!recipe || !recipe.name) return null;

    return (
      <View style={styles.recipeCard}>
        <Text style={styles.recipeName}>{recipe.name}</Text>
        
        {recipe.ingredients && (
          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>Ingredients:</Text>
            {renderContent(recipe.ingredients)}
          </View>
        )}
        
        {recipe.instructions && (
          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>Instructions:</Text>
            {renderContent(recipe.instructions)}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const priceText = typeof event.costPerPerson === 'number' && !isNaN(event.costPerPerson)
    ? `€${event.costPerPerson} / person`
    : 'Free';
  const spotsLeft = typeof event.maxGuests === 'number' && typeof event.participantsCount === 'number'
    ? Math.max(event.maxGuests - event.participantsCount, 0)
    : null;
  const isJoined = joinedIds.has(event.id);
  const isOwner = event?.createdBy && user?.uid && event.createdBy === user.uid;
  const deadlinePassed = isPastParticipationDeadline(event.startAt, deadlineHours);
  const disableAction = isOwner;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: event.imageUrl || event.iconUrl || 'https://images.unsplash.com/photo-1514511547114-9d3d7a4d88ae?w=400&h=300&fit=crop' }}
            style={styles.eventImage}
          />
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title || 'Untitled event'}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Available</Text>
            </View>
          </View>

          {event.description && (
            <Text style={styles.eventDescription}>{event.description}</Text>
          )}

          {/* Event Details */}
          <View style={styles.detailsSection}>
            {event.date && (
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.detailText}>{event.date}</Text>
              </View>
            )}
            {event.time && (
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={styles.detailText}>{event.time}</Text>
              </View>
            )}
            {(event.address || event.postalCode) && (
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                <Text style={styles.detailText}>{event.address || event.postalCode}</Text>
              </View>
            )}
            {event.cookingStyle && (
              <View style={styles.detailItem}>
                <Text style={styles.cookingStyleIcon}>{event.cookingStyle.icon}</Text>
                <Text style={styles.detailText}>{event.cookingStyle.name} cuisine</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
              <Text style={styles.detailText}>{priceText}</Text>
            </View>
            {spotsLeft !== null && (
              <View style={styles.detailItem}>
                <Ionicons name="people-outline" size={20} color={COLORS.primary} />
                <Text style={styles.detailText}>{spotsLeft} spots left</Text>
              </View>
            )}
          </View>

          {/* Menu Section */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>Menu</Text>
            
            {/* Check if any recipes exist */}
            {(event.recipes?.appetizer?.name || 
              event.recipes?.mainCourse?.name || 
              event.recipes?.dessert?.name) ? (
              <>
                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                  {renderTabButton('appetizer', 'Appetizer', 'leaf-outline')}
                  {renderTabButton('mainCourse', 'Main Course', 'restaurant-outline')}
                  {renderTabButton('dessert', 'Dessert', 'ice-cream-outline')}
                </View>

                {/* Active Recipe Content */}
                {renderActiveRecipe()}
              </>
            ) : (
              /* If no menu items available */
              <View style={styles.noMenuContainer}>
                <Ionicons name="restaurant-outline" size={48} color={COLORS.gray} />
                <Text style={styles.noMenuText}>Menu details not available</Text>
                <Text style={styles.noMenuSubtext}>Contact the host for more information</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          {!isAuthenticated ? (
            <View style={styles.guestSection}>
              <Text style={styles.guestText}>Please login to join this event</Text>
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                disableAction && { opacity: 0.5 },
                isJoined && { backgroundColor: COLORS.error }
              ]}
              disabled={disableAction}
              onPress={() => (isJoined ? handleLeave() : handleJoin())}
            >
              <Ionicons 
                name={isJoined ? 'log-out-outline' : 'log-in-outline'} 
                size={20} 
                color={COLORS.white} 
              />
              <Text style={styles.actionButtonText}>
                {isJoined ? 'Leave Event' : 'Join Event'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </View>
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
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
  },
  imageContainer: {
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.lightGray,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    backgroundColor: COLORS.white,
    marginTop: -20,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.medium,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  eventTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.md,
  },
  statusBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  detailsSection: {
    marginBottom: SPACING.xl,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  detailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  menuContainer: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    marginBottom: SPACING.lg,
    ...SHADOWS.light,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.xs,
  },
  activeTabButton: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.light,
  },
  disabledTabButton: {
    opacity: 0.5,
  },
  tabButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  activeTabButtonText: {
    color: COLORS.white,
  },
  disabledTabButtonText: {
    color: COLORS.gray,
  },
  recipeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  recipeName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  recipeSection: {
    marginBottom: SPACING.md,
  },
  recipeSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  recipeSectionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  noMenuContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
  },
  noMenuText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  noMenuSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray,
    textAlign: 'center',
  },
  guestSection: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  guestText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.medium,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
  cookingStyleIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
});
