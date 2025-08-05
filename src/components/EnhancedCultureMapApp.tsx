// src/components/EnhancedCultureMapApp.tsx

import type { MouseEvent, RefObject } from 'react';

// 기존 컴포넌트들
import PromptGenerator from './PromptGenerator';
import ContextMenu from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import HelpModal from './HelpModal';
import AnalysisReport from './AnalysisReport';

// 새로운 층위 시스템 컴포넌트들
import LayerControlPanel from './LayerControlPanel';
import CultureMapCanvas from './CultureMapCanvas'; // 새로 추가

// 타입 정의
import type { ConnectionData, NoteData } from '../types/culture';
import type { ReportElement } from '../types/report';
import type { 
  LayerSystemState,
  LayerVisualizationOptions,
  LayerIndex,
} from '../types/layerSystem';

// 스타일
import '../styles/layerSystem.css';

interface EnhancedCultureMapAppProps {
  // 상태
  notes: NoteData[];
  connections: ConnectionData[];
  activeTab: 'map' | 'report';
  analysisReportData: ReportElement[];
  boardTransform: { x: number; y: number; };
  editingNoteId: string | null;
  selection: { startX: number; startY: number; endX: number; endY: number; } | null;
  selectedNoteIds: Set<string>;
  connectingNoteId: string | null;
  contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null;
  isHelpModalOpen: boolean;
  layerControlVisible: boolean;

  // 층위 시스템 상태
  layerState: LayerSystemState;
  visualizationOptions: LayerVisualizationOptions;

  // 참조
  boardRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;

  // 상태 설정 함수
  setActiveTab: React.Dispatch<React.SetStateAction<'map' | 'report'>>;
  setIsHelpModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLayerControlVisible: React.Dispatch<React.SetStateAction<boolean>>;
  
  // 핸들러 함수
  handleMouseDownOnBoard: (e: MouseEvent<HTMLDivElement>) => void;
  handleMouseDownOnNote: (noteId: string, e: MouseEvent<HTMLDivElement>) => void;
  handleMouseDownOnResizeHandle: (noteId: string, e: MouseEvent<HTMLDivElement>) => void;
  handleUpdateConnection: (id: string, newType: 'direct' | 'indirect') => void;
  handleDeleteConnection: (id: string) => void;
  handleCloseContextMenu: () => void;
  handleNoteContextMenu: (e: MouseEvent, noteId: string) => void;
  handleConnectionContextMenu: (e: MouseEvent, connectionId: string) => void;
  handleClearAll: () => void;
  handleNoteClick: (targetNoteId: string) => void;
  handleUpdateNote: (noteId: string, updates: Partial<NoteData>) => void;
  handleBoardContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  handleRenderFromText: (text: string) => void;
  handleShowReport: (reportText: string) => void;
  handleExportAsImage: () => void;
  handleExportAsJson: () => void;

  // 층위 시스템 함수
  onLayerHeightChange: (layerIndex: number, newHeight: number) => void;
  setVisualizationOptions: React.Dispatch<React.SetStateAction<LayerVisualizationOptions>>;
  setLayerState: React.Dispatch<React.SetStateAction<LayerSystemState>>;

  // 계산된 값
  highlightedLayers: LayerIndex[];
}


/**
 * 진화적 컬쳐맵 애플리케이션 (프레젠테이셔널 컴포넌트)
 * 4개 층위 동적 관리, 데이터 무결성 보장, 시각적 피드백 제공
 */
export function EnhancedCultureMapApp({
  // 상태
  notes,
  connections,
  activeTab,
  analysisReportData,
  boardTransform,
  editingNoteId,
  selection,
  selectedNoteIds,
  connectingNoteId,
  contextMenu,
  isHelpModalOpen,
  layerControlVisible,

  // 층위 시스템 상태
  layerState,
  visualizationOptions,

  // 참조
  boardRef,
  scrollContainerRef,

  // 상태 설정 함수
  setActiveTab,
  setIsHelpModalOpen,
  setLayerControlVisible,
  
  // 핸들러 함수
  handleMouseDownOnBoard,
  handleMouseDownOnNote,
  handleMouseDownOnResizeHandle,
  handleUpdateConnection,
  handleDeleteConnection,
  handleCloseContextMenu,
  handleNoteContextMenu,
  handleConnectionContextMenu,
  handleClearAll,
  handleNoteClick,
  handleUpdateNote,
  handleBoardContextMenu,
  handleRenderFromText,
  handleShowReport,
  handleExportAsImage,
  handleExportAsJson,

  // 층위 시스템 함수
  onLayerHeightChange,
  setVisualizationOptions,
  setLayerState,

  // 계산된 값
  highlightedLayers,
}: EnhancedCultureMapAppProps) {

  return (
    <div className="enhanced-culture-map-app">
      {/* 상단 바 */}
      <div className="top-bar no-print">
        <div className="top-bar-left">
          <h1>🗺️ 조직 문화 분석기</h1>
          <button className="help-button" onClick={() => setIsHelpModalOpen(true)}>?</button>
        </div>
        <div className="top-bar-right">
          <button onClick={handleExportAsJson}>맵 데이터 저장 (JSON)</button>
          <button onClick={handleExportAsImage}>맵 이미지로 저장</button>
        </div>
      </div>

      <div className="app-body">
        {/* 왼쪽 패널 */}
        <div className="left-panel no-print">
          <PromptGenerator 
            onGenerateMap={handleRenderFromText} 
            onClear={handleClearAll}
            onShowReport={handleShowReport}
            notes={notes}
            connections={connections}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="main-content">
          <div className="view-tabs no-print">
            <button 
              className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              🗺️ 컬쳐맵
            </button>
            <button 
              className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              📊 분석 보고서
            </button>
          </div>

          <div className="view-content">
            {activeTab === 'map' ? (
              <div className="map-scroll-container" ref={scrollContainerRef}>
                <CultureMapCanvas
                  notes={notes}
                  connections={connections}
                  boardTransform={boardTransform}
                  selection={selection}
                  connectingNoteId={connectingNoteId}
                  selectedNoteIds={selectedNoteIds}
                  editingNoteId={editingNoteId}
                  layerState={layerState}
                  visualizationOptions={visualizationOptions}
                  highlightedLayers={highlightedLayers}
                  boardRef={boardRef}
                  handleMouseDownOnBoard={handleMouseDownOnBoard}
                  handleBoardContextMenu={handleBoardContextMenu}
                  handleUpdateConnection={handleUpdateConnection}
                  handleDeleteConnection={handleDeleteConnection}
                  handleConnectionContextMenu={handleConnectionContextMenu}
                  handleMouseDownOnNote={handleMouseDownOnNote}
                  handleMouseDownOnResizeHandle={handleMouseDownOnResizeHandle}
                  handleNoteClick={handleNoteClick}
                  handleUpdateNote={handleUpdateNote}
                  handleNoteContextMenu={handleNoteContextMenu}
                  onLayerHeightChange={onLayerHeightChange}
                />
              </div>
            ) : (
              <AnalysisReport reportData={analysisReportData} />
            )}
          </div>
        </div>
      </div>

      {/* 층위 제어 패널 */}
      <LayerControlPanel 
        layerState={layerState}
        visualizationOptions={visualizationOptions}
        onUpdateVisualizationOptions={(options) => setVisualizationOptions(prev => ({ ...prev, ...options }))}
        onUpdateLayerState={(state) => setLayerState(prev => ({ ...prev, ...state }))}
        isVisible={layerControlVisible}
        onToggleVisibility={() => setLayerControlVisible(prev => !prev)}
      />

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu {...contextMenu} onClose={handleCloseContextMenu} />
      )}

      {/* 도움말 모달 */}
      {isHelpModalOpen && (
        <HelpModal onClose={() => setIsHelpModalOpen(false)} />
      )}
    </div>
  );
}

export default EnhancedCultureMapApp;
