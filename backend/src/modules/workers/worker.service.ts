/**
 * Workers Service
 * Admin-only: create, list, update, disable workers and reset passwords.
 */

import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// ── List all workers with basic sales stats ───────────────────────────────────
export const getAllWorkers = async () => {
  const workers = await prisma.user.findMany({
    where: { role: 'worker' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      cnic: true,
      phone: true,
      joinDate: true,
      createdAt: true,
      _count: { select: { billsCreated: true } },
    },
  });

  // Aggregate total revenue per worker
  const revenues = await prisma.bill.groupBy({
    by: ['workerId'],
    _sum: { total: true, paidAmount: true, pendingAmount: true },
    _count: { id: true },
  });

  const revenueMap = new Map(revenues.map((r) => [r.workerId, r]));

  return workers.map((w) => {
    const rev = revenueMap.get(w.id);
    return {
      ...w,
      totalBills: rev?._count.id ?? 0,
      totalRevenue: rev?._sum.total ? Number(rev._sum.total) : 0,
      totalPaid: rev?._sum.paidAmount ? Number(rev._sum.paidAmount) : 0,
      totalPending: rev?._sum.pendingAmount ? Number(rev._sum.pendingAmount) : 0,
    };
  });
};

// ── Get single worker with sales detail ──────────────────────────────────────
export const getWorkerById = async (id: string) => {
  const worker = await prisma.user.findUnique({
    where: { id, role: 'worker' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      cnic: true,
      phone: true,
      joinDate: true,
      createdAt: true,
      billsCreated: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          retailer: { select: { shopName: true, ownerName: true } },
          items: { include: { product: { select: { brand: true, variant: true } } } },
        },
      },
    },
  });

  if (!worker) throw new Error('WORKER_NOT_FOUND');

  const totalRevenue = worker.billsCreated.reduce((s, b) => s + Number(b.total), 0);
  const totalDiscounts = worker.billsCreated.reduce((s, b) => s + Number(b.discount), 0);
  const totalPending = worker.billsCreated.reduce((s, b) => s + Number(b.pendingAmount), 0);

  return { ...worker, totalRevenue, totalDiscounts, totalPending };
};

// ── Create worker ─────────────────────────────────────────────────────────────
export const createWorker = async (data: {
  name: string;
  email: string;
  password: string;
  cnic?: string;
  phone?: string;
  joinDate?: string;
}) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error('EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const worker = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'worker',
      isActive: true,
      cnic: data.cnic,
      phone: data.phone,
      joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
    },
    select: {
      id: true, name: true, email: true, role: true,
      isActive: true, cnic: true, phone: true, joinDate: true, createdAt: true,
    },
  });

  return worker;
};

// ── Update worker (profile / status) ─────────────────────────────────────────
export const updateWorker = async (
  id: string,
  data: { name?: string; cnic?: string; phone?: string; joinDate?: string; isActive?: boolean }
) => {
  const worker = await prisma.user.findUnique({ where: { id, role: 'worker' } });
  if (!worker) throw new Error('WORKER_NOT_FOUND');

  return prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      cnic: data.cnic,
      phone: data.phone,
      isActive: data.isActive,
      joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
    },
    select: {
      id: true, name: true, email: true, role: true,
      isActive: true, cnic: true, phone: true, joinDate: true, createdAt: true,
    },
  });
};

// ── Reset worker password (admin only) ────────────────────────────────────────
export const resetWorkerPassword = async (id: string, newPassword: string) => {
  const worker = await prisma.user.findUnique({ where: { id, role: 'worker' } });
  if (!worker) throw new Error('WORKER_NOT_FOUND');

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  return { success: true, message: 'Password reset successfully.' };
};
