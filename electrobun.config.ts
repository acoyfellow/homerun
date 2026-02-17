import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "homerun",
		identifier: "dev.homerun.app",
		version: "0.1.0",
	},
	runtime: {
		exitOnLastWindowClosed: false, // Keep running in system tray
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			dashboard: {
				entrypoint: "src/views/dashboard/index.ts",
			},
			traffic: {
				entrypoint: "src/views/traffic/index.ts",
			},
		},
	},
} satisfies ElectrobunConfig;
