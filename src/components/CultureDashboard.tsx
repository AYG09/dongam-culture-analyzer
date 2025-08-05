// src/components/CultureDashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import type { DashboardState, CultureProject } from '../types/culture';
import { cultureStateService } from '../services/CultureStateService';
import { databaseService } from '../services/DatabaseService';
import ProjectCard from './ProjectCard';
import ProjectCreator from './ProjectCreator';
import ProgressChart from './ProgressChart';
// InsightsPanel 제거됨 - 실제 가치가 없는 껍데기 기능
import ProjectFileManager from './ProjectFileManager';
import './CultureDashboard.css';

interface CultureDashboardProps {
  onSelectProject?: (project: CultureProject) => void;
}

// 로딩 상태 세분화
type LoadingState = 'INITIALIZING' | 'LOADING' | 'LOADED' | 'ERROR' | 'TIMEOUT';

// 대시보드 탭 타입 - 단순화: projects, files만 유지
type DashboardTab = 'projects' | 'files';

const CultureDashboard: React.FC<CultureDashboardProps> = ({ onSelectProject }) => {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    projects: [],
    activeProject: null,
    systemStatus: 'idle',
    lastUpdate: new Date().toISOString(),
  });
  
  const [loadingState, setLoadingState] = useState<LoadingState>('INITIALIZING');
  const [activeTab, setActiveTab] = useState<DashboardTab>('projects');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  
  // 프로젝트 삭제 상태 관리
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // 최대 재시도 횟수 및 타임아웃 설정
  const MAX_RETRIES = 3;
  const LOADING_TIMEOUT = 30000; // 30초

  // 데이터베이스 초기화 상태 확인 (재시도 로직 포함)
  const checkDatabaseInitialization = useCallback(async (): Promise<boolean> => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // DatabaseService 초기화 상태 확인
        const dbStatus = databaseService.getInitializationStatus();
        
        if (dbStatus.status === 'success') {
          console.log('✅ 데이터베이스 초기화 완료');
          return true;
        } else if (dbStatus.status === 'loading') {
          console.log('⏳ 데이터베이스 초기화 진행 중... 대기 중');
          // 로딩 중일 때 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        } else if (dbStatus.status === 'error') {
          console.error('❌ 데이터베이스 초기화 실패:', dbStatus.error);
          if (retryCount < maxRetries - 1) {
            console.log(`🔄 재시도 ${retryCount + 1}/${maxRetries}`);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw new Error(`데이터베이스 초기화 실패: ${dbStatus.error?.message}`);
        }
        
        // 초기화 시도
        console.log('🔄 데이터베이스 초기화 시도...');
        const initialized = await databaseService.initialize();
        if (initialized) {
          console.log('✅ 데이터베이스 초기화 성공');
          return true;
        } else {
          throw new Error('데이터베이스 초기화에 실패했습니다.');
        }
      } catch (error) {
        console.error('💥 데이터베이스 초기화 체크 실패:', error);
        if (retryCount < maxRetries - 1) {
          console.log(`🔄 재시도 ${retryCount + 1}/${maxRetries}`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    
    throw new Error('데이터베이스 초기화 최대 재시도 횟수 초과');
  }, []);

  // 대시보드 데이터 로드 (개선된 버전)
  const loadDashboardData = useCallback(async (showLoadingIndicator = true) => {
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      if (showLoadingIndicator) {
        setLoadingState('LOADING');
      }
      setErrorMessage('');
      
      // 로딩 타임아웃 설정
      timeoutId = setTimeout(() => {
        setLoadingState('TIMEOUT');
        setErrorMessage('데이터 로드 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.');
      }, LOADING_TIMEOUT);

      // 데이터베이스 초기화 확인
      const isInitialized = await checkDatabaseInitialization();
      if (!isInitialized) {
        throw new Error('데이터베이스가 초기화되지 않았습니다.');
      }

      // 대시보드 데이터 로드
      console.log('📊 대시보드 데이터 로드 시작');
      const state = await cultureStateService.getDashboardState();
      
      // 서비스 상태 확인
      const serviceStatus = cultureStateService.getServiceStatus();
      if (serviceStatus.lastError) {
        console.warn('⚠️ 서비스 에러 발생:', serviceStatus.lastError);
        setErrorMessage(`데이터 로드 중 문제가 발생했습니다: ${serviceStatus.lastError.message}`);
      }

      // 타임아웃 해제
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      setDashboardState(state);
      setLoadingState('LOADED');
      setRetryCount(0);
      setLastLoadTime(Date.now());
      
      console.log('✅ 대시보드 데이터 로드 완료', {
        loadTime: Date.now() - startTime,
        projectCount: state.projects.length
      });

    } catch (error) {
      console.error('❌ 대시보드 데이터 로드 실패:', error);
      
      // 타임아웃 해제
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      setLoadingState('ERROR');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : '알 수 없는 오류가 발생했습니다.'
      );
      
      // 폴백 데이터 설정
      setDashboardState(prev => ({
        ...prev,
        systemStatus: 'error',
        lastUpdate: new Date().toISOString(),
      }));
    }
  }, [checkDatabaseInitialization]);



  // 탭 변경 핸들러
  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    console.log(`🔄 탭 전환: ${tab}`);
  }, []);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      console.log(`🔄 재시도 ${retryCount + 1}/${MAX_RETRIES}`);
      loadDashboardData(true);
    } else {
      setErrorMessage('최대 재시도 횟수에 도달했습니다. 페이지를 새로고침해주세요.');
    }
  }, [retryCount, loadDashboardData]);

  // 수동 새로고침 핸들러
  const handleManualRefresh = useCallback(() => {
    setRetryCount(0);
    setRefreshKey(prev => prev + 1);
    loadDashboardData(true);
  }, [loadDashboardData]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    let mounted = true;
    let initializationTimeout: NodeJS.Timeout | null = null;

    const initializeDashboard = async () => {
      if (!mounted) return;
      
      try {
        setLoadingState('INITIALIZING');
        
        // 초기화 타임아웃 설정 (60초)
        initializationTimeout = setTimeout(() => {
          if (mounted) {
            setLoadingState('TIMEOUT');
            setErrorMessage('시스템 초기화 시간이 초과되었습니다. 페이지를 새로고침해주세요.');
          }
        }, 60000);
        
        // 초기화 지연 (DatabaseService 초기화 대기)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (mounted) {
          await loadDashboardData(true);
        }
        
        // 초기화 성공 시 타임아웃 해제
        if (initializationTimeout) {
          clearTimeout(initializationTimeout);
          initializationTimeout = null;
        }
      } catch (error) {
        console.error('💥 대시보드 초기화 실패:', error);
        if (mounted) {
          setLoadingState('ERROR');
          setErrorMessage(
            error instanceof Error 
              ? error.message 
              : '대시보드 초기화 중 오류가 발생했습니다.'
          );
        }
        
        // 에러 시 타임아웃 해제
        if (initializationTimeout) {
          clearTimeout(initializationTimeout);
          initializationTimeout = null;
        }
      }
    };

    initializeDashboard();

    return () => {
      mounted = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
    };
  }, [refreshKey, loadDashboardData]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      // 폼이 열려있거나 사용자가 입력 중이거나 에러 상태일 때는 자동 새로고침 안함
      if (
        loadingState === 'LOADED' && 
        !showCreateForm && 
        !isEditing &&
        dashboardState.systemStatus !== 'processing'
      ) {
        loadDashboardData(false); // 로딩 인디케이터 없이 백그라운드 새로고침
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadingState, showCreateForm, isEditing, dashboardState.systemStatus, loadDashboardData]);

  // 프로젝트 생성 완료 핸들러
  const handleProjectCreated = (project: CultureProject) => {
    setShowCreateForm(false);
    setRefreshKey(prev => prev + 1); // 데이터 새로고침
    if (onSelectProject) {
      onSelectProject(project);
    }
  };

  // 프로젝트 선택 핸들러
  const handleProjectSelect = (project: CultureProject) => {
    setDashboardState(prev => ({ ...prev, activeProject: project }));
    if (onSelectProject) {
      onSelectProject(project);
    }
  };

  // 프로젝트 삭제 핸들러 (개선된 버전 - 로딩 상태 및 피드백 추가)
  const handleProjectDelete = async (projectId: string) => {
    console.log('🗑️ CultureDashboard: 프로젝트 삭제 요청 받음:', projectId);
    
    // 이미 삭제 중인 경우 방지
    if (isDeletingProject) {
      console.log('🚫 이미 다른 프로젝트 삭제 중...');
      return;
    }
    
    // 사용자 확인 대화상자
    if (!window.confirm('정말로 이 프로젝트를 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.')) {
      console.log('🚫 프로젝트 삭제 취소됨');
      return;
    }

    // 삭제 상태 시작
    setIsDeletingProject(true);
    setDeletingProjectId(projectId);
    
    try {
      console.log('🔄 CultureStateService.deleteProject 호출 중...');
      const success = await cultureStateService.deleteProject(projectId);
      
      if (success) {
        console.log('✅ 프로젝트 삭제 성공, UI 업데이트 시작');
        
        // 데이터 새로고침
        setRefreshKey(prev => prev + 1);
        
        // 활성 프로젝트가 삭제된 경우 상태 리셋
        if (dashboardState.activeProject?.id === projectId) {
          console.log('🔄 활성 프로젝트 상태 리셋');
          setDashboardState(prev => ({ 
            ...prev, 
            activeProject: null
          }));
        }
        
        // 성공 피드백
        alert('✅ 프로젝트가 성공적으로 삭제되었습니다!');
        console.log('🎉 프로젝트 삭제 및 UI 업데이트 완료');
      } else {
        console.error('❌ CultureStateService.deleteProject 실패');
        alert('❌ 프로젝트 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('💥 프로젝트 삭제 중 예외 발생:', error);
      alert(`❌ 프로젝트 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      // 삭제 상태 종료
      setIsDeletingProject(false);
      setDeletingProjectId(null);
    }
  };

  // 로딩 상태별 UI 렌더링
  const renderLoadingState = () => {
    switch (loadingState) {
      case 'INITIALIZING':
        return (
          <div className="culture-dashboard loading">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>시스템을 초기화하고 있습니다...</p>
              <small>데이터베이스 연결을 확인하는 중입니다.</small>
            </div>
          </div>
        );

      case 'LOADING':
        return (
          <div className="culture-dashboard loading">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>대시보드 데이터를 로드하고 있습니다...</p>
              <small>잠시만 기다려주세요.</small>
            </div>
          </div>
        );

      case 'TIMEOUT':
        return (
          <div className="culture-dashboard error">
            <div className="error-content">
              <h2>⏰ 로딩 시간 초과</h2>
              <p>데이터 로드 시간이 초과되었습니다.</p>
              <p className="error-message">{errorMessage}</p>
              <div className="error-actions">
                <button onClick={handleRetry} className="retry-btn">
                  다시 시도
                </button>
                <button onClick={handleManualRefresh} className="refresh-btn">
                  새로고침
                </button>
              </div>
            </div>
          </div>
        );

      case 'ERROR':
        return (
          <div className="culture-dashboard error">
            <div className="error-content">
              <h2>⚠️ 데이터 로드 실패</h2>
              <p>대시보드 데이터를 불러오는 중 문제가 발생했습니다.</p>
              <p className="error-message">{errorMessage}</p>
              <div className="error-details">
                <p>재시도 횟수: {retryCount}/{MAX_RETRIES}</p>
                <p>마지막 시도: {lastLoadTime ? new Date(lastLoadTime).toLocaleString('ko-KR') : '없음'}</p>
              </div>
              <div className="error-actions">
                {retryCount < MAX_RETRIES ? (
                  <button onClick={handleRetry} className="retry-btn">
                    다시 시도 ({retryCount + 1}/{MAX_RETRIES})
                  </button>
                ) : (
                  <button onClick={() => window.location.reload()} className="reload-btn">
                    페이지 새로고침
                  </button>
                )}
                <button onClick={handleManualRefresh} className="refresh-btn">
                  수동 새로고침
                </button>
              </div>
              <details className="error-guide">
                <summary>문제 해결 가이드</summary>
                <ul>
                  <li>네트워크 연결 상태를 확인해주세요.</li>
                  <li>브라우저를 새로고침해주세요.</li>
                  <li>다른 브라우저에서 시도해주세요.</li>
                  <li>문제가 계속되면 시스템 관리자에게 문의하세요.</li>
                </ul>
              </details>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 로딩 상태일 때 로딩 UI 표시
  if (loadingState !== 'LOADED') {
    return renderLoadingState();
  }

  return (
    <div className="culture-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>조직문화 분석 대시보드</h1>
          <div className="header-actions">
            <button 
              className="refresh-btn"
              onClick={handleManualRefresh}
              disabled={loadingState === 'LOADING' || isDeletingProject}
            >
              🔄 새로고침
            </button>
            <button 
              className="create-project-btn"
              onClick={() => setShowCreateForm(true)}
              disabled={isDeletingProject}
            >
              + 새 프로젝트
            </button>
          </div>
        </div>
        <div className="status-bar">
          <span className={`status-indicator ${dashboardState.systemStatus}`}>
            {dashboardState.systemStatus === 'idle' && '🟢 시스템 정상'}
            {dashboardState.systemStatus === 'processing' && '🟡 분석 진행 중'}
            {dashboardState.systemStatus === 'error' && '🔴 시스템 오류'}
          </span>
          <span className="last-update">
            마지막 업데이트: {new Date(dashboardState.lastUpdate).toLocaleString('ko-KR')}
          </span>
          {errorMessage && (
            <span className="error-indicator">
              ⚠️ {errorMessage}
            </span>
          )}
          {isDeletingProject && (
            <span className="deleting-indicator">
              🗑️ 프로젝트 삭제 중...
            </span>
          )}
        </div>
      </header>

      <main className="dashboard-content">
        {/* 프로젝트 생성 폼 */}
        {showCreateForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <ProjectCreator 
                onProjectCreated={handleProjectCreated}
                onCancel={() => setShowCreateForm(false)}
                onEditingChange={setIsEditing}
              />
            </div>
          </div>
        )}

        {/* 대시보드 탭 - 단순화: projects, files 만 */}
        <div className="dashboard-tabs">
          <button 
            className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => handleTabChange('projects')}
            disabled={isDeletingProject}
          >
            📁 프로젝트
          </button>
          <button 
            className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => handleTabChange('files')}
            disabled={isDeletingProject || !dashboardState.activeProject}
            title={!dashboardState.activeProject ? '프로젝트를 먼저 선택하세요' : ''}
          >
            📂 파일 관리
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="tab-content">
          {/* 프로젝트 탭 */}
          {activeTab === 'projects' && (
            <div className="projects-tab">
              <section className="projects-section">
                <h2>프로젝트 목록 ({dashboardState.projects.length}개)</h2>
                {dashboardState.projects.length === 0 ? (
                  <div className="empty-state">
                    <p>아직 생성된 프로젝트가 없습니다.</p>
                    <button 
                      className="create-first-project-btn"
                      onClick={() => setShowCreateForm(true)}
                      disabled={isDeletingProject}
                    >
                      첫 번째 프로젝트 생성하기
                    </button>
                  </div>
                ) : (
                  <div className="projects-grid">
                    {dashboardState.projects.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isActive={dashboardState.activeProject?.id === project.id}
                        onSelect={handleProjectSelect}
                        onDelete={handleProjectDelete}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 파일 관리 탭 - ProjectFileManager 통합 */}
          {activeTab === 'files' && (
            <div className="files-tab">
              {dashboardState.activeProject ? (
                <>
                  <div className="files-tab-header">
                    <h2>🗂️ {dashboardState.activeProject.name} - 파일 관리</h2>
                    <p className="project-info">
                      조직: {dashboardState.activeProject.organization} | 
                      상태: <span className={`status-badge ${dashboardState.activeProject.status}`}>
                        {dashboardState.activeProject.status === 'active' ? '진행 중' : '완료'}
                      </span>
                    </p>
                  </div>
                  <ProjectFileManager 
                    projectId={dashboardState.activeProject.id}
                    onFileUploaded={(file) => {
                      console.log('파일 업로드 완료:', file);
                      // 필요시 대시보드 상태 업데이트
                    }}
                    onFileDeleted={(fileId) => {
                      console.log('파일 삭제 완료:', fileId);
                      // 필요시 대시보드 상태 업데이트
                    }}
                  />
                </>
              ) : (
                <div className="no-project-selected">
                  <div className="empty-icon">📁</div>
                  <h3>프로젝트를 선택하세요</h3>
                  <p>파일을 관리하려면 먼저 프로젝트를 선택해주세요.</p>
                  <button 
                    className="select-project-btn"
                    onClick={() => handleTabChange('projects')}
                  >
                    📁 프로젝트 탭으로 이동
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CultureDashboard;