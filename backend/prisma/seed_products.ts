import { PrismaClient, ProductCategory } from '@prisma/client';

const prisma = new PrismaClient();

const brands = ['Coca Cola', 'Sprite', 'Marinda', 'Dew'];

const variants = [
  {
    name: '250ml Glass',
    petConversionFactor: 24,
    description: '250ml Returnable Glass Bottle',
    buyPrice: 1200,
    salePrice: 1440,
  },
  {
    name: '500ml PET',
    petConversionFactor: 12,
    description: '500ml Plastic Bottle',
    buyPrice: 900,
    salePrice: 1080,
  },
  {
    name: '1.5L PET',
    petConversionFactor: 6,
    description: '1.5 Litre Plastic Bottle',
    buyPrice: 720,
    salePrice: 900,
  },
  {
    name: '2.25L PET',
    petConversionFactor: 6,
    description: '2.25 Litre Plastic Bottle',
    buyPrice: 1000,
    salePrice: 1200,
  },
];

async function main() {
  console.log('🌱 Seeding products and stock batches...');

  for (const brand of brands) {
    for (const variant of variants) {
      // 1. Create or find the product
      const product = await prisma.product.upsert({
        where: {
          id: `${brand.toLowerCase().replace(/\s+/g, '-')}-${variant.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: {},
        create: {
          id: `${brand.toLowerCase().replace(/\s+/g, '-')}-${variant.name.toLowerCase().replace(/\s+/g, '-')}`,
          brand,
          category: ProductCategory.soft_drink,
          variant: variant.name,
          petConversionFactor: variant.petConversionFactor,
          description: `${brand} ${variant.description}`,
        },
      });

      console.log(`Product: ${product.brand} (${product.variant}) -> id: ${product.id}`);

      // 2. Check and add initial stock batch
      const batchNumber = `BATCH-${brand.toUpperCase().replace(/\s+/g, '')}-${variant.name.toUpperCase().replace(/\s+/g, '')}-01`;
      
      const existingBatch = await prisma.stockBatch.findUnique({
        where: { batchNumber },
      });

      if (!existingBatch) {
        const batch = await prisma.stockBatch.create({
          data: {
            productId: product.id,
            quantity: 100, // 100 crates/cases
            buyPrice: variant.buyPrice,
            salePrice: variant.salePrice,
            batchNumber,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
            purchaseDate: new Date(),
            supplier: 'Beverage Distributor Corp',
          },
        });
        console.log(`  Added StockBatch: ${batch.batchNumber} with quantity ${batch.quantity}`);
      } else {
        console.log(`  StockBatch ${batchNumber} already exists.`);
      }
    }
  }

  console.log('🎉 Product & Stock Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
