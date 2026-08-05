import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  // Direction the content slides in FROM (a few px of travel)
  offsetX?: number;
  offsetY?: number;
  // Change this key to re-trigger the animation (e.g. per selected item)
  triggerKey?: string | number;
  delay?: number;
}

// Lightweight enter animation (opacity + small translate) using the built-in
// Animated API — no extra dependencies. Re-runs whenever triggerKey changes.
export default function FadeInView({
  children,
  style,
  duration = 260,
  offsetX = 0,
  offsetY = 12,
  triggerKey,
  delay = 0,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    translate.setValue(1);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
    ]).start();
  }, [triggerKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [
            { translateX: translate.interpolate({ inputRange: [0, 1], outputRange: [0, offsetX] }) },
            { translateY: translate.interpolate({ inputRange: [0, 1], outputRange: [0, offsetY] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
