/**
 * ApiLive — Effect HttpApiBuilder handlers for unsurf tools.
 *
 * Currently the Worker entry point (index.ts) handles routing directly
 * to keep the CF Worker integration simple. This module defines the
 * HttpApi group handlers for future use with Effect's HttpServer.
 */
import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { UnsurfApi } from "./Api.js";
import { heal } from "./tools/Heal.js";
import { scout } from "./tools/Scout.js";
import { worker } from "./tools/Worker.js";

export const ToolsLive = HttpApiBuilder.group(UnsurfApi, "Tools", (handlers) =>
	handlers
		.handle("scout", ({ payload }) =>
			scout({ url: payload.url, task: payload.task }).pipe(
				Effect.catchAll((e) =>
					Effect.succeed({
						siteId: "",
						endpointCount: 0,
						pathId: "",
						openApiSpec: { error: e.message },
					}),
				),
			),
		)
		.handle("worker", ({ payload }) =>
			worker({
				pathId: payload.pathId,
				data: payload.data as Record<string, unknown>,
			}).pipe(
				Effect.catchAll((e) => Effect.succeed({ success: false, response: { error: e.message } })),
			),
		)
		.handle("heal", ({ payload }) =>
			heal({ pathId: payload.pathId, error: payload.error }).pipe(
				Effect.catchAll(() => Effect.succeed({ healed: false, newPathId: undefined })),
			),
		),
);
