// src/components/DriveAnalysisPanel.tsx

import React, { useState, useEffect } from 'react';
import type { 
  CultureProject, 
  DriveFileInfo, 
  DriveAnalysisSession, 
  FourLayerAnalysisResult,
  AnalysisWorkflowState,
  WorkflowStage,
  StageStatus
} from '../types/culture';
import { driveAnalysisService } from '../services/DriveAnalysisService';
import DriveFileSelector from './DriveFileSelector';
import './DriveAnalysisPanel.css';

interface DriveAnalysisPanelProps {
  activeProject: CultureProject | null;
  onAnalysisComplete?: (result: FourLayerAnalysisResult) => void;
}

const DriveAnalysisPanel: React.FC<DriveAnalysisPanelProps> = ({
  activeProject,
  onAnalysisComplete
}) => {
  // 5단계 워크플로우 상태 관리
  const [workflowState, setWorkflowState] = useState<AnalysisWorkflowState>({
    stage: 'input',
    inputData: '',
    geminiAnalysis: '',
    cultureMapText: '',
    visualizedData: { notes: [], connections: [] },
    finalReport: '',
    progress: 0,
    isProcessing: false,
    completedStages: new Set()
  });
  
  const [selectedFile, setSelectedFile] = useState<DriveFileInfo | null>(null);
  const [analysisSession, setAnalysisSession] = useState<DriveAnalysisSession | null>(null);
  const [analysisResults, setAnalysisResults] = useState<FourLayerAnalysisResult | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  // 단계별 상태 정의
  const getStageStatuses = (): StageStatus[] => [
    {
      id: 'input',
      label: '데이터 입력',
      description: 'Google Drive 파일 내용 입력',
      isCompleted: workflowState.completedStages.has('input'),
      isActive: workflowState.stage === 'input',
      isProcessing: workflowState.stage === 'input' && workflowState.isProcessing,
      data: workflowState.inputData
    },
    {
      id: 'gemini',
      label: 'Gemini 분석',
      description: '1차 AI 분석 수행',
      isCompleted: workflowState.completedStages.has('gemini'),
      isActive: workflowState.stage === 'gemini',
      isProcessing: workflowState.stage === 'gemini' && workflowState.isProcessing,
      data: workflowState.geminiAnalysis
    },
    {
      id: 'culturemap',
      label: '컬쳐맵 생성',
      description: 'Claude로 컬쳐맵 텍스트 생성',
      isCompleted: workflowState.completedStages.has('culturemap'),
      isActive: workflowState.stage === 'culturemap',
      isProcessing: workflowState.stage === 'culturemap' && workflowState.isProcessing,
      data: workflowState.cultureMapText
    },
    {
      id: 'visualization',
      label: '시각화',
      description: '컬쳐맵 시각화 생성',
      isCompleted: workflowState.completedStages.has('visualization'),
      isActive: workflowState.stage === 'visualization',
      isProcessing: workflowState.stage === 'visualization' && workflowState.isProcessing,
      data: workflowState.visualizedData
    },
    {
      id: 'report',
      label: '최종 분석',
      description: '종합 분석 보고서 생성',
      isCompleted: workflowState.completedStages.has('report'),
      isActive: workflowState.stage === 'report',
      isProcessing: workflowState.stage === 'report' && workflowState.isProcessing,
      data: workflowState.finalReport
    }
  ];

  // 프로젝트 선택 확인
  useEffect(() => {
    if (!activeProject) {
      setWorkflowState({
        stage: 'input',
        inputData: '',
        geminiAnalysis: '',
        cultureMapText: '',
        visualizedData: { notes: [], connections: [] },
        finalReport: '',
        progress: 0,
        isProcessing: false,
        completedStages: new Set()
      });
    }
  }, [activeProject]);
  
  // 워크플로우 단계 이동 함수
  const moveToStage = (newStage: WorkflowStage) => {
    setWorkflowState(prev => ({
      ...prev,
      stage: newStage,
      isProcessing: false,
      error: undefined
    }));
  };
  
  // 단계 완료 처리
  const completeStage = (stage: WorkflowStage, data?: any) => {
    setWorkflowState(prev => {
      const newCompletedStages = new Set(prev.completedStages);
      newCompletedStages.add(stage);
      
      const updateObject: Partial<AnalysisWorkflowState> = {
        completedStages: newCompletedStages,
        isProcessing: false,
        progress: Math.round((newCompletedStages.size / 5) * 100)
      };
      
      // 단계별 데이터 저장
      switch (stage) {
        case 'input':
          updateObject.inputData = data;
          break;
        case 'gemini':
          updateObject.geminiAnalysis = data;
          break;
        case 'culturemap':
          updateObject.cultureMapText = data;
          break;
        case 'visualization':
          updateObject.visualizedData = data;
          break;
        case 'report':
          updateObject.finalReport = data;
          break;
      }
      
      return { ...prev, ...updateObject };
    });
  };

  // 파일 내용 직접 입력 핸들러 (현실적 접근법)
  const handleFileContentSubmitted = async (fileName: string, fileContent: string) => {
    if (!activeProject) {
      setErrorMessage('프로젝트를 먼저 선택해주세요.');
      return;
    }

    if (!fileContent.trim()) {
      setErrorMessage('파일 내용을 입력해주세요.');
      return;
    }

    try {
      // 가상 파일 정보 생성
      const virtualFileInfo: DriveFileInfo = {
        id: `manual-${Date.now()}`,
        name: fileName,
        mimeType: 'text/plain',
        size: fileContent.length,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        webViewLink: '#'
      };

      setSelectedFile(virtualFileInfo);
      setShowFileSelector(false);
      setAnalysisStatus('processing');
      setCurrentStep(3); // 직접 Claude 분석으로 이동
      setErrorMessage('');

      console.log(`📁 수동 입력 파일: ${fileName} (${fileContent.length} 문자)`);

      // 분석 세션 생성
      const sessionId = await driveAnalysisService.saveAnalysisSession({
        project_id: activeProject.id,
        drive_file_id: virtualFileInfo.id,
        drive_file_name: virtualFileInfo.name,
        file_type: virtualFileInfo.mimeType,
        analysis_step: 3,
        status: 'processing'
      });

      setAnalysisSession({
        id: sessionId,
        project_id: activeProject.id,
        drive_file_id: virtualFileInfo.id,
        drive_file_name: virtualFileInfo.name,
        file_type: virtualFileInfo.mimeType,
        analysis_step: 3,
        status: 'processing',
        created_at: new Date().toISOString()
      });

      // Claude 분석 시작 (파일 내용 직접 전달)
      await startClaudeAnalysisWithContent(fileContent);

    } catch (error) {
      console.error('❌ 파일 처리 실패:', error);
      setErrorMessage('파일 처리 중 오류가 발생했습니다.');
      setAnalysisStatus('error');
    }
  };

  // Claude 분석 시작 (파일 내용 직접 전달)
  const startClaudeAnalysisWithContent = async (fileContent: string) => {
    try {
      setIsProcessing(true);
      setProgressMessage('Claude가 조직문화 분석을 수행하는 중...');

      console.log(`📄 분석 시작: ${fileContent.length} 문자`);

      // Claude 분석 수행
      const analysisResult = await driveAnalysisService.analyzeWithClaude(
        fileContent, 
        '4layer'
      );

      console.log(`🧠 Claude 분석 완료 (신뢰도: ${analysisResult.confidence_score}%)`);

      // 결과 저장
      setAnalysisResults(analysisResult);
      setAnalysisStatus('completed');
      setProgressMessage('분석이 완료되었습니다!');

      // 분석 세션 업데이트
      if (analysisSession) {
        await driveAnalysisService.saveAnalysisSession({
          ...analysisSession,
          analysis_step: 3,
          claude_analysis_result: JSON.stringify(analysisResult),
          status: 'completed'
        });
      }

      // 완료 콜백 호출
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult);
      }

    } catch (error) {
      console.error('❌ Claude 분석 실패:', error);
      setErrorMessage('Claude 분석 중 오류가 발생했습니다.');
      setAnalysisStatus('error');
      setProgressMessage('');
    } finally {
      setIsProcessing(false);
    }
  };

  // 새로운 분석 시작
  const handleStartNewAnalysis = () => {
    setCurrentStep(1);
    setAnalysisStatus('file_selection');
    setSelectedFile(null);
    setAnalysisSession(null);
    setAnalysisResults(null);
    setErrorMessage('');
    setProgressMessage('');
    setShowFileSelector(true);
  };

  // DOCX 보고서 다운로드
  const handleDownloadDocx = async () => {
    if (!analysisResults) {
      setErrorMessage('다운로드할 분석 결과가 없습니다.');
      return;
    }

    try {
      setIsProcessing(true);
      setProgressMessage('학술적 보고서를 생성하는 중...');
      
      // 파일명 생성 (프로젝트명 + 날짜)
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const projectName = activeProject?.name || '조직문화분석';
      const fileName = `${projectName}_분석보고서_${timestamp}.docx`;
      
      console.log(`📄 DOCX 다운로드 시작: ${fileName}`);
      
      // DOCX 생성 및 다운로드
      await driveAnalysisService.generateAndDownloadDocx(analysisResults, fileName);
      
      setProgressMessage('보고서 다운로드가 완료되었습니다!');
      
      // 3초 후 메시지 제거
      setTimeout(() => {
        setProgressMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('❌ DOCX 다운로드 실패:', error);
      setErrorMessage('DOCX 보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 파일 선택 취소
  const handleCancelFileSelection = () => {
    setShowFileSelector(false);
    setAnalysisStatus('idle');
  };

  // 분석 단계 표시 컴포넌트
  const AnalysisStepTracker = () => (
    <div className="analysis-step-tracker">
      <div className="step-header">
        <h3>3단계 AI 분석 파이프라인</h3>
        <p>NotebookLM → Gemini Advanced → Claude</p>
      </div>
      
      <div className="steps-container">
        <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-icon">1</div>
          <div className="step-info">
            <div className="step-title">파일 선택</div>
            <div className="step-desc">Google Drive에서 분석할 파일 선택</div>
          </div>
        </div>

        <div className="step-divider"></div>

        <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-icon">2</div>
          <div className="step-info">
            <div className="step-title">파일 내용 입력</div>
            <div className="step-desc">Google Drive 파일 내용을 직접 복사하여 입력</div>
          </div>
        </div>

        <div className="step-divider"></div>

        <div className={`step-item ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
          <div className="step-icon">3</div>
          <div className="step-info">
            <div className="step-title">Claude 분석</div>
            <div className="step-desc">Dave Gray-Schein 4층위 분석 수행</div>
          </div>
        </div>
      </div>
    </div>
  );

  // 분석 결과 표시 컴포넌트
  const AnalysisResults = () => {
    if (!analysisResults) return null;

    return (
      <div className="analysis-results">
        <div className="results-header">
          <h3>📊 조직문화 분석 결과</h3>
          <div className="confidence-score">
            신뢰도: <span className="score">{analysisResults.confidence_score}%</span>
          </div>
        </div>

        <div className="results-grid">
          <div className="result-section">
            <h4>🏛️ Layer 1: 유물/가시적 요소</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>가시적 요소:</strong> {analysisResults.artifacts.visible_elements.join(', ')}
              </div>
              <div className="result-category">
                <strong>상징:</strong> {analysisResults.artifacts.symbols.join(', ')}
              </div>
              <div className="result-category">
                <strong>의식:</strong> {analysisResults.artifacts.rituals.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>👥 Layer 2: 행동 패턴</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>패턴:</strong> {analysisResults.behaviors.patterns.join(', ')}
              </div>
              <div className="result-category">
                <strong>상호작용:</strong> {analysisResults.behaviors.interactions.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>💎 Layer 3: 규범/가치</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>명시된 가치:</strong> {analysisResults.norms_values.stated_values.join(', ')}
              </div>
              <div className="result-category">
                <strong>암묵적 규범:</strong> {analysisResults.norms_values.implicit_norms.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>🧠 Layer 4: 기본 가정</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>기본 가정:</strong> {analysisResults.assumptions.basic_assumptions.join(', ')}
              </div>
              <div className="result-category">
                <strong>정신 모델:</strong> {analysisResults.assumptions.mental_models.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section insights">
            <h4>💡 핵심 인사이트</h4>
            <div className="insight-grid">
              <div className="insight-item">
                <strong>패턴:</strong> {analysisResults.insights.patterns.join(', ')}
              </div>
              <div className="insight-item">
                <strong>기회:</strong> {analysisResults.insights.opportunities.join(', ')}
              </div>
              <div className="insight-item">
                <strong>권고사항:</strong> {analysisResults.insights.recommendations.join(', ')}
              </div>
            </div>
          </div>
        </div>

        <div className="academic-references">
          <h4>📚 학술적 참고문헌</h4>
          <ul>
            {analysisResults.academic_references.map((ref, index) => (
              <li key={index}>{ref}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="drive-analysis-panel">
      <div className="panel-header">
        <h2>🔍 Google Drive 조직문화 분석</h2>
        <p>Google Drive의 파일을 활용한 지능형 조직문화 분석</p>
      </div>

      {/* 프로젝트 확인 */}
      {!activeProject ? (
        <div className="no-project-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>프로젝트를 먼저 선택해주세요</h3>
            <p>Google Drive 분석을 시작하려면 활성 프로젝트가 필요합니다.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 분석 단계 추적기 */}
          <AnalysisStepTracker />

          {/* 현재 선택된 파일 정보 */}
          {selectedFile && (
            <div className="selected-file-info">
              <h4>📁 선택된 파일</h4>
              <div className="file-card">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-type">{selectedFile.mimeType}</span>
              </div>
            </div>
          )}

          {/* 진행 상황 표시 */}
          {isProcessing && (
            <div className="processing-status">
              <div className="loading-spinner"></div>
              <div className="progress-text">{progressMessage}</div>
            </div>
          )}

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="error-message">
              <div className="error-icon">❌</div>
              <div className="error-text">{errorMessage}</div>
            </div>
          )}

          {/* 메인 콘텐츠 */}
          {analysisStatus === 'idle' && (
            <div className="analysis-start">
              <div className="start-content">
                <h3>분석을 시작해보세요</h3>
                <p>Google Drive에서 조직문화 관련 파일을 선택하여 AI 분석을 시작할 수 있습니다.</p>
                <button 
                  className="start-btn"
                  onClick={handleStartNewAnalysis}
                >
                  🚀 분석 시작하기
                </button>
              </div>
            </div>
          )}

          {/* 파일 선택기 */}
          {showFileSelector && (
            <div className="file-selector-container">
              <DriveFileSelector
                onFileContentSubmitted={handleFileContentSubmitted}
                onCancel={handleCancelFileSelection}
              />
            </div>
          )}

          {/* 분석 결과 */}
          {analysisStatus === 'completed' && <AnalysisResults />}

          {/* 새로운 분석 버튼 */}
          {analysisStatus === 'completed' && (
            <div className="analysis-actions">
            <button 
            className="download-docx-btn"
            onClick={handleDownloadDocx}
              disabled={isProcessing}
            >
              📄 DOCX 보고서 다운로드
              </button>
          <button 
            className="new-analysis-btn"
            onClick={handleStartNewAnalysis}
          >
            🔄 새로운 분석 시작
          </button>
        </div>
          )}
        </>
      )}
    </div>
  );
};

export default DriveAnalysisPanel;
