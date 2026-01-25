import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, StatusBar, Alert, ActivityIndicator, Platform, Modal, FlatList, KeyboardAvoidingView, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebaseConfig';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import RenderHTML from 'react-native-render-html';
import { marked } from 'marked';

// Default event icons
const DEFAULT_EVENT_ICONS = [
  { id: 1, icon: 'restaurant', url: 'https://img.icons8.com/color/96/restaurant.png', name: 'Restaurant' },
  { id: 2, icon: 'pizza', url: 'https://img.icons8.com/color/96/pizza.png', name: 'Pizza' },
  { id: 3, icon: 'hamburger', url: 'https://img.icons8.com/color/96/hamburger.png', name: 'Burger' },
  { id: 4, icon: 'wine', url: 'https://img.icons8.com/color/96/wine-glass.png', name: 'Wine' },
  { id: 5, icon: 'coffee', url: 'https://img.icons8.com/color/96/coffee.png', name: 'Coffee' },
  { id: 6, icon: 'cake', url: 'https://img.icons8.com/color/96/birthday-cake.png', name: 'Cake' },
  { id: 7, icon: 'barbecue', url: 'https://img.icons8.com/color/96/barbecue.png', name: 'BBQ' },
  { id: 8, icon: 'salad', url: 'https://img.icons8.com/color/96/salad.png', name: 'Salad' }
];

// Cooking styles available for events
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

export default function EventCreateScreen({ route, navigation }) {
  const { user } = useAuth();
  const editingEventId = route?.params?.eventId || null;
  const contentWidth = Dimensions.get('window').width;

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Event fields
  const [eventType, setEventType] = useState('party'); // 'party' or 'course'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [imageLocalUri, setImageLocalUri] = useState(null);
  const [imageRemoteUrl, setImageRemoteUrl] = useState(null);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [maxGuests, setMaxGuests] = useState('');
  const [costPerPerson, setCostPerPerson] = useState('');
  const [cookingStyle, setCookingStyle] = useState(null);

  // User profile data (readonly)
  const [userAddress, setUserAddress] = useState('');
  const [userPostalCode, setUserPostalCode] = useState('');

  // Recipe data
  const [appetizer, setAppetizer] = useState({ name: '', ingredients: '', instructions: '' });
  const [mainCourse, setMainCourse] = useState({ name: '', ingredients: '', instructions: '' });
  const [dessert, setDessert] = useState({ name: '', ingredients: '', instructions: '' });
  const [existingRecipes, setExistingRecipes] = useState([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [currentRecipeType, setCurrentRecipeType] = useState('');
  const [activeRecipeTab, setActiveRecipeTab] = useState('appetizer');
  // Manual editor modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualType, setManualType] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualInstructions, setManualInstructions] = useState('');
  const [ingSel, setIngSel] = useState({ start: 0, end: 0 });
  const [insSel, setInsSel] = useState({ start: 0, end: 0 });

  // Recipe search state
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  // Date/Time pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateObj, setDateObj] = useState(null);
  const [timeObj, setTimeObj] = useState(null);
  
  // Original date/time for editing validation
  const [originalDate, setOriginalDate] = useState('');
  const [originalTime, setOriginalTime] = useState('');

  // Settings
  const [minParticipants, setMinParticipants] = useState(4);

  // Icon selection modal
  const [showIconModal, setShowIconModal] = useState(false);
  
  // Cooking style selection modal
  const [showCookingStyleModal, setShowCookingStyleModal] = useState(false);

  // Load user profile and settings on mount
  useEffect(() => {
    loadUserProfile();
    loadSettings();
    loadExistingRecipes();
  }, [user?.uid]);

  // Load event data if editing
  useEffect(() => {
    if (editingEventId) {
      loadEventForEdit();
    }
  }, [editingEventId]);

  const loadUserProfile = async () => {
    try {
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setUserAddress(data.address || '');
        setUserPostalCode(data.postalCode || '');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        const parsed = Number(data.minParticipants);
        setMinParticipants(!Number.isNaN(parsed) && parsed > 0 ? parsed : 4);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadExistingRecipes = async () => {
    try {
      // Read directly from admin/content/recipes (public read via rules)
      const adminSnap = await getDocs(collection(db, 'admin', 'content', 'recipes'));
      const recipes = adminSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExistingRecipes(recipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setExistingRecipes([]);
    }
  };

  const toHtml = (text) => {
    if (!text) return '';
    const looksLikeHtml = /<\w+[^>]*>/i.test(text);
    try {
      return looksLikeHtml ? text : marked.parse(String(text));
    } catch (_) {
      return String(text);
    }
  };

  const loadEventForEdit = async () => {
    setLoading(true);
    try {
      const eventRef = doc(db, 'events', editingEventId);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const data = eventSnap.data();
        setEventType(data.eventType || 'party');
        setTitle(data.title || '');
        setDescription(data.description || '');
        setDate(data.date || '');
        setTime(data.time || '');
        setOriginalDate(data.date || '');
        setOriginalTime(data.time || '');
        setMaxGuests(String(data.maxGuests || ''));
        setCostPerPerson(String(data.costPerPerson || ''));
        setImageRemoteUrl(data.imageUrl || null);
        setSelectedIcon(data.iconUrl || null);
        setCookingStyle(data.cookingStyle || null);

        // Parse to date/time objects for pickers
        try {
          if (data.date) {
            const parts = String(data.date).split('-');
            if (parts.length === 3) {
              const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              if (!isNaN(d.getTime())) setDateObj(d);
            }
          }
          if (data.time) {
            const tparts = String(data.time).split(':');
            if (tparts.length >= 2) {
              const now = new Date();
              const tt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(tparts[0]), Number(tparts[1]));
              if (!isNaN(tt.getTime())) setTimeObj(tt);
            }
          }
        } catch (_) {}

        if (data.recipes) {
          setAppetizer(data.recipes.appetizer || { name: '', ingredients: '', instructions: '' });
          setMainCourse(data.recipes.mainCourse || { name: '', ingredients: '', instructions: '' });
          setDessert(data.recipes.dessert || { name: '', ingredients: '', instructions: '' });
        }
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library permission is needed to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageLocalUri(result.assets[0].uri);
      setSelectedIcon(null);
    }
  };

  const selectIcon = (icon) => {
    setSelectedIcon(icon.url);
    setImageLocalUri(null);
    setShowIconModal(false);
  };

  const selectCookingStyle = (style) => {
    setCookingStyle(style);
    setShowCookingStyleModal(false);
  };

  const uploadCoverIfNeeded = async (eventId) => {
    if (!imageLocalUri) return imageRemoteUrl || selectedIcon || null;
    const response = await fetch(imageLocalUri);
    const blob = await response.blob();

    const tryUpload = async (storagePath) => {
      const storageRefPath = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRefPath, blob, { contentType: blob.type || 'image/jpeg' });
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = snapshot.totalBytes ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
            setUploadProgress(Math.round(pct));
          },
          (err) => reject(err),
          () => resolve()
        );
      });
      return getDownloadURL(storageRefPath);
    };

    try {
      setUploading(true);
      setUploadProgress(0);
      const primaryPath = `events/${eventId}/images/cover.jpg`;
      const url = await tryUpload(primaryPath);
      setImageRemoteUrl(url);
      return url;
    } catch (primaryErr) {
      console.warn('Primary image upload failed, will try fallback path', primaryErr?.code || primaryErr?.message);
      try {
        const fallbackPath = `verification/${user.uid}/events/${eventId}.jpg`;
        const url2 = await tryUpload(fallbackPath);
        setImageRemoteUrl(url2);
        return url2;
      } catch (fallbackErr) {
        console.warn('Fallback image upload also failed. Proceed without image.', fallbackErr?.code || fallbackErr?.message);
        return imageRemoteUrl || selectedIcon || null;
      }
    } finally {
      setUploading(false);
    }
  };

  const getMinDate = () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 10);
    return minDate;
  };

  const isDateTimeChanged = () => {
    // For new events, always apply validation
    if (!editingEventId) return true;
    
    // For editing, check if date or time has actually changed
    return date.trim() !== originalDate.trim() || time.trim() !== originalTime.trim();
  };

  const validate = () => {
    if (!title.trim()) return 'Enter an event title';
    if (!description.trim()) return 'Enter an event description';
    if (!dateObj) return 'Select an event date';
    if (!timeObj) return 'Select an event time';
    
    // Only apply 10-day rule if date/time has changed or creating new event
    if (isDateTimeChanged()) {
      const minDate = getMinDate();
      if (dateObj < minDate) return 'Event date must be at least 10 days from today';
    }
    
    const guests = Number(maxGuests);
    if (!maxGuests || Number.isNaN(guests) || guests < minParticipants) return `Participants must be at least ${minParticipants}`;
    if (!cookingStyle) return 'Select a cooking style';
    if (!appetizer.name && !mainCourse.name && !dessert.name) return 'Add at least one recipe (appetizer, main, or dessert)';
    return null;
  };

  const saveEvent = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Invalid data', error);
      return;
    }
    try {
      setSaving(true);
      const eventData = {
        eventType: eventType,
        title: title.trim(),
        description: description.trim(),
        date: date.trim(),
        time: time.trim(),
        address: userAddress,
        postalCode: userPostalCode,
        maxGuests: Number(maxGuests),
        minGuests: minParticipants,
        costPerPerson: costPerPerson ? Number(costPerPerson) : 0,
        cookingStyle: cookingStyle,
        recipes: {
          appetizer: appetizer.name ? appetizer : null,
          mainCourse: mainCourse.name ? mainCourse : null,
          dessert: dessert.name ? dessert : null,
        },
        status: 'pending',
        createdBy: user.uid,
        participantsCount: 0,
        updatedAt: serverTimestamp(),
        // compute startAt timestamp for rules and client logic
        startAt: (() => {
          try {
            if (date && time) {
              const [yyyy, mm, dd] = String(date).split('-').map(n => Number(n));
              const [hh, mi] = String(time).split(':').map(n => Number(n));
              const dt = new Date(yyyy, (mm || 1) - 1, dd || 1, hh || 0, mi || 0, 0, 0);
              if (!isNaN(dt.getTime())) return dt;
            }
          } catch (_) {}
          return null;
        })(),
      };

      let eventId = editingEventId;
      if (!eventId) {
        eventData.createdAt = serverTimestamp();
        const refDoc = await addDoc(collection(db, 'events'), eventData);
        eventId = refDoc.id;
      } else {
        await updateDoc(doc(db, 'events', eventId), eventData);
      }

      const imageUrl = await uploadCoverIfNeeded(eventId);
      if (imageUrl) {
        await updateDoc(doc(db, 'events', eventId), {
          imageUrl: imageUrl,
          iconUrl: selectedIcon,
        });
      }

      Alert.alert('Success', editingEventId ? 'Event updated successfully' : 'Event created successfully');
      navigation.navigate('MainTabs', { screen: 'MyEvents' });
    } catch (e) {
      console.error('Failed to save event', e);
      Alert.alert('Error', e?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const selectExistingRecipe = (recipe) => {
    const recipeData = {
      name: recipe.dishName,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions || '',
      _fromExisting: true,
    };
    if (currentRecipeType === 'appetizer') setAppetizer(recipeData);
    else if (currentRecipeType === 'main') setMainCourse(recipeData);
    else if (currentRecipeType === 'dessert') setDessert(recipeData);
    setShowRecipeModal(false);
  };

  const openRecipeSelector = (type) => {
    setCurrentRecipeType(type);
    setRecipeSearchQuery(''); // Reset search when opening modal
    setShowRecipeModal(true);
  };

  // Filter recipes based on search query
  const filteredRecipes = existingRecipes.filter(recipe => {
    if (!recipeSearchQuery.trim()) return true;
    const query = recipeSearchQuery.toLowerCase();
    return (
      recipe.dishName?.toLowerCase().includes(query) ||
      recipe.ingredients?.toLowerCase().includes(query) ||
      recipe.instructions?.toLowerCase().includes(query)
    );
  });

  const openManualEditor = (type) => {
    setManualType(type);
    if (type === 'appetizer') {
      setManualName(appetizer.name || '');
      setManualIngredients(appetizer.ingredients || '');
      setManualInstructions(appetizer.instructions || '');
    } else if (type === 'main') {
      setManualName(mainCourse.name || '');
      setManualIngredients(mainCourse.ingredients || '');
      setManualInstructions(mainCourse.instructions || '');
    } else if (type === 'dessert') {
      setManualName(dessert.name || '');
      setManualIngredients(dessert.ingredients || '');
      setManualInstructions(dessert.instructions || '');
    }
    setShowManualModal(true);
  };

  const saveManualEditor = () => {
    const next = { name: manualName, ingredients: manualIngredients, instructions: manualInstructions };
    if (manualType === 'appetizer') setAppetizer(next);
    else if (manualType === 'main') setMainCourse(next);
    else if (manualType === 'dessert') setDessert(next);
    setShowManualModal(false);
  };

  const wrapSelection = (value, selection, prefix, suffix = prefix) => {
    if (!selection) return value + prefix + suffix;
    const start = Math.max(0, selection.start || 0);
    const end = Math.max(start, selection.end || start);
    const before = value.substring(0, start);
    const selected = value.substring(start, end);
    const after = value.substring(end);
    return before + prefix + selected + suffix + after;
  };

  const insertSnippet = (value, selection, snippet) => {
    const pos = Math.max(0, selection?.start || 0);
    return value.slice(0, pos) + snippet + value.slice(pos);
  };

  const Toolbar = ({ target, onBold, onItalic, onH3, onList, onLink }) => (
    <View style={styles.toolbarRow}>
      <TouchableOpacity onPress={onBold} style={styles.toolbarBtn}><Text style={styles.toolbarBtnText}>B</Text></TouchableOpacity>
      <TouchableOpacity onPress={onItalic} style={styles.toolbarBtn}><Text style={styles.toolbarBtnText}>I</Text></TouchableOpacity>
      <TouchableOpacity onPress={onH3} style={styles.toolbarBtn}><Text style={styles.toolbarBtnText}>H3</Text></TouchableOpacity>
      <TouchableOpacity onPress={onList} style={styles.toolbarBtn}><Text style={styles.toolbarBtnText}>-</Text></TouchableOpacity>
      <TouchableOpacity onPress={onLink} style={styles.toolbarBtn}><Text style={styles.toolbarBtnText}>Link</Text></TouchableOpacity>
    </View>
  );

  const RecipeInput = ({ type, recipe, setRecipe, label }) => (
    <View style={styles.recipeSection}>
      <Text style={styles.recipeLabel}>{label}</Text>

      <View style={styles.actionsRowInline}>
        <TouchableOpacity style={styles.selectRecipeButton} onPress={() => openRecipeSelector(type)}>
          <Ionicons name="book" size={18} color={COLORS.primary} />
          <Text style={styles.selectRecipeText}>Select existing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editManualButton} onPress={() => openManualEditor(type)}>
          <Ionicons name="create-outline" size={18} color={COLORS.white} />
          <Text style={styles.editManualText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {(recipe.name || recipe.ingredients || recipe.instructions) ? (
        <View style={{ marginTop: SPACING.sm }}>
          {recipe.name ? (
            <Text style={{ fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.xs }}>{recipe.name}</Text>
          ) : null}
          <RenderHTML
            contentWidth={contentWidth - SPACING.lg * 2}
            source={{ html: toHtml([recipe.ingredients, recipe.instructions].filter(Boolean).join('\n\n')) }}
          />
        </View>
      ) : (
        <Text style={{ color: COLORS.textSecondary, marginTop: SPACING.sm }}>No content yet</Text>
      )}
    </View>
  );

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" keyboardDismissMode="none" removeClippedSubviews={false}>
        <Text style={styles.title}>{editingEventId ? 'Edit Event' : 'Create Event'}</Text>

        {/* Event Type */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Event type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeButton, eventType === 'party' && styles.typeButtonActive]} onPress={() => setEventType('party')}>
              <Ionicons name="people" size={20} color={eventType === 'party' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.typeText, eventType === 'party' && styles.typeTextActive]}>Party</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeButton, eventType === 'course' && styles.typeButtonActive]} onPress={() => setEventType('course')}>
              <Ionicons name="school" size={20} color={eventType === 'course' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.typeText, eventType === 'course' && styles.typeTextActive]}>Course</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Enter event title" blurOnSubmit={false} />
        </View>

        {/* Image/Icon */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Event image</Text>
          <View style={styles.imageRow}>
            <Image source={{ uri: imageLocalUri || imageRemoteUrl || selectedIcon || DEFAULT_EVENT_ICONS[0].url }} style={styles.coverImage} />
            <View style={styles.imageButtons}>
              <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
                <Ionicons name="image" size={18} color={COLORS.white} />
                <Text style={styles.pickButtonText}>Choose image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickButton, styles.iconButton]} onPress={() => setShowIconModal(true)}>
                <Ionicons name="apps" size={18} color={COLORS.white} />
                <Text style={styles.pickButtonText}>Choose icon</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.textArea]} placeholder="Enter event description" multiline blurOnSubmit={false} />
        </View>

        {/* Date & Time */}
        <View style={[styles.fieldGroup, styles.row]}>
          <View style={[styles.col, { marginRight: SPACING.sm }]}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <View style={styles.input}>
                <Text style={{ color: date ? COLORS.textPrimary : COLORS.gray }}>{date || 'Select date'}</Text>
              </View>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateObj || getMinDate()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={getMinDate()}
                onChange={(event, selected) => {
                  setShowDatePicker(false);
                  if (selected) {
                    setDateObj(selected);
                    const yyyy = selected.getFullYear();
                    const mm = String(selected.getMonth() + 1).padStart(2, '0');
                    const dd = String(selected.getDate()).padStart(2, '0');
                    setDate(`${yyyy}-${mm}-${dd}`);
                  }
                }}
              />
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Time *</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)}>
              <View style={styles.input}>
                <Text style={{ color: time ? COLORS.textPrimary : COLORS.gray }}>{time || 'Select time'}</Text>
              </View>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={timeObj || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selected) => {
                  setShowTimePicker(false);
                  if (selected) {
                    setTimeObj(selected);
                    const hh = String(selected.getHours()).padStart(2, '0');
                    const mi = String(selected.getMinutes()).padStart(2, '0');
                    setTime(`${hh}:${mi}`);
                  }
                }}
              />
            )}
          </View>
        </View>

        {/* Address (Read-only) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address (from your profile)</Text>
          <View style={[styles.input, styles.readOnlyInput]}>
            <Text style={styles.readOnlyText}>{userAddress || 'No address saved in your profile'}</Text>
          </View>
        </View>

        {/* Postal Code (Read-only) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Postal code (from your profile)</Text>
          <View style={[styles.input, styles.readOnlyInput]}>
            <Text style={styles.readOnlyText}>{userPostalCode || 'No postal code saved in your profile'}</Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Participants * (min: {minParticipants})</Text>
          <TextInput value={maxGuests} onChangeText={setMaxGuests} keyboardType="number-pad" style={styles.input} placeholder={`e.g., ${minParticipants + 2}`} blurOnSubmit={false} />
        </View>

        {/* Cost per person */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Estimated cost per person ({eventType === 'party' ? 'Party contribution' : 'Course enrollment'})</Text>
          <TextInput value={costPerPerson} onChangeText={setCostPerPerson} keyboardType="number-pad" style={styles.input} placeholder="e.g., 25" blurOnSubmit={false} />
        </View>

        {/* Cooking Style */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Cooking style *</Text>
          <TouchableOpacity 
            style={styles.cookingStyleSelector}
            onPress={() => setShowCookingStyleModal(true)}
          >
            {cookingStyle ? (
              <View style={styles.selectedCookingStyle}>
                <Text style={styles.cookingStyleIcon}>{cookingStyle.icon}</Text>
                <Text style={styles.cookingStyleName}>{cookingStyle.name}</Text>
              </View>
            ) : (
              <Text style={styles.cookingStylePlaceholder}>Select cooking style</Text>
            )}
            <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Recipes Section */}
        <View style={styles.recipesContainer}>
          <Text style={styles.sectionTitle}>Recipes *</Text>
          <Text style={styles.sectionSubtitle}>Provide at least one (pick from existing or create your own)</Text>

          <View style={styles.recipeTabsRow}>
            <TouchableOpacity
              style={[styles.recipeTab, activeRecipeTab === 'appetizer' && styles.recipeTabActive]}
              onPress={() => setActiveRecipeTab('appetizer')}
            >
              <Text style={[styles.recipeTabText, activeRecipeTab === 'appetizer' && styles.recipeTabTextActive]}>Appetizer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recipeTab, activeRecipeTab === 'main' && styles.recipeTabActive]}
              onPress={() => setActiveRecipeTab('main')}
            >
              <Text style={[styles.recipeTabText, activeRecipeTab === 'main' && styles.recipeTabTextActive]}>Main course</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recipeTab, activeRecipeTab === 'dessert' && styles.recipeTabActive]}
              onPress={() => setActiveRecipeTab('dessert')}
            >
              <Text style={[styles.recipeTabText, activeRecipeTab === 'dessert' && styles.recipeTabTextActive]}>Dessert</Text>
            </TouchableOpacity>
          </View>

          {activeRecipeTab === 'appetizer' && (
            <RecipeInput type="appetizer" recipe={appetizer} setRecipe={setAppetizer} label="Appetizer" />
          )}
          {activeRecipeTab === 'main' && (
            <RecipeInput type="main" recipe={mainCourse} setRecipe={setMainCourse} label="Main course" />
          )}
          {activeRecipeTab === 'dessert' && (
            <RecipeInput type="dessert" recipe={dessert} setRecipe={setDessert} label="Dessert" />
          )}
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.progressRow}>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={saveEvent} disabled={saving || uploading}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : (editingEventId ? 'Save changes' : 'Create event')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Icon Selection Modal */}
      <Modal visible={showIconModal} animationType="slide" transparent={true} onRequestClose={() => setShowIconModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose icon</Text>
              <TouchableOpacity onPress={() => setShowIconModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={DEFAULT_EVENT_ICONS}
              keyExtractor={(item) => item.id.toString()}
              numColumns={4}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.iconItem} onPress={() => selectIcon(item)}>
                  <Image source={{ uri: item.url }} style={styles.iconImage} />
                  <Text style={styles.iconName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Cooking Style Selection Modal */}
      <Modal visible={showCookingStyleModal} animationType="slide" transparent={true} onRequestClose={() => setShowCookingStyleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose cooking style</Text>
              <TouchableOpacity onPress={() => setShowCookingStyleModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COOKING_STYLES}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.cookingStyleItem,
                    cookingStyle?.id === item.id && styles.cookingStyleItemSelected
                  ]} 
                  onPress={() => selectCookingStyle(item)}
                >
                  <Text style={styles.cookingStyleItemIcon}>{item.icon}</Text>
                  <Text style={[
                    styles.cookingStyleItemName,
                    cookingStyle?.id === item.id && styles.cookingStyleItemNameSelected
                  ]}>
                    {item.name}
                  </Text>
                  {cookingStyle?.id === item.id && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Recipe Selection Modal */}
      <Modal visible={showRecipeModal} animationType="slide" transparent={true} onRequestClose={() => setShowRecipeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a recipe</Text>
              <TouchableOpacity onPress={() => setShowRecipeModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {/* Fixed Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
                <TextInput
                  value={recipeSearchQuery}
                  onChangeText={setRecipeSearchQuery}
                  style={styles.searchInput}
                  placeholder="Search recipes..."
                  placeholderTextColor={COLORS.textSecondary}
                  blurOnSubmit={false}
                />
                {recipeSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setRecipeSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={filteredRecipes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recipeItem} onPress={() => selectExistingRecipe(item)}>
                  <View style={styles.recipeItemContent}>
                    <Text style={styles.recipeItemTitle}>{item.dishName}</Text>
                    <RenderHTML
                      contentWidth={contentWidth - SPACING.lg * 2 - 60 - SPACING.md}
                      source={{ html: toHtml(item.ingredients) }}
                    />
                  </View>
                  {item.image && <Image source={{ uri: item.image }} style={styles.recipeItemImage} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {recipeSearchQuery.trim() ? 'No recipes found for your search' : 'No recipes available'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Manual Recipe Editor Modal */}
      <Modal visible={showManualModal} animationType="slide" transparent={true} onRequestClose={() => setShowManualModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit recipe</Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="always">
              <Text style={styles.label}>Dish name</Text>
              <TextInput
                value={manualName}
                onChangeText={setManualName}
                style={styles.input}
                placeholder="Dish name"
                blurOnSubmit={false}
              />

              <Text style={[styles.label, { marginTop: SPACING.md }]}>Ingredients (Markdown/HTML)</Text>
              <Toolbar
                onBold={() => setManualIngredients(prev => wrapSelection(prev, ingSel, '**', '**'))}
                onItalic={() => setManualIngredients(prev => wrapSelection(prev, ingSel, '*', '*'))}
                onH3={() => setManualIngredients(prev => insertSnippet(prev, ingSel, '### '))}
                onList={() => setManualIngredients(prev => insertSnippet(prev, ingSel, '- '))}
                onLink={() => setManualIngredients(prev => insertSnippet(prev, ingSel, '[text](url)'))}
              />
              <TextInput
                value={manualIngredients}
                onChangeText={setManualIngredients}
                onSelectionChange={({ nativeEvent: { selection } }) => setIngSel(selection)}
                style={[styles.input, styles.textArea]}
                placeholder="List ingredients..."
                multiline
                blurOnSubmit={false}
              />

              <Text style={[styles.label, { marginTop: SPACING.md }]}>Instructions (optional)</Text>
              <Toolbar
                onBold={() => setManualInstructions(prev => wrapSelection(prev, insSel, '**', '**'))}
                onItalic={() => setManualInstructions(prev => wrapSelection(prev, insSel, '*', '*'))}
                onH3={() => setManualInstructions(prev => insertSnippet(prev, insSel, '### '))}
                onList={() => setManualInstructions(prev => insertSnippet(prev, insSel, '- '))}
                onLink={() => setManualInstructions(prev => insertSnippet(prev, insSel, '[text](url)'))}
              />
              <TextInput
                value={manualInstructions}
                onChangeText={setManualInstructions}
                onSelectionChange={({ nativeEvent: { selection } }) => setInsSel(selection)}
                style={[styles.input, styles.textArea]}
                placeholder="Write steps..."
                multiline
                blurOnSubmit={false}
              />

              <View style={[styles.actionsRow, { marginHorizontal: 0, marginTop: SPACING.lg }]}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowManualModal(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={saveManualEditor}>
                  <Text style={styles.primaryButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary, padding: SPACING.lg, textAlign: 'center' },
  fieldGroup: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, ...SHADOWS.light },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  readOnlyInput: { backgroundColor: COLORS.lightGray },
  readOnlyText: { color: COLORS.textSecondary },
  row: { flexDirection: 'row' },
  col: { flex: 1 },
  typeRow: { flexDirection: 'row' },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, marginRight: SPACING.sm },
  typeButtonActive: { backgroundColor: COLORS.primary },
  typeText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600', marginLeft: SPACING.xs },
  typeTextActive: { color: COLORS.white },
  imageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  coverImage: { width: 120, height: 90, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.lightGray, marginRight: SPACING.md },
  imageButtons: { flex: 1 },
  pickButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
  iconButton: { backgroundColor: COLORS.secondary },
  pickButtonText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.xs },
  recipesContainer: { marginTop: SPACING.xl, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  sectionSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  recipeTabsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', marginBottom: SPACING.md },
  recipeTab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.lightGray, backgroundColor: COLORS.white },
  recipeTabActive: { backgroundColor: COLORS.primary },
  recipeTabText: { color: COLORS.textSecondary, fontWeight: '600' },
  recipeTabTextActive: { color: COLORS.white },
  recipeSection: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.lightGray },
  recipeLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  selectRecipeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, marginBottom: SPACING.sm },
  selectRecipeText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.xs },
  orText: { textAlign: 'center', color: COLORS.textSecondary, marginVertical: SPACING.sm, fontSize: FONT_SIZES.sm },
  progressRow: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center' },
  progressBarContainer: { flex: 1, height: 6, backgroundColor: COLORS.lightGray, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: COLORS.primary },
  progressText: { marginLeft: SPACING.sm, color: COLORS.textSecondary },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: SPACING.lg, marginTop: SPACING.lg },
  primaryButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, flex: 1, marginLeft: SPACING.sm, alignItems: 'center', ...SHADOWS.medium },
  primaryButtonText: { color: COLORS.white, fontWeight: '700' },
  secondaryButton: { backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, flex: 1, marginRight: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray },
  secondaryButtonText: { color: COLORS.textPrimary, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, width: '90%', maxHeight: '80%', padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  actionsRowInline: { flexDirection: 'row', gap: SPACING.sm },
  editManualButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, marginLeft: SPACING.sm },
  editManualText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.xs },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.xs },
  toolbarBtn: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.lightGray },
  toolbarBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  iconItem: { flex: 1, alignItems: 'center', margin: SPACING.sm },
  iconImage: { width: 60, height: 60, marginBottom: SPACING.xs },
  iconName: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textAlign: 'center' },
  recipeItem: { flexDirection: 'row', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  recipeItemContent: { flex: 1, marginRight: SPACING.md },
  recipeItemTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  recipeItemIngredients: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  recipeItemImage: { width: 60, height: 60, borderRadius: BORDER_RADIUS.md },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  
  // Cooking Style Selector Styles
  cookingStyleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.light,
  },
  selectedCookingStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cookingStyleIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  cookingStyleName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  cookingStylePlaceholder: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray,
    flex: 1,
  },
  
  // Cooking Style Modal Styles
  cookingStyleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  cookingStyleItemSelected: {
    backgroundColor: COLORS.surface,
  },
  cookingStyleItemIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  cookingStyleItemName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  cookingStyleItemNameSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  
  // Search Container Styles
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    paddingVertical: 0, // Remove default padding
  },
  clearButton: {
    marginLeft: SPACING.sm,
    padding: SPACING.xs,
  },
});


