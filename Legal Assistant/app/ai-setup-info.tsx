
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, buttonStyles } from '@/styles/commonStyles';

export default function AISetupInfoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="sparkles"
            android_material_icon_name="auto-awesome"
            size={60}
            color={colors.primary}
          />
          <Text style={styles.title}>AI Contract Analysis</Text>
          <Text style={styles.subtitle}>
            Unlock powerful AI-powered contract parsing with OpenAI
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You Get</Text>
          
          <View style={styles.featureCard}>
            <IconSymbol
              ios_icon_name="doc.text.magnifyingglass"
              android_material_icon_name="search"
              size={32}
              color={colors.primary}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Automatic Extraction</Text>
              <Text style={styles.featureDescription}>
                AI automatically extracts pricing, terms, duration, and fees from your contracts
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={32}
              color={colors.warning}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Risk Detection</Text>
              <Text style={styles.featureDescription}>
                Identifies potentially unfavorable terms and hidden fees
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <IconSymbol
              ios_icon_name="text.bubble.fill"
              android_material_icon_name="chat"
              size={32}
              color={colors.accent}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Plain Language Summary</Text>
              <Text style={styles.featureDescription}>
                Get an easy-to-understand summary of complex legal terms
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Enable</Text>
          
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enable Supabase</Text>
              <Text style={styles.stepDescription}>
                Click the Supabase button in Natively and connect to your Supabase project (create one if needed at supabase.com)
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Get OpenAI API Key</Text>
              <Text style={styles.stepDescription}>
                Sign up at platform.openai.com and create an API key
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Create Edge Function</Text>
              <Text style={styles.stepDescription}>
                Deploy the contract parsing edge function to your Supabase project
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Add API Key</Text>
              <Text style={styles.stepDescription}>
                Add your OpenAI API key to Supabase environment variables
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={colors.primary}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Current Status</Text>
            <Text style={styles.infoText}>
              The app currently uses a demo mode with sample data. Enable Supabase and OpenAI integration for real AI-powered contract analysis.
            </Text>
          </View>
        </View>

        <View style={styles.technicalSection}>
          <Text style={styles.sectionTitle}>Technical Details</Text>
          <Text style={styles.technicalText}>
            The AI integration uses OpenAI&apos;s GPT-4 model to analyze contract documents. 
            It can process PDFs and images, extracting structured data including:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Monthly fees and pricing structure</Text>
            <Text style={styles.bulletItem}>• Contract duration and renewal terms</Text>
            <Text style={styles.bulletItem}>• Early termination fees</Text>
            <Text style={styles.bulletItem}>• Price protection clauses</Text>
            <Text style={styles.bulletItem}>• Notice periods and cancellation terms</Text>
            <Text style={styles.bulletItem}>• Potential consumer rights violations</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[buttonStyles.primary, styles.actionButton]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={buttonStyles.text}>Got It</Text>
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
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.card,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
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
  technicalSection: {
    marginBottom: 32,
  },
  technicalText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    paddingLeft: 8,
  },
  bulletItem: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 24,
  },
  actionButton: {
    marginTop: 8,
  },
});
