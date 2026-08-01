CREATE TABLE `dragon_tiger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`stock_code` text NOT NULL,
	`limit_record_id` integer,
	`seat_name` text NOT NULL,
	`seat_type` text DEFAULT 'buy' NOT NULL,
	`rank` integer,
	`buy_amount` real,
	`sell_amount` real,
	`net_amount` real,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`limit_record_id`) REFERENCES `limit_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dt_rec_idx` ON `dragon_tiger` (`limit_record_id`);--> statement-breakpoint
CREATE INDEX `dt_code_idx` ON `dragon_tiger` (`stock_code`);--> statement-breakpoint
CREATE INDEX `dt_date_idx` ON `dragon_tiger` (`trade_date`);--> statement-breakpoint
CREATE TABLE `limit_related` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`stock_code` text NOT NULL,
	`limit_record_id` integer,
	`related_code` text NOT NULL,
	`related_name` text,
	`relation_type` text DEFAULT 'concept' NOT NULL,
	`weight` real DEFAULT 1,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`limit_record_id`) REFERENCES `limit_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lr_rel_rec_idx` ON `limit_related` (`limit_record_id`);--> statement-breakpoint
CREATE INDEX `lr_rel_code_idx` ON `limit_related` (`stock_code`);--> statement-breakpoint
CREATE INDEX `lr_rel_related_idx` ON `limit_related` (`related_code`);--> statement-breakpoint
CREATE TABLE `market_index_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`index_code` text NOT NULL,
	`index_name` text,
	`open` real,
	`high` real,
	`low` real,
	`close` real,
	`pre_close` real,
	`pct` real,
	`volume` real,
	`amount` real,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mid_unq` ON `market_index_daily` (`trade_date`,`index_code`);--> statement-breakpoint
ALTER TABLE `limit_records` ADD `sector` text;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `industry` text;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `open_time` text;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `pattern_days` integer;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `pattern_boards` integer;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `next_open_prediction` text;--> statement-breakpoint
ALTER TABLE `limit_records` ADD `next_open_actual` real;--> statement-breakpoint
CREATE INDEX `lr_sector_idx` ON `limit_records` (`sector`);--> statement-breakpoint
CREATE INDEX `lr_industry_idx` ON `limit_records` (`industry`);