import React, { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import { SessionManager } from './components/SessionManager.jsx';
import { SessionHeader } from './components/SessionHeader.jsx';
import { useSession } from './hooks/useSession.js';
import { AuthProvider } from './hooks/useAuth.jsx';
import Gateway from './components/Gateway.jsx';
import AdminGateway from './components/AdminGateway.jsx';
import './components/Gateway.css';
import './styles/theme.css';

export default function App() {
	const [currentTab, setCurrentTab] = useState('dashboard');
	const [isAdmin, setIsAdmin] = useState(false);
	const { 
		currentSessionCode, 
		currentSessionName, 
		isSessionReady, 
		selectSession,
		leaveSession
	} = useSession();

	// Gateway 인증 성공 콜백
	const handleAuthenticated = (adminStatus) => {
		setIsAdmin(adminStatus);
		console.log('Gateway 인증 성공:', adminStatus ? '관리자' : '일반 사용자');
	};

	return (
		<Gateway onAuthenticated={handleAuthenticated}>
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
							{/* 관리자만 관리 패널 보기 */}
							{isAdmin && (
								<button 
									onClick={() => setCurrentTab('admin')}
									style={{ 
										background: currentTab === 'admin' ? '#dc3545' : 'transparent',
										color: currentTab === 'admin' ? 'white' : '#333',
										border: '1px solid #dc3545',
										padding: '8px 16px',
										borderRadius: '4px',
										cursor: 'pointer',
										marginRight: '8px'
									}}
								>
									Gateway 관리
								</button>
							)}
						</nav>
					</div>
				</header>
				<div className="motif" />
				{isSessionReady && (
					<main className="kd-container">
						{currentTab === 'dashboard' && <Dashboard />}
						{currentTab === 'admin' && isAdmin && <AdminGateway />}
					</main>
				)}
			</AuthProvider>
		</Gateway>
	);
}
