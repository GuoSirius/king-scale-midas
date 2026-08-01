CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`detail` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `al_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`limit_pct` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text
);
--> statement-breakpoint
CREATE TABLE `data_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`adapter` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `industries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text
);
--> statement-breakpoint
CREATE TABLE `industry_daily_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`industry_id` text NOT NULL,
	`limit_up_count` integer DEFAULT 0 NOT NULL,
	`avg_pct` real,
	`rank` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ids_uniq` ON `industry_daily_stats` (`trade_date`,`industry_id`);--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` text DEFAULT (current_timestamp) NOT NULL,
	`source` text NOT NULL,
	`trade_date` text,
	`status` text DEFAULT 'success' NOT NULL,
	`fetched` integer DEFAULT 0,
	`inserted` integer DEFAULT 0,
	`updated` integer DEFAULT 0,
	`skipped` integer DEFAULT 0,
	`error` text,
	`duration_ms` integer
);
--> statement-breakpoint
CREATE TABLE `limit_reason_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`limit_record_id` integer NOT NULL,
	`concept_id` text,
	`sector_id` text,
	`tag_type` text DEFAULT 'concept' NOT NULL,
	`weight` real DEFAULT 1,
	FOREIGN KEY (`limit_record_id`) REFERENCES `limit_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lrt_uniq` ON `limit_reason_tags` (`limit_record_id`,`concept_id`,`tag_type`);--> statement-breakpoint
CREATE INDEX `lrt_rec_idx` ON `limit_reason_tags` (`limit_record_id`);--> statement-breakpoint
CREATE TABLE `limit_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`stock_code` text NOT NULL,
	`stock_name` text NOT NULL,
	`board` text NOT NULL,
	`limit_type` text NOT NULL,
	`price` real,
	`pct` real,
	`first_limit_time` text,
	`last_limit_time` text,
	`open_times` integer DEFAULT 0,
	`turnover` real,
	`volume` integer,
	`circ_market_cap` real,
	`total_market_cap` real,
	`zt_count` integer DEFAULT 1,
	`reason_raw` text,
	`reason_final` text,
	`is_verified` integer DEFAULT false NOT NULL,
	`source` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lr_uniq` ON `limit_records` (`trade_date`,`stock_code`,`limit_type`);--> statement-breakpoint
CREATE INDEX `lr_date_idx` ON `limit_records` (`trade_date`);--> statement-breakpoint
CREATE INDEX `lr_code_idx` ON `limit_records` (`stock_code`);--> statement-breakpoint
CREATE INDEX `lr_board_idx` ON `limit_records` (`board`);--> statement-breakpoint
CREATE INDEX `lr_type_idx` ON `limit_records` (`limit_type`);--> statement-breakpoint
CREATE INDEX `lr_zt_idx` ON `limit_records` (`zt_count`);--> statement-breakpoint
CREATE TABLE `market_daily_summary` (
	`trade_date` text PRIMARY KEY NOT NULL,
	`limit_up_count` integer DEFAULT 0 NOT NULL,
	`limit_down_count` integer DEFAULT 0 NOT NULL,
	`limit_up_open_count` integer DEFAULT 0 NOT NULL,
	`zt_height` integer DEFAULT 0 NOT NULL,
	`first_board_count` integer DEFAULT 0 NOT NULL,
	`seal_rate` real,
	`avg_pct` real,
	`ytd_zt_today_up` integer DEFAULT 0,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rp_pk` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `sector_daily_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`sector_id` text NOT NULL,
	`limit_up_count` integer DEFAULT 0 NOT NULL,
	`avg_pct` real,
	`rank` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sds_uniq` ON `sector_daily_stats` (`trade_date`,`sector_id`);--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'industry' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sess_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `stock_daily_quote` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_date` text NOT NULL,
	`stock_code` text NOT NULL,
	`open` real,
	`high` real,
	`low` real,
	`close` real,
	`pre_close` real,
	`pct` real,
	`amount` real,
	`turnover_rate` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sdq_uniq` ON `stock_daily_quote` (`trade_date`,`stock_code`);--> statement-breakpoint
CREATE TABLE `stocks` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`board` text NOT NULL,
	`is_st` integer DEFAULT false NOT NULL,
	`listed_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stocks_board_idx` ON `stocks` (`board`);--> statement-breakpoint
CREATE TABLE `trade_calendar` (
	`trade_date` text PRIMARY KEY NOT NULL,
	`is_trading` integer DEFAULT true NOT NULL,
	`year` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tc_year_idx` ON `trade_calendar` (`year`);--> statement-breakpoint
CREATE TABLE `user_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`limit_record_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`note` text,
	`reason_override` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`limit_record_id`) REFERENCES `limit_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `un_rec_idx` ON `user_notes` (`limit_record_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` integer NOT NULL,
	`role_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ur_pk` ON `user_roles` (`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`last_login_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watchlist_id` integer NOT NULL,
	`ref_code` text NOT NULL,
	`ref_name` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`watchlist_id`) REFERENCES `watchlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wli_wl_idx` ON `watchlist_items` (`watchlist_id`);--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'stock' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wl_user_idx` ON `watchlists` (`user_id`);

-- ── 初始字典数据（首次部署即生效） ──
INSERT OR IGNORE INTO `boards` (`id`, `name`, `limit_pct`) VALUES
  ('main', '主板', 10),
  ('cyb', '创业板', 20),
  ('star', '科创板', 20),
  ('bse', '北交所', 30),
  ('st', 'ST', 5);

INSERT OR IGNORE INTO `roles` (`id`, `name`, `description`) VALUES
  ('admin', '管理员', '全部权限 + 用户管理'),
  ('user', '普通用户', '查看数据与补全原因');

INSERT OR IGNORE INTO `permissions` (`id`, `name`, `resource`, `action`) VALUES
  ('user:approve', '审核用户', 'user', 'approve'),
  ('user:disable', '禁用用户', 'user', 'disable'),
  ('record:edit', '编辑记录', 'record', 'edit'),
  ('data:export', '导出数据', 'data', 'export');