import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const STORAGE_KEY = '@cooktribe_notifications';
export const NOTIFICATIONS_EVENT = 'notifications:new';
const MAX_ITEMS = 100;

function normalizeRemoteMessage(remoteMessage) {
  return {
    id: remoteMessage?.messageId || String(Date.now()),
    title: remoteMessage?.notification?.title || 'Notification',
    body: remoteMessage?.notification?.body || '',
    data: remoteMessage?.data || {},
    receivedAt: new Date().toISOString(),
    read: false,
  };
}

export async function getNotifications() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addNotificationFromRemote(remoteMessage) {
  try {
    const entry = normalizeRemoteMessage(remoteMessage);
    const current = await getNotifications();
    // Deduplicate by message id
    if (current.some(n => n.id === entry.id)) {
      return;
    }
    const next = [entry, ...current].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    DeviceEventEmitter.emit(NOTIFICATIONS_EVENT, entry);
  } catch {}
}

export async function clearNotifications() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export async function markNotificationRead(id) {
  try {
    const list = await getNotifications();
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].read = true;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      DeviceEventEmitter.emit(NOTIFICATIONS_EVENT, { type: 'read', id });
    }
  } catch {}
}

export async function removeNotification(id) {
  try {
    const list = await getNotifications();
    const next = list.filter(n => n.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    DeviceEventEmitter.emit(NOTIFICATIONS_EVENT, { type: 'removed', id });
  } catch {}
}



