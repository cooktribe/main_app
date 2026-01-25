import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export default function PersonalityTestScreen({ navigation }) {
  const { user } = useAuth();

  const [answers, setAnswers] = useState({
    q1: null, q2: null, q3: 5, q4: null, q5: 5, q6: null, q7: null, q8: 5, q9: 5, q10: 5,
  });

  const setValue = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const loadExisting = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.personality) {
          const p = snap.data().personality;
          setAnswers(prev => ({
            ...prev,
            q1: p.q1 ?? prev.q1,
            q2: p.q2 ?? prev.q2,
            q3: p.q3 ?? prev.q3,
            q4: p.q4 ?? prev.q4,
            q5: p.q5 ?? prev.q5,
            q6: p.q6 ?? prev.q6,
            q7: p.q7 ?? prev.q7,
            q8: p.q8 ?? prev.q8,
            q9: p.q9 ?? prev.q9,
            q10: p.q10 ?? prev.q10,
          }));
        }
      } catch {}
    };
    if (user?.uid) loadExisting();
  }, [user?.uid]);

  const saveAndExit = async () => {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        personality: { ...answers },
        personalityCompleted: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Saved', 'Your answers have been saved.');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save answers');
    }
  };

  const renderScale = (key) => (
    <View style={styles.scaleRow}>
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <TouchableOpacity key={n} style={[styles.scaleDot, answers[key] === n && styles.scaleDotSelected]} onPress={() => setValue(key, n)}>
          <Text style={[styles.scaleDotText, answers[key] === n && styles.scaleDotTextSelected]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderChoice = (key, options) => (
    <View style={styles.choiceRow}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[styles.choiceChip, answers[key] === o && styles.choiceChipSelected]} onPress={() => setValue(key, o)}>
          <Text style={[styles.choiceChipText, answers[key] === o && styles.choiceChipTextSelected]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Personality Test</Text>

        <Text style={styles.q}>1. What best describes your cooking style?</Text>
        {renderChoice('q1', ['Experimental & Innovative', 'Traditional & Reliable'])}

        <Text style={styles.q}>2. When meeting new people at an event, do you prefer a...</Text>
        {renderChoice('q2', ['Small, intimate group setting', 'Larger, more lively gathering'])}

        <Text style={styles.q}>3. How important is learning new cooking skills to you?</Text>
        {renderScale('q3')}

        <Text style={styles.q}>4. How flexible are you with your dietary preferences?</Text>
        {renderChoice('q4', ['Open to anything', 'Specific about my diet'])}

        <Text style={styles.q}>5. I feel energized after spending time in a group.</Text>
        {renderScale('q5')}

        <Text style={styles.q}>6. When planning a cooking event, do you prefer it to be...</Text>
        {renderChoice('q6', ['Carefully organized with a clear agenda', 'Spontaneous and free-flowing'])}

        <Text style={styles.q}>7. In a group cooking session, are you more likely to...</Text>
        {renderChoice('q7', ['Take the lead and organize tasks', 'Collaborate and follow along'])}

        <Text style={styles.q}>8. How adventurous are you with trying new foods?</Text>
        {renderScale('q8')}

        <Text style={styles.q}>9. Your living and working spaces are clean and organized.</Text>
        {renderScale('q9')}

        <Text style={styles.q}>10. You usually stay calm, even under a lot of pressure.</Text>
        {renderScale('q10')}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={saveAndExit}>
            <Text style={styles.primaryButtonText}>Save answers</Text>
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
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary, padding: SPACING.lg },
  q: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, fontWeight: '600' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  choiceChip: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, marginRight: SPACING.sm },
  choiceChipSelected: { backgroundColor: COLORS.primary + '20' },
  choiceChipText: { color: COLORS.textPrimary },
  choiceChipTextSelected: { color: COLORS.primary, fontWeight: '700' },
  scaleRow: { flexDirection: 'row', flexWrap: 'nowrap', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, justifyContent: 'space-between' },
  scaleDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  scaleDotSelected: { backgroundColor: COLORS.primary },
  scaleDotText: { color: COLORS.textPrimary, fontWeight: '600' },
  scaleDotTextSelected: { color: '#fff' },
  actionsRow: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg },
  primaryButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});


