/**
 * Prisma Seed Script
 *
 * Creates default admin and worker accounts only if they don't already exist.
 * Uses upsert() keyed on `username` (the login identifier) so this script is
 * 100% idempotent — running it multiple times is safe and never creates
 * duplicates or overwrites existing passwords.
 *
 * Run with: npm run db:seed
 *
 * Default credentials (testing phase only):
 *   Admin  → username: admin  / password: admin
 *   Worker → username: worker / password: worker
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱  Seeding database…\n');

  // ── Admin ────────────────────────────────────────────────────────────────────
  // upsert keyed on username.
  // update block is intentionally empty — we never overwrite an existing password.
  // Only the create block runs when the user doesn't exist yet.
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existingAdmin) {
    console.log(`ℹ️   Admin already exists (username=admin, id=${existingAdmin.id}) — skipping.`);
  } else {
    const adminHash = await bcrypt.hash('admin', SALT_ROUNDS);
    const admin = await prisma.user.create({
      data: {
        name:         'System Admin',
        username:     'admin',
        email:        'admin@abdulhaq.local',
        passwordHash: adminHash,
        role:         UserRole.admin,
        isActive:     true,
      },
    });
    console.log(`✅  Admin created  (username=admin, id=${admin.id})`);
  }

  // ── Worker ───────────────────────────────────────────────────────────────────
  const existingWorker = await prisma.user.findUnique({ where: { username: 'worker' } });
  if (existingWorker) {
    console.log(`ℹ️   Worker already exists (username=worker, id=${existingWorker.id}) — skipping.`);
  } else {
    const workerHash = await bcrypt.hash('worker', SALT_ROUNDS);
    const worker = await prisma.user.create({
      data: {
        name:         'Sales Worker',
        username:     'worker',
        email:        'worker@abdulhaq.local',
        passwordHash: workerHash,
        role:         UserRole.worker,
        isActive:     true,
      },
    });
    console.log(`✅  Worker created (username=worker, id=${worker.id})`);
  }

  console.log('\n🎉  Seeding complete.');
  console.log('\n📋  Login credentials (testing):');
  console.log('    Admin  → username: admin  / password: admin');
  console.log('    Worker → username: worker / password: worker');
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
