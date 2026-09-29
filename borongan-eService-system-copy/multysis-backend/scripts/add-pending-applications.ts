/**
 * add-pending-applications.ts
 *
 * Creates 2 pending Direkta Ayuda applications + 2 pending Senior Citizen Allowance
 * applications for residents who already have ACTIVE beneficiary rows but do NOT
 * yet have a pivot row or existing application for the target program.
 *
 * NOT idempotent — re-running will fail with a count-shortage error (the eligible
 * pool shrinks each run). To re-run, manually delete the previous batch from
 * government_program_applications first.
 *
 * Usage:
 *   cd borongan-eService-system-copy/multysis-backend
 *   npx ts-node scripts/add-pending-applications.ts
 */

import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { pickAndApply } from '../src/services/program-enrollment.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const DIREKTA_AYUDA_PROGRAM_ID = '00000501-0501-4001-8001-000000000003';
const SENIOR_ALLOWANCE_PROGRAM_ID = '00000501-0501-4001-8001-000000000004';
const COUNT = parseInt(process.env.APP_COUNT ?? '2', 10);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  for (const [name, id] of [
    ['Direkta Ayuda', DIREKTA_AYUDA_PROGRAM_ID],
    ['Senior Citizen Allowance', SENIOR_ALLOWANCE_PROGRAM_ID],
  ] as const) {
    const p = await prisma.governmentProgram.findUnique({ where: { id } });
    if (!p) throw new Error(`${name} (${id}) not found in government_programs`);
    if (!p.isActive) throw new Error(`${name} is not active`);
    console.log(`Program verified: ${p.name} (${p.id})`);
  }

  console.log(`\n--- ${COUNT} pending Direkta Ayuda applications ---`);
  const students = await pickAndApply(prisma, {
    programId: DIREKTA_AYUDA_PROGRAM_ID,
    beneficiaryType: 'STUDENT',
    count: COUNT,
    loadCandidates: async () => {
      const rows = await prisma.studentBeneficiary.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { residentId: true, studentId: true },
      });
      return rows.map((r) => ({ residentId: r.residentId, beneficiaryId: r.studentId }));
    },
  });
  students.forEach((s) =>
    console.log(`  resident=${s.residentId}  student=${s.beneficiaryId}  app=${s.applicationId}`),
  );

  console.log(`\n--- ${COUNT} pending Senior Citizen Allowance applications ---`);
  const seniors = await pickAndApply(prisma, {
    programId: SENIOR_ALLOWANCE_PROGRAM_ID,
    beneficiaryType: 'SENIOR_CITIZEN',
    count: COUNT,
    loadCandidates: async () => {
      const rows = await prisma.seniorCitizenBeneficiary.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { residentId: true, seniorCitizenId: true },
      });
      return rows.map((r) => ({ residentId: r.residentId, beneficiaryId: r.seniorCitizenId }));
    },
  });
  seniors.forEach((s) =>
    console.log(`  resident=${s.residentId}  senior=${s.beneficiaryId}  app=${s.applicationId}`),
  );

  console.log(`\nDone. ${students.length + seniors.length} applications created.`);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });