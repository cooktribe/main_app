import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  StatusBar,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { joinEvent, leaveEvent, subscribeJoinedEventIds, getParticipationDeadlineHours, isPastParticipationDeadline } from '../services/participationService';

// Cooking styles for filtering (same as in EventCreateScreen)
const COOKING_STYLES = [
  { id: 1, name: 'Italian', icon: '🍝' },
  { id: 2, name: 'Asian', icon: '🍜' },
  { id: 3, name: 'Mexican', icon: '🌮' },
  { id: 4, name: 'American', icon: '🍔' },
  { id: 5, name: 'Mediterranean', icon: '🥗' },
  { id: 6, name: 'French', icon: '🥖' },
  { id: 7, name: 'Indian', icon: '🍛' },
  { id: 8, name: 'Japanese', icon: '🍣' },
  { id: 9, name: 'Chinese', icon: '🥟' },
  { id: 10, name: 'Thai', icon: '🍲' },
  { id: 11, name: 'German', icon: '🥨' },
  { id: 12, name: 'Spanish', icon: '🥘' },
  { id: 13, name: 'Middle Eastern', icon: '🧆' },
  { id: 14, name: 'Korean', icon: '🍜' },
  { id: 15, name: 'International', icon: '🌍' }
];

export default function DiscoverScreen({ navigation }) {
  const { isAuthenticated, user } = useAuth();

  const [approvedEvents, setApprovedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(null);

  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [selectedCookingStyles, setSelectedCookingStyles] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState([]);

  // Featured hosts states
  const [featuredHosts, setFeaturedHosts] = useState([]);
  const [loadingHosts, setLoadingHosts] = useState(true);
  const [selectedHost, setSelectedHost] = useState(null);

  // Load featured hosts only when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      fetchFeaturedHosts();
    } else {
      setFeaturedHosts([]);
      setLoadingHosts(false);
    }
  }, [isAuthenticated, user?.uid]);

  useEffect(() => {
    const q = query(collection(db, 'events'), where('status', 'in', ['approved', 'confirmed']));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (items.length === 0) {
          // Fallback: fetch all events and filter client-side in case status field varies
          getDocs(collection(db, 'events'))
            .then((allSnap) => {
              const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const filtered = all.filter((e) => ['approved', 'confirmed'].includes(String(e.status || '').toLowerCase()));
              setApprovedEvents(filtered);
              setLoadingEvents(false);
            })
            .catch(() => {
              setApprovedEvents([]);
              setLoadingEvents(false);
            });
          return;
        }
        setApprovedEvents(items);
        setLoadingEvents(false);
      },
      async (error) => {
        console.warn('Failed to subscribe events:', error?.message || error);
        setEventsError(error?.message || 'Failed to load events');
        try {
          // Fallback to one-time fetch to avoid missing data before login
          let items = [];
          try {
            const snap = await getDocs(q);
            items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          } catch (_) {
            const allSnap = await getDocs(collection(db, 'events'));
            const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            items = all.filter((e) => ['approved', 'confirmed'].includes(String(e.status || '').toLowerCase()));
          }
          setApprovedEvents(items);
        } catch (e) {
          console.warn('Fallback getDocs failed:', e?.message || e);
        } finally {
          setLoadingEvents(false);
        }
      }
    );
    return unsub;
  }, []);

  const [joinedIds, setJoinedIds] = useState(new Set());
  const [deadlineHours, setDeadlineHours] = useState(48);

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

  const handleJoin = async (ev) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (ev?.createdBy === user?.uid) {
      Alert.alert('Not allowed', 'You cannot join your own event');
      return;
    }
    try {
      const res = await joinEvent(db, user.uid, ev.id);
      
      if (res?.overCap && res?.warningMessage) {
        Alert.alert(
          'Warning',
          res.warningMessage
        );
      }
    } catch (e) {
      Alert.alert('Cannot join', e?.message || 'Failed to join');
    }
  };

  const handleLeave = async (ev) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      await leaveEvent(db, user.uid, ev.id);
    } catch (e) {
      Alert.alert('Cannot leave', e?.message || 'Failed to leave');
    }
  };

  // Filter events based on search text, selected cooking styles, and selected host
  const filterEvents = (events, searchQuery, cookingStyleFilters, hostFilter) => {
    let filtered = events;

    // Filter by selected host first
    if (hostFilter) {
      filtered = filtered.filter(event => event.createdBy === hostFilter.id);
    }

    // Filter by search text
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(event => {
        const title = (event.title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const cookingStyleName = (event.cookingStyle?.name || '').toLowerCase();
        const address = (event.address || '').toLowerCase();
        const postalCode = (event.postalCode || '').toLowerCase();
        
        return title.includes(query) || 
               description.includes(query) || 
               cookingStyleName.includes(query) ||
               address.includes(query) ||
               postalCode.includes(query);
      });
    }

    // Filter by cooking styles
    if (cookingStyleFilters.length > 0) {
      filtered = filtered.filter(event => {
        if (!event.cookingStyle) return false;
        return cookingStyleFilters.some(style => style.id === event.cookingStyle.id);
      });
    }

    return filtered;
  };

  // Update filtered events when search text, cooking styles, selected host, or events change
  useEffect(() => {
    const filtered = filterEvents(approvedEvents, searchText, selectedCookingStyles, selectedHost);
    setFilteredEvents(filtered);
  }, [approvedEvents, searchText, selectedCookingStyles, selectedHost]);

  // Handle cooking style filter selection
  const toggleCookingStyleFilter = (style) => {
    setSelectedCookingStyles(prev => {
      const isSelected = prev.some(s => s.id === style.id);
      if (isSelected) {
        return prev.filter(s => s.id !== style.id);
      } else {
        return [...prev, style];
      }
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchText('');
    setSelectedCookingStyles([]);
    setSelectedHost(null);
  };

  // Fetch featured hosts (users who have created confirmed events)
  const fetchFeaturedHosts = async () => {
    try {
      setLoadingHosts(true);
      
      // Get all confirmed events to find unique hosts
      const eventsQuery = query(
        collection(db, 'events'), 
        where('status', '==', 'confirmed')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      
      if (eventsSnapshot.docs.length === 0) {
        setFeaturedHosts([]);
        setLoadingHosts(false);
        return;
      }

      // Get unique host IDs from confirmed events
      const hostIds = [...new Set(eventsSnapshot.docs.map(doc => doc.data().createdBy).filter(Boolean))];
      
      if (hostIds.length === 0) {
        setFeaturedHosts([]);
        setLoadingHosts(false);
        return;
      }

      // Fetch host profiles with updated database rules
      const hostPromises = hostIds.slice(0, 10).map(async (hostId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', hostId));
          
          // Get events for this host
          const hostEvents = eventsSnapshot.docs
            .filter(eventDoc => eventDoc.data().createdBy === hostId)
            .map(eventDoc => ({ id: eventDoc.id, ...eventDoc.data() }));
          
          // Extract cooking styles as specialties
          const specialties = [...new Set(
            hostEvents
              .map(event => event.cookingStyle?.name)
              .filter(Boolean)
          )];
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: hostId,
              name: userData.nickname || userData.firstName || userData.displayName || `Host ${hostEvents.length}`,
              avatar: userData.avatarUrl || userData.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
              verified: userData.profileCompleted || false,
              nationality: userData.nationality || 'International',
              specialties: userData.foodPreferences?.length > 0 ? userData.foodPreferences : specialties,
              eventsCount: hostEvents.length,
              events: hostEvents,
              rating: 4.5 + Math.random() * 0.5,
            };
          } else {
            // Fallback if user profile doesn't exist
            return {
              id: hostId,
              name: `Host ${hostEvents.length}`,
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
              verified: true,
              nationality: 'International',
              specialties: specialties,
              eventsCount: hostEvents.length,
              events: hostEvents,
              rating: 4.5 + Math.random() * 0.5,
            };
          }
        } catch (error) {
          console.error('Error fetching host profile:', hostId, error);
          
          // Fallback data if profile fetch fails
          const hostEvents = eventsSnapshot.docs
            .filter(eventDoc => eventDoc.data().createdBy === hostId)
            .map(eventDoc => ({ id: eventDoc.id, ...eventDoc.data() }));
          
          return {
            id: hostId,
            name: `Host ${hostEvents.length}`,
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
            verified: true,
            nationality: 'International',
            specialties: [],
            eventsCount: hostEvents.length,
            events: hostEvents,
            rating: 4.5 + Math.random() * 0.5,
          };
        }
      });

      const hosts = await Promise.all(hostPromises);
      
      // Filter and sort hosts
      const validHosts = hosts
        .filter(host => host.eventsCount > 0)
        .sort((a, b) => b.eventsCount - a.eventsCount);

      setFeaturedHosts(validHosts);
    } catch (error) {
      console.error('Error fetching featured hosts:', error);
      setFeaturedHosts([]);
    } finally {
      setLoadingHosts(false);
    }
  };

  // Handle host selection
  const handleHostSelect = (host) => {
    setSelectedHost(host);
    setSearchText('');
    setSelectedCookingStyles([]);
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Guest Login Banner */}
        {!isAuthenticated && (
          <View style={styles.guestBanner}>
            <View style={styles.guestBannerContent}>
              <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
              <View style={styles.guestBannerText}>
                <Text style={styles.guestBannerTitle}>Welcome, Guest!</Text>
                <Text style={styles.guestBannerSubtitle}>
                  You can browse events, but please login to join them.
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.guestLoginButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.guestLoginButtonText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={COLORS.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events, cuisines, hosts..."
              placeholderTextColor={COLORS.gray}
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons name="options-outline" size={20} color={COLORS.textPrimary} />
              {selectedCookingStyles.length > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{selectedCookingStyles.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Selected Filters Display */}
          {(searchText.trim() || selectedCookingStyles.length > 0 || selectedHost) && (
            <View style={styles.filtersDisplay}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersScrollContent}
              >
                {selectedHost && (
                  <View style={styles.filterChip}>
                    <Ionicons name="person-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.filterChipText}>Host: {selectedHost.name}</Text>
                    <TouchableOpacity 
                      onPress={() => setSelectedHost(null)}
                      style={styles.filterChipRemove}
                    >
                      <Ionicons name="close" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {searchText.trim() && (
                  <View style={styles.filterChip}>
                    <Ionicons name="search-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.filterChipText}>"{searchText}"</Text>
                    <TouchableOpacity 
                      onPress={() => setSearchText('')}
                      style={styles.filterChipRemove}
                    >
                      <Ionicons name="close" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {selectedCookingStyles.map(style => (
                  <View key={style.id} style={styles.filterChip}>
                    <Text style={styles.filterChipIcon}>{style.icon}</Text>
                    <Text style={styles.filterChipText}>{style.name}</Text>
                    <TouchableOpacity 
                      onPress={() => toggleCookingStyleFilter(style)}
                      style={styles.filterChipRemove}
                    >
                      <Ionicons name="close" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>


        {/* Featured Hosts - Only show for authenticated users */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Hosts</Text>
            
            {loadingHosts ? (
              <View style={styles.hostsLoadingContainer}>
                <Text style={styles.hostsLoadingText}>Loading hosts...</Text>
              </View>
            ) : featuredHosts.length === 0 ? (
              <View style={styles.hostsLoadingContainer}>
                <Text style={styles.hostsLoadingText}>No hosts available at the moment.</Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.hostsScrollView}
                contentContainerStyle={styles.hostsContainer}
              >
                {featuredHosts.map((host) => (
                  <TouchableOpacity 
                    key={host.id} 
                    style={[
                      styles.hostCard,
                      selectedHost?.id === host.id && styles.hostCardSelected
                    ]}
                    onPress={() => handleHostSelect(host)}
                  >
                    <Image source={{ uri: host.avatar }} style={styles.hostImage} />
                    <View style={styles.hostInfo}>
                      <View style={styles.hostNameContainer}>
                        <Text style={styles.hostName} numberOfLines={1}>
                          {host.name}
                        </Text>
                        {host.verified && (
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                        )}
                      </View>
                      
                      <Text style={styles.hostSpecialty} numberOfLines={1}>
                        {host.nationality || 'International Host'}
                      </Text>
                      
                      {host.specialties.length > 0 && (
                        <Text style={styles.hostFoodPrefs} numberOfLines={1}>
                          {host.specialties.slice(0, 2).join(', ')}
                        </Text>
                      )}
                      
                      <View style={styles.hostStatsContainer}>
                        <View style={styles.ratingContainer}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.rating}>{host.rating.toFixed(1)}</Text>
                        </View>
                        <Text style={styles.hostEventsCount}>
                          {host.eventsCount} event{host.eventsCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    
                    {selectedHost?.id === host.id && (
                      <View style={styles.hostSelectedIndicator}>
                        <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedHost ? `${selectedHost.name}'s Events` : 'Upcoming Events'}
            </Text>
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {loadingEvents ? (
            <Text style={{ paddingHorizontal: SPACING.lg, color: COLORS.textSecondary }}>Loading events...</Text>
          ) : filteredEvents.length === 0 ? (
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <Text style={{ color: COLORS.textSecondary }}>
                {approvedEvents.length === 0 
                  ? 'No events available.' 
                  : (searchText.trim() || selectedCookingStyles.length > 0)
                    ? 'No events match your search criteria.'
                    : 'No events available.'
                }
              </Text>
            </View>
          ) : (
            filteredEvents.map((ev) => {
              const priceText = typeof ev.costPerPerson === 'number' && !isNaN(ev.costPerPerson)
                ? `€${ev.costPerPerson} / person`
                : 'Free';
              const spotsLeft = typeof ev.maxGuests === 'number' && typeof ev.participantsCount === 'number'
                ? Math.max(ev.maxGuests - ev.participantsCount, 0)
                : null;
              const isJoined = joinedIds.has(ev.id);
              const isOwner = ev?.createdBy && user?.uid && ev.createdBy === user.uid;
              const deadlinePassed = isPastParticipationDeadline(ev.startAt, deadlineHours);
              const disableAction = isOwner; // allow click even if deadline passed to show message
              return (
                <TouchableOpacity 
                  key={ev.id} 
                  style={[styles.eventCard, { marginBottom: SPACING.lg }]} 
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}
                >
                  <Image 
                    source={{ uri: ev.imageUrl || ev.iconUrl || 'https://images.unsplash.com/photo-1514511547114-9d3d7a4d88ae?w=300&h=200&fit=crop' }}
                    style={styles.eventImage}
                  />
                  <View style={styles.eventInfo}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{ev.title || 'Untitled event'}</Text>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Available</Text>
                      </View>
                    </View>
                    <View style={styles.eventDetails}>
                      {ev.date ? (
                        <View style={styles.eventDetail}>
                          <Ionicons name="calendar-outline" size={16} color={COLORS.gray} />
                          <Text style={styles.eventDetailText}>{ev.date}</Text>
                        </View>
                      ) : null}
                      {ev.time ? (
                        <View style={styles.eventDetail}>
                          <Ionicons name="time-outline" size={16} color={COLORS.gray} />
                          <Text style={styles.eventDetailText}>{ev.time}</Text>
                        </View>
                      ) : null}
                      {ev.cookingStyle ? (
                        <View style={styles.eventDetail}>
                          <Text style={styles.cookingStyleIcon}>{ev.cookingStyle.icon}</Text>
                          <Text style={styles.eventDetailText}>{ev.cookingStyle.name}</Text>
                        </View>
                      ) : null}
                      {ev.address || ev.postalCode ? (
                        <View style={styles.eventDetail}>
                          <Ionicons name="location-outline" size={16} color={COLORS.gray} />
                          <Text style={styles.eventDetailText}>{ev.address || ev.postalCode}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.eventFooter}>
                      <View>
                        <Text style={styles.eventPrice}>{priceText}</Text>
                        {spotsLeft !== null && <Text style={styles.spotsLeft}>{spotsLeft} spots left</Text>}
                      </View>
                      <TouchableOpacity
                        style={[styles.joinEventButton, disableAction && { opacity: 0.5 }, isJoined && { backgroundColor: COLORS.error }]}
                        disabled={disableAction}
                        onPress={(e) => {
                          e.stopPropagation();
                          isJoined ? handleLeave(ev) : handleJoin(ev);
                        }}
                      >
                        <Ionicons name={isJoined ? 'log-out-outline' : 'log-in-outline'} size={16} color={COLORS.white} />
                        <Text style={styles.joinEventButtonText}>{isJoined ? 'Leave' : 'Join'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal 
        visible={showFilterModal} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Cooking Style</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={COOKING_STYLES}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedCookingStyles.some(style => style.id === item.id);
                return (
                  <TouchableOpacity 
                    style={[
                      styles.cookingStyleFilterItem,
                      isSelected && styles.cookingStyleFilterItemSelected
                    ]} 
                    onPress={() => toggleCookingStyleFilter(item)}
                  >
                    <Text style={styles.cookingStyleFilterIcon}>{item.icon}</Text>
                    <Text style={[
                      styles.cookingStyleFilterName,
                      isSelected && styles.cookingStyleFilterNameSelected
                    ]}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSelectedCookingStyles([]);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyFiltersButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyFiltersText}>
                  Apply {selectedCookingStyles.length > 0 ? `(${selectedCookingStyles.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
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
  filterButton: {
    padding: SPACING.xs,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  seeAllText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  hostsScrollView: {
    height: 260, // Increased height for better content display
  },
  hostsContainer: {
    paddingHorizontal: SPACING.lg,
  },
  hostsLoadingContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  hostsLoadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  hostCard: {
    width: 200,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.light,
  },
  hostCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  hostImage: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.lightGray,
  },
  hostInfo: {
    padding: SPACING.md,
  },
  hostNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  hostName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  hostSpecialty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  hostFoodPrefs: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  hostStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  hostEventsCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  hostSelectedIndicator: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.light,
  },
  eventCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.lightGray,
  },
  eventInfo: {
    padding: SPACING.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  eventTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
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
  eventHost: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  eventDetails: {
    marginBottom: SPACING.md,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventDetailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  joinEventButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  joinEventButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  eventPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  spotsLeft: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bottomPadding: {
    height: SPACING.xl,
  },
  guestBanner: {
    backgroundColor: COLORS.primary + '10',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    ...SHADOWS.light,
  },
  guestBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  guestBannerText: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.md,
  },
  guestBannerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  guestBannerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  guestLoginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.light,
  },
  guestLoginButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  cookingStyleIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  
  // Filter display styles
  filtersDisplay: {
    marginTop: SPACING.sm,
  },
  filtersScrollContent: {
    paddingHorizontal: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  filterChipIcon: {
    fontSize: 14,
    marginRight: SPACING.xs,
  },
  filterChipText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    marginRight: SPACING.xs,
  },
  filterChipRemove: {
    padding: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    width: '90%',
    maxHeight: '70%',
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },

  // Cooking style filter item styles
  cookingStyleFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  cookingStyleFilterItemSelected: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  cookingStyleFilterIcon: {
    fontSize: 20,
    marginRight: SPACING.md,
  },
  cookingStyleFilterName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  cookingStyleFilterNameSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Modal action buttons
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  clearFiltersButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    flex: 1,
    marginRight: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  clearFiltersText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  applyFiltersButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    flex: 1,
    marginLeft: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.light,
  },
  applyFiltersText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
