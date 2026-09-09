-- 게시판 3분할 (큐레이션 / 도전 / 부위별). pinned_order 는 큐레이션 순서로 이어 쓴다.
ALTER TABLE "guides" RENAME COLUMN "pinned_order" TO "curated_order";--> statement-breakpoint
ALTER INDEX "guides_topic_pinned_uq" RENAME TO "guides_topic_curated_uq";--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "curated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "area_order" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "guides_area_order_uq" ON "guides" USING btree ("topic_id","category","area_order") WHERE "guides"."area_order" is not null;--> statement-breakpoint
-- 기존 관리자 글은 큐레이션으로 올린다. 부위별 Q&A 시드(slug 가 -q<숫자> 로 끝남)는 제외.
UPDATE "guides" SET "curated" = true WHERE "author_user_id" IS NULL AND "slug" !~ '-q[0-9]+$';
