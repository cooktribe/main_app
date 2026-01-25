import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, StatusBar, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db, storage, auth } from '../firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const COUNTRIES = [
  'Germany','United States','United Kingdom','France','Spain','Italy','Canada','Australia','Brazil','India','China','Japan','South Korea','Netherlands','Sweden','Norway','Finland','Denmark','Austria','Switzerland','Poland','Czech Republic','Portugal','Greece','Turkey','Mexico','Argentina','South Africa','United Arab Emirates','Saudi Arabia'
];

const COMMON_JOBS = [
  'Software Engineer','Designer','Product Manager','Data Scientist','Teacher','Doctor','Nurse','Chef','Barista','Photographer','Writer','Journalist','Lawyer','Entrepreneur','Marketer','Accountant','Sales Manager','Project Manager','Consultant','Mechanical Engineer','Civil Engineer','Electrical Engineer','Researcher','Pharmacist','Psychologist','Architect','Content Creator','Translator','Student'
];

const FOOD_OPTIONS = [
  'Vegetarian','Vegan','Pescatarian','Halal','Kosher','Gluten-free','Dairy-free','Nut-free','Italian','Asian','Mexican','American','Mediterranean','Middle Eastern','Indian','French','Spanish','African','BBQ','Desserts'
];

const LANGUAGE_OPTIONS = [
  'English','German','French','Spanish','Italian','Portuguese','Turkish','Arabic','Persian','Hindi','Urdu','Chinese','Japanese','Korean','Russian','Polish','Dutch','Swedish','Norwegian','Finnish'
];

export default function ProfileEditScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username] = useState(user?.email || user?.uid || '');
  const [nickname, setNickname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [nationality, setNationality] = useState('');
  const [job, setJob] = useState('');
  const [avatarLocalUri, setAvatarLocalUri] = useState(null);
  const [avatarRemoteUrl, setAvatarRemoteUrl] = useState(user?.photoURL || null);
  const [foodPreferences, setFoodPreferences] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [countryQuery, setCountryQuery] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!countryQuery) return COUNTRIES;
    return COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase()));
  }, [countryQuery]);

  const filteredJobs = useMemo(() => {
    const base = COMMON_JOBS;
    const list = jobQuery
      ? base.filter(j => j.toLowerCase().includes(jobQuery.toLowerCase()))
      : base;
    return list;
  }, [jobQuery]);

  const [foodQuery, setFoodQuery] = useState('');
  const [languageQuery, setLanguageQuery] = useState('');
  const filteredFoods = useMemo(() => {
    if (!foodQuery) return FOOD_OPTIONS;
    const q = foodQuery.toLowerCase();
    return FOOD_OPTIONS.filter(f => f.toLowerCase().includes(q));
  }, [foodQuery]);
  const filteredLanguages = useMemo(() => {
    if (!languageQuery) return LANGUAGE_OPTIONS;
    const q = languageQuery.toLowerCase();
    return LANGUAGE_OPTIONS.filter(l => l.toLowerCase().includes(q));
  }, [languageQuery]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRef = doc(db, 'users', user.uid);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const p = snap.data();
          setNickname(p.nickname || '');
          setFirstName(p.firstName || '');
          setLastName(p.lastName || '');
          setGender(p.gender || '');
          setAge(p.age ? String(p.age) : '');
          setNationality(p.nationality || '');
          setJob(p.job || '');
          setAvatarRemoteUrl(p.avatarUrl || user?.photoURL || null);
          setFoodPreferences(p.foodPreferences || []);
          setLanguages(p.languages || []);
          setAddress(p.address || '');
          setPostalCode(p.postalCode || '');
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user?.uid]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library permission is needed to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarLocalUri(result.assets[0].uri);
    }
  };

  const uploadAvatarIfNeeded = async () => {
    if (!avatarLocalUri) return avatarRemoteUrl || null;
    const response = await fetch(avatarLocalUri);
    const blob = await response.blob();
    // Match Storage rules: users/{userId}/profile/
    const imageRef = ref(storage, `users/${user.uid}/profile/avatar.jpg`);
    const uploadTask = uploadBytesResumable(imageRef, blob);

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        () => {},
        (error) => reject(error),
        () => resolve()
      );
    });

    const url = await getDownloadURL(imageRef);
    setAvatarRemoteUrl(url);
    return url;
  };

  const saveProfile = async (next) => {
    try {
      setSaving(true);
      // Require avatar for email/password users
      const isPasswordUser = user?.providerData?.some(p => p.providerId === 'password');
      if (isPasswordUser && !avatarLocalUri && !avatarRemoteUrl) {
        Alert.alert('Profile photo required', 'Please add a profile photo before saving.');
        setSaving(false);
        return;
      }
      const avatarUrl = await uploadAvatarIfNeeded();
      const profileRef = doc(db, 'users', user.uid);
      await setDoc(profileRef, {
        username,
        nickname,
        firstName,
        lastName,
        gender,
        age: age ? Number(age) : null,
        nationality,
        job,
        address: address || null,
        postalCode: postalCode || null,
        foodPreferences,
        languages,
        avatarUrl: avatarUrl || null,
        updatedAt: serverTimestamp(),
        profileCompleted: true,
      }, { merge: true });

      // Also update Firebase Auth profile (best-effort)
      try {
        const displayNameUpdate = nickname || [firstName, lastName].filter(Boolean).join(' ') || undefined;
        await updateProfile(auth.currentUser, {
          displayName: displayNameUpdate,
          photoURL: avatarUrl || undefined,
        });
      } catch (_) {}

      if (next === 'personality') {
        navigation.replace('PersonalityTest');
      } else {
        Alert.alert('Saved', 'Profile updated successfully');
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.replace('MainTabs');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput value={username} editable={false} style={[styles.input, styles.inputDisabled]} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nickname</Text>
          <TextInput value={nickname} onChangeText={setNickname} style={styles.input} placeholder="Enter nickname" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>First name</Text>
          <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} placeholder="Enter first name" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Last name</Text>
          <TextInput value={lastName} onChangeText={setLastName} style={styles.input} placeholder="Enter last name" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipsRow}>
            {GENDER_OPTIONS.map(opt => (
              <TouchableOpacity key={opt} style={[styles.chip, gender === opt && styles.chipSelected]} onPress={() => setGender(opt)}>
                <Text style={[styles.chipText, gender === opt && styles.chipTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput value={age} onChangeText={setAge} style={styles.input} keyboardType="number-pad" placeholder="Enter age" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nationality</Text>
          <TouchableOpacity onPress={() => setCountryModalVisible(true)}>
            <View style={styles.input}> 
              <Text style={{ color: nationality ? COLORS.textPrimary : COLORS.gray }}>
                {nationality || 'Select nationality'}
              </Text>
            </View>
          </TouchableOpacity>
          <Modal visible={countryModalVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select nationality</Text>
                <TouchableOpacity onPress={() => setCountryModalVisible(false)}><Text style={styles.modalClose}>Close</Text></TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: SPACING.lg }}>
                <TextInput value={countryQuery} onChangeText={setCountryQuery} style={styles.input} placeholder="Search country" />
              </View>
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setNationality(item); setCountryQuery(item); setCountryModalVisible(false); }}>
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </Modal>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Job</Text>
          <TextInput value={job} onChangeText={setJob} style={styles.input} placeholder="Enter your job" />
          <TouchableOpacity onPress={() => setJobModalVisible(true)}>
            <View style={styles.input}> 
              <Text style={{ color: COLORS.textSecondary }}>Browse common jobs</Text>
            </View>
          </TouchableOpacity>
          <Modal visible={jobModalVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select job</Text>
                <TouchableOpacity onPress={() => setJobModalVisible(false)}><Text style={styles.modalClose}>Close</Text></TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: SPACING.lg }}>
                <TextInput value={jobQuery} onChangeText={setJobQuery} style={styles.input} placeholder="Search jobs" />
              </View>
              <FlatList
                data={filteredJobs}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setJob(item); setJobQuery(item); setJobModalVisible(false); }}>
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </Modal>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            style={styles.input}
            placeholder="Enter address (optional)"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Postal code</Text>
          <TextInput
            value={postalCode}
            onChangeText={setPostalCode}
            style={styles.input}
            placeholder="Enter postal code (optional)"
          />
        </View>

        {/* Food Preferences selector (modal like job) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Food preferences</Text>
          <TouchableOpacity onPress={() => setFoodModalVisible(true)}>
            <View style={styles.input}>
              <Text style={{ color: (foodPreferences?.length ?? 0) > 0 ? COLORS.textPrimary : COLORS.gray }}>
                {(foodPreferences?.length ?? 0) > 0 ? foodPreferences.join(', ') : 'Select food preferences'}
              </Text>
            </View>
          </TouchableOpacity>
          <Modal visible={foodModalVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setFoodPreferences([])} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select food preferences</Text>
                <TouchableOpacity onPress={() => setFoodModalVisible(false)} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: SPACING.lg }}>
                <TextInput value={foodQuery} onChangeText={setFoodQuery} style={styles.input} placeholder="Search foods" />
              </View>
              <FlatList
                data={filteredFoods}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const selected = foodPreferences.includes(item);
                  return (
                    <TouchableOpacity style={styles.optionItem} onPress={() => {
                      setFoodPreferences(prev => selected ? prev.filter(x => x !== item) : [...prev, item]);
                    }}>
                      <Text style={[styles.optionText, selected && { color: COLORS.primary, fontWeight: '700' }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </SafeAreaView>
          </Modal>
        </View>

        {/* Languages selector (modal like job) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Languages</Text>
          <TouchableOpacity onPress={() => setLanguageModalVisible(true)}>
            <View style={styles.input}>
              <Text style={{ color: (languages?.length ?? 0) > 0 ? COLORS.textPrimary : COLORS.gray }}>
                {(languages?.length ?? 0) > 0 ? languages.join(', ') : 'Select languages'}
              </Text>
            </View>
          </TouchableOpacity>
          <Modal visible={languageModalVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setLanguages([])} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select languages</Text>
                <TouchableOpacity onPress={() => setLanguageModalVisible(false)} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: SPACING.lg }}>
                <TextInput value={languageQuery} onChangeText={setLanguageQuery} style={styles.input} placeholder="Search languages" />
              </View>
              <FlatList
                data={filteredLanguages}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const selected = languages.includes(item);
                  return (
                    <TouchableOpacity style={styles.optionItem} onPress={() => {
                      setLanguages(prev => selected ? prev.filter(x => x !== item) : [...prev, item]);
                    }}>
                      <Text style={[styles.optionText, selected && { color: COLORS.primary, fontWeight: '700' }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </SafeAreaView>
          </Modal>
        </View>

        {user?.providerData?.some(p => p.providerId === 'password') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Profile photo</Text>
            <View style={styles.avatarRow}>
              <Image source={{ uri: avatarLocalUri || avatarRemoteUrl || 'https://placehold.co/100x100' }} style={styles.avatar} />
              <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
                <Ionicons name="image" size={18} color={COLORS.white} />
                <Text style={styles.pickButtonText}>Choose image</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => saveProfile('save')} disabled={saving}>
            <Text style={styles.secondaryButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => saveProfile('personality')} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Please wait...' : 'Start/edit personality test'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary, padding: SPACING.lg },
  fieldGroup: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, ...SHADOWS.light },
  inputDisabled: { backgroundColor: COLORS.lightGray },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chipsWrapCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, ...SHADOWS.light },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.round, backgroundColor: COLORS.surface, marginRight: SPACING.sm, marginBottom: SPACING.sm },
  chipSelected: { backgroundColor: COLORS.primary + '20' },
  chipText: { color: COLORS.textPrimary, fontWeight: '500' },
  chipTextSelected: { color: COLORS.primary, fontWeight: '700' },
  pill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: 999, backgroundColor: COLORS.surface, marginRight: SPACING.sm, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.lightGray },
  pillSelected: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '60' },
  pillText: { color: COLORS.textPrimary, fontWeight: '600' },
  pillTextSelected: { color: COLORS.primary },
  optionsList: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, marginTop: SPACING.xs, ...SHADOWS.light },
  optionItem: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  optionText: { color: COLORS.textPrimary },
  avatarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.lightGray },
  pickButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, flexDirection: 'row', alignItems: 'center' },
  pickButtonText: { color: COLORS.white, fontWeight: '600', marginLeft: SPACING.xs },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: SPACING.lg, marginTop: SPACING.lg },
  primaryButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, flex: 1, marginLeft: SPACING.sm, alignItems: 'center' },
  primaryButtonText: { color: COLORS.white, fontWeight: '700' },
  secondaryButton: { backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, flex: 1, marginRight: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray },
  secondaryButtonText: { color: COLORS.textPrimary, fontWeight: '700' },
  modalContainer: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    ...SHADOWS.light
  },
  modalTitle: { 
    fontSize: FONT_SIZES.lg, 
    fontWeight: '700', 
    color: COLORS.textPrimary 
  },
  modalClose: { 
    fontSize: FONT_SIZES.md, 
    fontWeight: '600', 
    color: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '30'
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 80,
    alignItems: 'center',
    ...SHADOWS.light
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700'
  },
  clearButton: {
    backgroundColor: COLORS.error + '10',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    minWidth: 80,
    alignItems: 'center'
  },
  clearButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600'
  },
});

