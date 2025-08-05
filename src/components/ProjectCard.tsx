// src/components/ProjectCard.tsx

import React from 'react';
import type { CultureProject } from '../types/culture';
import './ProjectCard.css';

interface ProjectCardProps {
  project: CultureProject;
  isActive: boolean;
  onSelect: (project: CultureProject) => void;
  onDelete: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  isActive, 
  onSelect, 
  onDelete 
}) => {
  const getStatusBadge = (status: CultureProject['status']) => {
    const statusConfig = {
      planning: { label: '계획 중', className: 'status-planning' },
      data_collection: { label: '데이터 수집', className: 'status-collecting' },
      analysis: { label: '분석 중', className: 'status-analyzing' },
      reporting: { label: '보고서 작성', className: 'status-reporting' },
      completed: { label: '완료', className: 'status-completed' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    // config가 undefined인 경우 기본값 사용
    if (!config) {
      return (
        <span className="status-badge status-planning">
          상태 알 수 없음
        </span>
      );
    }
    
    return (
      <span className={`status-badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 선택 이벤트 방지
    
    // 사용자 확인 대화상자
    const isConfirmed = window.confirm(
      `⚠️ 정말로 "${project.name}" 프로젝트를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`
    );
    
    if (!isConfirmed) {
      console.log('프로젝트 삭제 취소됨');
      return;
    }
    
    // 상위 컴포넌트의 삭제 핸들러에 위임
    console.log('🗑️ 프로젝트 삭제 요청:', project.id, project.name);
    onDelete(project.id);
  };

  return (
    <div 
      className={`project-card ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(project)}
    >
      <div className="project-card-header">
        <h3 className="project-name">{project.name}</h3>
        <div className="project-actions">
          {getStatusBadge(project.status)}
          <button 
            className="delete-btn"
            onClick={handleDelete}
            title="프로젝트 삭제"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="project-card-body">
        <p className="project-organization">
          <strong>조직:</strong> {project.organization}
        </p>
        <p className="project-description">
          {project.description}
        </p>
      </div>
      
      <div className="project-card-footer">
        <div className="project-dates">
          <span className="created-date">
            생성: {formatDate(project.created_at)}
          </span>
          <span className="updated-date">
            수정: {formatDate(project.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
