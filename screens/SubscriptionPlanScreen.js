import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { db } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, Timestamp, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';

export default function SubscriptionPlanScreen({ navigation }) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const {
    userSubscription,
    activePlan,
    activeSubscriptions,
    aggregateAllowed,
    aggregateUsed,
    aggregateRemaining,
    totalAllowedEvents,
    usedEventsCount,
    remainingEvents,
    loading,
    refreshSubscriptionData,
  } = useSubscription();
  
  const [refreshing, setRefreshing] = useState(false);
  const [allPlans, setAllPlans] = useState([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'available'
  const [expiryAt, setExpiryAt] = useState(null);
  const [nextExpiryAt, setNextExpiryAt] = useState(null);

  const fetchAdditionalData = async () => {
    try {
      // Only fetch data that Context doesn't provide: subscription history and available plans
      
      const historyQuery = query(
        collection(db, 'subscriptionHistory'),
        where('userId', '==', user.uid)
      );
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a?.createdAt?.toMillis ? a.createdAt.toMillis() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b?.createdAt?.toMillis ? b.createdAt.toMillis() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime;
        });
      setSubscriptionHistory(history);

      const plansQuery = query(
        collection(db, 'settings'),
        where('type', '==', 'plan')
      );
      const plansSnapshot = await getDocs(plansQuery);
      const plans = plansSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p?.active === true);
      setAllPlans(plans);

    } catch (error) {
      console.error('Error fetching additional data:', error);
      Alert.alert('Error', 'Failed to load subscription information');
    } finally {
      setRefreshing(false);
    }
  };

  // Compute expiry date for display
  useEffect(() => {
    if (userSubscription && activePlan) {
      const plan = activePlan || {};
      const activationTs = userSubscription.activatedAt || userSubscription.giftedAt || userSubscription.createdAt || null;
      const activationDate = activationTs?.toDate ? activationTs.toDate() : (activationTs ? new Date(activationTs) : null);
      const exp = computeExpiryDate(activationDate, plan?.duration);
      setExpiryAt(exp);
    } else {
      setExpiryAt(null);
    }
  }, [userSubscription, activePlan]);

  // Compute next expiry date for multiple subscriptions
  useEffect(() => {
    if (activeSubscriptions && activeSubscriptions.length > 0) {
      const nextExpiry = activeSubscriptions
        .map(s => s.expiresAtDate)
        .filter(Boolean)
        .sort((a, b) => a - b)[0] || null;
      setNextExpiryAt(nextExpiry);
    } else {
      setNextExpiryAt(null);
    }
  }, [activeSubscriptions]);


  const computeExpiryDate = (activationDate, duration) => {
    if (!activationDate || !duration || !duration.value || !duration.unit) return null;
    const d = new Date(activationDate.getTime());
    const val = Number(duration.value) || 0;
    const unit = String(duration.unit || '').toLowerCase();
    if (val <= 0) return null;
    if (unit.startsWith('day')) d.setDate(d.getDate() + val);
    else if (unit.startsWith('month')) d.setMonth(d.getMonth() + val);
    else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() + val);
    else return null;
    return d;
  };

  useEffect(() => {
    if (user?.uid) fetchAdditionalData();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshSubscriptionData();
    await fetchAdditionalData();
  };

  const renderPlanDetails = (plan, showSelectButton = false) => {
    if (!plan) return null;
    const cardStyle = [styles.planDetailsCard, plan.bgColor ? { backgroundColor: plan.bgColor } : null];
    const titleStyle = [styles.planTitle, plan.textColor ? { color: plan.textColor } : null];
    const priceValueStyle = [styles.priceValue, plan.textColor ? { color: plan.textColor } : null];
    const durationStyle = [styles.durationText, plan.textColor ? { color: plan.textColor } : null];
    return (
      <View style={cardStyle}>
        {plan.isPopular && (
          <View style={styles.badgeTopContainer}>
            <View style={styles.popularBadgeGreen}>
              <Text style={styles.popularText}>POPULAR</Text>
            </View>
          </View>
        )}
        <View style={styles.planHeader}>
          <Text style={titleStyle}>{plan.name}</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={priceValueStyle}>
            {formatCurrency(plan.price, plan.currency)}
          </Text>
          {plan.duration && (
            <Text style={durationStyle}>
              / {plan.duration.value} {plan.duration.unit}
            </Text>
          )}
        </View>
        {plan.discountPercent && (
          <View style={styles.discountContainer}>
            <Ionicons name="pricetag" size={16} color={COLORS.success} />
            <Text style={styles.discountText}>
              {plan.discountPercent}% discount applied
            </Text>
          </View>
        )}
        {plan.eventParticipationLimit > 0 && (
          <View style={styles.limitContainer}>
            <Ionicons name="calendar" size={16} color={COLORS.primary} />
            <Text style={[styles.limitText, plan.textColor ? { color: plan.textColor } : null]}>
              Event Limit: {plan.eventParticipationLimit} events
            </Text>
          </View>
        )}
        {plan.oneTimeOnly && (
          <View style={styles.oneTimeBadge}>
            <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
            <Text style={styles.oneTimeText}>One-time purchase only</Text>
          </View>
        )}
        {plan.contentMarkdown && (
          <View style={styles.contentContainer}>
            {renderPlanContent(plan.contentMarkdown, { mode: 'admin', textColor: plan.textColor || COLORS.textPrimary, primaryColor: plan.textColor || COLORS.primary })}
          </View>
        )}
        {showSelectButton && (
          <TouchableOpacity style={styles.selectButton} onPress={() => Alert.alert('Coming Soon', 'Plan purchase will be available soon!')}>
            <Text style={styles.selectButtonText}>Select Plan</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.textOnPrimary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPlanContent = (contentMarkdown, options = { mode: 'brand', textColor: COLORS.textPrimary, primaryColor: COLORS.primary }) => {
    if (!contentMarkdown) return null;
    const htmlContent = contentMarkdown.includes('<') ? contentMarkdown : convertMarkdownToHtml(contentMarkdown);

    const mode = options.mode || 'brand';
    const textColor = options.textColor || COLORS.textPrimary;
    const primaryColor = options.primaryColor || COLORS.primary;

    const css = mode === 'brand'
      ? `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${COLORS.textPrimary}; line-height: 1.6; padding: 0; margin: 0; }
         h1, h2, h3, h4, h5, h6 { color: ${COLORS.primary}; margin-top: 16px; margin-bottom: 8px; }
         ul, ol { padding-left: 20px; margin: 8px 0; }
         li { margin: 4px 0; }
         p { margin: 8px 0; }
         strong { color: ${COLORS.primary}; }`
      : `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${textColor}; line-height: 1.6; padding: 0; margin: 0; }
         h1, h2, h3, h4, h5, h6 { color: ${textColor}; margin-top: 16px; margin-bottom: 8px; }
         ul, ol { padding-left: 20px; margin: 8px 0; }
         li { margin: 4px 0; }
         p { margin: 8px 0; }
         strong { color: ${primaryColor}; }`;

    const source = {
      html: `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${css}</style>
          </head>
          <body>${htmlContent}</body>
        </html>
      `
    };

    return (
      <RenderHtml
        contentWidth={width - SPACING.lg * 2}
        source={source}
        baseStyle={{ color: textColor, fontSize: FONT_SIZES.md }}
      />
    );
  };

  const convertMarkdownToHtml = (markdown) => {
    const lines = String(markdown || '').split(/\r?\n/);
    let html = '';
    let inUl = false;
    const closeUl = () => { if (inUl) { html += '</ul>'; inUl = false; } };

    lines.forEach((rawLine) => {
      const line = rawLine || '';
      if (/^\s*[-*+]\s+/.test(line)) {
        if (!inUl) { html += '<ul>'; inUl = true; }
        const item = line.replace(/^\s*[-*+]\s+/, '');
        html += `<li>${item}</li>`;
        return;
      }

      if (line.trim() === '') {
        closeUl();
        return;
      }

      closeUl();
      if (/^\s*###\s+/.test(line)) {
        html += `<h3>${line.replace(/^\s*###\s+/, '')}</h3>`;
      } else if (/^\s*##\s+/.test(line)) {
        html += `<h2>${line.replace(/^\s*##\s+/, '')}</h2>`;
      } else if (/^\s*#\s+/.test(line)) {
        html += `<h1>${line.replace(/^\s*#\s+/, '')}</h1>`;
      } else if (/^\s*---\s*$/.test(line)) {
        html += '<hr />';
      } else {
        let paragraph = line;
        paragraph = paragraph.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        paragraph = paragraph.replace(/\*(?!\s)(.+?)\*/g, '<em>$1</em>');
        html += `<p>${paragraph}</p>`;
      }
    });

    closeUl();
    return html;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrency = (amount, currency = '€') => {
    return `${currency}${Number(amount || 0).toFixed(2)}`;
  };

  const historyToShow = subscriptionHistory.filter((item) => item?.status !== 'active');

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading subscription details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscription Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'active' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' ? styles.tabTextActive : styles.tabTextInactive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'available' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' ? styles.tabTextActive : styles.tabTextInactive]}>Available</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'active' && activeSubscriptions.length > 0 && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="layers" size={24} color={COLORS.primary} />
              <Text style={styles.statusTitle}>Active Subscriptions: {activeSubscriptions.length}</Text>
            </View>
            {aggregateAllowed != null && (
              <Text style={styles.dateText}>Aggregated allowed events: {aggregateAllowed}</Text>
            )}
            {aggregateRemaining != null && (
              <Text style={styles.dateText}>Aggregated remaining: {aggregateRemaining}</Text>
            )}
            {nextExpiryAt && (
              <Text style={styles.dateText}>Next expiry: {formatDate(nextExpiryAt)}</Text>
            )}
          </View>
        )}
        {activeTab === 'active' && (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons 
              name={userSubscription ? 'checkmark-circle' : 'information-circle'} 
              size={24} 
              color={userSubscription ? COLORS.success : COLORS.warning} 
            />
            <Text style={styles.statusTitle}>
              {userSubscription ? 'Active Subscription' : 'No Active Subscription'}
            </Text>
          </View>
          {userSubscription && (
            <View style={styles.statusDetails}>
              <Text style={styles.planName}>{userSubscription.planName}</Text>
              {userSubscription.code && (
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Subscription Code:</Text>
                  <Text style={styles.codeValue}>{userSubscription.code}</Text>
                </View>
              )}
              {userSubscription.gifted && (
                <View style={styles.giftBadge}>
                  <Ionicons name="gift" size={16} color={COLORS.textOnPrimary} />
                  <Text style={styles.giftText}>
                    Gifted by {userSubscription.giftedBy || 'Admin'}
                  </Text>
                </View>
              )}
              {userSubscription.giftedAt && (
                <Text style={[styles.dateText, activePlan?.textColor ? { color: activePlan.textColor } : null]}>
                  Activated on: {formatDate(userSubscription.giftedAt)}
                </Text>
              )}
              {totalAllowedEvents != null && (
                <Text style={styles.dateText}>Allowed events: {totalAllowedEvents}</Text>
              )}
              {remainingEvents != null && (
                <Text style={styles.dateText}>Remaining events: {remainingEvents}</Text>
              )}
              {expiryAt && (
                <Text style={styles.dateText}>Expires on: {formatDate(expiryAt)}</Text>
              )}
            </View>
          )}
        </View>
        )}

        {activeTab === 'active' && activeSubscriptions.length > 0 && (
          <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            {activeSubscriptions.map((s) => (
              <View key={s.id}>
                {renderPlanDetails(s.plan, false)}
                <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg }}>
                  {s.expiresAtDate && (
                    <Text style={styles.dateText}>Expires on: {formatDate(s.expiresAtDate)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active tab does not show the admin-styled plan card anymore */}

        {activeTab === 'available' && allPlans.length > 0 && (
          <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            {allPlans.map((plan) => (
              <View key={plan.id}>
                {renderPlanDetails(plan, true)}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'active' && historyToShow.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Subscription History</Text>
            {historyToShow.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyPlanName}>{item.planName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? COLORS.success : COLORS.lightGray }]}>
                    <Text style={styles.statusBadgeText}>{item.status}</Text>
                  </View>
                </View>
                {item.code && (
                  <Text style={styles.historyCode}>Code: {item.code}</Text>
                )}
                <Text style={styles.historyDate}>
                  {item.source === 'gift' ? 'Gifted' : 'Purchased'} on {formatDate(item.createdAt)}
                </Text>
                {item.giftedBy && (
                  <Text style={styles.historyGiftedBy}>Gifted by: {item.giftedBy}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Help section removed as requested */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { padding: SPACING.sm },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textOnPrimary },
  container: { flex: 1, backgroundColor: COLORS.background },
  statusCard: { backgroundColor: COLORS.card, margin: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.medium },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  statusTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginLeft: SPACING.sm },
  statusDetails: { marginTop: SPACING.sm },
  planName: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.sm },
  codeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  codeLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginRight: SPACING.sm },
  codeValue: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, backgroundColor: COLORS.lightGray, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  giftBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.md, alignSelf: 'flex-start' },
  giftText: { color: COLORS.textOnSecondary, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.sm },
  dateText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  planDetailsCard: { backgroundColor: COLORS.card, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.medium },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md },
  sectionSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  planTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.primary },
  popularBadge: { backgroundColor: COLORS.accent, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm },
  popularText: { color: COLORS.textOnPrimary, fontSize: FONT_SIZES.xs, fontWeight: 'bold' },
  badgeTopContainer: { width: '100%', alignItems: 'center', marginBottom: SPACING.sm },
  popularBadgeGreen: { backgroundColor: COLORS.success, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.round },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.md },
  priceLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginRight: SPACING.sm },
  priceValue: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.secondary },
  durationText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginLeft: SPACING.sm },
  discountContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
  discountText: { color: COLORS.success, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.sm },
  limitContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  limitText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginLeft: SPACING.sm },
  oneTimeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md },
  oneTimeText: { color: COLORS.warning, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: SPACING.sm },
  contentContainer: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  contentTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  availablePlansCard: { backgroundColor: COLORS.card, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.medium },
  planItem: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md, ...SHADOWS.light },
  planItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  planItemName: { fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
  planItemPrice: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', marginBottom: SPACING.sm },
  planItemDuration: { fontSize: FONT_SIZES.sm, fontWeight: 'normal' },
  planItemContent: { marginVertical: SPACING.md },
  selectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.md },
  selectButtonText: { color: COLORS.textOnPrimary, fontSize: FONT_SIZES.md, fontWeight: '600', marginRight: SPACING.sm },
  historyCard: { backgroundColor: COLORS.card, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.medium },
  historyItem: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  historyPlanName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  statusBadgeText: { color: COLORS.textOnPrimary, fontSize: FONT_SIZES.xs, fontWeight: '600', textTransform: 'uppercase' },
  historyCode: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  historyDate: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  historyGiftedBy: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: SPACING.xs },
  helpCard: { backgroundColor: '#FFF4EF', marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, alignItems: 'center' },
  helpTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.primary, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  helpText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.md },
  helpButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  helpButtonText: { color: COLORS.textOnPrimary, fontSize: FONT_SIZES.md, fontWeight: '600' },
  tabsContainer: { flexDirection: 'row', backgroundColor: COLORS.card, margin: SPACING.lg, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', ...SHADOWS.light },
  tabButton: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: COLORS.primary + '20' },
  tabInactive: { backgroundColor: COLORS.card },
  tabText: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  tabTextInactive: { color: COLORS.textSecondary },
});


