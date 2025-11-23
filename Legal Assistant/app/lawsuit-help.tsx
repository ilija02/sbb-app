
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, buttonStyles } from "@/styles/commonStyles";
import { useRouter } from "expo-router";

export default function LawsuitHelpScreen() {
  const router = useRouter();
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');

  const issueTypes = [
    {
      id: 'price_increase',
      title: 'Unauthorized Price Increase',
      description: 'Provider increased prices without proper notification',
    },
    {
      id: 'contract_violation',
      title: 'Contract Terms Violation',
      description: 'Provider violated agreed contract terms',
    },
    {
      id: 'service_quality',
      title: 'Service Quality Issues',
      description: 'Consistent failure to provide agreed service quality',
    },
    {
      id: 'billing_error',
      title: 'Billing Errors',
      description: 'Incorrect charges or billing practices',
    },
  ];

  const templates = {
    price_increase: {
      title: 'Complaint Template - Unauthorized Price Increase',
      content: `To: [Provider Name]
Date: [Current Date]

Subject: Formal Complaint - Unauthorized Price Increase

Dear Sir/Madam,

I am writing to formally complain about the unauthorized price increase applied to my account [Account Number] on [Date].

According to my contract signed on [Contract Date], the pricing terms were fixed for [Duration]. The recent price increase of [Amount/Percentage] violates these agreed terms.

Under Serbian Consumer Protection Law (Zakon o zaštiti potrošača), I am entitled to:
- Proper notification period (minimum 30 days)
- Right to terminate contract without penalty if terms change
- Compensation for unauthorized charges

I request:
1. Immediate reversal of the unauthorized charges
2. Written confirmation of original contract terms
3. Compensation for any overcharges

If this matter is not resolved within 15 days, I will proceed with filing a formal complaint with the regulatory authority.

Sincerely,
[Your Name]
[Contact Information]`,
    },
    contract_violation: {
      title: 'Complaint Template - Contract Violation',
      content: `To: [Provider Name]
Date: [Current Date]

Subject: Formal Complaint - Contract Terms Violation

Dear Sir/Madam,

I am writing to formally complain about violations of my service contract [Contract Number].

The following contract terms have been violated:
[List specific violations]

These violations constitute a breach of contract under Serbian law and entitle me to remedies including contract termination and compensation.

I request immediate action to:
1. Restore original contract terms
2. Provide written explanation
3. Compensate for damages incurred

Please respond within 15 days.

Sincerely,
[Your Name]
[Contact Information]`,
    },
  };

  const getTemplate = () => {
    if (selectedIssue === 'price_increase' || selectedIssue === 'contract_violation') {
      return templates[selectedIssue as keyof typeof templates];
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Legal Assistance</Text>
        </View>

        <View style={styles.infoCard}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            We&apos;ll help you formulate a professional complaint or lawsuit based on your specific situation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Issue</Text>
          {issueTypes.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={[
                styles.issueCard,
                selectedIssue === issue.id && styles.issueCardSelected,
              ]}
              onPress={() => setSelectedIssue(issue.id)}
              activeOpacity={0.7}
            >
              <View style={styles.issueContent}>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.issueDescription}>{issue.description}</Text>
              </View>
              {selectedIssue === issue.id && (
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.accent}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedIssue && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Details</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Provide any additional details about your case..."
                placeholderTextColor={colors.textSecondary}
                value={additionalDetails}
                onChangeText={setAdditionalDetails}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {getTemplate() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{getTemplate()?.title}</Text>
                <View style={styles.templateCard}>
                  <Text style={styles.templateText}>{getTemplate()?.content}</Text>
                </View>
                <TouchableOpacity
                  style={[buttonStyles.primary, { marginTop: 16 }]}
                  onPress={() => console.log('Copy template')}
                  activeOpacity={0.7}
                >
                  <Text style={buttonStyles.text}>Copy Template</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next Steps</Text>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Customize the Template</Text>
                  <Text style={styles.stepDescription}>
                    Fill in your specific details and dates
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Send to Provider</Text>
                  <Text style={styles.stepDescription}>
                    Send via registered mail or email with confirmation
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Wait for Response</Text>
                  <Text style={styles.stepDescription}>
                    Provider has 15 days to respond
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Escalate if Needed</Text>
                  <Text style={styles.stepDescription}>
                    File with regulatory authority or court if unresolved
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  issueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  issueCardSelected: {
    borderColor: colors.accent,
  },
  issueContent: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  issueDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  templateText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
});
