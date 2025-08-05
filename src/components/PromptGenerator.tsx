import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateAnalysisPrompt } from '../utils/prompt';
import { promptLoader } from '../utils/promptLoader';
import type { NoteData, ConnectionData } from '../types/culture';
import './PromptGenerator.css';

interface StepProps {
  stepNumber: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isCompleted: boolean;
}

const Step: React.FC<StepProps> = ({ stepNumber, title, isOpen, onToggle, children, isCompleted }) => {
    const Icon = () => {
        // 아이콘 SVG들을 여기에 정의합니다.
        switch (stepNumber) {
            case 0: return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 19C23 20.1046 22.1046 21 21 21H3C1.89543 21 1 20.1046 1 19V5C1 3.89543 1.89543 3 3 3H21C22.1046 3 23 3.89543 23 5V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 8.5L10.5 10.5L15.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.5 14.5H18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 14.5H10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            case 1: return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 15C3 15 5 14 7 15C9 16 11 15 13 14C15 13 17 14 19 13C21 12 21 10 21 10M3 20C3 20 5 19 7 20C9 21 11 20 13 19C15 18 17 19 19 18C21 17 21 15 21 15M3 10C3 10 5 9 7 10C9 11 11 10 13 9C15 8 17 9 19 8C21 7 21 5 21 5M12 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            case 2: return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 21H7C6.46957 21 5.96086 20.7893 5.58579 20.4142C5.21071 20.0391 5 19.5304 5 19V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H14L19 8V19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 17H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            case 3: return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            default: return null;
        }
    };

    return (
        <div className={`step-item ${isOpen ? 'open' : ''} ${isCompleted ? 'completed' : ''}`}>
            <div className="step-header" onClick={onToggle}>
                <div className="step-title">
                    <div className="step-icon"><Icon /></div>
                    <span>{stepNumber}. {title}</span>
                </div>
                <div className="step-toggle">{isOpen ? '−' : '+'}</div>
            </div>
            {isOpen && <div className="step-content">{children}</div>}
        </div>
    );
};

// Claude 이중 역할 프롬프트 상수들 (동적 로딩 예정)
const CLAUDE_CULTUREMAP_PROMPT = `# Claude 컬쳐맵 생성 전문가

## 역할
당신은 Dave Gray-Schein 4층위 조직문화 모델의 전문가로서, 제공된 데이터를 완전히 연결된 Culture Map으로 변환하는 전문가입니다.

## 임무
아래 규칙에 따라 입력 데이터를 분석하여 완전한 Culture Map 텍스트를 생성해주세요.

## 분석 규칙
1. **현상 식별**: 제공된 데이터에서 결과와 행동 패턴 식별
2. **심층 요인 추론**: 각 행동의 근본 원인이 되는 유형/무형 요인 도출
3. **인과관계 매핑**: 모든 요소 간 논리적 연결 관계 설정
4. **학술적 근거**: 각 요소에 이론적 근거와 출처 명시

## 출력 형식
다음 형식으로 정확히 생성:
- **[결과]** (긍정/부정) 구체적 성과나 결과
- **[행동]** (긍정/부정) 관찰되는 구체적 행동
- **[유형_레버/카테고리]** (긍정/부정) 시스템 요소 (개념: ..., 출처: ..., 분류: ...)
- **[무형_레버]** (긍정/부정) 문화적 동인 (개념: ..., 출처: ..., 분류: ...)
- **[연결]** 직접적 원인-결과 관계 (직접)
- **[간접연결]** 상호작용 및 복합적 관계 (간접)

한경에 붙여 넣을 데이터를 기다리고 있습니다.`;

const CLAUDE_REPORT_PROMPT = `# Claude 분석 보고서 전문가

## 역할
당신은 조직문화 컴설팅 및 변화관리 전문가로서, Culture Map 분석 결과를 바탕으로 실행 가능한 조직 개선 전략을 수립하는 전문가입니다.

## 임무
생성된 Culture Map을 바탕으로 7가지 핵심 질문에 대한 명확하고 실용적인 답변을 제공해주세요.

## 최종분석 7가지 핵심 질문

### 1. 조직문화 상태 정의
**질문**: 이 조직의 현재 문화를 한 문장으로 정의한다면?
**답변 요구**: Culture Map의 핵심 특징을 반영한 간결한 정의

### 2. 컴쳐맵 설명력 분석
**질문**: 이 컴쳐맵이 조직의 현상을 얼마나 잘 설명하는가?
**답변 요구**: 연결성, 논리성, 현실 반영도 평가

### 3. 변화를 위한 핵심 요인
**질문**: 긍정적 변화를 만들기 위해 가장 중요한 3가지 레버는?
**답변 요구**: 우선순위와 이유, 예상 효과 명시

### 4. 최적 프로그램 설계
**질문**: 이 조직에 가장 적합한 문화 개선 프로그램은?
**답변 요구**: 구체적 실행 방안과 단계별 로드맵

### 5. HR 기능 측면 제언
**질문**: HR 기능(채용/평가/보상/개발) 측면에서 우선 개선이 필요한 영역은?
**답변 요구**: 구체적 HR 실행 방안

### 6. 신뢰도 평가
**질문**: 이 분석의 신뢰도는 얼마나 되는가?
**답변 요구**: 0-100% 점수와 이유, 한계점 명시

### 7. 추가 중요 요소
**질문**: Culture Map에 포함되지 않았지만 중요할 수 있는 요소가 있는가?
**답변 요구**: 추가 고려사항과 보완 방안

## 출력 형식
각 질문에 대해 명확하고 실용적인 답변을 제공해주세요.

참고할 Culture Map을 기다리고 있습니다.`;

// Google Drive 3단계 워크플로우 프롬프트 상수들 (향후 동적 로딩 예정)
const NOTEBOOK_LM_PROMPT = `# NotebookLM 음성 전사 및 특별 강조점 추출

## 역할
당신은 조직문화 컨설팅 전문가의 음성 인터뷰를 전사하고 핵심 포인트를 추출하는 전문가입니다.

## 임무
제공된 음성 파일(m4a)을 정확하게 텍스트로 변환하고, 조직문화 분석에 중요한 특별 강조점들을 식별해주세요.

## 전사 시 주의사항
1. **정확한 전사**: 발화자의 말을 정확하게 기록
2. **화자 구분**: 인터뷰어와 응답자를 명확히 구분
3. **비언어적 표현**: 침묵, 망설임, 감정적 반응도 기록
4. **맥락 보존**: 질문과 답변의 연결성 유지

## 특별 강조점 식별
다음 요소들에 대해 특별한 주의를 기울여주세요:
- **반복되는 키워드나 주제**
- **감정적 반응이 강한 부분**
- **망설임이나 회피하는 주제**
- **구체적인 사례나 에피소드**
- **조직 내 갈등이나 문제 상황**
- **성과나 성공 사례**
- **변화에 대한 저항이나 수용**

## 출력 형식
### 전사 내용
[전체 인터뷰 내용을 정확하게 전사]

### 특별 강조점
1. **핵심 키워드**: [반복되는 중요 키워드들]
2. **감정적 반응**: [강한 감정 반응을 보인 주제들]
3. **회피 주제**: [명확히 답변하지 않거나 회피한 주제들]
4. **구체적 사례**: [언급된 구체적인 사례나 에피소드들]
5. **조직 이슈**: [조직 내 문제나 갈등 상황들]
6. **성과 사례**: [긍정적 성과나 성공 사례들]

음성 파일을 업로드하고 이 프롬프트를 사용해주세요.`;

const GEMINI_ANALYSIS_PROMPT = `# Gemini Deep Research: 조직문화 1차 분석

## 역할
당신은 조직문화, 변화관리, 행동경제학 분야의 전문 연구자로서 NotebookLM이 전사한 인터뷰 내용을 종합적으로 분석하는 전문가입니다.

## 임무
제공된 전사 내용과 특별 강조점을 바탕으로 조직문화에 대한 포괄적인 1차 분석을 수행해주세요.

## 분석 프레임워크
Dave Gray와 Edgar Schein의 조직문화 4층위 모델을 기반으로 분석하되, 다음과 같은 구조로 정리해주세요:

### 1. 현상 분석 (What)
- **관찰된 결과들**: 인터뷰에서 언급된 구체적인 성과, 문제, 결과들
- **관찰된 행동들**: 조직 구성원들의 실제 행동 패턴들
- **반복 패턴**: 여러 번 언급되거나 강조된 패턴들

### 2. 구조 및 시스템 분석 (How)
- **유형적 요인들**: 조직구조, 프로세스, 시스템, 정책, 보상체계
- **의사결정 구조**: 권한과 책임의 분배 방식
- **커뮤니케이션 채널**: 정보 전달 방식과 경로

### 3. 문화적 동인 분석 (Why)
- **무형적 요인들**: 신념, 가치관, 가정, 심리적 요인
- **집단 정체성**: 조직 구성원들의 소속감과 정체성
- **변화에 대한 태도**: 혁신과 변화에 대한 수용성

### 4. 인과관계 가설 설정
- **직접적 연결**: 명확한 원인-결과 관계들
- **간접적 영향**: 복합적이고 상호작용하는 관계들
- **악순환/선순환**: 자기강화 메커니즘들

## 학술적 근거 포함
각 분석 요소에 대해 다음을 포함해주세요:
- **이론적 근거**: 관련 학술 이론이나 모델
- **연구 사례**: 유사한 조직문화 연구 사례
- **전문가 견해**: 권위있는 학자나 컨설팅펌의 관점

## 출력 요구사항
- **구조화된 분석**: 위 4개 영역별로 체계적 정리
- **증거 기반**: 인터뷰 내용의 구체적 인용과 근거
- **실행 가능한 인사이트**: 개선 방향성 제시
- **후속 분석 가이드**: Claude 분석을 위한 핵심 포인트 요약

전사된 인터뷰 내용을 붙여넣고 이 프롬프트를 사용해주세요.`;

const CLAUDE_FINAL_PROMPT = `# Claude 최종 분석: Dave Gray-Schein 4층위 정밀 분석

## 역할
당신은 조직문화, 경영학, 심리학, 행동경제학 등 다학제적 관점을 통합하여 조직문화를 분석하는 세계 최고 수준의 전문가입니다. 특히 Dave Gray와 Edgar Schein의 조직문화 4층위 모델을 정밀하게 적용하는 전문가입니다.

## 임무
Gemini가 분석한 1차 결과를 바탕으로 Dave Gray-Schein 4층위 모델에 따른 정밀한 Culture Map을 생성하고, 학술적 근거를 보강하여 최종 분석 보고서를 작성해주세요.

## Dave Gray-Schein 4층위 모델
### 1층: 결과 (Results) - "무엇이 일어나고 있는가?"
- 측정 가능한 성과, KPI, 고객만족도, 재무성과
- 직접 관찰 가능한 조직의 산출물

### 2층: 행동 (Behaviors) - "사람들이 실제로 무엇을 하는가?"
- 일상적 업무 행동, 의사결정 패턴, 상호작용 방식
- 관찰 가능한 구체적 행동들

### 3층: 시스템 (Systems) - "어떤 구조가 행동을 만드는가?"
- **유형적 요인**: 조직구조, 프로세스, 정책, 보상시스템, 기술
- 행동을 유발하거나 제약하는 공식적 시스템들

### 4층: 문화 (Culture) - "왜 그런 시스템이 존재하는가?"
- **무형적 요인**: 신념, 가치관, 가정, 정체성, 심리적 동인
- 시스템을 만들고 유지하는 근본적 문화적 동력

## 분석 요구사항

### A. Culture Map 구성요소 생성
각 구성요소를 다음 형식으로 정확히 생성해주세요:
- **[결과]** (긍정/부정) 구체적 성과나 결과
- **[행동]** (긍정/부정) 관찰되는 구체적 행동
- **[유형_레버/카테고리]** (긍정/부정) 시스템 요소 (개념: ..., 출처: ..., 분류: ...)
  - 카테고리: 전략, 구조, 프로세스, 보상, 사람, 리더십
- **[무형_레버]** (긍정/부정) 문화적 동인 (개념: ..., 출처: ..., 분류: ...)

### B. 인과관계 매핑
- **[연결]** 직접적 원인-결과 관계 (직접)
- **[간접연결]** 상호작용 및 복합적 관계 (간접)

### C. 학술적 근거 강화
각 요소에 다음을 포함:
- **개념**: 학술적 개념이나 이론명
- **출처**: 권위있는 학자, 연구, 또는 컨설팅펌
- **분류**: 학문 분야나 이론 카테고리

## 분석 품질 기준
1. **완전성**: 모든 레버가 다른 요소와 연결됨
2. **정확성**: 학술적 근거의 정확한 인용
3. **일관성**: 논리적 인과관계의 일관성
4. **실용성**: 조직 개선에 활용 가능한 인사이트
5. **깊이**: 표면적 관찰을 넘어선 근본 원인 분석

## 최종 산출물
1. **Culture Map 텍스트**: 위 형식에 따른 구조화된 맵
2. **핵심 인사이트**: 3-5개의 핵심 발견사항
3. **개선 권고안**: 구체적이고 실행 가능한 개선 방향
4. **학술적 근거 요약**: 활용된 주요 이론과 연구들

Gemini 분석 결과를 붙여넣고 이 프롬프트를 사용해주세요.`;

interface PromptGeneratorProps {
  onGenerateMap: (text: string) => void;
  onClear: () => void;
  onShowReport: (report: string) => void;
  notes: NoteData[];
  connections: ConnectionData[];
}

type AnalysisMode = 'workshop' | 'professional';

const PromptGenerator: React.FC<PromptGeneratorProps> = ({ onGenerateMap, onClear, onShowReport, notes, connections }) => {
  const [analysisInput, setAnalysisInput] = useState('');
  const [mapCreationText, setMapCreationText] = useState('');
  const [openStep, setOpenStep] = useState<number>(0);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('workshop');
  
  // 동적 워크샵 프롬프트 상태 (promptLoader를 통해 로딩)
  const [workshopPrompt, setWorkshopPrompt] = useState<string>('');
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  
  // 워크샵 프롬프트 동적 로딩
  useEffect(() => {
    const loadWorkshopPrompt = async () => {
      try {
        setPromptLoading(true);
        console.log('🔄 워크샵 프롬프트 동적 로딩 시작...');
        
        const result = await promptLoader.loadPrompt('stepworkshop');
        
        if (result.success && result.content.trim().length > 0) {
          setWorkshopPrompt(result.content);
          console.log('✅ 워크샵 프롬프트 동적 로딩 성공');
        } else {
          console.warn('⚠️ 워크샵 프롬프트 로딩 실패, 폴백 사용:', result.error);
          // promptLoader에서 이미 폴백 프롬프트를 제공하므로 해당 내용 사용
          setWorkshopPrompt(result.content);
        }
      } catch (error) {
        console.error('❌ 워크샵 프롬프트 로딩 중 오류:', error);
        // 최종 폴백: promptLoader의 기본 폴백 프롬프트 사용
        const fallbackResult = await promptLoader.loadPrompt('stepworkshop');
        setWorkshopPrompt(fallbackResult.content);
      } finally {
        setPromptLoading(false);
      }
    };
    
    loadWorkshopPrompt();
  }, []); // 컴포넌트 마운트시 한 번만 실행
  
  // 자동실행 기능 제거됨 - 수동 프롬프트 복사 방식으로 단순화

  const handleCopyWorkshopPrompt = () => {
    navigator.clipboard.writeText(workshopPrompt);
    alert('워크숍 프롬프트가 클립보드에 복사되었습니다. 포스트잇 사진과 함께 AI에게 보내주세요.');
  };

  // STEP 0 프롬프트 복사 (NotebookLM용)
  const handleCopyStep0Prompt = async () => {
    try {
      console.log('🔄 STEP 0 프롬프트 로딩 시작...');
      const result = await promptLoader.loadPrompt('step0');
      
      if (result.success && result.content.trim().length > 0) {
        navigator.clipboard.writeText(result.content);
        console.log('✅ STEP 0 프롬프트 로딩 및 복사 성공');
        alert('STEP 0 (NotebookLM 전사용) 프롬프트가 클립보드에 복사되었습니다.');
      } else {
        console.warn('⚠️ STEP 0 로딩 실패, 폴백 프롬프트 사용:', result.error);
        navigator.clipboard.writeText(NOTEBOOK_LM_PROMPT);
        alert('STEP 0 로딩에 실패하여 기본 프롬프트를 사용합니다.');
      }
    } catch (error) {
      console.error('❌ STEP 0 프롬프트 로딩 중 오류:', error);
      navigator.clipboard.writeText(NOTEBOOK_LM_PROMPT);
      alert('프롬프트 로딩 중 오류가 발생하여 기본 프롬프트를 사용합니다.');
    }
  };

  // STEP 1 프롬프트 복사 (NotebookLM용)
  const handleCopyStep1Prompt = async () => {
    try {
      console.log('🔄 STEP 1 프롬프트 로딩 시작...');
      const result = await promptLoader.loadPrompt('step1');
      
      if (result.success && result.content.trim().length > 0) {
        navigator.clipboard.writeText(result.content);
        console.log('✅ STEP 1 프롬프트 로딩 및 복사 성공');
        alert('STEP 1 (NotebookLM 데이터 추출용) 프롬프트가 클립보드에 복사되었습니다.');
      } else {
        console.warn('⚠️ STEP 1 로딩 실패, 폴백 프롬프트 사용:', result.error);
        navigator.clipboard.writeText(NOTEBOOK_LM_PROMPT);
        alert('STEP 1 로딩에 실패하여 기본 프롬프트를 사용합니다.');
      }
    } catch (error) {
      console.error('❌ STEP 1 프롬프트 로딩 중 오류:', error);
      navigator.clipboard.writeText(NOTEBOOK_LM_PROMPT);
      alert('프롬프트 로딩 중 오류가 발생하여 기본 프롬프트를 사용합니다.');
    }
  };

  const handleCopyGeminiPrompt = async () => {
    try {
      console.log('🔄 STEP 2 프롬프트 로딩 시작...');
      const result = await promptLoader.loadPrompt(2);
      
      if (result.success && result.content.trim().length > 0) {
        navigator.clipboard.writeText(result.content);
        console.log('✅ STEP 2 프롬프트 로딩 및 복사 성공');
        alert('STEP 2 (Gemini 1차 분석용) 프롬프트가 클립보드에 복사되었습니다.');
      } else {
        console.warn('⚠️ STEP 2 로딩 실패, 폴백 프롬프트 사용:', result.error);
        navigator.clipboard.writeText(GEMINI_ANALYSIS_PROMPT);
        alert('STEP 2 로딩에 실패하여 기본 프롬프트를 사용합니다.');
      }
    } catch (error) {
      console.error('❌ STEP 2 프롬프트 로딩 중 오류:', error);
      navigator.clipboard.writeText(GEMINI_ANALYSIS_PROMPT);
      alert('프롬프트 로딩 중 오류가 발생하여 기본 프롬프트를 사용합니다.');
    }
  };

  const handleCopyClaudePrompt = async () => {
    try {
      console.log('🔄 전문 컨설팅 분석용 step3.md 프롬프트 로딩 시작...');
      const result = await promptLoader.loadPrompt('step3');
      
      if (result.success && result.content.trim().length > 0) {
        navigator.clipboard.writeText(result.content);
        console.log('✅ step3.md 프롬프트 로딩 및 복사 성공');
        alert('전문 컨설팅 분석 프롬프트(step3.md)가 클립보드에 복사되었습니다. Claude에 Gemini 분석 결과와 함께 사용하세요.');
      } else {
        console.warn('⚠️ step3.md 로딩 실패, 하드코딩된 프롬프트 사용:', result.error);
        navigator.clipboard.writeText(CLAUDE_FINAL_PROMPT);
        alert('step3.md 로딩에 실패하여 기본 프롬프트를 사용합니다. Claude에 Gemini 분석 결과와 함께 사용하세요.');
      }
    } catch (error) {
      console.error('❌ step3.md 프롬프트 로딩 중 오류:', error);
      navigator.clipboard.writeText(CLAUDE_FINAL_PROMPT);
      alert('프롬프트 로딩 중 오류가 발생하여 기본 프롬프트를 사용합니다.');
    }
  };

  const handleGenerateClick = () => {
    onGenerateMap(mapCreationText);
    if(mapCreationText) setOpenStep(2);
  };
  
  const handleCopyPromptClick = () => {
    const prompt = generateAnalysisPrompt(notes, connections);
    navigator.clipboard.writeText(prompt);
    alert('분석 프롬프트가 클립보드에 복사되었습니다. 원하는 AI에 붙여넣어 분석을 요청하세요.');
    setOpenStep(3);
  };

  const handleShowReportClick = () => {
    onShowReport(analysisInput);
  };

  // 자동실행 기능들 모두 제거됨 - 수동 프롬프트 복사 방식으로 단순화

  const isStep0Completed = false; // 워크샵 단계는 외부에서 완료되므로 항상 false
  const isStep1Completed = notes.length > 0;
  const isStep2Completed = isStep1Completed;

  return (
    <div className="prompt-generator">
      {/* 분석 모드 선택 탭 */}
      <div className="analysis-mode-tabs">
        <button 
          className={`mode-tab ${analysisMode === 'workshop' ? 'active' : ''}`}
          onClick={() => setAnalysisMode('workshop')}
        >
          📋 워크샵 분석 (교육용)
        </button>
        <button 
          className={`mode-tab ${analysisMode === 'professional' ? 'active' : ''}`}
          onClick={() => setAnalysisMode('professional')}
        >
          🎯 전문 컨설팅 분석
        </button>
      </div>

      {analysisMode === 'workshop' ? (
        <div className="workshop-mode">
      <Step
        stepNumber={0}
        title="포스트잇 사진 분석"
        isOpen={openStep === 0}
        onToggle={() => setOpenStep(openStep === 0 ? 1 : 0)}
        isCompleted={isStep0Completed}
      >
        <p>워크샵에서 참여자들이 만든 <strong>결과-행동 포스트잇 사진</strong>을 AI에게 분석 요청하세요.</p>
        
        <div className="llm-links">
          <h4>추천 AI 도구</h4>
          <div className="button-group">
            <button 
              onClick={() => window.open('https://chatgpt.com', '_blank')}
              className="btn-llm"
            >
              ChatGPT
            </button>
            <button 
              onClick={() => window.open('https://claude.ai', '_blank')}
              className="btn-llm"
            >
              Claude
            </button>
            <button 
              onClick={() => window.open('https://gemini.google.com', '_blank')}
              className="btn-llm"
            >
              Gemini
            </button>
          </div>
        </div>

        <div className="workshop-instructions">
          <h4>사용 방법</h4>
          <ol>
            <li>아래 프롬프트를 복사하세요</li>
            <li>AI 도구에 접속하여 프롬프트를 붙여넣으세요</li>
            <li>포스트잇 사진을 함께 첨부하세요</li>
            <li>AI가 생성한 결과를 다음 단계에서 사용하세요</li>
          </ol>
        </div>

        <button onClick={handleCopyWorkshopPrompt} className="btn-primary">
          워크샵 분석 프롬프트 복사
        </button>
      </Step>

      <Step
        stepNumber={1}
        title="컬처 맵 그리기"
        isOpen={openStep === 1}
        onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
        isCompleted={isStep1Completed}
      >
        <p>AI가 분석한 결과를 아래에 붙여넣고 '맵 그리기' 버튼을 누르세요.</p>
        <textarea
          value={mapCreationText}
          onChange={(e) => setMapCreationText(e.target.value)}
          placeholder={`AI 분석 결과를 여기에 붙여넣으세요.\n\n(예시)\n[결과] (긍정) 프로젝트 성공률 향상\n[행동] (부정) 보고 절차가 복잡하다\n[유형_레버/구조] (부정) 다단계 승인 구조 (개념: 관료제, 출처: Max Weber, 분류: 조직구조)\n[연결] [유형_레버/구조] (부정) 다단계 승인 구조 → [행동] (부정) 보고 절차가 복잡하다 (직접)`}
          rows={10}
        />
        <div className="button-group">
          <button onClick={handleGenerateClick} disabled={!mapCreationText}>맵 그리기/수정</button>
          <button onClick={onClear} className="btn-secondary">전체 삭제</button>
        </div>
      </Step>

      <Step
        stepNumber={2}
        title="분석 프롬프트 생성"
        isOpen={openStep === 2}
        onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
        isCompleted={isStep2Completed}
      >
        <p>현재 맵을 기반으로 심층 분석 프롬프트를 생성합니다.</p>
        <button onClick={handleCopyPromptClick} disabled={!isStep1Completed}>
          분석 프롬프트 복사
        </button>
      </Step>

      <Step
        stepNumber={3}
        title="분석 보고서 보기"
        isOpen={openStep === 3}
        onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
        isCompleted={!!analysisInput}
      >
        <p>AI가 생성한 '분석 보고서' 텍스트 전체를 아래에 붙여넣고 '보고서 보기' 버튼을 누르세요.</p>
        <textarea
          value={analysisInput}
          onChange={(e) => setAnalysisInput(e.target.value)}
          placeholder="여기에 분석 보고서 텍스트를 붙여넣으세요..."
          rows={8}
        />
        <button onClick={handleShowReportClick} disabled={!analysisInput}>보고서 보기</button>
      </Step>
        </div>
      ) : (
        <div className="professional-mode">
          <Step
            stepNumber={0}
            title="NotebookLM STEP 0: 음성 전사"
            isOpen={openStep === 0}
            onToggle={() => setOpenStep(openStep === 0 ? 1 : 0)}
            isCompleted={false}
          >
            <p><strong>STEP 0</strong>: 음성 파일(m4a)을 NotebookLM에 업로드하고 <strong>1차 전사</strong>를 수행하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 STEP 0 목표</h4>
              <ul>
                <li>정확한 음성 → 텍스트 변환</li>
                <li>화자 구분 (Speaker Diarization)</li>
                <li>타임스탬프 삽입</li>
                <li>후속 검수를 위한 1차 원고 생성</li>
              </ul>
            </div>

            <div className="llm-links">
              <h4>NotebookLM 접속</h4>
              <button 
                onClick={() => window.open('https://notebooklm.google.com', '_blank')}
                className="btn-llm"
              >
                📝 NotebookLM 열기
              </button>
            </div>

            <div className="step-instructions">
              <h4>STEP 0 사용 방법</h4>
              <ol>
                <li>아래 STEP 0 프롬프트를 복사하세요</li>
                <li>NotebookLM에 접속하여 새 노트북을 만드세요</li>
                <li>음성 파일(m4a)을 업로드하세요</li>
                <li>STEP 0 프롬프트를 붙여넣고 전사를 요청하세요</li>
                <li>결과를 STEP 1에서 사용하세요</li>
              </ol>
            </div>

            <button onClick={handleCopyStep0Prompt} className="btn-primary">
              STEP 0 프롬프트 복사
            </button>
          </Step>

          <Step
            stepNumber={1}
            title="NotebookLM STEP 1: 데이터 추출"
            isOpen={openStep === 1}
            onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
            isCompleted={false}
          >
            <p><strong>STEP 1</strong>: STEP 0 전사 결과를 바탕으로 <strong>정량적 데이터</strong>를 추출하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 STEP 1 목표</h4>
              <ul>
                <li>핵심 키워드 빈도 분석</li>
                <li>비언어적 표현 카운팅</li>
                <li>화자별 반응 패턴 식별</li>
                <li>후속 AI 분석을 위한 구조화된 데이터 생성</li>
              </ul>
            </div>

            <div className="step-instructions">
              <h4>STEP 1 사용 방법</h4>
              <ol>
                <li>아래 STEP 1 프롬프트를 복사하세요</li>
                <li>같은 NotebookLM 노트북에서 새 질문으로 요청하세요</li>
                <li>STEP 0에서 생성된 전사 결과를 참조하세요</li>
                <li>STEP 1 프롬프트를 붙여넣고 데이터 추출을 요청하세요</li>
                <li>결과를 STEP 2(Gemini)에서 사용하세요</li>
              </ol>
            </div>

            <button onClick={handleCopyStep1Prompt} className="btn-primary">
              STEP 1 프롬프트 복사
            </button>
          </Step>

          <Step
            stepNumber={2}
            title="Gemini 1차 분석"
            isOpen={openStep === 2}
            onToggle={() => setOpenStep(openStep === 2 ? 1 : 2)}
            isCompleted={false}
          >
            <p>NotebookLM 전사 결과를 <strong>Gemini Deep Research</strong>로 종합 분석하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 이 단계의 목표</h4>
              <ul>
                <li>Dave Gray-Schein 4층위 예비 분석</li>
                <li>유형적/무형적 요인 식별</li>
                <li>인과관계 가설 설정</li>
                <li>학술적 근거 보강</li>
              </ul>
            </div>

            <div className="llm-links">
              <h4>Gemini Advanced 접속</h4>
              <button 
                onClick={() => window.open('https://gemini.google.com/app', '_blank')}
                className="btn-llm"
              >
                💎 Gemini 열기
              </button>
            </div>

            <div className="step-instructions">
              <h4>사용 방법</h4>
              <ol>
                <li>아래 프롬프트를 복사하세요</li>
                <li>Gemini에 접속하세요</li>
                <li>NotebookLM 전사 결과를 준비하세요</li>
                <li>프롬프트와 전사 결과를 함께 입력하세요</li>
                <li>분석 결과를 Google Docs에 저장하세요</li>
              </ol>
            </div>

            <button onClick={handleCopyGeminiPrompt} className="btn-primary">
              Gemini 분석 프롬프트 복사
            </button>
          </Step>

          <Step
            stepNumber={3}
            title="Claude 컬처맵 생성"
            isOpen={openStep === 3}
            onToggle={() => setOpenStep(openStep === 3 ? 2 : 3)}
            isCompleted={false}
          >
            <p>Gemini 분석 결과를 <strong>Claude</strong>로 정밀 분석하여 Culture Map을 생성하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 이 단계의 목표</h4>
              <ul>
                <li>Dave Gray-Schein 4층위 정밀 분석</li>
                <li>Culture Map 텍스트 생성</li>
                <li>학술적 근거 검증 및 보강</li>
                <li>실행 가능한 개선안 도출</li>
              </ul>
            </div>



            <div className="step-instructions">
              <h4>수동 분석 방법</h4>
              <ol>
                <li>아래 프롬프트를 복사하세요</li>
                <li>Claude (현재 창)에 프롬프트를 입력하세요</li>
                <li>Gemini 분석 결과를 함께 제공하세요</li>
                <li>생성된 Culture Map 텍스트를 복사하세요</li>
              </ol>
            </div>

            {/* 시각화 가이드 */}
            <div className="workflow-info">
              <h4>🎨 Culture Map 시각화 방법</h4>
              <p>Claude가 생성한 Culture Map 텍스트를 시각화하려면:</p>
              <ol>
                <li><strong>“워크샵 분석 (교육용)” 탭으로 이동</strong></li>
                <li><strong>1단계: 컴처 맵 그리기</strong>에 Culture Map 텍스트 붙여넣기</li>
                <li><strong>“맵 그리기” 버튼 클릭</strong>으로 시각화 완료</li>
              </ol>
            </div>

            <button onClick={handleCopyClaudePrompt} className="btn-primary">
              프롬프트 복사
            </button>
          </Step>

          <Step
            stepNumber={4}
            title="Claude 조직문화 진단 (4a)"
            isOpen={openStep === 4}
            onToggle={() => setOpenStep(openStep === 4 ? 3 : 4)}
            isCompleted={false}
          >
            <p>Culture Map과 Gemini 분석을 바탕으로 <strong>조직문화 상태 진단</strong>을 수행하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 Step 4a의 목표</h4>
              <ul>
                <li>조직문화 상태를 한 문장으로 정의</li>
                <li>Culture Map의 설명력 분석</li>
                <li>구성원 인식 vs 객관적 현실 교차분석</li>
                <li>인지편향 요소 식별 및 분석</li>
              </ul>
            </div>

            <div className="llm-links">
              <h4>Claude 접속</h4>
              <button 
                onClick={() => window.open('https://claude.ai', '_blank')}
                className="btn-llm"
              >
                🤖 Claude 열기
              </button>
            </div>

            <div className="step-instructions">
              <h4>진단 분석 방법</h4>
              <ol>
                <li>아래 Step 4a 진단 프롬프트를 복사하세요</li>
                <li>Claude에 프롬프트를 입력하세요</li>
                <li>Step 3에서 생성된 Culture Map과 Gemini 분석 결과를 함께 제공하세요</li>
                <li>3가지 핵심 질문에 대한 진단 결과를 받으세요</li>
              </ol>
            </div>

            <button onClick={() => {
              promptLoader.loadPrompt('step4a_claude_diagnosis').then(result => {
                navigator.clipboard.writeText(result.content);
                alert('Step 4a 조직문화 진단 프롬프트가 복사되었습니다.');
              });
            }} className="btn-primary">
              Step 4a 진단 프롬프트 복사
            </button>
          </Step>

          <Step
            stepNumber={5}
            title="Claude 실행전략 수립 (4b)"
            isOpen={openStep === 5}
            onToggle={() => setOpenStep(openStep === 5 ? 4 : 5)}
            isCompleted={false}
          >
            <p>Step 4a 진단 결과를 바탕으로 <strong>구체적인 실행 전략</strong>을 수립하세요.</p>
            
            <div className="workflow-info">
              <h4>🎯 Step 4b의 목표</h4>
              <ul>
                <li>변화를 위한 핵심 레버리지 포인트 식별</li>
                <li>Option A(3회 세션) vs Option B(1일 워크샵) 설계</li>
                <li>HR 기능 측면 제언</li>
                <li>신뢰도 평가 및 추가 고려사항</li>
              </ul>
            </div>

            <div className="step-instructions">
              <h4>실행전략 수립 방법</h4>
              <ol>
                <li>아래 Step 4b 실행전략 프롬프트를 복사하세요</li>
                <li>Claude에 프롬프트를 입력하세요</li>
                <li>Step 4a에서 받은 진단 결과를 함께 제공하세요</li>
                <li>4가지 핵심 질문에 대한 실행 방안을 받으세요</li>
              </ol>
            </div>

            {/* 보고서 확인 가이드 */}
            <div className="workflow-info">
              <h4>📄 최종 보고서 확인 방법</h4>
              <p>Claude가 생성한 Step 4a + 4b 분석 결과를 종합하여:</p>
              <ol>
                <li><strong>"워크샵 분석 (교육용)" 탭으로 이동</strong></li>
                <li><strong>3단계: 분석 보고서 보기</strong>에 4a+4b 결과를 모두 붙여넣기</li>
                <li><strong>"보고서 보기" 버튼 클릭</strong>으로 최종 확인</li>
              </ol>
            </div>

            <button onClick={() => {
              promptLoader.loadPrompt('step4b_claude_strategy').then(result => {
                navigator.clipboard.writeText(result.content);
                alert('Step 4b 실행전략 프롬프트가 복사되었습니다.');
              });
            }} className="btn-primary">
              Step 4b 전략 프롬프트 복사
            </button>

            <div className="workflow-complete">
              <h4>🎉 전체 워크플로우 완료!</h4>
              <p>음성 데이터가 완전한 조직문화 분석 및 실행전략으로 변환되었습니다.</p>
              
              <div className="completion-summary">
                <div className="stage-summary">
                  <h5>✅ NotebookLM</h5>
                  <p>음성 → 정확한 전사 + 특별 강조점</p>
                </div>
                <div className="stage-summary">
                  <h5>✅ Gemini</h5>
                  <p>텍스트 → 구조화된 1차 분석</p>
                </div>
                <div className="stage-summary">
                  <h5>✅ Claude Step 3</h5>
                  <p>분석 → 정밀한 Culture Map 생성</p>
                </div>
                <div className="stage-summary">
                  <h5>✅ Claude Step 4a</h5>
                  <p>Culture Map → 조직문화 상태 진단</p>
                </div>
                <div className="stage-summary">
                  <h5>✅ Claude Step 4b</h5>
                  <p>진단 → 구체적 실행전략 수립</p>
                </div>
              </div>
              
              <div className="next-steps">
                <h4>📂 다음 단계</h4>
                <ul>
                  <li><strong>조직문화 분석 탭</strong>에서 Google Drive 파일 관리</li>
                  <li><strong>컬처맵 탭</strong>에서 시각화 및 편집</li>
                  <li><strong>분석 리포트 탭</strong>에서 최종 보고서 작성</li>
                </ul>
              </div>
            </div>
          </Step>
        </div>
      )}
    </div>
  );
};

export default PromptGenerator; 