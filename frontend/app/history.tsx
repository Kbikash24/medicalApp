import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Types
interface HealthParameter {
  name: string;
  value: string;
  unit: string;
  normal_range: string;
  status: string;
  explanation: string;
  hindi_explanation?: string;
}

interface AnalyzedReport {
  id: string;
  report_type: string;
  title: string;
  summary: string;
  hindi_summary?: string;
  parameters: HealthParameter[];
  health_tips: string[];
  hindi_health_tips?: string[];
  overall_status: string;
  created_at: string;
}

interface SavedReport {
  id: string;
  report_data: AnalyzedReport;
  saved_at: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [showHindi, setShowHindi] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/reports`);
      setReports(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to fetch saved reports.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const deleteReport = async (reportId: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use report_data.id which is the actual report ID
              const report = reports.find(r => r.id === reportId);
              const actualReportId = report?.report_data?.id || reportId;
              
              await axios.delete(`${BACKEND_URL}/api/reports/${actualReportId}`);
              
              // Remove from local state
              setReports(reports.filter(r => r.id !== reportId));
              if (selectedReport?.id === reportId) {
                setSelectedReport(null);
              }
              Alert.alert('Success', 'Report deleted successfully.');
            } catch (error) {
              console.error('Error deleting report:', error);
              Alert.alert('Error', 'Failed to delete report. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'normal':
      case 'good':
        return '#22c55e';
      case 'low':
      case 'moderate':
        return '#f59e0b';
      case 'high':
      case 'concerning':
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'normal':
      case 'good':
        return 'checkmark-circle';
      case 'low':
      case 'moderate':
        return 'warning';
      case 'high':
      case 'concerning':
      case 'critical':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'blood_test':
        return 'water';
      case 'diagnostic':
        return 'scan';
      case 'prescription':
        return 'document-text';
      default:
        return 'document';
    }
  };

  const renderReportDetail = () => {
    if (!selectedReport) return null;
    const report = selectedReport.report_data;

    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedReport(null)}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>{report.title}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteReport(selectedReport.id)}
          >
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Language Toggle */}
        <View style={styles.languageToggle}>
          <TouchableOpacity
            style={[styles.langButton, !showHindi && styles.langButtonActive]}
            onPress={() => setShowHindi(false)}
          >
            <Text style={[styles.langText, !showHindi && styles.langTextActive]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langButton, showHindi && styles.langButtonActive]}
            onPress={() => setShowHindi(true)}
          >
            <Text style={[styles.langText, showHindi && styles.langTextActive]}>हिंदी</Text>
          </TouchableOpacity>
        </View>

        {/* Overall Status */}
        <View style={[
          styles.statusCard,
          { backgroundColor: getStatusColor(report.overall_status) + '20' }
        ]}>
          <Ionicons
            name={getStatusIcon(report.overall_status) as any}
            size={36}
            color={getStatusColor(report.overall_status)}
          />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusLabel}>
              {showHindi ? 'समग्र स्थिति' : 'Overall Status'}
            </Text>
            <Text style={[
              styles.statusValue,
              { color: getStatusColor(report.overall_status) }
            ]}>
              {report.overall_status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Date */}
        <View style={styles.dateCard}>
          <Ionicons name="calendar" size={20} color="#9ca3af" />
          <Text style={styles.dateText}>{formatDate(selectedReport.saved_at)}</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>
            {showHindi ? 'सारांश' : 'Summary'}
          </Text>
          <Text style={styles.summaryText}>
            {showHindi ? report.hindi_summary : report.summary}
          </Text>
        </View>

        {/* Parameters */}
        <View style={styles.parametersSection}>
          <Text style={styles.sectionTitle}>
            {showHindi ? 'रिपोर्ट पैरामीटर' : 'Report Parameters'}
          </Text>
          
          {report.parameters?.map((param, index) => (
            <View key={index} style={styles.parameterCard}>
              <View style={styles.parameterHeader}>
                <View style={styles.parameterNameContainer}>
                  <Text style={styles.parameterName}>{param.name}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(param.status) + '20' }
                  ]}>
                    <Ionicons
                      name={getStatusIcon(param.status) as any}
                      size={12}
                      color={getStatusColor(param.status)}
                    />
                    <Text style={[
                      styles.statusBadgeText,
                      { color: getStatusColor(param.status) }
                    ]}>
                      {param.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.parameterValue}>
                  {param.value} <Text style={styles.parameterUnit}>{param.unit}</Text>
                </Text>
              </View>
              <Text style={styles.normalRange}>
                {showHindi ? 'सामान्य सीमा' : 'Normal Range'}: {param.normal_range}
              </Text>
              <Text style={styles.explanation}>
                {showHindi ? param.hindi_explanation : param.explanation}
              </Text>
            </View>
          ))}
        </View>

        {/* Health Tips */}
        <View style={styles.healthTipsSection}>
          <View style={styles.healthTipsHeader}>
            <Ionicons name="bulb" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>
              {showHindi ? 'स्वास्थ्य सुझाव' : 'Health Tips'}
            </Text>
          </View>
          
          {(showHindi ? report.hindi_health_tips : report.health_tips)?.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipNumber}>
                <Text style={styles.tipNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderReportsList = () => (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
          colors={['#6366f1']}
        />
      }
    >
      {/* Header */}
      <View style={styles.listHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.listTitle}>Saved Reports</Text>
        <View style={{ width: 44 }} />
      </View>

      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={80} color="#4b5563" />
          <Text style={styles.emptyTitle}>No Reports Saved</Text>
          <Text style={styles.emptyText}>
            Scan a medical report and save it to see it here.
          </Text>
          <TouchableOpacity
            style={styles.scanNowButton}
            onPress={() => router.back()}
          >
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.scanNowButtonText}>Scan Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.reportsList}>
          {reports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.reportCard}
              onPress={() => setSelectedReport(report)}
              activeOpacity={0.7}
            >
              <View style={styles.reportCardHeader}>
                <View style={[
                  styles.reportIcon,
                  { backgroundColor: getStatusColor(report.report_data.overall_status) + '20' }
                ]}>
                  <Ionicons
                    name={getReportTypeIcon(report.report_data.report_type) as any}
                    size={24}
                    color={getStatusColor(report.report_data.overall_status)}
                  />
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportTitle} numberOfLines={1}>
                    {report.report_data.title}
                  </Text>
                  <Text style={styles.reportDate}>
                    {formatDate(report.saved_at)}
                  </Text>
                </View>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: getStatusColor(report.report_data.overall_status) }
                ]} />
              </View>
              
              <Text style={styles.reportSummary} numberOfLines={2}>
                {report.report_data.summary}
              </Text>
              
              <View style={styles.reportFooter}>
                <View style={styles.parameterCount}>
                  <Ionicons name="list" size={14} color="#9ca3af" />
                  <Text style={styles.parameterCountText}>
                    {report.report_data.parameters?.length || 0} parameters
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteIconButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteReport(report.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      {selectedReport ? renderReportDetail() : renderReportsList()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  // List Header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e1e3f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  scanNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  scanNowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Reports List
  reportsList: {
    paddingTop: 8,
  },
  reportCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 13,
    color: '#9ca3af',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reportSummary: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parameterCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  parameterCountText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  deleteIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Detail Header
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Language Toggle
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  langButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  langButtonActive: {
    backgroundColor: '#6366f1',
  },
  langText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  langTextActive: {
    color: '#fff',
  },
  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statusTextContainer: {
    marginLeft: 14,
  },
  statusLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Date Card
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 22,
  },
  // Parameters Section
  parametersSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  parameterCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  parameterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  parameterNameContainer: {
    flex: 1,
  },
  parameterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 3,
    textTransform: 'uppercase',
  },
  parameterValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  parameterUnit: {
    fontSize: 12,
    color: '#9ca3af',
  },
  normalRange: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  explanation: {
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 20,
  },
  // Health Tips
  healthTipsSection: {
    marginBottom: 16,
  },
  healthTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e3f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  tipNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 20,
  },
});
