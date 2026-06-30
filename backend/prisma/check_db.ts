import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  console.log('Products:', JSON.stringify(products, null, 2));
  const batches = await prisma.stockBatch.findMany();
  console.log('Batches count:', batches.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
