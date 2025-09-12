import React, { useState } from 'react';
import { uploadFile, generatePrompt } from '../services/api';

export default function Dashboard() {
	const [step, setStep] = useState(1);
	const [fileText, setFileText] = useState('');
	const [spiritId, setSpiritId] = useState('spirit_01');
	const [prompt, setPrompt] = useState('');
	const [llmResult, setLlmResult] = useState('');

	const onUpload = async (e) => {
		const f = e.target.files?.[0];
		if (!f) return;
		const res = await uploadFile(f);
		setFileText(res.text || '');
		setStep(2);
	};

	const onGenerate = async () => {
		const res = await generatePrompt({ text: fileText, spiritId });
		setPrompt(res.prompt || '');
		setStep(3);
	};

	return (
		<div style={{ padding: 24, fontFamily: 'sans-serif' }}>
			<h1>경동 조직문화 분석기 대시보드 (Wizard)</h1>
			<ol>
				<li>파일 업로드</li>
				<li>정신 선택 및 프롬프트 생성</li>
				<li>프롬프트 확인/복사</li>
				<li>LLM 결과 붙여넣기</li>
				<li>시각화(추가 구현)</li>
			</ol>

			{step === 1 && (
				<div>
					<input type="file" onChange={onUpload} />
					{fileText && <pre style={{ whiteSpace: 'pre-wrap' }}>{fileText.slice(0, 1000)}</pre>}
				</div>
			)}

			{step === 2 && (
				<div>
					<label>
						정신 선택:
						<select value={spiritId} onChange={(e) => setSpiritId(e.target.value)}>
							<option value="spirit_01">불우재정신</option>
						</select>
					</label>
					<button onClick={onGenerate}>프롬프트 생성</button>
				</div>
			)}

			{step === 3 && (
				<div>
					<h3>생성된 프롬프트</h3>
					<textarea value={prompt} onChange={() => {}} rows={12} style={{ width: '100%' }} />
					<button onClick={() => navigator.clipboard.writeText(prompt)}>복사하기</button>
					<button onClick={() => setStep(4)}>다음</button>
				</div>
			)}

			{step === 4 && (
				<div>
					<h3>LLM 결과(JSON) 붙여넣기</h3>
					<textarea value={llmResult} onChange={(e) => setLlmResult(e.target.value)} rows={12} style={{ width: '100%' }} />
					<button onClick={() => setStep(5)}>시각화로</button>
				</div>
			)}

			{step === 5 && (
				<div>
					<h3>시각화(추가 구현 포인트)</h3>
					<p>선택 정신 배경 이미지 + activated_levers를 기준으로 체크/강조/툴팁 렌더링</p>
				</div>
			)}
		</div>
	);
}

