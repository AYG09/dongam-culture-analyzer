// src/components/DriveFileSelector.tsx

import React, { useState, useEffect } from 'react';
import type { DriveFileInfo } from '../types/culture';
import { driveAnalysisService } from '../services/DriveAnalysisService';
import './DriveFileSelector.css';

interface DriveFileSelectorProps {
  onFileSelected: (fileInfo: DriveFileInfo) => void;
  onCancel: () => void;
  onSearchingChange?: (isSearching: boolean) => void;
}

interface SearchFilters {
  dateFrom: string;
  dateTo: string;
  fileTypes: string[];
  minSize: number;
  maxSize: number;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

const initialFilters: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  fileTypes: [],
  minSize: 0,
  maxSize: 0,
  sortBy: 'date',
  sortOrder: 'desc'
};

const DriveFileSelector: React.FC<DriveFileSelectorProps> = ({ 
  onFileSelected, 
  onCancel,
  onSearchingChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DriveFileInfo[]>([]);
  const [filteredResults, setFilteredResults] = useState<DriveFileInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveFileInfo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  // 지원되는 파일 타입
  const supportedMimeTypes = [
    'text/plain',
    'application/pdf', 
    'application/vnd.google-apps.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

  const fileTypeOptions = [
    { value: 'text/plain', label: '📄 텍스트 파일', icon: '📄' },
    { value: 'application/pdf', label: '📕 PDF 문서', icon: '📕' },
    { value: 'application/vnd.google-apps.document', label: '📝 Google 문서', icon: '📝' },
    { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: '📘 Word 문서 (.docx)', icon: '📘' },
    { value: 'application/msword', label: '📘 Word 문서 (.doc)', icon: '📘' }
  ];

  const sortOptions = [
    { value: 'name', label: '이름순' },
    { value: 'date', label: '날짜순' },
    { value: 'size', label: '크기순' }
  ];

  // 필터링 및 정렬 로직
  useEffect(() => {
    let results = [...searchResults];

    // 날짜 필터링
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      results = results.filter(file => new Date(file.modifiedTime) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // 하루 끝까지 포함
      results = results.filter(file => new Date(file.modifiedTime) <= toDate);
    }

    // 파일 타입 필터링
    if (filters.fileTypes.length > 0) {
      results = results.filter(file => filters.fileTypes.includes(file.mimeType));
    }

    // 파일 크기 필터링
    if (filters.minSize > 0) {
      results = results.filter(file => (file.size || 0) >= filters.minSize * 1024);
    }
    if (filters.maxSize > 0) {
      results = results.filter(file => (file.size || 0) <= filters.maxSize * 1024 * 1024);
    }

    // 정렬
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ko-KR');
          break;
        case 'date':
          comparison = new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredResults(results);
  }, [searchResults, filters]);

  const validateSearch = () => {
    const newErrors: Record<string, string> = {};

    if (!searchQuery.trim()) {
      newErrors.search = '검색어를 입력해주세요.';
    } else if (searchQuery.length < 2) {
      newErrors.search = '검색어는 최소 2자 이상이어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleFileType = (mimeType: string) => {
    setFilters(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(mimeType)
        ? prev.fileTypes.filter(type => type !== mimeType)
        : [...prev.fileTypes, mimeType]
    }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const hasActiveFilters = () => {
    return filters.dateFrom || filters.dateTo || filters.fileTypes.length > 0 || 
           filters.minSize > 0 || filters.maxSize > 0 || 
           filters.sortBy !== 'date' || filters.sortOrder !== 'desc';
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.fileTypes.length > 0) count++;
    if (filters.minSize > 0 || filters.maxSize > 0) count++;
    if (filters.sortBy !== 'date' || filters.sortOrder !== 'desc') count++;
    return count;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSearch()) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    if (onSearchingChange) {
      onSearchingChange(true);
    }

    try {
      console.log(`🔍 Google Drive 검색 시작: "${searchQuery}"`);
      
      const results = await driveAnalysisService.searchDriveFiles(
        searchQuery, 
        supportedMimeTypes
      );
      
      setSearchResults(results);
      setSelectedFile(null);
      
      console.log(`✅ 검색 완료: ${results.length}개 파일 발견`);
      
    } catch (error) {
      console.error('❌ 파일 검색 실패:', error);
      setErrors({ search: '파일 검색 중 오류가 발생했습니다. Claude Desktop에서 실행하거나 다시 시도해주세요.' });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      if (onSearchingChange) {
        onSearchingChange(false);
      }
    }
  };

  const handleFileSelect = (file: DriveFileInfo) => {
    setSelectedFile(file);
    setErrors({});
  };

  const handleConfirmSelection = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (errors.search) {
      setErrors({});
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeIcon = (mimeType: string): string => {
    if (mimeType === 'text/plain') return '📄';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('document')) return '📝';
    if (mimeType.includes('word')) return '📘';
    return '📄';
  };

  return (
    <div className="drive-file-selector">
      <div className="selector-header">
        <h2>🔍 Google Drive 파일 검색</h2>
        <p>조직문화 분석에 사용할 파일을 검색하고 선택해주세요.</p>
      </div>

      <div className="mcp-status-card">
        <div className="status-icon">🚀</div>
        <div className="status-content">
          <h4>MCP Google Drive 연동</h4>
          <p>Claude Desktop에서 실행하면 실제 Google Drive 파일을 자동으로 검색할 수 있습니다.</p>
          <p className="status-note">브라우저에서는 샘플 데이터로 기능을 체험할 수 있습니다.</p>
        </div>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <label htmlFor="searchQuery" className="form-label">
            검색어
          </label>
          <div className="search-input-container">
            <input
              id="searchQuery"
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="예: 조직문화, 인터뷰, 설문조사"
              className={`form-input ${errors.search ? 'error' : ''}`}
              disabled={isSearching}
            />
            <button 
              type="submit" 
              className="search-btn"
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? '검색 중...' : '🔍 검색'}
            </button>
          </div>
          {errors.search && <span className="error-message">{errors.search}</span>}
        </div>
      </form>

      {/* 고급 필터 UI */}
      {hasSearched && searchResults.length > 0 && (
        <div className="advanced-filters">
          <div className="filter-header">
            <button 
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <span>🔍 고급 필터</span>
              {hasActiveFilters() && (
                <span className="filter-badge">{getActiveFilterCount()}</span>
              )}
              <span className={`filter-arrow ${showAdvancedFilters ? 'expanded' : ''}`}>▼</span>
            </button>
            {hasActiveFilters() && (
              <button 
                type="button"
                className="reset-filters-btn"
                onClick={resetFilters}
                title="필터 초기화"
              >
                🔄 초기화
              </button>
            )}
          </div>

          {showAdvancedFilters && (
            <div className="filter-panel">
              {/* 날짜 범위 필터 */}
              <div className="filter-group">
                <label className="filter-label">📅 날짜 범위</label>
                <div className="date-range-inputs">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="date-input"
                    placeholder="시작일"
                  />
                  <span className="date-separator">에서</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="date-input"
                    placeholder="종료일"
                  />
                  <span className="date-separator">까지</span>
                </div>
              </div>

              {/* 파일 타입 필터 */}
              <div className="filter-group">
                <label className="filter-label">📁 파일 타입</label>
                <div className="file-type-checkboxes">
                  {fileTypeOptions.map((option) => (
                    <label key={option.value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filters.fileTypes.includes(option.value)}
                        onChange={() => toggleFileType(option.value)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-text">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 파일 크기 필터 */}
              <div className="filter-group">
                <label className="filter-label">📊 파일 크기</label>
                <div className="size-range-inputs">
                  <div className="size-input-group">
                    <label className="size-label">최소 (KB)</label>
                    <input
                      type="number"
                      value={filters.minSize || ''}
                      onChange={(e) => updateFilter('minSize', parseInt(e.target.value) || 0)}
                      className="size-input"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div className="size-input-group">
                    <label className="size-label">최대 (MB)</label>
                    <input
                      type="number"
                      value={filters.maxSize || ''}
                      onChange={(e) => updateFilter('maxSize', parseInt(e.target.value) || 0)}
                      className="size-input"
                      min="0"
                      placeholder="제한 없음"
                    />
                  </div>
                </div>
              </div>

              {/* 정렬 옵션 */}
              <div className="filter-group">
                <label className="filter-label">🔄 정렬</label>
                <div className="sort-controls">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value as SearchFilters['sortBy'])}
                    className="sort-select"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    className={`sort-order-btn ${filters.sortOrder}`}
                    title={filters.sortOrder === 'asc' ? '오름차순' : '내림차순'}
                  >
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {hasSearched && (
        <div className="search-results">
          <div className="results-header">
            <h3>검색 결과 
              {searchResults.length !== filteredResults.length && (
                <span className="filter-count">({filteredResults.length}/{searchResults.length}개)</span>
              )}
              {searchResults.length === filteredResults.length && (
                <span>({searchResults.length}개)</span>
              )}
            </h3>
            {filteredResults.length > 0 && (
              <p className="results-hint">파일을 클릭하여 선택하고 확인 버튼을 눌러주세요.</p>
            )}
          </div>

          {filteredResults.length === 0 && searchResults.length > 0 ? (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <p>필터 조건에 맞는 파일이 없습니다.</p>
              <div className="no-results-hints">
                <p className="hint">• 필터 조건을 완화해보세요</p>
                <p className="hint">• 날짜 범위나 파일 타입을 다시 확인해보세요</p>
                <button 
                  type="button" 
                  className="reset-hint-btn" 
                  onClick={resetFilters}
                >
                  필터 초기화
                </button>
              </div>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <p>검색 결과가 없습니다.</p>
              <div className="no-results-hints">
                <p className="hint">• 다른 검색어로 시도해보세요</p>
                <p className="hint">• 파일 이름이나 내용에 포함된 키워드를 사용해보세요</p>
                <p className="hint">• Claude Desktop에서 실행하면 실제 Google Drive를 검색합니다</p>
              </div>
            </div>
          ) : (
            <div className="file-list">
              {filteredResults.map((file) => (
                <div 
                  key={file.id}
                  className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="file-icon">
                    {getFileTypeIcon(file.mimeType)}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      <span className="file-date">수정됨: {formatDate(file.modifiedTime)}</span>
                    </div>
                  </div>
                  {selectedFile?.id === file.id && (
                    <div className="selected-indicator">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedFile && (
        <div className="file-preview">
          <h4>선택된 파일</h4>
          <div className="preview-card">
            <div className="preview-icon">
              {getFileTypeIcon(selectedFile.mimeType)}
            </div>
            <div className="preview-info">
              <div className="preview-name">{selectedFile.name}</div>
              <div className="preview-meta">
                <div>크기: {formatFileSize(selectedFile.size)}</div>
                <div>수정일: {formatDate(selectedFile.modifiedTime)}</div>
                <div>타입: {selectedFile.mimeType}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button 
          type="button" 
          className="cancel-btn"
          onClick={onCancel}
          disabled={isSearching}
        >
          취소
        </button>
        <button 
          type="button" 
          className="submit-btn"
          onClick={handleConfirmSelection}
          disabled={!selectedFile || isSearching}
        >
          선택 확인
        </button>
      </div>

      <div className="supported-types">
        <p className="supported-title">📋 지원되는 파일 형식:</p>
        <div className="supported-list">
          <span>📄 텍스트 파일 (.txt)</span>
          <span>📕 PDF 문서 (.pdf)</span>
          <span>📝 Google 문서</span>
          <span>📘 Word 문서 (.docx, .doc)</span>
        </div>
      </div>
    </div>
  );
};

export default DriveFileSelector;