DROP INDEX "uq_qb_customers_client_company_id_active_idx";--> statement-breakpoint
ALTER TABLE "qb_customers" ADD COLUMN "customer_type" varchar(20) DEFAULT 'client' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_qb_customers_client_company_id_type_active_idx" ON "qb_customers" USING btree ("portal_id","client_company_id","customer_type") WHERE "qb_customers"."deleted_at" is null;