/**
 * Prisma Seed Script
 * Populates the database with initial Admin and Worker accounts.
 *
 * Run with: npx ts-node prisma/seed.ts
 *           (or: npm run db:seed)
 *
 * Credentials:
 *   Admin:  admin@gmail.com  / admin
 *   Worker: worker@gmail.com / worker
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱  Seeding database...\n');

  // ── Admin User ────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin', SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      passwordHash: adminPassword,
      isActive: true,
    },
    create: {
      name: 'System Admin',
      email: 'admin@gmail.com',
      passwordHash: adminPassword,
      role: UserRole.admin,
      isActive: true,
    },
  });

  console.log(`✅  Admin user ready:  ${admin.email}  (id: ${admin.id})`);

  // ── Worker User ───────────────────────────────────────────────────────────
  const workerPassword = await bcrypt.hash('worker', SALT_ROUNDS);

  const worker = await prisma.user.upsert({
    where: { email: 'worker@gmail.com' },
    update: {
      passwordHash: workerPassword,
      isActive: true,
    },
    create: {
      name: 'Sales Worker',
      email: 'worker@gmail.com',
      passwordHash: workerPassword,
      role: UserRole.worker,
      isActive: true,
    },
  });

  console.log(`✅  Worker user ready: ${worker.email}  (id: ${worker.id})`);

  console.log('\n🎉  Seeding complete.');
  console.log('\n📋  Login credentials:');
  console.log('    Admin  → admin@gmail.com  / admin');
  console.log('    Worker → worker@gmail.com / worker');
  console.log('\n⚠️   Change these passwords before going to production!\n');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
