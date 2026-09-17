import { Response } from 'express';
import { listBeneficiariesController } from '../libre-sakay.controller';
import * as libreSakayBeneficiaryService from '../../services/libre-sakay-beneficiary.service';
import { AuthRequest } from '../../middleware/auth';

// Mock the service module so we can control what listBeneficiaries returns.
jest.mock('../../services/libre-sakay-beneficiary.service');

const mockedService = libreSakayBeneficiaryService as jest.Mocked<
  typeof libreSakayBeneficiaryService
>;

describe('listBeneficiariesController', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;

  beforeEach(() => {
    mockStatus = jest.fn().mockReturnThis();
    mockJson = jest.fn().mockReturnThis();
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
        type: 'admin',
      },
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.clearAllMocks();
  });

  it('forwards counts in the response envelope', async () => {
    mockedService.listBeneficiaries.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      counts: { all: 6789, active: 6788, suspended: 1 },
    } as any);

    await listBeneficiariesController(mockRequest as AuthRequest, mockResponse as Response);

    expect(mockedService.listBeneficiaries).toHaveBeenCalledWith('all', 1, 20, undefined, 'date', 'desc');
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: [],
        pagination: expect.objectContaining({
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        }),
        counts: { all: 6789, active: 6788, suspended: 1 },
      })
    );
  });

  it('passes the requested filter, page, and search to the service', async () => {
    mockRequest.query = {
      filter: 'suspended',
      page: '3',
      limit: '50',
      search: 'BRGN-2026-0026',
    };
    mockedService.listBeneficiaries.mockResolvedValue({
      data: [],
      total: 0,
      page: 3,
      limit: 50,
      totalPages: 0,
      counts: { all: 0, active: 0, suspended: 0 },
    } as any);

    await listBeneficiariesController(mockRequest as AuthRequest, mockResponse as Response);

    expect(mockedService.listBeneficiaries).toHaveBeenCalledWith(
      'suspended',
      3,
      50,
      'BRGN-2026-0026',
      'date',
      'desc'
    );
  });

  it('returns 500 with the error message if the service throws', async () => {
    mockedService.listBeneficiaries.mockRejectedValue(new Error('Boom'));

    await listBeneficiariesController(mockRequest as AuthRequest, mockResponse as Response);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ status: 'error', message: 'Boom' });
  });
});
