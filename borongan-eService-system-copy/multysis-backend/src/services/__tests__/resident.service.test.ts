import { updateMyProfile } from '../resident.service';
import prisma from '../../config/database';
import cacheService from '../cache.service';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    resident: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../cache.service', () => ({
  __esModule: true,
  default: {
    del: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockResolvedValue(true),
    delPattern: jest.fn().mockResolvedValue(0),
  },
}));

const mockStorageRemove = jest.fn();
jest.mock('../../config/supabase', () => ({
  getSupabase: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        remove: mockStorageRemove,
      })),
    },
  })),
  ESERVICE_BUCKET: 'eservice-uploads',
}));

jest.mock('../auth.service', () => ({
  formatResidentResponse: jest.fn((resident) => resident),
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

describe('resident.service - updateMyProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockResident = {
    id: 'resident-1',
    residentId: 'RES-2025-0000001',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@example.com',
    picturePath: null,
    status: 'active',
    barangayId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('picturePath handling', () => {
    it('should accept and save picturePath in self-update', async () => {
      const updateData = {
        picturePath: 'https://example.com/storage/pictures/resident-1.jpg',
      };

      const updatedResident = {
        ...mockResident,
        picturePath: updateData.picturePath,
        barangay: {
          id: 1,
          barangayName: 'Poblacion',
          municipality: { id: 1, municipalityName: 'Borongan' },
        },
        credentials: { googleId: null },
        seniorCitizenBeneficiary: [],
        pwdBeneficiary: [],
        studentBeneficiary: [],
        soloParentBeneficiary: [],
      };

      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(mockResident);
      (mockedPrisma.resident.update as jest.Mock).mockResolvedValue(updatedResident);

      const result = await updateMyProfile('resident-1', updateData);

      expect(mockedPrisma.resident.findUnique).toHaveBeenCalledWith({
        where: { id: 'resident-1' },
      });
      expect(mockedPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'resident-1' },
        data: updateData,
        include: {
          barangay: { include: { municipality: true } },
          credentials: { select: { googleId: true } },
          seniorCitizenBeneficiary: true,
          pwdBeneficiary: true,
          studentBeneficiary: true,
          soloParentBeneficiary: true,
        },
      });
      expect(mockedCacheService.del).toHaveBeenCalledWith('resident:resident-1:profile');
      expect(result.picturePath).toBe(updateData.picturePath);
    });

    it('should allow setting picturePath to null', async () => {
      const residentWithPicture = {
        ...mockResident,
        picturePath: 'https://example.com/storage/pictures/resident-1.jpg',
      };

      const updateData = {
        picturePath: null,
      };

      const updatedResident = {
        ...residentWithPicture,
        picturePath: null,
        barangay: {
          id: 1,
          barangayName: 'Poblacion',
          municipality: { id: 1, municipalityName: 'Borongan' },
        },
        credentials: { googleId: null },
        seniorCitizenBeneficiary: [],
        pwdBeneficiary: [],
        studentBeneficiary: [],
        soloParentBeneficiary: [],
      };

      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(residentWithPicture);
      (mockedPrisma.resident.update as jest.Mock).mockResolvedValue(updatedResident);
      mockStorageRemove.mockResolvedValue({ error: null });

      const result = await updateMyProfile('resident-1', updateData);

      expect(mockedPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'resident-1' },
        data: updateData,
        include: {
          barangay: { include: { municipality: true } },
          credentials: { select: { googleId: true } },
          seniorCitizenBeneficiary: true,
          pwdBeneficiary: true,
          studentBeneficiary: true,
          soloParentBeneficiary: true,
        },
      });
      expect(result.picturePath).toBeNull();
    });

    it('should save other fields correctly alongside picturePath', async () => {
      const updateData = {
        sex: 'Female',
        civilStatus: 'Married',
        picturePath: 'https://example.com/storage/pictures/new-profile.jpg',
      };

      const updatedResident = {
        ...mockResident,
        ...updateData,
        barangay: {
          id: 1,
          barangayName: 'Poblacion',
          municipality: { id: 1, municipalityName: 'Borongan' },
        },
        credentials: { googleId: null },
        seniorCitizenBeneficiary: [],
        pwdBeneficiary: [],
        studentBeneficiary: [],
        soloParentBeneficiary: [],
      };

      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(mockResident);
      (mockedPrisma.resident.update as jest.Mock).mockResolvedValue(updatedResident);

      const result = await updateMyProfile('resident-1', updateData);

      expect(mockedPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'resident-1' },
        data: updateData,
        include: {
          barangay: { include: { municipality: true } },
          credentials: { select: { googleId: true } },
          seniorCitizenBeneficiary: true,
          pwdBeneficiary: true,
          studentBeneficiary: true,
          soloParentBeneficiary: true,
        },
      });
      expect(result.sex).toBe('Female');
      expect(result.civilStatus).toBe('Married');
      expect(result.picturePath).toBe(updateData.picturePath);
    });
  });

  describe('birthdate handling', () => {
    const setupResidentMock = (resident: object, updated: object) => {
      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(resident);
      (mockedPrisma.resident.update as jest.Mock).mockResolvedValue(updated);
    };

    it('normalizes a date-only string (YYYY-MM-DD) to a Date at UTC midnight', async () => {
      const updatedResident = {
        ...mockResident,
        birthdate: new Date('2005-06-27T00:00:00.000Z'),
      };
      setupResidentMock(mockResident, updatedResident);

      await updateMyProfile('resident-1', { birthdate: '2005-06-27' });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.birthdate).toBeInstanceOf(Date);
      expect((updateCall.data.birthdate as Date).toISOString()).toBe('2005-06-27T00:00:00.000Z');
    });

    it('normalizes a full ISO-8601 string to a Date', async () => {
      const updatedResident = {
        ...mockResident,
        birthdate: new Date('2005-06-27T12:34:56.000Z'),
      };
      setupResidentMock(mockResident, updatedResident);

      await updateMyProfile('resident-1', { birthdate: '2005-06-27T12:34:56Z' });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.birthdate).toBeInstanceOf(Date);
      expect((updateCall.data.birthdate as Date).toISOString()).toBe('2005-06-27T12:34:56.000Z');
    });

    it('passes null birthdate through unchanged', async () => {
      setupResidentMock(mockResident, mockResident);

      await updateMyProfile('resident-1', { birthdate: null });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.birthdate).toBeNull();
    });

    it('passes undefined birthdate through unchanged', async () => {
      setupResidentMock(mockResident, mockResident);

      await updateMyProfile('resident-1', { sex: 'Female' });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.birthdate).toBeUndefined();
    });
  });

  describe('picturePath overwrite guard', () => {
    const setup = (resident: object, updated: object) => {
      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(resident);
      (mockedPrisma.resident.update as jest.Mock).mockResolvedValue(updated);
    };

    it('drops empty-string picturePath so the existing photo is preserved', async () => {
      const residentWithPhoto = {
        ...mockResident,
        picturePath: 'https://example.com/storage/old-photo.jpg',
      };
      setup(residentWithPhoto, residentWithPhoto);

      await updateMyProfile('resident-1', { sex: 'Female', picturePath: '' });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('picturePath');
      expect(updateCall.data.sex).toBe('Female');
    });

    it('writes picturePath when an explicit URL is provided', async () => {
      const newUrl = 'https://example.com/storage/new-photo.jpg';
      const updatedResident = { ...mockResident, picturePath: newUrl };
      setup(mockResident, updatedResident);

      await updateMyProfile('resident-1', { picturePath: newUrl });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.picturePath).toBe(newUrl);
    });

    it('writes null when picturePath is explicitly null', async () => {
      setup(mockResident, mockResident);

      await updateMyProfile('resident-1', { picturePath: null });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.picturePath).toBeNull();
    });

    it('does not include picturePath when the key is absent from the payload', async () => {
      setup(mockResident, mockResident);

      await updateMyProfile('resident-1', { sex: 'Female' });

      const updateCall = (mockedPrisma.resident.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('picturePath');
    });
  });

  describe('error handling', () => {
    it('should throw error if resident not found', async () => {
      (mockedPrisma.resident.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateMyProfile('non-existent', { picturePath: 'test.jpg' })
      ).rejects.toThrow('Resident not found');

      expect(mockedPrisma.resident.update).not.toHaveBeenCalled();
    });
  });
});
