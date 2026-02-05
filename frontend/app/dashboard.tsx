import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface HealthInsight {
  type: 'concern' | 'improvement' | 'stable';
  parameter: string;
  message: string;
  hindiMessage: string;
  trend: 'up' | 'down' | 'stable';
  severity: 'low' | 'medium' | 'high';
}

interface ParameterTrend {
  name: string;
  values: { value: number; date: string }[];
  currentStatus: string;
  trend: 'improving' | 'worsening' | 'stable';
}

export default function DashboardScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHindi, setShowHindi] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'insights'>('overview');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/reports`);
      setReports(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  // Calculate health score based on all reports
  const healthScore = useMemo(() => {
    if (reports.length === 0) return 0;
    
    let totalScore = 0;
    let paramCount = 0;
    
    reports.forEach(report => {
      report.report_data.parameters?.forEach(param => {
        paramCount++;
        switch (param.status?.toLowerCase()) {
          case 'normal':
          case 'good':
            totalScore += 100;
            break;
          case 'low':
          case 'moderate':
            totalScore += 60;
            break;
          case 'high':
          case 'concerning':
            totalScore += 30;
            break;
          case 'critical':
            totalScore += 10;
            break;
          default:
            totalScore += 50;
        }
      });
    });
    
    return paramCount > 0 ? Math.round(totalScore / paramCount) : 0;
  }, [reports]);

  // Get parameter trends across reports
  const parameterTrends = useMemo((): ParameterTrend[] => {
    if (reports.length < 1) return [];
    
    const paramMap: { [key: string]: { values: { value: number; date: string; status: string }[] } } = {};
    
    // Sort reports by date (oldest first)
    const sortedReports = [...reports].sort((a, b) => 
      new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime()
    );
    
    sortedReports.forEach(report => {
      const date = new Date(report.saved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      report.report_data.parameters?.forEach(param => {
        const numValue = parseFloat(param.value);
        if (!isNaN(numValue)) {
          if (!paramMap[param.name]) {
            paramMap[param.name] = { values: [] };
          }
          paramMap[param.name].values.push({ value: numValue, date, status: param.status });
        }
      });
    });
    
    return Object.entries(paramMap)
      .filter(([_, data]) => data.values.length >= 1)
      .map(([name, data]) => {
        const values = data.values;
        const lastStatus = values[values.length - 1]?.status || 'normal';
        
        let trend: 'improving' | 'worsening' | 'stable' = 'stable';
        if (values.length >= 2) {
          const first = values[0].value;
          const last = values[values.length - 1].value;
          const change = ((last - first) / first) * 100;
          
          if (Math.abs(change) < 5) trend = 'stable';
          else if (lastStatus === 'normal' || lastStatus === 'good') trend = 'improving';
          else trend = 'worsening';
        }
        
        return {
          name,
          values: values.map(v => ({ value: v.value, date: v.date })),
          currentStatus: lastStatus,
          trend
        };
      })
      .slice(0, 6);
  }, [reports]);

  // Generate health insights
  const healthInsights = useMemo((): HealthInsight[] => {
    const insights: HealthInsight[] = [];
    
    if (reports.length === 0) return insights;
    
    // Get latest report
    const latestReport = reports[0];
    
    // Analyze each parameter for concerns
    latestReport.report_data.parameters?.forEach(param => {
      const status = param.status?.toLowerCase();
      
      if (status === 'high' || status === 'critical' || status === 'concerning') {
        insights.push({
          type: 'concern',
          parameter: param.name,
          message: `${param.name} is ${status}. ${param.explanation}`,
          hindiMessage: param.hindi_explanation || `${param.name} ${status} है`,
          trend: 'up',
          severity: status === 'critical' ? 'high' : 'medium'
        });
      } else if (status === 'low') {
        insights.push({
          type: 'concern',
          parameter: param.name,
          message: `${param.name} is below normal range. ${param.explanation}`,
          hindiMessage: param.hindi_explanation || `${param.name} सामान्य से कम है`,
          trend: 'down',
          severity: 'medium'
        });
      }
    });
    
    // Add improvement insights based on trends
    parameterTrends.forEach(trend => {
      if (trend.trend === 'improving' && trend.values.length >= 2) {
        insights.push({
          type: 'improvement',
          parameter: trend.name,
          message: `${trend.name} is showing improvement over time`,
          hindiMessage: `${trend.name} में समय के साथ सुधार हो रहा है`,
          trend: 'up',
          severity: 'low'
        });
      }
    });
    
    // Add stable parameters
    const normalParams = latestReport.report_data.parameters?.filter(
      p => p.status?.toLowerCase() === 'normal' || p.status?.toLowerCase() === 'good'
    );
    
    if (normalParams && normalParams.length > 0) {
      insights.push({
        type: 'stable',
        parameter: 'Multiple Parameters',
        message: `${normalParams.length} parameters are within normal range`,
        hindiMessage: `${normalParams.length} पैरामीटर सामान्य सीमा में हैं`,
        trend: 'stable',
        severity: 'low'
      });
    }
    
    return insights;
  }, [reports, parameterTrends]);

  // Helper functions for tips
  const getIconForTip = (tip: string): string => {
    const lowerTip = tip.toLowerCase();
    if (lowerTip.includes('water') || lowerTip.includes('hydrat')) return 'water';
    if (lowerTip.includes('sleep') || lowerTip.includes('rest')) return 'moon';
    if (lowerTip.includes('exercise') || lowerTip.includes('walk') || lowerTip.includes('physical')) return 'fitness';
    if (lowerTip.includes('eat') || lowerTip.includes('diet') || lowerTip.includes('food')) return 'nutrition';
    if (lowerTip.includes('stress') || lowerTip.includes('relax')) return 'leaf';
    return 'bulb';
  };

  const getCategoryForTip = (tip: string): string => {
    const lowerTip = tip.toLowerCase();
    if (lowerTip.includes('water') || lowerTip.includes('hydrat')) return 'Hydration';
    if (lowerTip.includes('sleep') || lowerTip.includes('rest')) return 'Sleep';
    if (lowerTip.includes('exercise') || lowerTip.includes('walk')) return 'Exercise';
    if (lowerTip.includes('eat') || lowerTip.includes('diet') || lowerTip.includes('food')) return 'Nutrition';
    return 'General';
  };

  // Get improvement tips
  const improvementTips = useMemo(() => {
    const tips: { tip: string; hindiTip: string; icon: string; category: string }[] = [];
    
    if (reports.length === 0) {
      return [
        { tip: 'Scan your first medical report to get personalized tips', hindiTip: 'व्यक्तिगत सुझाव पाने के लिए अपनी पहली मेडिकल रिपोर्ट स्कैन करें', icon: 'scan', category: 'general' }
      ];
    }
    
    const latestReport = reports[0];
    
    // Add tips from the latest report
    latestReport.report_data.health_tips?.forEach((tip, index) => {
      const hindiTip = latestReport.report_data.hindi_health_tips?.[index] || tip;
      tips.push({
        tip,
        hindiTip,
        icon: getIconForTip(tip),
        category: getCategoryForTip(tip)
      });
    });
    
    // Add generic health tips if needed
    if (tips.length < 3) {
      tips.push(
        { tip: 'Stay hydrated - drink at least 8 glasses of water daily', hindiTip: 'हाइड्रेटेड रहें - रोजाना कम से कम 8 गिलास पानी पिएं', icon: 'water', category: 'hydration' },
        { tip: 'Get 7-8 hours of quality sleep each night', hindiTip: 'हर रात 7-8 घंटे की अच्छी नींद लें', icon: 'moon', category: 'sleep' },
        { tip: 'Exercise for at least 30 minutes daily', hindiTip: 'रोजाना कम से कम 30 मिनट व्यायाम करें', icon: 'fitness', category: 'exercise' }
      );
    }
    
    return tips.slice(0, 5);
  }, [reports, getIconForTip, getCategoryForTip]);

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    if (reports.length === 0) return [];
    
    let normal = 0, concerning = 0, critical = 0;
    
    reports.forEach(report => {
      report.report_data.parameters?.forEach(param => {
        const status = param.status?.toLowerCase();
        if (status === 'normal' || status === 'good') normal++;
        else if (status === 'low' || status === 'moderate' || status === 'high' || status === 'concerning') concerning++;
        else if (status === 'critical') critical++;
      });
    });
    
    const data = [];
    if (normal > 0) data.push({ value: normal, color: '#22c55e', text: `${normal}`, label: 'Normal' });
    if (concerning > 0) data.push({ value: concerning, color: '#f59e0b', text: `${concerning}`, label: 'Attention' });
    if (critical > 0) data.push({ value: critical, color: '#ef4444', text: `${critical}`, label: 'Critical' });
    
    return data;
  }, [reports]);

  const renderOverview = () => (
    <View>
      {/* Health Score Card */}
      <View style={styles.healthScoreCard}>
        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreNumber, { color: getScoreColor(healthScore) }]}>
            {healthScore}
          </Text>
          <Text style={styles.scoreLabel}>
            {showHindi ? 'स्वास्थ्य स्कोर' : 'Health Score'}
          </Text>
        </View>
        <View style={styles.scoreInfo}>
          <Text style={styles.scoreTitle}>
            {healthScore >= 80 
              ? (showHindi ? 'उत्कृष्ट स्वास्थ्य' : 'Excellent Health')
              : healthScore >= 60
              ? (showHindi ? 'अच्छा स्वास्थ्य' : 'Good Health')
              : (showHindi ? 'ध्यान आवश्यक' : 'Needs Attention')}
          </Text>
          <Text style={styles.scoreSubtitle}>
            {showHindi 
              ? `${reports.length} रिपोर्ट के आधार पर`
              : `Based on ${reports.length} report${reports.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={24} color="#6366f1" />
          <Text style={styles.statNumber}>{reports.length}</Text>
          <Text style={styles.statLabel}>{showHindi ? 'कुल रिपोर्ट' : 'Total Reports'}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={24} color="#f59e0b" />
          <Text style={styles.statNumber}>
            {healthInsights.filter(i => i.type === 'concern').length}
          </Text>
          <Text style={styles.statLabel}>{showHindi ? 'चिंताएं' : 'Concerns'}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#22c55e" />
          <Text style={styles.statNumber}>
            {healthInsights.filter(i => i.type === 'improvement').length}
          </Text>
          <Text style={styles.statLabel}>{showHindi ? 'सुधार' : 'Improving'}</Text>
        </View>
      </View>

      {/* Status Distribution */}
      {statusDistribution.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {showHindi ? 'पैरामीटर वितरण' : 'Parameter Distribution'}
          </Text>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={statusDistribution}
              donut
              radius={70}
              innerRadius={45}
              centerLabelComponent={() => (
                <View style={styles.pieCenter}>
                  <Text style={styles.pieCenterText}>
                    {statusDistribution.reduce((acc, d) => acc + d.value, 0)}
                  </Text>
                  <Text style={styles.pieCenterLabel}>
                    {showHindi ? 'कुल' : 'Total'}
                  </Text>
                </View>
              )}
            />
            <View style={styles.pieLegend}>
              {statusDistribution.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.label}: {item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Recent Concerns */}
      {healthInsights.filter(i => i.type === 'concern').length > 0 && (
        <View style={styles.concernsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={22} color="#f59e0b" />
            <Text style={styles.sectionTitle}>
              {showHindi ? 'शीघ्र पहचान - चिंताएं' : 'Early Detection - Concerns'}
            </Text>
          </View>
          {healthInsights.filter(i => i.type === 'concern').slice(0, 3).map((insight, index) => (
            <View key={index} style={styles.concernItem}>
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(insight.severity) + '20' }]}>
                <Ionicons
                  name={insight.trend === 'up' ? 'arrow-up' : insight.trend === 'down' ? 'arrow-down' : 'remove'}
                  size={16}
                  color={getSeverityColor(insight.severity)}
                />
              </View>
              <View style={styles.concernText}>
                <Text style={styles.concernParam}>{insight.parameter}</Text>
                <Text style={styles.concernMessage}>
                  {showHindi ? insight.hindiMessage : insight.message}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderTrends = () => (
    <View>
      {parameterTrends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={60} color="#4b5563" />
          <Text style={styles.emptyTitle}>
            {showHindi ? 'कोई ट्रेंड नहीं' : 'No Trends Yet'}
          </Text>
          <Text style={styles.emptyText}>
            {showHindi 
              ? 'ट्रेंड देखने के लिए अधिक रिपोर्ट स्कैन करें'
              : 'Scan more reports to see trends over time'}
          </Text>
        </View>
      ) : (
        parameterTrends.map((trend, index) => (
          <View key={index} style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.trendName}>{trend.name}</Text>
                <View style={styles.trendBadge}>
                  <Ionicons
                    name={trend.trend === 'improving' ? 'trending-up' : trend.trend === 'worsening' ? 'trending-down' : 'remove'}
                    size={14}
                    color={trend.trend === 'improving' ? '#22c55e' : trend.trend === 'worsening' ? '#ef4444' : '#6b7280'}
                  />
                  <Text style={[
                    styles.trendBadgeText,
                    { color: trend.trend === 'improving' ? '#22c55e' : trend.trend === 'worsening' ? '#ef4444' : '#6b7280' }
                  ]}>
                    {trend.trend === 'improving' 
                      ? (showHindi ? 'सुधार' : 'Improving')
                      : trend.trend === 'worsening'
                      ? (showHindi ? 'गिरावट' : 'Worsening')
                      : (showHindi ? 'स्थिर' : 'Stable')}
                  </Text>
                </View>
              </View>
              <View style={[styles.currentStatus, { backgroundColor: getStatusColor(trend.currentStatus) + '20' }]}>
                <Text style={[styles.currentStatusText, { color: getStatusColor(trend.currentStatus) }]}>
                  {trend.values[trend.values.length - 1]?.value}
                </Text>
              </View>
            </View>
            {trend.values.length > 1 && (
              <View style={styles.miniChart}>
                <LineChart
                  data={trend.values.map(v => ({ value: v.value, label: v.date }))}
                  width={SCREEN_WIDTH - 100}
                  height={100}
                  color="#6366f1"
                  thickness={2}
                  hideDataPoints={trend.values.length > 5}
                  dataPointsColor="#6366f1"
                  xAxisColor="#374151"
                  yAxisColor="#374151"
                  xAxisLabelTextStyle={{ color: '#9ca3af', fontSize: 10 }}
                  yAxisTextStyle={{ color: '#9ca3af', fontSize: 10 }}
                  hideRules
                  curved
                  areaChart
                  startFillColor="rgba(99, 102, 241, 0.3)"
                  endFillColor="rgba(99, 102, 241, 0.01)"
                />
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderInsights = () => (
    <View>
      {/* Improvement Tips */}
      <View style={styles.tipsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb" size={22} color="#f59e0b" />
          <Text style={styles.sectionTitle}>
            {showHindi ? 'सुधार के सुझाव' : 'Tips to Improve'}
          </Text>
        </View>
        {improvementTips.map((item, index) => (
          <View key={index} style={styles.tipCard}>
            <View style={styles.tipIconContainer}>
              <Ionicons
                name={item.icon as any}
                size={24}
                color="#6366f1"
              />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipCategory}>{item.category}</Text>
              <Text style={styles.tipText}>
                {showHindi ? item.hindiTip : item.tip}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* All Insights */}
      <View style={styles.insightsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="eye" size={22} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>
            {showHindi ? 'सभी जानकारी' : 'All Insights'}
          </Text>
        </View>
        {healthInsights.length === 0 ? (
          <View style={styles.emptyInsights}>
            <Text style={styles.emptyInsightsText}>
              {showHindi 
                ? 'जानकारी के लिए रिपोर्ट स्कैन करें'
                : 'Scan reports to get health insights'}
            </Text>
          </View>
        ) : (
          healthInsights.map((insight, index) => (
            <View key={index} style={[
              styles.insightCard,
              { borderLeftColor: insight.type === 'concern' ? '#ef4444' : insight.type === 'improvement' ? '#22c55e' : '#6366f1' }
            ]}>
              <View style={styles.insightHeader}>
                <Ionicons
                  name={insight.type === 'concern' ? 'alert-circle' : insight.type === 'improvement' ? 'trending-up' : 'checkmark-circle'}
                  size={20}
                  color={insight.type === 'concern' ? '#ef4444' : insight.type === 'improvement' ? '#22c55e' : '#6366f1'}
                />
                <Text style={styles.insightParam}>{insight.parameter}</Text>
              </View>
              <Text style={styles.insightMessage}>
                {showHindi ? insight.hindiMessage : insight.message}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            {showHindi ? 'डैशबोर्ड लोड हो रहा है...' : 'Loading dashboard...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {showHindi ? 'स्वास्थ्य डैशबोर्ड' : 'Health Dashboard'}
          </Text>
          <TouchableOpacity
            style={styles.langToggleSmall}
            onPress={() => setShowHindi(!showHindi)}
          >
            <Text style={styles.langToggleText}>{showHindi ? 'EN' : 'हि'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'overview' && styles.tabActive]}
            onPress={() => setSelectedTab('overview')}
          >
            <Ionicons 
              name="grid" 
              size={18} 
              color={selectedTab === 'overview' ? '#fff' : '#9ca3af'} 
            />
            <Text style={[styles.tabText, selectedTab === 'overview' && styles.tabTextActive]}>
              {showHindi ? 'अवलोकन' : 'Overview'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'trends' && styles.tabActive]}
            onPress={() => setSelectedTab('trends')}
          >
            <Ionicons 
              name="trending-up" 
              size={18} 
              color={selectedTab === 'trends' ? '#fff' : '#9ca3af'} 
            />
            <Text style={[styles.tabText, selectedTab === 'trends' && styles.tabTextActive]}>
              {showHindi ? 'ट्रेंड्स' : 'Trends'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'insights' && styles.tabActive]}
            onPress={() => setSelectedTab('insights')}
          >
            <Ionicons 
              name="bulb" 
              size={18} 
              color={selectedTab === 'insights' ? '#fff' : '#9ca3af'} 
            />
            <Text style={[styles.tabText, selectedTab === 'insights' && styles.tabTextActive]}>
              {showHindi ? 'सुझाव' : 'Insights'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'trends' && renderTrends()}
        {selectedTab === 'insights' && renderInsights()}

        {/* Scan More CTA */}
        <TouchableOpacity
          style={styles.scanMoreButton}
          onPress={() => router.push('/')}
        >
          <Ionicons name="scan" size={20} color="#fff" />
          <Text style={styles.scanMoreText}>
            {showHindi ? 'नई रिपोर्ट स्कैन करें' : 'Scan New Report'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  // Header
  header: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  langToggleSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Tab Navigation
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  // Health Score Card
  healthScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e3f',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  scoreInfo: {
    flex: 1,
    marginLeft: 20,
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e1e3f',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  // Chart Card
  chartCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pieCenter: {
    alignItems: 'center',
  },
  pieCenterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  pieCenterLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  pieLegend: {
    marginLeft: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#d1d5db',
  },
  // Concerns Card
  concernsCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  concernItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  severityBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  concernText: {
    flex: 1,
  },
  concernParam: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  concernMessage: {
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 18,
  },
  // Trends
  trendCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  currentStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  miniChart: {
    marginTop: 8,
    marginLeft: -10,
  },
  // Tips Section
  tipsSection: {
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e3f',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  tipIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipCategory: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tipText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  // Insights Section
  insightsSection: {
    marginBottom: 20,
  },
  emptyInsights: {
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyInsightsText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  insightCard: {
    backgroundColor: '#1e1e3f',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  insightParam: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  insightMessage: {
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 18,
    marginLeft: 28,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Scan More Button
  scanMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginTop: 10,
  },
  scanMoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
