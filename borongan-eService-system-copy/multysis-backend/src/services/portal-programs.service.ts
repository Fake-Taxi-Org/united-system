import { GovernmentProgramType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { emitProgramApplicationNew, emitProgramApplicationReview } from './socket.service';
import { getLibreSakaySupabase } from '../config/libre-sakay-supabase';

const LIBRE_SAKAY_PROGRAM_ID = 'gp-all-libre-sakay';

type ProgramTypeValue = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT' | 'SOLO_PARENT' | 'HEALTHCARE_WORKER' | 'ALL';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineCategory(
  senior: { seniorCitizenId: string | null } | null,
  pwd: { pwdId: string | null } | null,
  student: { studentId: string | null } | null,
  soloParent: { soloParentId: string | null } | null,
  healthcareWorker: { healthcareWorkerId: string | null } | null,
): { type: string; id: string } | null {
  if (senior?.seniorCitizenId) return { type: 'SENIOR_CITIZEN', id: senior.seniorCitizenId };
  if (pwd?.pwdId) return { type: 'PWD', id: pwd.pwdId };
  if (student?.studentId) return { type: 'STUDENT', id: student.studentId };
  if (soloParent?.soloParentId) return { type: 'SOLO_PARENT', id: soloParent.soloParentId };
  if (healthcareWorker?.healthcareWorkerId) return { type: 'HEALTHCARE_WORKER', id: healthcareWorker.healthcareWorkerId };
  return null;
}

function mapEnrollmentStatus(status: string | null | undefined): 'ACTIVE' | 'INACTIVE' | 'PENDING' {
  if (status === 'active') return 'ACTIVE';
  if (status === 'suspended') return 'INACTIVE';
  return 'PENDING';
}

// ---------------------------------------------------------------------------
// Eligibility check
// A resident is eligible if:
//   - program.types includes ALL (open to every active resident), OR
//   - program.types includes a type the resident has an ACTIVE beneficiary for
// ---------------------------------------------------------------------------
async function getResidentEligibleTypes(residentId: string): Promise<Set<ProgramTypeValue>> {
  const eligible = new Set<ProgramTypeValue>();

  const [senior, pwd, student, soloParent, healthcareWorker] = await Promise.all([
    prisma.seniorCitizenBeneficiary.findUnique({
      where: { residentId },
      select: { status: true },
    }),
    prisma.pWDBeneficiary.findUnique({
      where: { residentId },
      select: { status: true },
    }),
    prisma.studentBeneficiary.findUnique({
      where: { residentId },
      select: { status: true },
    }),
    prisma.soloParentBeneficiary.findUnique({
      where: { residentId },
      select: { status: true },
    }),
    prisma.healthcareWorkerBeneficiary.findUnique({
      where: { residentId },
      select: { status: true },
    }),
  ]);

  if (senior?.status === 'ACTIVE') eligible.add('SENIOR_CITIZEN');
  if (pwd?.status === 'ACTIVE') eligible.add('PWD');
  if (student?.status === 'ACTIVE') eligible.add('STUDENT');
  if (soloParent?.status === 'ACTIVE') eligible.add('SOLO_PARENT');
  if (healthcareWorker?.status === 'ACTIVE') eligible.add('HEALTHCARE_WORKER');

  return eligible;
}

function isEligible(
  programTypes: GovernmentProgramType[],
  eligibleTypes: Set<ProgramTypeValue>
): boolean {
  return programTypes.some((t) => t === 'ALL' || eligibleTypes.has(t as ProgramTypeValue));
}

// ---------------------------------------------------------------------------
// List programs with per-resident eligibility & application status
// ---------------------------------------------------------------------------
export const listProgramsForResident = async (
  residentId: string | null,
  params?: { search?: string; type?: string; name?: string; page?: number; limit?: number }
) => {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const limit = Math.min(params?.limit && params.limit > 0 ? params.limit : 12, 50);
  const skip = (page - 1) * limit;

  const typeFilter =
    params?.type && params.type !== 'all' ? (params.type as GovernmentProgramType) : undefined;
  const searchFilter = params?.search?.trim() || undefined;
  const nameFilter = params?.name?.trim() || undefined;

  const where: any = { isActive: true };
  if (typeFilter) where.types = { has: typeFilter };
  if (nameFilter) {
    where.name = { equals: nameFilter, mode: 'insensitive' };
  } else if (searchFilter) {
    where.OR = [
      { name: { contains: searchFilter, mode: 'insensitive' } },
      { description: { contains: searchFilter, mode: 'insensitive' } },
    ];
  }

  // When unauthenticated, skip per-resident DB queries entirely
  const residentQueries = residentId
    ? Promise.all([
        prisma.governmentProgramApplication.findMany({
          where: { residentId },
          select: { programId: true, status: true, adminNotes: true },
        }),
        getResidentEligibleTypes(residentId),
        // Fetch classification records to determine beneficiaryType
        prisma.resident.findUnique({
          where: { id: residentId },
          select: {
            seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
            pwdBeneficiary: { select: { pwdId: true } },
            studentBeneficiary: { select: { studentId: true } },
            soloParentBeneficiary: { select: { soloParentId: true } },
            healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
          },
        }),
      ])
    : Promise.resolve([[], new Set<ProgramTypeValue>(), null] as const);

  const [programs, total, [applications, eligibleTypes, classifications]] = await Promise.all([
    prisma.governmentProgram.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.governmentProgram.count({ where }),
    residentQueries,
  ]);

  const appMap = new Map(
    (applications as { programId: string; status: string; adminNotes: string | null }[]).map((a) => [
      a.programId,
      { status: a.status, adminNotes: a.adminNotes },
    ])
  );

  // Determine the resident's beneficiaryType from their classification records
  const categoryEntry = classifications
    ? determineCategory(
        classifications.seniorCitizenBeneficiary,
        classifications.pwdBeneficiary,
        classifications.studentBeneficiary,
        classifications.soloParentBeneficiary,
        classifications.healthcareWorkerBeneficiary,
      )
    : null;

  // Batch-fetch pivot rows for all approved Libre Sakay applications
  const libreSakayApprovedAppEntries = (
    applications as { programId: string; status: string; adminNotes: string | null }[]
  ).filter((a) => a.programId === LIBRE_SAKAY_PROGRAM_ID && a.status === 'approved');
  let pivotStatusMap: Map<string, { status: string | null; suspendedAt: Date | null }> = new Map();
  if (libreSakayApprovedAppEntries.length > 0 && categoryEntry) {
    const pivotRows = await prisma.beneficiaryProgramPivot.findMany({
      where: {
        programId: LIBRE_SAKAY_PROGRAM_ID,
        beneficiaryType: categoryEntry.type as any,
        beneficiaryId: categoryEntry.id,
      },
      select: { status: true, suspendedAt: true },
    });
    for (const p of pivotRows) {
      pivotStatusMap.set(LIBRE_SAKAY_PROGRAM_ID, { status: p.status, suspendedAt: p.suspendedAt });
    }
  }

  const data = programs.map((program) => {
    const appInfo = appMap.get(program.id) ?? null;
    const applicationStatus = appInfo?.status ?? null;
    const adminNotes = appInfo?.adminNotes ?? null;
    // Unauthenticated visitors get eligible: false — no apply action shown
    const eligible = residentId ? isEligible(program.types, eligibleTypes) : false;

    // Determine beneficiaryStatus and suspendedAt for Libre Sakay approved applications
    let beneficiaryStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING' | null = null;
    let suspendedAt: string | null = null;
    if (program.id === LIBRE_SAKAY_PROGRAM_ID && applicationStatus === 'approved') {
      const pivot = pivotStatusMap.get(LIBRE_SAKAY_PROGRAM_ID);
      if (pivot) {
        beneficiaryStatus = mapEnrollmentStatus(pivot.status);
        suspendedAt = pivot.suspendedAt ? pivot.suspendedAt.toISOString() : null;
      }
    }

    return {
      id: program.id,
      name: program.name,
      description: program.description,
      requirements: program.requirements,
      types: program.types,
      isActive: program.isActive,
      eligible,
      applicationStatus: applicationStatus as
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'cancelled'
        | null,
      adminNotes,
      beneficiaryStatus,
      suspendedAt,
    };
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ---------------------------------------------------------------------------
// Get single program with eligibility for the resident
// ---------------------------------------------------------------------------
export const getProgramForResident = async (programId: string, residentId: string) => {
  const [program, application, eligibleTypes] = await Promise.all([
    prisma.governmentProgram.findUnique({ where: { id: programId } }),
    prisma.governmentProgramApplication.findUnique({
      where: { residentId_programId: { residentId, programId } },
      select: { status: true, adminNotes: true, appliedAt: true },
    }),
    getResidentEligibleTypes(residentId),
  ]);

  if (!program || !program.isActive) {
    throw new Error('Program not found or inactive');
  }

  return {
    ...program,
    eligible: isEligible(program.types, eligibleTypes),
    applicationStatus: application?.status ?? null,
    adminNotes: application?.adminNotes ?? null,
    appliedAt: application?.appliedAt ?? null,
  };
};

// ---------------------------------------------------------------------------
// Apply for a program
// ---------------------------------------------------------------------------
export const applyForProgram = async (
  residentId: string,
  programId: string,
  submission: { submittedData?: Record<string, string>; attachments?: object[] } = {}
) => {
  // Verify resident is active
  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { status: true },
  });

  if (!resident || resident.status !== 'active') {
    throw new Error('Only active residents can apply for programs');
  }

  const program = await prisma.governmentProgram.findUnique({
    where: { id: programId },
    select: { id: true, isActive: true, types: true, name: true },
  });

  if (!program || !program.isActive) {
    throw new Error('Program not found or inactive');
  }

  // Check eligibility
  const eligibleTypes = await getResidentEligibleTypes(residentId);
  if (!isEligible(program.types, eligibleTypes)) {
    throw new Error('You are not eligible for this program');
  }

  // Check for existing non-cancelled application
  const existing = await prisma.governmentProgramApplication.findUnique({
    where: { residentId_programId: { residentId, programId } },
  });

  if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
    throw new Error('You already have an active application for this program');
  }

  // Upsert: if cancelled/rejected, restart application
  if (existing) {
    const result = await prisma.governmentProgramApplication.update({
      where: { id: existing.id },
      data: {
        status: 'pending',
        adminNotes: null,
        submittedData: submission.submittedData ?? {},
        attachments: submission.attachments ?? [],
        appliedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
      },
    });
    await emitProgramApplicationNew({
      applicationId: result.id,
      programId,
      programName: program.name,
      residentId,
      appliedAt: result.appliedAt.toISOString(),
    });
    return result;
  }

  try {
    const result = await prisma.governmentProgramApplication.create({
      data: {
        residentId,
        programId,
        status: 'pending',
        submittedData: submission.submittedData ?? {},
        attachments: submission.attachments ?? [],
      },
    });
    await emitProgramApplicationNew({
      applicationId: result.id,
      programId,
      programName: program.name,
      residentId,
      appliedAt: result.appliedAt.toISOString(),
    });
    return result;
  } catch (err) {
    // Concurrent insert (race between the check above and the insert)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('You already have an active application for this program');
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Get resident's own applications
// ---------------------------------------------------------------------------
export const getMyApplications = async (residentId: string) => {
  return prisma.governmentProgramApplication.findMany({
    where: { residentId },
    include: {
      program: {
        select: { id: true, name: true, description: true, types: true },
      },
    },
    orderBy: [{ appliedAt: 'desc' }],
  });
};

// ---------------------------------------------------------------------------
// Cancel a pending application
// ---------------------------------------------------------------------------
export const cancelApplication = async (applicationId: string, residentId: string) => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  if (application.residentId !== residentId) {
    throw new Error('Unauthorized');
  }

  if (application.status !== 'pending') {
    throw new Error('Only pending applications can be cancelled');
  }

  return prisma.governmentProgramApplication.update({
    where: { id: applicationId },
    data: { status: 'cancelled' },
  });
};

// ---------------------------------------------------------------------------
// ADMIN: List all applications with filters
// ---------------------------------------------------------------------------
export const listApplicationsAdmin = async (filters: {
  status?: string;
  programId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = Math.min(filters.limit && filters.limit > 0 ? filters.limit : 20, 100);
  const skip = (page - 1) * limit;

  const where: any = {};

  const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
  if (filters.status && (ALLOWED_STATUSES as readonly string[]).includes(filters.status)) {
    where.status = filters.status;
  }
  if (filters.programId) where.programId = filters.programId;
  if (filters.search) {
    where.resident = {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { middleName: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
  }

  const [data, total] = await Promise.all([
    prisma.governmentProgramApplication.findMany({
      where,
      include: {
        resident: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            extensionName: true,
            picturePath: true,
            barangay: { select: { barangayName: true } },
          },
        },
        program: {
          select: { id: true, name: true, types: true },
        },
      },
      orderBy: [{ appliedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.governmentProgramApplication.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ---------------------------------------------------------------------------
// ADMIN: Get single application detail
// ---------------------------------------------------------------------------
export const getApplicationAdmin = async (applicationId: string) => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id: applicationId },
    include: {
      resident: {
        include: {
          barangay: { select: { barangayName: true } },
          seniorCitizenBeneficiary: { select: { status: true, seniorCitizenId: true } },
          pwdBeneficiary: { select: { status: true, pwdId: true } },
          studentBeneficiary: { select: { status: true, studentId: true } },
          soloParentBeneficiary: { select: { status: true, soloParentId: true } },
          healthcareWorkerBeneficiary: { select: { status: true, healthcareWorkerId: true } },
        },
      },
      program: true,
      reviewedByUser: { select: { id: true, name: true } },
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  return application;
};

// ---------------------------------------------------------------------------
// Sync a Libre Sakay beneficiary to the Libre Sakay Supabase project.
// Called after an application for a Libre Sakay program is approved.
// Errors are logged but never thrown — sync failure must not block approval.
// ---------------------------------------------------------------------------
async function syncLibreSakayBeneficiary(
  residentUuid: string,
  displayResidentId: string | null,
  approvedAt: Date,
  identity: { fullName: string; picturePath: string | null } | null = null
): Promise<void> {
  // The QR code encodes displayResidentId if available, else the UUID
  const qrId = displayResidentId || residentUuid;
  try {
    const supabase = getLibreSakaySupabase();
    const payload: Record<string, unknown> = {
      resident_id: qrId,
      resident_uuid: residentUuid,
      approved_at: approvedAt.toISOString(),
      synced_at: new Date().toISOString(),
    };
    if (identity) {
      payload.full_name = identity.fullName;
      payload.picture_path = identity.picturePath;
    }
    const { error } = await supabase
      .from('libre_sakay_beneficiary')
      .upsert(payload, { onConflict: 'resident_id' });
    if (error) {
      console.error('[libre-sakay-sync] Supabase upsert error:', error.message);
    }
  } catch (err) {
    console.error('[libre-sakay-sync] Unexpected error:', err);
  }
}

async function removeLibreSakayBeneficiary(residentUuid: string): Promise<void> {
  try {
    const supabase = getLibreSakaySupabase();
    const { error } = await supabase
      .from('libre_sakay_beneficiary')
      .delete()
      .eq('resident_uuid', residentUuid);
    if (error) {
      console.error('[libre-sakay-sync] Delete error:', error.message);
    }
  } catch (err) {
    console.error('[libre-sakay-sync] Unexpected error on remove:', err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: Approve or reject an application
// ---------------------------------------------------------------------------
export const reviewApplicationAdmin = async (
  applicationId: string,
  action: 'approve' | 'reject',
  adminId: string,
  adminNotes?: string
) => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id: applicationId },
    include: {
      program: { select: { types: true, name: true } },
      resident: {
        select: {
          id: true,
          residentId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          extensionName: true,
          picturePath: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Only pending applications can be reviewed');
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { residentId, programId } = application;
  const programTypes = (application.program.types as string[] | null) ?? [];

  // For ALL-type programs, enroll across all existing beneficiary records
  const typesToEnroll = programTypes.includes('ALL')
    ? (['SENIOR_CITIZEN', 'PWD', 'STUDENT', 'SOLO_PARENT', 'HEALTHCARE_WORKER'] as const)
    : (programTypes as ('SENIOR_CITIZEN' | 'PWD' | 'STUDENT' | 'SOLO_PARENT' | 'HEALTHCARE_WORKER')[]);

  // Typed lookup map — no `as any` on the Prisma client
  type BeneficiaryType = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT' | 'SOLO_PARENT' | 'HEALTHCARE_WORKER';
  type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  // NOTE: beneficiaryId must be the human-readable ID (seniorCitizenId, pwdId, etc.)
  // NOT the internal UUID id — pivot table stores the human-readable IDs.
  const beneficiaryLookup: Record<
    BeneficiaryType,
    (rid: string, tx: TxClient) => Promise<{ id: string | null } | null>
  > = {
    SENIOR_CITIZEN: async (rid, tx) => {
      const r = await tx.seniorCitizenBeneficiary.findUnique({ where: { residentId: rid }, select: { seniorCitizenId: true } });
      return r ? { id: r.seniorCitizenId } : null;
    },
    PWD: async (rid, tx) => {
      const r = await tx.pWDBeneficiary.findUnique({ where: { residentId: rid }, select: { pwdId: true } });
      return r ? { id: r.pwdId } : null;
    },
    STUDENT: async (rid, tx) => {
      const r = await tx.studentBeneficiary.findUnique({ where: { residentId: rid }, select: { studentId: true } });
      return r ? { id: r.studentId } : null;
    },
    SOLO_PARENT: async (rid, tx) => {
      const r = await tx.soloParentBeneficiary.findUnique({ where: { residentId: rid }, select: { soloParentId: true } });
      return r ? { id: r.soloParentId } : null;
    },
    HEALTHCARE_WORKER: async (rid, tx) => {
      const r = await tx.healthcareWorkerBeneficiary.findUnique({ where: { residentId: rid }, select: { healthcareWorkerId: true } });
      return r ? { id: r.healthcareWorkerId } : null;
    },
  };

  // Wrap status update + pivot creation in a single transaction so partial
  // failure rolls back both — no "approved" application with missing pivots
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.governmentProgramApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        adminNotes: adminNotes || null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });

    if (action === 'approve') {
      // Parallel beneficiary lookups — eliminates N+1 serial queries
      const lookupResults = await Promise.all(
        typesToEnroll.map(async (type) => ({
          type,
          beneficiary: await beneficiaryLookup[type as BeneficiaryType](residentId, tx),
        }))
      );

      // Parallel upserts for all existing beneficiary records
      const upsertResults = await Promise.allSettled(
        lookupResults
          .filter((r): r is { type: string; beneficiary: { id: string } } => r.beneficiary !== null && r.beneficiary.id !== null)
          .map(({ type, beneficiary }) =>
            tx.beneficiaryProgramPivot.upsert({
              where: {
                bpp_type_id_program_key: {
                  beneficiaryType: type as BeneficiaryType,
                  beneficiaryId: beneficiary.id,
                  programId,
                },
              },
              update: {},
              create: {
                beneficiaryType: type as BeneficiaryType,
                beneficiaryId: beneficiary.id,
                programId,
              },
            })
          )
      );

      const failed = upsertResults.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('[portal-programs] pivot upsert failed:', failed.map((f) => (f as PromiseRejectedResult).reason));
      }
    }

    return updated;
  });

  // Notify resident via socket after the transaction commits
  await emitProgramApplicationReview(residentId, {
    applicationId,
    programId,
    programName: application.program.name,
    status: newStatus as 'approved' | 'rejected',
    adminNotes: adminNotes || undefined,
    reviewedAt: new Date().toISOString(),
  });

  // Sync to Libre Sakay Supabase if this is a Libre Sakay program
  const isLibreSakay = application.program.name.toLowerCase().includes('libre sakay');
  if (isLibreSakay) {
    if (action === 'approve') {
      const r = application.resident;
      const fullName = [r.firstName, r.middleName, r.lastName, r.extensionName]
        .filter(Boolean)
        .join(' ');
      await syncLibreSakayBeneficiary(
        r.id,
        r.residentId ?? null,
        result.reviewedAt ?? new Date(),
        { fullName, picturePath: r.picturePath ?? null }
      );
    } else {
      // Rejected — remove from beneficiary list if previously approved
      await removeLibreSakayBeneficiary(application.resident.id);
    }
  }

  return result;
};
