// src/types/culture.ts

/**
 * 조직문화 분석 프로젝트의 기본 정보
 */
export interface CultureProject {
  id: string;
  name: string;
  description: string;
  organization: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
  metadata?: string;
}

/**
 * 인터뷰 세션 정보
 */
export interface InterviewSession {
  id: string;
  project_id: string;
  participant_role: string;
  session_date: string;
  duration_minutes: number;
  audio_file_path?: string;
  transcript?: string;
  status: 'scheduled' | 'completed' | 'transcribed' | 'analyzed';
  metadata?: string;
}

/**
 * Dave Gray-Schein 4층위 분석 결과
 */
export interface LayerAnalysis {
  id: string;
  project_id: string;
  layer_type: 'artifacts' | 'behaviors' | 'norms_values' | 'assumptions';
  layer_index: number;
  content: string;
  source_data: string;
  confidence_score: number;
  created_at: string;
  metadata?: string;
}

// 인사이트 및 진행률 관련 타입 제거됨 (실제 사용되지 않는 기능)

/**
 * 대시보드 상태
 */
export interface DashboardState {
  projects: CultureProject[];
  activeProject: CultureProject | null;
  systemStatus: 'idle' | 'processing' | 'error';
  lastUpdate: string;
}

/**
 * 데이터베이스 에러 타입
 */
export const DatabaseErrorType = {
  DB_NOT_INITIALIZED: 'DB_NOT_INITIALIZED',
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR'
} as const;

export type DatabaseErrorType = typeof DatabaseErrorType[keyof typeof DatabaseErrorType];

/**
 * 데이터베이스 에러 정보
 */
export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  originalError?: Error;
  recoveryGuidance?: string;
  fallbackData?: any;
}

/**
 * 서비스 상태 정보
 */
export interface ServiceStatus {
  isConnected: boolean;
  lastError?: DatabaseError;
  errorCount: number;
  lastSuccessfulOperation?: string;
}

/**
 * Google Drive 파일 정보
 */
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  parents?: string[];
}

/**
 * Google Drive 에러 타입
 */
export const DriveErrorType = {
  DRIVE_NOT_ACCESSIBLE: 'DRIVE_NOT_ACCESSIBLE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

export type DriveErrorType = typeof DriveErrorType[keyof typeof DriveErrorType];

/**
 * Google Drive 에러 정보
 */
export interface DriveError {
  type: DriveErrorType;
  message: string;
  originalError?: Error;
  recoveryGuidance?: string;
  fallbackData?: any;
}

/**
 * Google Drive 분석 세션
 */
export interface DriveAnalysisSession {
  id: string;
  project_id: string;
  drive_file_id: string;
  drive_file_name: string;
  file_type: string;
  analysis_step: 0 | 1 | 2 | 3 | 4; // Step 0~4 표준 워크플로우
  step0_result?: string; // NotebookLM 음성-텍스트 결과
  step1_result?: string; // NotebookLM 정량 분석 결과
  step2_result?: string; // Gemini 1차 분석 결과
  step3_result?: string; // Claude Culture Map 결과
  step4_result?: string; // Claude 최종 보고서 결과
  notebook_lm_result?: string; // 하위 호환성을 위해 유지
  gemini_analysis_result?: string; // 하위 호환성을 위해 유지
  claude_analysis_result?: string; // 하위 호환성을 위해 유지
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  metadata?: string;
}

/**
 * 다중 파일 처리 상태 인터페이스
 * 최대 20개 파일의 개별 처리 상태와 전체 진행률을 추적
 */
export interface BatchWorkflowState {
  totalFiles: number;
  processedFiles: number;
  completedFiles: number;
  errorFiles: number;
  overallProgress: number; // 0-100 전체 진행률
  isProcessing: boolean;
  files: FileProcessingStatus[];
  batchStartTime: string;
  estimatedCompletionTime?: string;
  memoryUsage?: {
    current: number; // MB
    peak: number; // MB
    limit: number; // MB (10GB = 10240MB)
  };
  error?: string;
}

/**
 * 개별 파일 처리 상태
 */
export interface FileProcessingStatus {
  fileInfo: DriveFileInfo;
  status: 'pending' | 'preprocessing' | 'step0' | 'step1' | 'step2' | 'step3' | 'step4' | 'completed' | 'error';
  progress: number; // 0-100 개별 파일 진행률
  currentStage: WorkflowStage | 'preprocessing' | null;
  processingStartTime?: string;
  processingEndTime?: string;
  processingDuration?: number; // milliseconds
  error?: {
    stage: string;
    message: string;
    originalError?: Error;
    retryCount: number;
    canRetry: boolean;
  };
  results?: {
    step0?: any;
    step1?: any;
    step2?: string;
    step3?: string;
    step4?: {
      analysisResult: FourLayerAnalysisResult;
      visualizationData: any;
    };
  };
  fileType: 'txt' | 'm4a' | 'pptx' | 'pdf' | 'unknown';
  preprocessedContent?: string;
  memoryFootprint?: number; // MB
}

/**
 * 파일 타입별 전처리 결과
 */
export interface PreprocessingResult {
  success: boolean;
  content: string;
  metadata: {
    originalSize: number;
    processedSize: number;
    processingTime: number;
    fileType: string;
    encoding?: string;
  };
  error?: string;
}

/**
 * 배치 처리 진행 콜백 타입
 */
export type BatchProgressCallback = (
  batchState: BatchWorkflowState,
  message?: string
) => void;

/**
 * 배치 분석 결과
 */
export interface BatchAnalysisResult {
  success: boolean;
  totalFiles: number;
  completedFiles: number;
  errorFiles: number;
  results: Array<{
    fileInfo: DriveFileInfo;
    success: boolean;
    analysisResult?: FourLayerAnalysisResult;
    error?: string;
  }>;
  aggregatedInsights?: {
    commonPatterns: string[];
    crossFileConnections: string[];
    overallConfidenceScore: number;
    recommendations: string[];
  };
  processingStats: {
    totalDuration: number;
    averageTimePerFile: number;
    peakMemoryUsage: number;
    failureRate: number;
  };
}

/**
 * Step 0~4 표준 워크플로우 상태 인터페이스
 * DriveAnalysisService와 UI 간 완전 호환성 보장
 */
export interface AnalysisWorkflowState {
  stage: WorkflowStage;
  step0Data: {
    transcription: string;
    metadata: {
      fileName: string;
      duration?: string;
      speakers: number;
      confidence: number;
    };
  } | null;
  step1Data: {
    metadata: {
      totalFiles: number;
      totalDuration: string;
      speakers: {
        leaders: number;
        members: number;
      };
    };
    keywordFrequency: Array<{
      keyword: string;
      totalCount: number;
      leaderMentions: number;
      memberMentions: number;
    }>;
    nonVerbalCues: Array<{
      type: 'positive' | 'negative';
      expression: string;
      totalCount: number;
      leaderMentions: number;
      memberMentions: number;
    }>;
  } | null;
  step2Data: string | null; // Gemini 1차 분석 결과
  step3Data: string | null; // Claude Culture Map 텍스트
  step4Data: {
    analysisResult: FourLayerAnalysisResult;
    visualizationData: any;
  } | null;
  progress: number; // 0-100
  isProcessing: boolean;
  error?: string;
  completedStages: Set<string>;
  // 다중 파일 처리 지원 (선택적)
  batchState?: BatchWorkflowState;
}

/**
 * Step 0~4 표준 워크플로우 단계 정의
 */
export type WorkflowStage = 'step0' | 'step1' | 'step2' | 'step3' | 'step4';

/**
 * 워크플로우 진행 상황 콜백 타입
 */
export type WorkflowProgressCallback = (state: AnalysisWorkflowState, message?: string) => void;

/**
 * Step 0~4 단계별 상태
 */
export interface StageStatus {
  id: WorkflowStage;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  current: boolean;
  isProcessing?: boolean;
  error?: string;
  data?: any;
}

/**
 * 표준 5단계 정의 (기존 UI 호환성 유지)
 */
export const STANDARD_WORKFLOW_STAGES: StageStatus[] = [
  {
    id: 'step0',
    label: 'NotebookLM 음성변환',
    description: '음성 파일을 텍스트로 변환',
    icon: '🎤',
    completed: false,
    current: false
  },
  {
    id: 'step1',
    label: 'NotebookLM 정량분석',
    description: '키워드 빈도 및 정량 데이터 추출',
    icon: '📊',
    completed: false,
    current: false
  },
  {
    id: 'step2',
    label: 'Gemini 1차분석',
    description: 'AI 예비 분석 수행',
    icon: '🧠',
    completed: false,
    current: false
  },
  {
    id: 'step3',
    label: 'Claude 컴쳐맵',
    description: '4층위 분석 및 컴쳐맵 생성',
    icon: '🗺️',
    completed: false,
    current: false
  },
  {
    id: 'step4',
    label: 'Claude 최종보고서',
    description: '종합 분석 보고서 작성 (시각화 포함)',
    icon: '📋',
    completed: false,
    current: false
  }
];

/**
 * 구성원 인식 강도 타입
 */
export type PerceptionIntensity = '집중' | '관심' | '언급';

/**
 * 컬쳐맵 노트 데이터
 */
export interface NoteData {
  id: string;
  text: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  type: 'artifact' | 'behavior' | 'norm_value' | 'assumption' | 'insight';
  sentiment: 'positive' | 'negative' | 'neutral';
  perceptionIntensity?: PerceptionIntensity; // 구성원 인식 강도 (집중/관심/언급)
  basis?: string; // 이론적 근거
  layer: 1 | 2 | 3 | 4;
  category?: string;
  connections?: string[]; // 연결된 노트들의 ID
}

/**
 * 컬쳐맵 연결 데이터
 */
export interface ConnectionData {
  id: string;
  sourceId: string; // 노트 ID
  targetId: string; // 노트 ID
  relationType: 'direct' | 'indirect';
  isPositive: boolean;
  type?: 'influences' | 'supports' | 'conflicts' | 'depends_on';
  strength?: 'weak' | 'medium' | 'strong';
  description?: string;
}

/**
 * 프롬프트 생성 타입 정의
 */
export type PromptType = 
  | 'four_layer_analysis'    // Dave Gray-Schein 4층위 분석
  | 'insight_extraction'     // 핵심 인사이트 추출
  | 'problem_diagnosis'      // 문제점 진단
  | 'culture_assessment'     // 조직문화 현황 평가
  | 'change_strategy'        // 변화 전략 수립
  | 'leader_analysis';       // 리더십 분석

/**
 * 프롬프트 템플릿 인터페이스
 */
export interface PromptTemplate {
  id: PromptType;
  name: string;
  description: string;
  category: '분석' | '진단' | '전략';
  template: string;
  variables: string[]; // 템플릿에서 사용하는 변수명들
  examples?: string[];
  academicFocus: string; // 학술적 근거 중점 영역
}

/**
 * 생성된 프롬프트 정보
 */
export interface GeneratedPrompt {
  id: string;
  type: PromptType;
  inputText: string;
  generatedPrompt: string;
  createdAt: string;
  copied?: boolean;
}

/**
 * 수동 분석 입력 데이터
 */
export interface ManualAnalysisInput {
  text: string;
  source: 'manual_input' | 'file_upload';
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
}

/**
 * 분석 모드 타입
 */
export type AnalysisMode = 
  | 'auto_drive'      // Google Drive 자동 연동
  | 'manual_input'    // 수동 텍스트 입력
  | 'prompt_generator'; // 프롬프트 생성

/**
 * Claude 이중 역할 체인 상태
 */
export interface ChainedPromptState {
  isActive: boolean;
  currentStep: 'culturemap' | 'report' | 'completed';
  progress: number; // 0-100
  cultureMapResult?: string;
  reportResult?: string;
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * Claude 이중 역할 단계별 정보
 */
export interface ChainedStep {
  id: 'culturemap' | 'report';
  title: string;
  description: string;
  icon: string;
  prompt: string;
  completed: boolean;
  isActive: boolean;
  result?: string;
  duration?: number; // milliseconds
  tokens?: number; // 예상 토큰 사용량
}

/**
 * 체인 실행 콜백 타입
 */
export type ChainProgressCallback = (
  state: ChainedPromptState,
  message?: string
) => void;

/**
 * Dave Gray-Schein 4층위 분석 결과 구조
 */
export interface FourLayerAnalysisResult {
  artifacts: {
    visible_elements: string[];
    symbols: string[];
    rituals: string[];
    stories: string[];
  };
  behaviors: {
    patterns: string[];
    interactions: string[];
    decision_making: string[];
    communication: string[];
  };
  norms_values: {
    stated_values: string[];
    implicit_norms: string[];
    cultural_rules: string[];
    belief_systems: string[];
  };
  assumptions: {
    basic_assumptions: string[];
    mental_models: string[];
    worldviews: string[];
    unconscious_beliefs: string[];
  };
  insights: {
    patterns: string[];
    gaps: string[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
  };
  academic_references: string[];
  confidence_score: number;
}

/**
 * 구성원 인식 강도 분석 (Step 3 컬쳐맵용)
 */
export interface MemberPerceptionIntensity {
  element: string;
  mentionFrequency: number; // 언급 횟수
  emotionalIntensity: 'low' | 'medium' | 'high'; // 감정적 강도
  groupConsensus: number; // 집단 합의도 (0-1)
  perceptionLevel: 'focus' | 'interest' | 'mention'; // [집중][관심][언급]
}

/**
 * 컬쳐맵 요소 (구성원 인식 강도 포함)
 */
export interface CultureMapElement {
  id: string;
  content: string;
  type: 'artifact' | 'behavior' | 'norm_value' | 'assumption';
  sentiment: 'positive' | 'negative' | 'neutral';
  perceptionData: MemberPerceptionIntensity;
  academicBasis?: {
    concept: string;
    source: string;
    field: string;
  };
}

/**
 * 인지편향 분석 결과 (Step 4 최종보고서용)
 */
export interface CognitiveBiasAnalysis {
  overestimatedElements: {
    element: string;
    biasType: 'negativity_bias' | 'availability_bias' | 'confirmation_bias';
    evidence: string;
    theoreticalBasis: string;
  }[];
  underestimatedElements: {
    element: string;
    reason: 'taken_for_granted' | 'blind_spot' | 'abstraction';
    hiddenImpact: string;
    riskOfIgnoring: string;
  }[];
  accuratePerceptions: string[];
}

/**
 * 최종 분석 보고서 구조 (Step 4용)
 */
export interface ComprehensiveAnalysisReport {
  memberPerceptionStatus: {
    topMentionedIssues: MemberPerceptionIntensity[];
    attentionPattern: 'problem_focused' | 'balanced' | 'strength_focused';
    emotionalDistribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
  perceptionRealityGap: CognitiveBiasAnalysis;
  consultingStrategy: {
    immediateFocus: string[]; // 높은 인식 + 실제 영향
    hiddenStrengths: string[]; // 낮은 인식 + 높은 영향
    perceptionCorrection: string[]; // 높은 인식 + 낮은 영향
    futureOpportunities: string[]; // 잠재적 변화 동력
  };
  organizationDiagnosis: {
    overallState: 'crisis' | 'problem_focused' | 'hybrid_transition' | 'growth_oriented' | 'excellence';
    confidence: number;
    reasoning: string[];
    dominantNarrative: string;
  };
}
