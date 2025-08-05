import { useState, useCallback, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

// 컴포넌트
import { EnhancedCultureMapApp } from './components/EnhancedCultureMapApp';
import CultureDashboard from './components/CultureDashboard';

// 유틸리티
import { parseAIOutput } from './utils/parser';
import { parseIntelligent } from './utils/intelligentParser';
import { getLayoutedElements } from './utils/layout';

// 타입 및 설정
import type { CultureProject, ConnectionData, NoteData, NoteType } from './types/culture';
import type { Position } from './types';
import type { 
  LayerSystemState,
  LayerVisualizationOptions,
} from './types/layerSystem';
import { LAYER_CONFIG } from './types/layerSystem';

// 스타일
import './styles/layerSystem.css';
import './App.css';

type AppMode = 'culture_map' | 'culture_analysis';

const GRID_SIZE = 20;

function App() {
  // =================================================================================
  // 상태 관리 (State Management)
  // =================================================================================

  // 앱 모드 상태
  const [appMode, setAppMode] = useState<AppMode>('culture_map');
  const [selectedProject, setSelectedProject] = useState<CultureProject | null>(null);

  // 컬처맵 데이터 상태
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  
  // UI 인터랙션 상태
  const [draggingNote, setDraggingNote] = useState<{ noteId: string; offsetX: number; offsetY: number; } | null>(null);
  const [resizingNote, setResizingNote] = useState<{ noteId: string; startX: number; startY: number; startWidth: number; startHeight: number; } | null>(null);
  const [panning, setPanning] = useState<{ isPanning: boolean; startX: number; startY: number; initialTransformX: number; initialTransformY: number; } | null>(null);
  const [boardTransform, setBoardTransform] = useState({ x: 0, y: 0 });
  const [wasPanning, setWasPanning] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ startX: number; startY: number; endX: number; endY: number; } | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [multiDragInfo, setMultiDragInfo] = useState<{ noteId: string; offsetX: number; offsetY: number; } | null>(null);
  const [connectingNoteId, setConnectingNoteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [layerControlVisible, setLayerControlVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [analysisReportData, setAnalysisReportData] = useState<any[]>([]);
  const [resizingLayerIndex, setResizingLayerIndex] = useState<number | null>(null);


  // 참조
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // =================================================================================
  // 층위 시스템 로직 (단순화 버전)
  // =================================================================================
  
  const [layerState, setLayerState] = useState<LayerSystemState>(() => {
    const initialLayerHeight = 200; // 초기 높이
    const layerGap = 20;
    const boundaries = Object.entries(LAYER_CONFIG).map(([type, config]) => {
      const yMin = config.index * (initialLayerHeight + layerGap);
      return {
        layerType: type as keyof typeof LAYER_CONFIG,
        layerIndex: config.index,
        yMin: yMin,
        yMax: yMin + initialLayerHeight,
        height: initialLayerHeight,
        isVisible: true,
        color: config.color,
        opacity: 0.1
      };
    });

    const totalHeight = boundaries.reduce((acc, boundary) => acc + boundary.height + layerGap, 0) - layerGap;

    return {
      boundaries,
      snapEnabled: false,
      autoRealignEnabled: false,
      validationEnabled: false,
      showLayerGuides: true,
      layerHeight: initialLayerHeight, // 평균 높이 개념으로 유지
      layerGap: layerGap,
      totalHeight: totalHeight
    };
  });

  const [visualizationOptions, setVisualizationOptions] = useState<LayerVisualizationOptions>({
    showLayerLabels: true,
    showLayerBoundaries: true,
    showLayerIcons: false,
    layerOpacity: 0.1,
    boundaryLineStyle: 'dashed',
    boundaryLineWidth: 1,
    labelPosition: 'left',
    animateTransitions: true,
    transitionDuration: 300
  });

  const handleLayerHeightChange = useCallback((layerIndex: number, newHeight: number) => {
    setLayerState(prev => {
      const newBoundaries = [...prev.boundaries];
      const minHeight = 100; // 최소 높이
      const validatedNewHeight = Math.max(minHeight, newHeight);

      // 해당 레이어 높이 변경
      newBoundaries[layerIndex] = {
        ...newBoundaries[layerIndex],
        height: validatedNewHeight,
      };

      // 후속 레이어 위치 재계산
      for (let i = 0; i < newBoundaries.length; i++) {
        const prevYMax = i > 0 ? newBoundaries[i - 1].yMax : -prev.layerGap;
        const yMin = prevYMax + prev.layerGap;
        newBoundaries[i] = {
          ...newBoundaries[i],
          yMin: yMin,
          yMax: yMin + newBoundaries[i].height,
        };
      }
      
      const newTotalHeight = newBoundaries.reduce((acc, boundary) => acc + boundary.height + prev.layerGap, 0) - prev.layerGap;

      return {
        ...prev,
        boundaries: newBoundaries,
        totalHeight: newTotalHeight,
      };
    });
  }, []);


  // =================================================================================
  // 핸들러 함수 (Event Handlers)
  // =================================================================================

  const handleUpdateNote = useCallback((noteId: string, updates: Partial<NoteData>) => {
    setNotes(currentNotes => currentNotes.map(note => note.id === noteId ? { ...note, ...updates } : note));
    setEditingNoteId(null);
  }, []);

  const handleProjectSelect = (project: CultureProject) => {
    setSelectedProject(project);
    setAppMode('culture_analysis');
  };

  const handleBackToCultureMap = () => {
    setAppMode('culture_map');
    setSelectedProject(null);
  };

  const handleMouseDownOnBoard = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.enhanced-sticky-note') !== null) return;

    if (e.button === 0) {
      const board = boardRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (!board || !scrollContainer) return;
      const rect = board.getBoundingClientRect();
      const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
      const startY = e.clientY - rect.top + scrollContainer.scrollTop;
      setSelection({ startX, startY, endX: startX, endY: startY });
      setSelectedNoteIds(new Set());
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      const board = boardRef.current;
      if (!board) return;
      setContextMenu(null);
      setPanning({
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        initialTransformX: boardTransform.x,
        initialTransformY: boardTransform.y,
      });
      setWasPanning(true);
      board.style.cursor = 'grabbing';
    }
  }, [boardTransform]);

  const handleMouseDownOnNote = useCallback((noteId: string, e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) {
      e.preventDefault();
      return;
    }

    const noteElement = e.currentTarget;
    const rect = noteElement.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    if (selectedNoteIds.has(noteId) && !e.shiftKey) {
      setMultiDragInfo({ noteId, offsetX, offsetY });
      noteElement.style.cursor = 'grabbing';
      return;
    }

    if (e.shiftKey) {
      e.stopPropagation();
      setSelectedNoteIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(noteId)) newSet.delete(noteId);
        else newSet.add(noteId);
        return newSet;
      });
      return;
    }

    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

    setSelectedNoteIds(new Set([noteId]));
    setDraggingNote({ noteId, offsetX, offsetY });
    noteElement.style.cursor = 'grabbing';
  }, [notes, selectedNoteIds]);

  const handleMouseDownOnResizeHandle = useCallback((noteId: string, e: MouseEvent<HTMLDivElement>) => {
    const noteToResize = notes.find(note => note.id === noteId);
    if (!noteToResize) return;
    e.stopPropagation();
    setResizingNote({
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: noteToResize.width || 200,
      startHeight: noteToResize.height || 120,
    });
  }, [notes]);

  const handleMouseDownOnLayerResizeHandle = useCallback((layerIndex: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingLayerIndex(layerIndex);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement> | globalThis.MouseEvent) => {
    const board = boardRef.current;
    if (!board) return;

    if (resizingLayerIndex !== null) {
      const layer = layerState.boundaries[resizingLayerIndex];
      if (!layer) return;

      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      // Get the mouse position relative to the scroll container's top.
      const scrollRect = scrollContainer.getBoundingClientRect();
      const mouseY = e.clientY - scrollRect.top + scrollContainer.scrollTop;
      
      const newHeight = mouseY - layer.yMin;
      handleLayerHeightChange(resizingLayerIndex, newHeight);
      return;
    }

    if (selection && !draggingNote && !multiDragInfo) {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      const rect = board.getBoundingClientRect();
      const endX = e.clientX - rect.left + scrollContainer.scrollLeft;
      const endY = e.clientY - rect.top + scrollContainer.scrollTop;
      setSelection(prev => prev ? { ...prev, endX, endY } : null);
      const newSelectedIds = new Set<string>();
      const selRect = {
        x1: Math.min(selection.startX, endX),
        y1: Math.min(selection.startY, endY),
        x2: Math.max(selection.startX, endX),
        y2: Math.max(selection.startY, endY),
      };
      notes.forEach(note => {
        const noteRect = {
          x1: note.position.x,
          y1: note.position.y,
          x2: note.position.x + (note.width || 200),
          y2: note.position.y + (note.height || 120),
        };
        if (noteRect.x1 < selRect.x2 && noteRect.x2 > selRect.x1 && noteRect.y1 < selRect.y2 && noteRect.y2 > selRect.y1) {
          newSelectedIds.add(note.id);
        }
      });
      setSelectedNoteIds(newSelectedIds);
      return;
    }

    if (panning?.isPanning) {
      e.preventDefault();
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setBoardTransform({ x: panning.initialTransformX + dx, y: panning.initialTransformY + dy });
      return;
    }

    if (multiDragInfo) {
      const boardRect = board.getBoundingClientRect();
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      const { noteId, offsetX, offsetY } = multiDragInfo;
      const referenceNote = notes.find(n => n.id === noteId);
      if (!referenceNote) return;
      const mouseX = e.clientX - boardRect.left + scrollContainer.scrollLeft;
      const mouseY = e.clientY - boardRect.top + scrollContainer.scrollTop;
      const newRefX = mouseX - offsetX;
      const newRefY = mouseY - offsetY;
      const dx = newRefX - referenceNote.position.x;
      const dy = newRefY - referenceNote.position.y;
      setNotes(currentNotes =>
        currentNotes.map(n => {
          if (selectedNoteIds.has(n.id)) {
            let newX = n.position.x + dx;
            let newY = n.position.y + dy;
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            const newPosition = { x: newX, y: newY };
            return { ...n, position: newPosition };
          }
          return n;
        })
      );
      return;
    }

    if (draggingNote) {
      const boardRect = board.getBoundingClientRect();
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      let x = e.clientX - boardRect.left - draggingNote.offsetX + scrollContainer.scrollLeft;
      let y = e.clientY - boardRect.top - draggingNote.offsetY + scrollContainer.scrollTop;
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
      const newPosition = { x, y };
      setNotes(currentNotes =>
        currentNotes.map(note => {
          if (note.id === draggingNote.noteId) {
            return { ...note, position: newPosition };
          }
          return note;
        })
      );
      return;
    }

    if (resizingNote) {
      const newWidth = resizingNote.startWidth + (e.clientX - resizingNote.startX);
      const newHeight = resizingNote.startHeight + (e.clientY - resizingNote.startY);
      setNotes(currentNotes =>
        currentNotes.map(note =>
          note.id === resizingNote.noteId
            ? { ...note, width: Math.max(150, newWidth), height: Math.max(100, newHeight) }
            : note
        )
      );
    }
  }, [draggingNote, resizingNote, panning, selection, notes, multiDragInfo, selectedNoteIds, setNotes, setBoardTransform, setSelection, setSelectedNoteIds, resizingLayerIndex, layerState.boundaries, handleLayerHeightChange]);

  const handleMouseUp = useCallback(() => {
    if (draggingNote) {
      const noteElement = document.getElementById(draggingNote.noteId);
      if (noteElement) noteElement.style.cursor = 'grab';
    }
    if (panning) {
      const board = boardRef.current;
      if (board) board.style.cursor = 'default';
    }
    setDraggingNote(null);
    setResizingNote(null);
    setPanning(null);
    setSelection(null);
    setMultiDragInfo(null);
    setResizingLayerIndex(null);
    setTimeout(() => setWasPanning(false), 100);
  }, [draggingNote, panning]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => handleMouseMove(e as any);
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleConnectStart = useCallback((noteId: string) => setConnectingNoteId(noteId), []);
  
  const handleUpdateConnection = useCallback((id: string, newType: 'direct' | 'indirect') => {
    setConnections(conns => conns.map(c => c.id === id ? { ...c, relationType: newType } : c));
  }, []);
  const handleDeleteConnection = useCallback((id: string) => {
    if (window.confirm('이 연결선을 삭제하시겠습니까?')) {
      setConnections(conns => conns.filter(c => c.id !== id));
    }
  }, []);
  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleNoteContextMenu = useCallback((e: MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleCloseContextMenu();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const sentimentCycle: Record<NoteData['sentiment'], NoteData['sentiment']> = {
      neutral: 'negative',
      negative: 'positive',
      positive: 'neutral',
    };

    const items = [
      { label: '편집', action: () => setEditingNoteId(noteId) },
      { 
        label: `색상 전환: ${note.sentiment} → ${sentimentCycle[note.sentiment]}`, 
        action: () => {
          const nextSentiment = sentimentCycle[note.sentiment];
          handleUpdateNote(noteId, { sentiment: nextSentiment });
        } 
      },
      { label: '연결 시작', action: () => handleConnectStart(noteId) },
      { label: '삭제', action: () => {
          if(window.confirm('이 포스트잇을 삭제하시겠습니까?')) {
            setNotes(currentNotes => currentNotes.filter(n => n.id !== noteId));
            setConnections(conns => conns.filter(c => c.sourceId !== noteId && c.targetId !== noteId));
          }
        }, isDanger: true },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [notes, handleCloseContextMenu, handleConnectStart, handleUpdateNote]);

  const handleConnectionContextMenu = useCallback((e: MouseEvent, connectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleCloseContextMenu();
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;
    const items = [
      { label: `'${conn.relationType === 'direct' ? '점선' : '실선'}'으로 전환`, action: () => handleUpdateConnection(connectionId, conn.relationType === 'direct' ? 'indirect' : 'direct') },
      { label: '연결선 삭제', action: () => handleDeleteConnection(connectionId), isDanger: true },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [connections, handleCloseContextMenu, handleUpdateConnection, handleDeleteConnection]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      setNotes([]);
      setConnections([]);
      setSelectedNoteIds(new Set());
      setAnalysisReportData([]);
    }
  }, []);

  const handleNoteClick = useCallback((targetNoteId: string) => {
    if (connectingNoteId && connectingNoteId !== targetNoteId) {
      setConnections(prev => [...prev, { id: uuidv4(), sourceId: connectingNoteId, targetId: targetNoteId, relationType: 'direct', isPositive: true }]);
      setConnectingNoteId(null);
    } else if (connectingNoteId === targetNoteId) {
      setConnectingNoteId(null);
    }
  }, [connectingNoteId]);

  const handleAddNewNote = useCallback((type: NoteType, position: Position) => {
    const layerConfig = Object.values(LAYER_CONFIG).find(c => c.label.startsWith(type.split('_')[0]));
    const newNoteId = uuidv4();
    const newNote: NoteData = {
      id: newNoteId, text: '새 포스트잇', type: type, layer: (layerConfig?.index as 1 | 2 | 3 | 4) || 1,
      sentiment: 'neutral', position: position, width: 200, height: 120,
    };
    setNotes(currentNotes => [...currentNotes, newNote]);
    setEditingNoteId(newNoteId);
  }, []);

  const handleBoardContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (panning?.isPanning || wasPanning) {
      e.preventDefault();
      if (wasPanning) setWasPanning(false);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.enhanced-sticky-note')) return;
    e.preventDefault();
    const board = boardRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!board || !scrollContainer) return;
    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;
    const contextMenuItems = (['결과', '행동', '유형_레버', '무형_레버'] as const).map((type) => ({
      label: `${type.replace('_레버','')} 포스트잇 추가`,
      action: () => handleAddNewNote(type, { x, y }),
    }));
    setContextMenu({ x: e.clientX, y: e.clientY, items: contextMenuItems });
  }, [panning, wasPanning, handleAddNewNote]);

  const handleRenderFromText = useCallback((text: string) => {
    if (!text.trim()) {
      handleClearAll();
      return;
    }
    try {
      const { notes: parsedNotes, connections: parsedConnections } = parseAIOutput(text);
      if (parsedNotes.length === 0) return;
      
      const { nodes: layoutedNodes, connections: layoutedConnections } = getLayoutedElements(parsedNotes, parsedConnections);

      setNotes(layoutedNodes);
      setConnections(layoutedConnections);
      setActiveTab('map');
    } catch (error) {
      console.error("Failed to parse or render map:", error);
    }
  }, [handleClearAll]);

  const handleShowReport = useCallback((reportText: string) => {
    const parsedData = parseIntelligent(reportText);
    setAnalysisReportData(parsedData);
    setActiveTab('report');
  }, []);

  const handleExportAsImage = useCallback(async () => {
    const scrollContainer = scrollContainerRef.current;
    const mapElement = boardRef.current;

    if (!mapElement || !scrollContainer || notes.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const originalScrollLeft = scrollContainer.scrollLeft;
    const originalScrollTop = scrollContainer.scrollTop;
    scrollContainer.scrollLeft = 0;
    scrollContainer.scrollTop = 0;

    // DOM 업데이트를 위한 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      let maxX = 0;
      let maxY = 0;

      notes.forEach(note => {
        maxX = Math.max(maxX, note.position.x + (note.width || 200));
        maxY = Math.max(maxY, note.position.y + (note.height || 120));
      });

      const padding = 150; // 여백을 늘려 레이블이 잘리지 않도록 함
      
      const captureWidth = maxX + padding;
      const captureHeight = Math.max(maxY + padding, layerState.totalHeight + padding);

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        scale: 1.5, // 스케일 조정
        backgroundColor: '#f0f2f5', // 배경색을 옅은 회색으로 변경
        width: captureWidth,
        height: captureHeight,
        x: 0, // 캡처 시작점을 0으로 고정
        y: 0,
        logging: false,
        onclone: (document) => {
          // 캡처 시점에만 적용될 스타일
          const clonedBoard = document.getElementById('enhanced-notes-board');
          if (clonedBoard) {
            // 보드의 transform을 제거하여 위치를 고정
            clonedBoard.style.transform = 'translate(0, 0)';
          }
        }
      });

      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, 'culture-map-export.png');
        }
      });
    } catch (error) {
      console.error('이미지 내보내기 오류:', error);
      alert('이미지를 내보내는 중 오류가 발생했습니다.');
    } finally {
      // 스크롤 위치 복원
      scrollContainer.scrollLeft = originalScrollLeft;
      scrollContainer.scrollTop = originalScrollTop;
    }
  }, [notes, layerState]);

  const handleExportAsJson = useCallback(() => {
    const data = { notes, connections, layerState };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, 'culture-map-data.json');
  }, [notes, connections, layerState]);

  // =================================================================================
  // 렌더링 (Rendering)
  // =================================================================================

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
          <EnhancedCultureMapApp
            // 상태 전달
            notes={notes}
            connections={connections}
            activeTab={activeTab}
            analysisReportData={analysisReportData}
            boardTransform={boardTransform}
            editingNoteId={editingNoteId}
            selection={selection}
            selectedNoteIds={selectedNoteIds}
            connectingNoteId={connectingNoteId}
            contextMenu={contextMenu}
            isHelpModalOpen={isHelpModalOpen}
            layerControlVisible={layerControlVisible}
            
            // 층위 시스템 상태 전달 (시각적 가이드용)
            layerState={layerState}
            visualizationOptions={visualizationOptions}

            // 참조 전달
            boardRef={boardRef}
            scrollContainerRef={scrollContainerRef}

            // 상태 설정 함수 전달
            setActiveTab={setActiveTab}
            setIsHelpModalOpen={setIsHelpModalOpen}
            setLayerControlVisible={setLayerControlVisible}
            
            // 핸들러 함수 전달
            handleMouseDownOnBoard={handleMouseDownOnBoard}
            handleMouseDownOnNote={handleMouseDownOnNote}
            handleMouseDownOnResizeHandle={handleMouseDownOnResizeHandle}
            handleMouseDownOnLayerResizeHandle={handleMouseDownOnLayerResizeHandle}
            handleUpdateConnection={handleUpdateConnection}
            handleDeleteConnection={handleDeleteConnection}
            handleCloseContextMenu={handleCloseContextMenu}
            handleNoteContextMenu={handleNoteContextMenu}
            handleConnectionContextMenu={handleConnectionContextMenu}
            handleClearAll={handleClearAll}
            handleNoteClick={handleNoteClick}
            handleUpdateNote={handleUpdateNote}
            handleBoardContextMenu={handleBoardContextMenu}
            handleRenderFromText={handleRenderFromText}
            handleShowReport={handleShowReport}
            handleExportAsImage={handleExportAsImage}
            handleExportAsJson={handleExportAsJson}
            
            // 층위 시스템 함수 전달 (단순화)
            onLayerHeightChange={handleLayerHeightChange}
            setVisualizationOptions={setVisualizationOptions}
            setLayerState={setLayerState}
            
            // 계산된 값 전달
            highlightedLayers={[]} // 더 이상 사용 안함
          />
        )}
      </div>
    </Router>
  );
}

export default App;
