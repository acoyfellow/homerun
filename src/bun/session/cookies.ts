import type { Database } from "bun:sqlite";

export interface Cookie {
	domain: string;
	name: string;
	value: string;
	path: string;
	expires: number | undefined;
	secure: boolean;
	httpOnly: boolean;
}

export interface CookieJar {
	set(sessionId: string, cookie: Cookie): void;
	get(sessionId: string, domain: string): Cookie[];
	clear(sessionId: string): void;
}

export function createCookieJar(db: Database): CookieJar {
	return {
		set(sessionId, cookie) {
			db.run(
				`INSERT OR REPLACE INTO cookies (id, session_id, domain, name, value, path, expires, secure, http_only)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					`${sessionId}:${cookie.domain}:${cookie.name}`,
					sessionId,
					cookie.domain,
					cookie.name,
					cookie.value,
					cookie.path,
					cookie.expires ?? null,
					cookie.secure ? 1 : 0,
					cookie.httpOnly ? 1 : 0,
				],
			);
		},

		get(sessionId, domain) {
			const rows = db
				.query(
					"SELECT domain, name, value, path, expires, secure, http_only FROM cookies WHERE session_id = ? AND domain = ?",
				)
				.all(sessionId, domain) as Array<Record<string, unknown>>;

			return rows.map((row) => ({
				domain: row.domain as string,
				name: row.name as string,
				value: row.value as string,
				path: (row.path as string) || "/",
				expires: (row.expires as number | null) ?? undefined,
				secure: (row.secure as number) === 1,
				httpOnly: (row.http_only as number) === 1,
			}));
		},

		clear(sessionId) {
			db.run("DELETE FROM cookies WHERE session_id = ?", [sessionId]);
		},
	};
}
