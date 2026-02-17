export interface CaptureFilter {
	matches(url: string): boolean;
}

export interface CaptureFilterOptions {
	domains?: string[] | undefined;
	excludePaths?: string[] | undefined;
	methods?: string[] | undefined;
	contentTypes?: string[] | undefined;
}

export function createCaptureFilter(options: CaptureFilterOptions): CaptureFilter {
	return {
		matches(url: string): boolean {
			try {
				const parsed = new URL(url);

				if (options.domains && options.domains.length > 0) {
					const matchesDomain = options.domains.some(
						(d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
					);
					if (!matchesDomain) return false;
				}

				if (options.excludePaths && options.excludePaths.length > 0) {
					const excluded = options.excludePaths.some((p) => parsed.pathname.startsWith(p));
					if (excluded) return false;
				}

				return true;
			} catch {
				return false;
			}
		},
	};
}
