CREATE TABLE "auth_sessions" (
 "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "refresh_hash" TEXT NOT NULL,
 "expires_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "one_time_tokens" (
 "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "purpose" TEXT NOT NULL,
 "context" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "one_time_tokens_expires_at_idx" ON "one_time_tokens"("expires_at");
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "face_attempts" (
 "user_id" TEXT NOT NULL, "failures" INTEGER NOT NULL DEFAULT 0, "blocked_until" TIMESTAMP(3),
 CONSTRAINT "face_attempts_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "face_attempts" ADD CONSTRAINT "face_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
