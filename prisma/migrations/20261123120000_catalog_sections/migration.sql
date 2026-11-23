CREATE TABLE "CatalogSection" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT,
  "imageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CatalogSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogSection_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CatalogSection_slug_key" ON "CatalogSection"("slug");
CREATE UNIQUE INDEX "CatalogSection_departmentId_name_key" ON "CatalogSection"("departmentId", "name");
CREATE INDEX "CatalogSection_departmentId_sortOrder_idx" ON "CatalogSection"("departmentId", "sortOrder");

ALTER TABLE "Category" ADD COLUMN "sectionId" TEXT;

INSERT INTO "CatalogSection" ("id", "departmentId", "name", "slug", "description", "imageUrl", "imageKey", "sortOrder", "updatedAt")
SELECT 'section_perfume_aromas', c."departmentId", 'Ароматы для дома', 'home-fragrance', 'Ароматы для дома и пространства.', c."imageUrl", c."imageKey", c."sortOrder", CURRENT_TIMESTAMP
FROM "Category" c WHERE c."slug" = 'home-fragrance'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CatalogSection" ("id", "departmentId", "name", "slug", "description", "imageUrl", "imageKey", "sortOrder", "updatedAt")
SELECT 'section_food_bakery', c."departmentId", 'Выпечка', 'bakery', 'Свежая выпечка к столу и для подарка.', c."imageUrl", c."imageKey", c."sortOrder", CURRENT_TIMESTAMP
FROM "Category" c WHERE c."slug" = 'bakery'
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Category" SET "sectionId" = 'section_perfume_aromas', "name" = 'Ассортимент', "slug" = 'home-fragrance-assortment', "imageUrl" = NULL, "imageKey" = NULL
WHERE "slug" = 'home-fragrance';
UPDATE "Category" SET "sectionId" = 'section_food_bakery', "name" = 'Ассортимент', "slug" = 'bakery-assortment', "imageUrl" = NULL, "imageKey" = NULL
WHERE "slug" = 'bakery';

ALTER TABLE "Category" ADD CONSTRAINT "Category_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Category_departmentId_parentId_sortOrder_idx";
CREATE INDEX "Category_departmentId_sectionId_parentId_sortOrder_idx" ON "Category"("departmentId", "sectionId", "parentId", "sortOrder");
