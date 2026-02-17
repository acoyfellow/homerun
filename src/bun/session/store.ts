import { Database } from "bun:sqlite";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { DB_FILENAME } from "../../shared/constants";
import type { Session } from "../../shared/types";
import { runMigrations } from "./migrations";

export interface SessionStore {
	createSession(name: string, domain?: string): Session;
	getSession(id: string): Session | null;
	listSessions(): Session[];
	deleteSession(id: string): boolean;
	close(): void;
}

export function createSessionStore(dataDir: string): SessionStore {
	const dbPath = join(dataDir, DB_FILENAME);
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	runMigrations(db);

	return {
		createSession(name, domain) {
			const now = Date.now();
			const session: Session = {
				id: nanoid(),
				name,
				domain,
				createdAt: now,
				updatedAt: now,
			};
			db.run(
				"INSERT INTO sessions (id, name, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
				[session.id, session.name, session.domain ?? null, session.createdAt, session.updatedAt],
			);
			return session;
		},

		getSession(id) {
			const row = db
				.query("SELECT id, name, domain, created_at, updated_at FROM sessions WHERE id = ?")
				.get(id) as Record<string, unknown> | null;
			if (!row) return null;
			return {
				id: row.id as string,
				name: row.name as string,
				domain: (row.domain as string) || undefined,
				createdAt: row.created_at as number,
				updatedAt: row.updated_at as number,
			};
		},

		listSessions() {
			const rows = db
				.query(
					"SELECT id, name, domain, created_at, updated_at FROM sessions ORDER BY updated_at DESC",
				)
				.all() as Array<Record<string, unknown>>;
			return rows.map((row) => ({
				id: row.id as string,
				name: row.name as string,
				domain: (row.domain as string) || undefined,
				createdAt: row.created_at as number,
				updatedAt: row.updated_at as number,
			}));
		},

		deleteSession(id) {
			const result = db.run("DELETE FROM sessions WHERE id = ?", [id]);
			return result.changes > 0;
		},

		close() {
			db.close();
		},
	};
}
