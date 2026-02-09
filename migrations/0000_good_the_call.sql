CREATE TABLE `endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`method` text NOT NULL,
	`path_pattern` text NOT NULL,
	`request_schema` text,
	`response_schema` text,
	`request_headers` text,
	`response_headers` text,
	`sample_count` integer DEFAULT 1 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `endpoints_site_method_path` ON `endpoints` (`site_id`,`method`,`path_pattern`);--> statement-breakpoint
CREATE TABLE `paths` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`task` text NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`endpoint_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`heal_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text,
	`tool` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`duration_ms` integer,
	`har_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `paths`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`domain` text NOT NULL,
	`first_scouted_at` text NOT NULL,
	`last_scouted_at` text NOT NULL
);
