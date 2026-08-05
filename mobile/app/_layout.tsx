import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LibraryProvider } from '../context/LibraryContext';
import { AuthProvider } from '../context/AuthContext';
import { ProfileProvider } from '../context/ProfileContext';
import Onboarding from '../components/Onboarding';
import { colors } from '../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function makeTabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ focused, color }: { focused: boolean; color: string }) {
    return <Ionicons name={focused ? active : inactive} size={22} color={color} />;
  };
}

// Tab button with a quick spring scale on press, for tactile feedback
function TabPressable({ children, onPress, style, accessibilityState, ...rest }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  }

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onPressIn={() => animateTo(0.86)}
      onPressOut={() => animateTo(1)}
      accessibilityState={accessibilityState}
      style={style}
    >
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <LibraryProvider>
      <AuthProvider>
      <ProfileProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          // Smooth horizontal slide when switching tabs, plus a subtle press ripple
          animation: 'shift',
          tabBarActiveTintColor: colors.goldBright,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarButton: props => <TabPressable {...props} />,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.6,
          },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            tabBarIcon: makeTabIcon('search', 'search-outline'),
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
            tabBarIcon: makeTabIcon('albums', 'albums-outline'),
          }}
        />
        <Tabs.Screen
          name="wishlist"
          options={{
            title: 'Wishlist',
            tabBarIcon: makeTabIcon('bookmark', 'bookmark-outline'),
          }}
        />
        <Tabs.Screen
          name="rankings"
          options={{
            title: 'Rankings',
            tabBarIcon: makeTabIcon('podium', 'podium-outline'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: makeTabIcon('person', 'person-outline'),
          }}
        />
      </Tabs>
      <Onboarding />
      </ProfileProvider>
      </AuthProvider>
    </LibraryProvider>
  );
}
