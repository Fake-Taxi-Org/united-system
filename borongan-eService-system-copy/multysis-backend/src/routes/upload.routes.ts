import { Response, Router } from 'express';
import prisma from '../config/database';
import { AuthRequest, verifyAdmin, verifyResident, verifyToken } from '../middleware/auth';
import {
  getFileUrl,
  uploadDocument,
  uploadFileToSupabase,
  uploadProfilePicture,
} from '../middleware/upload';
import { createUploadPresignedUrl, deleteFromSupabase } from '../utils/supabaseStorage';
import { syncBeneficiaryPicture } from '../services/portal-programs.service';

const router = Router();

// Upload profile picture during self-registration (public — no auth required)
// Rate-limited at the route mount level (uploadLimiter in index.ts)
router.post(
  '/registration/profile-picture',
  uploadProfilePicture.single('file'),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!_req.file) {
        res.status(400).json({ status: 'error', message: 'No file uploaded' });
        return;
      }
      const fileUrl = await uploadFileToSupabase(_req.file, 'images', 'profile');
      res.status(200).json({ status: 'success', data: { url: fileUrl, path: fileUrl } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to upload photo' });
    }
  }
);

// Upload profile picture
router.post(
  '/residents/:id/profile-picture',
  verifyAdmin,
  uploadProfilePicture.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
        return;
      }

      const resident = await prisma.resident.findUnique({
        where: { id: req.params.id },
      });

      if (!resident) {
        res.status(404).json({
          status: 'error',
          message: 'Resident not found',
        });
        return;
      }

      const fileUrl = await uploadFileToSupabase(req.file, 'images', 'profile');

      // Delete old profile picture from Supabase if it exists
      if ((resident as any).picturePath) {
        try {
          await deleteFromSupabase((resident as any).picturePath);
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      await prisma.resident.update({
        where: { id: resident.id },
        data: { picturePath: fileUrl } as any,
      });

      await syncBeneficiaryPicture(resident.id, fileUrl);

      res.status(200).json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.originalname,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to upload profile picture',
      });
    }
  }
);

// Get profile picture
router.get(
  '/residents/:id/profile-picture',
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const resident = await prisma.resident.findUnique({
        where: { id: req.params.id },
      });

      if (!resident) {
        res.status(404).json({
          status: 'error',
          message: 'Resident not found',
        });
        return;
      }

      const picturePath: string | null = (resident as any).picturePath ?? null;

      res.status(200).json({
        status: 'success',
        data: {
          url: picturePath ? getFileUrl(picturePath) : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch profile picture',
      });
    }
  }
);

router.post(
  '/resident/profile-picture',
  verifyResident,
  uploadProfilePicture.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
        return;
      }

      const residentId = req.user?.id;
      if (!residentId) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        });
        return;
      }

      const resident = await prisma.resident.findUnique({
        where: { id: residentId },
      });

      if (!resident) {
        res.status(404).json({
          status: 'error',
          message: 'Resident not found',
        });
        return;
      }

      const fileUrl = await uploadFileToSupabase(req.file, 'images', 'profile');

      if ((resident as any).picturePath) {
        try {
          await deleteFromSupabase((resident as any).picturePath);
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      await prisma.resident.update({
        where: { id: resident.id },
        data: { picturePath: fileUrl } as any,
      });

      await syncBeneficiaryPicture(resident.id, fileUrl);

      res.status(200).json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.originalname,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to upload profile picture',
      });
    }
  }
);

// Upload household image (portal self-registration)
router.post(
  '/households/image',
  verifyToken,
  uploadProfilePicture.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ status: 'error', message: 'No file uploaded' });
        return;
      }
      const fileUrl = await uploadFileToSupabase(req.file, 'images', 'household');
      res.status(200).json({ status: 'success', data: { url: fileUrl, path: fileUrl } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to upload image' });
    }
  }
);

// Upload transaction document (temporary - for new transactions)
router.post(
  '/transactions/documents',
  verifyToken,
  uploadDocument.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
        return;
      }

      const fileUrl = await uploadFileToSupabase(req.file, 'documents', 'doc');

      res.status(200).json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.originalname,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to upload document',
      });
    }
  }
);

// Upload transaction document (for existing transaction - admin only)
router.post(
  '/transactions/:id/document',
  verifyAdmin,
  uploadDocument.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
        return;
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: req.params.id },
      });

      if (!transaction) {
        res.status(404).json({
          status: 'error',
          message: 'Transaction not found',
        });
        return;
      }

      const fileUrl = await uploadFileToSupabase(req.file, 'documents', 'doc');

      res.status(200).json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.originalname,
          transactionId: transaction.id,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to upload document',
      });
    }
  }
);

export default router;
