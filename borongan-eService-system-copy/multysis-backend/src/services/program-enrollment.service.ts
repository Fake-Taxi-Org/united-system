/**
 * program-enrollment.service.ts
 *
 * Pure helpers for picking beneficiaries from existing ACTIVE rows and enrolling
 * them into government programs (direct enrollment via pivot upsert, or pending
 * applications). Scripts in `scripts/` are thin wrappers around these.
 *
 * Prisma is injected as the first parameter to keep these functions pure and
 * trivially mockable — no global @prisma/client mocking needed in tests.
 */

export interface EnrollmentCandidate {
  residentId: string;
  beneficiaryId: string;
}

export interface EnrollmentPickOpts {
  programId: string;
  beneficiaryType: 'STUDENT' | 'SENIOR_CITIZEN';
  count: number;
  loadCandidates: () => Promise<EnrollmentCandidate[]>;
}

export interface ApplicationPick {
  residentId: string;
  beneficiaryId: string;
  applicationId: string;
}

export interface ApplicationPickOpts {
  programId: string;
  beneficiaryType: 'STUDENT' | 'SENIOR_CITIZEN';
  count: number;
  loadCandidates: () => Promise<EnrollmentCandidate[]>;
}

// Minimal Prisma surface we need — typed structurally so tests can use partial mocks.
type EnrollmentPrisma = {
  beneficiaryProgramPivot: {
    findMany: (args: any) => Promise<Array<{ beneficiaryId: string }>>;
    upsert: (args: any) => Promise<unknown>;
  };
  governmentProgramApplication: {
    findMany: (args: any) => Promise<Array<{ residentId: string }>>;
    create: (args: any) => Promise<{ id: string }>;
  };
};

export async function pickAndEnroll(
  prisma: EnrollmentPrisma,
  opts: EnrollmentPickOpts,
): Promise<Array<{ residentId: string; beneficiaryId: string; pivotAction: 'created' | 'already-exists' }>> {
  const candidates = await opts.loadCandidates();
  const beneficiaryIds = candidates.map((c) => c.beneficiaryId);
  // BULK-FETCH in one query — no N+1.
  const existingPivots = await prisma.beneficiaryProgramPivot.findMany({
    where: {
      beneficiaryType: opts.beneficiaryType,
      programId: opts.programId,
      beneficiaryId: { in: beneficiaryIds },
    },
    select: { beneficiaryId: true },
  });
  const alreadyPivoted = new Set(existingPivots.map((p) => p.beneficiaryId));
  const eligible = candidates.filter((c) => !alreadyPivoted.has(c.beneficiaryId));
  if (eligible.length < opts.count) {
    throw new Error(
      `Need ${opts.count} eligible ${opts.beneficiaryType} beneficiaries without existing pivot, only ${eligible.length} available`,
    );
  }
  const picked = eligible.slice(0, opts.count);
  const pickedIds = new Set(picked.map((p) => p.beneficiaryId));

  const results: Array<{ residentId: string; beneficiaryId: string; pivotAction: 'created' | 'already-exists' }> = [];
  for (const c of picked) {
    await prisma.beneficiaryProgramPivot.upsert({
      where: {
        bpp_type_id_program_key: {
          beneficiaryType: opts.beneficiaryType,
          beneficiaryId: c.beneficiaryId,
          programId: opts.programId,
        },
      },
      create: {
        beneficiaryType: opts.beneficiaryType,
        beneficiaryId: c.beneficiaryId,
        programId: opts.programId,
        status: 'active',
      },
      update: {},
    });
    results.push({
      residentId: c.residentId,
      beneficiaryId: c.beneficiaryId,
      pivotAction: pickedIds.has(c.beneficiaryId) ? 'created' : 'already-exists',
    });
  }
  return results;
}

export async function pickAndApply(
  prisma: EnrollmentPrisma,
  opts: ApplicationPickOpts,
): Promise<ApplicationPick[]> {
  const candidates = await opts.loadCandidates();
  const beneficiaryIds = candidates.map((c) => c.beneficiaryId);
  const residentIds = candidates.map((c) => c.residentId);

  // Two parallel bulk fetches.
  const [existingPivots, existingApps] = await Promise.all([
    prisma.beneficiaryProgramPivot.findMany({
      where: {
        beneficiaryType: opts.beneficiaryType,
        programId: opts.programId,
        beneficiaryId: { in: beneficiaryIds },
      },
      select: { beneficiaryId: true },
    }),
    prisma.governmentProgramApplication.findMany({
      where: {
        programId: opts.programId,
        status: { in: ['pending', 'approved'] },
        residentId: { in: residentIds },
      },
      select: { residentId: true },
    }),
  ]);
  const alreadyPivotedBeneficiary = new Set(existingPivots.map((p) => p.beneficiaryId));
  const alreadyAppliedResident = new Set(existingApps.map((a) => a.residentId));
  const eligible = candidates.filter(
    (c) => !alreadyPivotedBeneficiary.has(c.beneficiaryId) && !alreadyAppliedResident.has(c.residentId),
  );
  if (eligible.length < opts.count) {
    throw new Error(
      `Need ${opts.count} eligible ${opts.beneficiaryType} applicants (no pivot, no pending/approved application), only ${eligible.length} available`,
    );
  }
  const picked = eligible.slice(0, opts.count);
  const results: ApplicationPick[] = [];
  for (const c of picked) {
    const app = await prisma.governmentProgramApplication.create({
      data: {
        residentId: c.residentId,
        programId: opts.programId,
        status: 'pending',
        submittedData: {
          _imported: true,
          _source: 'add-pending-applications.ts',
          _importedAt: new Date().toISOString(),
        },
        attachments: [],
      },
    });
    results.push({ residentId: c.residentId, beneficiaryId: c.beneficiaryId, applicationId: app.id });
  }
  return results;
}
