/**
 * import-direkta-senior-beneficiaries.ts
 *
 * Directly enrolls 5 ACTIVE students into Direkta Ayuda + 5 ACTIVE seniors into
 * Senior Citizen Allowance by upserting beneficiary_program_pivots rows. Attaches
 * to existing residents only — does not create new residents or beneficiary rows.
 *
 * Pool: most recent ACTIVE beneficiary rows by created_at DESC, excluding any
 * already pivoted to the target program.
 *
 * Idempotent: re-running is a no-op for already-pivoted rows.
 *
 * Usage:
 *   cd borongan-eService-system-copy/multysis-backend
 *   npx ts-node scripts/import-direkta-senior-beneficiaries.ts
 */

import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { pickAndEnroll } from '../src/services/program-enrollment.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const DIREKTA_AYUDA_PROGRAM_ID = '00000501-0501-4001-8001-000000000003';
const SENIOR_ALLOWANCE_PROGRAM_ID = '00000501-0501-4001-8001-000000000004';
const COUNT = parseInt(process.env.PIVOT_COUNT ?? '5', 10);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Verify both programs exist + active
  for (const [name, id] of [
    ['Direkta Ayuda', DIREKTA_AYUDA_PROGRAM_ID],
    ['Senior Citizen Allowance', SENIOR_ALLOWANCE_PROGRAM_ID],
  ] as const) {
    const p = await prisma.governmentProgram.findUnique({ where: { id } });
    if (!p) throw new Error(`${name} (${id}) not found in government_programs`);
    if (!p.isActive) throw new Error(`${name} is not active`);
    console.log(`Program verified: ${p.name} (${p.id})`);
  }

  console.log(`\n--- Direkta Ayuda (${COUNT} students) ---`);
  const students = await pickAndEnroll(prisma, {
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
    console.log(`  resident=${s.residentId}  student=${s.beneficiaryId}  [${s.pivotAction}]`),
  );

  console.log(`\n--- Senior Citizen Allowance (${COUNT} seniors) ---`);
  const seniors = await pickAndEnroll(prisma, {
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
    console.log(`  resident=${s.residentId}  senior=${s.beneficiaryId}  [${s.pivotAction}]`),
  );

  console.log(`\nDone. ${students.length + seniors.length} pivots touched.`);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });