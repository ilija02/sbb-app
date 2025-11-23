
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, buttonStyles } from "@/styles/commonStyles";
import * as DocumentPicker from 'expo-document-picker';
import { useContractParser } from "@/hooks/useContractParser";
import { ContractData } from "@/utils/contractParser";

interface Contract {
  id: string;
  provider: string;
  uploadDate: string;
  status: 'active' | 'analyzed' | 'pending';
  fileName?: string;
  contractData?: ContractData;
}

export default function ContractsScreen() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [provider, setProvider] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  
  const { parseContract, loading, error: parserError, progress } = useContractParser();

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Document selected:', result.assets[0]);
        setSelectedFile({
          uri: result.assets[0].uri,
          name: result.assets[0].name,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const handleUploadAndParse = async () => {
    if (!provider.trim()) {
      Alert.alert('Error', 'Please enter the provider name');
      return;
    }

    if (!selectedFile) {
      Alert.alert('Error', 'Please select a contract file');
      return;
    }

    const newContract: Contract = {
      id: Date.now().toString(),
      provider: provider,
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      fileName: selectedFile.name,
    };

    setContracts([newContract, ...contracts]);
    setShowUploadForm(false);

    // Parse the contract with AI
    const result = await parseContract(selectedFile.uri, selectedFile.name, provider);

    if (result.success && result.data) {
      setContracts(prev => prev.map(c => 
        c.id === newContract.id 
          ? {
              ...c,
              status: 'analyzed',
              contractData: result.data,
            }
          : c
      ));
      
      Alert.alert(
        'Success',
        'Contract analyzed successfully! View the details below.',
        [{ text: 'OK' }]
      );
    } else {
      setContracts(prev => prev.map(c => 
        c.id === newContract.id 
          ? {
              ...c,
              status: 'active',
            }
          : c
      ));
      
      Alert.alert(
        'Analysis Complete',
        result.error || 'Contract uploaded but AI analysis is not available. Using basic analysis.',
        [{ text: 'OK' }]
      );
    }

    setProvider('');
    setSelectedFile(null);
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'active':
        return colors.accent;
      case 'analyzed':
        return colors.primary;
      case 'pending':
        return colors.highlight;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusText = (status: Contract['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'analyzed':
        return 'Analyzed';
      case 'pending':
        return 'Analyzing...';
      default:
        return 'Unknown';
    }
  };

  const toggleExpanded = (contractId: string) => {
    setExpandedContract(expandedContract === contractId ? null : contractId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Contracts</Text>
          <Text style={styles.subtitle}>
            Upload and analyze your telecom service contracts with AI
          </Text>
        </View>

        <View style={styles.aiInfoCard}>
          <IconSymbol
            ios_icon_name="sparkles"
            android_material_icon_name="auto-awesome"
            size={24}
            color={colors.primary}
          />
          <View style={styles.aiInfoContent}>
            <Text style={styles.aiInfoTitle}>AI-Powered Analysis</Text>
            <Text style={styles.aiInfoText}>
              Our AI extracts key terms, pricing, and potential issues from your contracts
            </Text>
          </View>
        </View>

        {!showUploadForm ? (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => setShowUploadForm(true)}
            activeOpacity={0.7}
          >
            <IconSymbol
              ios_icon_name="plus.circle.fill"
              android_material_icon_name="add-circle"
              size={24}
              color={colors.card}
            />
            <Text style={styles.uploadButtonText}>Upload New Contract</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.uploadForm}>
            <Text style={styles.formTitle}>Upload Contract for AI Analysis</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Provider Name (e.g., Telekom Srbija, Telenor, A1)"
              placeholderTextColor={colors.textSecondary}
              value={provider}
              onChangeText={setProvider}
            />

            <TouchableOpacity
              style={styles.fileSelectButton}
              onPress={handleSelectFile}
              activeOpacity={0.7}
            >
              <IconSymbol
                ios_icon_name="doc.fill"
                android_material_icon_name="description"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.fileSelectText}>
                {selectedFile ? selectedFile.name : 'Select Contract File (PDF or Image)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[buttonStyles.primary, { flex: 1 }]}
                onPress={handleUploadAndParse}
                activeOpacity={0.7}
                disabled={!provider.trim() || !selectedFile}
              >
                <Text style={buttonStyles.text}>Analyze with AI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[buttonStyles.outline, { flex: 1 }]}
                onPress={() => {
                  setShowUploadForm(false);
                  setProvider('');
                  setSelectedFile(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={buttonStyles.textOutline}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.contractsList}>
          {contracts.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No contracts uploaded yet</Text>
              <Text style={styles.emptySubtext}>
                Upload your first contract to get AI-powered analysis
              </Text>
            </View>
          ) : (
            <React.Fragment>
              {contracts.map((contract) => (
                <View key={contract.id} style={styles.contractCard}>
                  <TouchableOpacity
                    onPress={() => toggleExpanded(contract.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contractHeader}>
                      <View style={styles.contractInfo}>
                        <Text style={styles.contractProvider}>{contract.provider}</Text>
                        <Text style={styles.contractDate}>
                          Uploaded: {new Date(contract.uploadDate).toLocaleDateString()}
                        </Text>
                        {contract.fileName && (
                          <Text style={styles.contractFileName}>{contract.fileName}</Text>
                        )}
                      </View>
                      <View style={styles.contractHeaderRight}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contract.status) }]}>
                          <Text style={styles.statusText}>{getStatusText(contract.status)}</Text>
                        </View>
                        <IconSymbol
                          ios_icon_name={expandedContract === contract.id ? "chevron.up" : "chevron.down"}
                          android_material_icon_name={expandedContract === contract.id ? "expand-less" : "expand-more"}
                          size={24}
                          color={colors.textSecondary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {expandedContract === contract.id && contract.contractData && (
                    <View style={styles.contractDetails}>
                      <View style={styles.summarySection}>
                        <View style={styles.sectionHeader}>
                          <IconSymbol
                            ios_icon_name="doc.text.fill"
                            android_material_icon_name="description"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.sectionTitle}>Summary</Text>
                        </View>
                        <Text style={styles.summaryText}>{contract.contractData.summary}</Text>
                      </View>

                      {contract.contractData.warnings && contract.contractData.warnings.length > 0 && (
                        <View style={styles.warningsSection}>
                          <View style={styles.sectionHeader}>
                            <IconSymbol
                              ios_icon_name="exclamationmark.triangle.fill"
                              android_material_icon_name="warning"
                              size={20}
                              color={colors.warning}
                            />
                            <Text style={[styles.sectionTitle, { color: colors.warning }]}>Important Warnings</Text>
                          </View>
                          <React.Fragment>
                            {contract.contractData.warnings.map((warning, index) => (
                              <View key={`warning-${contract.id}-${index}`} style={styles.warningItem}>
                                <IconSymbol
                                  ios_icon_name="exclamationmark.circle.fill"
                                  android_material_icon_name="error"
                                  size={16}
                                  color={colors.warning}
                                />
                                <Text style={styles.warningText}>{warning}</Text>
                              </View>
                            ))}
                          </React.Fragment>
                        </View>
                      )}

                      <View style={styles.detailsGrid}>
                        {contract.contractData.monthlyFee && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Monthly Fee</Text>
                            <Text style={styles.detailValue}>{contract.contractData.monthlyFee}</Text>
                          </View>
                        )}
                        {contract.contractData.contractDuration && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Duration</Text>
                            <Text style={styles.detailValue}>{contract.contractData.contractDuration}</Text>
                          </View>
                        )}
                        {contract.contractData.dataAllowance && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Data</Text>
                            <Text style={styles.detailValue}>{contract.contractData.dataAllowance}</Text>
                          </View>
                        )}
                        {contract.contractData.callMinutes && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Calls</Text>
                            <Text style={styles.detailValue}>{contract.contractData.callMinutes}</Text>
                          </View>
                        )}
                        {contract.contractData.earlyTerminationFee && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Termination Fee</Text>
                            <Text style={styles.detailValue}>{contract.contractData.earlyTerminationFee}</Text>
                          </View>
                        )}
                        {contract.contractData.noticeRequired && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Notice Period</Text>
                            <Text style={styles.detailValue}>{contract.contractData.noticeRequired}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.keyTermsSection}>
                        <View style={styles.sectionHeader}>
                          <IconSymbol
                            ios_icon_name="list.bullet"
                            android_material_icon_name="list"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.sectionTitle}>Key Terms</Text>
                        </View>
                        <React.Fragment>
                          {contract.contractData.keyTerms.map((term, index) => (
                            <View key={`term-${contract.id}-${index}`} style={styles.termItem}>
                              <IconSymbol
                                ios_icon_name="checkmark.circle.fill"
                                android_material_icon_name="check-circle"
                                size={16}
                                color={colors.accent}
                              />
                              <Text style={styles.termText}>{term}</Text>
                            </View>
                          ))}
                        </React.Fragment>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </React.Fragment>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={loading}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.modalTitle}>Analyzing Contract</Text>
            {progress && (
              <Text style={styles.modalProgress}>{progress}</Text>
            )}
            <Text style={styles.modalSubtext}>
              Our AI is reading and extracting key information from your contract...
            </Text>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  aiInfoCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  aiInfoContent: {
    flex: 1,
  },
  aiInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  aiInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
  uploadForm: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  fileSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  fileSelectText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contractsList: {
    gap: 16,
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
  contractCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  contractInfo: {
    flex: 1,
  },
  contractProvider: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  contractDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  contractFileName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  contractHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
  },
  contractDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summarySection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  summaryText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  warningsSection: {
    marginBottom: 16,
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  keyTermsSection: {
    marginBottom: 8,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 8,
  },
  termText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalProgress: {
    fontSize: 16,
    color: colors.primary,
    marginBottom: 8,
    fontWeight: '500',
  },
  modalSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
