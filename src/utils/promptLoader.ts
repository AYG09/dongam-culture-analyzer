// src/utils/promptLoader.ts

/**
 * 프롬프트 파일 로딩 및 캐싱을 담당하는 유틸리티 클래스
 * Step 0~4에 해당하는 프롬프트 파일과 workshop 프롬프트를 동적으로 로딩하여 AI 분석에 활용
 */

export interface PromptData {
  content: string;
  loadedAt: number;
  step: string;
}

export interface PromptLoadResult {
  success: boolean;
  content: string;
  error?: string;
  fallbackUsed?: boolean;
}

/**
 * stepKey와 filename 매핑 테이블
 * 실제 public/prompts 폴더의 파일 구조와 정확히 일치
 */
const STEP_FILE_MAP: Record<string, string | null> = {
  step0: 'step0.md',
  step1: 'step1.md',
  step2: 'step2.md',
  step3: 'step3.md',
  step4a_claude_diagnosis: 'step4a_claude_diagnosis.md',
  step4a1_culture_diagnosis: 'step4a1_culture_diagnosis.md',
  step4a2_theory_analysis: 'step4a2_theory_analysis.md',
  step4a3_bias_analysis: 'step4a3_bias_analysis.md',
  step4b_claude_strategy: 'step4b_claude_strategy.md',
  // 교육용 워크샵 전용 프롬프트 파일
  stepworkshop: 'workshop.md',
  workshop: 'workshop.md',
  // 워크샵 분석 전용 프롬프트 파일 (교육용)
  workshop_analysis: 'workshop_analysis.md'
};

/**
 * 프롬프트 로더 클래스
 */
class PromptLoader {
  private cache = new Map<string, PromptData>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
  private readonly BASE_URL = '/prompts';
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private errorCounts = new Map<string, number>();
  private readonly MAX_RETRY_COUNT = 3;

  /**
   * 로깅 메서드 - 개발/프로덕션 환경을 고려한 로그 레벨별 처리
   * @param level - 로그 레벨 (debug, info, warn, error)
   * @param message - 로그 메시지
   * @param data - 추가 데이터 (선택적)
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (this.isDevelopment || level !== 'debug') {
      const logMethod = console[level] || console.log;
      logMethod(`[PromptLoader] ${message}`, ...(data ? [data] : []));
    }
  }

  /**
   * 에러 카운트 증가
   * @param key - 에러 카운트를 추적할 키
   * @returns 현재 에러 카운트
   */
  private incrementErrorCount(key: string): number {
    const count = this.errorCounts.get(key) || 0;
    const newCount = count + 1;
    this.errorCounts.set(key, newCount);
    return newCount;
  }

  /**
   * 에러 카운트 초기화
   * @param key - 초기화할 키
   */
  private resetErrorCount(key: string): void {
    this.errorCounts.delete(key);
  }

  /**
   * stepKey를 정규화하여 일관된 캐싱 키 생성
   * @param step - 원본 step 값 (number | string)
   * @returns 정규화된 stepKey
   */
  private normalizeStepKey(step: number | string): string {
    // 특수 키 처리: 'workshop'을 'stepworkshop'으로 통일
    if (step === 'workshop') {
      return 'stepworkshop';
    }
    
    // 문자열인 경우 그대로 반환 (step4a_claude_diagnosis 등)
    if (typeof step === 'string') {
      return step;
    }
    
    // 숫자인 경우 step 접두사 추가
    return `step${step}`;
  }
  
  /**
   * Step에 해당하는 프롬프트 파일을 로딩
   * @param step - 로딩할 Step (0, 1, 2, 3, 4) 또는 특수 키 ('workshop')
   * @returns 프롬프트 내용과 로딩 결과
   */
  async loadPrompt(step: number | string): Promise<PromptLoadResult> {
    // 🔄 캐싱 키 정규화
    const stepKey = this.normalizeStepKey(step);
    
    // stepworkshop과 workshop도 이제 일반 파일 로딩 방식으로 처리
    
    try {
      // 캐시 확인
      const cached = this.getCachedPrompt(stepKey);
      if (cached) {
        console.log(`✅ 프롬프트 캐시에서 로딩: ${stepKey}`);
        return {
          success: true,
          content: cached.content
        };
      }

      // 파일 로딩
      this.log('debug', '프롬프트 파일 로딩 시도', { stepKey, filename: STEP_FILE_MAP[stepKey] });
      const content = await this.fetchPromptFile(stepKey);
      
      // 캐시 저장
      this.setCachedPrompt(stepKey, content);
      this.resetErrorCount(stepKey); // 성공 시 에러 카운트 초기화
      
      this.log('info', '프롬프트 파일 로딩 성공', { 
        stepKey, 
        filename: STEP_FILE_MAP[stepKey],
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + '...'
      });
      return {
        success: true,
        content
      };

    } catch (error) {
      const errorCount = this.incrementErrorCount(stepKey);
      
      this.log('error', '프롬프트 로딩 실패', { 
        stepKey, 
        errorCount, 
        maxRetry: this.MAX_RETRY_COUNT,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 🎯 사용자 친화적 에러 메시지 개선
      let errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      let userFriendlyMessage = errorMessage;
      
      // HTML 에러 페이지 감지된 경우 명확한 안내
      if (errorMessage.includes('HTML 에러 페이지 감지됨') || errorMessage.includes('HTML 태그 감지됨')) {
        this.log('warn', 'Vite 개발 서버 에러 페이지 감지 - fallback 프롬프트 사용', { stepKey });
        userFriendlyMessage = `파일을 찾을 수 없어 기본 프롬프트를 사용합니다: ${stepKey}`;
      }
      
      // 반복 실패 시 추가 안내
      if (errorCount >= this.MAX_RETRY_COUNT) {
        this.log('warn', '최대 재시도 횟수 초과 - fallback 사용', { stepKey, errorCount });
        userFriendlyMessage += ' (여러 번 실패하여 기본 프롬프트를 사용합니다)';
      }
      
      // 폴백 로직
      const fallbackContent = this.getFallbackPrompt(stepKey);
      
      return {
        success: false,
        content: fallbackContent,
        error: userFriendlyMessage,
        fallbackUsed: true
      };
    }
  }

  /**
   * 프롬프트 파일을 fetch로 로딩
   * @param stepKey - 단계 키 (step0, step1, step4a_claude_diagnosis 등)
   * @returns 프롬프트 내용
   */
  private async fetchPromptFile(stepKey: string): Promise<string> {
    // 매핑 테이블에서 파일명 확인
    const filename = STEP_FILE_MAP[stepKey];
    
    // 파일이 없는 경우 (stepworkshop, workshop 등) 에러 발생
    if (filename === null || filename === undefined) {
      throw new Error(`매핑되지 않은 stepKey이거나 파일이 존재하지 않습니다: ${stepKey}`);
    }
    
    const url = `${this.BASE_URL}/${filename}`;
    
    this.log('debug', '프롬프트 파일 fetch 요청', { stepKey, filename, url });
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`프롬프트 파일 로딩 실패: ${response.status} ${response.statusText} (${filename})`);
    }
    
    // 🔥 HTML 에러 응답 감지 로직 추가
    const contentType = response.headers.get('content-type') || '';
    
    this.log('debug', 'HTTP 응답 수신', { 
      stepKey, 
      status: response.status, 
      contentType,
      ok: response.ok 
    });
    
    // Content-Type이 HTML인 경우 Vite 에러 페이지로 판단
    if (contentType.includes('text/html')) {
      throw new Error(`HTML 에러 페이지 감지됨 (Vite 404 에러): ${stepKey} (${filename})`);
    }
    
    const content = await response.text();
    
    // 응답 내용이 HTML 태그를 포함하는 경우도 에러 처리
    if (this.containsHtmlTags(content)) {
      throw new Error(`응답 내용에 HTML 태그 감지됨 (Vite 에러 페이지): ${stepKey} (${filename})`);
    }
    
    if (!content || content.trim().length === 0) {
      throw new Error(`프롬프트 파일이 비어있습니다: ${stepKey} (${filename})`);
    }
    
    // 유효한 마크다운 콘텐츠인지 기본 검증
    const validation = this.validatePrompt(content);
    if (!validation.isValid) {
      this.log('warn', '프롬프트 검증 실패', { 
        stepKey, 
        filename, 
        issues: validation.issues,
        contentLength: content.length
      });
      throw new Error(`프롬프트 검증 실패: ${stepKey} (${filename}) - ${validation.issues.join(', ')}`);
    }
    
    this.log('debug', '프롬프트 파일 로딩 완료', { 
      stepKey, 
      contentLength: content.length,
      validationPassed: true
    });
    
    return content;
  }
  
  /**
   * 텍스트에 HTML 태그가 포함되어 있는지 확인
   * @param text - 확인할 텍스트
   * @returns HTML 태그 포함 여부
   */
  private containsHtmlTags(text: string): boolean {
    // 대표적인 HTML 태그들을 확인
    const htmlPatterns = [
      /<html[^>]*>/i,
      /<head[^>]*>/i,
      /<body[^>]*>/i,
      /<div[^>]*>/i,
      /<script[^>]*>/i,
      /<title[^>]*>/i,
      /<!doctype\s+html/i
    ];
    
    return htmlPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 캐시에서 프롬프트 조회
   * @param stepKey - 단계 키 (정규화됨)
   * @returns 캐시된 프롬프트 데이터 또는 null
   */
  private getCachedPrompt(stepKey: string): PromptData | null {
    // 🔄 캐싱 키 정규화 (내부 호출을 위해 기본 정규화)
    const normalizedKey = stepKey; // 이미 정규화된 상태로 전달됨
    
    const cached = this.cache.get(normalizedKey);
    
    if (!cached) {
      return null;
    }
    
    // 캐시 만료 확인
    const now = Date.now();
    if (now - cached.loadedAt > this.CACHE_DURATION) {
      this.cache.delete(normalizedKey);
      console.log(`🗑️ 자동 캐시 만료 정리: ${normalizedKey}`);
      return null;
    }
    
    return cached;
  }

  /**
   * 프롬프트를 캐시에 저장
   * @param stepKey - 단계 키 (정규화됨)
   * @param content - 프롬프트 내용
   */
  private setCachedPrompt(stepKey: string, content: string): void {
    // 🔄 캐싱 키 정규화 (내부 호출을 위해 기본 정규화)
    const normalizedKey = stepKey; // 이미 정규화된 상태로 전달됨
    
    this.cache.set(normalizedKey, {
      content,
      loadedAt: Date.now(),
      step: normalizedKey
    });
    
    console.log(`💾 캐시 저장 완료: ${normalizedKey} (${content.length} bytes)`);
  }

  /**
   * 로딩 실패시 사용할 폴백 프롬프트
   * @param stepKey - 단계 키
   * @returns 기본 프롬프트 내용
   */
  private getFallbackPrompt(stepKey: string): string {
    const fallbacks: Record<string, string> = {
      step0: `# Step 0: 음성-텍스트 변환
음성 파일을 텍스트로 정확하게 변환해주세요.
화자를 구분하고 타임스탬프를 포함해주세요.`,

      step1: `# Step 1: 정량 데이터 추출
텍스트에서 다음 정량 데이터를 추출해주세요:
- 키워드 빈도 분석
- 화자별 언급 횟수
- 비언어적 표현 분석`,

      step2: `# Step 2: Gemini 1차 분석
제공된 데이터를 바탕으로 조직문화에 대한 체계적 분석을 수행해주세요.
긍정적/부정적/중립적 현상을 균형있게 분석하고,
구조적 요인과 문화적 동인을 파악해주세요.`,

      step3: `# Step 3: Claude 컬쳐맵 생성
Gemini 분석 결과를 바탕으로 Dave Gray-Schein 4층위 모델의 Culture Map을 생성해주세요.
모든 요소가 연결되도록 하고, 학술적 근거를 포함해주세요.

출력 형식:
[결과] (긍정/부정) 내용
[행동] (긍정/부정) 내용
[유형_레버/카테고리] (긍정/부정) 내용 (개념: 이론명, 출처: 학자명, 분류: 학문분야)
[무형_레버] (긍정/부정) 내용 (개념: 이론명, 출처: 학자명, 분류: 학문분야)
[연결] [항목명] → [항목명] (직접)`,

      step4: `# Step 4: 최종 분석 보고서
Culture Map과 분석 결과를 바탕으로 실행 가능한 조직 개선 전략을 수립해주세요.
다음 7가지 핵심 질문에 답변해주세요:

1. 조직문화 상태 정의
2. 컬쳐맵 설명력 분석
3. 변화를 위한 핵심 요인
4. 최적 프로그램 설계
5. HR 기능 측면 제언
6. 신뢰도 평가
7. 추가 중요 요소`,

      step4a_claude_diagnosis: `# Step 4a: 조직문화 상태 진단
Culture Map과 Gemini 분석을 바탕으로 조직문화 상태를 진단해주세요.

## 3가지 핵심 질문
1. 조직문화 상태 정의
2. 컬쳄맵 설명력 분석
3. 인지편향 교차분석

각 질문에 대해 구체적이고 실용적인 답변을 제공해주세요.`,

      step4a1_culture_diagnosis: `# Step 4a-1: 조직문화 상태 정의 및 컬쳐맵 설명력 분석
Culture Map과 Gemini 분석을 바탕으로 조직문화 상태를 정의하고 컬쳐맵의 설명력을 분석해주세요.

## 2가지 핵심 질문
1. 조직문화 상태 정의
2. 컬쳐맵 설명력 분석

각 질문에 대해 구체적이고 실용적인 답변을 제공해주세요.`,

      step4a2_theory_analysis: `# Step 4a-2: 이론 해설 (전체 강제)
Culture Map의 모든 유형/무형 요소에 기재된 이론을 빠짐없이 해설해주세요.

## ⚠️ 중요: 완전성 보장
- 3개 제한 없이 모든 요소를 다뤄야 함
- 분량 제한으로 생략하지 말고 전체를 완료

## 분석 구조 (각 이론마다 반복)
- 이론 명: [이론의 이름] (저자, 연도)
- 핵심 개념: [해당 이론을 1-2 문장으로 요약]
- 선정 이유 및 적용 근거: [구체적 설명]`,

      step4a3_bias_analysis: `# Step 4a-3: 인지편향 교차분석 및 한국적 문화 맥락
구성원 인식 vs 객관적 현실을 교차분석하고 한국적 문화 맥락에서 해석해주세요.

## 2가지 핵심 분석
1. 인지편향 교차분석
   - 과대평가 요소 (높은 인식 + 낮은 실제 영향)
   - 과소평가 요소 (낮은 인식 + 높은 실제 영향)  
   - 적정평가 요소 (인식과 실제 영향 일치)

2. 한국적 문화 맥락 분석
   - 홉스테더 문화차원 모델
   - 국내 권위자 이론 (김인수, 조동성, 신유근)
   - 디지털 환경/세대 특수성`,

      step4b_claude_strategy: `# Step 4b: 실행전략 수립
Step 4a 진단 결과를 바탕으로 구체적인 실행전략을 수립해주세요.

## 4가지 핵심 질문
4. 변화를 위한 핵심 요인
5. 최적 프로그램 설계 (Option A vs Option B)
6. HR 기능 측면 제언
7. 신뢰도 평가 및 추가 고려사항

각 질문에 대해 실행 가능한 방안을 제시해주세요.`,

      stepworkshop: `# Culture Map 생성을 위한 AI 프롬프트

## 역할

당신은 조직 문화, 변화관리, 행동경제학, 조직개발, 심리학 등 다양한 학문을 융합하여 분석하는 다학제적 전문가입니다.

## 임무

이제부터 제공할 자료(이미지 등)는 조직 문화 워크샵에서 참여자들이 도출한 '결과'와 '행동' 포스트잇입니다. 이 자료를 분석하여, 아래의 규칙에 따라 완전한 '컬처 맵' 텍스트를 생성해주세요.

### 분석 단계

1. **현상 정리**: 포스트잇 내용을 정확히 인식(OCR)하여 [결과]와 [행동] 항목으로 정리
2. **심층적 요인 추론**: 각 [행동]에 대해 유발하는 핵심적인 '유형적 요인'과 '무형적 요인'을 3개씩 추론
3. **인과관계 연결**: 모든 요소들 간의 논리적 연결 관계를 [연결] 또는 [간접연결]로 매핑

### 출력 형식 (매우 중요)

다음 형식을 정확히 준수해주세요:
- **[결과]** (긍정/부정) 구체적 성과나 결과
- **[행동]** (긍정/부정) 관찰되는 구체적 행동
- **[유형_레버/카테고리]** (긍정/부정) 시스템 요소 (개념: 이론명, 출처: 학자명, 분류: 학문분야)
- **[무형_레버]** (긍정/부정) 문화적 동인 (개념: 이론명, 출처: 학자명, 분류: 학문분야)
- **[연결]** [A 항목 전체] → [B 항목 전체] (직접)
- **[간접연결]** [A 항목 전체] → [B 항목 전체] (간접)

### 예시

[결과] (부정) 혁신 아이디어 부족
[행동] (부정) 회의 시간에 침묵한다
[유형_레버/구조] (부정) 수직적 의사결정 구조 (개념: 계층제, 출처: Max Weber, 분류: 조직구조)
[무형_레버] (부정) 내 의견은 중요하지 않다고 믿는다 (개념: 학습된 무기력, 출처: Martin Seligman, 분류: 인지심리)
[연결] [유형_레버/구조] (부정) 수직적 의사결정 구조 → [행동] (부정) 회의 시간에 침묵한다 (직접)
[연결] [무형_레버] (부정) 내 의견은 중요하지 않다고 믿는다 → [행동] (부정) 회의 시간에 침묵한다 (직접)
[연결] [행동] (부정) 회의 시간에 침묵한다 → [결과] (부정) 혁신 아이디어 부족 (직접)
[간접연결] [유형_레버/구조] (부정) 수직적 의사결정 구조 → [무형_레버] (부정) 내 의견은 중요하지 않다고 믿는다 (간접)

---

이제 포스트잇 사진과 함께 이 프롬프트를 사용하여 완전한 Culture Map 텍스트를 생성해주세요.`,

      // 'workshop' 키에 대한 별칭 지원
      workshop: `# Workshop 프롬프트 로딩 실패
파일 기반 프롬프트를 로드할 수 없습니다.
관리자에게 문의해주세요.`,

      // 워크샵 분석 전용 프롬프트 (새로 추가)
      workshop_analysis: `# Workshop Analysis 프롬프트 로딩 실패
분석용 프롬프트 파일을 로드할 수 없습니다.
관리자에게 문의해주세요.`
    };

    return fallbacks[stepKey] || `# ${stepKey.toUpperCase()}
기본 프롬프트 내용을 로딩할 수 없습니다.
관리자에게 문의해주세요.`;
  }

  /**
   * 모든 Step 프롬프트를 미리 로딩 (선택적)
   * @returns 로딩 결과 맵
   */
  async preloadAllPrompts(): Promise<Map<string, PromptLoadResult>> {
    const results = new Map<string, PromptLoadResult>();
    const steps = ['0', '1', '2', '3', '4a_claude_diagnosis', '4b_claude_strategy', 'workshop'];

    console.log('🔄 모든 프롬프트 미리 로딩 시작...');

    for (const step of steps) {
      try {
        const result = await this.loadPrompt(step);
        // 🔄 정규화된 키 사용
        const normalizedKey = this.normalizeStepKey(step);
        results.set(normalizedKey, result);
        
        console.log(`✅ 미리 로딩 성공: ${normalizedKey}`);
      } catch (error) {
        const normalizedKey = this.normalizeStepKey(step);
        console.error(`프롬프트 미리 로딩 실패: ${normalizedKey}`, error);
        
        // 실패 시 fallback 프롬프트 사용
        results.set(normalizedKey, {
          success: false,
          content: this.getFallbackPrompt(normalizedKey),
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          fallbackUsed: true
        });
      }
    }

    console.log(`✅ 프롬프트 미리 로딩 완료 (${results.size}개 항목)`);
    return results;
  }

  /**
   * 특정 Step의 캐시 클리어 (개선된 로깅)
   * @param step - 클리어할 Step (지정하지 않으면 전체 클리어)
   */
  clearCache(step?: number | string): void {
    if (step !== undefined) {
      // 🔄 캐싱 키 정규화 적용
      const normalizedKey = this.normalizeStepKey(step);
      
      const existed = this.cache.has(normalizedKey);
      this.cache.delete(normalizedKey);
      this.resetErrorCount(normalizedKey); // 에러 카운트도 함께 초기화
      
      this.log('info', '프롬프트 캐시 클리어', { 
        stepKey: normalizedKey, 
        existed,
        reason: 'manual_clear'
      });
    } else {
      const cacheSize = this.cache.size;
      const errorCountSize = this.errorCounts.size;
      
      this.cache.clear();
      this.errorCounts.clear();
      
      this.log('info', '모든 프롬프트 캐시 클리어', { 
        cacheCleared: cacheSize, 
        errorCountsCleared: errorCountSize,
        reason: 'full_clear'
      });
    }
  }

  /**
   * 캐시 상태 조회
   * @returns 캐시된 프롬프트 목록
   */
  getCacheStatus(): Array<{ step: string; displayName: string; loadedAt: number; size: number }> {
    const status: Array<{ step: string; displayName: string; loadedAt: number; size: number }> = [];
    
    for (const [step, data] of this.cache.entries()) {
      // 🎆 사용자 친화적인 표시명 생성
      let displayName = step;
      if (step === 'stepworkshop') {
        displayName = 'workshop (워크샵 전용)';
      } else if (step.startsWith('step') && !isNaN(Number(step.replace('step', '')))) {
        displayName = `Step ${step.replace('step', '')}`;
      } else if (step === 'step4a_claude_diagnosis') {
        displayName = 'Step 4a (진단)';
      } else if (step === 'step4b_claude_strategy') {
        displayName = 'Step 4b (전략)';
      }
      
      status.push({
        step,
        displayName,
        loadedAt: data.loadedAt,
        size: data.content.length
      });
    }
    
    return status.sort((a, b) => a.step.localeCompare(b.step));
  }

  /**
   * 프롬프트 내용 검증 (개선됨)
   * @param content - 검증할 프롬프트 내용
   * @returns 검증 결과
   */
  validatePrompt(content: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    this.log('debug', '프롬프트 유효성 검사 시작');

    // 1. 내용 존재 여부
    if (!content || content.trim().length === 0) {
      issues.push('프롬프트 내용이 비어있습니다');
      this.log('warn', '유효성 검사 실패: 내용 없음');
      return { isValid: false, issues };
    }

    // 2. 내용 길이
    if (content.length < 50) {
      issues.push(`프롬프트 내용이 너무 짧습니다 (현재 ${content.length}자, 50자 미만)`);
      this.log('warn', `유효성 검사 실패: 내용 짧음 (${content.length}자)`);
    } else {
      this.log('debug', '유효성 검사 통과: 내용 길이');
    }

    // 3. HTML 태그 포함 여부
    if (this.containsHtmlTags(content)) {
      issues.push('HTML 태그가 포함되어 있습니다 (에러 페이지 가능성)');
      this.log('warn', '유효성 검사 실패: HTML 태그 포함');
    } else {
      this.log('debug', '유효성 검사 통과: HTML 태그 없음');
    }

    // 4. 마크다운 헤더 존재 여부
    if (!content.includes('#')) {
      issues.push('마크다운 헤더가 없습니다');
      this.log('warn', '유효성 검사 실패: 마크다운 헤더 없음');
    } else {
      this.log('debug', '유효성 검사 통과: 마크다운 헤더 존재');
    }

    // 5. 인코딩 확인
    try {
      const decoded = decodeURIComponent(encodeURIComponent(content));
      if (decoded !== content) {
        issues.push('인코딩 문제가 있을 수 있습니다');
        this.log('warn', '유효성 검사 실패: 인코딩 문제');
      } else {
        this.log('debug', '유효성 검사 통과: 인코딩');
      }
    } catch (error) {
      issues.push('인코딩 검증 중 오류 발생');
      this.log('error', '유효성 검사 중 인코딩 오류', error);
    }
    
    const isValid = issues.length === 0;
    
    if (!isValid) {
      this.log('warn', '프롬프트 검증 최종 실패', { issues, contentLength: content.length });
    } else {
      this.log('info', '프롬프트 검증 최종 성공');
    }
    
    return { isValid, issues };
  }

  /**
   * 프롬프트 내용에 변수 삽입
   * @param content - 원본 프롬프트 내용
   * @param variables - 삽입할 변수들
   * @returns 변수가 삽입된 프롬프트
   */
  interpolateVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
      // {{key}} 형태의 변수를 value로 교체
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const promptLoader = new PromptLoader();

// 편의 함수들
export const loadStepPrompt = (step: number | string) => promptLoader.loadPrompt(step);
export const preloadAllPrompts = () => promptLoader.preloadAllPrompts();
export const clearPromptCache = (step?: number | string) => promptLoader.clearCache(step);
export const getPromptCacheStatus = () => promptLoader.getCacheStatus();

// 🔥 즉시 실행: 전체 캐시 클리어하여 새로운 파일 구조 적용
if (typeof window !== 'undefined') {
  // 브라우저 환경에서만 실행
  setTimeout(() => {
    promptLoader.clearCache(); // 전체 캐시 클리어
    console.log('🚀 전체 프롬프트 캐시 클리어 완료 - step3.md 파일 수정사항이 적용됩니다');
  }, 50); // 더 빠른 실행
}

export default promptLoader;