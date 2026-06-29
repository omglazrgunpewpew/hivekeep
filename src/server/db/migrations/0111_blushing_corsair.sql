CREATE TABLE `api_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` text NOT NULL,
	`agent_id` text,
	`allowed_modes` text DEFAULT '["main","isolated"]' NOT NULL,
	`rate_limit_per_min` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_clients_owner` ON `api_clients` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`label` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_keys_client` ON `api_keys` (`client_id`);--> statement-breakpoint
CREATE TABLE `api_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`conversation_id` text,
	`queue_item_id` text,
	`request_message_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reply_message_id` text,
	`reply_content` text,
	`error_code` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reply_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_api_requests_client` ON `api_requests` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_api_requests_status` ON `api_requests` (`status`);