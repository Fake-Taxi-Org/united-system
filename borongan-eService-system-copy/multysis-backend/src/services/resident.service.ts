/**
 * resident.service.ts
 *
 * Admin-side CRUD for the unified residents table.
 * Replaces: citizen.service.ts
 */

import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import cacheService from './cache.service';
import { formatResidentResponse } from './auth.service';
import { getSupabase, ESERVICE_BUCKET } from '../config/supabase';
import { syncBeneficiaryPicture } from './portal-programs.service';

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Extracts the storage path from a Supabase public URL.
 * Returns null if the URL is invalid or does not match the expected format.
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${ESERVICE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/**
 * Deletes a file from Supabase Storage given its storage path.
 * Logs errors but does not throw — cleanup failures should not block the update.
 */
async function deleteFromSupabaseStorage(path: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(ESERVICE_BUCKET).remove([path]);
    if (error) {
      console.error(`[residentService] Failed to delete old picture from Supabase: ${error.message}`);
    }
  } catch (err) {
    console.error(`[residentService] Supabase delete error:`, err);
  }
}

export interface ResidentFilters {
  status?: string;
  search?: string;
  barangayId?: number;
  municipalityId?: number;
  page?: number;
  limit?: number;
}

export interface UpdateResidentData {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  extensionName?: string | null;
  sex?: string;
  civilStatus?: string;
  birthdate?: Date;
  placeOfBirth?: string | null;
  citizenship?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  barangayId?: number | null;
  streetAddress?: string | null;
  occupation?: string | null;
  profession?: string | null;
  employmentStatus?: string | null;
  educationAttainment?: string | null;
  monthlyIncome?: number | null;
  height?: string | null;
  weight?: string | null;
  isVoter?: boolean;
  isEmployed?: boolean;
  indigenousPerson?: boolean;
  idType?: string | null;
  idDocumentNumber?: string | null;
  acrNo?: string | null;
  emergencyContactPerson?: string | null;
  emergencyContactNumber?: string | null;
  spouseName?: string | null;
  picturePath?: string | null;
  proofOfIdentification?: string | null;
  status?: string;
  applicationRemarks?: string | null;
}

// =============================================================================
// LIST RESIDENTS
// =============================================================================
export const listResidents = async (filters: ResidentFilters) => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.barangayId) where.barangayId = filters.barangayId;
  if (filters.municipalityId) {
    where.barangay = { municipality: { id: filters.municipalityId } };
  }
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { username: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { residentId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [residents, total] = await prisma.$transaction([
    prisma.resident.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        barangay: {
          select: {
            id: true,
            barangayName: true,
            municipality: { select: { id: true, municipalityName: true } },
          },
        },
        credentials: { select: { googleId: true } },
      },
    }),
    prisma.resident.count({ where }),
  ]);

  return {
    residents: residents.map(formatResidentResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// =============================================================================
// GET SINGLE RESIDENT (cached)
// =============================================================================

/** Shape returned by raw SQL for resident_classifications (matches BIMS VIEW_RESIDENT_INFORMATION) */
interface ResidentClassificationRow {
  classification_id: number;
  classification_type: string;
  classification_details: unknown;
}

export const getResident = async (id: string) => {
  const cacheKey = `resident:${id}:profile`;

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return cached;
  }

  const resident = await prisma.resident.findUnique({
    where: { id },
    include: {
      barangay: { include: { municipality: true } },
      credentials: { select: { googleId: true } },
      seniorCitizenBeneficiary: true,
      pwdBeneficiary: true,
      studentBeneficiary: true,
      soloParentBeneficiary: true,
    },
  });

  if (!resident) throw new Error('Resident not found');

  // Fetch classifications via raw SQL (BIMS-managed table, not in Prisma schema)
  const classifications = await prisma.$queryRaw<ResidentClassificationRow[]>`
    SELECT
      id AS classification_id,
      classification_type,
      COALESCE(classification_details, '{}'::jsonb) AS classification_details
    FROM resident_classifications
    WHERE resident_id = ${Prisma.sql`${id}`}
    ORDER BY classification_type ASC
  `;

  const formatted = formatResidentResponse(resident);
  const withClassifications = { ...formatted, classifications };
  await cacheService.set(cacheKey, withClassifications, 120); // 2 min TTL
  return withClassifications;
};

// =============================================================================
// GET RESIDENT BY RESIDENT_ID (the display ID like BIMS-2025-0000001)
// =============================================================================
export const getResidentByResidentId = async (residentId: string) => {
  const resident = await prisma.resident.findUnique({
    where: { residentId },
    include: {
      barangay: { include: { municipality: true } },
      credentials: { select: { googleId: true } },
    },
  });

  if (!resident) throw new Error('Resident not found');
  return formatResidentResponse(resident);
};

// =============================================================================
// UPDATE RESIDENT  (admin edit — does not change credentials)
// =============================================================================
export const updateResident = async (id: string, data: UpdateResidentData) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');

  // Email uniqueness check (if changing email)
  if (data.email && data.email !== resident.email) {
    const existing = await prisma.resident.findFirst({
      where: { email: data.email, id: { not: id } },
      select: { id: true },
    });
    if (existing) throw new Error('Email is already registered to another resident');
  }

  const updated = await prisma.resident.update({
    where: { id },
    data: data as any,
    include: {
      barangay: { include: { municipality: true } },
      credentials: { select: { googleId: true } },
    },
  });

  // Invalidate cache
  await invalidateProfileCache(id);

  return formatResidentResponse(updated);
};

// =============================================================================
// RESIDENT SELF-UPDATE (portal — limited fields, no status change)
// =============================================================================
export interface SelfUpdateData {
  sex?: string | null;
  civilStatus?: string | null;
  birthdate?: string | null;
  citizenship?: string | null;
  spouseName?: string | null;
  isVoter?: boolean;
  isEmployed?: boolean;
  indigenousPerson?: boolean;
  placeOfBirth?: string | null;
  occupation?: string | null;
  profession?: string | null;
  employmentStatus?: string | null;
  educationAttainment?: string | null;
  monthlyIncome?: number | null;
  height?: string | null;
  weight?: string | null;
  emergencyContactPerson?: string | null;
  emergencyContactNumber?: string | null;
  idType?: string | null;
  idDocumentNumber?: string | null;
  acrNo?: string | null;
  picturePath?: string | null;
}

export const updateMyProfile = async (id: string, data: SelfUpdateData) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');

  const oldPicturePath = resident.picturePath;

  // Normalize birthdate: accept either ISO-8601 DateTime or date-only string
  // (mirrors the pattern in portal-registration.service.ts). Prisma rejects
  // bare "YYYY-MM-DD" because the schema column is DateTime.
  const normalized: Record<string, unknown> = { ...data };
  if (typeof normalized.birthdate === 'string') {
    const trimmed = normalized.birthdate.trim();
    normalized.birthdate = trimmed.length === 10
      ? new Date(trimmed + 'T00:00:00.000Z')
      : new Date(trimmed);
  }

  const updated = await prisma.resident.update({
    where: { id },
    data: normalized as any,
    include: {
      barangay: { include: { municipality: true } },
      credentials: { select: { googleId: true } },
      seniorCitizenBeneficiary: true,
      pwdBeneficiary: true,
      studentBeneficiary: true,
      soloParentBeneficiary: true,
    },
  });

  // Invalidate cache
  await invalidateProfileCache(id);

  const newPicturePath = data.picturePath;
  const pictureChanged = newPicturePath !== undefined && newPicturePath !== oldPicturePath;

  if (pictureChanged && oldPicturePath) {
    const storagePath = extractStoragePath(oldPicturePath);
    if (storagePath) {
      await deleteFromSupabaseStorage(storagePath);
    }
  }

  if (pictureChanged) {
    await syncBeneficiaryPicture(id, newPicturePath ?? null);
  }

  return formatResidentResponse(updated);
};

// =============================================================================
// CACHE INVALIDATION
// =============================================================================
export const invalidateProfileCache = async (residentId: string): Promise<void> => {
  await cacheService.del(`resident:${residentId}:profile`);
};

// =============================================================================
// ACTIVATE / DEACTIVATE
// =============================================================================
export const activateResident = async (id: string) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');
  return prisma.resident.update({ where: { id }, data: { status: 'active' } });
};

export const deactivateResident = async (id: string) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');
  return prisma.resident.update({ where: { id }, data: { status: 'inactive' } });
};

// =============================================================================
// MARK DECEASED / MOVED_OUT
// =============================================================================
export const markDeceased = async (id: string) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');
  return prisma.resident.update({ where: { id }, data: { status: 'deceased' } });
};

export const markMovedOut = async (id: string) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');
  return prisma.resident.update({ where: { id }, data: { status: 'moved_out' } });
};

// =============================================================================
// DELETE RESIDENT (removes all cascade data)
// =============================================================================
export const deleteResident = async (id: string) => {
  const resident = await prisma.resident.findUnique({ where: { id } });
  if (!resident) throw new Error('Resident not found');
  await prisma.resident.delete({ where: { id } });
  return { deleted: true };
};

// =============================================================================
// CHECK USERNAME AVAILABILITY
// =============================================================================
export const checkUsernameAvailability = async (username: string) => {
  const existing = await prisma.resident.findUnique({
    where: { username },
    select: { id: true },
  });
  return { available: !existing };
};

// CHECK EMAIL EXISTS
// =============================================================================
export const checkEmailExists = async (email: string) => {
  const existing = await prisma.resident.findFirst({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return { exists: !!existing };
};
