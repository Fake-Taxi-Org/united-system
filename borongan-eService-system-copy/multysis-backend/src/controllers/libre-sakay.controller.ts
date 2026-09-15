import { Response } from 'express';
import { GovernmentProgramType } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import {
  getFleetStats,
  getBuses, getBusById, getAvailableRoutes, getAvailableDrivers,
  createBus, updateBus, deleteBus, assignDriverToBus, unassignDriverFromBus,
  getRoutes, getRouteById, getRouteWithStops, createRoute, updateRoute, deleteRoute,
  getDrivers, getDriverById, createDriver, updateDriver, deleteDriver, deleteDriverPermanent,
  assignBusToDriver, unassignBusFromDriver,
  getAllStops, getStopsByRoute, createStop, updateStop, deleteStop,
  assignStopToRoute, removeStopFromRoute, reorderStopsInRoute, replaceStopInRoute, getRoutesForStop,
  getDashboardStats, getRideLogs, getRidesTrend, deleteRideLog, getFleetLocations,
} from '../services/libre-sakay.service';
import {
  listBeneficiaries,
  getBeneficiaryById,
  suspendBeneficiary,
  activateBeneficiary,
  removeBeneficiary,
  exportBeneficiaries,
} from '../services/libre-sakay-beneficiary.service';
import prisma from '../config/database';

// Helper to send paginated response
const paginated = (data: any[], total: number, page: number, limit: number, res: Response) => {
  res.status(200).json({
    status: 'success',
    data,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
};

// =============================================================================
// FLEET
// =============================================================================

export const getFleetStatsController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await getFleetStats();
    res.status(200).json({ status: 'success', data: stats });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// =============================================================================

export const getFleetLocationsController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const locations = await getFleetLocations();
    res.status(200).json({ status: 'success', data: locations });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


// BUSES
// =============================================================================

export const getBusesController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await getBuses(page, limit);
    paginated(result.data, result.total, result.page, result.limit, res);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getBusByIdController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bus = await getBusById(req.params.id);
    if (!bus) { res.status(404).json({ status: 'error', message: 'Bus not found' }); return; }
    res.status(200).json({ status: 'success', data: bus });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getAvailableRoutesController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const routes = await getAvailableRoutes();
    res.status(200).json({ status: 'success', data: routes });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getAvailableDriversController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drivers = await getAvailableDrivers();
    res.status(200).json({ status: 'success', data: drivers });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createBusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plate_number, capacity, route_id, model } = req.body;
    const bus = await createBus(plate_number, capacity, route_id, model);
    res.status(201).json({ status: 'success', data: bus });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const updateBusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bus = await updateBus(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: bus });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteBusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteBus(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const assignDriverController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { driver_id } = req.body;
    await assignDriverToBus(req.params.busId, driver_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const unassignDriverController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { driver_id } = req.body;
    await unassignDriverFromBus(req.params.busId, driver_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// ROUTES
// =============================================================================

export const getRoutesController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await getRoutes(page, limit);
    paginated(result.data, result.total, result.page, result.limit, res);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getRouteByIdController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const route = await getRouteById(req.params.id);
    if (!route) { res.status(404).json({ status: 'error', message: 'Route not found' }); return; }
    res.status(200).json({ status: 'success', data: route });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getRouteWithStopsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const route = await getRouteWithStops(req.params.id);
    if (!route) { res.status(404).json({ status: 'error', message: 'Route not found' }); return; }
    res.status(200).json({ status: 'success', data: route });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const route = await createRoute(name, description);
    res.status(201).json({ status: 'success', data: route });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const updateRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const route = await updateRoute(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: route });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteRoute(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// DRIVERS
// =============================================================================

export const getDriversController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await getDrivers(page, limit);
    paginated(result.data, result.total, result.page, result.limit, res);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getDriverByIdController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const driver = await getDriverById(req.params.id);
    if (!driver) { res.status(404).json({ status: 'error', message: 'Driver not found' }); return; }
    res.status(200).json({ status: 'success', data: driver });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createDriverController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, full_name, phone, password } = req.body;
    const driver = await createDriver(email, full_name, phone, password);
    res.status(201).json({ status: 'success', data: driver });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const updateDriverController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const driver = await updateDriver(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: driver });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteDriverController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteDriver(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteDriverPermanentController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteDriverPermanent(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const assignBusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bus_id } = req.body;
    await assignBusToDriver(req.params.driverId, bus_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const unassignBusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bus_id } = req.body;
    await unassignBusFromDriver(req.params.driverId, bus_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// STOPS
// =============================================================================

export const getAllStopsController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stops = await getAllStops();
    res.status(200).json({ status: 'success', data: stops });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getRoutesForStopController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const routes = await getRoutesForStop(req.params.stopId);
    res.status(200).json({ status: 'success', data: routes });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getStopsByRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stops = await getStopsByRoute(req.params.id);
    res.status(200).json({ status: 'success', data: stops });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createStopController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, latitude, longitude } = req.body;
    const stop = await createStop(name, latitude, longitude);
    res.status(201).json({ status: 'success', data: stop });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const updateStopController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stop = await updateStop(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: stop });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const deleteStopController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteStop(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const assignStopToRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stop_id } = req.body;
    await assignStopToRoute(req.params.routeId, stop_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const removeStopFromRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stop_id } = req.body;
    await removeStopFromRoute(req.params.routeId, stop_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const reorderStopsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stop_ids } = req.body;
    await reorderStopsInRoute(req.params.routeId, stop_ids);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

export const replaceStopInRouteController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { old_stop_id, new_stop_id } = req.body;
    await replaceStopInRoute(req.params.routeId, old_stop_id, new_stop_id);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// DASHBOARD STATS
// =============================================================================

export const getDashboardStatsController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await getDashboardStats();
    res.status(200).json({ status: 'success', data: stats });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// RIDE LOGS
// =============================================================================

export const getRideLogsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      driver_id: req.query.driver_id as string | undefined,
      bus_id: req.query.bus_id as string | undefined,
      status: req.query.status as string | undefined,
    };
    const result = await getRideLogs(page, limit, filters);
    paginated(result.data, result.total, result.page, result.limit, res);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getRidesTrendController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const trend = await getRidesTrend(days);
    res.status(200).json({ status: 'success', data: trend });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteRideLogController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteRideLog(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// RESIDENT VERIFICATION (for Libre Sakay admin)
// =============================================================================

export const verifyResidentController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { residentId } = req.params;

    // Auto-detect: if value contains '@', treat as email, otherwise as residentId
    const isEmail = residentId.includes('@');
    const whereClause = isEmail ? { email: residentId } : { residentId };

    const resident = await prisma.resident.findFirst({
      where: whereClause,
      select: {
        residentId: true,
        firstName: true,
        lastName: true,
        status: true,
        email: true,
        barangay: { select: { barangayName: true } },
      },
    });

    if (!resident) {
      res.status(200).json({
        status: 'success',
        data: {
          exists: false,
          approved: false,
          resident_id: null,
          full_name: null,
          barangay_name: null,
        },
      });
      return;
    }

    const approved = resident.status === 'active' && resident.residentId != null;
    const fullName = [resident.firstName, resident.lastName].filter(Boolean).join(' ');

    res.status(200).json({
      status: 'success',
      data: {
        exists: true,
        approved,
        resident_id: resident.residentId,
        full_name: fullName,
        barangay_name: resident.barangay?.barangayName ?? null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getProgramSettingsController = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const program = await prisma.governmentProgram.findFirst({
      where: { id: 'gp-all-libre-sakay' },
      select: {
        id: true,
        name: true,
        description: true,
        requirements: true,
        types: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!program) {
      res.status(404).json({ status: 'error', message: 'Libre Sakay program not found' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: program,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateProgramSettingsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, requirements, types, isActive } = req.body as {
      name?: string;
      description?: string;
      requirements?: string;
      types?: string[];
      isActive?: boolean;
    };

    const updated = await prisma.governmentProgram.update({
      where: { id: 'gp-all-libre-sakay' },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(requirements !== undefined && { requirements }),
        ...(isActive !== undefined && { isActive }),
        ...(types !== undefined && {
          types: { set: types as GovernmentProgramType[] },
        }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        requirements: true,
        types: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// BENEFICIARIES
// =============================================================================

export const listBeneficiariesController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = (req.query.filter as 'all' | 'active' | 'suspended') || 'all';
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = req.query.search as string | undefined;

    const result = await listBeneficiaries(filter, page, limit, search);
    res.status(200).json({
      status: 'success',
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getBeneficiaryByIdController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const beneficiary = await getBeneficiaryById(id);

    if (!beneficiary) {
      res.status(404).json({ status: 'error', message: 'Beneficiary not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: beneficiary });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const suspendBeneficiaryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await suspendBeneficiary(id);
    res.status(200).json({ status: 'success', message: 'Beneficiary suspended' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const activateBeneficiaryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await activateBeneficiary(id);
    res.status(200).json({ status: 'success', message: 'Beneficiary activated' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const removeBeneficiaryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await removeBeneficiary(id);
    res.status(200).json({ status: 'success', message: 'Beneficiary removed' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const exportBeneficiariesController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = (req.query.filter as 'all' | 'active' | 'suspended') || 'all';
    const beneficiaries = await exportBeneficiaries(filter);

    const headers = [
      'Resident ID',
      'Full Name',
      'Beneficiary Type',
      'Type Of Disability',
      'Email Address',
      'Permanent Address',
      'Date Of Birth',
      'Age',
      'Sex',
      'Remarks',
      'Date of Registration',
      'Status',
    ];

    // RFC 4180-compliant CSV escaping
    const escape = (val: string | null): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = beneficiaries.map((b) => [
      escape(b.residentId),
      escape(b.fullName.toUpperCase()),
      escape(b.beneficiaryTypeLabel),
      escape(b.disabilityType),
      escape(b.email),
      escape(b.address),
      escape(b.birthdate),
      b.age !== null ? String(b.age) : '',
      escape(b.sex),
      escape(b.remarks),
      escape(b.appliedAt),
      escape(b.status),
    ]);

    const csv = [headers.map(escape).join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const date = new Date().toISOString().split('T')[0];
    const filename = `libre-sakay-beneficiaries-${filter}-${date}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// =============================================================================
// RESIDENT — MY STATUS
// =============================================================================

export const getMyBeneficiaryStatusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const residentId = req.user?.id;
    if (!residentId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const { getBeneficiaryStatusByResident } = await import('../services/libre-sakay-beneficiary.service');
    const status = await getBeneficiaryStatusByResident(residentId);
    res.status(200).json({ status: 'success', data: { beneficiary: status } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
