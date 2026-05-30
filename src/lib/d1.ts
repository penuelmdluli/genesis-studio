// ============================================
// GENESIS STUDIO — Cloudflare D1 Driver
// ============================================
// Provides a Supabase-API-compatible query builder on top of
// Cloudflare D1 (SQLite). This allows the entire codebase to
// keep using .from("table").select().eq().single() patterns
// without rewriting every query.

// D1 binding is injected via Cloudflare Workers environment.
// During local dev, it can be provided via wrangler or a polyfill.

let _db: D1Database | null = null;

/** Set the D1 database binding (called once at request start) */
export function setD1(db: D1Database) {
  _db = db;
}

/** Get the D1 database binding */
export function getD1(): D1Database {
  if (!_db) {
    throw new Error(
      "D1 database not initialized. Call setD1() with the binding first."
    );
  }
  return _db;
}

// ============================================
// Supabase-compatible query builder
// ============================================

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "not";

interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
  negate?: boolean;
}

interface OrderClause {
  column: string;
  ascending: boolean;
}

/** Result type matching Supabase's { data, error, count } */
interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string; code?: string } | null;
  count?: number;
}

class D1QueryBuilder {
  private _table: string;
  private _filters: Filter[] = [];
  private _orders: OrderClause[] = [];
  private _limitVal: number | null = null;
  private _offsetVal: number | null = null;
  private _selectCols = "*";
  private _single = false;
  private _maybeSingle = false;
  private _count: "exact" | null = null;
  private _head = false;

  // For insert/update/upsert/delete
  private _operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private _data: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private _onConflict: string | null = null;
  private _returning = false;

  constructor(table: string) {
    this._table = table;
  }

  // --- SELECT ---
  select(columns = "*", opts?: { count?: "exact"; head?: boolean }): this {
    // If called after insert/update/upsert, it means "return the affected rows"
    // (Supabase pattern: .insert({}).select().single())
    // In that case, keep the original operation — RETURNING * handles it.
    if (this._operation === "insert" || this._operation === "update" || this._operation === "upsert") {
      this._returning = true;
      this._selectCols = columns;
      return this;
    }
    this._operation = "select";
    this._selectCols = columns;
    if (opts?.count) this._count = opts.count;
    if (opts?.head) this._head = opts.head;
    return this;
  }

  // --- INSERT ---
  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this._operation = "insert";
    this._data = data;
    return this;
  }

  // --- UPDATE ---
  update(data: Record<string, unknown>): this {
    this._operation = "update";
    this._data = data;
    return this;
  }

  // --- UPSERT ---
  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string }
  ): this {
    this._operation = "upsert";
    this._data = data;
    this._onConflict = opts?.onConflict ?? null;
    return this;
  }

  // --- DELETE ---
  delete(): this {
    this._operation = "delete";
    return this;
  }

  // --- FILTERS ---
  eq(column: string, value: unknown): this {
    this._filters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this._filters.push({ column, op: "neq", value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this._filters.push({ column, op: "gt", value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this._filters.push({ column, op: "gte", value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this._filters.push({ column, op: "lt", value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this._filters.push({ column, op: "lte", value });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, op: "like", value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, op: "ilike", value: pattern });
    return this;
  }

  is(column: string, value: unknown): this {
    this._filters.push({ column, op: "is", value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this._filters.push({ column, op: "in", value: values });
    return this;
  }

  not(column: string, op: FilterOp, value: unknown): this {
    this._filters.push({ column, op, value, negate: true });
    return this;
  }

  // --- ORDERING ---
  order(column: string, opts?: { ascending?: boolean }): this {
    this._orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  // --- PAGINATION ---
  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  // --- RESULT MODIFIERS ---
  single(): this {
    this._single = true;
    this._limitVal = 1;
    return this;
  }

  maybeSingle(): this {
    this._maybeSingle = true;
    this._limitVal = 1;
    return this;
  }

  // --- EXECUTE ---
  async then<TResult = QueryResult>(
    resolve: (value: QueryResult) => TResult | PromiseLike<TResult>,
    reject?: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<TResult> {
    try {
      const result = await this.execute();
      return resolve(result);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  private async execute(): Promise<QueryResult> {
    const db = getD1();

    try {
      switch (this._operation) {
        case "select":
          return await this.executeSelect(db);
        case "insert":
          return await this.executeInsert(db);
        case "update":
          return await this.executeUpdate(db);
        case "upsert":
          return await this.executeUpsert(db);
        case "delete":
          return await this.executeDelete(db);
        default:
          return { data: null, error: { message: `Unknown operation: ${this._operation}` } };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message } };
    }
  }

  private buildWhereClause(): { sql: string; params: unknown[] } {
    if (this._filters.length === 0) return { sql: "", params: [] };

    const parts: string[] = [];
    const params: unknown[] = [];

    for (const f of this._filters) {
      const col = sanitizeIdentifier(f.column);
      const neg = f.negate ? "NOT " : "";

      switch (f.op) {
        case "eq":
          if (f.value === null) {
            parts.push(`${neg}${col} IS NULL`);
          } else {
            parts.push(`${neg}${col} = ?`);
            params.push(f.value);
          }
          break;
        case "neq":
          if (f.value === null) {
            parts.push(`${col} IS NOT NULL`);
          } else {
            parts.push(`${col} != ?`);
            params.push(f.value);
          }
          break;
        case "gt":
          parts.push(`${neg}${col} > ?`);
          params.push(f.value);
          break;
        case "gte":
          parts.push(`${neg}${col} >= ?`);
          params.push(f.value);
          break;
        case "lt":
          parts.push(`${neg}${col} < ?`);
          params.push(f.value);
          break;
        case "lte":
          parts.push(`${neg}${col} <= ?`);
          params.push(f.value);
          break;
        case "like":
          parts.push(`${neg}${col} LIKE ?`);
          params.push(f.value);
          break;
        case "ilike":
          parts.push(`${neg}${col} LIKE ? COLLATE NOCASE`);
          params.push(f.value);
          break;
        case "is":
          if (f.value === null) {
            parts.push(`${neg}${col} IS NULL`);
          } else if (f.value === true) {
            parts.push(`${neg}${col} = 1`);
          } else if (f.value === false) {
            parts.push(`${neg}${col} = 0`);
          }
          break;
        case "in": {
          const vals = f.value as unknown[];
          if (vals.length === 0) {
            parts.push("1 = 0"); // empty IN = no match
          } else {
            const placeholders = vals.map(() => "?").join(", ");
            parts.push(`${neg}${col} IN (${placeholders})`);
            params.push(...vals);
          }
          break;
        }
        case "not":
          parts.push(`NOT ${col} = ?`);
          params.push(f.value);
          break;
      }
    }

    return { sql: ` WHERE ${parts.join(" AND ")}`, params };
  }

  private buildOrderClause(): string {
    if (this._orders.length === 0) return "";
    const parts = this._orders.map(
      (o) => `${sanitizeIdentifier(o.column)} ${o.ascending ? "ASC" : "DESC"}`
    );
    return ` ORDER BY ${parts.join(", ")}`;
  }

  private buildLimitOffset(): string {
    let sql = "";
    if (this._limitVal !== null) sql += ` LIMIT ${this._limitVal}`;
    if (this._offsetVal !== null) sql += ` OFFSET ${this._offsetVal}`;
    return sql;
  }

  private async executeSelect(db: D1Database): Promise<QueryResult> {
    const { sql: whereSQL, params } = this.buildWhereClause();
    const orderSQL = this.buildOrderClause();
    const limitSQL = this.buildLimitOffset();

    // Count query
    if (this._head && this._count === "exact") {
      const countSQL = `SELECT COUNT(*) as count FROM ${sanitizeIdentifier(this._table)}${whereSQL}`;
      const result = await db.prepare(countSQL).bind(...params).first<{ count: number }>();
      return { data: null, error: null, count: result?.count ?? 0 };
    }

    const selectSQL = `SELECT ${this._selectCols} FROM ${sanitizeIdentifier(this._table)}${whereSQL}${orderSQL}${limitSQL}`;
    const stmt = db.prepare(selectSQL).bind(...params);

    if (this._single || this._maybeSingle) {
      const row = await stmt.first();
      if (!row && this._single) {
        return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      }
      return { data: row ?? null, error: null };
    }

    const result = await stmt.all();
    const data = result.results ?? [];

    if (this._count === "exact") {
      const countSQL = `SELECT COUNT(*) as count FROM ${sanitizeIdentifier(this._table)}${whereSQL}`;
      const countResult = await db.prepare(countSQL).bind(...params).first<{ count: number }>();
      return { data, error: null, count: countResult?.count ?? 0 };
    }

    return { data, error: null };
  }

  private async executeInsert(db: D1Database): Promise<QueryResult> {
    if (!this._data) return { data: null, error: { message: "No data to insert" } };

    const rows = Array.isArray(this._data) ? this._data : [this._data];
    if (rows.length === 0) return { data: null, error: null };

    // Generate UUIDs for rows missing an id
    for (const row of rows) {
      if (!row.id) {
        row.id = crypto.randomUUID();
      }
    }

    const cols = Object.keys(rows[0]);
    const colNames = cols.map(sanitizeIdentifier).join(", ");
    const placeholders = cols.map(() => "?").join(", ");

    const results: Record<string, unknown>[] = [];

    // Use batch for multiple rows
    if (rows.length > 1) {
      const stmts = rows.map((row) => {
        const vals = cols.map((c) => serializeValue(row[c]));
        return db
          .prepare(
            `INSERT INTO ${sanitizeIdentifier(this._table)} (${colNames}) VALUES (${placeholders}) RETURNING *`
          )
          .bind(...vals);
      });

      const batchResults = await db.batch(stmts);
      for (const br of batchResults) {
        if (br.results?.[0]) results.push(br.results[0] as Record<string, unknown>);
      }
    } else {
      const vals = cols.map((c) => serializeValue(rows[0][c]));
      const sql = `INSERT INTO ${sanitizeIdentifier(this._table)} (${colNames}) VALUES (${placeholders}) RETURNING *`;
      const result = await db.prepare(sql).bind(...vals).first();
      if (result) results.push(result as Record<string, unknown>);
    }

    const data = Array.isArray(this._data) ? results : results[0] ?? null;
    return { data, error: null };
  }

  private async executeUpdate(db: D1Database): Promise<QueryResult> {
    if (!this._data) return { data: null, error: { message: "No data to update" } };

    const entries = Object.entries(this._data as Record<string, unknown>);
    const setClauses = entries.map(([k]) => `${sanitizeIdentifier(k)} = ?`).join(", ");
    const setValues = entries.map(([, v]) => serializeValue(v));

    const { sql: whereSQL, params: whereParams } = this.buildWhereClause();

    const sql = `UPDATE ${sanitizeIdentifier(this._table)} SET ${setClauses}${whereSQL} RETURNING *`;
    const allParams = [...setValues, ...whereParams];

    if (this._single || this._maybeSingle) {
      const row = await db.prepare(sql).bind(...allParams).first();
      if (!row && this._single) {
        return { data: null, error: { message: "No rows updated", code: "PGRST116" } };
      }
      return { data: row ?? null, error: null };
    }

    const result = await db.prepare(sql).bind(...allParams).all();
    return { data: result.results ?? [], error: null };
  }

  private async executeUpsert(db: D1Database): Promise<QueryResult> {
    if (!this._data) return { data: null, error: { message: "No data to upsert" } };

    const rows = Array.isArray(this._data) ? this._data : [this._data];
    if (rows.length === 0) return { data: null, error: null };

    for (const row of rows) {
      if (!row.id) row.id = crypto.randomUUID();
    }

    const cols = Object.keys(rows[0]);
    const colNames = cols.map(sanitizeIdentifier).join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    const conflict = this._onConflict
      ? sanitizeIdentifier(this._onConflict)
      : "id";
    const updateCols = cols
      .filter((c) => c !== conflict)
      .map((c) => `${sanitizeIdentifier(c)} = excluded.${sanitizeIdentifier(c)}`)
      .join(", ");

    const results: Record<string, unknown>[] = [];
    for (const row of rows) {
      const vals = cols.map((c) => serializeValue(row[c]));
      const sql = `INSERT INTO ${sanitizeIdentifier(this._table)} (${colNames}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO UPDATE SET ${updateCols} RETURNING *`;
      const result = await db.prepare(sql).bind(...vals).first();
      if (result) results.push(result as Record<string, unknown>);
    }

    const data = Array.isArray(this._data) ? results : results[0] ?? null;
    return { data, error: null };
  }

  private async executeDelete(db: D1Database): Promise<QueryResult> {
    const { sql: whereSQL, params } = this.buildWhereClause();
    const sql = `DELETE FROM ${sanitizeIdentifier(this._table)}${whereSQL} RETURNING *`;

    if (this._single || this._maybeSingle) {
      const row = await db.prepare(sql).bind(...params).first();
      return { data: row ?? null, error: null };
    }

    const result = await db.prepare(sql).bind(...params).all();
    return { data: result.results ?? [], error: null };
  }
}

// ============================================
// RPC support (replaces Supabase .rpc())
// ============================================

const ALLOWED_INCREMENT_FIELDS = new Set([
  "views",
  "likes",
  "recreates",
  "shares",
  "usage_count",
  "referral_count",
  "credits_earned",
  "total_posts",
  "total_engagement",
]);

async function rpc(
  fnName: string,
  params: Record<string, unknown>
): Promise<QueryResult> {
  const db = getD1();

  try {
    switch (fnName) {
      case "increment_explore_field": {
        const { row_id, field_name, amount } = params as {
          row_id: string;
          field_name: string;
          amount: number;
        };
        if (!ALLOWED_INCREMENT_FIELDS.has(field_name)) {
          return { data: null, error: { message: `Invalid field: ${field_name}` } };
        }
        const col = sanitizeIdentifier(field_name);
        await db
          .prepare(
            `UPDATE explore_videos SET ${col} = ${col} + ? WHERE id = ?`
          )
          .bind(amount, row_id)
          .run();
        return { data: null, error: null };
      }

      case "get_trending_explore_videos": {
        const {
          p_cursor_score,
          p_cursor_id,
          p_limit = 20,
        } = params as {
          p_cursor_score?: number;
          p_cursor_id?: string;
          p_limit?: number;
        };

        let sql = `
          SELECT *,
            (likes * 3.0 + views * 1.0 + recreates * 5.0 +
             MAX(0, 100.0 - (unixepoch('now') - unixepoch(created_at)) / 1728.0)
            ) AS trending_score
          FROM explore_videos
          WHERE is_published = 1 AND is_flagged = 0
        `;
        const bindParams: unknown[] = [];

        if (p_cursor_score != null && p_cursor_id != null) {
          sql += ` AND (
            (likes * 3.0 + views * 1.0 + recreates * 5.0 +
             MAX(0, 100.0 - (unixepoch('now') - unixepoch(created_at)) / 1728.0)
            ) < ?
            OR (
              (likes * 3.0 + views * 1.0 + recreates * 5.0 +
               MAX(0, 100.0 - (unixepoch('now') - unixepoch(created_at)) / 1728.0)
              ) = ? AND id < ?
            )
          )`;
          bindParams.push(p_cursor_score, p_cursor_score, p_cursor_id);
        }

        sql += ` ORDER BY trending_score DESC, id DESC LIMIT ?`;
        bindParams.push(p_limit);

        const result = await db.prepare(sql).bind(...bindParams).all();
        return { data: result.results ?? [], error: null };
      }

      default:
        return { data: null, error: { message: `Unknown RPC function: ${fnName}` } };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: { message } };
  }
}

// ============================================
// Main client factory (Supabase-compatible API)
// ============================================

export interface D1SupabaseClient {
  from(table: string): D1QueryBuilder;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc(fnName: string, params?: Record<string, unknown>): Promise<{ data: any; error: { message: string; code?: string } | null }>;
}

export function createD1Client(): D1SupabaseClient {
  return {
    from(table: string) {
      return new D1QueryBuilder(table);
    },
    rpc(fnName: string, params: Record<string, unknown> = {}) {
      return rpc(fnName, params);
    },
  };
}

// ============================================
// Helpers
// ============================================

/** Sanitize a SQL identifier to prevent injection */
function sanitizeIdentifier(name: string): string {
  // Only allow alphanumeric, underscore, and dot (for table.column)
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

/** Serialize a JS value for D1 binding */
function serializeValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}
