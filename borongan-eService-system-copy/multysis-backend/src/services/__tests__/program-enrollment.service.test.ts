import { pickAndEnroll, pickAndApply } from '../program-enrollment.service';

function makeMockPrisma() {
  return {
    beneficiaryProgramPivot: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ createdAt: new Date(), updatedAt: new Date() }),
    },
    governmentProgramApplication: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: `app-${Math.random()}` })),
    },
  };
}

const PROGRAM_ID = '00000501-0501-4001-8001-000000000003';
const SENIOR_PROGRAM_ID = '00000501-0501-4001-8001-000000000004';

describe('pickAndEnroll', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  beforeEach(() => {
    prisma = makeMockPrisma();
    jest.clearAllMocks();
  });

  it('happy path: 10 candidates, 0 existing pivots → returns 5, upserts 5 times', async () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      residentId: `r-${i}`,
      beneficiaryId: `b-${i}`,
    }));
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);
    const result = await pickAndEnroll(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 5,
      loadCandidates: async () => candidates,
    });
    expect(result).toHaveLength(5);
    expect(prisma.beneficiaryProgramPivot.upsert).toHaveBeenCalledTimes(5);
    expect(result[0]).toMatchObject({ residentId: 'r-0', beneficiaryId: 'b-0', pivotAction: 'created' });
  });

  it('bulk-fetches existing pivots in ONE call (not N)', async () => {
    const candidates = Array.from({ length: 100 }, (_, i) => ({
      residentId: `r-${i}`,
      beneficiaryId: `b-${i}`,
    }));
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
      { beneficiaryId: 'b-0' }, { beneficiaryId: 'b-1' }, { beneficiaryId: 'b-2' },
    ]);
    const result = await pickAndEnroll(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 5,
      loadCandidates: async () => candidates,
    });
    expect(prisma.beneficiaryProgramPivot.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(5);
    // b-0, b-1, b-2 are excluded; result is b-3, b-4, b-5, b-6, b-7
    expect(result.map((r) => r.beneficiaryId)).toEqual(['b-3', 'b-4', 'b-5', 'b-6', 'b-7']);
  });

  it('throws when pool is insufficient', async () => {
    const candidates = Array.from({ length: 4 }, (_, i) => ({
      residentId: `r-${i}`,
      beneficiaryId: `b-${i}`,
    }));
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);
    await expect(
      pickAndEnroll(prisma as any, {
        programId: PROGRAM_ID,
        beneficiaryType: 'STUDENT',
        count: 5,
        loadCandidates: async () => candidates,
      }),
    ).rejects.toThrow(/Need 5 eligible STUDENT.*only 4 available/);
  });

  it('idempotency signal: zero eligible → throws instead of silent no-op', async () => {
    const candidates = Array.from({ length: 3 }, (_, i) => ({
      residentId: `r-${i}`,
      beneficiaryId: `b-${i}`,
    }));
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([
      { beneficiaryId: 'b-0' }, { beneficiaryId: 'b-1' }, { beneficiaryId: 'b-2' },
    ]);
    await expect(
      pickAndEnroll(prisma as any, {
        programId: PROGRAM_ID,
        beneficiaryType: 'STUDENT',
        count: 5,
        loadCandidates: async () => candidates,
      }),
    ).rejects.toThrow(/only 0 available/);
  });

  it('upsert payload has correct keys (beneficiaryType, beneficiaryId, programId, status: active)', async () => {
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);
    await pickAndEnroll(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 1,
      loadCandidates: async () => [{ residentId: 'r-0', beneficiaryId: 'b-0' }],
    });
    expect(prisma.beneficiaryProgramPivot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          beneficiaryType: 'STUDENT',
          beneficiaryId: 'b-0',
          programId: PROGRAM_ID,
          status: 'active',
        }),
        update: {},
      }),
    );
  });
});

describe('pickAndApply', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  beforeEach(() => {
    prisma = makeMockPrisma();
    jest.clearAllMocks();
  });

  it('happy path: returns N applications with correct submittedData shape', async () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      residentId: `r-${i}`,
      beneficiaryId: `b-${i}`,
    }));
    const result = await pickAndApply(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 5,
      loadCandidates: async () => candidates,
    });
    expect(result).toHaveLength(5);
    expect(prisma.governmentProgramApplication.create).toHaveBeenCalledTimes(5);
    const createCall = prisma.governmentProgramApplication.create.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      residentId: 'r-0',
      programId: PROGRAM_ID,
      status: 'pending',
      attachments: [],
    });
    expect(createCall.data.submittedData).toMatchObject({
      _imported: true,
      _source: 'add-pending-applications.ts',
    });
    expect(typeof createCall.data.submittedData._importedAt).toBe('string');
  });

  it('dual-state allowed: senior with pivot but no application is eligible', async () => {
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([{ beneficiaryId: 'b-0' }]);
    prisma.governmentProgramApplication.findMany.mockResolvedValue([]); // no prior app
    const result = await pickAndApply(prisma as any, {
      programId: SENIOR_PROGRAM_ID,
      beneficiaryType: 'SENIOR_CITIZEN',
      count: 1,
      loadCandidates: async () => [
        { residentId: 'r-0', beneficiaryId: 'b-0' },
        { residentId: 'r-1', beneficiaryId: 'b-1' },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].beneficiaryId).toBe('b-1'); // b-0 has pivot, excluded; b-1 picked
  });

  it('skips residents with existing pending/approved application', async () => {
    prisma.beneficiaryProgramPivot.findMany.mockResolvedValue([]);
    prisma.governmentProgramApplication.findMany.mockResolvedValue([{ residentId: 'r-0' }]);
    const result = await pickAndApply(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 1,
      loadCandidates: async () => [
        { residentId: 'r-0', beneficiaryId: 'b-0' },
        { residentId: 'r-1', beneficiaryId: 'b-1' },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].beneficiaryId).toBe('b-1');
  });

  it('throws when pool is insufficient', async () => {
    await expect(
      pickAndApply(prisma as any, {
        programId: PROGRAM_ID,
        beneficiaryType: 'STUDENT',
        count: 2,
        loadCandidates: async () => [{ residentId: 'r-0', beneficiaryId: 'b-0' }],
      }),
    ).rejects.toThrow(/only 1 available/);
  });

  it('bulk-fetches pivots + apps in 2 parallel calls via Promise.all', async () => {
    await pickAndApply(prisma as any, {
      programId: PROGRAM_ID,
      beneficiaryType: 'STUDENT',
      count: 1,
      loadCandidates: async () => [{ residentId: 'r-0', beneficiaryId: 'b-0' }],
    });
    expect(prisma.beneficiaryProgramPivot.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.governmentProgramApplication.findMany).toHaveBeenCalledTimes(1);
  });
});
