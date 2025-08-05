// src/components/ManualInputSection.tsx
import React, { useState, useRef } from 'react';
import type { DriveFileInfo, BatchAnalysisResult, FileProcessingStatus } from '../types/culture';
import './ManualInputSection.css';

// 업로드된 파일 데이터 타입
interface FileData {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'reading' | 'ready' | 'error';
  content?: string;
  error?: string;
  progress: number;
}

// 다중 파일 분석 결과 타입
interface MultiFileAnalysisData {
  files: FileData[];
  totalSize: number;
  analysisTitle: string;
  isReady: boolean;
}

interface ManualInputSectionProps {
  onContentSubmitted: (content: string, title: string) => void;
  onMultiFileSubmitted?: (analysisData: MultiFileAnalysisData) => void;
  onCancel: () => void;
}

const ManualInputSection: React.FC<ManualInputSectionProps> = ({
  onContentSubmitted,
  onMultiFileSubmitted,
  onCancel
}) => {
  // 기본 상태 (단일 파일 모드)
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 다중 파일 모드 상태
  const [isMultiFileMode, setIsMultiFileMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  
  // 제한 사항
  const MIN_CONTENT_LENGTH = 100;
  const MAX_FILES = 20;
  const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB
  const MAX_INDIVIDUAL_SIZE = 10 * 1024 * 1024; // 10MB
  
  // 지원 파일 형식 확장
  const supportedFileTypes = {
    text: ['.txt', '.md', '.json', '.csv'],
    audio: ['.m4a', '.mp3', '.wav'],
    presentation: ['.pptx', '.ppt'],
    document: ['.pdf', '.docx'],
    all: ['.txt', '.md', '.json', '.csv', '.m4a', '.mp3', '.wav', '.pptx', '.ppt', '.pdf', '.docx']
  };
  
  const supportedMimeTypes = [
    'text/plain', 'text/markdown', 'application/json', 'text/csv',
    'audio/mp4', 'audio/mpeg', 'audio/wav',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // 파일 읽기 함수 (확장된 버전)
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('파일을 텍스트로 읽을 수 없습니다.'));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
      reader.readAsText(file, 'utf-8');
    });
  };
  
  // 파일 타입 확인 함수
  const isFileTypeSupported = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    // 파일 확장자 확인
    const hasValidExtension = supportedFileTypes.all.some(ext => 
      fileName.endsWith(ext.toLowerCase())
    );
    
    // MIME 타입 확인
    const hasValidMimeType = supportedMimeTypes.includes(mimeType) || 
                            mimeType.startsWith('text/');
    
    return hasValidExtension || hasValidMimeType;
  };
  
  // 파일 타입 아이콘 가져오기
  const getFileTypeIcon = (file: File): string => {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    if (mimeType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      return '📄';
    }
    if (mimeType.startsWith('audio/') || fileName.endsWith('.m4a') || fileName.endsWith('.mp3')) {
      return '🎤';
    }
    if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      return '📊';
    }
    if (fileName.endsWith('.pdf')) {
      return '📄';
    }
    if (fileName.endsWith('.json')) {
      return '📁';
    }
    return '📁'; // 기본 아이콘
  };
  
  // 파일 대소 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  // UUID 생성
  const generateUUID = (): string => {
    return 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  };

  // 다중 파일 처리 로직
  const addFilesToQueue = async (files: File[]) => {
    if (!isMultiFileMode) {
      console.warn('다중 파일 모드가 아닙니다.');
      return;
    }
    
    // 현재 파일 수 + 새 파일 수 확인
    if (uploadedFiles.length + files.length > MAX_FILES) {
      alert(`최대 ${MAX_FILES}개 파일까지 업로드 가능합니다.\n현재: ${uploadedFiles.length}개, 추가: ${files.length}개`);
      return;
    }
    
    const validFiles: FileData[] = [];
    const errors: string[] = [];
    
    for (const file of files) {
      // 파일 타입 확인
      if (!isFileTypeSupported(file)) {
        errors.push(`${file.name}: 지원하지 않는 파일 형식`);
        continue;
      }
      
      // 파일 크기 확인
      if (file.size > MAX_INDIVIDUAL_SIZE) {
        errors.push(`${file.name}: 파일 크기가 너무 틼 (${formatFileSize(file.size)} > ${formatFileSize(MAX_INDIVIDUAL_SIZE)})`);
        continue;
      }
      
      // 중복 파일 확인
      const isDuplicate = uploadedFiles.some(existingFile => 
        existingFile.name === file.name && existingFile.size === file.size
      );
      
      if (isDuplicate) {
        errors.push(`${file.name}: 이미 업로드된 파일`);
        continue;
      }
      
      validFiles.push({
        id: generateUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0
      });
    }
    
    // 전체 크기 확인
    const currentTotalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    const newTotalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
    
    if (currentTotalSize + newTotalSize > MAX_TOTAL_SIZE) {
      alert(`전체 파일 크기가 제한을 초과합니다.\n현재: ${formatFileSize(currentTotalSize)}, 추가: ${formatFileSize(newTotalSize)}, 제한: ${formatFileSize(MAX_TOTAL_SIZE)}`);
      return;
    }
    
    // 오류 메시지 표시
    if (errors.length > 0) {
      console.warn('파일 업로드 오류:', errors);
      alert('일부 파일이 업로드되지 않았습니다:\n' + errors.join('\n'));
    }
    
    if (validFiles.length === 0) {
      return;
    }
    
    // 유효한 파일들을 리스트에 추가
    setUploadedFiles(prev => [...prev, ...validFiles]);
    
    // 파일 내용 비동기 읽기 시작
    processFilesContent(validFiles);
  };
  
  // 파일 내용 비동기 처리
  const processFilesContent = async (filesToProcess: FileData[]) => {
    setIsProcessingFiles(true);
    
    const processingPromises = filesToProcess.map(async (fileData) => {
      try {
        // 상태 업데이트: 읽기 시작
        updateFileStatus(fileData.id, { status: 'reading', progress: 10 });
        
        // 텍스트 파일인 경우만 직접 읽기
        if (fileData.file.type.startsWith('text/') || 
            fileData.name.endsWith('.txt') || 
            fileData.name.endsWith('.md') ||
            fileData.name.endsWith('.json') ||
            fileData.name.endsWith('.csv')) {
          
          const content = await readFileContent(fileData.file);
          
          updateFileStatus(fileData.id, { 
            status: 'ready', 
            progress: 100, 
            content 
          });
        } else {
          // 비텍스트 파일은 전처리 필요 메시지
          updateFileStatus(fileData.id, { 
            status: 'ready', 
            progress: 100, 
            content: `[비텍스트 파일: ${fileData.name}]\n\n이 파일은 분석 시 자동으로 처리됩니다.\n파일 타입: ${fileData.type}\n파일 크기: ${formatFileSize(fileData.size)}`
          });
        }
        
      } catch (error) {
        console.error(`파일 처리 오류: ${fileData.name}`, error);
        updateFileStatus(fileData.id, { 
          status: 'error', 
          progress: 0, 
          error: error instanceof Error ? error.message : '알 수 없는 오류' 
        });
      }
    });
    
    await Promise.allSettled(processingPromises);
    setIsProcessingFiles(false);
  };
  
  // 파일 상태 업데이트
  const updateFileStatus = (fileId: string, updates: Partial<FileData>) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, ...updates } : file
      )
    );
  };
  
  // 파일 제거
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };
  
  // 파일 재시도
  const retryFile = (fileId: string) => {
    const fileData = uploadedFiles.find(f => f.id === fileId);
    if (fileData && fileData.status === 'error') {
      processFilesContent([fileData]);
    }
  };
  
  // 모드 전환
  const toggleMode = (multiMode: boolean) => {
    setIsMultiFileMode(multiMode);
    if (!multiMode) {
      // 단일 모드로 전환시 다중 파일 데이터 초기화
      setUploadedFiles([]);
      setOverallProgress(0);
      setIsProcessingFiles(false);
    } else {
      // 다중 모드로 전환시 단일 파일 데이터 초기화
      setContent('');
      setTitle('');
    }
  };

  // 기존 단일 파일 업로드 처리 (단일 모드용)
  const handleFileUpload = async (file: File) => {
    // 지원하는 파일 형식 확인
    const supportedTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const isTextType = file.type.startsWith('text/') || 
                      file.name.endsWith('.txt') || 
                      file.name.endsWith('.md') ||
                      file.name.endsWith('.json');

    if (!isTextType && !supportedTypes.includes(file.type)) {
      alert('지원하지 않는 파일 형식입니다.\n지원 형식: .txt, .md, .json, .csv 파일');
      return;
    }

    // 파일 크기 확인 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('파일이 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다.');
      return;
    }

    try {
      const fileContent = await readFileContent(file);
      
      if (fileContent.length < MIN_CONTENT_LENGTH) {
        alert(`파일 내용이 너무 짧습니다.\n의미있는 분석을 위해 최소 ${MIN_CONTENT_LENGTH}자 이상의 내용이 필요합니다.`);
        return;
      }

      setContent(fileContent);
      setTitle(title || file.name.replace(/\.[^/.]+$/, ''));
      
    } catch (error) {
      console.error('파일 읽기 오류:', error);
      alert('파일을 읽는 중 오류가 발생했습니다. 다른 파일을 시도해보세요.');
    }
  };

  // 드래그 앤 드롭 이벤트 핸들러 (업데이트된 버전)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    
    if (isMultiFileMode) {
      // 다중 파일 모드: 모든 파일 처리
      if (files.length > 0) {
        addFilesToQueue(files);
      }
    } else {
      // 단일 파일 모드: 첫 번째 파일만 처리
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    }
  };

  // 파일 선택 버튼 클릭
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // 파일 입력 변경
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (isMultiFileMode) {
        addFilesToQueue(Array.from(files));
      } else {
        handleFileUpload(files[0]);
      }
    }
    // 입력 초기화 (동일 파일 재선택 가능)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 제출 처리 (단일/다중 모드 지원)
  const handleSubmit = () => {
    if (isMultiFileMode) {
      // 다중 파일 모드 제출
      if (uploadedFiles.length === 0) {
        alert('분석할 파일을 업로드해주세요.');
        return;
      }
      
      const readyFiles = uploadedFiles.filter(f => f.status === 'ready');
      const errorFiles = uploadedFiles.filter(f => f.status === 'error');
      const processingFiles = uploadedFiles.filter(f => f.status === 'reading' || f.status === 'pending');
      
      if (readyFiles.length === 0) {
        alert('처리 완료된 파일이 없습니다. 파일 상태를 확인해주세요.');
        return;
      }
      
      if (processingFiles.length > 0) {
        alert(`아직 처리 중인 파일이 있습니다. 잠시 후 다시 시도해주세요.\n처리 중: ${processingFiles.length}개`);
        return;
      }
      
      if (!title.trim()) {
        // 제목이 없으면 자동 생성
        const defaultTitle = `다중 파일 분석 (${readyFiles.length}개 파일)`;
        setTitle(defaultTitle);
      }
      
      const analysisData: MultiFileAnalysisData = {
        files: readyFiles,
        totalSize: readyFiles.reduce((sum, f) => sum + f.size, 0),
        analysisTitle: title || `다중 파일 분석 (${readyFiles.length}개 파일)`,
        isReady: true
      };
      
      // 에러 파일이 있으면 사용자에게 확인
      if (errorFiles.length > 0) {
        const confirmMsg = `오류가 발생한 파일 ${errorFiles.length}개를 제외하고 ${readyFiles.length}개 파일로 분석을 진행하시겠습니까?`;
        if (!confirm(confirmMsg)) {
          return;
        }
      }
      
      // 다중 파일 분석 시작
      if (onMultiFileSubmitted) {
        onMultiFileSubmitted(analysisData);
      } else {
        console.warn('다중 파일 제출 핸들러가 설정되지 않았습니다.');
        alert('다중 파일 분석 기능이 활성화되지 않았습니다.');
      }
      
    } else {
      // 단일 파일 모드 제출 (기존 로직)
      if (!content.trim()) {
        alert('분석할 내용을 입력해주세요.');
        return;
      }

      if (content.length < MIN_CONTENT_LENGTH) {
        alert(`내용이 너무 짧습니다.\n의미있는 분석을 위해 최소 ${MIN_CONTENT_LENGTH}자 이상 입력해주세요.`);
        return;
      }

      if (!title.trim()) {
        alert('분석 제목을 입력해주세요.');
        return;
      }

      onContentSubmitted(content, title);
    }
  };

  // 예시 텍스트들
  const exampleTexts = [
    {
      title: "팀 회의록 예시",
      content: `# 주간 팀 회의록 (2025.01.20)

## 참석자
- 팀장: 김철수
- 팀원: 이영희, 박민수, 최지영

## 주요 안건
1. 프로젝트 진행 상황 점검
2. 의사소통 개선 방안 논의
3. 워크로드 배분 조정

## 논의 내용
### 프로젝트 진행 상황
- 일정 지연으로 인한 압박감 증가
- 역할 분담이 명확하지 않아 중복 업무 발생
- 의사결정 속도가 느려 진행에 차질

### 의사소통 이슈
- 중요한 정보가 제때 공유되지 않음
- 피드백 과정에서 감정적 갈등 발생
- 상급자 보고 시 과도한 긴장감

## 개선 방안
1. 주간 체크인 미팅 도입
2. 역할 및 책임 매트릭스 작성
3. 피드백 가이드라인 수립`
    },
    {
      title: "직원 인터뷰 예시", 
      content: `# 조직문화 진단 인터뷰 (직원 A)

## 질문: 우리 조직의 의사결정 과정을 어떻게 평가하시나요?

"솔직히 말하면... 너무 복잡해요. 작은 일도 여러 단계를 거쳐야 하고, 승인받는 데만 며칠이 걸려요. 그러다 보니 급한 일도 늦어지고, 기회를 놓치는 경우가 많아요.

그리고 윗선에서 결정이 내려오면 '왜 그런 결정을 했는지' 설명이 부족해요. 그냥 '그렇게 하라'고 하니까... 동기부여가 잘 안 되죠."

## 질문: 팀원들과의 협업은 어떤가요?

"팀원들끼리는 잘 지내요. 서로 도와주려고 하고... 하지만 부서 간 협업이 문제예요. 각자 자기 부서 일만 챙기려고 하고, 정보 공유도 잘 안 돼요.

특히 마감이 다가오면 분위기가 살벌해져요. 다들 스트레스받고 예민해지고... 그럴 때는 소통이 더 어려워져요."

## 질문: 조직에서 가장 변화가 필요한 부분은?

"투명성이요. 회사가 어떤 방향으로 가는지, 우리 팀의 역할이 뭔지 명확하지 않아요. 그러다 보니 일에 대한 의미를 못 느끼겠어요.

그리고 실패를 너무 부정적으로 봐요. 실수하면 비난받을까 봐 새로운 시도를 못 하겠어요. 안전하게만 가려고 하니까 혁신이 일어날 수가 없죠."`
    }
  ];

  return (
    <div className="manual-input-section">
      <div className="manual-input-header">
        <h3>📝 수동 텍스트 분석</h3>
        <p>인터뷰 내용, 회의록, 설문 답변 등을 직접 입력하거나 파일로 업로드하여 분석할 수 있습니다.</p>
      </div>

      <div className="input-options">
        <div className="option-tabs">
          <div 
            className={`tab ${!isMultiFileMode ? 'active' : ''}`}
            onClick={() => toggleMode(false)}
          >
            ✍️ 단일 입력
          </div>
          <div 
            className={`tab ${isMultiFileMode ? 'active' : ''}`}
            onClick={() => toggleMode(true)}
          >
            📁 다중 파일
          </div>
        </div>

        <div className="input-content">
          {/* 제목 입력 */}
          <div className="title-input-group">
            <label htmlFor="analysis-title">분석 제목</label>
            <input
              id="analysis-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMultiFileMode ? 
                "예: 2025년 1분기 다중 데이터 분석" : 
                "예: 2025년 1분기 팀 문화 진단"}
              className="title-input"
            />
          </div>

          {!isMultiFileMode ? (
            // 단일 파일 모드 UI
            <>
              {/* 텍스트 입력 영역 */}
              <div className="content-input-group">
                <label htmlFor="content-textarea">분석할 내용</label>
                <div className="textarea-container">
                  <textarea
                    id="content-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`조직문화 분석할 내용을 입력해주세요...\n\n예시:\n- 팀 회의록\n- 직원 인터뷰 내용\n- 설문조사 응답\n- 조직 내 이슈 상황\n- 피드백 내용\n\n최소 ${MIN_CONTENT_LENGTH}자 이상 입력해주세요.`}
                    rows={15}
                    className="content-textarea"
                  />
                  <div className="character-count">
                    <span className={content.length < MIN_CONTENT_LENGTH ? 'insufficient' : 'sufficient'}>
                      {content.length.toLocaleString()}자
                    </span>
                    <span className="minimum">
                      (최소 {MIN_CONTENT_LENGTH.toLocaleString()}자)
                    </span>
                  </div>
                </div>
              </div>

              {/* 파일 업로드 영역 */}
              <div className={`file-upload-area ${dragActive ? 'drag-active' : ''}`}
                   onDragEnter={handleDragEnter}
                   onDragLeave={handleDragLeave}
                   onDragOver={handleDragOver}
                   onDrop={handleDrop}>
                <div className="upload-content">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <p><strong>파일을 드래그하거나 클릭하여 업로드</strong></p>
                    <p>지원 형식: .txt, .md, .json, .csv (최대 10MB)</p>
                  </div>
                  <button 
                    type="button"
                    className="upload-button"
                    onClick={handleFileButtonClick}
                  >
                    파일 선택
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.json,.csv,text/*"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* 예시 텍스트 */}
              <div className="example-texts">
                <h4>💡 예시 텍스트</h4>
                <div className="example-grid">
                  {exampleTexts.map((example, index) => (
                    <div key={index} className="example-card">
                      <h5>{example.title}</h5>
                      <button
                        className="load-example-btn"
                        onClick={() => {
                          setContent(example.content);
                          setTitle(example.title);
                        }}
                      >
                        불러오기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // 다중 파일 모드 UI
            <>
              {/* 다중 파일 업로드 영역 */}
              <div className={`multi-file-upload-area ${dragActive ? 'drag-active' : ''}`}
                   onDragEnter={handleDragEnter}
                   onDragLeave={handleDragLeave}
                   onDragOver={handleDragOver}
                   onDrop={handleDrop}>
                <div className="upload-content">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <p><strong>다중 파일을 드래그하거나 클릭하여 업로드</strong></p>
                    <p>지원 형식: .txt, .md, .json, .csv, .m4a, .mp3, .pptx, .pdf (개별 10MB, 전체 200MB)</p>
                    <p>최대 {MAX_FILES}개 파일 동시 처리 가능</p>
                  </div>
                  <button 
                    type="button"
                    className="upload-button"
                    onClick={handleFileButtonClick}
                  >
                    파일 선택
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={supportedFileTypes.all.join(',')}
                    multiple
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* 업로드된 파일 리스트 */}
              {uploadedFiles.length > 0 && (
                <div className="uploaded-files-section">
                  <div className="files-header">
                    <h4>업로드된 파일 ({uploadedFiles.length}/{MAX_FILES})</h4>
                    <div className="total-info">
                      <span>전체 크기: {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                      {isProcessingFiles && <span className="processing">처리 중...</span>}
                    </div>
                  </div>
                  
                  <div className="files-list">
                    {uploadedFiles.map((fileData) => (
                      <div key={fileData.id} className={`file-item ${fileData.status}`}>
                        <div className="file-info">
                          <span className="file-icon">{getFileTypeIcon(fileData.file)}</span>
                          <div className="file-details">
                            <div className="file-name">{fileData.name}</div>
                            <div className="file-meta">
                              {formatFileSize(fileData.size)} • {fileData.type}
                            </div>
                          </div>
                        </div>
                        
                        <div className="file-status">
                          {fileData.status === 'pending' && (
                            <span className="status-badge pending">대기 중</span>
                          )}
                          {fileData.status === 'reading' && (
                            <span className="status-badge reading">읽는 중...</span>
                          )}
                          {fileData.status === 'ready' && (
                            <span className="status-badge ready">준비 완료</span>
                          )}
                          {fileData.status === 'error' && (
                            <span className="status-badge error">오류</span>
                          )}
                        </div>
                        
                        <div className="file-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ width: `${fileData.progress}%` }}
                            ></div>
                          </div>
                          <span className="progress-text">{fileData.progress}%</span>
                        </div>
                        
                        <div className="file-actions">
                          {fileData.status === 'error' && (
                            <button 
                              className="retry-btn"
                              onClick={() => retryFile(fileData.id)}
                              title="다시 시도"
                            >
                              🔄
                            </button>
                          )}
                          <button 
                            className="remove-btn"
                            onClick={() => removeFile(fileData.id)}
                            title="제거"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 에러 파일 요약 */}
                  {uploadedFiles.some(f => f.status === 'error') && (
                    <div className="error-summary">
                      <h5>오류 파일</h5>
                      {uploadedFiles
                        .filter(f => f.status === 'error')
                        .map(f => (
                          <div key={f.id} className="error-item">
                            <span>{f.name}</span>
                            <span className="error-msg">{f.error}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 액션 버튼 */}
          <div className="action-buttons">
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={
                isMultiFileMode 
                  ? uploadedFiles.filter(f => f.status === 'ready').length === 0 || isProcessingFiles
                  : !content.trim() || content.length < MIN_CONTENT_LENGTH || !title.trim()
              }
            >
              🚀 분석 시작
              {isMultiFileMode && uploadedFiles.length > 0 && (
                <span className="file-count">({uploadedFiles.filter(f => f.status === 'ready').length}개 파일)</span>
              )}
            </button>
            <button
              className="cancel-btn"
              onClick={onCancel}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualInputSection;