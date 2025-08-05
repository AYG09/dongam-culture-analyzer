// src/components/EnhancedStickyNote.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { NoteData } from '../types/culture';

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

  const getSentimentColor = useCallback(() => {
    const sentimentColors = {
      positive: 'rgba(59, 130, 246, 0.9)', // bg-blue-500/90
      negative: 'rgba(239, 68, 68, 0.9)',  // bg-red-500/90
      neutral: 'rgba(252, 211, 77, 0.9)', // bg-amber-300/90
    };
    return sentimentColors[note.sentiment] || sentimentColors.neutral;
  }, [note.sentiment]);

  const getPerceptionStyle = useCallback(() => {
    const perceptionStyles: Record<string, React.CSSProperties> = {
      '집중': { borderColor: '#EF4444', borderWidth: '3px' }, // border-red-500
      '관심': { borderColor: '#F59E0B', borderWidth: '2px' }, // border-amber-500
      '언급': { borderColor: '#6B7280', borderWidth: '1px' }, // border-gray-500
    };
    return perceptionStyles[note.perceptionIntensity || '언급'] || perceptionStyles['언급'];
  }, [note.perceptionIntensity]);

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
    if (isEditing) {
      return;
    }
    onMouseDown(e);
  }, [isEditing, onMouseDown]);

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // 왼쪽 클릭은 노트 이동에 사용되므로, 감정 상태 변경 로직 제거
    onClick(note.id);
  }, [note.id, onClick]);

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
    height: note.height || 120,
    backgroundColor: getSentimentColor(),
    borderStyle: 'solid',
    borderRadius: '8px',
    padding: '12px',
    cursor: isEditing ? 'text' : 'grab',
    zIndex: isSelected ? 1000 : note.layer,
    transition: animateTransitions ? 'all 0.2s ease-in-out' : 'none',
    boxShadow: isSelected 
      ? '0 6px 18px rgba(0, 0, 0, 0.3)' 
      : isHovered 
      ? '0 3px 10px rgba(0, 0, 0, 0.2)' 
      : '0 1px 4px rgba(0, 0, 0, 0.15)',
    ...getPerceptionStyle(),
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
      <div className="note-content">
        {isEditing ? (
          <textarea
            ref={contentRef}
            defaultValue={note.text}
            onBlur={handleEditComplete}
            onKeyDown={handleKeyDown}
            className="note-textarea"
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: '#111827' // text-gray-900
            }}
          />
        ) : (
          <>
            <div className="note-text" style={{ fontSize: '14px', lineHeight: '1.5', color: '#1f2937' /* text-gray-800 */ }}>
              {note.text}
            </div>
            {note.basis && (
              <div className="note-basis" style={{ marginTop: '8px', fontSize: '12px', color: '#4B5563', fontStyle: 'italic' }}>
                {note.basis}
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
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: '16px',
            height: '16px',
            background: '#3B82F6', // bg-blue-500
            cursor: 'se-resize',
            borderRadius: '8px',
            border: '2px solid white'
          }}
        />
      )}
    </div>
  );
};

export default EnhancedStickyNote;
