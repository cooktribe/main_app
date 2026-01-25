import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, DeviceEventEmitter, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import messaging from '@react-native-firebase/messaging';
import { getNotifications, NOTIFICATIONS_EVENT, markNotificationRead, removeNotification } from '../services/notificationStore';

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const initial = await getNotifications();
      if (mounted) setItems(initial);
    })();
    const subFG = messaging().onMessage(() => {
      // Foreground messages are saved by App/Index handlers too; refresh list
      getNotifications().then(setItems);
    });
    const subEvt = DeviceEventEmitter.addListener(NOTIFICATIONS_EVENT, () => {
      getNotifications().then(setItems);
    });
    return () => { mounted = false; subFG(); subEvt.remove(); };
  }, []);

  const openItem = async (item) => {
    setSelected(item);
    setVisible(true);
    if (!item.read) {
      await markNotificationRead(item.id);
      setItems(await getNotifications());
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.row, !item.read ? styles.unread : null]} onPress={() => openItem(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        {!!item.body && <Text style={styles.body} numberOfLines={1}>{item.body}</Text>}
        <Text style={styles.meta}>{new Date(item.receivedAt).toLocaleString()}</Text>
      </View>
      {item.read && (
        <TouchableOpacity onPress={() => {
          Alert.alert('Delete notification', 'Are you sure you want to delete this notification?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await removeNotification(item.id); setItems(await getNotifications()); } },
          ]);
        }}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.lg }}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet</Text>}
      />

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{selected?.title || 'Notification'}</Text>
            {!!selected?.body && <Text style={styles.dialogBody}>{selected.body}</Text>}
            {!!selected?.data && Object.keys(selected.data).length > 0 && (
              <Text style={styles.dialogMeta}>Data: {JSON.stringify(selected.data)}</Text>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.light,
  },
  title: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  body: { marginTop: 4, color: COLORS.textSecondary },
  meta: { marginTop: 6, fontSize: FONT_SIZES.xs, color: COLORS.gray },
  empty: { textAlign: 'center', marginTop: SPACING.xl, color: COLORS.textSecondary },
  unread: { borderLeftWidth: 4, borderLeftColor: COLORS.primary + 'AA', backgroundColor: COLORS.primary + '10' },
  delete: { color: COLORS.error, fontWeight: '700', marginLeft: SPACING.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  dialog: { width: '100%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.light },
  dialogTitle: { fontSize: FONT_SIZES.lg, fontWeight: '800', color: COLORS.textPrimary },
  dialogBody: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  dialogMeta: { marginTop: SPACING.sm, fontSize: FONT_SIZES.xs, color: COLORS.gray },
  closeBtn: { marginTop: SPACING.lg, alignSelf: 'flex-end' },
  closeText: { color: COLORS.primary, fontWeight: '700' },
});


