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
  Modal,
  TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebaseConfig';
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import SessionStatus from '../components/SessionStatus';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const isFocused = useIsFocused();
  const [needsProfile, setNeedsProfile] = useState(false);
  const [foodPreferences, setFoodPreferences] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [personalityDone, setPersonalityDone] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [identityUrl, setIdentityUrl] = useState(null);
  const [addressUrl, setAddressUrl] = useState(null);
  const [kitchenUrl, setKitchenUrl] = useState(null);
  const [adminIdApproved, setAdminIdApproved] = useState(false);
  const [adminAddressApproved, setAdminAddressApproved] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null); // kept for future use (not rendered here)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        const completed = !!data.profileCompleted;
        setProfileCompleted(completed);
        setNeedsProfile(!(snap.exists() && completed));
        setPersonalityDone(!!data.personalityCompleted);
        setPaymentMethod(data.payment?.method || null);
        const hv = data.hostVerification || {};
        setIdentityUrl(hv.identity || null);
        setAddressUrl(hv.address || null);
        setKitchenUrl(hv.kitchen || null);
        const admin = hv.admin || {};
        setAdminIdApproved(Boolean(admin.idApproved));
        setAdminAddressApproved(Boolean(admin.addressApproved));
        setFoodPreferences(Array.isArray(data.foodPreferences) ? data.foodPreferences : []);
        setLanguages(Array.isArray(data.languages) ? data.languages : []);
      } catch (e) {
        setNeedsProfile(false);
      }
    };
    if (user?.uid && isFocused) run();
  }, [user?.uid, isFocused]);

  // Use actual user data from auth context, fallback to default data
  const userData = {
    name: user?.displayName || 'Alex Johnson',
    email: user?.email || 'alex.johnson@example.com',
    avatar: user?.photoURL || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    verified: user?.emailVerified || true,
    hostRating: 4.8,
    guestRating: 4.9,
    memberSince: 'March 2023',
    eventsHosted: 12,
    eventsJoined: 28,
  };

  const handleUpload = async (key) => {
    try {
      setUploadingKey(key);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is needed to select a document image.');
        setUploadingKey(null);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
      if (result.canceled) { setUploadingKey(null); return; }
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `verification/${user.uid}/${key}.jpg`);
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on('state_changed', () => {}, reject, resolve);
      });
      const url = await getDownloadURL(storageRef);
      const hv = { identity: identityUrl, address: addressUrl, kitchen: kitchenUrl, [key]: url };
      await setDoc(doc(db, 'users', user.uid), { hostVerification: hv, updatedAt: serverTimestamp() }, { merge: true });
      if (key === 'identity') setIdentityUrl(url);
      if (key === 'address') setAddressUrl(url);
      if (key === 'kitchen') setKitchenUrl(url);
    } catch (e) {
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('ProfileEdit');
  };

  const handleSettings = () => {
    Alert.alert('Settings', 'Settings page coming soon!');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await logout();
              // Navigation will be handled automatically by AuthContext
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteProfile = () => {
    setDeleteModalVisible(true);
  };

  const performDeleteProfile = async () => {
    try {
      setDeleting(true);
      await deleteDoc(doc(db, 'users', user.uid));
      try {
        await deleteObject(ref(storage, `users/${user.uid}/profile/avatar.jpg`));
      } catch (_) {}
      await user.delete();
      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      Alert.alert('Deleted', 'Your profile has been deleted.');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete profile');
    } finally {
      setDeleting(false);
    }
  };

  const menuItems = [
    { icon: 'pricetags-outline', title: 'My Subscription Plan', onPress: () => navigation.navigate('SubscriptionPlan') },
    { icon: 'card-outline', title: 'Payment Methods', onPress: () => navigation.navigate('PaymentMethods') },
    { icon: 'checkmark-circle-outline', title: 'Verification status', onPress: () => navigation.navigate('VerificationStatus') },
    { icon: 'color-filter-outline', title: 'Start/edit personality test', onPress: () => navigation.navigate('PersonalityTest') },
    { icon: 'notifications-outline', title: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', title: 'Safety Center', onPress: () => Alert.alert('Safety Center', 'Feature coming soon!') },
    { icon: 'help-circle-outline', title: 'Help & Support', onPress: () => Alert.alert('Help & Support', 'Feature coming soon!') },
    { icon: 'information-circle-outline', title: 'About CookTribe', onPress: () => Alert.alert('About CookTribe', 'Version 1.0.0') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Header with Settings */}
      <View style={styles.header}>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {needsProfile && (
          <TouchableOpacity style={styles.banner} onPress={() => navigation.navigate('ProfileEdit')}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.bannerText}>Complete your profile</Text>
          </TouchableOpacity>
        )}
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
              <Image source={{ uri: userData.avatar }} style={styles.avatar} />
            {userData.verified && (
              <View style={styles.verifiedBadge}>
                {(() => {
                  // Badge color logic:
                  // - Yellow (warning): default
                  // - Green (success): guest allowed => has identity uploaded & approved by admin (idApproved)
                  // - Blue (info): host allowed => has identity & address uploaded, both approved by admin
                  let badgeColor = COLORS.warning;
                  const hasIdentity = Boolean(identityUrl);
                  const hasAddress = Boolean(addressUrl);
                  const guestAllowed = hasIdentity && adminIdApproved;
                  const hostAllowed = hasIdentity && hasAddress && adminIdApproved && adminAddressApproved;
                  if (guestAllowed) badgeColor = COLORS.success;
                  if (hostAllowed) badgeColor = COLORS.info;
                  return <Ionicons name="checkmark-circle" size={24} color={badgeColor} />;
                })()}
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>{userData.name}</Text>
          <Text style={styles.userEmail}>{userData.email}</Text>
          
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.8</Text>
              <Text style={styles.statLabel}>Host Rating</Text>
              <Text style={styles.statSubLabel}>/{userData.eventsHosted} events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Guest Rating</Text>
              <Text style={styles.statSubLabel}>/{userData.eventsJoined} events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Member Since</Text>
              <Text style={styles.statLabel}>{userData.memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Session Status */}
        <SessionStatus />

        {/* Food Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Food Preferences</Text>
          <View style={styles.preferencesContainer}>
            {(foodPreferences || []).map((preference, index) => (
              <View key={index} style={styles.preferenceTag}>
                <Text style={styles.preferenceText}>{preference}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <View style={styles.languagesContainer}>
            {(languages || []).map((language, index) => (
              <View key={index} style={styles.languageTag}>
                <Text style={styles.languageText}>{language}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={20} color={COLORS.textPrimary} />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </View>


        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProfile}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.deleteText}>Delete Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalText}>
              This will permanently delete your account and profile data. This action cannot be undone.
            </Text>
            <Text style={[styles.modalText, { marginTop: SPACING.sm }]}>Type exactly: "I am sure"</Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type 'I am sure' to confirm"
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => { setDeleteModalVisible(false); setDeleteConfirmText(''); }}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  deleteConfirmText.trim().toLowerCase() === 'i am sure' && !deleting ? styles.modalConfirm : styles.modalConfirmDisabled,
                ]}
                onPress={performDeleteProfile}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'i am sure' || deleting}
              >
                <Text style={styles.modalConfirmText}>{deleting ? 'Deleting...' : 'Confirm'}</Text>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    margin: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.light,
  },
  bannerText: {
    marginLeft: SPACING.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.light,
  },
  profileSection: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.lightGray,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 2,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  editButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOWS.light,
  },
  editButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  statsSection: {
    backgroundColor: COLORS.white,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: SPACING.md,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  preferenceTag: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  preferenceText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  languagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  languageTag: {
    backgroundColor: COLORS.secondary + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  languageText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  menuSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.light,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    marginLeft: SPACING.md,
    fontWeight: '500',
  },
  logoutSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    ...SHADOWS.light,
    marginBottom: SPACING.sm,
  },
  deleteText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  createEventSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  createEventButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    ...SHADOWS.light,
  },
  createEventText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    ...SHADOWS.light,
  },
  logoutText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalInput: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.lg,
  },
  modalButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    marginLeft: SPACING.sm,
  },
  modalCancel: {
    backgroundColor: COLORS.surface,
  },
  modalCancelText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: COLORS.error,
  },
  modalConfirmDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});
