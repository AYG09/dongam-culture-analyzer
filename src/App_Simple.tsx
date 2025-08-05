import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import EnhancedCultureMapApp from './components/EnhancedCultureMapApp';
import CultureDashboard from './components/CultureDashboard';
import type { CultureProject } from './types/culture';

type AppMode = 'culture_map' | 'culture_analysis';

function App() {
  const [appMode, setAppMode] = useState<AppMode>('culture_map');
  const [selectedProject, setSelectedProject] = useState<CultureProject | null>(null);

  const handleProjectSelect = (project: CultureProject) => {
    setSelectedProject(project);
    setAppMode('culture_analysis');
  };

  const handleBackToCultureMap = () => {
    setAppMode('culture_map');
    setSelectedProject(null);
  };

  return (
    <Router>
      <div className="app-container">
        {appMode === 'culture_analysis' ? (
          <div className="culture-analysis-container">
            <div className="analysis-header">
              <button 
                className="back-to-map-btn"
                onClick={handleBackToCultureMap}
              >
                ← 컬처맵으로 돌아가기
              </button>
              {selectedProject && (
                <h1>조직문화 분석: {selectedProject.name}</h1>
              )}
            </div>
            <CultureDashboard onSelectProject={handleProjectSelect} />
          </div>
        ) : (
          <div className="culture-map-container">
            <div className="top-bar no-print">
              <div className="top-bar-left">
                <h1>컬처 맵</h1>
              </div>
              <div className="top-bar-right">
                <button 
                  className="culture-analysis-btn"
                  onClick={() => setAppMode('culture_analysis')}
                >
                  📊 조직문화 분석
                </button>
              </div>
            </div>
            <EnhancedCultureMapApp />
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
