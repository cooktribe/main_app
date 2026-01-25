import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/Colors';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import PersonalityTestScreen from '../screens/PersonalityTestScreen';
import PostLoginGate from '../screens/PostLoginGate';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import EventCreateScreen from '../screens/EventCreateScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import VerificationStatusScreen from '../screens/VerificationStatusScreen';
import SubscriptionPlanScreen from '../screens/SubscriptionPlanScreen';
import { useAuth } from '../context/AuthContext';
import NotificationsScreen from '../screens/NotificationsScreen';
import { navigationRef, flushPendingNavigation } from './RootNavigation';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Loading Screen Component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

function MainTabNavigator() {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // If on Profile tab and user has a photoURL, show user's avatar
          if (route.name === 'Profile' && user?.photoURL) {
            return (
              <Image
                source={{ uri: user.photoURL }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: focused ? 2 : 1,
                  borderColor: focused ? COLORS.primary : COLORS.lightGray,
                }}
              />
            );
          }

          let iconName;

          if (route.name === 'Discover') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'MyEvents') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.lightGray,
          paddingBottom: SPACING.xs,
          paddingTop: SPACING.xs,
          height: 60,
          ...SHADOWS.light,
        },
        tabBarLabelStyle: {
          fontSize: FONT_SIZES.xs,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
          ...SHADOWS.medium,
        },
        headerTintColor: COLORS.textOnPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: FONT_SIZES.lg,
        },
      })}
    >
      <Tab.Screen 
        name="Discover" 
        component={DiscoverScreen}
        options={{
          title: 'CookTribe',
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{
          title: 'Messages',
          headerShown: false,
        }}
      />
      
      <Tab.Screen 
        name="MyEvents" 
        component={MyEventsScreen}
        options={{
          title: 'My Events',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

// Styles for loading screen
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});

export default function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
      {isAuthenticated ? (
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.primary,
              ...SHADOWS.medium,
            },
            headerTintColor: COLORS.textOnPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: FONT_SIZES.lg,
            },
          }}
        >
          <Stack.Screen name="PostLoginGate" component={PostLoginGate} options={{ headerShown: false }} />
          <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="ProfileEdit"
            component={ProfileEditScreen}
            options={{ title: 'Edit Profile' }}
          />
          <Stack.Screen
            name="PersonalityTest"
            component={PersonalityTestScreen}
            options={{ title: 'Personality Test' }}
          />
          <Stack.Screen
            name="PaymentMethods"
            component={PaymentMethodsScreen}
            options={{ title: 'Payment Methods' }}
          />
          <Stack.Screen 
            name="SubscriptionPlan" 
            component={SubscriptionPlanScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VerificationStatus"
            component={VerificationStatusScreen}
            options={{ title: 'Verification Status' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen
            name="EventCreate"
            component={EventCreateScreen}
            options={{ title: 'Create Event' }}
          />
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.primary,
              ...SHADOWS.medium,
            },
            headerTintColor: COLORS.textOnPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: FONT_SIZES.lg,
            },
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{
              title: 'CookTribe',
              headerShown: true,
            }}
          />
          <Stack.Screen 
            name="Discover" 
            component={DiscoverScreen}
            options={{
              title: 'Discover',
              headerShown: true,
            }}
          />
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ProfileEdit" 
            component={ProfileEditScreen}
            options={{
              title: 'Edit Profile',
            }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}