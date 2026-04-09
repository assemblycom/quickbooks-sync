ALTER TYPE "public"."failed_record_category_types" ADD VALUE IF NOT EXISTS 'rate_limit';--> statement-breakpoint
ALTER TYPE "public"."failed_record_category_types" ADD VALUE IF NOT EXISTS 'validation';--> statement-breakpoint
ALTER TYPE "public"."failed_record_category_types" ADD VALUE IF NOT EXISTS 'qb_api_error';--> statement-breakpoint
ALTER TYPE "public"."failed_record_category_types" ADD VALUE IF NOT EXISTS 'mapping_not_found';
