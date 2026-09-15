import { getAppointments, getTransaction } from '../transaction.service';
import prisma from '../../config/database';
import { getTransactionServiceWhereForUser } from '../service-access.service';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../service-access.service', () => ({
  __esModule: true,
  getTransactionServiceWhereForUser: jest.fn(),
}));

jest.mock('../email.service', () => ({
  __esModule: true,
  sendEmailSafely: jest.fn(),
}));

jest.mock('../dev.service', () => ({
  __esModule: true,
  addDevLog: jest.fn(),
}));

jest.mock('../tax-computation.service', () => ({
  __esModule: true,
  computeTaxForTransaction: jest.fn(),
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedGetTransactionServiceWhereForUser =
  getTransactionServiceWhereForUser as jest.MockedFunction<typeof getTransactionServiceWhereForUser>;

describe('transaction access scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters internal notes from resident transaction details', async () => {
    (mockedPrisma.transaction.findUnique as jest.Mock).mockResolvedValue({ id: 'transaction-1' });

    await getTransaction('transaction-1', 'resident' as any, 'resident-1');

    expect(mockedPrisma.transaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          transactionNotes: expect.objectContaining({ where: { isInternal: false } }),
        }),
      })
    );
  });

  it('scopes admin appointments by allowed services', async () => {
    mockedGetTransactionServiceWhereForUser.mockResolvedValue({
      service: { code: { in: ['BPLS'] } },
    });
    (mockedPrisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

    await getAppointments(undefined, undefined, undefined, undefined, 'admin-1');

    expect(mockedPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          service: { code: { in: ['BPLS'] } },
        }),
      })
    );
  });
});
