// src/components/ProjectFileManager.tsx

import React, { useState, useEffect, useRef } from 'react';
import { cultureStateService } from '../services/CultureStateService';
import './ProjectFileManager.css';

interface ProjectFile {
  id: number;
  project_id: number;
  file_type: 'culture_map' | 'analysis_report' | 'culture_json' | 'other';
  file_name: string;
  file_content: string; // Base64 encoded
  file_size: number;
  mime_type?: string;
  metadata?: string; // JSON string
  created_at: string;
  updated_at: string;
}

interface ProjectFileManagerProps {
  projectId: string | number;
  onFileUploaded?: (file: ProjectFile) => void;
  onFileDeleted?: (fileId: number) => void;
}

const ProjectFileManager: React.FC<ProjectFileManagerProps> = ({
  projectId,
  onFileUploaded,
  onFileDeleted
}) => {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadCancellable, setUploadCancellable] = useState(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 지원하는 파일 타입
  const SUPPORTED_TYPES = {
    'image/png': 'culture_map',
    'image/jpeg': 'culture_map', 
    'image/jpg': 'culture_map',
    'application/json': 'culture_json',
    'text/json': 'culture_json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'analysis_report',
    'application/msword': 'analysis_report',
    'text/plain': 'other',
    'application/pdf': 'analysis_report'
  } as const;

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_RETRY_ATTEMPTS = 3;
  const CHUNK_SIZE = 1024 * 1024; // 1MB 청크
  const MEMORY_CHECK_THRESHOLD = 50 * 1024 * 1024; // 50MB

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  /**
   * 대량 파일 업로드 취소
   */
  const cancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort();
      setUploadAbortController(null);
      setUploading(false);
      setUploadCancellable(false);
      setUploadProgress('');
      setRetryCount(0);
      console.log('🚑 사용자가 파일 업로드를 취소했습니다.');
    }
  };

  /**
   * 메모리 사용량 및 브라우저 성능 검사
   */
  const checkSystemResources = (): { canProceed: boolean; warning?: string } => {
    try {
      // 메모리 사용량 추정 (performance.memory API 사용 가능한 경우)
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usedMemory = memInfo.usedJSHeapSize;
        const totalMemory = memInfo.totalJSHeapSize;
        const memoryLimit = memInfo.jsHeapSizeLimit;
        
        console.log('📊 메모리 상태:', {
          used: `${(usedMemory / 1024 / 1024).toFixed(2)}MB`,
          total: `${(totalMemory / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(memoryLimit / 1024 / 1024).toFixed(2)}MB`,
          usage: `${((usedMemory / memoryLimit) * 100).toFixed(1)}%`
        });
        
        // 메모리 사용률이 80% 이상이면 경고
        if (usedMemory / memoryLimit > 0.8) {
          return {
            canProceed: false,
            warning: '브라우저 메모리 사용률이 높습니다. 다른 탭을 닫거나 브라우저를 재시작해주세요.'
          };
        }
        
        // 예상 파일 크기가 남은 메모리의 50%를 초과하는 경우
        const availableMemory = memoryLimit - usedMemory;
        if (MEMORY_CHECK_THRESHOLD > availableMemory * 0.5) {
          return {
            canProceed: true,
            warning: '대용량 파일 업로드로 브라우저가 느려질 수 있습니다.'
          };
        }
      }
      
      return { canProceed: true };
    } catch (error) {
      console.warn('⚠️ 메모리 검사 실패:', error);
      return { canProceed: true }; // 검사 실패 시 업로드 허용
    }
  };

  /**
   * 파일 업로드 사전 검증 강화
   */
  const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
    try {
      console.log('🔍 파일 검증 시작:', file.name);
      
      // 1. 파일 타입 검증
      const fileType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
      if (!fileType) {
        return {
          isValid: false,
          error: `지원하지 않는 파일 형식입니다: ${file.type || '알 수 없음'}\n지원 형식: PNG, JPG, JSON, Word, PDF`
        };
      }
      
      // 2. 파일 크기 검증
      if (file.size > MAX_FILE_SIZE) {
        return {
          isValid: false,
          error: `파일 크기가 제한을 초과합니다.\n현재: ${(file.size / 1024 / 1024).toFixed(2)}MB\n최대: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        };
      }
      
      // 3. 파일명 검증
      if (!file.name || file.name.trim().length === 0) {
        return {
          isValid: false,
          error: '올바른 파일명이 필요합니다.'
        };
      }
      
      // 4. 파일명 길이 및 특수문자 검증
      if (file.name.length > 255) {
        return {
          isValid: false,
          error: '파일명이 너무 깁니다. (255자 이하)'
        };
      }
      
      const invalidChars = /[<>:"|?*\\]/;
      if (invalidChars.test(file.name)) {
        return {
          isValid: false,
          error: '파일레에 올바르지 않은 문자가 포함되어 있습니다. (< > : " | ? * \\\ 사용 불가)'
        };
      }
      
      // 5. 빈 파일 검사
      if (file.size === 0) {
        return {
          isValid: false,
          error: '빈 파일은 업로드할 수 없습니다.'
        };
      }
      
      console.log('✅ 파일 검증 통과:', {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        mappedType: fileType
      });
      
      return { isValid: true };
      
    } catch (error) {
      console.error('❌ 파일 검증 중 오류:', error);
      return {
        isValid: false,
        error: '파일 검증 중 오류가 발생했습니다.'
      };
    }
  };

  /**
   * 파일 목록 로드
   */
  const loadFiles = async () => {
    try {
      const loadedFiles = await cultureStateService.getProjectFiles(projectId);
      setFiles(loadedFiles);
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
      setError('파일 목록을 불러오는데 실패했습니다.');
    }
  };

  /**
   * 파일을 Base64로 인코딩 (청크 기반 메모리 효율성 개선)
   */
  const fileToBase64 = (file: File, abortSignal?: AbortSignal): Promise<string> => {
    return new Promise((resolve, reject) => {
      // AbortSignal 검사
      if (abortSignal?.aborted) {
        reject(new Error('업로드가 취소되었습니다.'));
        return;
      }
      
      console.log('🔄 Base64 인코딩 시작:', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        chunkSize: `${CHUNK_SIZE / 1024}KB`
      });
      
      // 작은 파일 (1MB 미만)은 기존 방식 사용
      if (file.size < CHUNK_SIZE) {
        const reader = new FileReader();
        
        reader.onload = () => {
          if (abortSignal?.aborted) {
            reject(new Error('업로드가 취소되었습니다.'));
            return;
          }
          
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          console.log('✅ 소용량 파일 Base64 인코딩 완료');
          resolve(base64);
        };
        
        reader.onerror = () => {
          const error = new Error(`파일 읽기 실패: ${reader.error?.message || '알 수 없는 오류'}`);
          console.error('❌ FileReader 오류:', error);
          reject(error);
        };
        
        reader.readAsDataURL(file);
        return;
      }
      
      // 대용량 파일은 청크 단위로 처리
      const chunks: string[] = [];
      let offset = 0;
      const chunkCount = Math.ceil(file.size / CHUNK_SIZE);
      
      const processChunk = () => {
        if (abortSignal?.aborted) {
          reject(new Error('업로드가 취소되었습니다.'));
          return;
        }
        
        if (offset >= file.size) {
          // 모든 청크 처리 완료
          const fullBase64 = chunks.join('');
          console.log('✅ 대용량 파일 청크 기반 Base64 인코딩 완료:', {
            totalChunks: chunkCount,
            finalSize: `${(fullBase64.length / 1024 / 1024).toFixed(2)}MB`
          });
          resolve(fullBase64);
          return;
        }
        
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();
        
        reader.onload = () => {
          if (abortSignal?.aborted) {
            reject(new Error('업로드가 취소되었습니다.'));
            return;
          }
          
          const result = reader.result as string;
          const base64Chunk = result.split(',')[1];
          chunks.push(base64Chunk);
          
          offset += CHUNK_SIZE;
          const progress = Math.min(100, (offset / file.size) * 100);
          
          console.log(`🔄 청크 ${chunks.length}/${chunkCount} 처리 완료 (${progress.toFixed(1)}%)`);
          
          // 브라우저 응답성 보장을 위한 비동기 처리
          setTimeout(processChunk, 10);
        };
        
        reader.onerror = () => {
          const error = new Error(`청크 읽기 실패 (${chunks.length + 1}/${chunkCount}): ${reader.error?.message || '알 수 없는 오류'}`);
          console.error('❌ 청크 처리 오류:', error);
          reject(error);
        };
        
        reader.readAsDataURL(chunk);
      };
      
      // 첫 번째 청크 처리 시작
      processChunk();
    });
  };

  /**
   * 파일 업로드 처리 (강화된 에러 핸들링 및 재시도 로직)
   */
  const handleFileUpload = async (file: File, currentAttempt = 1): Promise<void> => {
    setError('');
    setUploading(true);
    setRetryCount(currentAttempt - 1);
    
    // AbortController 설정
    const abortController = new AbortController();
    setUploadAbortController(abortController);
    setUploadCancellable(true);
    
    const attemptText = currentAttempt > 1 ? ` (재시도 ${currentAttempt}/${MAX_RETRY_ATTEMPTS})` : '';
    
    try {
      console.log(`🚀 파일 업로드 시작${attemptText}:`, file.name);
      
      // 1. 파일 사전 검증
      setUploadProgress(`파일 검증 중...${attemptText}`);
      const validation = validateFileUpload(file);
      if (!validation.isValid) {
        throw new Error(validation.error!);
      }
      
      // 2. 시스템 리소스 검사
      setUploadProgress(`시스템 리소스 검사 중...${attemptText}`);
      const resourceCheck = checkSystemResources();
      if (!resourceCheck.canProceed) {
        throw new Error(resourceCheck.warning!);
      }
      
      // 경고가 있는 경우 표시
      if (resourceCheck.warning) {
        console.warn('⚠️ 시스템 리소스 경고:', resourceCheck.warning);
      }
      
      // 3. 파일 타입 매핑
      const fileType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
      
      // 4. Base64 인코딩 (청크 기반)
      setUploadProgress(`파일 인코딩 중...${attemptText}`);
      const base64Content = await fileToBase64(file, abortController.signal);
      
      // 취소 확인
      if (abortController.signal.aborted) {
        throw new Error('업로드가 취소되었습니다.');
      }
      
      // 5. 데이터베이스 저장
      setUploadProgress(`파일 저장 중...${attemptText}`);
      const savedFile = await cultureStateService.saveProjectFile({
        project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
        file_type: fileType,
        file_name: file.name,
        file_content: base64Content,
        file_size: file.size,
        mime_type: file.type,
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          uploadAttempts: currentAttempt,
          chunkProcessed: file.size >= CHUNK_SIZE
        }
      });
      
      // 6. 성공 처리
      if (savedFile) {
        setFiles(prev => [savedFile, ...prev]);
        setUploadProgress('업로드 완료! 🎉');
        onFileUploaded?.(savedFile);
        
        console.log('✅ 파일 업로드 성공:', {
          fileName: file.name,
          fileId: savedFile.id,
          attempts: currentAttempt,
          finalSize: `${(savedFile.file_size / 1024 / 1024).toFixed(2)}MB`
        });
        
        // 성공 메시지 자동 제거
        setTimeout(() => {
          setUploadProgress('');
          setRetryCount(0);
        }, 3000);
      } else {
        throw new Error('파일 저장에 실패했습니다. 응답이 없습니다.');
      }
      
    } catch (error) {
      console.error(`❌ 파일 업로드 실패 (시도 ${currentAttempt}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      
      // 취소된 경우 재시도하지 않음
      if (errorMessage.includes('취소') || abortController.signal.aborted) {
        setError('파일 업로드가 취소되었습니다.');
        setUploadProgress('');
        return;
      }
      
      // 재시도 가능한 에러인지 확인
      const isRetryableError = (
        errorMessage.includes('네트워크') ||
        errorMessage.includes('연결') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('저장') ||
        errorMessage.includes('데이터베이스')
      );
      
      // 재시도 로직
      if (isRetryableError && currentAttempt < MAX_RETRY_ATTEMPTS) {
        const nextAttempt = currentAttempt + 1;
        const delay = Math.pow(2, currentAttempt) * 1000; // 지수 백오프 (1초, 2초, 4초)
        
        console.log(`⏳ ${delay/1000}초 후 재시도 예정 (${nextAttempt}/${MAX_RETRY_ATTEMPTS})`);
        setUploadProgress(`${delay/1000}초 후 재시도... (${nextAttempt}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            handleFileUpload(file, nextAttempt);
          }
        }, delay);
        
        return;
      }
      
      // 최종 실패 처리
      const finalError = isRetryableError 
        ? `${errorMessage} (${currentAttempt}회 시도 후 실패)`
        : errorMessage;
      
      setError(getFriendlyErrorMessage(finalError));
      
    } finally {
      // 최종 시도이거나 성공한 경우에만 정리
      if (currentAttempt >= MAX_RETRY_ATTEMPTS || !error) {
        setUploading(false);
        setUploadCancellable(false);
        setUploadAbortController(null);
      }
    }
  };
  
  /**
   * 사용자 친화적 에러 메시지 생성
   */
  const getFriendlyErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes('네트워크') || errorMessage.includes('연결')) {
      return '네트워크 연결을 확인하고 다시 시도해주세요. 🌐';
    }
    
    if (errorMessage.includes('메모리')) {
      return '메모리가 부족합니다. 브라우저를 재시작하거나 다른 탭을 닫아주세요. 💾';
    }
    
    if (errorMessage.includes('크기')) {
      return '파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요. 📏';
    }
    
    if (errorMessage.includes('형식') || errorMessage.includes('타입')) {
      return '지원하지 않는 파일 형식입니다. PNG, JPG, JSON, Word, PDF 파일만 업로드 가능합니다. 📁';
    }
    
    if (errorMessage.includes('권한') || errorMessage.includes('접근')) {
      return '파일 접근 권한이 없습니다. 파일을 다시 선택해주세요. 🔐';
    }
    
    return `${errorMessage} 🔧`;
  };

  /**
   * 파일 삭제
   */
  const handleFileDelete = async (fileId: number, fileName: string) => {
    if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const success = await cultureStateService.deleteProjectFile(fileId);
      if (success) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        onFileDeleted?.(fileId);
      } else {
        setError('파일 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      setError('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  /**
   * 파일 다운로드
   */
  const handleFileDownload = async (fileId: number, fileName: string) => {
    try {
      const file = await cultureStateService.downloadProjectFile(fileId);
      if (!file || !file.file_content) {
        setError('파일을 찾을 수 없습니다.');
        return;
      }

      // Base64를 Blob으로 변환
      const binaryString = atob(file.file_content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: file.mime_type || 'application/octet-stream' });
      
      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      setError('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  /**
   * 드래그 이벤트 처리
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]); // 첫 번째 파일만 처리
    }
  };

  /**
   * 파일 선택 처리
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 파일 크기 포맷팅 (FileSystemUtil 사용)
   */
  const formatFileSize = (bytes: number): string => {
    return FileSystemUtil.formatFileSize(bytes);
  };

  /**
   * 파일 타입 아이콘 반환
   */
  const getFileTypeIcon = (fileType: string, mimeType?: string) => {
    if (fileType === 'culture_map' || mimeType?.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'culture_json' || mimeType?.includes('json')) {
      return '📊';
    } else if (fileType === 'analysis_report' || mimeType?.includes('word') || mimeType?.includes('pdf')) {
      return '📄';
    }
    return '📁';
  };

  return (
    <div className="project-file-manager">
      <div className="file-manager-header">
        <h3>📁 프로젝트 파일 관리 (개선됨)</h3>
        <div className="supported-types">
          지원 형식: 이미지(PNG, JPG), JSON, Word, PDF (최대 10MB) - 이제 더 빠른 업로드!
        </div>
      </div>

      {/* 파일 업로드 영역 */}
      <div 
        className={`file-upload-area ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.json,.docx,.doc,.pdf,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        
        <div className="upload-content">
          {uploading ? (
            <>
              <div className="upload-spinner">⏳</div>
              <div className="upload-text">{uploadProgress}</div>
              {retryCount > 0 && (
                <div className="retry-info">
                  📊 재시도 횟수: {retryCount}/{MAX_RETRY_ATTEMPTS}
                </div>
              )}
              {uploadCancellable && (
                <button 
                  onClick={cancelUpload}
                  className="cancel-upload-btn"
                  title="업로드 취소"
                >
                  ❌ 취소
                </button>
              )}
            </>
          ) : (
            <>
              <div className="upload-icon">📤</div>
              <div className="upload-text">
                파일을 끌어다 놓거나 클릭하여 업로드 (고속 업로드)
              </div>
            </>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={() => setError('')} className="error-close">✕</button>
        </div>
      )}

      {/* 파일 목록 */}
      <div className="file-list">
        {files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-text">업로드된 파일이 없습니다</div>
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="file-card">
              <div className="file-icon">
                {getFileTypeIcon(file.file_type, file.mime_type)}
              </div>
              <div className="file-info">
                <div className="file-name" title={file.file_name}>
                  {file.file_name}
                </div>
                <div className="file-meta">
                  <span className="file-size">{formatFileSize(file.file_size)}</span>
                  <span className="file-type">{file.file_type}</span>
                  <span className="file-date">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleFileDownload(file.id, file.file_name)}
                  className="action-btn download-btn"
                  title="다운로드"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => handleFileDelete(file.id, file.file_name)}
                  className="action-btn delete-btn"
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 파일 통계 */}
      {files.length > 0 && (
        <div className="file-stats">
          <div className="stats-item">
            <span className="stats-label">총 파일:</span>
            <span className="stats-value">{files.length}개</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">총 크기:</span>
            <span className="stats-value">
              {formatFileSize(files.reduce((sum, file) => sum + file.file_size, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFileManager;
