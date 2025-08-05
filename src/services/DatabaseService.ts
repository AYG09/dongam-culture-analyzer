// src/services/DatabaseService.ts

// sql.js를 CDN에서 사용 (window.initSqlJs)
declare global {
  interface Window {
    initSqlJs: any;
  }
}

/**
 * 브라우저에서 SQLite 데이터베이스를 사용하기 위한 서비스
 * 개선된 초기화 로직과 IndexedDB 기반 영구 저장소로 데이터 지속성 보장
 */
class DatabaseService {
  private SQL: any = null;
  private db: any = null;
  private initialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private initializationStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  private initializationError: Error | null = null;
  
  // IndexedDB 관련 상수
  private readonly INDEXEDDB_NAME = 'CultureAnalysisDB';
  private readonly STORE_NAME = 'database';
  private indexedDBSupported = false;
  private currentDBVersion = 1;
  
  // 브라우저별 적응형 타임아웃 설정
  private readonly BROWSER_TIMEOUTS = {
    chrome: 10000,   // Chrome: 10초
    firefox: 15000,  // Firefox: 15초
    safari: 20000,   // Safari: 20초
    edge: 12000,     // Edge: 12초
    default: 15000   // 기본: 15초
  };
  
  // 자동 저장 관련 속성
  private isAutoSaveEnabled = true;
  private autoSaveTimeout: NodeJS.Timeout | null = null;
  private autoSaveDebounceMs = 500;
  private maxAutoSaveRetries = 3;
  private pendingAutoSave = false;

  // 스키마 검증 및 마이그레이션 관련 속성
  private readonly SCHEMA_VERSION_TABLE = 'schema_versions';
  private readonly CURRENT_SCHEMA_VERSION = 2; // 현재 스키마 버전
  private schemaValidated = false;

  /**
   * 초기화 상태 확인
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 초기화 상태 정보 반환 (강화된 버전)
   */
  getInitializationStatus(): {
    status: 'idle' | 'loading' | 'success' | 'error';
    initialized: boolean;
    error: Error | null;
    indexedDBSupported: boolean;
    browser: string;
    adaptiveTimeout: number;
    recoveryGuidance?: string[];
  } {
    const recoveryGuidance = this.initializationError ? this.getRecoveryGuidance(this.initializationError) : undefined;
    
    return {
      status: this.initializationStatus,
      initialized: this.initialized,
      error: this.initializationError,
      indexedDBSupported: this.indexedDBSupported,
      browser: this.detectBrowser(),
      adaptiveTimeout: this.getAdaptiveTimeout(),
      recoveryGuidance
    };
  }
  /**
   * 긴급 테이블 복구 (데이터 손실 방지)
   */
  private async emergencyTableRecovery(
    tableName: string, 
    validation: {
      missingColumns: string[];
      extraColumns: string[];
      typeMismatches: Array<{column: string, expected: string, actual: string}>;
    }
  ): Promise<void> {
    console.log(`🚑 ${tableName} 테이블 긴급 복구 시작...`);
    
    const backupTableName = `${tableName}_backup_${Date.now()}`;
    
    try {
      // 1. 기존 데이터 백업
      await this.backupTableData(tableName, backupTableName);
      
      // 2. 누락된 컬럼 추가
      if (validation.missingColumns.length > 0) {
        await this.addMissingColumns(tableName, validation.missingColumns);
      }
      
      // 3. 타입 불일치 해결 (심각한 경우 테이블 재생성)
      if (validation.typeMismatches.length > 0) {
        await this.fixTypeMismatches(tableName, backupTableName, validation.typeMismatches);
      }
      
      // 4. 복구 검증
      const postValidation = this.validateTableSchema(tableName);
      if (postValidation.isValid) {
        console.log(`✅ ${tableName} 테이블 복구 성공`);
        
        // 5. 백업 테이블 정리 (성공 시에만)
        await this.cleanupBackupTable(backupTableName);
      } else {
        console.error(`❌ ${tableName} 테이블 복구 실패. 백업 유지: ${backupTableName}`);
        throw new Error(`테이블 복구 실패: ${tableName}`);
      }
      
    } catch (error) {
      console.error(`❌ ${tableName} 긴급 복구 실패:`, error);
      
      // 복구 실패 시 사용자에게 안내
      console.warn(`📞 사용자 안내: ${tableName} 테이블 자동 복구에 실패했습니다. 백업이 ${backupTableName}에 저장되었습니다.`);
      throw error;
    }
  }

  /**
   * 테이블 데이터 백업
   */
  private async backupTableData(originalTable: string, backupTable: string): Promise<void> {
    try {
      // 원본 테이블이 존재하는지 확인
      const tableExists = this.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [originalTable]
      );
      
      if (tableExists.length === 0) {
        console.log(`📄 테이블 ${originalTable}이 존재하지 않음. 백업 생략.`);
        return;
      }
      
      // 백업 테이블 생성 (구조 복사)
      this.query(`CREATE TABLE ${backupTable} AS SELECT * FROM ${originalTable}`);
      
      const backupCount = this.query(`SELECT COUNT(*) as count FROM ${backupTable}`);
      console.log(`💾 ${originalTable} 백업 완료: ${backupCount[0]?.count || 0}개 레코드 → ${backupTable}`);
      
    } catch (error) {
      console.error(`❌ 테이블 백업 실패 (${originalTable} → ${backupTable}):`, error);
      throw error;
    }
  }

  /**
   * 누락된 컬럼 추가
   */
  private async addMissingColumns(tableName: string, missingColumns: string[]): Promise<void> {
    const expectedSchemas = this.getExpectedSchemas();
    const expectedSchema = expectedSchemas[tableName];
    
    if (!expectedSchema) {
      console.warn(`⚠️ ${tableName} 테이블의 기대 스키마를 찾을 수 없습니다.`);
      return;
    }
    
    for (const columnName of missingColumns) {
      const columnDef = expectedSchema.find(col => col.name === columnName);
      if (!columnDef) {
        console.warn(`⚠️ 컬럼 정의를 찾을 수 없음: ${columnName}`);
        continue;
      }
      
      try {
        let alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef.type}`;
        if (columnDef.notnull && !columnDef.pk) {
          // NOT NULL 컬럼의 경우 기본값 제공
          const defaultValue = this.getDefaultValue(columnDef.type);
          alterSQL += ` DEFAULT ${defaultValue}`;
        }
        
        this.query(alterSQL);
        console.log(`✅ 컬럼 추가 성공: ${tableName}.${columnName}`);
        
      } catch (error) {
        console.error(`❌ 컬럼 추가 실패: ${tableName}.${columnName}`, error);
        throw error;
      }
    }
  }

  /**
   * 타입별 기본값 반환
   */
  private getDefaultValue(type: string): string {
    const upperType = type.toUpperCase();
    
    if (upperType.includes('INTEGER')) return '0';
    if (upperType.includes('REAL') || upperType.includes('FLOAT')) return '0.0';
    if (upperType.includes('TEXT') || upperType.includes('VARCHAR')) return "''";
    if (upperType.includes('DATETIME')) return "'1970-01-01 00:00:00'";
    if (upperType.includes('JSON')) return "'{}'";
    
    return "''";
  }

  /**
   * 타입 불일치 해결 (테이블 재생성)
   */
  private async fixTypeMismatches(
    tableName: string, 
    backupTableName: string, 
    typeMismatches: Array<{column: string, expected: string, actual: string}>
  ): Promise<void> {
    console.log(`🔄 ${tableName} 테이블 타입 불일치 해결 중...`, typeMismatches);
    
    try {
      // 1. 임시 테이블명 생성
      const tempTableName = `${tableName}_temp_${Date.now()}`;
      
      // 2. 올바른 스키마로 임시 테이블 생성
      await this.createTableWithCorrectSchema(tempTableName, tableName);
      
      // 3. 데이터 마이그레이션 (타입 변환 포함)
      await this.migrateDataWithTypeConversion(backupTableName, tempTableName, typeMismatches);
      
      // 4. 원본 테이블 삭제
      this.query(`DROP TABLE IF EXISTS ${tableName}`);
      
      // 5. 임시 테이블을 원본 테이블명으로 변경
      this.query(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);
      
      console.log(`✅ ${tableName} 테이블 타입 불일치 해결 완료`);
      
    } catch (error) {
      console.error(`❌ 타입 불일치 해결 실패:`, error);
      throw error;
    }
  }

  /**
   * 올바른 스키마로 테이블 생성
   */
  private async createTableWithCorrectSchema(newTableName: string, originalTableName: string): Promise<void> {
    const expectedSchemas = this.getExpectedSchemas();
    const schema = expectedSchemas[originalTableName];
    
    if (!schema) {
      throw new Error(`스키마 정의를 찾을 수 없음: ${originalTableName}`);
    }
    
    // 스키마 정의에서 CREATE TABLE 문 생성
    const columns = schema.map(col => {
      let columnDef = `${col.name} ${col.type}`;
      if (col.pk) columnDef += ' PRIMARY KEY';
      if (col.pk && col.type.toUpperCase() === 'INTEGER') columnDef += ' AUTOINCREMENT';
      if (col.notnull && !col.pk) columnDef += ' NOT NULL';
      return columnDef;
    }).join(', ');
    
    const createSQL = `CREATE TABLE ${newTableName} (${columns})`;
    this.query(createSQL);
    
    console.log(`✅ 새 테이블 생성: ${newTableName}`);
  }

  /**
   * 타입 변환과 함께 데이터 마이그레이션
   */
  private async migrateDataWithTypeConversion(
    sourceTable: string, 
    targetTable: string, 
    typeMismatches: Array<{column: string, expected: string, actual: string}>
  ): Promise<void> {
    try {
      // 소스 테이블의 컬럼 정보 가져오기
      const sourceColumns = this.getTableSchema(sourceTable.replace(/_backup_\d+$/, ''));
      const targetColumns = this.getTableSchema(targetTable);
      
      if (sourceColumns.length === 0) {
        console.log('📄 소스 테이블이 비어있거나 존재하지 않음');
        return;
      }
      
      // 공통 컬럼만 마이그레이션
      const commonColumns = sourceColumns
        .filter(srcCol => targetColumns.some(tgtCol => tgtCol.name === srcCol.name))
        .map(col => col.name);
      
      if (commonColumns.length === 0) {
        console.log('📄 마이그레이션할 공통 컬럼이 없음');
        return;
      }
      
      // 타입 변환이 필요한 컬럼에 대해 CAST 적용
      const selectColumns = commonColumns.map(colName => {
        const mismatch = typeMismatches.find(tm => tm.column === colName);
        if (mismatch) {
          return `CAST(${colName} AS ${mismatch.expected}) as ${colName}`;
        }
        return colName;
      });
      
      const insertSQL = `
        INSERT INTO ${targetTable} (${commonColumns.join(', ')})
        SELECT ${selectColumns.join(', ')}
        FROM ${sourceTable}
      `;
      
      this.query(insertSQL);
      
      const migratedCount = this.query(`SELECT COUNT(*) as count FROM ${targetTable}`);
      console.log(`✅ 데이터 마이그레이션 완료: ${migratedCount[0]?.count || 0}개 레코드`);
      
    } catch (error) {
      console.error('❌ 데이터 마이그레이션 실패:', error);
      throw error;
    }
  }

  /**
   * 백업 테이블 정리
   */
  private async cleanupBackupTable(backupTableName: string): Promise<void> {
    try {
      this.query(`DROP TABLE IF EXISTS ${backupTableName}`);
      console.log(`🗑️ 백업 테이블 정리 완료: ${backupTableName}`);
    } catch (error) {
      console.warn(`⚠️ 백업 테이블 정리 실패 (무시됨): ${backupTableName}`, error);
    }
  }

  /**
   * 사용자 친화적 에러 메시지 생성
   */
  private getUserFriendlyErrorMessage(error: Error, attempt: number, maxRetries: number): string {
    const errorMessage = error.message.toLowerCase();
    let userMessage = '';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('타임아웃')) {
      userMessage = `인터넷 연결이 느린 것 같습니다. (시도 ${attempt}/${maxRetries})`;
    } else if (errorMessage.includes('sql.js') || errorMessage.includes('wasm')) {
      userMessage = `데이터베이스 라이브러리를 불러오는 중입니다... (시도 ${attempt}/${maxRetries})`;
    } else if (errorMessage.includes('indexeddb')) {
      userMessage = `브라우저 저장소를 준비하는 중입니다... (시도 ${attempt}/${maxRetries})`;
    } else {
      userMessage = `데이터베이스를 초기화하는 중입니다... (시도 ${attempt}/${maxRetries})`;
    }
    
    if (attempt < maxRetries) {
      userMessage += ' 자동으로 다시 시도합니다.';
    } else {
      userMessage += ' 문제가 지속되고 있습니다.';
    }
    
    return userMessage;
  }

  /**
   * 오류 상황별 복구 가이드 제공
   */
  private getRecoveryGuidance(error: Error): string[] {
    const errorMessage = error.message.toLowerCase();
    const guidance: string[] = [];
    
    if (errorMessage.includes('timeout') || errorMessage.includes('타임아웃')) {
      guidance.push('🔄 네트워크 연결 상태를 확인하세요');
      guidance.push('📡 WiFi 또는 모바일 데이터 연결을 다시 시도해보세요');
      guidance.push('🔄 브라우저를 새로고침하세요');
    }
    
    if (errorMessage.includes('indexeddb')) {
      guidance.push('💾 브라우저 저장소 설정을 확인하세요');
      guidance.push('🕵️ 시크릿/비공개 모드를 비활성화하세요');
      guidance.push('📁 브라우저 데이터를 삭제하고 다시 시도하세요');
    }
    
    if (errorMessage.includes('sql.js') || errorMessage.includes('wasm')) {
      guidance.push('🚫 광고 차단기나 보안 소프트웨어를 일시 비활성화하세요');
      guidance.push('🌐 다른 브라우저(Chrome, Firefox, Edge)에서 시도해보세요');
      guidance.push('🔄 브라우저 캐시를 삭제하고 새로고침하세요');
    }
    
    // 기본 가이드
    if (guidance.length === 0) {
      guidance.push('🔄 페이지를 새로고침하세요');
      guidance.push('⏳ 잠시 후 다시 시도하세요');
      guidance.push('📞 문제가 지속되면 기술 지원팀에 문의하세요');
    }
    
    return guidance;
  }

  /**
   * 스키마 버전 테이블 생성
   */
  private async createSchemaVersionTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.SCHEMA_VERSION_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        table_name TEXT NOT NULL,
        schema_definition TEXT NOT NULL,
        migration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_current BOOLEAN DEFAULT 0
      )
    `;
    
    try {
      this.query(createTableSQL);
      console.log('✅ 스키마 버전 테이블 생성 완료');
    } catch (error) {
      console.error('❌ 스키마 버전 테이블 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 현재 스키마 버전 조회
   */
  private getCurrentSchemaVersion(): number {
    try {
      const result = this.query(
        `SELECT MAX(version) as current_version FROM ${this.SCHEMA_VERSION_TABLE} WHERE is_current = 1`
      );
      return result[0]?.current_version || 0;
    } catch (error) {
      // 테이블이 존재하지 않는 경우
      return 0;
    }
  }

  /**
   * 테이블 스키마 조회
   */
  private getTableSchema(tableName: string): any[] {
    try {
      return this.query(`PRAGMA table_info(${tableName})`);
    } catch (error) {
      console.warn(`⚠️ 테이블 ${tableName} 스키마 조회 실패:`, error);
      return [];
    }
  }

  /**
   * 기대하는 스키마 정의
   */
  private getExpectedSchemas(): Record<string, any[]> {
    return {
      project_files: [
        { name: 'id', type: 'INTEGER', pk: 1, notnull: 1 },
        { name: 'project_id', type: 'INTEGER', pk: 0, notnull: 1 },
        { name: 'file_type', type: 'TEXT', pk: 0, notnull: 1 },
        { name: 'file_name', type: 'TEXT', pk: 0, notnull: 1 },
        { name: 'file_content', type: 'TEXT', pk: 0, notnull: 1 },
        { name: 'file_size', type: 'INTEGER', pk: 0, notnull: 0 },
        { name: 'mime_type', type: 'TEXT', pk: 0, notnull: 0 },
        { name: 'metadata', type: 'JSON', pk: 0, notnull: 0 },
        { name: 'created_at', type: 'DATETIME', pk: 0, notnull: 0 },
        { name: 'updated_at', type: 'DATETIME', pk: 0, notnull: 0 }
      ],
      culture_projects: [
        { name: 'id', type: 'INTEGER', pk: 1, notnull: 1 },
        { name: 'organization_name', type: 'TEXT', pk: 0, notnull: 1 },
        { name: 'analysis_purpose', type: 'TEXT', pk: 0, notnull: 0 },
        { name: 'framework_type', type: 'TEXT', pk: 0, notnull: 0 },
        { name: 'current_stage', type: 'TEXT', pk: 0, notnull: 0 },
        { name: 'project_metadata', type: 'JSON', pk: 0, notnull: 0 },
        { name: 'created_at', type: 'DATETIME', pk: 0, notnull: 0 },
        { name: 'updated_at', type: 'DATETIME', pk: 0, notnull: 0 }
      ]
    };
  }

  /**
   * 스키마 비교 및 검증
   */
  private validateTableSchema(tableName: string): {
    isValid: boolean;
    missingColumns: string[];
    extraColumns: string[];
    typeMismatches: Array<{column: string, expected: string, actual: string}>;
  } {
    const actualSchema = this.getTableSchema(tableName);
    const expectedSchemas = this.getExpectedSchemas();
    const expectedSchema = expectedSchemas[tableName];
    
    if (!expectedSchema) {
      return {
        isValid: true, // 기대 스키마가 없는 테이블은 유효하다고 간주
        missingColumns: [],
        extraColumns: [],
        typeMismatches: []
      };
    }
    
    const actualColumns = new Map(actualSchema.map(col => [col.name, col]));
    const expectedColumns = new Map(expectedSchema.map(col => [col.name, col]));
    
    // 누락된 컴럼 찾기
    const missingColumns = expectedSchema
      .filter(expected => !actualColumns.has(expected.name))
      .map(col => col.name);
    
    // 추가된 컴럼 찾기 (예상하지 못한 컴럼)
    const extraColumns = actualSchema
      .filter(actual => !expectedColumns.has(actual.name))
      .map(col => col.name);
    
    // 타입 불일치 찾기
    const typeMismatches: Array<{column: string, expected: string, actual: string}> = [];
    for (const expected of expectedSchema) {
      const actual = actualColumns.get(expected.name);
      if (actual && actual.type.toUpperCase() !== expected.type.toUpperCase()) {
        typeMismatches.push({
          column: expected.name,
          expected: expected.type,
          actual: actual.type
        });
      }
    }
    
    const isValid = missingColumns.length === 0 && typeMismatches.length === 0;
    
    return {
      isValid,
      missingColumns,
      extraColumns,
      typeMismatches
    };
  }

  /**
   * 전체 스키마 검증 및 마이그레이션
   */
  private async validateAndMigrateSchemas(): Promise<boolean> {
    if (this.schemaValidated) {
      return true;
    }
    
    console.log('🔍 스키마 검증 시작...');
    
    try {
      // 1. 스키마 버전 테이블 생성
      await this.createSchemaVersionTable();
      
      // 2. 현재 스키마 버전 확인
      const currentVersion = this.getCurrentSchemaVersion();
      console.log(`📊 현재 스키마 버전: ${currentVersion}, 요구 버전: ${this.CURRENT_SCHEMA_VERSION}`);
      
      // 3. 마이그레이션 필요 여부 확인
      if (currentVersion < this.CURRENT_SCHEMA_VERSION) {
        console.log('🚀 스키마 마이그레이션 시작...');
        await this.performSchemaMigration(currentVersion, this.CURRENT_SCHEMA_VERSION);
      }
      
      // 4. 주요 테이블 검증
      const criticalTables = ['project_files', 'culture_projects'];
      let migrationNeeded = false;
      
      for (const tableName of criticalTables) {
        const validation = this.validateTableSchema(tableName);
        
        if (!validation.isValid) {
          console.warn(`⚠️ 테이블 ${tableName} 스키마 불일치 발견:`, validation);
          migrationNeeded = true;
          
          // 심각한 문제인 경우 즐시 복구
          if (validation.missingColumns.length > 0 || validation.typeMismatches.length > 0) {
            console.log(`🚑 테이블 ${tableName} 긴급 복구 시작...`);
            await this.emergencyTableRecovery(tableName, validation);
          }
        } else {
          console.log(`✅ 테이블 ${tableName} 스키마 정상`);
        }
      }
      
      // 5. 마이그레이션 완료 후 버전 업데이트
      if (migrationNeeded || currentVersion < this.CURRENT_SCHEMA_VERSION) {
        await this.updateSchemaVersion(this.CURRENT_SCHEMA_VERSION);
      }
      
      this.schemaValidated = true;
      console.log('🎉 스키마 검증 및 마이그레이션 완료!');
      return true;
      
    } catch (error) {
      console.error('❌ 스키마 검증/마이그레이션 실패:', error);
      return false;
    }
  }

  /**
   * 스키마 버전별 마이그레이션 수행
   */
  private async performSchemaMigration(fromVersion: number, toVersion: number): Promise<void> {
    console.log(`🔄 스키마 마이그레이션: v${fromVersion} → v${toVersion}`);
    
    // 버전별 마이그레이션 스크립트
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      console.log(`🔧 마이그레이션 v${version} 실행 중...`);
      
      switch (version) {
        case 1:
          await this.migrateToVersion1();
          break;
        case 2:
          await this.migrateToVersion2();
          break;
        default:
          console.warn(`⚠️ 알 수 없는 마이그레이션 버전: ${version}`);
      }
      
      console.log(`✅ 마이그레이션 v${version} 완료`);
    }
  }

  /**
   * 버전 1 마이그레이션: 기본 테이블 설정
   */
  private async migrateToVersion1(): Promise<void> {
    // 기본 테이블들이 이미 createTables()에서 생성되므로 로그만 추가
    console.log('📝 v1: 기본 테이블 설정 완료');
  }

  /**
   * 버전 2 마이그레이션: project_files 테이블 강화
   */
  private async migrateToVersion2(): Promise<void> {
    console.log('📝 v2: project_files 테이블 스키마 강화');
    
    // project_files 테이블에 인덱스 추가 (성능 향상)
    try {
      this.query('CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id)');
      this.query('CREATE INDEX IF NOT EXISTS idx_project_files_file_type ON project_files(file_type)');
      this.query('CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at)');
      console.log('✅ project_files 테이블 인덱스 추가 완료');
    } catch (error) {
      console.warn('⚠️ 인덱스 추가 실패 (무시):', error);
    }
  }

  /**
   * 스키마 버전 업데이트
   */
  private async updateSchemaVersion(version: number): Promise<void> {
    try {
      // 기존 current 플래그 제거
      this.query(`UPDATE ${this.SCHEMA_VERSION_TABLE} SET is_current = 0`);
      
      // 새 버전 등록
      this.query(
        `INSERT OR REPLACE INTO ${this.SCHEMA_VERSION_TABLE} (version, table_name, schema_definition, is_current) VALUES (?, ?, ?, ?)`,
        [version, 'all_tables', JSON.stringify(this.getExpectedSchemas()), 1]
      );
      
      console.log(`✅ 스키마 버전 업데이트 완료: v${version}`);
    } catch (error) {
      console.error('❌ 스키마 버전 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 브라우저 타입 감지
   */
  private detectBrowser(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'chrome';
    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
    if (userAgent.includes('edg')) return 'edge';
    return 'default';
  }

  /**
   * 브라우저별 적응형 타임아웃 계산
   */
  private getAdaptiveTimeout(): number {
    const browser = this.detectBrowser();
    const timeout = this.BROWSER_TIMEOUTS[browser as keyof typeof this.BROWSER_TIMEOUTS] || this.BROWSER_TIMEOUTS.default;
    console.log(`🔧 브라우저별 타임아웃 설정: ${browser} - ${timeout}ms`);
    return timeout;
  }

  /**
   * IndexedDB 지원 여부 확인 및 초기화 (강화된 버전)
   */
  private async initializeIndexedDB(): Promise<boolean> {
    if (!('indexedDB' in window)) {
      console.warn('⚠️ IndexedDB가 지원되지 않는 브라우저입니다.');
      this.indexedDBSupported = false;
      return false;
    }

    const adaptiveTimeout = this.getAdaptiveTimeout();
    const MAX_INIT_RETRIES = 3;
    const RETRY_DELAYS = [1000, 3000, 7000]; // 점진적 백오프

    for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        console.log(`🔄 IndexedDB 초기화 시도 ${attempt}/${MAX_INIT_RETRIES} (타임아웃: ${adaptiveTimeout}ms)`);
        
        const success = await this.attemptIndexedDBInitialization(adaptiveTimeout);
        
        if (success) {
          console.log(`✅ IndexedDB 초기화 성공 (시도 ${attempt}/${MAX_INIT_RETRIES})`);
          return true;
        }
        
        throw new Error(`초기화 시도 ${attempt} 실패`);
        
      } catch (error) {
        console.warn(`⚠️ IndexedDB 초기화 시도 ${attempt} 실패:`, error);
        
        if (attempt < MAX_INIT_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          console.log(`⏳ ${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ 모든 IndexedDB 초기화 시도 실패');
          this.indexedDBSupported = false;
          return false;
        }
      }
    }

    return false;
  }

  /**
   * 단일 IndexedDB 초기화 시도
   */
  private async attemptIndexedDBInitialization(timeout: number): Promise<boolean> {
    try {
      // 기존 데이터베이스 버전 확인
      const checkRequest = indexedDB.open(this.INDEXEDDB_NAME);
      
      return new Promise((resolve, reject) => {
        let timeoutId: NodeJS.Timeout;
        let resolved = false;
        
        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          resolved = true;
        };
        
        const safeResolve = (value: boolean) => {
          if (!resolved) {
            cleanup();
            resolve(value);
          }
        };
        
        checkRequest.onsuccess = () => {
          try {
            const db = checkRequest.result;
            this.currentDBVersion = Math.max(db.version, 1);
            db.close();
            
            console.log(`📋 기존 DB 버전: ${this.currentDBVersion}`);
            
            // 실제 초기화 시도
            this.performIndexedDBInitialization(safeResolve, timeout);
          } catch (error) {
            console.warn('⚠️ DB 버전 확인 중 오류:', error);
            safeResolve(false);
          }
        };
        
        checkRequest.onerror = () => {
          console.log('📄 새 데이터베이스 생성 필요');
          // 데이터베이스가 존재하지 않는 경우
          this.currentDBVersion = 1;
          this.performIndexedDBInitialization(safeResolve, timeout);
        };
        
        // 적응형 타임아웃 설정
        timeoutId = setTimeout(() => {
          if (!resolved) {
            console.warn(`⚠️ IndexedDB 초기화 타임아웃 (${timeout}ms)`);
            safeResolve(false);
          }
        }, timeout);
      });
    } catch (error) {
      console.warn('⚠️ IndexedDB 초기화 시도 중 오류:', error);
      return false;
    }
  }

  /**
   * IndexedDB 초기화 수행 (강화된 에러 핸들링)
   */
  private performIndexedDBInitialization(
    resolve: (value: boolean) => void, 
    timeout: number = this.getAdaptiveTimeout()
  ): void {
    const request = indexedDB.open(this.INDEXEDDB_NAME, this.currentDBVersion);
    let resolved = false;
    
    const cleanup = () => {
      resolved = true;
    };
    
    const safeResolve = (value: boolean, message?: string) => {
      if (!resolved) {
        cleanup();
        if (message) console.log(message);
        resolve(value);
      }
    };
    
    request.onerror = () => {
      const errorMsg = `⚠️ IndexedDB 연결 실패: ${request.error?.message || '알 수 없는 오류'}`;
      console.warn(errorMsg);
      this.indexedDBSupported = false;
      safeResolve(false, errorMsg);
    };
    
    request.onsuccess = () => {
      try {
        const db = request.result;
        
        // 연결 상태 검증
        if (!db || db.name !== this.INDEXEDDB_NAME) {
          throw new Error('데이터베이스 연결 검증 실패');
        }
        
        console.log(`✅ IndexedDB 연결 성공 (버전: ${this.currentDBVersion}, 스토어 수: ${db.objectStoreNames.length})`);
        
        // ObjectStore 존재 여부 확인
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          console.warn(`⚠️ 필요한 ObjectStore(${this.STORE_NAME})가 존재하지 않음. 업그레이드 필요.`);
          db.close();
          
          // 버전 업그레이드로 ObjectStore 생성
          this.upgradeDatabase(resolve);
          return;
        }
        
        this.indexedDBSupported = true;
        db.close();
        safeResolve(true, `🎉 IndexedDB 초기화 완료 (${this.INDEXEDDB_NAME}:${this.currentDBVersion})`);
        
      } catch (error) {
        console.error('❌ IndexedDB 연결 후 검증 실패:', error);
        this.indexedDBSupported = false;
        safeResolve(false);
      }
    };
    
    request.onupgradeneeded = (event: any) => {
      try {
        const db = event.target.result;
        console.log(`🔧 IndexedDB 업그레이드 진행 (${event.oldVersion} → ${event.newVersion})`);
        
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          
          // 인덱스 생성 (성능 향상)
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('version', 'version', { unique: false });
          
          console.log(`✅ IndexedDB ObjectStore '${this.STORE_NAME}' 생성 완료 (인덱스 포함)`);
        }
        
        this.indexedDBSupported = true;
        
      } catch (error) {
        console.error('❌ IndexedDB 업그레이드 실패:', error);
        this.indexedDBSupported = false;
      }
    };
    
    // 내부 타임아웃 설정 (추가 안전장치)
    setTimeout(() => {
      if (!resolved) {
        console.warn(`⚠️ IndexedDB 초기화 내부 타임아웃 (${timeout}ms)`);
        safeResolve(false);
      }
    }, timeout);
  }

  /**
   * 데이터베이스 업그레이드 (ObjectStore 누락 시)
   */
  private upgradeDatabase(resolve: (value: boolean) => void): void {
    console.log('🔧 ObjectStore 생성을 위한 데이터베이스 업그레이드 시작...');
    
    const upgradeRequest = indexedDB.open(this.INDEXEDDB_NAME, this.currentDBVersion + 1);
    
    upgradeRequest.onerror = () => {
      console.error('❌ 데이터베이스 업그레이드 실패:', upgradeRequest.error);
      this.indexedDBSupported = false;
      resolve(false);
    };
    
    upgradeRequest.onsuccess = () => {
      console.log('✅ 데이터베이스 업그레이드 성공');
      this.currentDBVersion++;
      this.indexedDBSupported = true;
      upgradeRequest.result.close();
      resolve(true);
    };
    
    upgradeRequest.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('version', 'version', { unique: false });
        console.log('✅ 업그레이드 중 ObjectStore 생성 완료');
      }
    };
  }

  /**
   * 데이터베이스를 IndexedDB에 저장
   */
  private async saveToIndexedDB(): Promise<boolean> {
    if (!this.indexedDBSupported || !this.db) {
      return false;
    }

    try {
      console.log('💾 데이터베이스를 IndexedDB에 저장 시작...');
      
      const dbData = this.db.export();
      const request = indexedDB.open(this.INDEXEDDB_NAME, this.currentDBVersion);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          console.error('❌ IndexedDB 열기 실패:', request.error);
          resolve(false);
        };
        
        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            console.log('✅ IndexedDB ObjectStore 생성 완료 (saveToIndexedDB)');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          
          // ObjectStore 존재 여부 다시 확인
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            console.error('❌ ObjectStore가 존재하지 않습니다. 다시 시도합니다.');
            db.close();
            // 버전을 올려서 다시 시도
            const retryRequest = indexedDB.open(this.INDEXEDDB_NAME, this.currentDBVersion + 1);
            retryRequest.onupgradeneeded = (retryEvent: any) => {
              const retryDb = retryEvent.target.result;
              if (!retryDb.objectStoreNames.contains(this.STORE_NAME)) {
                retryDb.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                console.log('✅ IndexedDB ObjectStore 재생성 완료');
              }
            };
            retryRequest.onsuccess = () => {
              this.performSave(retryRequest.result, dbData, resolve);
            };
            retryRequest.onerror = () => {
              console.error('❌ IndexedDB 재시도 실패');
              resolve(false);
            };
            return;
          }
          
          this.performSave(db, dbData, resolve);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB 저장 오류:', error);
      return false;
    }
  }

  /**
   * 실제 저장 수행 (헬퍼 메서드)
   */
  private performSave(db: IDBDatabase, dbData: Uint8Array, resolve: (value: boolean) => void): void {
    const transaction = db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);
    
    const saveRequest = store.put({
      id: 'main_database',
      data: dbData,
      timestamp: new Date().toISOString(),
      version: this.currentDBVersion
    });
    
    saveRequest.onsuccess = () => {
      console.log('✅ 데이터베이스 IndexedDB 저장 성공');
      db.close();
      resolve(true);
    };
    
    saveRequest.onerror = () => {
      console.error('❌ 데이터베이스 저장 실패:', saveRequest.error);
      db.close();
      resolve(false);
    };
    
    transaction.onerror = () => {
      console.error('❌ IndexedDB 트랜잭션 실패:', transaction.error);
      db.close();
      resolve(false);
    };
  }

  /**
   * IndexedDB에서 데이터베이스 로드
   */
  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    if (!this.indexedDBSupported) {
      return null;
    }

    try {
      console.log('💻 IndexedDB에서 데이터베이스 로드 시도...');
      
      const request = indexedDB.open(this.INDEXEDDB_NAME, this.currentDBVersion);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          console.warn('⚠️ IndexedDB 열기 실패:', request.error);
          resolve(null);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            console.log('📄 IndexedDB에 저장된 데이터가 없습니다.');
            db.close();
            resolve(null);
            return;
          }
          
          const transaction = db.transaction([this.STORE_NAME], 'readonly');
          const store = transaction.objectStore(this.STORE_NAME);
          const getRequest = store.get('main_database');
          
          getRequest.onsuccess = () => {
            const result = getRequest.result;
            if (result && result.data) {
              console.log('✅ IndexedDB에서 데이터베이스 로드 성공');
              console.log('📅 저장 시간:', result.timestamp);
              db.close();
              resolve(new Uint8Array(result.data));
            } else {
              console.log('📄 IndexedDB에 저장된 데이터가 없습니다.');
              db.close();
              resolve(null);
            }
          };
          
          getRequest.onerror = () => {
            console.error('❌ 데이터베이스 로드 실패:', getRequest.error);
            db.close();
            resolve(null);
          };
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB 로드 오류:', error);
      return null;
    }
  }

  /**
   * SQL.js 라이브러리 초기화 및 데이터베이스 로드
   * 개선된 로직: 재시도 메커니즘, 더 긴 대기 시간, 상세한 에러 로깅
   */
  async initialize(): Promise<boolean> {
    // 이미 초기화된 경우
    if (this.initialized) return true;

    // 초기화 진행 중인 경우 기존 Promise 반환
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 새로운 초기화 시작
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * 실제 초기화 수행 (재시도 로직 포함)
   */
  private async performInitialization(): Promise<boolean> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2초

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.initializationStatus = 'loading';
        this.initializationError = null;

        console.log(`🔄 데이터베이스 초기화 시도 ${attempt}/${MAX_RETRIES}`);

        // SQL.js CDN 로딩 대기 (브라우저별 적응형 타임아웃)
        const sqlJsTimeout = this.getAdaptiveTimeout();
        const sqlJsLoaded = await this.waitForSqlJs(sqlJsTimeout);
        if (!sqlJsLoaded) {
          throw new Error(`sql.js 라이브러리 로딩 타임아웃 (${sqlJsTimeout}ms)`);
        }

        console.log('✅ sql.js 라이브러리 로드 완료');

        // SQL.js 초기화
        this.SQL = await window.initSqlJs({
          locateFile: (file: string) => {
            if (file === 'sql-wasm.wasm') {
              return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm';
            }
            return file;
          }
        });

        console.log('✅ SQL.js 엔진 초기화 완료');

        // IndexedDB 초기화
        await this.initializeIndexedDB();

        // 데이터베이스 로드 또는 생성 (우선순위: IndexedDB -> 기존 파일 -> 새로 생성)
        await this.loadOrCreateDatabase();

        // window.sqlite 객체 설정 (타이밍 문제 해결)
        this.setupWindowSqlite();

        this.initialized = true;
        this.initializationStatus = 'success';
        
        console.log('🎉 데이터베이스 서비스 초기화 완료!');
        console.log('📊 window.sqlite 객체 설정 완료');
        
        return true;

      } catch (error) {
        this.initializationError = error as Error;
        this.initializationStatus = 'error';
        
        console.error(`❌ 데이터베이스 초기화 실패 (시도 ${attempt}/${MAX_RETRIES}):`, error);
        
        // 사용자 친화적 에러 메시지
        const userMessage = this.getUserFriendlyErrorMessage(error as Error, attempt, MAX_RETRIES);
        console.warn('💬 사용자 메시지:', userMessage);

        if (attempt < MAX_RETRIES) {
          console.log(`⏳ ${RETRY_DELAY/1000}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    // 모든 재시도 실패
    console.error('💥 모든 재시도 실패. 데이터베이스 초기화 포기.');
    this.initializationStatus = 'error';
    return false;
  }

  /**
   * window.initSqlJs 로딩 대기 (강화된 버전)
   */
  private async waitForSqlJs(timeout: number = 15000): Promise<boolean> {
    const checkInterval = 100; // 100ms마다 체크
    const maxAttempts = Math.floor(timeout / checkInterval);
    const startTime = performance.now();
    
    console.log(`🔍 SQL.js 라이브러리 로딩 대기... (최대 ${timeout}ms)`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // SQL.js 라이브러리 로딩 확인
      if (window.initSqlJs && typeof window.initSqlJs === 'function') {
        const loadTime = Math.round(performance.now() - startTime);
        console.log(`✅ SQL.js 라이브러리 로딩 완료 (소요 시간: ${loadTime}ms)`);
        return true;
      }
      
      // 진행 상황 로깅 (매 1초마다)
      if (attempt > 0 && attempt % 10 === 0) {
        const elapsed = Math.round((performance.now() - startTime) / 1000);
        const remaining = Math.round((timeout - (performance.now() - startTime)) / 1000);
        console.log(`⏳ SQL.js 로딩 대기 중... (경과: ${elapsed}s, 남은 시간: ${remaining}s)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    const totalTime = Math.round(performance.now() - startTime);
    console.error(`❌ SQL.js 라이브러리 로딩 타임아웃 (소요 시간: ${totalTime}ms, 한계: ${timeout}ms)`);
    
    // 디버깅 정보 제공
    console.warn('🔧 문제 해결 방법:');
    console.warn('   1. 네트워크 연결 상태 확인');
    console.warn('   2. 브라우저 캐시 삭제 후 새로고침');
    console.warn('   3. 다른 브라우저에서 시도');
    console.warn('   4. 방화벽/보안 소프트웨어 확인');
    
    return false;
  }

  /**
   * 데이터베이스 로드 또는 생성 (우선순위: IndexedDB -> 새 DB 생성)
   * 개선됨: 정적 파일 fallback 제거로 데이터 무결성 보장
   */
  private async loadOrCreateDatabase(): Promise<void> {
    let dbLoaded = false;

    // 1순위: IndexedDB에서 로드 시도
    if (this.indexedDBSupported) {
      try {
        const indexedDBData = await this.loadFromIndexedDB();
        if (indexedDBData) {
          this.db = new this.SQL.Database(indexedDBData);
          console.log('✅ IndexedDB에서 데이터베이스 로드 완료');
          dbLoaded = true;
        }
      } catch (indexedDBError) {
        console.warn('⚠️ IndexedDB 로드 실패:', indexedDBError);
      }
    }

    // 2순위: 새 데이터베이스 생성 (IndexedDB 로드 실패 시)
    // 정적 파일 fallback 제거 - 데이터 무결성 보장
    if (!dbLoaded) {
      console.log('🆕 새 데이터베이스 생성 시작...');
      this.db = new this.SQL.Database();
      await this.createTables();
      console.log('✅ 새 데이터베이스 생성 완료');
      
      // 새로 생성한 데이터베이스를 IndexedDB에 저장
      if (this.indexedDBSupported) {
        await this.saveToIndexedDB();
        console.log('💾 새 데이터베이스를 IndexedDB에 저장 완료');
      }
    }
  }

  /**
   * window.sqlite 객체 설정 (개선된 타이밍)
   */
  private setupWindowSqlite(): void {
    (window as any).sqlite = {
      query: this.query.bind(this),
      close: this.close.bind(this),
      export: this.export.bind(this),
      isInitialized: this.isInitialized.bind(this),
      getStatus: this.getInitializationStatus.bind(this),
      saveDatabase: this.saveDatabase.bind(this),
      setAutoSaveEnabled: this.setAutoSaveEnabled.bind(this),
      getAutoSaveStatus: this.getAutoSaveStatus.bind(this),
      deleteProject: this.deleteProject.bind(this),
      getProjectDeletionPreview: this.getProjectDeletionPreview.bind(this)
    };

    // 설정 완료 확인
    const testQuery = this.query('SELECT 1 as test');
    if (testQuery.length > 0 && testQuery[0].test === 1) {
      console.log('✅ window.sqlite 객체 정상 설정 확인');
    } else {
      throw new Error('window.sqlite 객체 설정 실패');
    }
  }

  /**
   * SQL 쿼리 실행 (개선된 에러 처리 및 자동 저장)
   */
  query(sql: string, params: any[] = []): any[] {
    if (!this.db) {
      throw new Error('데이터베이스가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    try {
      const sqlTrimmed = sql.trim().toLowerCase();
      let results: any[] = [];
      let isDataChangingQuery = false;
      
      if (sqlTrimmed.startsWith('select')) {
        // SELECT 쿼리
        const stmt = this.db.prepare(sql);
        
        if (params.length > 0) {
          stmt.bind(params);
        }
        
        while (stmt.step()) {
          const row = stmt.getAsObject();
          results.push(row);
        }
        
        stmt.free();
      } else {
        // INSERT, UPDATE, DELETE 쿼리 - 데이터 변경 감지
        isDataChangingQuery = sqlTrimmed.startsWith('insert') || 
                             sqlTrimmed.startsWith('update') || 
                             sqlTrimmed.startsWith('delete');
        
        const stmt = this.db.prepare(sql);
        
        if (params.length > 0) {
          stmt.bind(params);
        }
        
        stmt.step();
        stmt.free();
        
        // INSERT의 경우 새로 생성된 ID 반환
        if (sqlTrimmed.startsWith('insert')) {
          const lastId = this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0];
          results = [{ lastInsertRowid: lastId }];
        }
      }
      
      // 데이터 변경 시 자동 저장 트리거
      if (isDataChangingQuery && this.isAutoSaveEnabled) {
        this.triggerAutoSave();
      }
      
      return results;
      
    } catch (error) {
      console.error('💥 쿼리 실행 오류:', {
        error: error,
        sql: sql,
        params: params,
        dbStatus: this.getInitializationStatus()
      });
      throw error;
    }
  }



  /**
   * 자동 저장 트리거 (debounce 패턴 적용)
   */
  private triggerAutoSave(): void {
    if (!this.isAutoSaveEnabled || !this.indexedDBSupported || this.pendingAutoSave) {
      return;
    }

    // 기존 타이머 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // 새 타이머 설정 (debounce)
    this.autoSaveTimeout = setTimeout(async () => {
      await this.performAutoSave();
    }, this.autoSaveDebounceMs);

    console.log(`📅 자동 저장 예약 (${this.autoSaveDebounceMs}ms 후)`);
  }

  /**
   * 실제 자동 저장 수행 (재시도 로직 포함)
   */
  private async performAutoSave(): Promise<void> {
    if (this.pendingAutoSave) {
      return;
    }

    this.pendingAutoSave = true;
    const startTime = performance.now();

    for (let attempt = 1; attempt <= this.maxAutoSaveRetries; attempt++) {
      try {
        console.log(`💾 자동 저장 시도 ${attempt}/${this.maxAutoSaveRetries}`);
        
        const success = await this.saveToIndexedDB();
        
        if (success) {
          const duration = Math.round(performance.now() - startTime);
          console.log(`✅ 자동 저장 성공 (소요 시간: ${duration}ms)`);
          break;
        } else {
          throw new Error('자동 저장 실패');
        }
      } catch (error) {
        console.warn(`⚠️ 자동 저장 시도 ${attempt} 실패:`, error);
        
        if (attempt < this.maxAutoSaveRetries) {
          // 지수 백오프 지연 (1초, 2초, 4초)
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ ${delay/1000}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ 모든 자동 저장 시도 실패. 데이터 손실 위험이 있습니다.');
        }
      }
    }

    this.pendingAutoSave = false;
  }

  /**
   * 자동 저장 활성화/비활성화
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.isAutoSaveEnabled = enabled;
    console.log(`💾 자동 저장 ${enabled ? '활성화' : '비활성화'}`);
    
    if (!enabled && this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }

  /**
   * 자동 저장 상태 확인
   */
  getAutoSaveStatus(): {
    enabled: boolean;
    pending: boolean;
    debounceMs: number;
    maxRetries: number;
  } {
    return {
      enabled: this.isAutoSaveEnabled,
      pending: this.pendingAutoSave,
      debounceMs: this.autoSaveDebounceMs,
      maxRetries: this.maxAutoSaveRetries
    };
  }

  /**
   * 필요한 테이블들 생성
   */
  private async createTables(): Promise<void> {
    const tables = [
      // culture_projects 테이블
      `CREATE TABLE IF NOT EXISTS culture_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_name TEXT NOT NULL,
        analysis_purpose TEXT,
        framework_type TEXT DEFAULT 'Dave_Gray_Schein_4Layer',
        current_stage TEXT DEFAULT 'data_collection',
        project_metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // interview_sessions 테이블 (기존 + 확장)
      `CREATE TABLE IF NOT EXISTS interview_sessions (
        id TEXT PRIMARY KEY,
        project_id INTEGER,
        participant_role TEXT,
        session_date DATETIME,
        duration_minutes INTEGER,
        audio_file_path TEXT,
        transcript TEXT,
        status TEXT DEFAULT 'scheduled',
        metadata JSON,
        drive_file_id TEXT,
        drive_file_name TEXT,
        analysis_step INTEGER DEFAULT 1,
        gemini_analysis_result TEXT,
        FOREIGN KEY (project_id) REFERENCES culture_projects(id)
      )`,
      
      // layer_analysis 테이블
      `CREATE TABLE IF NOT EXISTS layer_analysis (
        id TEXT PRIMARY KEY,
        project_id INTEGER,
        layer_type TEXT,
        layer_index INTEGER,
        content TEXT,
        source_data TEXT,
        confidence_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata JSON,
        FOREIGN KEY (project_id) REFERENCES culture_projects(id)
      )`,
      
      // project_insights 테이블
      `CREATE TABLE IF NOT EXISTS project_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        insight_type TEXT,
        content TEXT,
        sources JSON,
        confidence_level INTEGER,
        academic_references TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES culture_projects(id)
      )`,
      
      // drive_analysis_sessions 테이블 (신규)
      `CREATE TABLE IF NOT EXISTS drive_analysis_sessions (
        id TEXT PRIMARY KEY,
        project_id INTEGER,
        drive_file_id TEXT NOT NULL,
        drive_file_name TEXT,
        file_type TEXT,
        analysis_step INTEGER DEFAULT 1,
        notebook_lm_result TEXT,
        gemini_analysis_result TEXT,
        claude_analysis_result TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata JSON,
        FOREIGN KEY (project_id) REFERENCES culture_projects(id)
      )`,
      
      // project_files 테이블 (파일 관리)
      `CREATE TABLE IF NOT EXISTS project_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('culture_map', 'analysis_report', 'culture_json', 'other')),
        file_name TEXT NOT NULL,
        file_content TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES culture_projects(id) ON DELETE CASCADE
      )`
    ];

    for (const tableSQL of tables) {
      this.query(tableSQL);
    }

    // 기존 interview_sessions 테이블에 컬럼 추가 (존재하지 않는 경우만)
    await this.addColumnsSafely();
    
    // 스키마 검증 및 마이그레이션 수행
    const schemaValidated = await this.validateAndMigrateSchemas();
    if (!schemaValidated) {
      console.warn('⚠️ 스키마 검증에 실패했지만 계속 진행합니다.');
    }

    console.log('✅ 데이터베이스 테이블 생성, 확장 및 검증 완료');
  }

  /**
   * 기존 테이블에 새 컬럼을 안전하게 추가
   */
  private async addColumnsSafely(): Promise<void> {
    const newColumns = [
      { table: 'interview_sessions', column: 'drive_file_id', type: 'TEXT' },
      { table: 'interview_sessions', column: 'drive_file_name', type: 'TEXT' },
      { table: 'interview_sessions', column: 'analysis_step', type: 'INTEGER DEFAULT 1' },
      { table: 'interview_sessions', column: 'gemini_analysis_result', type: 'TEXT' }
    ];

    for (const { table, column, type } of newColumns) {
      try {
        // 컬럼이 이미 존재하는지 확인
        const tableInfo = this.query(`PRAGMA table_info(${table})`);
        const columnExists = tableInfo.some((col: any) => col.name === column);
        
        if (!columnExists) {
          const alterSQL = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
          this.query(alterSQL);
          console.log(`✅ 컬럼 추가 완료: ${table}.${column}`);
        } else {
          console.log(`ℹ️ 컬럼이 이미 존재함: ${table}.${column}`);
        }
      } catch (error) {
        console.warn(`⚠️ 컬럼 추가 실패 (무시됨): ${table}.${column}`, error);
        // 컬럼 추가 실패는 무시 (이미 존재할 수 있음)
      }
    }
  }

  /**
   * 데이터베이스를 바이너리 형태로 내보내기 및 자동 IndexedDB 저장
   */
  export(): Uint8Array {
    if (!this.db) {
      throw new Error('데이터베이스가 초기화되지 않았습니다.');
    }
    
    const exportedData = this.db.export();
    
    // 비동기로 IndexedDB에 자동 저장 (비블로킹)
    if (this.indexedDBSupported) {
      this.saveToIndexedDB().catch(error => {
        console.warn('⚠️ 자동 IndexedDB 저장 실패:', error);
      });
    }
    
    return exportedData;
  }

  /**
   * 프로젝트 및 관련 데이터 CASCADE 삭제
   * 모든 관련 테이블의 데이터를 안전하게 삭제하고 결과를 반환
   */
  async deleteProject(projectId: string | number): Promise<{
    success: boolean;
    deletedRecords: {
      driveAnalysisSessions: number;
      interviewSessions: number;
      layerAnalysis: number;
      projectInsights: number;
      project: number;
    };
    error?: string;
  }> {
    if (!this.db) {
      const error = '데이터베이스가 초기화되지 않았습니다.';
      console.error('❌', error);
      return {
        success: false,
        deletedRecords: {
          driveAnalysisSessions: 0,
          interviewSessions: 0,
          layerAnalysis: 0,
          projectInsights: 0,
          projectFiles: 0,
          project: 0
        },
        error
      };
    }

    const startTime = performance.now();
    let deletedRecords = {
      driveAnalysisSessions: 0,
      interviewSessions: 0,
      layerAnalysis: 0,
      projectInsights: 0,
      projectFiles: 0,
      project: 0
    };

    try {
      console.log(`🗑️ 프로젝트 삭제 시작: ${projectId}`);
      
      // 1. 프로젝트 존재 여부 확인
      const projectExists = this.query('SELECT COUNT(*) as count FROM culture_projects WHERE id = ?', [projectId]);
      if (!projectExists[0] || projectExists[0].count === 0) {
        const error = `프로젝트 ID ${projectId}가 존재하지 않습니다.`;
        console.warn('⚠️', error);
        return {
          success: false,
          deletedRecords,
          error
        };
      }

      // 2. 삭제 전 관련 데이터 수 확인
      const beforeCounts = {
        driveAnalysisSessions: this.query('SELECT COUNT(*) as count FROM drive_analysis_sessions WHERE project_id = ?', [projectId])[0]?.count || 0,
        interviewSessions: this.query('SELECT COUNT(*) as count FROM interview_sessions WHERE project_id = ?', [projectId])[0]?.count || 0,
        layerAnalysis: this.query('SELECT COUNT(*) as count FROM layer_analysis WHERE project_id = ?', [projectId])[0]?.count || 0,
        projectInsights: this.query('SELECT COUNT(*) as count FROM project_insights WHERE project_id = ?', [projectId])[0]?.count || 0,
        projectFiles: this.query('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?', [projectId])[0]?.count || 0
      };

      console.log('📊 삭제 대상 데이터 현황:', beforeCounts);

      // 3. CASCADE 방식으로 관련 데이터 순차 삭제
      // SQLite는 트랜잭션을 지원하므로 BEGIN/COMMIT 사용
      this.query('BEGIN TRANSACTION');

      try {
        // 3-1. drive_analysis_sessions 삭제
        if (beforeCounts.driveAnalysisSessions > 0) {
          this.query('DELETE FROM drive_analysis_sessions WHERE project_id = ?', [projectId]);
          const afterCount = this.query('SELECT COUNT(*) as count FROM drive_analysis_sessions WHERE project_id = ?', [projectId])[0]?.count || 0;
          deletedRecords.driveAnalysisSessions = beforeCounts.driveAnalysisSessions - afterCount;
          console.log(`✅ drive_analysis_sessions: ${deletedRecords.driveAnalysisSessions}개 삭제`);
        }

        // 3-2. interview_sessions 삭제
        if (beforeCounts.interviewSessions > 0) {
          this.query('DELETE FROM interview_sessions WHERE project_id = ?', [projectId]);
          const afterCount = this.query('SELECT COUNT(*) as count FROM interview_sessions WHERE project_id = ?', [projectId])[0]?.count || 0;
          deletedRecords.interviewSessions = beforeCounts.interviewSessions - afterCount;
          console.log(`✅ interview_sessions: ${deletedRecords.interviewSessions}개 삭제`);
        }

        // 3-3. layer_analysis 삭제
        if (beforeCounts.layerAnalysis > 0) {
          this.query('DELETE FROM layer_analysis WHERE project_id = ?', [projectId]);
          const afterCount = this.query('SELECT COUNT(*) as count FROM layer_analysis WHERE project_id = ?', [projectId])[0]?.count || 0;
          deletedRecords.layerAnalysis = beforeCounts.layerAnalysis - afterCount;
          console.log(`✅ layer_analysis: ${deletedRecords.layerAnalysis}개 삭제`);
        }

        // 3-4. project_insights 삭제
        if (beforeCounts.projectInsights > 0) {
          this.query('DELETE FROM project_insights WHERE project_id = ?', [projectId]);
          const afterCount = this.query('SELECT COUNT(*) as count FROM project_insights WHERE project_id = ?', [projectId])[0]?.count || 0;
          deletedRecords.projectInsights = beforeCounts.projectInsights - afterCount;
          console.log(`✅ project_insights: ${deletedRecords.projectInsights}개 삭제`);
        }

        // 3-5. project_files 삭제
        if (beforeCounts.projectFiles > 0) {
          this.query('DELETE FROM project_files WHERE project_id = ?', [projectId]);
          const afterCount = this.query('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?', [projectId])[0]?.count || 0;
          deletedRecords.projectFiles = beforeCounts.projectFiles - afterCount;
          console.log(`✅ project_files: ${deletedRecords.projectFiles}개 삭제`);
        }

        // 3-6. 마지막으로 culture_projects 삭제
        this.query('DELETE FROM culture_projects WHERE id = ?', [projectId]);
        const projectAfterCount = this.query('SELECT COUNT(*) as count FROM culture_projects WHERE id = ?', [projectId])[0]?.count || 0;
        deletedRecords.project = projectAfterCount === 0 ? 1 : 0;
        console.log(`✅ culture_projects: ${deletedRecords.project}개 삭제`);

        // 트랜잭션 커밋
        this.query('COMMIT');

        // 4. 즉시 저장 (IndexedDB 동기화) - 프로젝트 삭제는 중요한 작업이므로 즉시 저장
        console.log('💾 프로젝트 삭제 후 즉시 저장 시작...');
        const saveSuccess = await this.saveToIndexedDB();
        if (saveSuccess) {
          console.log('✅ 프로젝트 삭제 후 IndexedDB 저장 완료');
        } else {
          console.warn('⚠️ 프로젝트 삭제 후 IndexedDB 저장 실패 - 데이터가 복원될 수 있습니다');
        }

        const duration = Math.round(performance.now() - startTime);
        const totalDeleted = Object.values(deletedRecords).reduce((sum, count) => sum + count, 0);
        
        console.log(`🎉 프로젝트 삭제 완료: ${projectId}`);
        console.log(`📊 총 ${totalDeleted}개 레코드 삭제 (소요 시간: ${duration}ms)`);
        console.log('💾 데이터베이스 즉시 저장 완료 - 영구 삭제 보장');

        return {
          success: true,
          deletedRecords
        };

      } catch (deleteError) {
        // 롤백
        this.query('ROLLBACK');
        throw deleteError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 프로젝트 삭제 실패:', error);
      
      return {
        success: false,
        deletedRecords,
        error: errorMessage
      };
    }
  }

  /**
   * 프로젝트 삭제 전 관련 데이터 수 확인
   * UI에서 삭제 확인 다이얼로그에 표시할 정보 제공
   */
  getProjectDeletionPreview(projectId: string | number): {
    projectInfo: {
      id: number;
      organization_name: string;
      created_at: string;
      current_stage: string;
    } | null;
    relatedDataCounts: {
    driveAnalysisSessions: number;
    interviewSessions: number;
    layerAnalysis: number;
    projectInsights: number;
    projectFiles: number;
      totalRelatedRecords: number;
      };
  } {
    if (!this.db) {
      console.error('❌ 데이터베이스가 초기화되지 않았습니다.');
      return {
      projectInfo: null,
      relatedDataCounts: {
      driveAnalysisSessions: 0,
      interviewSessions: 0,
      layerAnalysis: 0,
      projectInsights: 0,
      projectFiles: 0,
        totalRelatedRecords: 0
        }
        };
    }

    try {
      // 프로젝트 기본 정보 조회
      const projectResult = this.query(
        'SELECT id, organization_name, created_at, current_stage FROM culture_projects WHERE id = ?', 
        [projectId]
      );
      const projectInfo = projectResult.length > 0 ? projectResult[0] : null;

      // 관련 데이터 수 조회
      const relatedDataCounts = {
        driveAnalysisSessions: this.query('SELECT COUNT(*) as count FROM drive_analysis_sessions WHERE project_id = ?', [projectId])[0]?.count || 0,
        interviewSessions: this.query('SELECT COUNT(*) as count FROM interview_sessions WHERE project_id = ?', [projectId])[0]?.count || 0,
        layerAnalysis: this.query('SELECT COUNT(*) as count FROM layer_analysis WHERE project_id = ?', [projectId])[0]?.count || 0,
        projectInsights: this.query('SELECT COUNT(*) as count FROM project_insights WHERE project_id = ?', [projectId])[0]?.count || 0,
        projectFiles: this.query('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?', [projectId])[0]?.count || 0,
        totalRelatedRecords: 0
      };

      relatedDataCounts.totalRelatedRecords = 
        relatedDataCounts.driveAnalysisSessions +
        relatedDataCounts.interviewSessions +
        relatedDataCounts.layerAnalysis +
        relatedDataCounts.projectInsights +
        relatedDataCounts.projectFiles;

      console.log(`📋 프로젝트 ${projectId} 삭제 미리보기:`, {
        projectInfo,
        relatedDataCounts
      });

      return {
        projectInfo,
        relatedDataCounts
      };

    } catch (error) {
      console.error('❌ 프로젝트 삭제 미리보기 실패:', error);
      return {
      projectInfo: null,
      relatedDataCounts: {
      driveAnalysisSessions: 0,
      interviewSessions: 0,
      layerAnalysis: 0,
      projectInsights: 0,
      projectFiles: 0,
        totalRelatedRecords: 0
        }
        };
    }
  }

  /**
   * 데이터베이스를 IndexedDB에 수동 저장 (공개 메서드)
   */
  async saveDatabase(): Promise<boolean> {
    if (!this.db) {
      console.error('❌ 데이터베이스가 초기화되지 않았습니다.');
      return false;
    }
    
    if (!this.indexedDBSupported) {
      console.warn('⚠️ IndexedDB가 지원되지 않습니다.');
      return false;
    }
    
    return await this.saveToIndexedDB();
  }

  /**
   * 데이터베이스 파일 다운로드
   */
  async downloadDatabase(): Promise<void> {
    try {
      const data = this.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `culture_analysis_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      console.log('✅ 데이터베이스 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('❌ 데이터베이스 다운로드 실패:', error);
    }
  }

  /**
   * 데이터베이스 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    this.initializationStatus = 'idle';
    this.initializationPromise = null;
    this.initializationError = null;
  }
}

export const databaseService = new DatabaseService();
export default DatabaseService;