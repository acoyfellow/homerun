import type { Database } from "bun:sqlite";

const MIGRATIONS = [
	{
		version: 1,
		up: `
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				domain TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS traffic (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
				method TEXT NOT NULL,
				url TEXT NOT NULL,
				status INTEGER,
				request_headers TEXT,
				response_headers TEXT,
				request_body BLOB,
				response_body BLOB,
				timing TEXT,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS form_sequences (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				actions TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS specs (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
				domain TEXT NOT NULL,
				spec TEXT NOT NULL,
				version TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS cookies (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
				domain TEXT NOT NULL,
				name TEXT NOT NULL,
				value TEXT NOT NULL,
				path TEXT DEFAULT '/',
				expires INTEGER,
				secure INTEGER DEFAULT 0,
				http_only INTEGER DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS _migrations (
				version INTEGER PRIMARY KEY,
				applied_at INTEGER NOT NULL
			);
		`,
	},
];

export function runMigrations(db: Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			version INTEGER PRIMARY KEY,
			applied_at INTEGER NOT NULL
		)
	`);

	const applied = new Set(
		(db.query("SELECT version FROM _migrations").all() as Array<{ version: number }>).map(
			(r) => r.version,
		),
	);

	for (const migration of MIGRATIONS) {
		if (applied.has(migration.version)) continue;
		db.exec(migration.up);
		db.run("INSERT INTO _migrations (version, applied_at) VALUES (?, ?)", [
			migration.version,
			Date.now(),
		]);
	}
}
