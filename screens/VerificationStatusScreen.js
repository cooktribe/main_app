import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

export default function VerificationStatusScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [identityUrl, setIdentityUrl] = useState(null);
  const [addressUrl, setAddressUrl] = useState(null);
  const [kitchenUrl, setKitchenUrl] = useState(null);
  const [adminIdApproved, setAdminIdApproved] = useState(false);
  const [adminAddressApproved, setAdminAddressApproved] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const hv = snap.exists() ? (snap.data().hostVerification || {}) : {};
        setIdentityUrl(hv.identity || null);
        setAddressUrl(hv.address || null);
        setKitchenUrl(hv.kitchen || null);
        const admin = hv.admin || {};
        setAdminIdApproved(Boolean(admin.idApproved));
        setAdminAddressApproved(Boolean(admin.addressApproved));
      } catch (_) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    if (user?.uid) fetch();
  }, [user?.uid]);

  const handleUpload = async (key) => {
    try {
      setUploadingKey(key);
      setUploadProgress(0);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is needed to select a document image.');
        setUploadingKey(null);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
      if (result.canceled) { setUploadingKey(null); setUploadProgress(0); return; }
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `verification/${user.uid}/${key}.jpg`);
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on(
          'state_changed',
          (snapshot) => {
            const progress = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
            setUploadProgress(progress);
          },
          reject,
          resolve
        );
      });
      const url = await getDownloadURL(storageRef);
      const hv = { identity: identityUrl, address: addressUrl, kitchen: kitchenUrl, [key]: url };
      await setDoc(doc(db, 'users', user.uid), { hostVerification: hv, updatedAt: serverTimestamp() }, { merge: true });
      if (key === 'identity') setIdentityUrl(url);
      if (key === 'address') setAddressUrl(url);
      if (key === 'kitchen') setKitchenUrl(url);
      Alert.alert('Uploaded', `${key} uploaded successfully.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploadingKey(null);
      setUploadProgress(0);
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Verification Status</Text>

        <View style={styles.card}>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowLeft}>
              <Ionicons name={identityUrl && adminIdApproved ? 'checkmark-circle' : 'person-outline'} size={22} color={identityUrl && adminIdApproved ? COLORS.success : COLORS.primary} />
              <Text style={styles.rowLabel}>Identity Document</Text>
            </View>
            {identityUrl ? (
              adminIdApproved ? (
                <Text style={[styles.statusText, { color: COLORS.success }]}>Approved</Text>
              ) : (
                <Text style={[styles.statusText, { color: COLORS.warning }]}>Pending approval</Text>
              )
            ) : (
              <TouchableOpacity style={[styles.uploadButton, !!uploadingKey && styles.uploadButtonDisabled]} onPress={() => handleUpload('identity')} disabled={!!uploadingKey}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
                <Text style={styles.uploadButtonText}>Upload ID</Text>
              </TouchableOpacity>
            )}
          </View>
          {uploadingKey === 'identity' && (
            <View style={styles.progressWrapper}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{`Uploading ${Math.round(uploadProgress * 100)}%`}</Text>
            </View>
          )}

          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowLeft}>
              <Ionicons name={addressUrl && adminAddressApproved ? 'checkmark-circle' : 'location-outline'} size={22} color={addressUrl && adminAddressApproved ? COLORS.success : COLORS.primary} />
              <Text style={styles.rowLabel}>Address Proof</Text>
            </View>
            {addressUrl ? (
              adminAddressApproved ? (
                <Text style={[styles.statusText, { color: COLORS.success }]}>Approved</Text>
              ) : (
                <Text style={[styles.statusText, { color: COLORS.warning }]}>Pending approval</Text>
              )
            ) : (
              <TouchableOpacity style={[styles.uploadButton, !!uploadingKey && styles.uploadButtonDisabled]} onPress={() => handleUpload('address')} disabled={!!uploadingKey}>
                <Ionicons name="document" size={16} color={COLORS.white} />
                <Text style={styles.uploadButtonText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
          {uploadingKey === 'address' && (
            <View style={styles.progressWrapper}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{`Uploading ${Math.round(uploadProgress * 100)}%`}</Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name={kitchenUrl ? 'checkmark-circle' : 'restaurant-outline'} size={22} color={kitchenUrl ? COLORS.success : COLORS.primary} />
              <Text style={styles.rowLabel}>Kitchen Photo</Text>
            </View>
            {kitchenUrl ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            ) : (
              <TouchableOpacity style={[styles.uploadButton, !!uploadingKey && styles.uploadButtonDisabled]} onPress={() => handleUpload('kitchen')} disabled={!!uploadingKey}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
                <Text style={styles.uploadButtonText}>Add Photos</Text>
              </TouchableOpacity>
            )}
          </View>
          {uploadingKey === 'kitchen' && (
            <View style={styles.progressWrapper}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{`Uploading ${Math.round(uploadProgress * 100)}%`}</Text>
            </View>
          )}
        </View>

        <Text style={styles.note}>
          Manage your verification documents in your profile. More controls are coming soon.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  container: { padding: SPACING.lg },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', ...SHADOWS.light, paddingVertical: SPACING.sm },
  row: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, fontWeight: '600' },
  statusText: { fontWeight: '700' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  uploadButtonDisabled: { opacity: 0.6 },
  uploadButtonText: { fontSize: FONT_SIZES.xs, color: COLORS.white, fontWeight: '600', marginLeft: SPACING.xs },
  progressWrapper: { marginTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  progressBar: { height: 6, backgroundColor: COLORS.lightGray, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: COLORS.primary },
  progressText: { marginTop: 4, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  note: { marginTop: SPACING.lg, color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
});


