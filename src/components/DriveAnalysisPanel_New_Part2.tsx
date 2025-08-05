// src/components/DriveAnalysisPanel.tsx (continued)

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

  // 메인 렌더링
  return (
    <div className="drive-analysis-panel">
      <div className="panel-header">
        <h2>🔍 Google Drive 조직문화 분석</h2>
        <p>5단계 AI 분석 파이프라인으로 체계적인 조직문화 분석</p>
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
          {/* 5단계 워크플로우 추적기 */}
          <WorkflowTracker />

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
          {workflowState.isProcessing && (
            <div className="processing-status">
              <div className="loading-spinner"></div>
              <div className="progress-text">{progressMessage}</div>
            </div>
          )}

          {/* 에러 메시지 */}
          {workflowState.error && (
            <div className="error-message">
              <div className="error-icon">❌</div>
              <div className="error-text">{workflowState.error}</div>
            </div>
          )}

          {/* 메인 콘텐츠 - 단계별 표시 */}
          {workflowState.stage === 'input' && workflowState.completedStages.size === 0 && (
            <div className="analysis-start">
              <div className="start-content">
                <h3>5단계 분석을 시작해보세요</h3>
                <p>Google Drive에서 조직문화 관련 파일을 선택하여 체계적인 AI 분석을 시작할 수 있습니다.</p>
                <ul className="workflow-benefits">
                  <li>🔍 <strong>1단계:</strong> 데이터 입력 및 검증</li>
                  <li>🧠 <strong>2단계:</strong> Gemini 1차 분석</li>
                  <li>🗺️ <strong>3단계:</strong> Claude 컬쳐맵 생성</li>
                  <li>📊 <strong>4단계:</strong> 인터랙티브 시각화</li>
                  <li>📋 <strong>5단계:</strong> 종합 분석 보고서</li>
                </ul>
                <button 
                  className="start-btn"
                  onClick={handleStartNewAnalysis}
                >
                  🚀 5단계 분석 시작하기
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

          {/* 단계별 진행 상황 표시 */}
          {workflowState.completedStages.size > 0 && workflowState.completedStages.size < 5 && (
            <div className="workflow-progress">
              <h4>📈 진행 상황</h4>
              <div className="stage-status-grid">
                {workflowState.completedStages.has('input') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>데이터 입력 완료</strong>
                      <p>{workflowState.inputData.substring(0, 100)}...</p>
                    </div>
                  </div>
                )}
                
                {workflowState.completedStages.has('gemini') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>Gemini 분석 완료</strong>
                      <p>{workflowState.geminiAnalysis.substring(0, 100)}...</p>
                    </div>
                  </div>
                )}
                
                {workflowState.completedStages.has('culturemap') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>컬쳐맵 생성 완료</strong>
                      <p>{workflowState.cultureMapText.substring(0, 100)}...</p>
                    </div>
                  </div>
                )}
                
                {workflowState.completedStages.has('visualization') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>시각화 생성 완료</strong>
                      <p>{workflowState.visualizedData.notes.length}개 노트, {workflowState.visualizedData.connections.length}개 연결</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 분석 결과 */}
          {workflowState.completedStages.has('report') && <AnalysisResults />}

          {/* 액션 버튼들 */}
          {workflowState.completedStages.has('report') && (
            <div className="analysis-actions">
              <button 
                className="download-docx-btn"
                onClick={handleDownloadDocx}
                disabled={workflowState.isProcessing}
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

          {/* 워크플로우 네비게이션 (디버깅용) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="workflow-debug">
              <h4>🛠️ 개발자 도구</h4>
              <div className="debug-buttons">
                <button onClick={() => moveToStage('input')}>➡️ 입력</button>
                <button onClick={() => moveToStage('gemini')}>➡️ Gemini</button>
                <button onClick={() => moveToStage('culturemap')}>➡️ 컬쳐맵</button>
                <button onClick={() => moveToStage('visualization')}>➡️ 시각화</button>
                <button onClick={() => moveToStage('report')}>➡️ 보고서</button>
              </div>
              <div className="debug-info">
                <p><strong>현재 단계:</strong> {workflowState.stage}</p>
                <p><strong>완료된 단계:</strong> {Array.from(workflowState.completedStages).join(', ')}</p>
                <p><strong>진행률:</strong> {workflowState.progress}%</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DriveAnalysisPanel;