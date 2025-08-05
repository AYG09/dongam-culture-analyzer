// src/components/EnhancedStickyNote.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { NoteData, PerceptionIntensity, NoteType } from '../types/culture';

interface EnhancedStickyNoteProps {
  note: NoteData;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
  onUpdate: (noteId: string, updates: Partial<NoteData>) => void;
  onContextMenu: (e: MouseEvent, noteId: string) => void;
  onClick: (noteId: string) => void;
  
  isSelected: boolean;
  isEditing: boolean;
  isConnecting: boolean;
  connectingNoteId: string | null;
  
  animateTransitions?: boolean;
}

const TypeTag: React.FC<{ type: NoteType }> = ({ type }) => {
  const typeStyleMap: { [key: string]: { label: string; style: React.CSSProperties } } = {
    '결과': { label: '결과', style: { backgroundColor: '#F3E8FF', color: '#581C87' } },
    '행동': { label: '행동', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
    '유형_레버': { label: '유형', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
    '무형_레버': { label: '무형', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
    'insight': { label: '인사이트', style: { backgroundColor: '#E0E7FF', color: '#3730A3' } },
    'default': { label: '기타', style: { backgroundColor: '#E5E7EB', color: '#1F2937' } },
  };

  const { label, style } = typeStyleMap[type] || typeStyleMap['default'];

  return (
    <div className="tag type-tag" style={style}>
      {label}
    </div>
  );
};

const PerceptionTag: React.FC<{ intensity: PerceptionIntensity }> = ({ intensity }) => {
  const perceptionStyles: Record<PerceptionIntensity, React.CSSProperties> = {
    '집중': { backgroundColor: '#FECACA', color: '#991B1B' }, // red-200, red-800
    '관심': { backgroundColor: '#FDE68A', color: '#92400E' }, // amber-200, amber-800
    '언급': { backgroundColor: '#E5E7EB', color: '#1F2937' }, // gray-200, gray-800
  };

  return (
    <div className="tag perception-tag" style={perceptionStyles[intensity]}>
      {intensity}
    </div>
  );
};


export const EnhancedStickyNote: React.FC<EnhancedStickyNoteProps> = ({
  note,
  onMouseDown,
  onResizeStart,
  onUpdate,
  onContextMenu,
  onClick,
  isSelected,
  isEditing,
  isConnecting,
  connectingNoteId,
  animateTransitions = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const getSentimentBorderStyle = useCallback(() => {
    const sentimentStyles: Record<string, React.CSSProperties> = {
      positive: { borderColor: '#3B82F6' }, // blue-500
      negative: { borderColor: '#EF4444' }, // red-500
      neutral: { borderColor: '#A1A1AA' },  // zinc-400
    };
    return sentimentStyles[note.sentiment] || sentimentStyles.neutral;
  }, [note.sentiment]);

  const handleEditComplete = useCallback(() => {
    if (contentRef.current) {
      const newContent = contentRef.current.value.trim();
      onUpdate(note.id, { text: newContent });
    } else {
      onUpdate(note.id, {});
    }
  }, [note.id, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditComplete();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onUpdate(note.id, {});
    }
  }, [handleEditComplete, onUpdate, note.id]);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 이벤트 전파를 막아 보드 핸들러 방지
    if (isEditing) {
      return;
    }
    onMouseDown(e);
  }, [isEditing, onMouseDown]);

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 클릭 이벤트 전파도 막습니다.
    onClick(note.id);
  }, [note.id, onClick]);

  const sentimentBorderStyle = getSentimentBorderStyle();

  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus();
      contentRef.current.select();
    }
  }, [isEditing]);

  const noteStyle: React.CSSProperties = {
    position: 'absolute',
    left: note.position.x,
    top: note.position.y,
    width: note.width || 200,
    height: note.height || 'auto', // 자동 높이
    minHeight: 120,
    backgroundColor: 'white',
    borderStyle: 'solid',
    borderWidth: '3px',
    borderRadius: '12px',
    padding: '12px',
    cursor: isEditing ? 'text' : 'grab',
    zIndex: isSelected ? 1000 : note.layer,
    transition: animateTransitions ? 'all 0.2s ease-in-out' : 'none',
    boxShadow: isSelected 
      ? '0 6px 18px rgba(0, 0, 0, 0.3)' 
      : isHovered 
      ? '0 3px 10px rgba(0, 0, 0, 0.2)' 
      : '0 1px 4px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    ...sentimentBorderStyle,
  };

  return (
    <div
      id={note.id}
      className={`enhanced-sticky-note ${isSelected ? 'selected' : ''} ${isConnecting ? 'connecting' : ''}`}
      style={noteStyle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, note.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-header">
        <TypeTag type={note.type} />
        {note.perceptionIntensity && <PerceptionTag intensity={note.perceptionIntensity} />}
      </div>

      <div className="note-content">
        {isEditing ? (
          <textarea
            ref={contentRef}
            defaultValue={note.text}
            onBlur={handleEditComplete}
            onKeyDown={handleKeyDown}
            className="note-textarea"
          />
        ) : (
          <>
            <div className="note-text">
              {note.text}
            </div>
            {note.basis && (
              <div className="note-basis">
                <div className="note-basis-content">
                  <span>{note.basis.author}, {note.basis.year}</span>
                  <span className="note-basis-theory">&lt;{note.basis.theory}&gt;</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isConnecting && (
        <div className="connection-indicator">
          <div className="connection-pulse" />
        </div>
      )}

      {connectingNoteId && connectingNoteId !== note.id && (
        <div className="connection-target">
          Connect
        </div>
      )}

      {isSelected && !isEditing && (
        <div
          className="resize-handle"
          onMouseDown={onResizeStart}
          style={{
            background: sentimentBorderStyle.borderColor,
          }}
        />
      )}
    </div>
  );
};

export default EnhancedStickyNote;
