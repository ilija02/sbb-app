
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";

export default function ProfileScreen() {
  const userStats = {
    contractsMonitored: 1,
    alertsReceived: 4,
    potentialSavings: '€250',
    matchedUsers: 47,
  };

  const menuItems = [
    {
      title: 'Personal Information',
      icon: 'person',
      action: () => Alert.alert('Personal Information', 'Edit your profile details'),
    },
    {
      title: 'Legal Documents',
      icon: 'description',
      action: () => Alert.alert('Legal Documents', 'View your legal documents and templates'),
    },
    {
      title: 'Class Action Matches',
      icon: 'group',
      action: () => Alert.alert('Class Action Matches', 'View users with similar cases'),
    },
    {
      title: 'Notification Settings',
      icon: 'notifications',
      action: () => Alert.alert('Notification Settings', 'Manage your notification preferences'),
    },
    {
      title: 'Help & Support',
      icon: 'help',
      action: () => Alert.alert('Help & Support', 'Get help with the app'),
    },
    {
      title: 'About',
      icon: 'info',
      action: () => Alert.alert('About', 'Legal Rights Protection v1.0.0'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={80}
              color={colors.primary}
            />
          </View>
          <Text style={styles.name}>Marko Petrović</Text>
          <Text style={styles.email}>marko.petrovic@example.com</Text>
          <Text style={styles.memberSince}>Member since January 2024</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.contractsMonitored}</Text>
            <Text style={styles.statLabel}>Contracts Monitored</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.alertsReceived}</Text>
            <Text style={styles.statLabel}>Alerts Received</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.potentialSavings}</Text>
            <Text style={styles.statLabel}>Potential Savings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.matchedUsers}</Text>
            <Text style={styles.statLabel}>Matched Users</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <IconSymbol
                  ios_icon_name={item.icon}
                  android_material_icon_name={item.icon}
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoCard}>
          <IconSymbol
            ios_icon_name="shield.fill"
            android_material_icon_name="shield"
            size={24}
            color={colors.accent}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Your Data is Protected</Text>
            <Text style={styles.infoText}>
              We use end-to-end encryption to protect your personal information and contract details.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive' },
          ])}
          activeOpacity={0.7}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color={colors.error}
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
});
