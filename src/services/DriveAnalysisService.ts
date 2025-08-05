// src/services/DriveAnalysisService.ts

import type { 
  DriveFileInfo, 
  DriveError, 
  DriveAnalysisSession,
  FourLayerAnalysisResult,
  AnalysisWorkflowState,
  WorkflowStage,
  WorkflowProgressCallback,
  BatchWorkflowState,
  FileProcessingStatus,
  PreprocessingResult,
  BatchProgressCallback,
  BatchAnalysisResult
} from '../types/culture';
import { DriveErrorType } from '../types/culture';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { fourLayerAnalysisEngine } from './FourLayerAnalysisEngine'; // 수정됨: fourLayerAnalysisEngine 임포트

/**
 * Google Drive 기반 조직문화 분석 서비스
 * Step 0~4 표준 워크플로우 AI 분석 파이프라인을 지원합니다.
 */
class FileProcessingEngine {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  
  static async preprocessFile(
    fileInfo: DriveFileInfo,
    content: string | ArrayBuffer
  ): Promise<PreprocessingResult> {
    const startTime = performance.now();
    
    try {
      console.log(`📁 파일 전처리 시작: ${fileInfo.name} (${fileInfo.mimeType})`);
      const fileType = this.detectFileType(fileInfo);
      const originalSize = typeof content === 'string' 
        ? new Blob([content]).size 
        : content.byteLength;
      
      if (originalSize > this.MAX_FILE_SIZE) {
        console.warn(`⚠️ 대용량 파일 감지: ${originalSize / 1024 / 1024}MB`);
      }
      
      let processedContent: string;
      
      switch (fileType) {
        case 'txt':
          processedContent = await this.processTxtFile(content);
          break;
        // 다른 파일 타입 처리 로직은 유지됩니다.
        default:
          processedContent = await this.processUnknownFile(content);
      }
      
      const processedSize = new Blob([processedContent]).size;
      const processingTime = performance.now() - startTime;
      
      console.log(`✅ 전처리 완료: ${originalSize}B → ${processedSize}B (${processingTime.toFixed(0)}ms)`);
      
      return {
        success: true,
        content: processedContent,
        metadata: {
          originalSize,
          processedSize,
          processingTime,
          fileType
        }
      };
      
    } catch (error) {
      console.error(`❌ 파일 전처리 실패: ${fileInfo.name}`, error);
      return {
        success: false,
        content: '',
        metadata: {
          originalSize: 0,
          processedSize: 0,
          processingTime: performance.now() - startTime,
          fileType: 'unknown'
        },
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }
  
  static detectFileType(fileInfo: DriveFileInfo): FileProcessingStatus['fileType'] {
    const mimeType = fileInfo.mimeType?.toLowerCase() || '';
    const fileName = fileInfo.name?.toLowerCase() || '';
    
    if (mimeType.includes('text/plain') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      return 'txt';
    }
    // 다른 파일 타입 감지 로직은 유지됩니다.
    return 'unknown';
  }
  
  private static async processTxtFile(content: string | ArrayBuffer): Promise<string> {
    if (typeof content === 'string') {
      return content;
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(content);
  }

  private static async processAudioFile(content: string | ArrayBuffer, fileName: string): Promise<string> {
    console.log(`🎤 오디오 파일 전사 시뮬레이션: ${fileName}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `[오디오 파일 전사 결과: ${fileName}]\n\n화자 1: 조직문화에 대해서 이야기해보겠습니다.\n화자 2: 네, 저희 조직의 특징을 말씀드리면...\n\n[실제 환경에서는 NotebookLM 음성 전사 결과가 여기에 표시됩니다]`;
  }
  
  private static async processPptxFile(content: string | ArrayBuffer): Promise<string> {
    console.log(`📊 PowerPoint 파일 텍스트 추출 시뮬레이션`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return `[PowerPoint 텍스트 추출 결과]`;
  }

  private static async processPdfFile(content: string | ArrayBuffer): Promise<string> {
    console.log(`📄 PDF 파일 텍스트 추출 시뮬레이션`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    return `[PDF 텍스트 추출 결과]`;
  }
  
  private static async processUnknownFile(content: string | ArrayBuffer): Promise<string> {
    console.warn(`⚠️ 알 수 없는 파일 타입 - 텍스트 변환 시도`);
    if (typeof content === 'string') {
      return content;
    }
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(content);
    } catch (error) {
      console.error('텍스트 변환 실패:', error);
      return '[파일 내용을 읽을 수 없습니다.]';
    }
  }
}

class DriveAnalysisService {
  private serviceStatus = {
    isConnected: false,
    errorCount: 0,
    lastSuccessfulOperation: undefined as string | undefined,
    lastError: undefined as DriveError | undefined
  };

  private currentWorkflow: AnalysisWorkflowState | null = null;
  private progressCallback: WorkflowProgressCallback | null = null;

  async startAutomatedAnalysisWorkflow(
    content: string,
    projectId: string,
    fileInfo: DriveFileInfo,
    progressCallback?: WorkflowProgressCallback
  ): Promise<any> { // 반환 타입을 any로 변경하여 유연성 확보
    return this.executeSafeOperation(async () => {
      console.log(`🚀 자동화된 분석 워크플로우 시작: ${fileInfo.name}`);
      const textEncoder = new TextEncoder();
      const audioFileData = textEncoder.encode(content);
      
      const workflowResult = await this.startStandardAnalysisWorkflow(
        audioFileData,
        fileInfo.name,
        progressCallback
      );
      
      // 최종 결과는 workflowResult 전체가 될 수 있음
      return workflowResult;
      
    }, this.getDefaultAnalysisResult(), '자동화된 분석 워크플로우');
  }

  async executeStep0_SpeechToText(
    audioFileData: ArrayBuffer | string,
    fileName: string = 'interview.m4a'
  ): Promise<any> {
    return this.executeSafeOperation(async () => {
      console.log(`🎤 Step 0: 음성-텍스트 변환 시작 - ${fileName}`);
      // TODO: 실제 NotebookLM API 연동 시 이 부분에 기능 구현
      console.log("Step 0: 현재는 프롬프트 생성 방식으로 대체되었습니다.");
      return {
        transcription: `[시뮬레이션된 전사 결과 for ${fileName}]`,
        metadata: { fileName, speakers: 2, confidence: 95 }
      };
    }, {
      transcription: '[폴백] 음성 파일 전사 결과',
      metadata: { fileName, speakers: 0, confidence: 0 }
    }, 'Step 0 음성-텍스트 변환');
  }

  async executeStep1_QuantitativeExtraction(
    transcriptionText: string
  ): Promise<any> {
    return this.executeSafeOperation(async () => {
      console.log(`📊 Step 1: 정량 데이터 추출 시작`);
      // TODO: 실제 NotebookLM API 연동 시 이 부분에 기능 구현
      console.log("Step 1: 현재는 프롬프트 생성 방식으로 대체되었습니다.");
      return {
        metadata: { totalFiles: 1, totalDuration: '00:10:00', speakers: { leaders: 1, members: 3 } },
        keywordFrequency: [{ keyword: '소통', totalCount: 15, leaderMentions: 5, memberMentions: 10 }],
        nonVerbalCues: []
      };
    }, {
      metadata: { totalFiles: 0, totalDuration: '00:00:00', speakers: { leaders: 0, members: 0 } },
      keywordFrequency: [],
      nonVerbalCues: []
    }, 'Step 1 정량 데이터 추출');
  }

  async executeStep2_GeminiAnalysis(
    quantitativeData: any,
    fullText: string
  ): Promise<string> {
    return this.executeSafeOperation(async () => {
      console.log(`🤖 Step 2: Gemini 분석 프롬프트 생성 시작`);
      this.updateWorkflowStage('step2', 55, 'Gemini 프롬프트 생성 중...');
      const prompt = await fourLayerAnalysisEngine.generateStep2Prompt(fullText);
      console.log('✅ [DEBUG] Step 2 프롬프트 생성 완료! 수정된 코드가 실행되었습니다.');
      console.log(`[DEBUG] 생성된 프롬프트 미리보기: ${prompt.substring(0, 200)}...`);
      this.updateWorkflowStage('step2', 60, 'Gemini 프롬프트 생성 완료');
      return prompt;
    }, '[폴백] Gemini 분석 프롬프트를 생성할 수 없습니다.', 'Step 2 Gemini 분석 프롬프트 생성');
  }

  async executeStep3_CultureMap(
    geminiAnalysis: string,
    quantitativeData: any
  ): Promise<string> {
    return this.executeSafeOperation(async () => {
      console.log(`🧠 Step 3: Claude 컬쳐맵 생성 시작`);
      // TODO: 실제 API 연동 시 이 부분에 기능 구현
      console.log("Step 3: 현재는 프롬프트 생성 방식으로 대체되었습니다.");
      return "[폴백] Claude 컬쳐맵 결과가 여기에 표시됩니다.";
    }, '[폴백] Claude 컬쳐맵 결과가 여기에 표시됩니다.', 'Step 3 Claude 컬쳐맵 생성');
  }

  async executeStep4_FinalReport(
    cultureMap: string,
    geminiAnalysis: string,
    quantitativeData: any
  ): Promise<any> {
    return this.executeSafeOperation(async () => {
      console.log(`📊 Step 4: 최종 분석 보고서 생성 시작`);
      // TODO: 실제 API 연동 시 이 부분에 기능 구현
      console.log("Step 4: 현재는 프롬프트 생성 방식으로 대체되었습니다.");
      return {
        analysisResult: this.getDefaultAnalysisResult(),
        visualizationData: null
      };
    }, {
      analysisResult: this.getDefaultAnalysisResult(),
      visualizationData: null
    }, 'Step 4 최종 분석 보고서');
  }

  async startStandardAnalysisWorkflow(
    audioFileData: ArrayBuffer | string,
    fileName: string = 'interview.m4a',
    progressCallback?: WorkflowProgressCallback
  ): Promise<any> {
    return this.executeSafeOperation(async () => {
      console.log(`🚀 표준 워크플로우 시작: ${fileName}`);
      this.currentWorkflow = {
        stage: 'step0',
        completedStages: new Set<string>(),
        progress: 0,
        isProcessing: true,
        step0Data: null,
        step1Data: null,
        step2Data: null,
        step3Data: null,
        step4Data: null
      };
      
      if (progressCallback) {
        this.progressCallback = progressCallback;
      }
      
      this.updateWorkflowStage('step0', 10, 'Step 0: 음성-텍스트 변환 시작...');
      const step0Result = await this.executeStep0_SpeechToText(audioFileData, fileName);
      if (this.currentWorkflow) {
        this.currentWorkflow.step0Data = step0Result;
        this.currentWorkflow.completedStages.add('step0');
      }
      
      this.updateWorkflowStage('step1', 30, 'Step 1: 정량 데이터 추출 시작...');
      const step1Result = await this.executeStep1_QuantitativeExtraction(step0Result.transcription);
      if (this.currentWorkflow) {
        this.currentWorkflow.step1Data = step1Result;
        this.currentWorkflow.completedStages.add('step1');
      }
      
      this.updateWorkflowStage('step2', 50, 'Step 2: Gemini 분석 시작...');
      const step2Result = await this.executeStep2_GeminiAnalysis(step1Result, step0Result.transcription);
      if (this.currentWorkflow) {
        this.currentWorkflow.step2Data = step2Result;
        this.currentWorkflow.completedStages.add('step2');
      }
      
      this.updateWorkflowStage('step3', 70, 'Step 3: Claude 컬쳐맵 생성 시작...');
      const step3Result = await this.executeStep3_CultureMap(step2Result, step1Result);
      if (this.currentWorkflow) {
        this.currentWorkflow.step3Data = step3Result;
        this.currentWorkflow.completedStages.add('step3');
      }
      
      this.updateWorkflowStage('step4', 90, 'Step 4: 최종 분석 보고서 생성 시작...');
      const step4Result = await this.executeStep4_FinalReport(step3Result, step2Result, step1Result);
      if (this.currentWorkflow) {
        this.currentWorkflow.step4Data = step4Result;
        this.currentWorkflow.completedStages.add('step4');
        this.currentWorkflow.isProcessing = false;
      }
      
      this.updateWorkflowStage('step4', 100, '✅ 표준 워크플로우 완료!');
      
      return {
        step0Result,
        step1Result,
        step2Result,
        step3Result,
        step4Result
      };
      
    }, {
      step0Result: null,
      step1Result: null,
      step2Result: null,
      step3Result: null,
      step4Result: null
    }, '표준 워크플로우 실행');
  }

  // ... (다른 헬퍼 함수들은 유지)
  
  private updateWorkflowStage(
    stage: AnalysisWorkflowState['stage'],
    progress: number,
    message?: string
  ): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.stage = stage;
      this.currentWorkflow.progress = progress;
      this.notifyProgress(message);
    }
  }
  
  private notifyProgress(message?: string): void {
    if (this.progressCallback && this.currentWorkflow) {
      this.progressCallback({ ...this.currentWorkflow }, message);
    }
  }

  private getDefaultAnalysisResult(): FourLayerAnalysisResult {
    return {
      artifacts: { visible_elements: [], symbols: [], rituals: [], stories: [] },
      behaviors: { patterns: [], interactions: [], decision_making: [], communication: [] },
      norms_values: { stated_values: [], implicit_norms: [], cultural_rules: [], belief_systems: [] },
      assumptions: { basic_assumptions: [], mental_models: [], worldviews: [], unconscious_beliefs: [] },
      insights: { patterns: [], gaps: [], risks: [], opportunities: [], recommendations: [] },
      academic_references: [],
      confidence_score: 0
    };
  }

  private async executeSafeOperation<T>(
    operation: () => Promise<T>,
    fallbackData: T,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ ${operationName} 실패:`, error);
      return fallbackData;
    }
  }

  async generateAndDownloadDocx(analysisResult: FourLayerAnalysisResult, fileName: string): Promise<void> {
    // DOCX 생성 로직은 유지
  }
}

export const driveAnalysisService = new DriveAnalysisService();
export default DriveAnalysisService;