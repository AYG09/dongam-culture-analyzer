// src/services/DatabaseService_Extended.ts
// 🔥 진화적 자율 에이전트: 다중 조직 분석 관리 시스템 확장

import { databaseService } from './DatabaseService';

/**
 * 진화적 확장: 다중 조직 분석 관리 시스템
 * 기존 DatabaseService와 완벽한 호환성 유지
 */
export class DatabaseServiceExtended {
  private baseService = databaseService;

  /**
   * 🚀 진화적 스키마 업그레이드 (호환성 유지)
   */
  async upgradeSchemaEvolutionary(): Promise<boolean> {
    try {
      console.log('🔄 진화적 스키마 업그레이드 시작...');
      
      // 1. 새 테이블 생성
      const newTables = [
        `CREATE TABLE IF NOT EXISTS organization_analyses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          culture_project_id INTEGER NOT NULL,
          organization_code TEXT UNIQUE NOT NULL,
          industry_type TEXT,
          organization_size TEXT,
          analysis_status TEXT DEFAULT 'in_progress' CHECK (analysis_status IN ('draft', 'in_progress', 'completed', 'archived')),
          culture_map_data JSON,
          key_insights JSON,
          recommendations JSON,
          analysis_summary TEXT,
          completion_date DATE,
          analyst_notes TEXT,
          tags JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (culture_project_id) REFERENCES culture_projects(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS analysis_comparisons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comparison_name TEXT NOT NULL,
          organization_ids JSON NOT NULL,
          comparison_criteria JSON,
          comparative_insights JSON,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];
      
      for (const tableSQL of newTables) {
        this.baseService.query(tableSQL);
      }
      
      // 2. 인덱스 생성
      await this.createEvolutionaryIndexes();
      
      console.log('✅ 진화적 스키마 업그레이드 완료');
      return true;
      
    } catch (error) {
      console.error('❌ 진화적 스키마 업그레이드 실패:', error);
      return false;
    }
  }

  /**
   * 진화적 인덱스 생성 (성능 최적화)
   */
  private async createEvolutionaryIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_org_analyses_code ON organization_analyses(organization_code)',
      'CREATE INDEX IF NOT EXISTS idx_org_analyses_status ON organization_analyses(analysis_status)',
      'CREATE INDEX IF NOT EXISTS idx_org_analyses_industry ON organization_analyses(industry_type)',
      'CREATE INDEX IF NOT EXISTS idx_org_analyses_size ON organization_analyses(organization_size)',
      'CREATE INDEX IF NOT EXISTS idx_org_analyses_project ON organization_analyses(culture_project_id)',
      'CREATE INDEX IF NOT EXISTS idx_comparisons_created ON analysis_comparisons(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_culture_projects_stage ON culture_projects(current_stage)',
      'CREATE INDEX IF NOT EXISTS idx_culture_projects_framework ON culture_projects(framework_type)'
    ];

    for (const indexSQL of indexes) {
      try {
        this.baseService.query(indexSQL);
      } catch (error) {
        console.warn('⚠️ 인덱스 생성 실패 (무시됨):', indexSQL, error);
      }
    }
    console.log('✅ 진화적 인덱스 생성 완료');
  }

  /**
   * 조직 분석 결과 저장 (진화적 접근법)
   */
  async saveOrganizationAnalysis(data: {
    culture_project_id: number;
    organization_code: string;
    industry_type?: string;
    organization_size?: string;
    analysis_status?: 'draft' | 'in_progress' | 'completed' | 'archived';
    culture_map_data?: any;
    key_insights?: any;
    recommendations?: any;
    analysis_summary?: string;
    completion_date?: string;
    analyst_notes?: string;
    tags?: any;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      // 기존 데이터 확인 (UPSERT 패턴)
      const existing = this.baseService.query(
        'SELECT id FROM organization_analyses WHERE organization_code = ?',
        [data.organization_code]
      );
      
      if (existing.length > 0) {
        // UPDATE
        const updateFields = Object.keys(data)
          .filter(key => key !== 'organization_code' && data[key as keyof typeof data] !== undefined)
          .map(key => `${key} = ?`)
          .join(', ');
        
        const updateValues = Object.keys(data)
          .filter(key => key !== 'organization_code' && data[key as keyof typeof data] !== undefined)
          .map(key => {
            const value = data[key as keyof typeof data];
            return typeof value === 'object' ? JSON.stringify(value) : value;
          });
        
        updateValues.push(data.organization_code);
        
        this.baseService.query(
          `UPDATE organization_analyses SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE organization_code = ?`,
          updateValues
        );
        
        return { success: true, id: existing[0].id };
      } else {
        // INSERT
        const fields = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data).map(value => 
          typeof value === 'object' ? JSON.stringify(value) : value
        );
        
        const result = this.baseService.query(
          `INSERT INTO organization_analyses (${fields}) VALUES (${placeholders})`,
          values
        );
        
        return { success: true, id: result[0]?.lastInsertRowid };
      }
    } catch (error) {
      console.error('❌ 조직 분석 저장 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  /**
   * 조직 분석 결과 조회 (고급 필터링)
   */
  getOrganizationAnalyses(filters: {
    status?: string;
    industry_type?: string;
    organization_size?: string;
    tags?: string[];
    dateRange?: { start: string; end: string };
    limit?: number;
    offset?: number;
  } = {}): any[] {
    try {
      let whereConditions: string[] = [];
      let params: any[] = [];
      
      if (filters.status) {
        whereConditions.push('analysis_status = ?');
        params.push(filters.status);
      }
      
      if (filters.industry_type) {
        whereConditions.push('industry_type = ?');
        params.push(filters.industry_type);
      }
      
      if (filters.organization_size) {
        whereConditions.push('organization_size = ?');
        params.push(filters.organization_size);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        // JSON 기반 태그 검색
        const tagConditions = filters.tags.map(() => 'JSON_EXTRACT(tags, "$") LIKE ?').join(' OR ');
        whereConditions.push(`(${tagConditions})`);
        filters.tags.forEach(tag => params.push(`%"${tag}"%`));
      }
      
      if (filters.dateRange) {
        whereConditions.push('created_at BETWEEN ? AND ?');
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      let sql = `
        SELECT oa.*, cp.organization_name, cp.framework_type
        FROM organization_analyses oa
        JOIN culture_projects cp ON oa.culture_project_id = cp.id
      `;
      
      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      sql += ' ORDER BY oa.updated_at DESC';
      
      if (filters.limit) {
        sql += ` LIMIT ${filters.limit}`;
        if (filters.offset) {
          sql += ` OFFSET ${filters.offset}`;
        }
      }
      
      return this.baseService.query(sql, params);
    } catch (error) {
      console.error('❌ 조직 분석 조회 실패:', error);
      return [];
    }
  }

  /**
   * 조직간 비교 분석 저장
   */
  async saveAnalysisComparison(data: {
    comparison_name: string;
    organization_ids: number[];
    comparison_criteria?: any;
    comparative_insights?: any;
    created_by?: string;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const result = this.baseService.query(
        `INSERT INTO analysis_comparisons 
         (comparison_name, organization_ids, comparison_criteria, comparative_insights, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.comparison_name,
          JSON.stringify(data.organization_ids),
          data.comparison_criteria ? JSON.stringify(data.comparison_criteria) : null,
          data.comparative_insights ? JSON.stringify(data.comparative_insights) : null,
          data.created_by || null
        ]
      );
      
      return { success: true, id: result[0]?.lastInsertRowid };
    } catch (error) {
      console.error('❌ 비교 분석 저장 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  /**
   * 비교 분석 목록 조회
   */
  getAnalysisComparisons(limit: number = 50): any[] {
    try {
      return this.baseService.query(
        'SELECT * FROM analysis_comparisons ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
    } catch (error) {
      console.error('❌ 비교 분석 조회 실패:', error);
      return [];
    }
  }

  /**
   * 대시보드용 통계 데이터 생성
   */
  getDashboardStats(): {
    totalOrganizations: number;
    completedAnalyses: number;
    inProgressAnalyses: number;
    totalComparisons: number;
    industryBreakdown: { industry_type: string; count: number }[];
    sizeBreakdown: { organization_size: string; count: number }[];
    recentActivity: any[];
  } {
    try {
      const totalOrganizations = this.baseService.query(
        'SELECT COUNT(*) as count FROM organization_analyses'
      )[0]?.count || 0;
      
      const completedAnalyses = this.baseService.query(
        "SELECT COUNT(*) as count FROM organization_analyses WHERE analysis_status = 'completed'"
      )[0]?.count || 0;
      
      const inProgressAnalyses = this.baseService.query(
        "SELECT COUNT(*) as count FROM organization_analyses WHERE analysis_status = 'in_progress'"
      )[0]?.count || 0;
      
      const totalComparisons = this.baseService.query(
        'SELECT COUNT(*) as count FROM analysis_comparisons'
      )[0]?.count || 0;
      
      const industryBreakdown = this.baseService.query(
        `SELECT industry_type, COUNT(*) as count 
         FROM organization_analyses 
         WHERE industry_type IS NOT NULL 
         GROUP BY industry_type 
         ORDER BY count DESC`
      );
      
      const sizeBreakdown = this.baseService.query(
        `SELECT organization_size, COUNT(*) as count 
         FROM organization_analyses 
         WHERE organization_size IS NOT NULL 
         GROUP BY organization_size 
         ORDER BY count DESC`
      );
      
      const recentActivity = this.baseService.query(
        `SELECT oa.organization_code, oa.analysis_status, oa.updated_at, cp.organization_name
         FROM organization_analyses oa
         JOIN culture_projects cp ON oa.culture_project_id = cp.id
         ORDER BY oa.updated_at DESC
         LIMIT 10`
      );
      
      return {
        totalOrganizations,
        completedAnalyses,
        inProgressAnalyses,
        totalComparisons,
        industryBreakdown,
        sizeBreakdown,
        recentActivity
      };
    } catch (error) {
      console.error('❌ 대시보드 통계 생성 실패:', error);
      return {
        totalOrganizations: 0,
        completedAnalyses: 0,
        inProgressAnalyses: 0,
        totalComparisons: 0,
        industryBreakdown: [],
        sizeBreakdown: [],
        recentActivity: []
      };
    }
  }

  /**
   * 조직 분석 데이터 내보내기 (CSV/Excel 호환)
   */
  exportOrganizationAnalyses(format: 'csv' | 'json' = 'csv'): string {
    try {
      const data = this.baseService.query(
        `SELECT 
          oa.organization_code,
          cp.organization_name,
          oa.industry_type,
          oa.organization_size,
          oa.analysis_status,
          oa.analysis_summary,
          oa.completion_date,
          oa.created_at,
          oa.updated_at
         FROM organization_analyses oa
         JOIN culture_projects cp ON oa.culture_project_id = cp.id
         ORDER BY oa.updated_at DESC`
      );
      
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else {
        // CSV 형식으로 변환
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(',') 
              ? `"${value.replace(/"/g, '""')}"` 
              : value
          ).join(',')
        );
        
        return [headers, ...rows].join('\n');
      }
    } catch (error) {
      console.error('❌ 조직 분석 데이터 내보내기 실패:', error);
      return '';
    }
  }

  /**
   * 기술부채 추적을 위한 데이터 품질 검사
   */
  performDataQualityCheck(): {
    issues: string[];
    recommendations: string[];
    score: number;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    try {
      // 1. 고아 레코드 검사
      const orphanedAnalyses = this.baseService.query(
        `SELECT COUNT(*) as count FROM organization_analyses oa
         LEFT JOIN culture_projects cp ON oa.culture_project_id = cp.id
         WHERE cp.id IS NULL`
      )[0]?.count || 0;
      
      if (orphanedAnalyses > 0) {
        issues.push(`${orphanedAnalyses}개의 고아 분석 레코드 발견`);
        recommendations.push('고아 레코드 정리 또는 관련 프로젝트 복구 필요');
        score -= 10;
      }
      
      // 2. 중복 조직 코드 검사
      const duplicateCodes = this.baseService.query(
        `SELECT organization_code, COUNT(*) as count 
         FROM organization_analyses 
         GROUP BY organization_code 
         HAVING count > 1`
      );
      
      if (duplicateCodes.length > 0) {
        issues.push(`${duplicateCodes.length}개의 중복 조직 코드 발견`);
        recommendations.push('중복 조직 코드 통합 또는 수정 필요');
        score -= 15;
      }
      
      // 3. 불완전한 분석 데이터 검사
      const incompleteAnalyses = this.baseService.query(
        `SELECT COUNT(*) as count FROM organization_analyses 
         WHERE analysis_status = 'completed' 
         AND (culture_map_data IS NULL OR key_insights IS NULL)`
      )[0]?.count || 0;
      
      if (incompleteAnalyses > 0) {
        issues.push(`${incompleteAnalyses}개의 불완전한 완료 분석 발견`);
        recommendations.push('완료 상태 분석의 데이터 보완 필요');
        score -= 20;
      }
      
      // 4. 오래된 진행중 분석 검사 (30일 이상)
      const staleAnalyses = this.baseService.query(
        `SELECT COUNT(*) as count FROM organization_analyses 
         WHERE analysis_status = 'in_progress' 
         AND created_at < datetime('now', '-30 days')`
      )[0]?.count || 0;
      
      if (staleAnalyses > 0) {
        issues.push(`${staleAnalyses}개의 장기 진행중 분석 발견`);
        recommendations.push('장기 진행중 분석 상태 검토 및 업데이트 필요');
        score -= 10;
      }
      
      console.log('✅ 데이터 품질 검사 완료', { issues: issues.length, score });
      
      return { issues, recommendations, score: Math.max(0, score) };
      
    } catch (error) {
      console.error('❌ 데이터 품질 검사 실패:', error);
      return {
        issues: ['데이터 품질 검사 실행 실패'],
        recommendations: ['데이터베이스 연결 상태 확인 필요'],
        score: 0
      };
    }
  }

  /**
   * window.sqlite 객체에 확장 기능 추가
   */
  extendWindowSqlite(): void {
    try {
      if (typeof window !== 'undefined' && (window as any).sqlite) {
        const extended = {
          ...(window as any).sqlite,
          // 진화적 확장 메서드들
          upgradeSchema: this.upgradeSchemaEvolutionary.bind(this),
          saveOrganizationAnalysis: this.saveOrganizationAnalysis.bind(this),
          getOrganizationAnalyses: this.getOrganizationAnalyses.bind(this),
          saveAnalysisComparison: this.saveAnalysisComparison.bind(this),
          getAnalysisComparisons: this.getAnalysisComparisons.bind(this),
          getDashboardStats: this.getDashboardStats.bind(this),
          exportOrganizationAnalyses: this.exportOrganizationAnalyses.bind(this),
          performDataQualityCheck: this.performDataQualityCheck.bind(this)
        };
        
        (window as any).sqlite = extended;
        console.log('✅ window.sqlite 진화적 확장 완료');
      }
    } catch (error) {
      console.error('❌ window.sqlite 확장 실패:', error);
    }
  }
}

// 진화적 확장 서비스 인스턴스
export const databaseServiceExtended = new DatabaseServiceExtended();
export default DatabaseServiceExtended;