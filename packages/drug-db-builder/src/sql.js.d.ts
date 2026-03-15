declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: (string | number | null | Uint8Array)[]): Database;
    exec(sql: string): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: (string | number | null | Uint8Array)[][];
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export type { Database, SqlJsStatic, QueryExecResult };

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
