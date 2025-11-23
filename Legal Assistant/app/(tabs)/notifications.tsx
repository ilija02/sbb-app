
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, buttonStyles } from "@/styles/commonStyles";
import { useRouter } from "expo-router";

interface Notification {
  id: string;
  type: 'price_change' | 'violation' | 'market_trend' | 'class_action';
  title: string;
  description: string;
  date: string;
  read: boolean;
  severity: 'high' | 'medium' | 'low';
  provider?: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'price_change',
      title: 'Price Increase Detected',
      description: 'Telekom Srbija increased mobile data prices by 15% without proper notification period.',
      date: '2024-01-20',
      read: false,
      severity: 'high',
      provider: 'Telekom Srbija',
    },
    {
      id: '2',
      type: 'violation',
      title: 'Potential Contract Violation',
      description: 'Your contract guarantees fixed pricing for 24 months. The recent price change may violate your agreement.',
      date: '2024-01-19',
      read: false,
      severity: 'high',
      provider: 'Telekom Srbija',
    },
    {
      id: '3',
      type: 'market_trend',
      title: 'Market Analysis Alert',
      description: 'Multiple providers increased prices simultaneously. This pattern may indicate anti-competitive behavior.',
      date: '2024-01-18',
      read: true,
      severity: 'medium',
    },
    {
      id: '4',
      type: 'class_action',
      title: 'Class Action Opportunity',
      description: '47 users with similar cases. Consider joining a class action lawsuit for stronger legal position.',
      date: '2024-01-17',
      read: true,
      severity: 'medium',
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'price_change':
        return { ios: 'chart.line.uptrend.xyaxis', android: 'trending-up' };
      case 'violation':
        return { ios: 'exclamationmark.triangle.fill', android: 'warning' };
      case 'market_trend':
        return { ios: 'chart.bar.fill', android: 'bar-chart' };
      case 'class_action':
        return { ios: 'person.3.fill', android: 'group' };
      default:
        return { ios: 'bell.fill', android: 'notifications' };
    }
  };

  const getSeverityColor = (severity: Notification['severity']) => {
    switch (severity) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.highlight;
      case 'low':
        return colors.accent;
      default:
        return colors.textSecondary;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasViolations = notifications.some(n => n.type === 'violation' && !n.read);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>
            Stay informed about pricing changes and potential violations
          </Text>
        </View>

        {hasViolations && (
          <TouchableOpacity
            style={styles.actionBanner}
            onPress={() => router.push('/lawsuit-help')}
            activeOpacity={0.7}
          >
            <View style={styles.actionBannerContent}>
              <IconSymbol
                ios_icon_name="exclamationmark.shield.fill"
                android_material_icon_name="gavel"
                size={32}
                color={colors.card}
              />
              <View style={styles.actionBannerText}>
                <Text style={styles.actionBannerTitle}>Legal Action Available</Text>
                <Text style={styles.actionBannerSubtitle}>
                  Get help formulating a complaint or lawsuit
                </Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={colors.card}
              />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Text style={styles.filterButtonText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonInactive]} activeOpacity={0.7}>
            <Text style={[styles.filterButtonText, styles.filterButtonTextInactive]}>Unread</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonInactive]} activeOpacity={0.7}>
            <Text style={[styles.filterButtonText, styles.filterButtonTextInactive]}>High Priority</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notificationsList}>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="bell.slash"
                android_material_icon_name="notifications-off"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>
                We&apos;ll notify you when we detect any changes
              </Text>
            </View>
          ) : (
            notifications.map((notification) => {
              const icon = getTypeIcon(notification.type);
              const severityColor = getSeverityColor(notification.severity);

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread,
                  ]}
                  onPress={() => markAsRead(notification.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: severityColor }]}>
                    <IconSymbol
                      ios_icon_name={icon.ios}
                      android_material_icon_name={icon.android}
                      size={24}
                      color={colors.card}
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.read && <View style={styles.unreadDot} />}
                    </View>
                    {notification.provider && (
                      <Text style={styles.notificationProvider}>{notification.provider}</Text>
                    )}
                    <Text style={styles.notificationDescription}>
                      {notification.description}
                    </Text>
                    <Text style={styles.notificationDate}>
                      {new Date(notification.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.infoCard}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            We monitor provider websites daily and compare changes against your contract terms. 
            You&apos;ll be notified immediately if we detect potential violations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginRight: 12,
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.card,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  actionBanner: {
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    boxShadow: '0px 4px 12px rgba(220, 53, 69, 0.3)',
    elevation: 5,
  },
  actionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBannerText: {
    flex: 1,
  },
  actionBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.card,
    marginBottom: 4,
  },
  actionBannerSubtitle: {
    fontSize: 14,
    color: colors.card,
    opacity: 0.9,
  },
  filterSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  filterButtonInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.card,
  },
  filterButtonTextInactive: {
    color: colors.text,
  },
  notificationsList: {
    gap: 12,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  notificationCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notificationProvider: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
