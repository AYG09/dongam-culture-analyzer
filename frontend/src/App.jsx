import React, { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import { SessionManager } from './components/SessionManager.jsx';
import { SessionHeader } from './components/SessionHeader.jsx';
import { useSession } from './hooks/useSession.js';
import { AuthProvider } from './hooks/useAuth.jsx';
import './styles/theme.css';

export default function App() {
	const [currentTab, setCurrentTab] = useState('dashboard');
	const { 
		currentSessionCode, 
		currentSessionName, 
		isSessionReady, 
		selectSession,
		leaveSession
	} = useSession();

	return (
		<AuthProvider>
			{/* 세션 관리자 - 세션이 없을 때만 표시 */}
			{!isSessionReady && (
				<SessionManager 
					onSessionSelected={selectSession}
					currentSessionCode={currentSessionCode}
				/>
			)}

			{/* 세션 헤더 - 세션이 활성화된 경우에만 표시 */}
			{isSessionReady && currentSessionCode && currentSessionName && (
				<SessionHeader
					sessionCode={currentSessionCode}
					sessionName={currentSessionName}
					onLeaveSession={leaveSession}
				/>
			)}

			<header className="kd-header">
				<div className="kd-header__inner">
					<div className="kd-brand">
						<div className="kd-brand__logo" />
						<div>동암정신 내재화 성과분석기</div>
					</div>
					<nav className="kd-nav">
						<button 
							onClick={() => setCurrentTab('dashboard')}
							style={{ 
								background: currentTab === 'dashboard' ? '#3498db' : 'transparent',
								color: currentTab === 'dashboard' ? 'white' : '#333',
								border: '1px solid #ccc',
								padding: '8px 16px',
								borderRadius: '4px',
								cursor: 'pointer',
								marginRight: '8px'
							}}
						>
							성과분석기
						</button>
					</nav>
				</div>
			</header>
			<div className="motif" />
			{isSessionReady && (
				<main className="kd-container">
					{currentTab === 'dashboard' && <Dashboard />}
				</main>
			)}
		</AuthProvider>
	);
}
