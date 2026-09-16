import api from './auth.service';

// =============================================================================
// TYPES
// =============================================================================

export interface Bus {
  id: string;
  plate_number: string;
  model: string | null;
  capacity: number;
  is_active: boolean;
  route_id: string | null;
  created_at: string;
  updated_at: string;
  routes: { id: string; name: string } | null;
  driver_buses?: Array<{
    id: string;
    profiles: { id: string; full_name: string; phone: string | null };
  }>;
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  route_stops: Array<{ count: number }>;
}

export interface Driver {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  driver_buses: Array<{
    id: string;
    buses: { id: string; plate_number: string };
  }>;
}

export interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  route_count?: number;
}

export interface RouteStopJunction {
  id: string; // route_stops junction PK
  stop_id: string; // FK to stops
  sequence_order: number;
  stops: { id: string; name: string; latitude: number; longitude: number };
}

export interface FleetStats {
  total: number;
  moving: number;
  parked: number;
}

export interface FleetBus {
  bus_id: string;
  plate_number: string;
  model: string | null;
  capacity: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: 'moving' | 'parked';
  route_name: string | null;
  driver_name: string | null;
  barangay_name: string | null;
  updated_at: string;
}

export interface DashboardStats {
  total_buses: number;
  active_buses: number;
  active_routes: number;
  total_drivers: number;
  rides_today: number;
  rides_this_week: number;
  unique_passengers_this_week: number;
  avg_rides_per_passenger: number;
  repeat_rider_rate: number;
}

export interface RidesTrendPoint {
  date: string;
  rides: number;
  unique_passengers: number;
}

export interface RideLog {
  id: string;
  bus_id: string | null;
  driver_id: string | null;
  resident_id: string | null;
  is_verified: boolean;
  boarded_at: string;
  boarded_barangay: string | null;
  alighted_at: string | null;
  alighted_barangay: string | null;
  synced: boolean;
  buses: { plate_number: string; route_id: string | null; routes: { name: string } | null } | null;
  driver: { full_name: string } | null;
  resident: { residentId: string | null; firstName: string; lastName: string } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ResidentVerification {
  exists: boolean;
  approved: boolean;
  resident_id: string | null;
  full_name: string | null;
  barangay_name: string | null;
}

export type GovernmentProgramTypeEnum = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT' | 'SOLO_PARENT' | 'HEALTHCARE_WORKER' | 'ALL';

import type { RequirementsConfig } from '@/validations/government-program.schema';

export interface LibreSakayProgramSettings {
  id: string;
  name: string;
  description: string | null;
  requirements: RequirementsConfig;
  types: GovernmentProgramTypeEnum[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API SERVICE
// =============================================================================

const BASE = '/admin/libre-sakay';

export const libreSakayService = {
  // Fleet
  async getFleetStats(): Promise<FleetStats> {
    const response = await api.get(`${BASE}/fleet/stats`);
    return response.data.data;
  },

  async getFleetLocations(): Promise<FleetBus[]> {
    const response = await api.get(`${BASE}/fleet/locations`);
    return response.data.data;
  },

  // Buses
  async getBuses(page = 1, limit = 20): Promise<PaginatedResponse<Bus>> {
    const response = await api.get(`${BASE}/buses`, { params: { page, limit } });
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async getBusById(id: string): Promise<Bus> {
    const response = await api.get(`${BASE}/buses/${id}`);
    return response.data.data;
  },

  async getAvailableRoutes(): Promise<{ id: string; name: string }[]> {
    const response = await api.get(`${BASE}/buses/available/routes`);
    return response.data.data;
  },

  async getAvailableDrivers(): Promise<{ id: string; full_name: string; phone: string | null }[]> {
    const response = await api.get(`${BASE}/buses/available/drivers`);
    return response.data.data;
  },

  async createBus(data: { plate_number: string; capacity: number; model?: string; route_id?: string }): Promise<Bus> {
    const response = await api.post(`${BASE}/buses`, data);
    return response.data.data;
  },

  async updateBus(
    id: string,
    data: Partial<{ plate_number: string; capacity: number; model: string | null; route_id: string | null; is_active: boolean }>
  ): Promise<Bus> {
    const response = await api.patch(`${BASE}/buses/${id}`, data);
    return response.data.data;
  },

  async deleteBus(id: string): Promise<void> {
    await api.delete(`${BASE}/buses/${id}`);
  },

  async assignDriverToBus(busId: string, driverId: string): Promise<void> {
    await api.post(`${BASE}/buses/${busId}/drivers`, { driver_id: driverId });
  },

  async unassignDriverFromBus(busId: string, driverId: string): Promise<void> {
    await api.delete(`${BASE}/buses/${busId}/drivers`, { data: { driver_id: driverId } });
  },

  // Routes
  async getRoutes(page = 1, limit = 20): Promise<PaginatedResponse<Route>> {
    const response = await api.get(`${BASE}/routes`, { params: { page, limit } });
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async getRouteById(id: string): Promise<Route> {
    const response = await api.get(`${BASE}/routes/${id}`);
    return response.data.data;
  },

  async getRouteStops(routeId: string): Promise<RouteStopJunction[]> {
    const response = await api.get(`${BASE}/routes/${routeId}/stops`);
    return response.data.data;
  },

  async createRoute(data: { name: string; description?: string }): Promise<Route> {
    const response = await api.post(`${BASE}/routes`, data);
    return response.data.data;
  },

  async updateRoute(
    id: string,
    data: Partial<{ name: string; description: string; is_active: boolean }>
  ): Promise<Route> {
    const response = await api.patch(`${BASE}/routes/${id}`, data);
    return response.data.data;
  },

  async deleteRoute(id: string): Promise<void> {
    await api.delete(`${BASE}/routes/${id}`);
  },

  // Drivers
  async getDrivers(page = 1, limit = 20): Promise<PaginatedResponse<Driver>> {
    const response = await api.get(`${BASE}/drivers`, { params: { page, limit } });
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async getDriverById(id: string): Promise<Driver> {
    const response = await api.get(`${BASE}/drivers/${id}`);
    return response.data.data;
  },

  async createDriver(data: { email: string; full_name: string; phone: string; password: string }): Promise<Driver> {
    const response = await api.post(`${BASE}/drivers`, data);
    return response.data.data;
  },

  async updateDriver(
    id: string,
    data: Partial<{ full_name: string; phone: string; is_active: boolean }>
  ): Promise<Driver> {
    const response = await api.patch(`${BASE}/drivers/${id}`, data);
    return response.data.data;
  },

  async deleteDriver(id: string): Promise<void> {
    await api.delete(`${BASE}/drivers/${id}`);
  },

  async hardDeleteDriver(id: string): Promise<void> {
    await api.delete(`${BASE}/drivers/${id}/permanent`);
  },

  async assignBusToDriver(driverId: string, busId: string): Promise<void> {
    await api.post(`${BASE}/drivers/${driverId}/buses`, { bus_id: busId });
  },

  async unassignBusFromDriver(driverId: string, busId: string): Promise<void> {
    await api.delete(`${BASE}/drivers/${driverId}/buses`, { data: { bus_id: busId } });
  },

  // Stops
  async getAllStops(): Promise<Stop[]> {
    const response = await api.get(`${BASE}/stops`);
    return response.data.data;
  },

  async getRoutesForStop(stopId: string): Promise<{ route_id: string; route_name: string | null; route_is_active: boolean; sequence_order: number }[]> {
    const response = await api.get(`${BASE}/stops/${stopId}/routes`);
    return response.data.data;
  },

  async createStop(data: { name: string; latitude: number; longitude: number }): Promise<Stop> {
    const response = await api.post(`${BASE}/stops`, data);
    return response.data.data;
  },

  async updateStop(id: string, data: Partial<{ name: string; latitude: number; longitude: number }>): Promise<Stop> {
    const response = await api.patch(`${BASE}/stops/${id}`, data);
    return response.data.data;
  },

  async deleteStop(id: string): Promise<void> {
    await api.delete(`${BASE}/stops/${id}`);
  },

  async assignStopToRoute(routeId: string, stopId: string): Promise<void> {
    await api.post(`${BASE}/routes/${routeId}/stops`, { stop_id: stopId });
  },

  async removeStopFromRoute(routeId: string, stopId: string): Promise<void> {
    await api.delete(`${BASE}/routes/${routeId}/stops`, { data: { stop_id: stopId } });
  },

  async reorderStopsInRoute(routeId: string, stopIds: string[]): Promise<void> {
    await api.patch(`${BASE}/routes/${routeId}/stops/reorder`, { stop_ids: stopIds });
  },

  async replaceStopInRoute(routeId: string, oldStopId: string, newStopId: string): Promise<void> {
    await api.patch(`${BASE}/routes/${routeId}/stops/replace`, { old_stop_id: oldStopId, new_stop_id: newStopId });
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get(`${BASE}/dashboard/stats`);
    return response.data.data;
  },

  async getRidesTrend(days = 7): Promise<RidesTrendPoint[]> {
    const response = await api.get(`${BASE}/ride-logs/trend`, { params: { days } });
    return response.data.data;
  },

  // Ride Logs
  async getRideLogs(
    page = 1,
    limit = 20,
    filters?: { from?: string; to?: string; route_id?: string; driver_id?: string; bus_id?: string; status?: string }
  ): Promise<PaginatedResponse<RideLog>> {
    const response = await api.get(`${BASE}/ride-logs`, { params: { page, limit, ...filters } });
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async deleteRideLog(id: string): Promise<void> {
    await api.delete(`${BASE}/ride-logs/${id}`);
  },

  // Resident Verification
  async verifyResident(residentId: string): Promise<ResidentVerification> {
    const response = await api.get(`${BASE}/residents/verify/${encodeURIComponent(residentId)}`);
    return response.data.data;
  },

  // Program Settings
  async getProgramSettings(): Promise<LibreSakayProgramSettings> {
    const response = await api.get(`${BASE}/program-settings`);
    return response.data.data;
  },

  async updateProgramSettings(data: {
    name?: string;
    description?: string;
    requirements?: RequirementsConfig;
    types?: GovernmentProgramTypeEnum[];
    isActive?: boolean;
  }): Promise<LibreSakayProgramSettings> {
    const payload = {
      ...data,
      ...(data.requirements !== undefined && {
        requirements: JSON.stringify(data.requirements),
      }),
    };
    const response = await api.patch(`${BASE}/program-settings`, payload);
    return response.data.data;
  },
};
