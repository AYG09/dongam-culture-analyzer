import React, { useState, useEffect, useRef } from 'react';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';
import './RealtimeInput.css';

export const RealtimeInputWithSave = ({ 
  fieldId, 
  sessionCode, 
  placeholder, 
  multiline = false, 
  value: externalValue = '',
  onChange,
  ...props 
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const [originalValue, setOriginalValue] = useState(externalValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const inputRef = useRef(null);
  
  const {
    userId,
    lockField,
    unlockField,
    updateFieldValue,
    isFieldLocked,
    isFieldLockedByMe,
    getFieldValue
  } = useRealtimeSync(sessionCode);

  // 서버에서 받은 값으로 업데이트 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!isEditing) {
      const serverValue = getFieldValue(fieldId);
      if (serverValue !== localValue) {
        setLocalValue(serverValue);
        setOriginalValue(serverValue);
        if (onChange) {
          onChange({ target: { value: serverValue } });
        }
      }
    }
  }, [getFieldValue, fieldId, isEditing, localValue, onChange]);

  // 외부 값 변경 감지 (편집 중이 아닐 때만)
  useEffect(() => {
    if (externalValue !== localValue && !isEditing) {
      setLocalValue(externalValue);
      setOriginalValue(externalValue);
    }
  }, [externalValue, localValue, isEditing]);

  // 편집 시작
  const handleStartEdit = async () => {
    console.log(`[EDIT START] fieldId: ${fieldId}, current userId: ${userId}, lockedByOther: ${lockedByOther}, lockedByMe: ${isFieldLockedByMe(fieldId)}`);
    try {
      // 서버에 잠금 시도를 위임 (만료 락/자기 락 정리 포함)
      const success = await lockField(fieldId);
      console.log(`[EDIT START] lockField result: ${success}`);
      if (success) {
        setIsEditing(true);
        setOriginalValue(localValue);
        // 포커스는 약간 지연시켜서 UI가 업데이트된 후 적용
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      } else {
        alert('편집 시작에 실패했습니다. 다른 사용자가 편집 중일 수 있습니다.');
      }
    } catch (error) {
      console.error('Failed to start editing:', error);
      alert('편집 시작에 실패했습니다.');
    }
  };

  // 저장
  const handleSave = async () => {
    if (!isEditing) return;
    
    setIsSaving(true);
    try {
      const success = await updateFieldValue(fieldId, localValue);
      if (success) {
        await unlockField(fieldId);
        setIsEditing(false);
        setOriginalValue(localValue);
        if (onChange) {
          onChange({ target: { value: localValue } });
        }
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 취소
  const handleCancel = async () => {
    if (!isEditing) return;
    
    try {
      await unlockField(fieldId);
      setLocalValue(originalValue);
      setIsEditing(false);
      if (onChange) {
        onChange({ target: { value: originalValue } });
      }
    } catch (error) {
      console.error('Failed to cancel editing:', error);
    }
  };

  // 입력 값 변경
  const handleInputChange = (e) => {
    if (isEditing) {
      setLocalValue(e.target.value);
    }
  };

  // Enter 키로 저장 (multiline이 아닐 때만)
  const handleKeyDown = (e) => {
    if (!multiline && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // 현재 필드의 잠금 상태
  const lockedByMe = isFieldLockedByMe(fieldId);
  const lockedByOther = isFieldLocked(fieldId) && !lockedByMe;

  // CSS 클래스 결정
  let inputClass = 'realtime-input';
  if (lockedByMe || isEditing) {
    inputClass += ' locked-by-me';
  } else if (lockedByOther) {
    inputClass += ' locked-by-other';
  }

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className="realtime-input-container">
      <div className="input-wrapper">
        <InputComponent
          ref={inputRef}
          type={multiline ? undefined : 'text'}
          className={inputClass}
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!isEditing}
          readOnly={lockedByOther}
          {...props}
        />
        
        {lockedByOther && (
          <div className="lock-indicator">
            다른 사용자 편집 중...
          </div>
        )}
      </div>
      
      <div className="button-group">
        {!isEditing ? (
          <button 
            className="edit-button"
            onClick={() => {
              console.log(`[BUTTON CLICK] Edit button clicked for fieldId: ${fieldId}`);
              handleStartEdit();
            }}
          >
            편집
          </button>
        ) : (
          <>
            <button 
              className="save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
            <button 
              className="cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default RealtimeInputWithSave;