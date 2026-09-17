import { Router } from 'express';
import { body } from 'express-validator';
import { verifyAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  getFleetStatsController, getFleetLocationsController,
  getBusesController, getBusByIdController, getAvailableRoutesController,
  getAvailableDriversController, createBusController, updateBusController,
  deleteBusController, assignDriverController, unassignDriverController,
  getRoutesController, getRouteByIdController, getRouteWithStopsController,
  createRouteController, updateRouteController, deleteRouteController,
  getDriversController, getDriverByIdController, createDriverController,
  updateDriverController, deleteDriverController, deleteDriverPermanentController,
  assignBusController, unassignBusController,
  getAllStopsController, getStopsByRouteController, createStopController,
  updateStopController, deleteStopController, assignStopToRouteController,
  removeStopFromRouteController, reorderStopsController, replaceStopInRouteController,
  getRoutesForStopController,
  getDashboardStatsController,
  getRideLogsController, getRidesTrendController, deleteRideLogController,
  verifyResidentController,
  getProgramSettingsController,
  updateProgramSettingsController,
  listBeneficiariesController,
  getBeneficiaryByIdController,
  suspendBeneficiaryController,
  activateBeneficiaryController,
  removeBeneficiaryController,
  exportBeneficiariesController,
  bulkSuspendBeneficiariesController,
  bulkActivateBeneficiariesController,
  bulkRemoveBeneficiariesController,
} from '../controllers/libre-sakay.controller';
import {
  getBusesValidation, getBusByIdValidation, createBusValidation,
  updateBusValidation, deleteBusValidation, assignDriverValidation,
  getRoutesValidation, createRouteValidation, updateRouteValidation,
  getDriversValidation, createDriverValidation, updateDriverValidation,
  createStopValidation, updateStopValidation, assignStopToRouteValidation,
  reorderStopsValidation, replaceStopInRouteValidation,
  listBeneficiariesValidation,
  bulkBeneficiaryIdsValidation,
  getBeneficiaryByIdValidation,
  suspendBeneficiaryValidation,
  activateBeneficiaryValidation,
  removeBeneficiaryValidation,
  exportBeneficiariesValidation,
} from '../validations/libre-sakay.schema';

const router = Router();

router.use(verifyAdmin); // All routes require admin auth

// Dashboard
router.get('/dashboard/stats', getDashboardStatsController);

// Fleet
router.get('/fleet/stats', getFleetStatsController);
router.get('/fleet/locations', getFleetLocationsController);

// Buses
router.get('/buses', validate(getBusesValidation), getBusesController);
router.get('/buses/available/routes', getAvailableRoutesController);
router.get('/buses/available/drivers', getAvailableDriversController);
router.get('/buses/:id', validate(getBusByIdValidation), getBusByIdController);
router.post('/buses', validate(createBusValidation), createBusController);
router.patch('/buses/:id', validate(updateBusValidation), updateBusController);
router.delete('/buses/:id', validate(deleteBusValidation), deleteBusController);
router.post('/buses/:busId/drivers', validate(assignDriverValidation), assignDriverController);
router.delete('/buses/:busId/drivers', validate(assignDriverValidation), unassignDriverController);

// Routes
router.get('/routes', validate(getRoutesValidation), getRoutesController);
router.get('/routes/:id', getRouteByIdController);
router.get('/routes/:id/stops', getStopsByRouteController);
router.post('/routes', validate(createRouteValidation), createRouteController);
router.patch('/routes/:id', validate(updateRouteValidation), updateRouteController);
router.delete('/routes/:id', deleteRouteController);

// Drivers
router.get('/drivers', validate(getDriversValidation), getDriversController);
router.get('/drivers/:id', getDriverByIdController);
router.post('/drivers', validate(createDriverValidation), createDriverController);
router.patch('/drivers/:id', validate(updateDriverValidation), updateDriverController);
// NOTE: permanent delete MUST be before /drivers/:id to avoid Express matching it first
router.delete('/drivers/:id/permanent', deleteDriverPermanentController);
router.delete('/drivers/:id', deleteDriverController);
router.post('/drivers/:driverId/buses', assignBusController);
router.delete('/drivers/:driverId/buses', unassignBusController);

// Stops
router.get('/stops', getAllStopsController);
router.get('/stops/:stopId/routes', getRoutesForStopController);
router.post('/stops', validate(createStopValidation), createStopController);
router.patch('/stops/:id', validate(updateStopValidation), updateStopController);
router.delete('/stops/:id', deleteStopController);
router.post('/routes/:routeId/stops', validate(assignStopToRouteValidation), assignStopToRouteController);
router.delete('/routes/:routeId/stops', removeStopFromRouteController);
router.patch('/routes/:routeId/stops/reorder', validate(reorderStopsValidation), reorderStopsController);
router.patch('/routes/:routeId/stops/replace', validate(replaceStopInRouteValidation), replaceStopInRouteController);

// Ride Logs
router.get('/ride-logs', getRideLogsController);
router.get('/ride-logs/trend', getRidesTrendController);
router.delete('/ride-logs/:id', deleteRideLogController);

// Resident Verification (Libre Sakay admin checks if a resident is approved)
router.get('/residents/verify/:residentId', verifyResidentController);

// Program Settings
router.get('/program-settings', getProgramSettingsController);
router.patch(
  '/program-settings',
  validate([
    body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().isString().trim(),
    body('requirements').optional().isString().trim(),
    body('types').optional().isArray().withMessage('types must be an array'),
    body('types.*').optional().isIn(['SENIOR_CITIZEN', 'PWD', 'STUDENT', 'SOLO_PARENT', 'HEALTHCARE_WORKER', 'ALL']),
    body('isActive').optional().isBoolean(),
  ]),
  updateProgramSettingsController,
);

// Beneficiaries
router.get('/beneficiaries', validate(listBeneficiariesValidation), listBeneficiariesController);
router.get('/beneficiaries/export', validate(exportBeneficiariesValidation), exportBeneficiariesController);
router.get('/beneficiaries/:id', validate(getBeneficiaryByIdValidation), getBeneficiaryByIdController);
router.patch('/beneficiaries/:id/suspend', validate(suspendBeneficiaryValidation), suspendBeneficiaryController);
router.patch('/beneficiaries/:id/activate', validate(activateBeneficiaryValidation), activateBeneficiaryController);
router.delete('/beneficiaries/:id', validate(removeBeneficiaryValidation), removeBeneficiaryController);
// Bulk operations — must come before `/beneficiaries/:id` routes? Actually no, Express matches PATCH /beneficiaries/bulk-suspend as a different path.
router.patch('/beneficiaries/bulk-suspend', validate(bulkBeneficiaryIdsValidation), bulkSuspendBeneficiariesController);
router.patch('/beneficiaries/bulk-activate', validate(bulkBeneficiaryIdsValidation), bulkActivateBeneficiariesController);
router.delete('/beneficiaries/bulk', validate(bulkBeneficiaryIdsValidation), bulkRemoveBeneficiariesController);

export default router;
