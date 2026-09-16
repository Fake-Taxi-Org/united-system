import prisma from '../../config/database';
import { reviewApplicationAdmin } from '../portal-programs.service';

const mockedPrisma = prisma as any;

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    governmentProgramApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    seniorCitizenBeneficiary: {
      findUnique: jest.fn(),
    },
    pWDBeneficiary: {
      findUnique: jest.fn(),
    },
    studentBeneficiary: {
      findUnique: jest.fn(),
    },
    soloParentBeneficiary: {
      findUnique: jest.fn(),
    },
    healthcareWorkerBeneficiary: {
      findUnique: jest.fn(),
    },
    beneficiaryProgramPivot: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../services/socket.service', () => ({
  emitProgramApplicationReview: jest.fn(),
}));

jest.mock('../../config/libre-sakay-supabase', () => ({
  getLibreSakaySupabase: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  })),
}));

describe('Portal Programs Service — reviewApplicationAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw when application not found', async () => {
    mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue(null);

    await expect(reviewApplicationAdmin('app-1', 'approve', 'admin-1')).rejects.toThrow(
      'Application not found'
    );
  });

  it('should throw when application is not pending', async () => {
    mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      status: 'approved',
      program: { types: ['ALL'], name: 'Libre Sakay' },
      resident: { id: 'res-1', residentId: null },
    });

    await expect(reviewApplicationAdmin('app-1', 'approve', 'admin-1')).rejects.toThrow(
      'Only pending applications can be reviewed'
    );
  });

  it('should approve and upsert beneficiaryProgramPivot for ALL-type program', async () => {
    const application = {
      id: 'app-1',
      residentId: 'res-1',
      programId: 'prog-libre',
      status: 'pending',
      program: { types: ['ALL'], name: 'Libre Sakay' },
      resident: { id: 'res-1', residentId: 'RES-2026-001' },
    };

    mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue(application);
    mockedPrisma.seniorCitizenBeneficiary.findUnique.mockResolvedValue({ id: 'sc-1' });
    mockedPrisma.pWDBeneficiary.findUnique.mockResolvedValue({ id: 'pwd-1' });
    mockedPrisma.studentBeneficiary.findUnique.mockResolvedValue({ id: 'st-1' });
    mockedPrisma.soloParentBeneficiary.findUnique.mockResolvedValue({ id: 'sp-1' });
    mockedPrisma.healthcareWorkerBeneficiary.findUnique.mockResolvedValue({ id: 'hw-1' });

    const upsertMock = jest.fn().mockResolvedValue({});
    const mockTx = jest.fn().mockImplementation((cb) => {
      const tx = {
        governmentProgramApplication: {
          update: jest.fn().mockResolvedValue({
            id: 'app-1',
            status: 'approved',
            reviewedAt: new Date(),
          }),
        },
        seniorCitizenBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'sc-1' }) },
        pWDBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'pwd-1' }) },
        studentBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'st-1' }) },
        soloParentBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'sp-1' }) },
        healthcareWorkerBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'hw-1' }) },
        beneficiaryProgramPivot: { upsert: upsertMock },
      };
      return cb(tx);
    });
    mockedPrisma.$transaction.mockImplementation(mockTx);

    await reviewApplicationAdmin('app-1', 'approve', 'admin-1');

    // Should have upserted 5 pivot rows (one per beneficiary type for ALL program,
    // including HEALTHCARE_WORKER which was added after this test was first written)
    expect(upsertMock).toHaveBeenCalledTimes(5);
  });

  it('should reject application without creating pivots', async () => {
    mockedPrisma.governmentProgramApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      residentId: 'res-1',
      programId: 'prog-1',
      status: 'pending',
      program: { types: ['SENIOR_CITIZEN'], name: 'Senior Subsidy' },
      resident: { id: 'res-1', residentId: null },
    });

    const upsertMock = jest.fn().mockResolvedValue({});
    const mockTx = jest.fn().mockImplementation((cb) => {
      const tx = {
        governmentProgramApplication: {
          update: jest.fn().mockResolvedValue({
            id: 'app-1',
            status: 'rejected',
            reviewedAt: new Date(),
          }),
        },
        seniorCitizenBeneficiary: { findUnique: jest.fn().mockResolvedValue({ id: 'sc-1' }) },
        pWDBeneficiary: { findUnique: jest.fn().mockResolvedValue(null) },
        studentBeneficiary: { findUnique: jest.fn().mockResolvedValue(null) },
        soloParentBeneficiary: { findUnique: jest.fn().mockResolvedValue(null) },
        beneficiaryProgramPivot: { upsert: upsertMock },
      };
      return cb(tx);
    });
    mockedPrisma.$transaction.mockImplementation(mockTx);

    await reviewApplicationAdmin('app-1', 'reject', 'admin-1', 'Not eligible');

    // No pivot upserts on reject
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
