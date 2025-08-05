// src/components/StickyNote.tsx

import { useState, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { NoteData } from '../types';

// 컴포넌트가 받을 props의 타입을 정의합니다.
interface StickyNoteProps {
  note: NoteData;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, noteId: string) => void;
  onConnectStart: (noteId: string) => void;
  onToggleSentiment: (noteId: string) => void;
  onClick: (noteId: string) => void;
  onUpdate: (noteId: string, updates: Partial<NoteData>) => void;
  isConnecting: boolean;
  isSelected: boolean;
  isEditing?: boolean;
  connectingNoteId?: string | null;
}

// 레이어별 이름과 클래스를 정의합니다.
const layerInfo = [
  { name: '결과', className: 'layer-outcomes' },
  { name: '행동', className: 'layer-behaviors' },
  { name: '명시적 요인', className: 'layer-stated' },
  { name: '암묵적 요인', className: 'layer-unstated' },
];

const StickyNote = ({ note, onMouseDown, onResizeStart, onContextMenu, onClick, onUpdate, isConnecting, isSelected, isEditing = false, connectingNoteId }: StickyNoteProps) => {
  const { id, content, layerIndex, sentiment, position, metadata, concept, source, category, perceptionIntensity } = note;
  const currentLayer = layerInfo[layerIndex] || layerInfo[0];
  
  const [isEditMode, setIsEditMode] = useState(isEditing);
  const [editContent, setEditContent] = useState(content);
  const [editConcept, setEditConcept] = useState(concept || '');
  const [editSource, setEditSource] = useState(source || '');
  const [editCategory, setEditCategory] = useState(category || '');
  
  const contentRef = useRef<HTMLTextAreaElement>(null);
  
  const sentimentClass = `sentiment-${sentiment}`;
  // 구성원 인식 강도 기반 CSS 클래스 생성
  const perceptionClass = perceptionIntensity ? `perception-${perceptionIntensity}` : '';
  const sentimentText = sentiment === 'positive' ? ' (긍정)' : sentiment === 'negative' ? ' (부정)' : '';
  const displayLabel = `${currentLayer.name}${sentimentText}`;

  // 편집 모드 시작
  useEffect(() => {
    if (isEditMode && contentRef.current) {
      contentRef.current.focus();
      contentRef.current.select();
    }
  }, [isEditMode]);

  // isEditing prop이 변경될 때 편집 모드 상태 동기화
  useEffect(() => {
    setIsEditMode(isEditing);
  }, [isEditing]);

  // 편집 모드 진입 시 최신 데이터로 편집 상태 초기화
  useEffect(() => {
    if (isEditMode) {
      console.log('편집 모드 진입:', { 
        id, 
        type: note.type, 
        content, 
        metadata, 
        concept, 
        source, 
        category 
      });
      
      setEditContent(content);
      
      // metadata에서 개념, 출처, 분류 파싱
      let conceptFromMeta = concept || '';
      let sourceFromMeta = source || '';
      let categoryFromMeta = category || '';
      
      if (metadata && (note.type.startsWith('유형_레버') || note.type.startsWith('무형_레버'))) {
        const parts = metadata.split(/,\s*(?=[^)]*(?:\(|$))/g);
        parts.forEach(part => {
          const [key, ...value] = part.split(':');
          const keyTrimmed = key.trim();
          const valueTrimmed = value.join(':').trim();
          
          if (keyTrimmed === '개념') {
            conceptFromMeta = valueTrimmed;
          } else if (keyTrimmed === '출처') {
            sourceFromMeta = valueTrimmed;
          } else if (keyTrimmed === '분류') {
            categoryFromMeta = valueTrimmed;
          }
        });
      }
      
      setEditConcept(conceptFromMeta);
      setEditSource(sourceFromMeta);
      setEditCategory(categoryFromMeta);
    }
  }, [isEditMode, content, concept, source, category, metadata, note.type]);

  const handleNoteClick = () => {
    console.log('StickyNote 클릭됨:', { id, isConnecting, connectingNoteId });
    if (connectingNoteId !== null) {
      // 연결 모드가 활성화되어 있으면 연결 처리
      console.log('연결 모드에서 클릭, App의 onClick 호출');
      onClick(id);
    } else {
      console.log('연결 모드가 아님, 아무것도 하지 않음');
    }
    // 연결 모드가 아닐 때는 아무것도 하지 않음 (편집은 우클릭 메뉴로만)
  };

  const handleSave = () => {
    const updates: Partial<NoteData> = {
      content: editContent,
    };
    
    // 유형/무형 레버인 경우 추가 필드 업데이트
    if (note.type.startsWith('유형_레버') || note.type.startsWith('무형_레버')) {
      updates.concept = editConcept;
      updates.source = editSource;
      updates.category = editCategory;
      
      // metadata도 함께 업데이트
      const metadataParts = [];
      if (editConcept) metadataParts.push(`개념: ${editConcept}`);
      if (editSource) metadataParts.push(`출처: ${editSource}`);
      if (editCategory) metadataParts.push(`분류: ${editCategory}`);
      updates.metadata = metadataParts.join(', ');
    }

    onUpdate(id, updates);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setEditConcept(concept || '');
    setEditSource(source || '');
    setEditCategory(category || '');
    setIsEditMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // 메타데이터를 파싱하여 렌더링하는 함수
  const renderMetadata = () => {
    if (!metadata) return null;
    // (개념: 조직 의례, 출처: Deal & Kennedy) -> ['개념: 조직 의례', '출처: Deal & Kennedy']
    const parts = metadata.split(/,\s*(?=[^)]*(?:\(|$))/g); 
    return (
      <div className="sticky-metadata">
        {parts.map((part, index) => {
          const [key, ...value] = part.split(':');
          return (
            <div key={index} className="metadata-item">
              <span className="metadata-key">{key.trim()}:</span>
              <span className="metadata-value">{value.join(':').trim()}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      id={id}
      className={`sticky-note ${currentLayer.className} ${sentimentClass} ${perceptionClass} ${isConnecting ? 'is-connecting' : ''} ${isSelected ? 'is-selected' : ''} ${isEditMode ? 'is-editing' : ''}`.trim()}
      data-type={note.type}
      style={{ left: `${position.x}px`, top: `${position.y}px`, width: note.width, height: note.height, cursor: isConnecting ? 'crosshair' : 'grab' }}
      onMouseDown={isEditMode ? undefined : onMouseDown}
      onClick={handleNoteClick}
      onContextMenu={(e) => onContextMenu(e, id)}
    >
      <div className="sticky-label">{displayLabel}</div>
      
      {isEditMode ? (
          <div className="sticky-edit-mode">
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="edit-content"
              placeholder="내용을 입력하세요"
            />
            
            {(() => {
              const shouldShowFields = (note.type.startsWith('유형_레버') || note.type.startsWith('무형_레버'));
              console.log('편집 필드 표시 조건:', { 
                noteType: note.type, 
                shouldShowFields, 
                isEditMode,
                editConcept,
                editSource,
                editCategory 
              });
              return shouldShowFields;
            })() && (
              <div className="edit-fields">
                <div className="field-group">
                  <label className="field-label">개념</label>
                  <input
                    type="text"
                    value={editConcept}
                    onChange={(e) => setEditConcept(e.target.value)}
                    placeholder="개념을 입력하세요"
                    className="field-input"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">출처</label>
                  <input
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="출처를 입력하세요"
                    className="field-input"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">분류</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="분류를 입력하세요"
                    className="field-input"
                  />
                </div>
              </div>
            )}
            
            <div className="edit-buttons">
              <button onClick={handleSave} className="save-btn">저장</button>
              <button onClick={handleCancel} className="cancel-btn">취소</button>
            </div>
          </div>
        ) : (
          <>
            <div className="sticky-content">{content}</div>
            {!isEditMode && renderMetadata()}
          </>
        )}
      
      <div className="resize-handle" onMouseDown={onResizeStart}></div>
    </div>
  );
};

export default StickyNote; 