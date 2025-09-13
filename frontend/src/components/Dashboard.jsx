import React, { useEffect, useMemo, useState } from 'react';
import { generatePrompt, getSpirits, saveArtifact, listArtifacts, getArtifact, deleteArtifact } from '../services/api.js';
import GuidePanel from './GuidePanel.jsx';
import { RealtimeInputWithSave } from './RealtimeInputWithSave.jsx';
import CultureMapCardView from './CultureMapCardView.jsx';
import { useSession } from '../hooks/useSession.js';

export default function Dashboard() {
  const { currentSessionCode } = useSession();
  const [step, setStep] = useState(1);
  const [activityName, setActivityName] = useState('');
  const [coreText, setCoreText] = useState('');
  const [spiritId, setSpiritId] = useState('spirit_01');
  const [showDetail, setShowDetail] = useState(false);
  const [outcomes, setOutcomes] = useState('');
  const [outputs, setOutputs] = useState('');
  const [factors, setFactors] = useState('');
  const [keyLearning, setKeyLearning] = useState('');
  const [teamLeaderObservation, setTeamLeaderObservation] = useState(''); // 팀장 활동 목격담 추가
  const [spirits, setSpirits] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [llmResult, setLlmResult] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [jsonError, setJsonError] = useState('');

  // Artifacts picker state
  const [showPicker, setShowPicker] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const formatDateTime = (unixSeconds) => {
    if (!unixSeconds) return '';
    try {
      return new Date(unixSeconds * 1000).toLocaleString();
    } catch {
      return '';
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getSpirits();
        setSpirits(data.spirits || []);
      } catch (e) {
        // non-blocking
      }
    })();
  }, []);

  // bind hotkey event to toggle guide
  useEffect(() => {
    const handler = () => setShowGuide((v) => !v);
    window.addEventListener('kd:toggleGuide', handler);
    return () => window.removeEventListener('kd:toggleGuide', handler);
  }, []);

  const openPicker = async () => {
    setShowPicker(true);
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await listArtifacts();
      const items = Array.isArray(res.items) ? res.items : [];
      // Filter by team if provided; else show all
      const filtered = teamName.trim()
        ? items.filter((it) => (it.team || '').toLowerCase() === teamName.trim().toLowerCase())
        : items;
      setArtifacts(filtered.slice(0, 50));
    } catch (e) {
      setPickerError('아티팩트 목록을 불러오지 못했습니다.');
    } finally {
      setPickerLoading(false);
    }
  };

  const closePicker = () => {
    setShowPicker(false);
    setSelectedArtifactId('');
    setPickerError('');
  };

  const onDeleteArtifact = async (id) => {
    if (!id) return;
    if (!confirm('선택한 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteArtifact(id);
      setArtifacts((prev) => prev.filter((it) => it.id !== id));
      if (selectedArtifactId === id) setSelectedArtifactId('');
    } catch (e) {
      alert('삭제 실패');
    }
  };

  const loadArtifactInto = async (target) => {
    // target: 'prompt' | 'result'
    if (!selectedArtifactId) {
      setPickerError('먼저 항목을 선택하세요.');
      return;
    }
    try {
      const data = await getArtifact(selectedArtifactId);
      if (target === 'prompt') {
        setPrompt(data.content || '');
        setStep(3);
      } else if (target === 'result') {
        setLlmResult(data.content || '');
        setStep(4);
      }
      closePicker();
    } catch (e) {
      setPickerError('불러오기에 실패했습니다.');
    }
  };

  const goNextFromDescription = () => {
    if (!activityName.trim()) {
      setError('활동명을 입력하세요.');
      return;
    }
    if (!coreText.trim()) {
      setError('핵심 내용 및 느낀 점을 입력하세요.');
      return;
    }
    setError('');
    setStep(2);
  };

  const onGenerate = async () => {
    if (!activityName.trim() || !coreText.trim()) {
      setError('먼저 기본 정보를 모두 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await generatePrompt({
        spiritId,
        activityName,
        coreText,
        teamLeaderObservation: teamLeaderObservation.trim() || undefined, // 팀장 활동 목격담 추가
        outcomes: showDetail ? outcomes : undefined,
        outputs: showDetail ? outputs : undefined,
        factors: showDetail ? factors : undefined,
        keyLearning: showDetail ? keyLearning : undefined,
      });
      setPrompt(res.prompt || '');
      setStep(3);
    } catch (err) {
      setError('프롬프트 생성 실패: 백엔드 서버 상태를 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  const onSavePrompt = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await saveArtifact({ content: prompt, team: teamName || undefined, label: activityName || undefined, type: 'prompt' });
      setError(`프롬프트 저장됨: ${res.id}`);
      setTimeout(() => setError(''), 3000);
    } catch (e) {
      setError('프롬프트 저장 실패');
      setTimeout(() => setError(''), 3000);
    }
  };

  const onSaveResult = async () => {
    if (!llmResult.trim()) return;
    try {
      const res = await saveArtifact({ content: llmResult, team: teamName || undefined, label: activityName || undefined, type: 'result' });
      setError(`결과 저장됨: ${res.id}`);
      setTimeout(() => setError(''), 3000);
    } catch (e) {
      setError('결과 저장 실패');
      setTimeout(() => setError(''), 3000);
    }
  };

  // 이미지 다운로드 함수 - 전체 리포트 레이아웃 생성
  const handleImageDownload = async () => {
    try {
      if (!parsedResult) {
        alert('시각화 결과를 먼저 표시해주세요.');
        return;
      }

      // 전체 리포트를 위한 숨겨진 컨테이너 생성
      const reportContainer = createFullReportLayout();
      document.body.appendChild(reportContainer);

      // html2canvas 라이브러리를 동적으로 로드
      if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => {
          captureFullReport(reportContainer);
        };
        document.head.appendChild(script);
      } else {
        captureFullReport(reportContainer);
      }
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      alert('이미지 다운로드에 실패했습니다.');
    }
  };

  // 전체 리포트 레이아웃 생성
  const createFullReportLayout = () => {
    const container = document.createElement('div');
    container.id = 'full-report-container';
    container.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 1200px;
      background: white;
      padding: 40px;
      font-family: 'Noto Sans KR', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1f2937;
    `;

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 40px; border-bottom: 3px solid #005bac; padding-bottom: 20px;';
    header.innerHTML = `
      <h1 style="font-size: 28px; color: #005bac; margin: 0 0 10px 0; font-weight: 700;">
        ${selectedSpirit?.name || '동암정신'} 조직문화 분석 리포트
      </h1>
      <p style="font-size: 16px; color: #6b7280; margin: 0;">
        생성일: ${new Date().toLocaleDateString('ko-KR')} | 세션: ${currentSessionCode}
      </p>
    `;

    // CA와 팀장 기여 요소별 상세 분석
    const contributionsSection = document.createElement('div');
    contributionsSection.style.cssText = 'margin-bottom: 40px;';
    
    const caElements = (parsedResult.affected_elements || []).filter(el => el.activity_source === 'ca');
    const leaderElements = (parsedResult.affected_elements || []).filter(el => el.activity_source === 'leader');

    contributionsSection.innerHTML = `
      <h2 style="font-size: 22px; color: #005bac; margin: 0 0 30px 0; border-left: 4px solid #f36f21; padding-left: 12px;">
        📊 활동별 기여 요소 상세 분석
      </h2>
      
      ${caElements.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 18px; color: #007bff; margin: 0 0 20px 0;">🎯 Change Agent 활동 기여 요소 (${caElements.length}개)</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            ${caElements.map(el => `
              <div style="border: 2px solid #007bff; border-radius: 12px; padding: 16px; background: linear-gradient(135deg, #f8faff, #e3f2fd);">
                <div style="font-weight: 700; color: #1565c0; margin-bottom: 8px; font-size: 15px;">
                  ${el.element_name}
                </div>
                <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; ${
                  el.contribution_level === 'high' ? 'background: #ff6b35; color: white;' :
                  el.contribution_level === 'medium' ? 'background: #4ecdc4; color: white;' :
                  'background: #95a5a6; color: white;'
                }">
                  ${el.contribution_level === 'high' ? '높음' : el.contribution_level === 'medium' ? '중간' : '낮음'}
                </div>
                <div style="color: #374151; line-height: 1.5; font-size: 13px;">
                  ${el.evidence || '구체적인 근거가 제공되지 않았습니다.'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${leaderElements.length > 0 ? `
        <div>
          <h3 style="font-size: 18px; color: #28a745; margin: 0 0 20px 0;">👨‍💼 팀장 활동 기여 요소 (${leaderElements.length}개)</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            ${leaderElements.map(el => `
              <div style="border: 2px solid #28a745; border-radius: 12px; padding: 16px; background: linear-gradient(135deg, #f8fff9, #e8f5e8);">
                <div style="font-weight: 700; color: #1b5e20; margin-bottom: 8px; font-size: 15px;">
                  ${el.element_name}
                </div>
                <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; ${
                  el.contribution_level === 'high' ? 'background: #ff6b35; color: white;' :
                  el.contribution_level === 'medium' ? 'background: #4ecdc4; color: white;' :
                  'background: #95a5a6; color: white;'
                }">
                  ${el.contribution_level === 'high' ? '높음' : el.contribution_level === 'medium' ? '중간' : '낮음'}
                </div>
                <div style="color: #374151; line-height: 1.5; font-size: 13px;">
                  ${el.evidence || '구체적인 근거가 제공되지 않았습니다.'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // 종합 분석
    const analysisSection = document.createElement('div');
    analysisSection.innerHTML = `
      <h2 style="font-size: 22px; color: #005bac; margin: 40px 0 30px 0; border-left: 4px solid #f36f21; padding-left: 12px;">
        📈 종합 분석 및 인사이트
      </h2>
      
      ${parsedResult.analysis?.ca_activity_value ? `
        <div style="margin-bottom: 30px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #f8faff, #e3f2fd); border-left: 4px solid #007bff;">
          <h3 style="font-size: 18px; color: #1565c0; margin: 0 0 15px 0;">🎯 CA 활동의 이론적 가치</h3>
          <div style="white-space: pre-line; line-height: 1.7;">${parsedResult.analysis.ca_activity_value}</div>
        </div>
      ` : ''}

      ${parsedResult.analysis?.leader_impact ? `
        <div style="margin-bottom: 30px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #f8fff9, #e8f5e8); border-left: 4px solid #28a745;">
          <h3 style="font-size: 18px; color: #1b5e20; margin: 0 0 15px 0;">👨‍💼 팀장 활동의 리더십 효과</h3>
          <div style="white-space: pre-line; line-height: 1.7;">${parsedResult.analysis.leader_impact}</div>
        </div>
      ` : ''}

      ${parsedResult.analysis?.overall_effects ? `
        <div style="margin-bottom: 30px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-left: 4px solid #6f42c1;">
          <h3 style="font-size: 18px; color: #4c1d95; margin: 0 0 15px 0;">🌟 전반적인 조직문화 개선 효과</h3>
          <div style="white-space: pre-line; line-height: 1.7;">${parsedResult.analysis.overall_effects}</div>
        </div>
      ` : ''}

      ${parsedResult.analysis?.key_insights ? `
        <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #fff7ed, #fed7aa); border-left: 4px solid #fd7e14;">
          <h3 style="font-size: 18px; color: #c2410c; margin: 0 0 15px 0;">💡 핵심 인사이트 및 제안</h3>
          <div style="white-space: pre-line; line-height: 1.7;">${parsedResult.analysis.key_insights}</div>
        </div>
      ` : ''}
    `;

    container.appendChild(header);
    container.appendChild(contributionsSection);
    container.appendChild(analysisSection);

    return container;
  };

  // 전체 리포트 캡처 및 다운로드
  const captureFullReport = (reportContainer) => {
    window.html2canvas(reportContainer, {
      backgroundColor: '#ffffff',
      scale: 2, // 고해상도
      useCORS: true,
      allowTaint: true,
      width: 1280, // A4 가로 크기 고려
      height: reportContainer.scrollHeight + 80
    }).then(canvas => {
      // 캔버스를 이미지로 변환
      const link = document.createElement('a');
      link.download = `${selectedSpirit?.name || '동암정신'}_전체리포트_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // 임시 컨테이너 제거
      document.body.removeChild(reportContainer);
    }).catch(error => {
      console.error('캔버스 생성 실패:', error);
      alert('이미지 생성에 실패했습니다.');
      
      // 실패시에도 임시 컨테이너 제거
      if (document.body.contains(reportContainer)) {
        document.body.removeChild(reportContainer);
      }
    });
  };

  const captureAndDownload = (element) => {
    window.html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // 고해상도
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      // 캔버스를 이미지로 변환
      const link = document.createElement('a');
      link.download = `${selectedSpirit?.name || '동암정신'}_시각화_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(error => {
      console.error('캔버스 생성 실패:', error);
      alert('이미지 생성에 실패했습니다.');
    });
  };

  // WORD 다운로드 함수
  const handleWordDownload = () => {
    try {
      if (!parsedResult) {
        alert('분석 결과가 없습니다.');
        return;
      }

      // HTML 문서 생성
      const htmlContent = generateWordContent();
      
      // Blob 생성
      const blob = new Blob([htmlContent], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedSpirit?.name || '동암정신'}_분석보고서_${new Date().toISOString().split('T')[0]}.doc`;
      link.click();
      
      // 메모리 정리
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('WORD 다운로드 실패:', error);
      alert('WORD 다운로드에 실패했습니다.');
    }
  };

  // 텍스트의 줄바꿈을 HTML로 변환하는 함수
  const convertNewlinesToHtml = (text) => {
    if (!text) return '';
    return text.replace(/\n/g, '<br/>');
  };

  const generateWordContent = () => {
    const analysis = parsedResult.analysis || {};
    const affectedElements = parsedResult.affected_elements || [];
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${selectedSpirit?.name || '동암정신'} 분석 보고서</title>
    <style>
        body { font-family: '맑은 고딕', sans-serif; line-height: 1.8; margin: 40px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 30px; }
        h2 { color: #34495e; margin-top: 40px; margin-bottom: 20px; }
        h3 { color: #7f8c8d; margin-bottom: 15px; }
        .section { margin-bottom: 35px; }
        .element { background: #f8f9fa; padding: 20px; margin: 15px 0; border-left: 4px solid #3498db; border-radius: 5px; }
        .evidence { font-style: italic; color: #666; margin-top: 10px; }
        .activity-source { font-weight: bold; color: #e74c3c; }
        .analysis-content { white-space: pre-wrap; line-height: 2.0; }
        p { margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>${selectedSpirit?.name || '동암정신'} 활동 분석 보고서</h1>
    
    <div class="section">
        <h2>📋 활동 개요</h2>
        <p><strong>활동명:</strong> ${activityName}</p>
        <p><strong>분석 대상 정신:</strong> ${selectedSpirit?.name || spiritId}</p>
        <p><strong>작성일:</strong> ${new Date().toLocaleDateString('ko-KR')}</p>
        <p><strong>세션 코드:</strong> ${currentSessionCode}</p>
    </div>

    <div class="section">
        <h2>🎯 영향받은 동암정신 요소 (총 ${affectedElements.length}개)</h2>
        ${affectedElements.map(element => `
        <div class="element">
            <h3>${element.element_name}</h3>
            <p><span class="activity-source">[${element.activity_source === 'ca' ? 'Change Agent 활동' : '팀장 활동'}]</span> 
               기여도: <strong>${element.contribution_level === 'high' ? '높음' : element.contribution_level === 'medium' ? '중간' : '낮음'}</strong></p>
            <div class="evidence">${convertNewlinesToHtml(element.evidence || '구체적인 근거가 제공되지 않았습니다.')}</div>
        </div>
        `).join('')}
    </div>

    ${analysis.ca_activity_value ? `
    <div class="section">
        <h2>🎯 Change Agent 활동의 이론적 가치</h2>
        <div class="analysis-content">${convertNewlinesToHtml(analysis.ca_activity_value)}</div>
    </div>
    ` : ''}

    ${analysis.leader_impact ? `
    <div class="section">
        <h2>👨‍💼 팀장 활동의 리더십 효과</h2>
        <div class="analysis-content">${convertNewlinesToHtml(analysis.leader_impact)}</div>
    </div>
    ` : ''}

    ${analysis.overall_effects ? `
    <div class="section">
        <h2>🌟 전반적인 조직문화 개선 효과</h2>
        <div class="analysis-content">${convertNewlinesToHtml(analysis.overall_effects)}</div>
    </div>
    ` : ''}

    ${analysis.key_insights ? `
    <div class="section">
        <h2>💡 핵심 인사이트 및 제안</h2>
        <div class="analysis-content">${convertNewlinesToHtml(analysis.key_insights)}</div>
    </div>
    ` : ''}

    <div class="section">
        <h2>📊 분석 요약</h2>
        <p><strong>총 분석 요소:</strong> ${affectedElements.length}개</p>
        <p><strong>Change Agent 기여 요소:</strong> ${affectedElements.filter(el => el.activity_source === 'ca').length}개</p>
        <p><strong>팀장 기여 요소:</strong> ${affectedElements.filter(el => el.activity_source === 'leader').length}개</p>
        <p><strong>높은 기여도 요소:</strong> ${affectedElements.filter(el => el.contribution_level === 'high').length}개</p>
        <p><strong>중간 기여도 요소:</strong> ${affectedElements.filter(el => el.contribution_level === 'medium').length}개</p>
        <p><strong>낮은 기여도 요소:</strong> ${affectedElements.filter(el => el.contribution_level === 'low').length}개</p>
    </div>
</body>
</html>
    `.trim();
  };

  const parsedResult = useMemo(() => {
    setJsonError('');
    if (!llmResult) return null;

    const tryParse = (txt) => {
      try {
        return JSON.parse(txt);
      } catch (e) {
        throw e;
      }
    };

    const stripCodeFence = (txt) => {
      const trimmed = txt.trim();
      if (trimmed.startsWith('```')) {
        // remove leading ```[json] and trailing ```
        const body = trimmed.replace(/^```(?:json|JSON)?\s*/,'').replace(/\s*```\s*$/,'');
        return body.trim();
      }
      return txt;
    };

    const extractFirstJsonObject = (txt) => {
      // Find first balanced {...} ignoring braces inside strings
      let inStr = false;
      let esc = false;
      let depth = 0;
      let start = -1;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        if (inStr) {
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inStr = false; }
          continue;
        } else {
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') { if (depth === 0) start = i; depth++; }
          else if (ch === '}') { depth--; if (depth === 0 && start !== -1) { return txt.slice(start, i + 1); } }
        }
      }
      return '';
    };

    try {
      // 1) as-is
      return tryParse(llmResult);
    } catch (e1) {
      try {
        // 2) strip code fences
        const s1 = stripCodeFence(llmResult);
        return tryParse(s1);
      } catch (e2) {
        try {
          // 3) extract first JSON object inside text
          const obj = extractFirstJsonObject(llmResult);
          if (obj) return tryParse(obj);
        } catch (e3) {
          // fall through
        }
        setJsonError('유효한 JSON을 찾지 못했습니다. 코드블록 기호(``` )나 부가 텍스트를 제거하고 다시 시도하세요.');
        return null;
      }
    }
  }, [llmResult]);

  const selectedSpirit = useMemo(() => (spirits || []).find(s => s.id === spiritId), [spirits, spiritId]);

  return (
    <div data-testid="dashboard">
      <div className="card" style={{ background: '#e3f2fd', borderColor: '#1976d2', marginBottom: 16 }}>
        <div style={{ fontSize: '14px', color: '#1565c0' }}>
          💡 <strong>팁:</strong> 각 단계 번호를 클릭하면 해당 단계로 바로 이동할 수 있습니다. 순서에 상관없이 원하는 단계에서 작업을 시작하세요.
        </div>
      </div>
      <div className="stepper">
  {["설명 입력","정신/프롬프트","프롬프트 확인","LLM 결과","시각화"].map((label, idx) => (
          <div 
            key={label} 
            className={`step ${step === idx+1 ? 'is-active' : ''}`} 
            data-testid={`step-${idx+1}`}
            onClick={() => setStep(idx+1)}
            style={{ cursor: 'pointer' }}
          >
            <div><span className="step__num">{idx+1}</span>{label}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div/>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowGuide(true)}>도움말</button>
          <button className="btn" onClick={async ()=>{
            try {
              const txt = await fetch('/samples/input_minimal.txt').then(r=>r.text());
              setActivityName('제조라인 불량률 개선 활동');
              setCoreText(txt.replace(/^활동명:[^\n]*\n?/,'').trim());
              setShowDetail(false);
              setError('');
              setStep(2);
            } catch {
              alert('샘플 로드 실패');
            }
          }}>샘플(입력)</button>
          <button className="btn" onClick={async ()=>{
            try {
              const json = await fetch('/samples/result_sample.json').then(r=>r.json());
              setLlmResult(JSON.stringify(json, null, 2));
              setError('');
              setStep(5);
            } catch {
              alert('샘플 로드 실패');
            }
          }}>샘플(결과)</button>
          <button className="btn" onClick={openPicker}>저장 불러오기</button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor:'#ffd1ce', background:'#fff6f6' }} data-testid="save-success">
          <strong>{error.includes('저장됨') ? '성공' : '오류'}</strong>
          <div className="muted" style={{ marginTop:6 }}>{error}</div>
        </div>
      )}

      {showPicker && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 50 }}>
          <div className="card" style={{ width: 'min(800px, 92vw)', maxHeight: '80vh', overflow:'auto' }} data-testid="artifacts-modal">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3>저장된 항목 불러오기</h3>
              <button className="btn" onClick={closePicker}>닫기</button>
            </div>
            <div className="muted" style={{ marginBottom: 8 }}>
              {teamName?.trim() ? (
                <>팀명 필터: <strong>{teamName.trim()}</strong></>
              ) : (
                <>전체 항목 표시</>
              )}
              <button className="btn" style={{ marginLeft: 8 }} onClick={openPicker}>새로고침</button>
            </div>
            {pickerError && (
              <div className="card" style={{ borderColor:'#ffd1ce', background:'#fff6f6' }}>
                <strong>오류</strong>
                <div className="muted" style={{ marginTop:6 }}>{pickerError}</div>
              </div>
            )}
            {pickerLoading ? (
              <div className="muted">불러오는 중...</div>
            ) : (
              <div>
                {artifacts.length === 0 ? (
                  <div className="muted">표시할 항목이 없습니다.</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr className="muted" style={{ textAlign:'left', borderBottom:'1px solid #eee' }}>
                        <th style={{ padding:'6px 4px' }}>선택</th>
                        <th style={{ padding:'6px 4px' }}>라벨/파일</th>
                        <th style={{ padding:'6px 4px' }}>팀</th>
                        <th style={{ padding:'6px 4px' }}>유형</th>
                        <th style={{ padding:'6px 4px' }}>생성시각</th>
                        <th style={{ padding:'6px 4px' }}>크기</th>
                        <th style={{ padding:'6px 4px' }}>동작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artifacts.map((it) => (
                        <tr key={it.id} style={{ borderBottom:'1px solid #f2f2f2' }} data-testid="artifact-item">
                          <td style={{ padding:'6px 4px' }}>
                            <input
                              type="radio"
                              name="artifact"
                              checked={selectedArtifactId === it.id}
                              onChange={() => setSelectedArtifactId(it.id)}
                            />
                          </td>
                          <td style={{ padding:'6px 4px' }}>
                            <div style={{ fontWeight:500 }}>{it.label || it.filename}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{it.id}</div>
                          </td>
                          <td style={{ padding:'6px 4px' }}>{it.team || '-'}</td>
                          <td style={{ padding:'6px 4px' }}>{it.type || '-'}</td>
                          <td style={{ padding:'6px 4px' }}>{formatDateTime(it.createdAt)}</td>
                          <td style={{ padding:'6px 4px' }}>{(it.size || 0).toLocaleString()} B</td>
                          <td style={{ padding:'6px 4px' }}>
                            <button className="btn" onClick={() => onDeleteArtifact(it.id)}>삭제</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="row" style={{ marginTop: 10, justifyContent:'flex-end', gap: 8 }}>
                  <button className="btn" onClick={() => loadArtifactInto('prompt')}>프롬프트로 불러오기</button>
                  <button className="btn btn-accent" onClick={() => loadArtifactInto('result')}>결과로 불러오기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showGuide && (
        <GuidePanel step={step} onClose={() => setShowGuide(false)} data-testid="guide-panel" />
      )}

      {step === 1 && (
        <div className="card" id="description">
          <h3>1) 기본 정보 입력 (필수)</h3>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="muted" style={{ marginBottom: 6 }}>활동명</div>
              <RealtimeInputWithSave 
                fieldId="activityName"
                sessionCode={currentSessionCode}
                value={activityName} 
                onChange={(e) => setActivityName(e.target.value)} 
                placeholder="예) 제조라인 불량률 개선 활동" 
              />
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ marginBottom: 6 }}>연계된 동암정신</div>
              <select name="spiritId" value={spiritId} onChange={(e) => setSpiritId(e.target.value)}>
                {(spirits.length ? spirits : [{id:'spirit_01', name:'불우재(不尤哉) 정신'}]).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ marginBottom: 6 }}>팀/조 이름(선택)</div>
              <RealtimeInputWithSave 
                fieldId="teamName"
                sessionCode={currentSessionCode}
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)} 
                placeholder="예) 3조, 산소라인팀" 
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 6 }}>핵심 내용 및 느낀 점</div>
            <RealtimeInputWithSave 
              fieldId="coreText"
              sessionCode={currentSessionCode}
              multiline={true}
              rows={8}
              value={coreText}
              onChange={(e) => setCoreText(e.target.value)}
              placeholder={'무엇을 했고, 그 결과 무엇을 느꼈는지 중심으로 서술해 주세요.'}
            />
            <p className="muted" style={{ marginTop: 6 }}>
              <strong>CA 본인 활동:</strong> 본인이 수행한 활동, 팀원과 나눈 긍정적인 대화, 회의 분위기를 바꾸려 했던 시도 등<br/>
              '무엇을 했고, 그 결과 무엇을 느꼈는지' 중심으로 서술해 주시면 AI가 그 안에서 의미 있는 포인트를 발견해 줄 것입니다.
            </p>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setShowDetail(v => !v)}>
              {showDetail ? '상세 입력 접기 ▲' : '상세 내용 입력하기 ▼'}
            </button>
          </div>


          {showDetail && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <div className="muted" style={{ marginBottom: 6 }}>활동의 구체적 목표 (Outcomes)</div>
                <RealtimeInputWithSave 
                  fieldId="outcomes"
                  sessionCode={currentSessionCode}
                  multiline={true}
                  rows={4} 
                  value={outcomes} 
                  onChange={(e) => setOutcomes(e.target.value)} 
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div className="muted" style={{ marginBottom: 6 }}>실제 실행 내용 및 결과 (Outputs)</div>
                <RealtimeInputWithSave 
                  fieldId="outputs"
                  sessionCode={currentSessionCode}
                  multiline={true}
                  rows={4} 
                  value={outputs} 
                  onChange={(e) => setOutputs(e.target.value)} 
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div className="muted" style={{ marginBottom: 6 }}>성공 및 실패 요인 분석 (Enabler/Blocker)</div>
                <RealtimeInputWithSave 
                  fieldId="factors"
                  sessionCode={currentSessionCode}
                  multiline={true}
                  rows={4} 
                  value={factors} 
                  onChange={(e) => setFactors(e.target.value)} 
                />
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>핵심 교훈 및 향후 계획 (Key Learning)</div>
                <RealtimeInputWithSave 
                  fieldId="keyLearning"
                  sessionCode={currentSessionCode}
                  multiline={true}
                  rows={4} 
                  value={keyLearning} 
                  onChange={(e) => setKeyLearning(e.target.value)} 
                />
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <span className="muted">{(activityName + coreText + teamLeaderObservation + outcomes + outputs + factors + keyLearning).length.toLocaleString()}자</span>
            <button className="btn btn-primary" onClick={goNextFromDescription} disabled={loading}>다음</button>
          </div>
        </div>
      )}

      {/* 팀장 활동 목격담 별도 카드 */}
      {step === 1 && (
        <div className="card" style={{ marginTop: 16, backgroundColor: '#f8f9fa' }}>
          <h4 style={{ marginBottom: 12, color: '#6c757d' }}>💡 팀장 활동 목격담 (선택사항)</h4>
          <RealtimeInputWithSave 
            fieldId="teamLeaderObservation"
            sessionCode={currentSessionCode}
            multiline={true}
            rows={4}
            value={teamLeaderObservation}
            onChange={(e) => setTeamLeaderObservation(e.target.value)}
            placeholder="팀장이 수행한 활동을 목격하거나 경험한 내용을 간단히 작성해 주세요."
            style={{ marginBottom: 8 }}
          />
          <p className="muted" style={{ fontSize: '0.9em', lineHeight: '1.4' }}>
            <strong>팀장 활동 목격담:</strong> 팀장의 리더십, 의사결정, 팀원 지원 등 관찰한 내용을 간단히 기록해주세요. 
            CA 본인의 활동과 구분하여 작성하시면 더 정확한 분석이 가능합니다.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="card" id="prompt">
          <h3>2) 정신 선택 및 프롬프트 생성</h3>
          <div className="row">
            <label className="muted">정신 선택</label>
            <select name="spiritId" value={spiritId} onChange={(e) => setSpiritId(e.target.value)}>
              {(spirits.length ? spirits : [{id:'spirit_01', name:'불우재(不尤哉) 정신'}]).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button className="btn btn-accent" onClick={onGenerate} disabled={loading}>
              {loading ? <span className="spinner"/> : '프롬프트 생성'}
            </button>
          </div>
          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(1)}>이전</button>
            <span></span>
          </div>
        </div>
      )}

  {step === 3 && (
        <div className="card">
          <h3>3) 생성된 프롬프트</h3>
          <textarea data-testid="generated-prompt" value={prompt} onChange={() => {}} rows={12} />
          <div aria-live="polite" className="muted" style={{ minHeight: 20, marginTop: 4 }}>
            {copied ? '✅ 프롬프트가 클립보드에 복사되고 Gemini가 열렸습니다. Gemini에서 Ctrl+V로 붙여넣기 하세요.' : ''}
          </div>
          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(2)}>이전</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-primary ${copied ? 'is-success' : ''}`}
                title="Gemini에서 바로 분석하기"
                onClick={async () => {
                  try {
                    // 프롬프트를 클립보드에 복사
                    await navigator.clipboard.writeText(prompt || '');
                    setCopied(true);
                    
                    // Gemini 채팅 페이지 열기
                    window.open('https://gemini.google.com/app', '_blank');
                    
                    setTimeout(() => setCopied(false), 3000);
                  } catch (e) {
                    // 클립보드 복사 실패 시에도 Gemini는 열기
                    window.open('https://gemini.google.com/app', '_blank');
                    alert('Gemini가 열렸습니다. 프롬프트를 수동으로 붙여넣기 해주세요.');
                  }
                }}
              >
                {copied ? '✅ Gemini 열림' : '🚀 Gemini로 분석'}
              </button>
              <button className="btn" title="현재 프롬프트를 서버에 저장" onClick={onSavePrompt}>프롬프트 저장</button>
              <button className="btn" onClick={() => setStep(4)}>다음</button>
            </div>
          </div>
        </div>
      )}

  {step === 4 && (
        <div className="card">
          <h3>4) LLM 결과(JSON) 붙여넣기</h3>
          <textarea name="llmResult" value={llmResult} onChange={(e) => setLlmResult(e.target.value)} rows={12} />
          {jsonError && (
            <div className="muted" style={{ color: '#a11', marginTop: 6 }}>{jsonError}</div>
          )}
          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(3)}>이전</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" title="LLM 결과 JSON을 서버에 저장" onClick={onSaveResult}>결과 저장</button>
              <button className="btn btn-accent" onClick={() => setStep(5)}>시각화로</button>
            </div>
          </div>
        </div>
      )}

              {step === 5 && (
          <div className="card" id="visualize">
            <h3>5) 시각화 및 분석 결과</h3>
            
            {/* 네비게이션 및 출력 기능 버튼들 */}
            <div className="row" style={{ marginBottom: 16, justifyContent: 'space-between', gap: 8 }}>
              <button className="btn" onClick={() => setStep(4)}>이전</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* 샘플 데이터 테스트 버튼 */}
                <button 
                  className="btn"
                  style={{ backgroundColor: '#28a745', color: 'white' }}
                  onClick={() => {
                    const sampleData = JSON.stringify({
                      "affected_elements": [
                        {
                          "element_id": "유형_1",
                          "element_name": "[소통 절차/방식] 주기적 도전과제 대화, 논의",
                          "contribution_level": "high",
                          "activity_source": "ca",
                          "evidence": "CA가 정기적으로 팀원들과 도전과제에 대한 대화 세션을 주도하여 소통 문화 개선에 크게 기여했습니다."
                        },
                        {
                          "element_id": "유형_3",
                          "element_name": "[소통 절차/방식] 감정표현을 존중, 피드백 문화만들기",
                          "contribution_level": "medium",
                          "activity_source": "ca",
                          "evidence": "CA의 적극적인 피드백 문화 조성 노력으로 팀 내 감정표현이 자유로워졌습니다."
                        },
                        {
                          "element_id": "무형_1",
                          "element_name": "세상은 완벽하지 않아도 괜찮다 세상과 타인에 대한 이상적인 기대를 내려 놓으면 원망보다는 수용과 이해가 생긴다",
                          "contribution_level": "high",
                          "activity_source": "ca",
                          "evidence": "CA의 지속적인 긍정적 마인드셋 전파로 팀원들이 완벽주의에서 벗어나 수용적 태도를 갖게 되었습니다."
                        },
                        {
                          "element_id": "무형_2",
                          "element_name": "우리 동료는 뒤통수 치지 않음을 모두가 믿는다",
                          "contribution_level": "medium",
                          "activity_source": "ca",
                          "evidence": "CA의 신뢰 구축 활동을 통해 팀 내 상호 신뢰도가 크게 향상되었습니다."
                        },
                        {
                          "element_id": "유형_2",
                          "element_name": "[업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전 - 연 1개 프로젝트 목표",
                          "contribution_level": "high",
                          "activity_source": "leader",
                          "evidence": "팀장이 명확한 위험 관리 프로세스를 도입하여 안전한 도전 문화를 조성했습니다."
                        },
                        {
                          "element_id": "유형_4",
                          "element_name": "[소통 절차/방식] 성공사례 공유를 통한 자존감(자신감) 제고",
                          "contribution_level": "medium",
                          "activity_source": "leader",
                          "evidence": "팀장의 정기적인 성공사례 공유 세션으로 팀원들의 자신감이 향상되었습니다."
                        },
                        {
                          "element_id": "유형_8",
                          "element_name": "[권한 조정] 방향/실천방안 권한을 부여하여 책임의식 제고",
                          "contribution_level": "high",
                          "activity_source": "leader",
                          "evidence": "팀장이 팀원들에게 의사결정 권한을 적극적으로 위임하여 책임의식이 크게 향상되었습니다."
                        },
                        {
                          "element_id": "무형_3",
                          "element_name": "모든 경험은 나를 위한 배움이란 믿음",
                          "contribution_level": "low",
                          "activity_source": "leader",
                          "evidence": "팀장의 실패를 학습 기회로 전환하는 관점 공유로 성장 마인드셋이 형성되었습니다."
                        },
                        {
                          "element_id": "무형_4",
                          "element_name": "동료가 잘 되어야 내가 잘 될 수 있다고 믿는다",
                          "contribution_level": "medium",
                          "activity_source": "leader",
                          "evidence": "팀장의 협력 문화 강조로 상생 마인드가 팀에 정착되었습니다."
                        }
                      ],
                      "analysis": {
                        "ca_activity_value": "**CA 활동의 조직문화 혁신 성과**\n\n• **소통 문화의 질적 전환**: CA가 주도한 '주기적 도전과제 대화 세션'은 단순한 업무 보고에서 벗어나 진정한 소통 문화로 전환시켰습니다. 기존 일방향적 소통에서 양방향 대화 문화로 패러다임이 변화했으며, 이는 팀원들의 참여도를 30% 이상 향상시켰습니다.\n\n• **신뢰 기반 조직문화 구축**: '감정표현 존중 및 피드백 문화 만들기' 활동을 통해 팀 내 심리적 안전감이 크게 증대되었습니다. 팀원들이 실패나 어려움을 숨기지 않고 공유하게 되면서, 문제 해결 속도가 40% 단축되었고 조직 학습 능력이 현저히 향상되었습니다.\n\n• **무형 자산의 가시적 변화**: CA의 지속적인 긍정적 마인드셋 전파로 '완벽주의 → 수용과 이해'로의 인식 전환이 일어났습니다. 이는 스트레스 감소(25% 개선)와 창의적 아이디어 제안 증가(60% 상승)로 이어져 조직의 혁신 역량을 크게 강화했습니다.",
                        
                        "leader_impact": "**팀장의 전략적 리더십과 시스템 혁신**\n\n• **위험 관리 체계의 체계화**: 팀장이 도입한 '수용가능한 위험성 범위 설정 및 과감한 도전' 시스템은 조직의 도전 문화를 안전하게 정착시켰습니다. 연 1개 프로젝트 목표 설정을 통해 무모한 도전이 아닌 계산된 혁신을 추진했으며, 이로 인해 프로젝트 성공률이 85%까지 향상되었습니다.\n\n• **권한 위임을 통한 조직 역량 강화**: '방향/실천방안 권한 부여'를 통해 팀원들의 자율성과 책임감을 동시에 증진시켰습니다. 의사결정 속도가 50% 빨라졌으며, 팀원들의 주인의식이 크게 향상되어 업무 만족도가 전반적으로 상승했습니다.\n\n• **성장 마인드셋 확산**: '성공사례 공유를 통한 자존감 제고' 활동으로 개인의 성취가 조직 전체의 학습 자산이 되는 선순환 구조를 만들었습니다. 팀원들의 자신감 지수가 평균 35% 향상되었고, 새로운 업무에 대한 도전 의욕이 크게 증가했습니다.",
                        
                        "overall_effects": "**조직문화 변혁의 종합적 성과와 지속가능성**\n\n• **협력 중심 조직문화로의 전환**: CA의 신뢰 구축 활동과 팀장의 권한 위임이 결합되어 진정한 협력 문화가 정착되었습니다. 부서 간 협업 프로젝트가 200% 증가했으며, 갈등 상황 해결 시간이 평균 60% 단축되었습니다.\n\n• **학습하는 조직으로의 진화**: '모든 경험은 배움'이라는 철학이 조직 전반에 스며들면서, 실패를 두려워하지 않는 혁신적 조직문화가 형성되었습니다. 신규 아이디어 제안이 월평균 15건에서 45건으로 증가했고, 그 중 실행률도 30%에서 65%로 크게 향상되었습니다.\n\n• **지속가능한 변화 동력 확보**: 일시적 변화가 아닌 내재적 동기와 시스템 기반의 변화로 정착되어, 6개월 후에도 개선 효과가 지속되고 있습니다. 조직 구성원들의 변화 피로도는 감소(40% 개선)하면서도 변화 수용도는 증가(55% 향상)하는 상반된 긍정적 결과를 보여주고 있습니다.",
                        
                        "key_insights": "**전략적 인사이트와 미래 발전 방향**\n\n🔥 **핵심 성공 요인 분석**:\n• **CA-팀장 협력 시너지**: CA의 '소프트 스킬' 중심 접근과 팀장의 '하드 시스템' 구축이 완벽한 상호보완을 이루어 1+1=3의 효과를 창출했습니다.\n• **단계적 변화 관리**: 개인 마인드셋 변화 → 팀 문화 정착 → 시스템 제도화의 3단계 접근으로 지속가능한 변화를 달성했습니다.\n• **측정 가능한 성과 지표**: 정성적 변화를 정량적으로 측정하여 변화의 실체를 명확히 입증했습니다.\n\n💡 **향후 발전 제안**:\n• **수평 확산**: 현재 팀의 성공 모델을 다른 팀/부서로 확산하여 조직 전체의 문화 혁신을 추진\n• **심화 단계**: 기본적인 신뢰 문화에서 한 단계 더 나아가 '창의적 갈등'을 활용한 혁신 문화로 진화\n• **외부 연계**: 고객, 협력업체와의 관계에서도 동일한 문화적 접근을 적용하여 생태계 차원의 변화 추진\n\n🎯 **ROI 분석**: 이번 문화 혁신 활동으로 인한 직간접적 효과는 연간 약 2.5억원의 가치 창출로 추정되며(생산성 향상 1.8억, 이직률 감소 0.4억, 혁신 아이디어 실행 0.3억), 투입 비용 대비 약 8:1의 높은 투자 수익률을 보여주고 있습니다."
                      }
                    }, null, 2);
                    setLlmResult(sampleData);
                  }}
                >
                  📊 샘플 데이터 테스트
                </button>
                {parsedResult && (
                  <>
                    <button className="btn" onClick={handleImageDownload}>이미지 다운로드</button>
                    <button className="btn" onClick={handleWordDownload}>WORD 다운로드</button>
                  </>
                )}
              </div>
            </div>
            

            {/* 전체 시각화 및 분석 결과 영역 */}
            <div id="visualization-container" style={{ 
              padding: '20px', 
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              {/* 동암정신 문화지도 카드뷰 */}
              <div style={{ marginBottom: 20 }}>
                <CultureMapCardView 
                  analysisData={parsedResult} 
                  sessionCode={currentSessionCode}
                  selectedSpirit={selectedSpirit}
                />
              </div>
              
              {/* LLM 분석 결과 표시 패널 */}
              {parsedResult?.analysis && (
                <div id="analysis-result-panel" className="card" style={{ marginBottom: 20, background: '#f8f9fa', borderColor: '#e9ecef' }}>
                <h4 style={{ marginBottom: 16, color: '#495057' }}>📊 활동 성과 및 효과성 분석</h4>
                
                {parsedResult.analysis.ca_activity_value && (
                  <div style={{ marginBottom: 12 }}>
                    <h5 style={{ color: '#007bff', marginBottom: 8 }}>🎯 CA 활동의 이론적 가치</h5>
                    <div style={{ 
                      lineHeight: 1.6, 
                      marginBottom: 0, 
                      whiteSpace: 'pre-line',
                      fontSize: '14px',
                      color: '#495057'
                    }}>
                      {parsedResult.analysis.ca_activity_value}
                    </div>
                  </div>
                )}
                
                {parsedResult.analysis.leader_impact && (
                  <div style={{ marginBottom: 12 }}>
                    <h5 style={{ color: '#28a745', marginBottom: 8 }}>👨‍💼 팀장 활동의 리더십 효과</h5>
                    <div style={{ 
                      lineHeight: 1.6, 
                      marginBottom: 0, 
                      whiteSpace: 'pre-line',
                      fontSize: '14px',
                      color: '#495057'
                    }}>
                      {parsedResult.analysis.leader_impact}
                    </div>
                  </div>
                )}
                
                {parsedResult.analysis.overall_effects && (
                  <div style={{ marginBottom: 12 }}>
                    <h5 style={{ color: '#6f42c1', marginBottom: 8 }}>🌟 전반적인 조직문화 개선 효과</h5>
                    <div style={{ 
                      lineHeight: 1.6, 
                      marginBottom: 0, 
                      whiteSpace: 'pre-line',
                      fontSize: '14px',
                      color: '#495057'
                    }}>
                      {parsedResult.analysis.overall_effects}
                    </div>
                  </div>
                )}
                
                {parsedResult.analysis.key_insights && (
                  <div>
                    <h5 style={{ color: '#fd7e14', marginBottom: 8 }}>💡 핵심 인사이트 및 제안</h5>
                    <div style={{ 
                      lineHeight: 1.6, 
                      marginBottom: 0, 
                      whiteSpace: 'pre-line',
                      fontSize: '14px',
                      color: '#495057'
                    }}>
                      {parsedResult.analysis.key_insights}
                    </div>
                  </div>
                )}
              </div>
              )}
            
              {!parsedResult && (
                <p className="muted" style={{ marginTop: 8 }}>JSON을 유효하게 붙여넣으면 영향받은 요소들과 분석 결과가 표시됩니다. 예: {`{"affected_elements":[{"element_id":"challenge-response","contribution_level":"high"}],"analysis":{"ca_activity_value":"..."}}`}</p>
              )}
            </div>
          </div>
        )}
      </div>
  );
}
// Global hotkey: toggle guide with ?
if (typeof window !== 'undefined') {
  window.__kdGuideHotkeyBound = window.__kdGuideHotkeyBound || false;
  if (!window.__kdGuideHotkeyBound) {
    window.addEventListener('keydown', (e) => {
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        const evt = new CustomEvent('kd:toggleGuide');
        window.dispatchEvent(evt);
      }
    });
    window.__kdGuideHotkeyBound = true;
  }
}


// Simple styles for the picker can rely on existing classes; overlay is inline-styled
