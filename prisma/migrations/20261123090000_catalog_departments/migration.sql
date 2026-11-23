CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT,
  "imageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

INSERT INTO "Department" ("id", "name", "slug", "description", "sortOrder", "updatedAt") VALUES
('dept_home', 'Дом и быт', 'home', 'Практичные вещи для дома и повседневной жизни.', 0, CURRENT_TIMESTAMP),
('dept_perfume', 'Парфюмерия', 'perfume', 'Ароматы для себя и дома.', 1, CURRENT_TIMESTAMP),
('dept_food', 'Продукты питания', 'food', 'Натуральные продукты и вкусные подарки.', 2, CURRENT_TIMESTAMP);

ALTER TABLE "Category" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Category" SET "departmentId" = 'dept_home';
ALTER TABLE "Category" ALTER COLUMN "departmentId" SET NOT NULL;
DROP INDEX "Category_name_key";
CREATE UNIQUE INDEX "Category_departmentId_name_key" ON "Category"("departmentId", "name");
ALTER TABLE "Category" ADD CONSTRAINT "Category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Category_departmentId_parentId_sortOrder_idx" ON "Category"("departmentId", "parentId", "sortOrder");

INSERT INTO "Category" ("id", "name", "slug", "departmentId", "sortOrder", "updatedAt") VALUES
('cat_perfume_men', 'Мужская парфюмерия', 'mens-perfume', 'dept_perfume', 0, CURRENT_TIMESTAMP),
('cat_perfume_women', 'Женская парфюмерия', 'womens-perfume', 'dept_perfume', 1, CURRENT_TIMESTAMP),
('cat_perfume_unisex', 'Унисекс', 'unisex', 'dept_perfume', 2, CURRENT_TIMESTAMP),
('cat_perfume_sets', 'Парфюмерные наборы', 'perfume-sets', 'dept_perfume', 3, CURRENT_TIMESTAMP),
('cat_perfume_home', 'Ароматы для дома', 'home-fragrance', 'dept_perfume', 4, CURRENT_TIMESTAMP),
('cat_food_honey', 'Мёд и продукты пчеловодства', 'honey-beekeeping', 'dept_food', 0, CURRENT_TIMESTAMP),
('cat_food_bakery', 'Выпечка', 'bakery', 'dept_food', 1, CURRENT_TIMESTAMP),
('cat_food_sweets', 'Сладости', 'sweets', 'dept_food', 2, CURRENT_TIMESTAMP),
('cat_food_natural', 'Натуральные продукты', 'natural-foods', 'dept_food', 3, CURRENT_TIMESTAMP),
('cat_food_dried', 'Сухофрукты и орехи', 'dried-fruit-nuts', 'dept_food', 4, CURRENT_TIMESTAMP),
('cat_food_gifts', 'Подарочные наборы', 'food-gift-sets', 'dept_food', 5, CURRENT_TIMESTAMP);

CREATE TABLE "CategoryAttribute" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_key_key" ON "CategoryAttribute"("categoryId", "key");
CREATE INDEX "CategoryAttribute_categoryId_sortOrder_idx" ON "CategoryAttribute"("categoryId", "sortOrder");

INSERT INTO "CategoryAttribute" ("id", "categoryId", "key", "label", "type", "required", "sortOrder")
SELECT 'attr_' || c."id" || '_' || a.key, c."id", a.key, a.label, a.type, a.required, a.sortOrder
FROM "Category" c
CROSS JOIN (VALUES
  ('brand', 'Бренд', 'text', false, 0),
  ('volumeMl', 'Объём (мл)', 'number', false, 1),
  ('scentType', 'Тип аромата', 'text', false, 2),
  ('gender', 'Пол', 'text', false, 3),
  ('longevity', 'Стойкость', 'text', false, 4),
  ('country', 'Страна производства', 'text', false, 5)
) AS a(key, label, type, required, sortOrder)
WHERE c."departmentId" = 'dept_perfume';

INSERT INTO "CategoryAttribute" ("id", "categoryId", "key", "label", "type", "required", "sortOrder")
SELECT 'attr_' || c."id" || '_' || a.key, c."id", a.key, a.label, a.type, a.required, a.sortOrder
FROM "Category" c
CROSS JOIN (VALUES
  ('producer', 'Производитель', 'text', false, 0),
  ('weightGrams', 'Вес (г)', 'number', false, 1),
  ('ingredients', 'Состав', 'text', false, 2),
  ('expiryDate', 'Срок годности', 'date', false, 3),
  ('productionDate', 'Дата производства', 'date', false, 4),
  ('storageConditions', 'Условия хранения', 'text', false, 5),
  ('country', 'Страна производства', 'text', false, 6)
) AS a(key, label, type, required, sortOrder)
WHERE c."departmentId" = 'dept_food';

ALTER TABLE "Product" ADD COLUMN "attributes" JSONB;
