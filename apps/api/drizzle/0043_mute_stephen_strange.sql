CREATE INDEX "auth_rate_limits_window_idx" ON "auth_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "archive_ranking" ON "game_match_archives" USING btree ("status","ended_at");--> statement-breakpoint
CREATE INDEX "match_lobby_listing" ON "game_matches" USING btree ("status","development","created_at");--> statement-breakpoint
CREATE INDEX "match_playing_listing" ON "game_matches" USING btree ("status","development","updated_at");--> statement-breakpoint
CREATE INDEX "sessions_idle_expiry_idx" ON "sessions" USING btree ("idle_expires_at");--> statement-breakpoint
CREATE INDEX "wallet_operations_created_idx" ON "wallet_operations" USING btree ("created_at");