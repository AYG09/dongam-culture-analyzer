// src/components/OrganizationAnalysisManager.tsx
// 🔥 진화적 자율 에이전트: 다중 조직 분석 관리 컴포넌트

import React, { useState, useEffect, useCallback } from 'react';
import type { 
  OrganizationAnalysis, 
  OrganizationAnalysisFilters, 
  DashboardStatistics,
  DataQualityReport,
  AnalysisComparison,
  OrganizationAnalysisManagerProps 
} from '../types/culture_extended';

/**
 * 진화적 다중 조직 분석 관리 컴포넌트
 * YAGNI 원칙에 따라 핵심 기능만 구현
 */
const OrganizationAnalysisManager: React.FC<OrganizationAnalysisManagerProps> = ({
  projectId,
  onAnalysisUpdate,
  onComparisionCreate,
  initialFilters = {},
  showAdvancedFeatures = false
}) => {
  // 🎯 상태 관리 (기술부채 최소화를 위한 단순 구조)
  const [analyses, setAnalyses] = useState<OrganizationAnalysis[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatistics | null>(null);
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);
  const [filters, setFilters] = useState<OrganizationAnalysisFilters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalyses, setSelectedAnalyses] = useState<number[]>([]);

  // 🔧 진화적 서비스 접근
  const getExtendedService = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).sqlite) {
      return (window as any).sqlite;
    }
    throw new Error('확장된 데이터베이스 서비스가 초기화되지 않았습니다.');
  }, []);

  // 📊 데이터 로드 (진화적 접근법)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const service = getExtendedService();
      
      // 조직 분석 데이터 로드
      const analysesData = service.getOrganizationAnalyses(filters);
      setAnalyses(analysesData);

      // 대시보드 통계 로드 (고급 기능 활성화 시)
      if (showAdvancedFeatures) {
        const stats = service.getDashboardStats();
        setDashboardStats(stats);

        // 데이터 품질 검사 (주기적 실행)
        const quality = service.performDataQualityCheck();
        setQualityReport(quality);
      }

      console.log('✅ 조직 분석 데이터 로드 완료:', {
        analyses: analysesData.length,
        hasStats: !!showAdvancedFeatures
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터 로드 실패';
      setError(errorMessage);
      console.error('❌ 조직 분석 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, showAdvancedFeatures, getExtendedService]);

  // 🚀 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 📝 새 조직 분석 저장
  const handleSaveAnalysis = useCallback(async (analysisData: Partial<OrganizationAnalysis>) => {
    try {
      setLoading(true);
      const service = getExtendedService();
      
      const result = await service.saveOrganizationAnalysis({
        culture_project_id: projectId,
        ...analysisData
      });
      
      if (result.success) {
        await loadData(); // 데이터 새로고침
        onAnalysisUpdate?.(analysisData as OrganizationAnalysis);
        console.log('✅ 조직 분석 저장 성공:', result.id);
      } else {
        throw new Error(result.error || '분석 저장 실패');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '분석 저장 실패';
      setError(errorMessage);
      console.error('❌ 조직 분석 저장 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, loadData, onAnalysisUpdate, getExtendedService]);

  // 🔍 비교 분석 생성
  const handleCreateComparison = useCallback(async (comparisonName: string) => {
    if (selectedAnalyses.length < 2) {
      setError('비교를 위해 최소 2개의 분석을 선택하세요.');
      return;
    }

    try {
      setLoading(true);
      const service = getExtendedService();
      
      const result = await service.saveAnalysisComparison({
        comparison_name: comparisonName,
        organization_ids: selectedAnalyses,
        created_by: 'current_user' // TODO: 실제 사용자 정보로 교체
      });
      
      if (result.success) {
        onComparisionCreate?.({
          id: result.id!,
          comparison_name: comparisonName,
          organization_ids: selectedAnalyses,
          created_at: new Date().toISOString()
        });
        setSelectedAnalyses([]);
        console.log('✅ 비교 분석 생성 성공:', result.id);
      } else {
        throw new Error(result.error || '비교 분석 생성 실패');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '비교 분석 생성 실패';
      setError(errorMessage);
      console.error('❌ 비교 분석 생성 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAnalyses, onComparisionCreate, getExtendedService]);

  // 📤 데이터 내보내기
  const handleExport = useCallback((format: 'csv' | 'json' = 'csv') => {
    try {
      const service = getExtendedService();
      const exportData = service.exportOrganizationAnalyses(format);
      
      if (exportData) {
        const blob = new Blob([exportData], { 
          type: format === 'csv' ? 'text/csv' : 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `organization_analyses_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ 데이터 내보내기 성공:', format);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터 내보내기 실패';
      setError(errorMessage);
      console.error('❌ 데이터 내보내기 실패:', err);
    }
  }, [getExtendedService]);

  // 🎨 UI 렌더링 (진화적 접근법 - 점진적 기능 추가)
  return (
    <div className="organization-analysis-manager">
      {/* 헤더 섹션 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          다중 조직 분석 관리
        </h2>
        <p className="text-gray-600">
          여러 조직의 문화 분석 결과를 체계적으로 관리하고 비교합니다.
        </p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-sm font-medium">❌ {error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">데이터 처리 중...</span>
        </div>
      )}

      {/* 대시보드 통계 (고급 기능) */}
      {showAdvancedFeatures && dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800">총 조직 수</h3>
            <p className="text-2xl font-bold text-blue-600">{dashboardStats.totalOrganizations}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-800">완료된 분석</h3>
            <p className="text-2xl font-bold text-green-600">{dashboardStats.completedAnalyses}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800">진행 중 분석</h3>
            <p className="text-2xl font-bold text-yellow-600">{dashboardStats.inProgressAnalyses}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-800">비교 분석</h3>
            <p className="text-2xl font-bold text-purple-600">{dashboardStats.totalComparisons}</p>
          </div>
        </div>
      )}

      {/* 액션 버튼 그룹 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => loadData()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          🔄 새로고침
        </button>
        
        <button
          onClick={() => handleExport('csv')}
          disabled={loading || analyses.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          📤 CSV 내보내기
        </button>
        
        <button
          onClick={() => handleExport('json')}
          disabled={loading || analyses.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          📤 JSON 내보내기
        </button>
        
        {selectedAnalyses.length >= 2 && (
          <button
            onClick={() => {
              const name = prompt('비교 분석 이름을 입력하세요:');
              if (name) handleCreateComparison(name);
            }}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            🔍 비교 분석 생성 ({selectedAnalyses.length}개 선택)
          </button>
        )}
      </div>

      {/* 데이터 품질 리포트 (고급 기능) */}
      {showAdvancedFeatures && qualityReport && qualityReport.score < 80 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-orange-800 mb-2">
            ⚠️ 데이터 품질 경고 (점수: {qualityReport.score}/100)
          </h3>
          <div className="text-sm text-orange-700">
            <p className="mb-2">발견된 문제점:</p>
            <ul className="list-disc list-inside space-y-1">
              {qualityReport.issues.slice(0, 3).map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
            {qualityReport.issues.length > 3 && (
              <p className="mt-2 text-orange-600">외 {qualityReport.issues.length - 3}개 문제점</p>
            )}
          </div>
        </div>
      )}

      {/* 조직 분석 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            조직 분석 목록 ({analyses.length}개)
          </h3>
        </div>
        
        {analyses.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>등록된 조직 분석이 없습니다.</p>
            <p className="text-sm mt-1">새로운 분석을 추가해보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAnalyses(analyses.map(a => a.id));
                        } else {
                          setSelectedAnalyses([]);
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    조직 코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    조직명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    산업분야
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    규모
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    최종 수정
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAnalyses.includes(analysis.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAnalyses(prev => [...prev, analysis.id]);
                          } else {
                            setSelectedAnalyses(prev => prev.filter(id => id !== analysis.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {analysis.organization_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {analysis.organization_name || '미설정'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {analysis.industry_type || '미분류'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {analysis.organization_size || '미설정'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        analysis.analysis_status === 'completed' ? 'bg-green-100 text-green-800' :
                        analysis.analysis_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        analysis.analysis_status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {analysis.analysis_status === 'completed' ? '완료' :
                         analysis.analysis_status === 'in_progress' ? '진행중' :
                         analysis.analysis_status === 'draft' ? '초안' : '보관'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(analysis.updated_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 푸터 정보 */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          진화적 자율 에이전트 v1.0 | 다중 조직 분석 관리 시스템
        </p>
        <p className="mt-1">
          기술부채 최소화 설계 | YAGNI 원칙 적용
        </p>
      </div>
    </div>
  );
};

export default OrganizationAnalysisManager;