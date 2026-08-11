import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Local persistence: practice-session spans (for the journal) and per-note
 * intonation scores (for the trainer's progress tracking).
 */

export type Tool = 'drone' | 'tuner' | 'metronome' | 'scales' | 'intonation';

export interface PracticeSession {
  id: number;
  startedAt: number;
  endedAt: number | null;
  tool: Tool;
  notes: string | null;
}

export interface IntonationResult {
  id: number;
  createdAt: number;
  targetMidi: number;
  /** Signed mean cents deviation while the note was held. */
  centsError: number;
  /** Mean absolute deviation — the headline accuracy number. */
  absError: number;
  /** Spread (std dev) of the deviation — how steady the pitch was. */
  stability: number;
  tier: string;
}

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('violin-skills.db');
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS practice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        tool TEXT NOT NULL,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS intonation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        target_midi INTEGER NOT NULL,
        cents_error REAL NOT NULL,
        abs_error REAL NOT NULL,
        stability REAL NOT NULL,
        tier TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON practice_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_intonation_created ON intonation_results(created_at);
    `);
  }
  return db;
}

// ---- practice sessions ----

export function startSession(tool: Tool): number {
  const result = getDb().runSync(
    'INSERT INTO practice_sessions (started_at, tool) VALUES (?, ?)',
    [Date.now(), tool],
  );
  return Number(result.lastInsertRowId);
}

export function endSession(id: number) {
  getDb().runSync('UPDATE practice_sessions SET ended_at = ? WHERE id = ?', [Date.now(), id]);
}

export function listSessions(limit = 100): PracticeSession[] {
  const rows = getDb().getAllSync<{
    id: number;
    started_at: number;
    ended_at: number | null;
    tool: Tool;
    notes: string | null;
  }>(
    'SELECT * FROM practice_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    tool: r.tool,
    notes: r.notes,
  }));
}

/** Total practiced milliseconds per tool since `sinceMs` (epoch). */
export function usageByTool(sinceMs: number): Partial<Record<Tool, number>> {
  const rows = getDb().getAllSync<{ tool: Tool; total: number }>(
    `SELECT tool, SUM(ended_at - started_at) AS total
     FROM practice_sessions
     WHERE ended_at IS NOT NULL AND started_at >= ?
     GROUP BY tool`,
    [sinceMs],
  );
  const result: Partial<Record<Tool, number>> = {};
  for (const row of rows) {
    result[row.tool] = row.total;
  }
  return result;
}

/** Days-in-a-row (ending today or yesterday) with at least one session. */
export function currentStreak(): number {
  const rows = getDb().getAllSync<{ day: string }>(
    `SELECT DISTINCT date(started_at / 1000, 'unixepoch', 'localtime') AS day
     FROM practice_sessions
     WHERE ended_at IS NOT NULL
     ORDER BY day DESC`,
  );
  if (rows.length === 0) {
    return 0;
  }
  const days = rows.map((r) => r.day);
  const dayString = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  // Streak may end today or yesterday (today's practice not done yet).
  let offset = days[0] === dayString(0) ? 0 : days[0] === dayString(1) ? 1 : -1;
  if (offset === -1) {
    return 0;
  }
  let streak = 0;
  for (const day of days) {
    if (day !== dayString(offset)) {
      break;
    }
    streak += 1;
    offset += 1;
  }
  return streak;
}

// ---- intonation results ----

export function saveIntonationResult(
  result: Omit<IntonationResult, 'id' | 'createdAt'>,
): void {
  getDb().runSync(
    `INSERT INTO intonation_results (created_at, target_midi, cents_error, abs_error, stability, tier)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Date.now(), result.targetMidi, result.centsError, result.absError, result.stability, result.tier],
  );
}

/** Average absolute error per day for the trend chart, oldest first. */
export function intonationTrend(days = 30): { day: string; avgAbsError: number }[] {
  return getDb().getAllSync<{ day: string; avgAbsError: number }>(
    `SELECT date(created_at / 1000, 'unixepoch', 'localtime') AS day,
            AVG(abs_error) AS avgAbsError
     FROM intonation_results
     WHERE created_at >= ?
     GROUP BY day
     ORDER BY day ASC`,
    [Date.now() - days * 86400_000],
  );
}

/** Per-pitch-class average absolute error — finds the trouble notes. */
export function troubleNotes(sinceMs: number): { pitchClass: number; avgAbsError: number; count: number }[] {
  return getDb().getAllSync<{ pitchClass: number; avgAbsError: number; count: number }>(
    `SELECT target_midi % 12 AS pitchClass,
            AVG(abs_error) AS avgAbsError,
            COUNT(*) AS count
     FROM intonation_results
     WHERE created_at >= ?
     GROUP BY pitchClass
     HAVING count >= 3
     ORDER BY avgAbsError DESC`,
    [sinceMs],
  );
}
