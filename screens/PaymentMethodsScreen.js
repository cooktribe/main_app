import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const METHODS = [
  { key: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
  { key: 'stripe', label: 'Stripe', icon: 'card-outline' },
];

export default function PaymentMethodsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.payment?.method) {
          setSelected(snap.data().payment.method);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user?.uid]);

  const save = async () => {
    try {
      setSaving(true);
      await setDoc(
        doc(db, 'users', user.uid),
        { payment: { method: selected || null, updatedAt: serverTimestamp() } },
        { merge: true }
      );
      Alert.alert('Saved', 'Payment method updated');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save payment method');
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
      <View style={styles.container}>
        <Text style={styles.title}>Payment Methods</Text>

        <View style={styles.card}>
          {METHODS.map((m) => (
            <TouchableOpacity key={m.key} style={styles.methodItem} onPress={() => setSelected(m.key)}>
              <View style={styles.methodLeft}>
                <Ionicons name={m.icon} size={22} color={COLORS.textPrimary} />
                <Text style={styles.methodLabel}>{m.label}</Text>
              </View>
              {selected === m.key ? (
                <Ionicons name="radio-button-on" size={22} color={COLORS.primary} />
              ) : (
                <Ionicons name="radio-button-off" size={22} color={COLORS.gray} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.methodItem} onPress={() => setSelected(null)}>
            <View style={styles.methodLeft}>
              <Ionicons name="close-circle-outline" size={22} color={COLORS.textPrimary} />
              <Text style={styles.methodLabel}>None</Text>
            </View>
            {selected === null ? (
              <Ionicons name="radio-button-on" size={22} color={COLORS.primary} />
            ) : (
              <Ionicons name="radio-button-off" size={22} color={COLORS.gray} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: SPACING.lg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.light, overflow: 'hidden' },
  methodItem: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  methodLeft: { flexDirection: 'row', alignItems: 'center' },
  methodLabel: { marginLeft: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, fontWeight: '600' },
  saveButton: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', ...SHADOWS.light },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});


