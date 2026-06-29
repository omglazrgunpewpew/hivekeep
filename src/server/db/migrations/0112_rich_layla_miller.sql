CREATE TABLE `api_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`session_id` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`last_message_at` integer,
	`expires_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `quick_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_conversations_client` ON `api_conversations` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_api_conversations_session` ON `api_conversations` (`session_id`);--> statement-breakpoint
ALTER TABLE `quick_sessions` ADD `kind` text DEFAULT 'quick' NOT NULL;