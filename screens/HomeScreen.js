import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';

export default function HomeScreen({ navigation }) {
  const handleJoinCommunity = () => {
    navigation.navigate('Discover');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <ScrollView style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appTitle}>CookTribe</Text>
          <Text style={styles.subtitle}>Connect through cooking and make new friends</Text>
        </View>

        {/* Concept Introduction */}
        <View style={styles.conceptSection}>
          <Text style={styles.conceptTitle}>About CookTribe</Text>
          <Text style={styles.conceptDescription}>
            CookTribe brings hobby cooks and people together who want to make new connections for shared cooking evenings. 
            Combat loneliness while sharing your passion for cooking with like-minded individuals.
          </Text>
          
          {/* Key Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Minimum 3 people for safety</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>ID verification for all users</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Local community matching</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="restaurant" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Share ingredients & recipes</Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Create Your Profile</Text>
              <Text style={styles.stepDescription}>Complete personality test and verify your identity</Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Get Matched</Text>
              <Text style={styles.stepDescription}>Our algorithm matches you with compatible cooking partners</Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Cook Together</Text>
              <Text style={styles.stepDescription}>Meet at a host's kitchen and create amazing dishes together</Text>
            </View>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why Choose CookTribe?</Text>
          
          <TouchableOpacity style={styles.benefitCard}>
            <ImageBackground 
              source={{ uri: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop' }}
              style={styles.benefitCardBackground}
              imageStyle={styles.benefitCardImage}
            >
              <View style={styles.benefitCardOverlay}>
                <Ionicons name="heart" size={32} color={COLORS.white} />
                <Text style={styles.benefitCardTitle}>Combat Loneliness</Text>
                <Text style={styles.benefitCardSubtitle}>Connect with real people in your area</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.benefitCard}>
            <ImageBackground 
              source={{ uri: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=200&fit=crop' }}
              style={styles.benefitCardBackground}
              imageStyle={styles.benefitCardImage}
            >
              <View style={styles.benefitCardOverlay}>
                <Ionicons name="cash" size={32} color={COLORS.white} />
                <Text style={styles.benefitCardTitle}>Budget Friendly</Text>
                <Text style={styles.benefitCardSubtitle}>Share ingredient costs with your cooking partners</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.benefitCard}>
            <ImageBackground 
              source={{ uri: 'https://images.unsplash.com/photo-1556909045-ca4f7ba4b534?w=400&h=200&fit=crop' }}
              style={styles.benefitCardBackground}
              imageStyle={styles.benefitCardImage}
            >
              <View style={styles.benefitCardOverlay}>
                <Ionicons name="star" size={32} color={COLORS.white} />
                <Text style={styles.benefitCardTitle}>Learn & Grow</Text>
                <Text style={styles.benefitCardSubtitle}>Discover new recipes and cooking techniques</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinCommunity}>
            <Text style={styles.joinButtonText}>JOIN COMMUNITY</Text>
            <Ionicons name="arrow-forward" size={24} color={COLORS.white} style={styles.joinButtonIcon} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="log-in-outline" size={20} color={COLORS.primary} style={styles.loginButtonIcon} />
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
          
          <Text style={styles.joinSubtext}>Start your culinary journey today!</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSection: {
    padding: SPACING.lg,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
  },
  welcomeText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  appTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  conceptSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  conceptTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  conceptDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  featuresContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.light,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  howItWorksSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.light,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  benefitsSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  benefitCard: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  benefitCardBackground: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitCardImage: {
    borderRadius: BORDER_RADIUS.xl,
  },
  benefitCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCardTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textOnPrimary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  benefitCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textOnPrimary,
    opacity: 0.9,
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.sm,
  },
  joinButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
    marginRight: SPACING.sm,
  },
  joinButtonIcon: {
    marginLeft: SPACING.xs,
  },
  loginButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.light,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  loginButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  loginButtonIcon: {
    marginRight: SPACING.xs,
  },
  joinSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});