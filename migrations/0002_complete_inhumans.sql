CREATE TABLE `directory_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_id` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`summary` text NOT NULL,
	`capability` text NOT NULL,
	`request_schema` text,
	`response_schema` text,
	`auth` integer NOT NULL,
	`example_request` text,
	`example_response` text,
	`vector_id` text,
	FOREIGN KEY (`fingerprint_id`) REFERENCES `fingerprints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_directory_endpoints_fingerprint` ON `directory_endpoints` (`fingerprint_id`);--> statement-breakpoint
CREATE INDEX `idx_directory_endpoints_capability` ON `directory_endpoints` (`capability`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_directory_endpoints_unique` ON `directory_endpoints` (`fingerprint_id`,`method`,`path`);--> statement-breakpoint
CREATE TABLE `fingerprints` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`url` text NOT NULL,
	`endpoint_count` integer NOT NULL,
	`capabilities` text NOT NULL,
	`methods` text NOT NULL,
	`auth` text NOT NULL,
	`confidence` integer NOT NULL,
	`spec_key` text NOT NULL,
	`contributor` text DEFAULT 'anonymous',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fingerprints_domain_unique` ON `fingerprints` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_fingerprints_domain` ON `fingerprints` (`domain`);