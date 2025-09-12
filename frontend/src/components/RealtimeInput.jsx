import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';
import './RealtimeInput.css';

export const RealtimeInput = ({ 
  fieldId, 
  sessionCode, 
  placeholder, 
  multiline = false, 
  value: externalValue = '',
  onChange,
  ...props 
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);
  
  const inputRef = useRef(null);
  const updateTimeout = useRef(null);
  const lockAcquired = useRef(false);
  
  const {
    lockField,
    unlockField,
    updateFieldValue,
    isFieldLocked,
    isFieldLockedByMe,
    getFieldValue
  } = useRealtimeSync(sessionCode);

  // 서버에서 받은 값으로 업데이트 (다른 사용자가 수정한 경우)
  useEffect(() => {
    if (!isFocused && !isFieldLockedByMe(fieldId)) {
      const serverValue = getFieldValue(fieldId);
      if (serverValue !== localValue) {
        setLocalValue(serverValue);
        if (onChange) {
          onChange({ target: { value: serverValue } });
        }
      }
    }
  }, [getFieldValue, fieldId, isFocused, isFieldLockedByMe, localValue, onChange]);

  // 외부 값 변경 감지
  useEffect(() => {
    if (externalValue !== localValue && !isFocused) {
      setLocalValue(externalValue);
    }
  }, [externalValue, localValue, isFocused]);

  // 디바운스된 업데이트 함수
  const debouncedUpdate = useCallback(async (value) => {
    if (lockAcquired.current) {
      const success = await updateFieldValue(fieldId, value);
      if (success && onChange) {
        onChange({ target: { value } });
      }
    }
  }, [updateFieldValue, fieldId, onChange]);

  // 포커스 획득 시 잠금 시도
  const handleFocus = async (e) => {
    setIsFocused(true);
    
    if (!isFieldLocked(fieldId)) {
      const locked = await lockField(fieldId);
      if (locked) {
        lockAcquired.current = true;
      } else {
        // 잠금 실패 시 포커스 해제
        if (inputRef.current) {
          inputRef.current.blur();
        }
        alert('다른 사용자가 이 필드를 편집 중입니다.');
        return;
      }
    } else {
      // 이미 잠겨있으면 포커스 해제
      if (inputRef.current) {
        inputRef.current.blur();
      }
      alert('다른 사용자가 이 필드를 편집 중입니다.');
      return;
    }
    
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  // 포커스 잃을 때 잠금 해제
  const handleBlur = async (e) => {
    setIsFocused(false);
    
    if (lockAcquired.current) {
      // 마지막 값 업데이트
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
      await debouncedUpdate(localValue);
      
      // 즉시 잠금 해제
      await unlockField(fieldId);
      lockAcquired.current = false;
    }
    
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  // 값 변경 처리
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // 디바운스 업데이트
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    updateTimeout.current = setTimeout(() => {
      debouncedUpdate(newValue);
    }, 200); // 200ms 디바운스
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
      if (lockAcquired.current) {
        unlockField(fieldId);
      }
    };
  }, [unlockField, fieldId]);

  // 스타일 클래스 결정
  const getInputClasses = () => {
    const classes = ['realtime-input'];
    
    if (isFieldLocked(fieldId) && !isFieldLockedByMe(fieldId)) {
      classes.push('locked-by-other');
    } else if (isFieldLockedByMe(fieldId)) {
      classes.push('locked-by-me');
    }
    
    return classes.join(' ');
  };

  const inputProps = {
    ...props,
    ref: inputRef,
    value: localValue,
    placeholder: isFieldLocked(fieldId) && !isFieldLockedByMe(fieldId) 
      ? '다른 사용자가 편집 중입니다...' 
      : placeholder,
    disabled: isFieldLocked(fieldId) && !isFieldLockedByMe(fieldId),
    className: getInputClasses(),
    onFocus: handleFocus,
    onBlur: handleBlur,
    onChange: handleChange
  };

  return multiline ? (
    <textarea {...inputProps} />
  ) : (
    <input type="text" {...inputProps} />
  );
};