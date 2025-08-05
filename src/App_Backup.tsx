import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import type { MouseEvent } from 'react';
import './App.css';
// import './text-fix.css'; // 텍스트 문제 해결용 CSS - 문제의 원인이므로 비활성화
import EnhancedCultureMapApp from './components/EnhancedCultureMapApp';
import CultureDashboard from './components/CultureDashboard';
import type { CultureProject } from './types/culture';

type ActiveTab = 'map' | 'report' | 'dashboard';

// 앱 모드 타입 추가
type AppMode = 'culture_map' | 'culture_analysis';

// 드래그 중인 노트의 상태를 위한 타입
interface DragState {
  noteId: string;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  noteId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface PanningState {
  isPanning: boolean;
  startX: number;
  startY: number;
  initialTransformX: number;
  initialTransformY: number;
}

interface SelectionState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const GRID_SIZE = 20;

function App() {
  const [appMode, setAppMode] = useState<AppMode>('culture_map'); // 기본은 기존 컬처맵
  const [selectedProject, setSelectedProject] = useState<CultureProject | null>(null);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [draggingNote, setDraggingNote] = useState<DragState | null>(null);
  const [resizingNote, setResizingNote] = useState<ResizeState | null>(null);
  const [panning, setPanning] = useState<PanningState | null>(null);
  const [boardTransform, setBoardTransform] = useState({ x: 0, y: 0 });
  const [wasPanning, setWasPanning] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [multiDragInfo, setMultiDragInfo] = useState<{ noteId: string; offsetX: number; offsetY: number; } | null>(null);
  const [connectingNoteId, setConnectingNoteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [analysisReportData, setAnalysisReportData] = useState<ReportElement[]>([]);

  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseDownOnBoard = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // 포스트잇 노트가 아닌 모든 영역에서 패닝/선택 허용
    const isNoteClick = target.closest('.sticky-note') !== null;

    if (isNoteClick) {
      return;
    }

    // 왼쪽 버튼 -> 영역 선택 시작
    if (e.button === 0) {
      const board = boardRef.current;
      if (!board) return;
      
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      const rect = board.getBoundingClientRect();
      const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
      const startY = e.clientY - rect.top + scrollContainer.scrollTop;
      
      setSelection({ startX, startY, endX: startX, endY: startY });
      setSelectedNoteIds(new Set()); // 기존 선택 해제
      return;
    }
  
    // 오른쪽 버튼 -> 패닝 시작
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();

      const board = boardRef.current;
      if (!board) return;
      
      // 기존 컨텍스트 메뉴 닫기
      setContextMenu(null);
      
      // 패닝 상태 설정 - 현재 transform 값을 정확히 저장
      const panningState = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        initialTransformX: boardTransform.x,
        initialTransformY: boardTransform.y,
      };

      setPanning(panningState);
      setWasPanning(true);
      board.style.cursor = 'grabbing';
    }
  }, [boardTransform]);
  
  const handleMouseDownOnNote = useCallback((noteId: string, e: MouseEvent<HTMLDivElement>) => {
    // 왼쪽 버튼 클릭 시에만 노트 드래그 시작
    if (e.button !== 0) return;
  
    const noteElement = e.currentTarget;
    const rect = noteElement.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // --- 로직 순서 변경 ---
    // 1순위: 이미 선택된 노드 그룹을 드래그 시작하는 경우
    if (selectedNoteIds.has(noteId) && !e.shiftKey) {
      setMultiDragInfo({ noteId, offsetX, offsetY });
      noteElement.style.cursor = 'grabbing';
      return;
    }

    // 2순위: Shift 키로 노드를 개별 선택/해제 하는 경우
    if (e.shiftKey) {
      e.stopPropagation();
      setSelectedNoteIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(noteId)) {
          newSet.delete(noteId);
        } else {
          newSet.add(noteId);
        }
        return newSet;
      });
      return;
    }
  
    // 리사이즈 핸들에서 시작된 이벤트는 무시
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }

    // 3순위: 단일 노드를 선택하고 드래그 시작하는 경우
    setSelectedNoteIds(new Set([noteId]));
    setDraggingNote({ noteId, offsetX, offsetY });
    noteElement.style.cursor = 'grabbing';
  }, [selectedNoteIds]);
  
  const handleMouseDownOnResizeHandle = useCallback((noteId: string, e: MouseEvent<HTMLDivElement>) => {
    const noteToResize = notes.find(note => note.id === noteId);
    if (!noteToResize) return;
    
    e.stopPropagation(); // 드래그 방지
  
    setResizingNote({
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: noteToResize.width || 200, // 기본값
      startHeight: noteToResize.height || 120, // 기본값
    });
  }, [notes]);
  
  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement> | globalThis.MouseEvent) => {
    const board = boardRef.current;
    if (!board) return;

    // 영역 선택 로직
    if (selection && !draggingNote && !multiDragInfo) {
      const rect = board.getBoundingClientRect();
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
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
        // 충돌 감지
        if (noteRect.x1 < selRect.x2 && noteRect.x2 > selRect.x1 &&
            noteRect.y1 < selRect.y2 && noteRect.y2 > selRect.y1) {
          newSelectedIds.add(note.id);
        }
      });
      setSelectedNoteIds(newSelectedIds);
      return;
    }
  
    // 패닝 로직
    if (panning?.isPanning) {
      e.preventDefault();
      
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      
      const newTransformX = panning.initialTransformX + dx;
      const newTransformY = panning.initialTransformY + dy;

      setBoardTransform({ x: newTransformX, y: newTransformY });
      return;
    }
  
    // 다중 드래그 로직
    if (multiDragInfo) {
      const boardRect = board.getBoundingClientRect();
      const { noteId, offsetX, offsetY } = multiDragInfo;
  
      const referenceNote = notes.find(n => n.id === noteId);
      if (!referenceNote) return;

      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
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
            // 스냅-투-그리드
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            return { ...n, position: { x: newX, y: newY } };
          }
          return n;
        })
      );
      return;
    }
  
    // 노트 드래그 로직
    if (draggingNote) {
      const boardRect = board.getBoundingClientRect();
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      let x = e.clientX - boardRect.left - draggingNote.offsetX + scrollContainer.scrollLeft;
      let y = e.clientY - boardRect.top - draggingNote.offsetY + scrollContainer.scrollTop;
  
      // 스냅-투-그리드 로직
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
  
      setNotes(currentNotes =>
        currentNotes.map(note =>
          note.id === draggingNote.noteId
            ? { ...note, position: { x, y } }
            : note
        )
      );
      return; // 리사이즈와 동시 실행 방지
    }
  
    // 노트 리사이즈 로직
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
  }, [draggingNote, resizingNote, panning, selection, notes, multiDragInfo, selectedNoteIds]);
  
  const handleMouseUp = useCallback(() => {
    if (draggingNote) {
        const noteElement = document.getElementById(draggingNote.noteId);
        if (noteElement) {
            noteElement.style.cursor = 'grab';
        }
    }
    if (panning) {

      const board = boardRef.current;
      if (board) {
        board.style.cursor = 'default';
      }
    }
    setDraggingNote(null);
    setResizingNote(null);
    setPanning(null);
    setSelection(null);
    setMultiDragInfo(null);
    // 패닝 상태는 약간의 지연 후 리셋 (컨텍스트 메뉴 방지)
    setTimeout(() => setWasPanning(false), 100);
  }, [draggingNote, panning]);

  // 전역 마우스 이벤트 리스너 등록
  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      handleMouseMove(e);
    };
    const handleGlobalMouseUp = () => handleMouseUp();

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleConnectStart = useCallback((noteId: string) => {
    console.log('연결 시작:', noteId);
    setConnectingNoteId(noteId);
  }, []);

  const handleToggleSentiment = useCallback((noteId: string) => {
    setNotes(notes => notes.map(note => {
      if (note.id === noteId) {
        const nextSentiment: { [key in 'positive' | 'negative' | 'neutral']: 'positive' | 'negative' | 'neutral' } = {
          'positive': 'negative',
          'negative': 'neutral',
          'neutral': 'positive',
        };
        return { ...note, sentiment: nextSentiment[note.sentiment] };
      }
      return note;
    }));
  }, []);

  const handleUpdateConnection = useCallback((id: string, newType: 'direct' | 'indirect') => {
    setConnections(conns => conns.map(c => c.id === id ? { ...c, relationType: newType } : c));
  }, []);

  const handleDeleteConnection = useCallback((id: string) => {
    if (window.confirm('이 연결선을 삭제하시겠습니까?')) {
      setConnections(conns => conns.filter(c => c.id !== id));
    }
  }, []);
  
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  const handleNoteContextMenu = useCallback((e: MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation(); // 이벤트가 보드로 전파되는 것을 막음
    handleCloseContextMenu(); // 기존 메뉴 닫기

    const items: ContextMenuItem[] = [
      { label: '편집', action: () => setEditingNoteId(noteId) },
      { label: '연결 시작', action: () => handleConnectStart(noteId) },
      { label: '색상 전환 (긍정/부정/중립)', action: () => handleToggleSentiment(noteId) },
      { label: '삭제', action: () => {
        if(window.confirm('정말 이 포스트잇을 삭제하시겠습니까? 연결된 모든 선도 함께 삭제됩니다.')) {
          setNotes(notes => notes.filter(n => n.id !== noteId));
          setConnections(conns => conns.filter(c => c.sourceId !== noteId && c.targetId !== noteId));
        }
      }, isDanger: true },
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [notes, handleCloseContextMenu, handleConnectStart, handleToggleSentiment]);
  
  const handleConnectionContextMenu = useCallback((e: MouseEvent, connectionId: string) => {
    e.preventDefault();
    e.stopPropagation(); // 이벤트가 보드로 전파되는 것을 막음
    handleCloseContextMenu(); // 기존 메뉴 닫기
    
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;
  
    const items: ContextMenuItem[] = [
      { label: `'${conn.relationType === 'direct' ? '점선' : '실선'}'으로 전환`, action: () => handleUpdateConnection(connectionId, conn.relationType === 'direct' ? 'indirect' : 'direct') },
      { label: '연결선 삭제', action: () => handleDeleteConnection(connectionId), isDanger: true },
    ];
  
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [connections, handleCloseContextMenu, handleUpdateConnection, handleDeleteConnection]);
  
  const handleClearAll = useCallback(() => {
    if (window.confirm('정말 모든 포스트잇과 연결선을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setNotes([]);
      setConnections([]);
      setSelectedNoteIds(new Set());
      setAnalysisReportData([]);
    }
  }, []);
  
  const handleNoteClick = useCallback((targetNoteId: string) => {
    console.log('포스트잇 클릭:', { targetNoteId, connectingNoteId });
    if (connectingNoteId && connectingNoteId !== targetNoteId) {
      // 새로운 연결선 생성
      console.log('연결선 생성:', { from: connectingNoteId, to: targetNoteId });
      const newConnection: ConnectionData = {
        id: uuidv4(),
        sourceId: connectingNoteId,
        targetId: targetNoteId,
        isPositive: true, // 기본값, 추후 변경 기능 추가
        relationType: 'direct', // 기본값
      };
      setConnections(prev => [...prev, newConnection]);
      setConnectingNoteId(null); // 연결 모드 해제
    } else if (connectingNoteId && connectingNoteId === targetNoteId) {
      // 같은 노드를 다시 클릭하면 연결 모드 취소
      console.log('연결 모드 취소');
      setConnectingNoteId(null);
    }
  }, [connectingNoteId]);

  const handleAddNewNote = useCallback((type: '결과' | '행동' | '유형_레버' | '무형_레버', position: Position) => {
    const layerMap = { '결과': 0, '행동': 1, '유형_레버': 2, '무형_레버': 3 };
    const newNoteId = uuidv4();
    const newNote: NoteData = {
      id: newNoteId,
      type: type,
      content: '새 포스트잇',
      layerIndex: layerMap[type],
      sentiment: 'neutral',
      position: position,
      width: 200,
      height: 120,
    };
    setNotes(notes => [...notes, newNote]);
    setEditingNoteId(newNoteId); // 생성 후 바로 편집 모드
  }, []);

  const handleUpdateNote = useCallback((noteId: string, updates: Partial<NoteData>) => {
    setNotes(notes => notes.map(note => 
      note.id === noteId ? { ...note, ...updates } : note
    ));
    setEditingNoteId(null); // 편집 완료 후 편집 모드 해제
  }, []);

  const handleBoardContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 패닝 중이거나 패닝이 방금 끝났으면 컨텍스트 메뉴 표시하지 않음
    if (panning?.isPanning || wasPanning) {
      e.preventDefault();
      // 패닝 상태 리셋 (다음 우클릭부터는 컨텍스트 메뉴 허용)
      if (wasPanning) {
        setWasPanning(false);
      }
      return;
    }
    
    const target = e.target as HTMLElement;
    // 포스트잇 노트가 아닌 영역에서만 컨텍스트 메뉴 표시
    const isNoteClick = target.closest('.sticky-note') !== null;
    if (isNoteClick) {
      return; // 포스트잇 노트의 컨텍스트 메뉴는 별도 처리
    }

    // 여기서만 preventDefault 호출 (패닝이 아닌 경우에만)
    e.preventDefault();

    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;

    // 컨텍스트 메뉴 아이템 생성
    const contextMenuItems = [
      {
        label: '결과 포스트잇 추가',
        action: () => handleAddNewNote('결과', { x, y }),
      },
      {
        label: '행동 포스트잇 추가',
        action: () => handleAddNewNote('행동', { x, y }),
      },
      {
        label: '유형 요인 포스트잇 추가',
        action: () => handleAddNewNote('유형_레버', { x, y }),
      },
      {
        label: '무형 요인 포스트잇 추가',
        action: () => handleAddNewNote('무형_레버', { x, y }),
      },
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: contextMenuItems,
    });
  }, [panning, wasPanning, handleAddNewNote]);
  
  const handleRenderFromText = (text: string) => {
    if (!text.trim()) {
      alert('입력 내용이 비어있습니다. 맵이 초기화됩니다.');
      handleClearAll();
      return;
    }
    try {
      const { notes: parsedNotes, connections: parsedConnections }: { notes: NoteData[], connections: ConnectionData[] } = parseAIOutput(text);

      if (parsedNotes.length === 0) {
        alert('분석 결과에서 유효한 노드를 찾지 못했습니다. AI 출력 형식을 확인해주세요.');
        return;
      }
      
      const { nodes: layoutedNodes, connections: layoutedConnections } = getLayoutedElements(parsedNotes, parsedConnections);

      setNotes(layoutedNodes);
      setConnections(layoutedConnections);
      setActiveTab('map');

    } catch (error) {
      console.error("Failed to parse or render map:", error);
      alert("맵 데이터 파싱에 실패했습니다. 입력 형식을 확인해주세요.");
    }
  };

  const handleShowReport = (reportText: string) => {
    const parsedData = parseIntelligent(reportText);
    setAnalysisReportData(parsedData);
    setActiveTab('report');
  };
  
  const handleExportAsImage = async () => {
    const mapElement = boardRef.current;
    if (!mapElement) {
      alert("맵 요소를 찾을 수 없습니다.");
      return;
    }

    const spinner = document.createElement('div');
    spinner.setAttribute('id', 'loading-spinner-overlay');
    spinner.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(spinner);

    try {
      // 실제 콘텐츠 영역 계산
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      notes.forEach(note => {
        const noteLeft = note.position.x;
        const noteTop = note.position.y;
        const noteRight = noteLeft + (note.width || 200);
        const noteBottom = noteTop + (note.height || 150);
        
        minX = Math.min(minX, noteLeft);
        minY = Math.min(minY, noteTop);
        maxX = Math.max(maxX, noteRight);
        maxY = Math.max(maxY, noteBottom);
      });
      
      // 콘텐츠가 없는 경우 기본값 설정
      if (notes.length === 0) {
        minX = 0; minY = 0; maxX = 800; maxY = 600;
      }
      
      // 여백 추가 (50px씩)
      const padding = 50;
      const captureX = Math.max(0, minX - padding);
      const captureY = Math.max(0, minY - padding);
      const captureWidth = (maxX - minX) + (padding * 2);
      const captureHeight = (maxY - minY) + (padding * 2);
      
      const canvas = await html2canvas(mapElement, {
        scale: 2, // 2배 해상도
        useCORS: true, // 외부 이미지/폰트 사용 허용
        x: captureX,
        y: captureY,
        width: captureWidth,
        height: captureHeight,
        scrollX: -mapElement.scrollLeft, // 맵의 스크롤 위치 보정
        scrollY: -mapElement.scrollTop,
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      saveAs(dataUrl, 'culture-map.png');
    } catch (error) {
      console.error('이미지 생성에 실패했습니다.', error);
      alert(`이미지 생성 중 오류가 발생했습니다: ${String(error)}`);
    } finally {
      if (spinner.parentNode) {
        spinner.parentNode.removeChild(spinner);
      }
    }
  };

  const handleExportAsJson = () => {
    const data = {
      notes,
      connections,
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, 'culture-map-data.json'); // saveAs로 변경
  };

  // 조직문화 분석 프로젝트 선택 핸들러
  const handleProjectSelect = (project: CultureProject) => {
    setSelectedProject(project);
    setAppMode('culture_analysis');
    setActiveTab('dashboard');
  };

  // 컬처맵 모드로 돌아가기
  const handleBackToCultureMap = () => {
    setAppMode('culture_map');
    setSelectedProject(null);
    setActiveTab('map');
  };
  
  return (
    <Router>
      <div 
        className="app-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 조직문화 분석 모드 */}
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
          /* 기존 컬처맵 모드를 EnhancedCultureMapApp으로 교체 */
          <EnhancedCultureMapApp />
        )}
      </div>
    </Router>
  );
}

export default App;
                />
              </div>
              <div className="main-content">
                <div className="view-tabs no-print">
                  <button 
                    className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveTab('map')}
                  >
                    컬처 맵
                  </button>
                  <button 
                    className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
                    onClick={() => setActiveTab('report')}
                  >
                    분석 보고서
                  </button>
                </div>

                <div className="view-content">
                  {activeTab === 'map' ? (
                    <div className="map-scroll-container" ref={scrollContainerRef}>
                      <div 
                        ref={boardRef}
                        id="notes-board" 
                        className="notes-board"
                        onMouseDown={handleMouseDownOnBoard}
                        onContextMenu={handleBoardContextMenu}
                        style={{
                          transform: `translate(${boardTransform.x}px, ${boardTransform.y}px)`,
                        }}
                      >
                        {/* 5000x5000 영역을 강제로 확보하는 더미 요소 */}
                        <div 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '5000px',
                            height: '5000px',
                            pointerEvents: 'none',
                            zIndex: -1,
                            opacity: 0
                          }}
                        />
                        {selection && (
                          <div
                            className="selection-box"
                            style={{
                              left: Math.min(selection.startX, selection.endX),
                              top: Math.min(selection.startY, selection.endY),
                              width: Math.abs(selection.startX - selection.endX),
                              height: Math.abs(selection.startY - selection.endY),
                            }}
                          />
                        )}
                        <ConnectionsLayer 
                          connections={connections} 
                          notes={notes}
                          onUpdateConnection={handleUpdateConnection}
                          onDeleteConnection={handleDeleteConnection}
                          onConnectionContextMenu={handleConnectionContextMenu}
                        />
                        {notes.map((note) => (
                          <StickyNote 
                            key={note.id} 
                            note={note} 
                            onMouseDown={(e) => handleMouseDownOnNote(note.id, e)}
                            onResizeStart={(e) => handleMouseDownOnResizeHandle(note.id, e)}
                            onConnectStart={handleConnectStart}
                            onToggleSentiment={handleToggleSentiment}
                            onClick={handleNoteClick}
                            onUpdate={handleUpdateNote}
                            onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
                            isConnecting={connectingNoteId === note.id}
                            isSelected={selectedNoteIds.has(note.id)}
                            isEditing={editingNoteId === note.id}
                            connectingNoteId={connectingNoteId}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <AnalysisReport reportData={analysisReportData} />
                  )}
                </div>
              </div>
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={handleCloseContextMenu} />}
            {isHelpModalOpen && <HelpModal onClose={() => setIsHelpModalOpen(false)} />}
          </>
        )}
      </div>
    </Router>
  )
}

export default App
