import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        friction: 2,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }]
      }}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EE603F',
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
  },
  splashImage: {
    width: width * 0.8,
    height: height * 0.8,
    maxWidth: 300,
    maxHeight: 300,
  },
});

export default SplashScreen;
