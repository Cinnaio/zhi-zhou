import type { Db } from './pool'

/** 单行查询，无结果返回 undefined。 */
export async function first<T>(db: Db, text: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await db.query<T>(text, params)
  return rows[0]
}

/** 多行查询。 */
export async function all<T>(db: Db, text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await db.query<T>(text, params)
  return rows
}

/** 写操作，返回受影响行数。 */
export async function run(db: Db, text: string, params: unknown[] = []): Promise<number> {
  const { rowCount } = await db.query(text, params)
  return rowCount ?? 0
}
