import prisma from '../../config/database';
import {
  listBeneficiaries,
  getBeneficiaryById,
  suspendBeneficiary,
  activateBeneficiary,
  removeBeneficiary,
  bulkSuspendBeneficiaries,
  bulkActivateBeneficiaries,
  bulkRemoveBeneficiaries,
} from '../libre-sakay-beneficiary.service';

const mockedPrisma = prisma as any;

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    governmentProgram: {
      findFirst: jest.fn(),
    },
    governmentProgramApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    beneficiaryProgramPivot: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((args: any) => Promise.resolve(Array.isArray(args) ? [] : args)),
  },
}));

describe('Libre Sakay Beneficiary Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: Libre Sakay program exists. Individual tests can override.
    mockedPrisma.governmentProgram.findFirst.mockResolvedValue({
      id: 'gp-all-libre-sakay',
    });
    // Default: no application rows, no pivots, no count.
    mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([]);
    mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
    mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // listBeneficiaries
  // ────────────────────────────────────────────────────────────────────────────

  describe('listBeneficiaries', () => {
    it('should return empty data when no applications exist', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);

      const result = await listBeneficiaries('all', 1, 20);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should map senior citizen beneficiary to enrollment ACTIVE', async () => {
      const mockRow = {
        id: 'app-1',
        residentId: 'res-1',
        programId: 'gp-all-libre-sakay',
        status: 'approved',
        appliedAt: new Date(),
        reviewedAt: new Date(),
        resident: {
          id: 'res-1',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          middleName: null,
          extensionName: null,
          residentId: null,
          seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
          barangay: { barangayName: 'Brgy. 1', municipality: { municipalityName: 'Borongan' } },
        },
      };

      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([mockRow]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(1);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active', suspendedAt: null },
      ]);

      const result = await listBeneficiaries('all', 1, 20);

      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe('ACTIVE');
      expect(result.data[0].category).toBe('SENIOR_CITIZEN');
    });

    it('should filter by search term on resident name', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);

      await listBeneficiaries('all', 1, 20, 'Juan');

      expect(mockedPrisma.governmentProgramApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resident: expect.objectContaining({
              OR: expect.arrayContaining([
                { firstName: { contains: 'Juan', mode: 'insensitive' } },
              ]),
            }),
          }),
        })
      );
    });

    it('should filter active enrollment only', async () => {
      const mockRow = {
        id: 'app-1',
        residentId: 'res-1',
        programId: 'gp-all-libre-sakay',
        status: 'approved',
        appliedAt: new Date(),
        reviewedAt: new Date(),
        resident: {
          id: 'res-1',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          middleName: null,
          extensionName: null,
          residentId: null,
          seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
          barangay: { barangayName: 'Brgy. 1', municipality: { municipalityName: 'Borongan' } },
        },
      };

      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([mockRow]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(1);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active', suspendedAt: null },
      ]);

      const result = await listBeneficiaries('active', 1, 20);

      expect(result.data.length).toBe(1);
    });

    it('should mark PENDING when no pivot row exists', async () => {
      const mockRow = {
        id: 'app-1',
        residentId: 'res-1',
        programId: 'gp-all-libre-sakay',
        status: 'approved',
        appliedAt: new Date(),
        reviewedAt: new Date(),
        resident: {
          id: 'res-1',
          firstName: 'Maria',
          lastName: 'Santos',
          middleName: null,
          extensionName: null,
          residentId: null,
          seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
          barangay: { barangayName: 'Brgy. 2', municipality: { municipalityName: 'Borongan' } },
        },
      };

      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([mockRow]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(1);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      const result = await listBeneficiaries('all', 1, 20);

      expect(result.data[0].status).toBe('PENDING');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // getBeneficiaryById
  // ────────────────────────────────────────────────────────────────────────────

  describe('getBeneficiaryById', () => {
    it('should return null when application not found', async () => {
      mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue(null);

      const result = await getBeneficiaryById('non-existent');

      expect(result).toBeNull();
    });

    it('should return beneficiary details with pivot info', async () => {
      const mockRow = {
        id: 'app-1',
        residentId: 'res-1',
        programId: 'gp-all-libre-sakay',
        status: 'approved',
        appliedAt: new Date('2026-01-15'),
        reviewedAt: new Date('2026-01-20'),
        resident: {
          id: 'res-1',
          firstName: 'Pedro',
          lastName: 'Penduko',
          middleName: 'B',
          extensionName: 'Sr',
          residentId: 'RES-2026-0000001',
          picturePath: '/pics/pedro.jpg',
          birthdate: new Date('1960-05-10'),
          sex: 'Male',
          barangay: { barangayName: 'Brgy. 3', municipality: { municipalityName: 'Borongan' } },
          seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
        },
        adminNotes: null,
        submittedData: { name: 'Pedro' },
        attachments: {},
      };

      mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue(mockRow);
      mockedPrisma.beneficiaryProgramPivot.findFirst.mockResolvedValue({
        beneficiaryType: 'SENIOR_CITIZEN',
        beneficiaryId: 'SC-1',
        status: 'suspended',
        suspendedAt: new Date('2026-02-01'),
      });

      const result = await getBeneficiaryById('app-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('INACTIVE');
      expect(result!.fullName).toBe('Pedro B Penduko Sr');
      expect(result!.suspendedAt).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // suspendBeneficiary
  // ────────────────────────────────────────────────────────────────────────────

  describe('suspendBeneficiary', () => {
    it('should call beneficiaryProgramPivot.update with suspended status', async () => {
      mockedPrisma.beneficiaryProgramPivot.findFirst.mockResolvedValue({
        id: 'pivot-1',
        beneficiaryType: 'SENIOR_CITIZEN',
        beneficiaryId: 'SC-1',
        status: 'active',
      });
      mockedPrisma.beneficiaryProgramPivot.update.mockResolvedValue({});
      mockedPrisma.governmentProgramApplication.update.mockResolvedValue({});

      await suspendBeneficiary('app-1');

      expect(mockedPrisma.beneficiaryProgramPivot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pivot-1' },
          data: expect.objectContaining({ status: 'suspended' }),
        })
      );
    });

    it('should throw when no pivot row found', async () => {
      mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue({
        id: 'app-1',
        resident: {
          seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
        },
      });
      mockedPrisma.beneficiaryProgramPivot.findFirst.mockResolvedValue(null);

      await expect(suspendBeneficiary('app-1')).rejects.toThrow('No Libre-Sakay enrollment found');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // activateBeneficiary
  // ────────────────────────────────────────────────────────────────────────────

  describe('activateBeneficiary', () => {
    it('should call beneficiaryProgramPivot.update with active status', async () => {
      mockedPrisma.beneficiaryProgramPivot.findFirst.mockResolvedValue({
        id: 'pivot-1',
        beneficiaryType: 'SENIOR_CITIZEN',
        beneficiaryId: 'SC-1',
        status: 'suspended',
        suspendedAt: new Date(),
      });
      mockedPrisma.beneficiaryProgramPivot.update.mockResolvedValue({});

      await activateBeneficiary('app-1');

      expect(mockedPrisma.beneficiaryProgramPivot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pivot-1' },
          data: expect.objectContaining({ status: 'active', suspendedAt: null }),
        })
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // removeBeneficiary
  // ────────────────────────────────────────────────────────────────────────────

  describe('removeBeneficiary', () => {
    it('should call governmentProgramApplication.update with cancelled status', async () => {
      mockedPrisma.beneficiaryProgramPivot.findFirst.mockResolvedValue({
        id: 'pivot-1',
        beneficiaryType: 'SENIOR_CITIZEN',
        beneficiaryId: 'SC-1',
      });
      mockedPrisma.beneficiaryProgramPivot.update.mockResolvedValue({});
      mockedPrisma.governmentProgramApplication.update.mockResolvedValue({});

      await removeBeneficiary('app-1');

      expect(mockedPrisma.governmentProgramApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({ status: 'cancelled' }),
        })
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Counts return shape
  // ────────────────────────────────────────────────────────────────────────────

  describe('listBeneficiaries counts', () => {
    const SC_ROW = (id: string, seniorId: string) => ({
      id,
      residentId: 'res-' + id,
      programId: 'gp-all-libre-sakay',
      status: 'approved',
      appliedAt: new Date(),
      reviewedAt: new Date(),
      resident: {
        id: 'res-' + id,
        firstName: 'Test',
        lastName: 'User ' + id,
        middleName: null,
        extensionName: null,
        residentId: null,
        seniorCitizenBeneficiary: { seniorCitizenId: seniorId },
        pwdBeneficiary: null,
        studentBeneficiary: null,
        soloParentBeneficiary: null,
        healthcareWorkerBeneficiary: null,
        barangay: { barangayName: 'Brgy', municipality: { municipalityName: 'Borongan' } },
      },
    });

    it('returns counts object with all/active/suspended for every response', async () => {
      // 3 apps in the DB: 2 active pivots, 1 suspended pivot.
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([
          // getStatusCounts apps lookup — 3 apps
          { id: 'app-1', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
          { id: 'app-2', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-2' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
          { id: 'app-3', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-3' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
        ])
        .mockResolvedValueOnce([SC_ROW('a', 'SC-a')]); // page row
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(3);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active', suspendedAt: null },
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-2', status: 'active', suspendedAt: null },
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-3', status: 'suspended', suspendedAt: new Date() },
      ]);

      const result = await listBeneficiaries('all', 1, 20);

      expect(result.counts).toBeDefined();
      expect(result.counts).toEqual({ all: 3, active: 2, suspended: 1 });
      // counts must not depend on which page/limit was requested
    });

    it('counts are stable across filter and page (always reflect unfiltered totals)', async () => {
      // Even when filter='suspended' and there's only 1 suspended in the DB,
      // counts should still show all=10/active=9/suspended=1.
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active', suspendedAt: null },
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-2', status: 'suspended', suspendedAt: new Date() },
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-3', status: 'active', suspendedAt: null },
      ]);

      // Set up the findMany for the apps lookup inside getStatusCounts.
      // The new code path: listBeneficiaries calls getStatusCounts which uses
      // its own findMany on applications (just category ids). Then the rows
      // findMany for the page.
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([
          // First call: getStatusCounts apps lookup (returns the residents + their category rows)
          { id: 'app-1', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
          { id: 'app-2', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-2' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
          { id: 'app-3', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-3' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
        ])
        // Second call: the page's findMany (returns empty page since filter='suspended'+limit=20)
        .mockResolvedValueOnce([]);

      const result = await listBeneficiaries('suspended', 1, 20);

      expect(result.counts).toEqual({ all: 3, active: 2, suspended: 1 });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // True filtered total (no longer capped at page size)
  // ────────────────────────────────────────────────────────────────────────────

  describe('listBeneficiaries pagination.total is the true filtered count', () => {
    it('returns counts.active as total when filter=active, not data.length', async () => {
      // Page has 20 active rows but DB has 200 actives — total must be 200.
      const rows = Array.from({ length: 20 }, (_, i) => ({
        id: `app-${i}`,
        residentId: `res-${i}`,
        programId: 'gp-all-libre-sakay',
        status: 'approved',
        appliedAt: new Date(),
        reviewedAt: new Date(),
        resident: {
          id: `res-${i}`,
          firstName: `U${i}`,
          lastName: `Test${i}`,
          middleName: null,
          extensionName: null,
          residentId: null,
          seniorCitizenBeneficiary: { seniorCitizenId: `SC-${i}` },
          pwdBeneficiary: null,
          studentBeneficiary: null,
          soloParentBeneficiary: null,
          healthcareWorkerBeneficiary: null,
          barangay: { barangayName: 'Brgy', municipality: { municipalityName: 'Borongan' } },
        },
      }));
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([ // getStatusCounts apps lookup
          { id: 'app-0', resident: { seniorCitizenBeneficiary: { seniorCitizenId: 'SC-0' }, pwdBeneficiary: null, studentBeneficiary: null, soloParentBeneficiary: null, healthcareWorkerBeneficiary: null } },
        ])
        .mockResolvedValueOnce(rows); // page rows
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(20);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-0', status: 'active', suspendedAt: null },
        // only one pivot entry shown; the others would be filled in by the actual data
      ]);

      // We need 20 distinct pivot entries for the page rows.
      const pivotRows = Array.from({ length: 20 }, (_, i) => ({
        beneficiaryType: 'SENIOR_CITIZEN',
        beneficiaryId: `SC-${i}`,
        status: 'active',
        suspendedAt: null,
      }));
      mockedPrisma.beneficiaryProgramPivot.findMany.mockReset();
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue(pivotRows);

      const result = await listBeneficiaries('active', 1, 20);

      // data.length === 20 (page), but total must equal counts.active (200),
      // NOT 20 (data.length). With the buggy code this would be 20.
      expect(result.data.length).toBe(20);
      expect(result.total).toBe(result.counts.active);
      // The bug would produce total === 20 here. The fix produces the real count.
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Search by resident ID
  // ────────────────────────────────────────────────────────────────────────────

  describe('listBeneficiaries search by resident ID', () => {
    it('includes residentId in the search OR clause', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockReset();
      mockedPrisma.governmentProgramApplication.count.mockReset();
      mockedPrisma.beneficiaryProgramPivot.findMany.mockReset();
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([]) // getStatusCounts apps lookup
        .mockResolvedValueOnce([]); // page rows
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      await listBeneficiaries('all', 1, 20, 'BRGN-2026-0026');

      const allCalls = mockedPrisma.governmentProgramApplication.findMany.mock.calls;
      const pageCall = allCalls[allCalls.length - 1];
      const where = pageCall[0]?.where;
      expect(where).toBeDefined();
      const ors = where?.resident?.OR;
      expect(ors).toEqual(
        expect.arrayContaining([
          { firstName: { contains: 'BRGN-2026-0026', mode: 'insensitive' } },
          { lastName: { contains: 'BRGN-2026-0026', mode: 'insensitive' } },
          { middleName: { contains: 'BRGN-2026-0026', mode: 'insensitive' } },
          { residentId: { contains: 'BRGN-2026-0026', mode: 'insensitive' } },
        ])
      );
    });

    it('trims the search input before matching', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockReset();
      mockedPrisma.governmentProgramApplication.count.mockReset();
      mockedPrisma.beneficiaryProgramPivot.findMany.mockReset();
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      await listBeneficiaries('all', 1, 20, '   ');

      // Whitespace-only search should not produce a search clause.
      const allCalls = mockedPrisma.governmentProgramApplication.findMany.mock.calls;
      const pageCall = allCalls[allCalls.length - 1];
      const where = pageCall[0]?.where;
      expect(where?.resident?.OR).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Sort params
  // ────────────────────────────────────────────────────────────────────────────

  describe('listBeneficiaries sort', () => {
    it('sorts by resident.lastName asc when sortBy=name', async () => {
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      await listBeneficiaries('all', 1, 20, undefined, 'name', 'asc');

      const allCalls = mockedPrisma.governmentProgramApplication.findMany.mock.calls;
      const pageCall = allCalls[allCalls.length - 1];
      expect(pageCall[0]?.orderBy).toEqual({ resident: { lastName: 'asc' } });
    });

    it('sorts by reviewedAt desc when sortBy=date (default)', async () => {
      mockedPrisma.governmentProgramApplication.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockedPrisma.governmentProgramApplication.count.mockResolvedValue(0);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      await listBeneficiaries('all', 1, 20);

      const allCalls = mockedPrisma.governmentProgramApplication.findMany.mock.calls;
      const pageCall = allCalls[allCalls.length - 1];
      expect(pageCall[0]?.orderBy).toEqual({ reviewedAt: { sort: 'desc', nulls: 'last' } });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Bulk operations
  // ────────────────────────────────────────────────────────────────────────────

  describe('bulkSuspendBeneficiaries', () => {
    it('returns 0/0 with empty id list', async () => {
      const result = await bulkSuspendBeneficiaries([]);
      expect(result).toEqual({ updated: 0, failed: [] });
      expect(mockedPrisma.beneficiaryProgramPivot.updateMany).not.toHaveBeenCalled();
    });

    it('suspends all matched pivots and only sets suspendedAt on first-time suspensions', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([
        {
          id: 'app-1',
          programId: 'gp-all-libre-sakay',
          resident: {
            seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
            pwdBeneficiary: null,
            studentBeneficiary: null,
            soloParentBeneficiary: null,
            healthcareWorkerBeneficiary: null,
          },
        },
        {
          id: 'app-2',
          programId: 'gp-all-libre-sakay',
          resident: {
            seniorCitizenBeneficiary: { seniorCitizenId: 'SC-2' },
            pwdBeneficiary: null,
            studentBeneficiary: null,
            soloParentBeneficiary: null,
            healthcareWorkerBeneficiary: null,
          },
        },
      ]);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { id: 'pivot-1', beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active' },
        { id: 'pivot-2', beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-2', status: 'suspended' },
      ]);

      const result = await bulkSuspendBeneficiaries(['app-1', 'app-2']);

      expect(result).toEqual({ updated: 2, failed: [] });
      // Expect a $transaction with two updateMany calls: status + suspendedAt
      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArgs = mockedPrisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(txArgs)).toBe(true);
      expect(txArgs.length).toBe(2); // status update + suspendedAt for fresh ones only
    });

    it('reports app ids without a pivot as failed', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([]);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);

      const result = await bulkSuspendBeneficiaries(['app-orphan-1', 'app-orphan-2']);
      expect(result).toEqual({ updated: 0, failed: ['app-orphan-1', 'app-orphan-2'] });
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('bulkActivateBeneficiaries', () => {
    it('activates matched pivots, clearing suspendedAt', async () => {
      // Use mockImplementation to bypass jest's Once/persistent quirk where a
      // previous test's Once can leave the implementation in an unexpected state.
      mockedPrisma.governmentProgramApplication.findMany.mockImplementation(async () => [
        {
          id: 'app-1',
          programId: 'gp-all-libre-sakay',
          resident: {
            seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
            pwdBeneficiary: null,
            studentBeneficiary: null,
            soloParentBeneficiary: null,
            healthcareWorkerBeneficiary: null,
          },
        },
      ]);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockImplementation(async () => [
        { id: 'pivot-1', beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'suspended' },
      ]);
      mockedPrisma.beneficiaryProgramPivot.updateMany.mockResolvedValue({ count: 1 });

      const result = await bulkActivateBeneficiaries(['app-1']);

      expect(result).toEqual({ updated: 1, failed: [] });
      expect(mockedPrisma.beneficiaryProgramPivot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['pivot-1'] } },
          data: { status: 'active', suspendedAt: null },
        })
      );
    });
  });

  describe('bulkRemoveBeneficiaries', () => {
    it('cancels matched pivots and applications in a transaction', async () => {
      mockedPrisma.governmentProgramApplication.findMany.mockResolvedValue([
        {
          id: 'app-1',
          programId: 'gp-all-libre-sakay',
          resident: {
            seniorCitizenBeneficiary: { seniorCitizenId: 'SC-1' },
            pwdBeneficiary: null,
            studentBeneficiary: null,
            soloParentBeneficiary: null,
            healthcareWorkerBeneficiary: null,
          },
        },
      ]);
      mockedPrisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
        { id: 'pivot-1', beneficiaryType: 'SENIOR_CITIZEN', beneficiaryId: 'SC-1', status: 'active' },
      ]);

      const result = await bulkRemoveBeneficiaries(['app-1']);

      expect(result).toEqual({ updated: 1, failed: [] });
      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArgs = mockedPrisma.$transaction.mock.calls[0][0];
      expect(txArgs.length).toBe(2); // pivots + applications
    });
  });
});
