// src/types/sql.d.ts

declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(values?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: any): any;
    free(): boolean;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default initSqlJs;
}