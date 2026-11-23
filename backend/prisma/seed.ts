import 'dotenv/config';
import { PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be set before seeding.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function seed(): Promise<void> {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !/^\+998\d{9}$/.test(phone) || !password || password.length < 12 || password.includes('change-this-before')) {
    throw new Error('Set ADMIN_PHONE and a non-placeholder ADMIN_PASSWORD of at least 12 characters in .env before seeding.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must not exceed 72 UTF-8 bytes (bcrypt limit).');
  }

  await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      name: 'Platform administrator',
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.ADMIN,
    },
    update: { role: UserRole.ADMIN, isActive: true },
  });
  await prisma.setting.upsert({
    where: { key: 'lowStockThreshold' },
    create: { key: 'lowStockThreshold', value: process.env.LOW_STOCK_THRESHOLD ?? '5' },
    update: {},
  });

  for (const department of [
    { id: 'dept_home', name: 'Дом и быт', slug: 'home', description: 'Практичные вещи для дома и повседневной жизни.', sortOrder: 0 },
    { id: 'dept_perfume', name: 'Парфюмерия', slug: 'perfume', description: 'Ароматы для себя и дома.', sortOrder: 1 },
    { id: 'dept_food', name: 'Продукты питания', slug: 'food', description: 'Натуральные продукты и вкусные подарки.', sortOrder: 2 },
  ]) {
    await prisma.department.upsert({ where: { slug: department.slug }, create: department, update: {} });
  }

  const sampleProducts = [
    { sku: 'PET-BOWL-01', name: 'Миска для питомца', description: 'Устойчивая миска для ежедневного кормления.', category: 'Для животных', cost: '25000', recommended: '40000', minimum: '30000', markup: '25000', stock: 25, image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80' },
    { sku: 'PET-TOY-01', name: 'Игрушка для собак', description: 'Прочная игрушка для активных игр и прогулок.', category: 'Для животных', cost: '18000', recommended: '30000', minimum: '22000', markup: '18000', stock: 18, image: 'https://images.unsplash.com/photo-1535294435445-d7249524ef2e?auto=format&fit=crop&w=800&q=80' },
    { sku: 'HOME-LAMP-01', name: 'Настольная лампа', description: 'Лаконичный светильник для рабочего стола.', category: 'Для дома', cost: '90000', recommended: '135000', minimum: '105000', markup: '70000', stock: 12, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80' },
    { sku: 'HOME-BOTTLE-01', name: 'Термобутылка', description: 'Многоразовая бутылка для горячих и холодных напитков.', category: 'Для дома', cost: '45000', recommended: '70000', minimum: '55000', markup: '45000', stock: 30, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80' },
  ];

  for (const [index, item] of sampleProducts.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: `seed-category-${index < 2 ? 'pets' : 'home'}` },
      create: {
        slug: `seed-category-${index < 2 ? 'pets' : 'home'}`,
        name: item.category,
        departmentId: 'dept_home',
      },
      update: {},
    });
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      create: {
        sku: item.sku,
        name: item.name,
        description: item.description,
        categoryId: category.id,
        costPrice: item.cost,
        recommendedPrice: item.recommended,
        minimumPrice: item.minimum,
        maximumMarkup: item.markup,
        imageUrl: item.image,
        status: ProductStatus.ACTIVE,
        inventory: { create: { quantity: item.stock } },
      },
      update: {},
    });
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    if (!inventory) {
      await prisma.inventory.create({ data: { productId: product.id, quantity: item.stock } });
    }
  }

  console.log(`Administrator ${phone} and starter catalog are ready.`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
