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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebaseConfig';
import { collection, onSnapshot, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { subscribeJoinedEventIds, leaveEvent, getParticipationDeadlineHours, isPastParticipationDeadline } from '../services/participationService';
import { deleteObject, ref } from 'firebase/storage';

export default function MyEventsScreen({ navigation }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [joinedUpcoming, setJoinedUpcoming] = useState([]);
  const [myCreatedUpcoming, setMyCreatedUpcoming] = useState([]);
  const [identityUrl, setIdentityUrl] = useState(null);
  const [addressUrl, setAddressUrl] = useState(null);
  const [adminIdApproved, setAdminIdApproved] = useState(false);
  const [adminAddressApproved, setAdminAddressApproved] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState(null);
  const [deadlineHours, setDeadlineHours] = useState(48);

  const pastEvents = [
    {
      id: 3,
      title: 'Sushi Making Experience',
      host: 'Kenji Tanaka',
      date: 'May 28, 2025',
      time: '7:00 PM',
      location: 'Mitte, Berlin',
      image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=200&fit=crop',
      status: 'completed',
      rating: 4.8,
      isHost: false,
    },
  ];

  useEffect(() => {
    if (!user?.uid) return;

    const userUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const hv = snap.exists() ? (snap.data().hostVerification || {}) : {};
      const admin = hv.admin || {};
      setIdentityUrl(hv.identity || null);
      setAddressUrl(hv.address || null);
      setAdminIdApproved(Boolean(admin.idApproved));
      setAdminAddressApproved(Boolean(admin.addressApproved));
    });

    const createdQ = query(collection(db, 'events'), where('createdBy', '==', user.uid));
    const unsubCreated = onSnapshot(createdQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = list.filter(e => ['pending', 'confirmed'].includes(e.status));
      filtered.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      setMyCreatedUpcoming(filtered);
    });

    // Joined events: listen to ids then fetch details once
    (async () => { setDeadlineHours(await getParticipationDeadlineHours(db)); })();
    let unsubJoined = subscribeJoinedEventIds(db, user.uid, async (ids) => {
      try {
        const idArray = Array.from(ids);
        if (idArray.length === 0) { setJoinedUpcoming([]); return; }
        // Firestore does not support 'in' with 30+ easily; fetch each id
        const promises = idArray.map(id => getDoc(doc(db, 'events', id)));
        const docs = await Promise.all(promises);
        const list = docs.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
        const filtered = list.filter(e => ['approved', 'confirmed', 'pending'].includes(e.status));
        filtered.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        setJoinedUpcoming(filtered);
      } catch (_) {
        setJoinedUpcoming([]);
      }
    });

    // Load settings for currency (subscription currency)
    (async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          const s = settingsSnap.data() || {};
          // Support either currencyCode (e.g., 'EUR') or currency symbol
          if (s.currencyCode) setCurrencyCode(String(s.currencyCode));
          if (s.currencySymbol) setCurrencySymbol(String(s.currencySymbol));
          if (!s.currencyCode && s.currency) setCurrencyCode(String(s.currency));
        }
      } catch (_) {
        // ignore
      }
    })();

    return () => { userUnsub(); unsubCreated(); unsubJoined && unsubJoined(); };
  }, [user?.uid]);
  const formatCost = (amount) => {
    if (amount == null) return null;
    try {
      if (currencyCode) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
      }
    } catch (_) {}
    const sym = currencySymbol || '';
    return sym ? `${sym} ${amount}` : `${amount}`;
  };
  const canCreateEvent = Boolean(identityUrl && addressUrl && adminIdApproved && adminAddressApproved);

  const handleJoinToEvent = () => {
    if (canCreateEvent) {
      navigation.navigate('EventCreate');
    } else {
      navigation.navigate('VerificationStatus');
    }
  };

  const handleLeaveEvent = async (event) => {
    try {
      await leaveEvent(db, user.uid, event.id);
    } catch (e) {
      Alert.alert('Cannot leave', e?.message || 'Failed to leave');
    }
  };

  const handleManage = (event) => {
    Alert.alert(
      'Manage Event',
      'What would you like to do?',
      [
        { text: 'Edit', onPress: () => navigation.navigate('EventCreate', { eventId: event.id }) },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(event) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const confirmDelete = (event) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(event) },
      ]
    );
  };

  const deleteEvent = async (event) => {
    try {
      await deleteDoc(doc(db, 'events', event.id));
      if (event.imageUrl) {
        try { await deleteObject(ref(storage, `events/${event.id}/images/cover.jpg`)); } catch (_) {}
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete event', e);
    }
  };

  const tabs = ['Upcoming', 'My Events', 'Past'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'completed':
        return COLORS.primary;
      default:
        return COLORS.gray;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const renderEvent = (event) => (
    <TouchableOpacity key={event.id} style={styles.eventCard}>
      <Image source={{ uri: event.imageUrl || 'https://placehold.co/300x200?text=No+Image' }} style={styles.eventImage} />
      
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
            <Text style={styles.statusText}>{getStatusText(event.status)}</Text>
          </View>
        </View>
        {activeTab === 'My Events' ? (
          <Text style={styles.eventHost}>You're hosting</Text>
        ) : null}
        
        <View style={styles.eventDetails}>
          <View style={styles.eventDetail}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.gray} />
            <Text style={styles.eventDetailText}>{event.date}</Text>
          </View>
          <View style={styles.eventDetail}>
            <Ionicons name="time-outline" size={16} color={COLORS.gray} />
            <Text style={styles.eventDetailText}>{event.time}</Text>
          </View>
          {event.cookingStyle && (
            <View style={styles.eventDetail}>
              <Text style={styles.cookingStyleIcon}>{event.cookingStyle.icon}</Text>
              <Text style={styles.eventDetailText}>{event.cookingStyle.name}</Text>
            </View>
          )}
          <View style={styles.eventDetail}>
            <Ionicons name="location-outline" size={16} color={COLORS.gray} />
            <Text style={styles.eventDetailText}>{event.address || event.location || '-'}</Text>
          </View>
          {typeof event.costPerPerson === 'number' && event.costPerPerson > 0 && (
            <View style={styles.eventDetail}>
              <Ionicons name="cash-outline" size={16} color={COLORS.gray} />
              <Text style={styles.eventDetailText}>{`${formatCost(event.costPerPerson)} per person`}</Text>
            </View>
          )}
        </View>
        
        {event.status === 'confirmed' && (
          <View style={styles.participantsInfo}>
            <Ionicons name="people-outline" size={16} color={COLORS.gray} />
            <Text style={styles.participantsText}>{(event.participantsCount || 0)}/{event.maxGuests || '-'} guests confirmed</Text>
          </View>
        )}
        
        {event.status === 'completed' && event.rating && (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>Rated {event.rating}/5</Text>
          </View>
        )}
        
        {activeTab === 'My Events' ? (
          <View style={styles.manageRowRight}>
            <TouchableOpacity onPress={() => handleManage(event)} style={styles.manageLinkRight}>
              <Text style={styles.manageText}>Manage Event</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.manageRowRight}>
            <TouchableOpacity
              onPress={() => handleLeaveEvent(event)}
              style={[styles.leaveBtn, isPastParticipationDeadline(event.startAt, deadlineHours) && { opacity: 0.5 }]}
              disabled={isPastParticipationDeadline(event.startAt, deadlineHours)}
            >
              <Ionicons name="log-out-outline" size={16} color={COLORS.white} />
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const currentEvents = activeTab === 'Upcoming' ? joinedUpcoming : (activeTab === 'My Events' ? myCreatedUpcoming : pastEvents);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['Upcoming', 'My Events', 'Past'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
         {currentEvents.length > 0 ? (
           currentEvents.map(renderEvent)
         ) : (
           <View style={styles.emptyState}>
            <Ionicons 
              name={activeTab === 'Upcoming' ? 'calendar-outline' : 'time-outline'} 
              size={64} 
              color={COLORS.lightGray} 
            />
            <Text style={styles.emptyStateTitle}>
              No {activeTab.toLowerCase()} events
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {activeTab === 'Upcoming' 
                ? 'Events you joined will appear here.'
                : (activeTab === 'My Events' ? 'Events you host will appear here.' : 'Your completed cooking experiences will appear here.')}
            </Text>
             {activeTab === 'My Events' ? (
               <TouchableOpacity
                style={styles.discoverButton}
                onPress={handleJoinToEvent}
               >
                <Text style={styles.discoverButtonText}>Create Event</Text>
               </TouchableOpacity>
             ) : null}
          </View>
        )}
      </ScrollView>

       {/* Floating Action Button for Creating Events */}
      {activeTab === 'My Events' && currentEvents.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleJoinToEvent}
        >
          <Ionicons name={'create-outline'} size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.lightGray,
  },
  eventContent: {
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
    marginRight: SPACING.sm,
  },
  statusBadge: {
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
    fontWeight: '500',
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
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  participantsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  manageRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  manageLinkRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  leaveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flex: 0.48,
    justifyContent: 'center',
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  primaryActionButtonText: {
    color: COLORS.white,
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
    marginBottom: SPACING.lg,
  },
  discoverButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  discoverButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.heavy,
  },
  cookingStyleIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
});
