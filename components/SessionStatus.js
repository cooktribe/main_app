import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

const SessionStatus = ({ style }) => {
  const { getSessionInfo, refreshSession, SessionManager } = useAuth();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadSessionInfo();
    
    // Update session info every minute
    const interval = setInterval(loadSessionInfo, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadSessionInfo = async () => {
    try {
      const info = await getSessionInfo();
      setSessionInfo(info);
    } catch (error) {
      console.error('Error loading session info:', error);
    }
  };

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshSession();
      if (result.success) {
        Alert.alert('Success', 'Session extended successfully!');
        await loadSessionInfo(); // Reload session info
      } else {
        Alert.alert('Error', result.reason || 'Failed to extend session');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to extend session');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = () => {
    if (!sessionInfo || sessionInfo.isExpired) {
      return COLORS.error;
    }
    
    if (sessionInfo.daysRemaining <= 1) {
      return COLORS.warning || '#FF9500';
    }
    
    return COLORS.success || '#34C759';
  };

  const getStatusIcon = () => {
    if (!sessionInfo || sessionInfo.isExpired) {
      return 'warning-outline';
    }
    
    if (sessionInfo.daysRemaining <= 1) {
      return 'time-outline';
    }
    
    return 'checkmark-circle-outline';
  };

  const getStatusText = () => {
    if (!sessionInfo) {
      return 'No session info';
    }
    
    if (sessionInfo.isExpired) {
      return 'Session expired';
    }
    
    return SessionManager.formatTimeRemaining(sessionInfo.timeRemaining);
  };

  if (!sessionInfo) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.statusContainer}>
        <View style={styles.statusLeft}>
          <Ionicons 
            name={getStatusIcon()} 
            size={16} 
            color={getStatusColor()} 
            style={styles.statusIcon}
          />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>Session Status</Text>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
        
        {!sessionInfo.isExpired && sessionInfo.daysRemaining <= 2 && (
          <TouchableOpacity 
            style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
            onPress={handleRefreshSession}
            disabled={isRefreshing}
          >
            <Ionicons 
              name={isRefreshing ? 'hourglass-outline' : 'refresh-outline'} 
              size={14} 
              color={COLORS.primary} 
            />
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? 'Extending...' : 'Extend'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Additional session details */}
      {sessionInfo && !sessionInfo.isExpired && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailText}>
            Remember me: {sessionInfo.rememberMe ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.detailText}>
            Last activity: {new Date(sessionInfo.lastLoginTime).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.sm,
    ...SHADOWS.light,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: SPACING.sm,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: SPACING.sm,
  },
  detailText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
});

export default SessionStatus;
