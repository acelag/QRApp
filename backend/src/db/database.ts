import * as mssql from 'mssql/msnodesqlv8';

const connectionString =
  process.env.DB_CONNECTION ??
  'Driver={SQL Server};Server=DESKTOP-KJR88JV\\SQLEXPRESS;Database=QrAppDb;Trusted_Connection=yes;';

export let pool: mssql.ConnectionPool;
export const sql = mssql;

export async function connectDb(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool = await new mssql.ConnectionPool({ connectionString } as any).connect();
  console.log('✓ Connected to SQL Server');
}
