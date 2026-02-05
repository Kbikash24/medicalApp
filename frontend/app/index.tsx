import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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

export default function HomeScreen() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedReport, setAnalyzedReport] = useState<AnalyzedReport | null>(null);
  const [showHindi, setShowHindi] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraPermission.status !== 'granted' || mediaPermission.status !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please grant camera and gallery permissions to scan medical reports.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].base64);
        await analyzeReport(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeReport = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setAnalyzedReport(null);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/analyze-report`,
        {
          image_base64: imageBase64,
          language: showHindi ? 'hindi' : 'english',
        },
        {
          timeout: 120000, // 2 minute timeout for AI analysis
        }
      );

      setAnalyzedReport(response.data);
    } catch (error: any) {
      console.error('Error analyzing report:', error);
      Alert.alert(
        'Analysis Failed',
        error.response?.data?.detail || 'Failed to analyze the report. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveReport = async () => {
    if (!analyzedReport) return;

    try {
      await axios.post(`${BACKEND_URL}/api/save-report`, analyzedReport);
      Alert.alert('Success', 'Report saved successfully!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'Failed to save report. Please try again.');
    }
  };

  const resetScan = () => {
    setAnalyzedReport(null);
    setSelectedImage(null);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
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
    switch (status.toLowerCase()) {
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

  const renderHomeContent = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.iconContainer}>
          <Ionicons name="document-text" size={60} color="#6366f1" />
        </View>
        <Text style={styles.heroTitle}>Medical Report Scanner</Text>
        <Text style={styles.heroSubtitle}>
          Scan your medical reports and get easy-to-understand explanations in English & Hindi
        </Text>
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

      {/* Scan Options */}
      <View style={styles.scanOptions}>
        <Text style={styles.sectionTitle}>
          {showHindi ? 'अपनी रिपोर्ट स्कैन करें' : 'Scan Your Report'}
        </Text>
        
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => pickImage(true)}
        >
          <View style={styles.scanButtonIcon}>
            <Ionicons name="camera" size={32} color="#fff" />
          </View>
          <View style={styles.scanButtonText}>
            <Text style={styles.scanButtonTitle}>
              {showHindi ? 'कैमरा से स्कैन करें' : 'Scan with Camera'}
            </Text>
            <Text style={styles.scanButtonSubtitle}>
              {showHindi ? 'अपनी रिपोर्ट की फोटो लें' : 'Take a photo of your report'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6366f1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => pickImage(false)}
        >
          <View style={[styles.scanButtonIcon, { backgroundColor: '#8b5cf6' }]}>
            <Ionicons name="images" size={32} color="#fff" />
          </View>
          <View style={styles.scanButtonText}>
            <Text style={styles.scanButtonTitle}>
              {showHindi ? 'गैलरी से चुनें' : 'Choose from Gallery'}
            </Text>
            <Text style={styles.scanButtonSubtitle}>
              {showHindi ? 'सहेजी हुई रिपोर्ट अपलोड करें' : 'Upload a saved report'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>
          {showHindi ? 'विशेषताएं' : 'Features'}
        </Text>
        
        <View style={styles.featureGrid}>
          <View style={styles.featureCard}>
            <Ionicons name="analytics" size={28} color="#6366f1" />
            <Text style={styles.featureTitle}>
              {showHindi ? 'AI विश्लेषण' : 'AI Analysis'}
            </Text>
            <Text style={styles.featureText}>
              {showHindi ? 'स्मार्ट रिपोर्ट विश्लेषण' : 'Smart report analysis'}
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Ionicons name="language" size={28} color="#8b5cf6" />
            <Text style={styles.featureTitle}>
              {showHindi ? 'द्विभाषी' : 'Bilingual'}
            </Text>
            <Text style={styles.featureText}>
              {showHindi ? 'English और हिंदी' : 'English & Hindi'}
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Ionicons name="heart" size={28} color="#ec4899" />
            <Text style={styles.featureTitle}>
              {showHindi ? 'स्वास्थ्य सुझाव' : 'Health Tips'}
            </Text>
            <Text style={styles.featureText}>
              {showHindi ? 'व्यक्तिगत सलाह' : 'Personalized advice'}
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Ionicons name="time" size={28} color="#14b8a6" />
            <Text style={styles.featureTitle}>
              {showHindi ? 'इतिहास' : 'History'}
            </Text>
            <Text style={styles.featureText}>
              {showHindi ? 'रिपोर्ट सहेजें और तुलना करें' : 'Save & compare reports'}
            </Text>
          </View>
        </View>
      </View>

      {/* Dashboard Button */}
      <TouchableOpacity
        style={styles.dashboardButton}
        onPress={() => router.push('/dashboard')}
      >
        <View style={styles.dashboardButtonContent}>
          <View style={styles.dashboardIconContainer}>
            <Ionicons name="analytics" size={28} color="#fff" />
          </View>
          <View style={styles.dashboardTextContainer}>
            <Text style={styles.dashboardButtonTitle}>
              {showHindi ? 'स्वास्थ्य डैशबोर्ड' : 'Health Dashboard'}
            </Text>
            <Text style={styles.dashboardButtonSubtitle}>
              {showHindi ? 'ट्रैकिंग, विश्लेषण और सुझाव' : 'Tracking, Analysis & Tips'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </TouchableOpacity>

      {/* History Button */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => router.push('/history')}
      >
        <Ionicons name="folder-open" size={24} color="#6366f1" />
        <Text style={styles.historyButtonText}>
          {showHindi ? 'सहेजी गई रिपोर्ट देखें' : 'View Saved Reports'}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#6366f1" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderAnalysisResult = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.resultHeader}>
        <TouchableOpacity style={styles.backButton} onPress={resetScan}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.resultTitle}>{analyzedReport?.title}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={saveReport}>
          <Ionicons name="bookmark-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Overall Status */}
      <View style={[
        styles.statusCard,
        { backgroundColor: getStatusColor(analyzedReport?.overall_status || 'moderate') + '20' }
      ]}>
        <Ionicons
          name={getStatusIcon(analyzedReport?.overall_status || 'moderate') as any}
          size={40}
          color={getStatusColor(analyzedReport?.overall_status || 'moderate')}
        />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusLabel}>
            {showHindi ? 'समग्र स्थिति' : 'Overall Status'}
          </Text>
          <Text style={[
            styles.statusValue,
            { color: getStatusColor(analyzedReport?.overall_status || 'moderate') }
          ]}>
            {analyzedReport?.overall_status?.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>
          {showHindi ? 'सारांश' : 'Summary'}
        </Text>
        <Text style={styles.summaryText}>
          {showHindi ? analyzedReport?.hindi_summary : analyzedReport?.summary}
        </Text>
      </View>

      {/* Parameters */}
      <View style={styles.parametersSection}>
        <Text style={styles.sectionTitle}>
          {showHindi ? 'रिपोर्ट पैरामीटर' : 'Report Parameters'}
        </Text>
        
        {analyzedReport?.parameters.map((param, index) => (
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
                    size={14}
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
        
        {(showHindi ? analyzedReport?.hindi_health_tips : analyzedReport?.health_tips)?.map((tip, index) => (
          <View key={index} style={styles.tipCard}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={saveReport}>
          <Ionicons name="save" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>
            {showHindi ? 'रिपोर्ट सहेजें' : 'Save Report'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={resetScan}
        >
          <Ionicons name="scan" size={20} color="#6366f1" />
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            {showHindi ? 'नई स्कैन' : 'New Scan'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.loadingText}>
        {showHindi ? 'रिपोर्ट का विश्लेषण किया जा रहा है...' : 'Analyzing your report...'}
      </Text>
      <Text style={styles.loadingSubtext}>
        {showHindi
          ? 'यह कुछ सेकंड ले सकता है'
          : 'This may take a few seconds'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      {isAnalyzing
        ? renderLoadingState()
        : analyzedReport
        ? renderAnalysisResult()
        : renderHomeContent()}
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
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  // Language Toggle
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 4,
    marginVertical: 20,
  },
  langButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  langButtonActive: {
    backgroundColor: '#6366f1',
  },
  langText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
  langTextActive: {
    color: '#fff',
  },
  // Scan Options
  scanOptions: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  scanButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {
    flex: 1,
    marginLeft: 16,
  },
  scanButtonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  scanButtonSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  // Features
  featuresSection: {
    marginBottom: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginTop: 10,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // History Button
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  historyButtonText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    marginHorizontal: 10,
  },
  // Dashboard Button
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dashboardButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dashboardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  dashboardButtonTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  dashboardButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  // Result Screen
  resultHeader: {
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
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusTextContainer: {
    marginLeft: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 24,
  },
  // Parameters Section
  parametersSection: {
    marginBottom: 20,
  },
  parameterCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  parameterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  parameterNameContainer: {
    flex: 1,
  },
  parameterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  parameterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  parameterUnit: {
    fontSize: 14,
    color: '#9ca3af',
  },
  normalRange: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
  },
  explanation: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 22,
  },
  // Health Tips
  healthTipsSection: {
    marginBottom: 20,
  },
  healthTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 22,
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#6366f1',
  },
});
