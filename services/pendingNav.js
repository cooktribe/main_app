import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@cooktribe_pending_nav_notifications';

export async function setNotificationsPending() {
  try { await AsyncStorage.setItem(KEY, '1'); } catch {}
}

export async function consumeNotificationsPending() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) {
      await AsyncStorage.removeItem(KEY);
      return true;
    }
    return false;
  } catch { return false; }
}


