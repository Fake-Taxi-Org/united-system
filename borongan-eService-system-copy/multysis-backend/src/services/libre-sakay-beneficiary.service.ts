import prisma from '../config/database';
import { Prisma, BeneficiaryType } from '@prisma/client';

const LIBRE_SAKAY_PROGRAM_ID = 'gp-all-libre-sakay';

// =============================================================================
// TYPES
// =============================================================================

export interface BeneficiaryListItem {
  id: string;
  residentId: string;
  fullName: string;
  residentIdNumber: string;
  category: BeneficiaryType | 'N/A';
  barangay: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  suspendedAt: string | null;
  enrolledAt: Date;
  applicationId: string;
  appliedAt: Date;
  reviewedAt: Date | null;
}

export interface BeneficiaryDetails extends BeneficiaryListItem {
  picturePath: string | null;
  middleName: string | null;
  extensionName: string | null;
  birthdate: Date | null;
  sex: string | null;
  address: string;
  contactNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  submittedData: Record<string, any>;
  attachments: Record<string, any>;
  adminNotes: string | null;
  libreBeneficiaryId: string | null;
  passNumber: string | null;
  passExpiry: Date | null;
  totalRides: number;
  lastRideDate: Date | null;
  reviewedByName: string | null;
  // --- NEW FIELDS ---
  firstName: string;
  lastName: string;
  email: string | null;
  age: number | null;
  disabilityType: string | null;
  disabilityLevel: string | null;

}

export interface BeneficiaryCounts {
  all: number;
  active: number;
  suspended: number;
}

export interface PaginatedBeneficiaries {
  data: BeneficiaryListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /**
   * Unfiltered (no search, no status filter) counts broken down by enrollment
   * status. Always reflects the full database state for the Libre Sakay program,
   * so the pill tabs in the admin UI show stable totals regardless of the
   * currently selected filter or search query.
   */
  counts: BeneficiaryCounts;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export interface BeneficiaryExportItem {
  residentId: string;
  fullName: string;
  residentIdNumber: string;
  category: string;
  beneficiaryTypeLabel: string;
  disabilityType: string | null;
  email: string | null;
  address: string;
  birthdate: string | null;
  age: number | null;
  sex: string | null;
  remarks: string | null;
  appliedAt: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  SENIOR_CITIZEN: 'Senior Citizen',
  PWD: 'Person with Disability',
  STUDENT: 'Student',
  SOLO_PARENT: 'Solo Parent',
  HEALTHCARE_WORKER: 'Healthcare Worker',
  'N/A': 'N/A',
};

// =============================================================================
// HELPERS
// =============================================================================

function buildFullName(first: string, middle: string | null, last: string, extension: string | null): string {
  const parts = [first];
  if (middle) parts.push(middle);
  parts.push(last);
  if (extension) parts.push(extension);
  return parts.join(' ');
}

function computeAge(birthdate: Date | null): number | null {
  if (!birthdate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
  return age;
}

function determineCategory(
  senior: { seniorCitizenId: string | null } | null,
  pwd: { pwdId: string | null } | null,
  student: { studentId: string | null } | null,
  soloParent: { soloParentId: string | null } | null,
  healthcareWorker: { healthcareWorkerId: string | null } | null,
): { type: BeneficiaryType; id: string } | null {
  if (senior?.seniorCitizenId) return { type: 'SENIOR_CITIZEN', id: senior.seniorCitizenId };
  if (pwd?.pwdId) return { type: 'PWD', id: pwd.pwdId };
  if (student?.studentId) return { type: 'STUDENT', id: student.studentId };
  if (soloParent?.soloParentId) return { type: 'SOLO_PARENT', id: soloParent.soloParentId };
  if (healthcareWorker?.healthcareWorkerId) return { type: 'HEALTHCARE_WORKER', id: healthcareWorker.healthcareWorkerId };
  return null;
}

/** Map pivot status string to enrollment status enum */
function mapEnrollmentStatus(status: string | null | undefined): 'ACTIVE' | 'INACTIVE' | 'PENDING' {
  if (status === 'active') return 'ACTIVE';
  if (status === 'suspended') return 'INACTIVE';
  return 'PENDING';
}

// =============================================================================
// LIST BENEFICIARIES
// =============================================================================

/**
 * Builds the resident-name/id OR-clause used for beneficiary search, shared
 * by listBeneficiaries and getStatusCounts so both filter identically.
 */
function buildResidentSearch(query: string) {
  return {
    OR: [
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
      { middleName: { contains: query, mode: 'insensitive' } },
      { residentId: { contains: query, mode: 'insensitive' } },
    ],
  };
}

/**
 * Counts Libre Sakay beneficiaries by enrollment status. Returns the
 * unfiltered totals (all / active / suspended) so the admin UI pill tabs
 * can show stable counts regardless of the currently-selected filter.
 * Pass `search` to restrict the count to residents matching that query
 * (used for search-aware pagination totals on filtered tabs).
 *
 * Implementation: two indexed queries (one for applications + their
 * category ids, one for all pivots in the program), then a small in-memory
 * join to determine each application's effective status.
 */
async function getStatusCounts(programId: string, search?: string): Promise<BeneficiaryCounts> {
  const appsWhere: any = { programId, status: 'approved' };
  if (search?.trim()) {
    appsWhere.resident = buildResidentSearch(search.trim());
  }
  const [apps, pivots] = await Promise.all([
    prisma.governmentProgramApplication.findMany({
      where: appsWhere,
      select: {
        id: true,
        resident: {
          select: {
            seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
            pwdBeneficiary: { select: { pwdId: true } },
            studentBeneficiary: { select: { studentId: true } },
            soloParentBeneficiary: { select: { soloParentId: true } },
            healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
          },
        },
      },
    }),
    prisma.beneficiaryProgramPivot.findMany({
      where: { programId },
      select: { beneficiaryType: true, beneficiaryId: true, status: true },
    }),
  ]);

  const pivotMap = new Map<string, string>();
  for (const p of pivots) {
    pivotMap.set(`${p.beneficiaryType}:${p.beneficiaryId}`, p.status ?? 'active');
  }

  let all = 0;
  let active = 0;
  let suspended = 0;
  for (const app of apps) {
    const cat = determineCategory(
      app.resident.seniorCitizenBeneficiary,
      app.resident.pwdBeneficiary,
      app.resident.studentBeneficiary,
      app.resident.soloParentBeneficiary,
      app.resident.healthcareWorkerBeneficiary,
    );
    if (!cat) {
      // No category → no enrollment pivot; counts as "all" only.
      all++;
      continue;
    }
    const pivotStatus = pivotMap.get(`${cat.type}:${cat.id}`);
    if (pivotStatus === 'suspended') {
      suspended++;
    } else {
      active++;
    }
    all++;
  }
  return { all, active, suspended };
}

export const listBeneficiaries = async (
  filter: 'all' | 'active' | 'suspended' = 'all',
  page = 1,
  limit = 20,
  search?: string,
  sortBy: 'name' | 'date' = 'date',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<PaginatedBeneficiaries> => {
  const skip = (page - 1) * limit;

  // Look up Libre-Sakay program dynamically from DB
  const program = await prisma.governmentProgram.findFirst({
    where: { name: { mode: 'insensitive', contains: 'Libre Sakay' }, isActive: true },
    select: { id: true },
  });

  const emptyResult = (counts: BeneficiaryCounts = { all: 0, active: 0, suspended: 0 }): PaginatedBeneficiaries => ({
    data: [],
    total: 0,
    page,
    limit,
    totalPages: 0,
    counts,
  });

  if (!program) {
    return emptyResult();
  }

  const programId = program.id;

  // Base filter: approved applications for Libre-Sakay
  const baseWhere: any = {
    programId,
    status: 'approved',
  };

  if (search) {
    const trimmed = search.trim();
    if (trimmed) {
      baseWhere.resident = buildResidentSearch(trimmed);
    }
  }

  // First fetch: get the (filter+search)-matching apps and the unfiltered counts.
  // We need counts regardless of filter/search so the pill badges stay stable.
  // When a status filter is combined with a search, re-count against the search
  // so pagination totals reflect the narrowed set (the pill badges stay unfiltered).
  const searchKey = search?.trim() || undefined;
  const needsFilteredCounts = filter !== 'all' && !!searchKey;
  const [counts, rows, baseCount, filteredCounts] = await Promise.all([
    getStatusCounts(programId),
    prisma.governmentProgramApplication.findMany({
      where: baseWhere,
      include: {
        resident: {
          include: {
            barangay: { select: { barangayName: true, municipality: true } },
            seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
            pwdBeneficiary: { select: { pwdId: true } },
            studentBeneficiary: { select: { studentId: true } },
            soloParentBeneficiary: { select: { soloParentId: true } },
            healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
          },
        },
      },
      orderBy: (() => {
        if (sortBy === 'name') {
          return { resident: { lastName: sortOrder } };
        }
        return { reviewedAt: { sort: sortOrder, nulls: 'last' } };
      })(),
      skip,
      take: limit,
    }),
    prisma.governmentProgramApplication.count({ where: baseWhere }),
    needsFilteredCounts ? getStatusCounts(programId, searchKey) : Promise.resolve(null),
  ]);

  const filteredTotal =
    filter === 'all'
      ? baseCount
      : filter === 'active'
      ? (filteredCounts ?? counts).active
      : (filteredCounts ?? counts).suspended;

  if (rows.length === 0) {
    return {
      data: [],
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit),
      counts,
    };
  }

  // Determine category for each row, then batch-fetch their pivot rows
  const categoryEntries: Array<{ applicationId: string; cat: { type: string; id: string } }> = [];
  for (const row of rows) {
    const r = row.resident;
    const cat = determineCategory(
      r.seniorCitizenBeneficiary,
      r.pwdBeneficiary,
      r.studentBeneficiary,
      r.soloParentBeneficiary,
      r.healthcareWorkerBeneficiary,
    );
    if (cat) {
      categoryEntries.push({ applicationId: row.id, cat });
    }
  }

  // Batch-fetch all relevant pivot rows using Prisma ORM
  let pivotMap = new Map<string, { status: string | null; suspendedAt: Date | null }>();
  if (categoryEntries.length > 0) {
    const pivotRows = await prisma.beneficiaryProgramPivot.findMany({
      where: {
        programId,
        OR: categoryEntries.map((e) => ({
          beneficiaryType: e.cat.type as BeneficiaryType,
          beneficiaryId: e.cat.id,
        })),
      },
      select: { beneficiaryType: true, beneficiaryId: true, status: true, suspendedAt: true },
    });

    for (const p of pivotRows) {
      pivotMap.set(`${p.beneficiaryType}:${p.beneficiaryId}`, {
        status: p.status,
        suspendedAt: p.suspendedAt,
      });
    }
    for (const entry of categoryEntries) {
      const pivot = pivotMap.get(`${entry.cat.type}:${entry.cat.id}`);
      if (pivot) {
        pivotMap.set(entry.applicationId, { status: pivot.status, suspendedAt: pivot.suspendedAt });
      }
    }
  }

  let data: BeneficiaryListItem[] = rows.map((row) => {
    const r = row.resident;
    const cat = determineCategory(
      r.seniorCitizenBeneficiary,
      r.pwdBeneficiary,
      r.studentBeneficiary,
      r.soloParentBeneficiary,
      r.healthcareWorkerBeneficiary,
    );
    const pivotInfo = pivotMap.get(row.id) ?? { status: null, suspendedAt: null };

    return {
      id: row.id,
      residentId: r.id,
      fullName: buildFullName(r.firstName, r.middleName, r.lastName, r.extensionName),
      residentIdNumber: r.residentId ?? r.id,
      category: cat?.type ?? 'N/A',
      barangay: r.barangay?.barangayName || 'N/A',
      status: mapEnrollmentStatus(pivotInfo.status),
      suspendedAt: pivotInfo.suspendedAt ? pivotInfo.suspendedAt.toISOString() : null,
      enrolledAt: row.reviewedAt || row.appliedAt,
      applicationId: row.id,
      appliedAt: row.appliedAt,
      reviewedAt: row.reviewedAt,
    };
  });

  // Apply status filter. We must also derive the true filtered total from
  // the (search-aware when needed) counts we computed above, since
  // `data.length` is now capped at `limit` and would understate pagination.
  if (filter === 'active') {
    data = data.filter((b) => b.status === 'ACTIVE');
  } else if (filter === 'suspended') {
    data = data.filter((b) => b.status === 'INACTIVE');
  }

  return {
    data,
    total: filteredTotal,
    page,
    limit,
    totalPages: Math.ceil(filteredTotal / limit),
    counts,
  };
};

// =============================================================================
// GET SINGLE BENEFICIARY
// =============================================================================

export const getBeneficiaryById = async (id: string): Promise<BeneficiaryDetails | null> => {
  const row = await prisma.governmentProgramApplication.findUnique({
    where: { id },
    include: {
      resident: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          middleName: true,
          extensionName: true,
          streetAddress: true,
          birthdate: true,
          sex: true,
          contactNumber: true,
          emergencyContactPerson: true,
          emergencyContactNumber: true,
          picturePath: true,
          residentId: true,
          barangay: { select: { barangayName: true, municipality: true } },
          seniorCitizenBeneficiary: { select: { seniorCitizenId: true, remarks: true } },
          pwdBeneficiary: { select: { pwdId: true, remarks: true } },
          studentBeneficiary: { select: { studentId: true, remarks: true } },
          soloParentBeneficiary: { select: { soloParentId: true, remarks: true } },
          healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true, remarks: true } },
        },
      },
      reviewedByUser: { select: { name: true } },
      program: { select: { id: true, name: true } },
    },
  });
  if (!row) return null;

  const r = row.resident;
  const cat = determineCategory(
    r.seniorCitizenBeneficiary,
    r.pwdBeneficiary,
    r.studentBeneficiary,
    r.soloParentBeneficiary,
    r.healthcareWorkerBeneficiary,
  );

  // Fire 3 independent reads in parallel: classification details (raw SQL),
  // pivot (Prisma), and Libre-Sakay beneficiary (Supabase). All depend only on
  // the findUnique above — none depend on each other.
  const classificationTypeMap: Record<string, string> = {
    SENIOR_CITIZEN: 'Senior Citizen',
    PWD: 'Person with Disability',
    STUDENT: 'Student',
    SOLO_PARENT: 'Solo Parent',
    HEALTHCARE_WORKER: 'Healthcare Worker',
  };
  const dbType = cat ? classificationTypeMap[cat.type] : null;

  const libreBeneficiaryPromise: Promise<{
    id: string;
    pass_number: string | null;
    pass_expiry: string | null;
  } | null> = (async () => {
    try {
      const { getLibreSakaySupabase } = await import('../config/libre-sakay-supabase');
      const supabase = getLibreSakaySupabase();
      const { data } = await supabase
        .from('libre_sakay_beneficiary')
        .select('id, pass_number, pass_expiry')
        .eq('resident_uuid', r.id)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  })();

  const [classRows, pivot, libreData] = await Promise.all([
    dbType && r.id
      ? prisma.$queryRaw<Array<{ classification_details: any }>>`
          SELECT classification_details
          FROM resident_classifications
          WHERE resident_id = ${r.id}
            AND classification_type = ${dbType}
          LIMIT 1
        `
      : Promise.resolve([]),
    cat
      ? prisma.beneficiaryProgramPivot.findFirst({
          where: {
            programId: row.programId,
            beneficiaryType: cat.type as BeneficiaryType,
            beneficiaryId: cat.id,
          },
          select: { status: true, suspendedAt: true },
        })
      : Promise.resolve(null),
    libreBeneficiaryPromise,
  ]);

  let disabilityType: string | null = null;
  let disabilityLevel: string | null = null;
  const details = classRows[0]?.classification_details;
  if (details) {
    disabilityType = details.disabilityType ?? null;
    disabilityLevel = details.disabilityLevel ?? null;
  }

  const pivotStatus: string | null = pivot?.status ?? null;
  const pivotSuspendedAt: Date | null = pivot?.suspendedAt ?? null;

  const libreBeneficiaryId: string | null = libreData?.id ?? null;
  const passNumber: string | null = libreData?.pass_number ?? null;
  const passExpiry: Date | null = libreData?.pass_expiry ? new Date(libreData.pass_expiry) : null;

  // Ride stats — depends on libreBeneficiaryId, so keep sequential.
  let totalRides = 0;
  let lastRideDate: Date | null = null;
  if (libreBeneficiaryId) {
    try {
      const { getLibreSakaySupabase } = await import('../config/libre-sakay-supabase');
      const supabase = getLibreSakaySupabase();
      const { data: rides } = await supabase
        .from('ride_logs')
        .select('id, ride_date')
        .eq('beneficiary_id', libreBeneficiaryId)
        .order('ride_date', { ascending: false })
        .limit(1);
      totalRides = rides?.length || 0;
      lastRideDate = rides?.[0]?.ride_date ? new Date(rides[0].ride_date) : null;
    } catch { /* ignore */ }
  }

  return {
    id: row.id,
    residentId: r.id,
    fullName: buildFullName(r.firstName, r.middleName, r.lastName, r.extensionName),
    residentIdNumber: r.residentId ?? r.id,
    category: cat?.type ?? 'N/A',
    barangay: r.barangay?.barangayName || 'N/A',
  status: mapEnrollmentStatus(pivotStatus),
    suspendedAt: pivotSuspendedAt ? pivotSuspendedAt.toISOString() : null,
    enrolledAt: row.reviewedAt || row.appliedAt,
    applicationId: row.id,
    appliedAt: row.appliedAt,
    reviewedAt: row.reviewedAt,
    reviewedByName: row.reviewedByUser?.name ?? null,
    picturePath: r.picturePath,
    middleName: r.middleName,
    extensionName: r.extensionName,
    birthdate: r.birthdate,
    sex: r.sex,
    address: r.streetAddress
      ? `${r.streetAddress}, ${r.barangay?.barangayName || ''}, ${r.barangay?.municipality?.municipalityName || ''}`
      : `${r.barangay?.barangayName || ''}, ${r.barangay?.municipality?.municipalityName || ''}`,
    contactNumber: r.contactNumber,
    emergencyContactName: r.emergencyContactPerson,
    emergencyContactPhone: r.emergencyContactNumber,
    submittedData: (row.submittedData as Record<string, any>) || {},
    attachments: (row.attachments as any) || [],
    adminNotes: row.adminNotes || null,
    libreBeneficiaryId,
    passNumber,
    passExpiry,
    totalRides,
    lastRideDate,
    // --- NEW FIELDS ---
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email ?? null,
    age: computeAge(r.birthdate),
    disabilityType,
    disabilityLevel,
  };
};

// =============================================================================
// SUSPEND BENEFICIARY — Option B: update only the Libre-Sakay pivot row
// =============================================================================

export const suspendBeneficiary = async (id: string): Promise<void> => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id },
    include: {
      resident: {
        include: {
          seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
          pwdBeneficiary: { select: { pwdId: true } },
          studentBeneficiary: { select: { studentId: true } },
          soloParentBeneficiary: { select: { soloParentId: true } },
          healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
        },
      },
    },
  });

  if (!application) throw new Error('Beneficiary not found');

  const cat = determineCategory(
    application.resident.seniorCitizenBeneficiary,
    application.resident.pwdBeneficiary,
    application.resident.studentBeneficiary,
    application.resident.soloParentBeneficiary,
    application.resident.healthcareWorkerBeneficiary,
  );

  if (!cat) throw new Error('No beneficiary category found');

  const pivot = await prisma.beneficiaryProgramPivot.findFirst({
    where: {
      programId: application.programId,
      beneficiaryType: cat.type as any,
      beneficiaryId: cat.id,
    },
    select: { id: true, status: true },
  });

  if (!pivot) throw new Error('No Libre-Sakay enrollment found');

  // Only set suspendedAt on first suspension — don't reset if already suspended
  const updateData: any = { status: 'suspended' };
  if (pivot.status !== 'suspended') {
    updateData.suspendedAt = new Date();
  }

  await prisma.beneficiaryProgramPivot.update({
    where: { id: pivot.id },
    data: updateData,
  });
};

// =============================================================================
// ACTIVATE BENEFICIARY — Option B: restore the Libre-Sakay pivot row
// =============================================================================

export const activateBeneficiary = async (id: string): Promise<void> => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id },
    include: {
      resident: {
        include: {
          seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
          pwdBeneficiary: { select: { pwdId: true } },
          studentBeneficiary: { select: { studentId: true } },
          soloParentBeneficiary: { select: { soloParentId: true } },
          healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
        },
      },
    },
  });

  if (!application) throw new Error('Beneficiary not found');

  const cat = determineCategory(
    application.resident.seniorCitizenBeneficiary,
    application.resident.pwdBeneficiary,
    application.resident.studentBeneficiary,
    application.resident.soloParentBeneficiary,
    application.resident.healthcareWorkerBeneficiary,
  );

  if (!cat) throw new Error('No beneficiary category found');

  const pivot = await prisma.beneficiaryProgramPivot.findFirst({
    where: {
      programId: application.programId,
      beneficiaryType: cat.type as any,
      beneficiaryId: cat.id,
    },
    select: { id: true },
  });

  if (!pivot) throw new Error('No Libre-Sakay enrollment found');

  await prisma.beneficiaryProgramPivot.update({
    where: { id: pivot.id },
    data: { status: 'active', suspendedAt: null },
  });
};

// =============================================================================
// REMOVE BENEFICIARY — Option B: mark pivot as cancelled (soft-delete)
// =============================================================================

export const removeBeneficiary = async (id: string): Promise<void> => {
  const application = await prisma.governmentProgramApplication.findUnique({
    where: { id },
    include: {
      resident: {
        include: {
          seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
          pwdBeneficiary: { select: { pwdId: true } },
          studentBeneficiary: { select: { studentId: true } },
          soloParentBeneficiary: { select: { soloParentId: true } },
          healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
        },
      },
    },
  });

  if (!application) throw new Error('Beneficiary not found');

  const cat = determineCategory(
    application.resident.seniorCitizenBeneficiary,
    application.resident.pwdBeneficiary,
    application.resident.studentBeneficiary,
    application.resident.soloParentBeneficiary,
    application.resident.healthcareWorkerBeneficiary,
  );

  if (!cat) throw new Error('No beneficiary category found');

  const pivot = await prisma.beneficiaryProgramPivot.findFirst({
    where: {
      programId: application.programId,
      beneficiaryType: cat.type as any,
      beneficiaryId: cat.id,
    },
    select: { id: true },
  });

  if (!pivot) throw new Error('No Libre-Sakay enrollment found');

  // Mark pivot as cancelled and update application status
  await Promise.all([
    prisma.beneficiaryProgramPivot.update({
      where: { id: pivot.id },
      data: { status: 'cancelled' },
    }),
    prisma.governmentProgramApplication.update({
      where: { id },
      data: { status: 'cancelled' },
    }),
  ]);
};

// =============================================================================
// BULK OPERATIONS
// =============================================================================

interface BulkResult {
  updated: number;
  failed: string[];
}

/**
 * Resolve pivot ids for a list of application ids, in the same way the
 * single-row suspend/activate/remove helpers do. Apps without a matching
 * Libre-Sakay pivot are returned in `failed`.
 */
async function resolvePivotsForApps(applicationIds: string[]): Promise<{
  pivots: Array<{ pivotId: string; appId: string; currentStatus: string }>;
  failed: string[];
}> {
  if (applicationIds.length === 0) return { pivots: [], failed: [] };

  const apps = await prisma.governmentProgramApplication.findMany({
    where: { id: { in: applicationIds }, status: 'approved' },
    select: {
      id: true,
      programId: true,
      resident: {
        select: {
          seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
          pwdBeneficiary: { select: { pwdId: true } },
          studentBeneficiary: { select: { studentId: true } },
          soloParentBeneficiary: { select: { soloParentId: true } },
          healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
        },
      },
    },
  });

  const categoryEntries: Array<{ appId: string; cat: { type: BeneficiaryType; id: string } }> = [];
  const failed = new Set(applicationIds);

  for (const app of apps) {
    const cat = determineCategory(
      app.resident.seniorCitizenBeneficiary,
      app.resident.pwdBeneficiary,
      app.resident.studentBeneficiary,
      app.resident.soloParentBeneficiary,
      app.resident.healthcareWorkerBeneficiary,
    );
    if (cat) {
      categoryEntries.push({ appId: app.id, cat });
      failed.delete(app.id);
    }
  }

  if (categoryEntries.length === 0) {
    return { pivots: [], failed: Array.from(failed) };
  }

  const pivotRows = await prisma.beneficiaryProgramPivot.findMany({
    where: {
      OR: categoryEntries.flatMap(e =>
        apps
          .filter(a => a.id === e.appId)
          .map(a => ({
            programId: a.programId,
            beneficiaryType: e.cat.type as BeneficiaryType,
            beneficiaryId: e.cat.id,
          }))
      ),
    },
    select: { id: true, beneficiaryType: true, beneficiaryId: true, status: true },
  });

  const pivotByKey = new Map<string, { pivotId: string; appId: string; currentStatus: string }>();
  for (const p of pivotRows) {
    pivotByKey.set(`${p.beneficiaryType}:${p.beneficiaryId}`, {
      pivotId: p.id,
      appId: '',
      currentStatus: p.status ?? 'active',
    });
  }

  const pivots: Array<{ pivotId: string; appId: string; currentStatus: string }> = [];
  for (const entry of categoryEntries) {
    const key = `${entry.cat.type}:${entry.cat.id}`;
    const found = pivotByKey.get(key);
    if (found) {
      pivots.push({ pivotId: found.pivotId, appId: entry.appId, currentStatus: found.currentStatus });
    } else {
      failed.add(entry.appId);
    }
  }

  return { pivots, failed: Array.from(failed) };
}

export const bulkSuspendBeneficiaries = async (
  applicationIds: string[]
): Promise<BulkResult> => {
  const { pivots, failed } = await resolvePivotsForApps(applicationIds);
  if (pivots.length === 0) return { updated: 0, failed };

  // First-time suspensions get a fresh suspendedAt timestamp; subsequent
  // ones preserve the original (so we don't reset the "Suspended since X" label).
  const freshIds = pivots.filter(p => p.currentStatus !== 'suspended').map(p => p.pivotId);

  let updated = 0;
  await prisma.$transaction([
    prisma.beneficiaryProgramPivot.updateMany({
      where: { id: { in: pivots.map(p => p.pivotId) } },
      data: { status: 'suspended' },
    }),
    ...(freshIds.length > 0
      ? [
          prisma.beneficiaryProgramPivot.updateMany({
            where: { id: { in: freshIds } },
            data: { suspendedAt: new Date() },
          }),
        ]
      : []),
  ]);
  updated = pivots.length;
  return { updated, failed };
};

export const bulkActivateBeneficiaries = async (
  applicationIds: string[]
): Promise<BulkResult> => {
  const { pivots, failed } = await resolvePivotsForApps(applicationIds);
  if (pivots.length === 0) return { updated: 0, failed };

  let updated = 0;
  await prisma.beneficiaryProgramPivot.updateMany({
    where: { id: { in: pivots.map(p => p.pivotId) } },
    data: { status: 'active', suspendedAt: null },
  });
  updated = pivots.length;
  return { updated, failed };
};

export const bulkRemoveBeneficiaries = async (
  applicationIds: string[]
): Promise<BulkResult> => {
  const { pivots, failed } = await resolvePivotsForApps(applicationIds);
  if (pivots.length === 0) return { updated: 0, failed };

  let updated = 0;
  await prisma.$transaction([
    prisma.beneficiaryProgramPivot.updateMany({
      where: { id: { in: pivots.map(p => p.pivotId) } },
      data: { status: 'cancelled' },
    }),
    prisma.governmentProgramApplication.updateMany({
      where: { id: { in: pivots.map(p => p.appId) } },
      data: { status: 'cancelled' },
    }),
  ]);
  updated = pivots.length;
  return { updated, failed };
};

// =============================================================================
// EXPORT BENEFICIARIES
// =============================================================================

export const exportBeneficiaries = async (
  filter: 'all' | 'active' | 'suspended' = 'all'
): Promise<BeneficiaryExportItem[]> => {
  const BATCH_SIZE = 10000;
  const allData: BeneficiaryExportItem[] = [];
  let page = 1;
  let hasMore = true;

  // Resolve Libre-Sakay program ID once
  const program = await prisma.governmentProgram.findFirst({
    where: { name: { mode: 'insensitive', contains: 'Libre Sakay' }, isActive: true },
    select: { id: true },
  });
  if (!program) return [];
  const programId = program.id;

  while (hasMore) {
    const rows = await prisma.governmentProgramApplication.findMany({
      where: { programId, status: 'approved' },
      include: {
        resident: {
          select: {
            id: true,
            residentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            extensionName: true,
            email: true,
            birthdate: true,
            sex: true,
            streetAddress: true,
            barangay: {
              select: {
                barangayName: true,
                municipality: { select: { municipalityName: true } },
              },
            },
            seniorCitizenBeneficiary: { select: { seniorCitizenId: true } },
            pwdBeneficiary: { select: { pwdId: true } },
            studentBeneficiary: { select: { studentId: true } },
            soloParentBeneficiary: { select: { soloParentId: true } },
            healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true } },
          },
        },
      },
      orderBy: { reviewedAt: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * BATCH_SIZE,
      take: BATCH_SIZE,
    });

    if (rows.length === 0) break;
    hasMore = rows.length === BATCH_SIZE;
    page++;

    if (rows.length === 0) continue;

    // Collect PWD resident IDs for bulk disability type fetch
    const pwdIds = rows
      .filter(r => r.resident.pwdBeneficiary?.pwdId)
      .map(r => r.resident.id);

    // Bulk-fetch disability types via raw SQL (one query for entire batch)
    const disabilityMap = new Map<string, string>();
    if (pwdIds.length > 0) {
      const discRows = await prisma.$queryRaw<Array<{ resident_id: string; classification_details: any }>>`
        SELECT resident_id, classification_details
        FROM resident_classifications
        WHERE resident_id IN (${Prisma.join(pwdIds)})
          AND classification_type = 'Person with Disability'
      `;
      for (const row of discRows) {
        const details = row.classification_details;
        if (details?.disabilityType) {
          disabilityMap.set(row.resident_id, details.disabilityType);
        }
      }
    }

    // Batch-fetch pivot statuses
    const categoryEntries = rows
      .map(row => {
        const r = row.resident;
        const cat = determineCategory(
          r.seniorCitizenBeneficiary,
          r.pwdBeneficiary,
          r.studentBeneficiary,
          r.soloParentBeneficiary,
          r.healthcareWorkerBeneficiary,
        );
        return { applicationId: row.id, cat, residentId: r.id };
      })
      .filter(e => e.cat !== null);

    const pivotMap = new Map<string, { status: string | null; suspendedAt: Date | null }>();
    if (categoryEntries.length > 0) {
      const pivotRows = await prisma.beneficiaryProgramPivot.findMany({
        where: {
          programId,
          OR: categoryEntries.map(e => ({
            beneficiaryType: e.cat!.type as BeneficiaryType,
            beneficiaryId: e.cat!.id,
          })),
        },
        select: { beneficiaryType: true, beneficiaryId: true, status: true, suspendedAt: true },
      });
      for (const p of pivotRows) {
        pivotMap.set(`${p.beneficiaryType}:${p.beneficiaryId}`, {
          status: p.status,
          suspendedAt: p.suspendedAt,
        });
      }
    }

    // Build export items
    for (const row of rows) {
      const r = row.resident;
      const cat = determineCategory(
        r.seniorCitizenBeneficiary,
        r.pwdBeneficiary,
        r.studentBeneficiary,
        r.soloParentBeneficiary,
        r.healthcareWorkerBeneficiary,
      );

      const catType = cat?.type ?? 'N/A';
      const pivotKey = `${cat?.type}:${cat?.id}`;
      const pivotInfo = pivotMap.get(pivotKey) ?? { status: null, suspendedAt: null };
      const mappedStatus = mapEnrollmentStatus(pivotInfo.status);

      // Apply filter
      if (filter === 'active' && mappedStatus !== 'ACTIVE') continue;
      if (filter === 'suspended' && mappedStatus !== 'INACTIVE') continue;

      const fullName = buildFullName(r.firstName, r.middleName, r.lastName, r.extensionName);
      const barangay = r.barangay?.barangayName || '';
      const municipality = r.barangay?.municipality?.municipalityName || '';
      const address = r.streetAddress
        ? `${r.streetAddress}, ${barangay}, ${municipality}`
        : `${barangay}, ${municipality}`;

      const statusLabel = pivotInfo.suspendedAt
        ? 'Suspended'
        : mappedStatus === 'ACTIVE'
          ? 'Active'
          : mappedStatus === 'INACTIVE'
            ? 'Inactive'
            : 'Pending';

      allData.push({
        residentId: r.residentId ?? r.id,
        fullName,
        residentIdNumber: r.residentId ?? r.id,
        category: catType,
        beneficiaryTypeLabel: CATEGORY_LABELS[catType] ?? catType,
        disabilityType: disabilityMap.get(r.id) ?? null,
        email: r.email ?? null,
        address,
        birthdate: r.birthdate ? new Date(r.birthdate).toISOString().split('T')[0] : null,
        age: computeAge(r.birthdate),
        sex: r.sex ?? null,
        remarks: row.adminNotes ?? null,
        appliedAt: new Date(row.appliedAt).toISOString().split('T')[0],
        status: statusLabel,
      });
    }
  }

  return allData;
};

// Backward-compatible wrapper — used by exportBeneficiariesController
export const getBeneficiariesForExport = async (
  filter: 'all' | 'active' | 'suspended' = 'all'
): Promise<BeneficiaryListItem[]> => {
  const BATCH_SIZE = 10000;
  const allData: BeneficiaryListItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await listBeneficiaries(filter, page, BATCH_SIZE);
    allData.push(...result.data);
    hasMore = result.data.length === BATCH_SIZE;
    page++;
  }

  return allData;
};

// =============================================================================
// GET MY BENEFICIARY STATUS (resident-facing)
// =============================================================================

export interface MyBeneficiaryStatus {
  enrolled: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | null;
  category: string | null;
  suspendedAt: string | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  passNumber: string | null;
  passExpiry: string | null;
  totalRides: number;
  lastRideDate: string | null;
}

export const getBeneficiaryStatusByResident = async (residentId: string): Promise<MyBeneficiaryStatus> => {
  const defaultResult = { enrolled: false, status: null, category: null, suspendedAt: null, appliedAt: null, reviewedAt: null, passNumber: null, passExpiry: null, totalRides: 0, lastRideDate: null };

  // Look up Libre-Sakay program dynamically from DB (not hardcoded)
  const program = await prisma.governmentProgram.findFirst({
    where: { name: { mode: 'insensitive', contains: 'Libre Sakay' }, isActive: true },
    select: { id: true, types: true },
  });

  if (!program) return defaultResult;

  const programTypes = (program.types as string[]) ?? [];
  const programId = program.id;

  // Fetch resident's classifications with status — only ACTIVE classifications are eligible
  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    include: {
      seniorCitizenBeneficiary: { select: { seniorCitizenId: true, status: true } },
      pwdBeneficiary: { select: { pwdId: true, status: true } },
      studentBeneficiary: { select: { studentId: true, status: true } },
      soloParentBeneficiary: { select: { soloParentId: true, status: true } },
      healthcareWorkerBeneficiary: { select: { healthcareWorkerId: true, status: true } },
    },
  });

  if (!resident) return defaultResult;

  // Find the first ACTIVE classification whose type is in the program's allowed types
  const candidates: Array<{ type: BeneficiaryType; id: string }> = [];
  if (resident.seniorCitizenBeneficiary?.seniorCitizenId && resident.seniorCitizenBeneficiary.status === 'ACTIVE') {
    candidates.push({ type: 'SENIOR_CITIZEN', id: resident.seniorCitizenBeneficiary.seniorCitizenId });
  }
  if (resident.pwdBeneficiary?.pwdId && resident.pwdBeneficiary.status === 'ACTIVE') {
    candidates.push({ type: 'PWD', id: resident.pwdBeneficiary.pwdId });
  }
  if (resident.studentBeneficiary?.studentId && resident.studentBeneficiary.status === 'ACTIVE') {
    candidates.push({ type: 'STUDENT', id: resident.studentBeneficiary.studentId });
  }
  if (resident.soloParentBeneficiary?.soloParentId && resident.soloParentBeneficiary.status === 'ACTIVE') {
    candidates.push({ type: 'SOLO_PARENT', id: resident.soloParentBeneficiary.soloParentId });
  }
  if (resident.healthcareWorkerBeneficiary?.healthcareWorkerId && resident.healthcareWorkerBeneficiary.status === 'ACTIVE') {
    candidates.push({ type: 'HEALTHCARE_WORKER', id: resident.healthcareWorkerBeneficiary.healthcareWorkerId });
  }

  const cat = candidates.find(c => programTypes.includes(c.type)) ?? null;

  if (!cat) return defaultResult;

  // Check for a pending application first
  const pendingApp = await prisma.governmentProgramApplication.findFirst({
    where: { residentId, programId, status: 'pending' },
    orderBy: { appliedAt: 'desc' },
  });

  if (pendingApp) {
    return {
      ...defaultResult,
      enrolled: false,
      status: 'PENDING',
      category: cat.type,
      appliedAt: pendingApp.appliedAt.toISOString(),
    };
  }

  // Find the Libre-Sakay approved application for this resident
  const application = await prisma.governmentProgramApplication.findFirst({
    where: { residentId, programId, status: 'approved' },
    orderBy: { reviewedAt: 'desc' },
  });

  if (!application) {
    // Has ACTIVE classification eligible for this program but hasn't applied yet.
    // Return category so frontend knows the resident can apply.
    return { ...defaultResult, category: cat.type };
  }

  // Get pivot status for this beneficiary type
  const pivot = await prisma.beneficiaryProgramPivot.findFirst({
    where: { programId, beneficiaryType: cat.type, beneficiaryId: cat.id },
    select: { status: true, suspendedAt: true },
  });

  const status = mapEnrollmentStatus(pivot?.status ?? null);
  const suspendedAt = pivot?.suspendedAt ? pivot.suspendedAt.toISOString() : null;

  // Libre-Sakay beneficiary record (pass number, expiry, rides)
  let passNumber: string | null = null;
  let passExpiry: string | null = null;
  let totalRides = 0;
  let lastRideDate: string | null = null;

  try {
    const { getLibreSakaySupabase } = await import('../config/libre-sakay-supabase');
    const supabase = getLibreSakaySupabase();
    const { data: libreData } = await supabase
      .from('libre_sakay_beneficiary')
      .select('id, pass_number, pass_expiry')
      .eq('resident_uuid', residentId)
      .maybeSingle();

    if (libreData) {
      passNumber = libreData.pass_number;
      passExpiry = libreData.pass_expiry;
    }

    if (libreData?.id) {
      const { data: rides } = await supabase
        .from('ride_logs')
        .select('id, ride_date')
        .eq('beneficiary_id', libreData.id)
        .order('ride_date', { ascending: false })
        .limit(1);
      totalRides = rides?.length || 0;
      lastRideDate = rides?.[0]?.ride_date ?? null;
    }
  } catch { /* not available */ }

  return {
    enrolled: true,
    status,
    category: cat.type,
    suspendedAt,
    appliedAt: application.appliedAt.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    passNumber,
    passExpiry,
    totalRides,
    lastRideDate,
  };
};
