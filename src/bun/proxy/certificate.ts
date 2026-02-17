import { join } from "node:path";

export interface CertificateAuthority {
	certPath: string;
	keyPath: string;
}

export async function ensureCA(dataDir: string): Promise<CertificateAuthority> {
	const certPath = join(dataDir, "homerun-ca.pem");
	const keyPath = join(dataDir, "homerun-ca-key.pem");

	const certFile = Bun.file(certPath);
	const keyFile = Bun.file(keyPath);

	if ((await certFile.exists()) && (await keyFile.exists())) {
		return { certPath, keyPath };
	}

	throw new Error("CA certificate not found. Run `bun run scripts/generate-ca.ts` to create one.");
}
