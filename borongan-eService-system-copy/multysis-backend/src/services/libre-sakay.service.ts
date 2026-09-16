import { getLibreSakaySupabase } from '../config/libre-sakay-supabase';
import prisma from '../config/database';

// =============================================================================
// HELPERS
// =============================================================================

const supabase = () => getLibreSakaySupabase();

// Postgres returns UTC timestamps as "...+00" which Node ≥20 strict mode rejects
// in `new Date(...)`. Replace "+00" with "Z" so the parser accepts it.
const parseBoardedAt = (s: string): Date => new Date(s.replace(/\+00$/, 'Z'));

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
  driver_buses: Array<{
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
  driver_buses: Array<{ id: string; buses: { id: string; plate_number: string } }>;
}

export interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface FleetStats {
  total: number;
  moving: number;
  parked: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export interface FleetLocation {
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

// =============================================================================
// FLEET LOCATIONS (live map data for /admin/libre-sakay/fleet)
// =============================================================================

export const getFleetLocations = async (): Promise<FleetLocation[]> => {
  // Fetch active buses with their basic info
  const { data: buses, error: busError } = await supabase()
    .from('buses')
    .select('id, plate_number, model, capacity')
    .eq('is_active', true);

  if (busError) throw new Error('Failed to fetch bus fleet: ' + busError.message);

  const busIds = (buses ?? []).map(b => b.id);
  if (busIds.length === 0) return [];

  // Fetch latest location per bus using the pre-built view (already deduplicated, includes barangay_name)
  const { data: locations, error: locError } = await supabase()
    .from('latest_bus_locations')
    .select('bus_id, latitude, longitude, speed, heading, recorded_at, barangay_name')
    .in('bus_id', busIds);

  if (locError) throw new Error('Failed to fetch locations: ' + locError.message);

  const locationMap = new Map((locations ?? []).map(row => [row.bus_id, row as Record<string, unknown>]));

  // Fetch route and driver info
  const { data: busDetails, error: detailError } = await supabase()
    .from('buses')
    .select('id, route_id, routes(name), driver_buses(id, profiles(full_name))')
    .in('id', busIds);

  if (detailError) throw new Error('Failed to fetch bus details: ' + detailError.message);

  const detailMap = new Map((busDetails ?? []).map((b: any) => [b.id, b]));

  const result: FleetLocation[] = [];
  for (const bus of buses ?? []) {
    const loc = locationMap.get(bus.id);
    const detail = detailMap.get(bus.id) as any;
    const speed = (loc?.speed as number) ?? 0;
    const driver = detail?.driver_buses?.[0]?.profiles?.full_name ?? null;
    const route = detail?.routes?.name ?? null;

    result.push({
      bus_id: bus.id,
      plate_number: bus.plate_number,
      model: bus.model ?? null,
      capacity: bus.capacity ?? 0,
      latitude: (loc?.latitude as number) ?? 0,
      longitude: (loc?.longitude as number) ?? 0,
      speed,
      heading: (loc?.heading as number) ?? 0,
      status: speed > 5 ? 'moving' : 'parked',
      route_name: route,
      driver_name: driver,
      barangay_name: (loc?.barangay_name as string | null) ?? null,
      updated_at: (loc?.recorded_at as string) ?? new Date().toISOString(),
    });
  }

  return result;
};
// =============================================================================
// FLEET STATS (read-only)
// =============================================================================

export const getFleetStats = async (): Promise<FleetStats> => {
  // Only consider buses whose most recent GPS ping is within the last 5 minutes
  // (otherwise the moving/parked classification is based on stale data).
  const freshnessThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase()
    .from('bus_locations')
    .select('speed, bus_id, recorded_at')
    .gte('recorded_at', freshnessThreshold)
    .order('recorded_at', { ascending: false });

  if (error) throw new Error('Failed to fetch fleet stats: ' + error.message);

  // Deduplicate by bus_id (latest record first), then classify
  const seen = new Set<string>();
  const buses: Array<{ bus_id: string; speed: number }> = [];
  for (const row of data ?? []) {
    if (!seen.has(row.bus_id)) {
      seen.add(row.bus_id);
      buses.push({ bus_id: row.bus_id, speed: row.speed ?? 0 });
    }
  }

  const moving = buses.filter(b => b.speed > 5).length;

  return {
    total: buses.length,
    moving,
    parked: buses.length - moving,
  };
};

// =============================================================================
// BUSES
// =============================================================================

export const getBuses = async (page = 1, limit = 20): Promise<PaginatedResult<Bus>> => {
  const from = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    supabase()
      .from('buses')
      .select('*, routes(id, name), driver_buses(id, profiles(id, full_name, phone))', { count: 'exact' })
      .order('plate_number')
      .range(from, from + limit - 1),
    supabase().from('buses').select('id', { count: 'exact', head: true }),
  ]);

  if (dataResult.error) throw new Error('Failed to fetch buses: ' + dataResult.error.message);

  return {
    data: dataResult.data ?? [],
    total: countResult.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult.count ?? 0) / limit),
  };
};

export const getBusById = async (id: string): Promise<Bus | null> => {
  const { data, error } = await supabase()
    .from('buses')
    .select('*, routes(id, name), driver_buses(id, profiles(id, full_name, phone))')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('Failed to fetch bus: ' + error.message);
  return data;
};

export const getAvailableRoutes = async () => {
  const { data, error } = await supabase().from('routes').select('id, name').eq('is_active', true).order('name');
  if (error) throw new Error('Failed to fetch routes: ' + error.message);
  return data;
};

export const getAvailableDrivers = async () => {
  // All drivers (not just unassigned â€” frontend filters)
  const { data, error } = await supabase()
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'driver')
    .eq('is_active', true)
    .order('full_name');

  if (error) throw new Error('Failed to fetch drivers: ' + error.message);
  return data;
};

export const createBus = async (plate_number: string, capacity: number, route_id?: string, model?: string) => {
  const { data, error } = await supabase()
    .from('buses')
    .insert({
      plate_number,
      capacity,
      is_active: true,
      ...(route_id ? { route_id } : {}),
      ...(model ? { model } : {}),
    })
    .select()
    .single();

  if (error) throw new Error('Failed to create bus: ' + error.message);
  return data;
};

export const updateBus = async (
  id: string,
  updates: { plate_number?: string; capacity?: number; route_id?: string | null; is_active?: boolean; model?: string | null }
) => {
  const { data, error } = await supabase()
    .from('buses')
    .update(updates)
    .eq('id', id)
    .select('*, routes(id, name), driver_buses(id, profiles(id, full_name, phone))')
    .single();

  if (error) throw new Error('Failed to update bus: ' + error.message);
  return data;
};

export const deleteBus = async (id: string) => {
  const { error } = await supabase().from('buses').delete().eq('id', id);
  if (error) throw new Error('Failed to delete bus: ' + error.message);
};

export const assignDriverToBus = async (busId: string, driverId: string) => {
  const { error } = await supabase()
    .from('driver_buses')
    .insert({ bus_id: busId, driver_id: driverId });
  if (error) throw new Error('Failed to assign driver: ' + error.message);
};

export const unassignDriverFromBus = async (busId: string, driverId: string) => {
  const { error } = await supabase()
    .from('driver_buses')
    .delete()
    .eq('bus_id', busId)
    .eq('driver_id', driverId);
  if (error) throw new Error('Failed to unassign driver: ' + error.message);
};

// =============================================================================
// ROUTES
// =============================================================================

export const getRoutes = async (page = 1, limit = 20): Promise<PaginatedResult<Route>> => {
  const from = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    supabase()
      .from('routes')
      .select('*, route_stops(count)', { count: 'exact' })
      .order('name')
      .range(from, from + limit - 1),
    supabase().from('routes').select('id', { count: 'exact', head: true }),
  ]);

  if (dataResult.error) throw new Error('Failed to fetch routes: ' + dataResult.error.message);

  return {
    data: dataResult.data ?? [],
    total: countResult.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult.count ?? 0) / limit),
  };
};

export const getRouteById = async (id: string) => {
  const { data, error } = await supabase().from('routes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Failed to fetch route: ' + error.message);
  return data;
};

export const getRouteWithStops = async (id: string) => {
  const { data, error } = await supabase()
    .from('routes')
    .select('*, stops(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Failed to fetch route with stops: ' + error.message);
  return data;
};

export const createRoute = async (name: string, description?: string) => {
  const { data, error } = await supabase()
    .from('routes')
    .insert({ name, description, is_active: true })
    .select()
    .single();
  if (error) throw new Error('Failed to create route: ' + error.message);
  return data;
};

export const updateRoute = async (id: string, updates: { name?: string; description?: string; is_active?: boolean }) => {
  const { data, error } = await supabase().from('routes').update(updates).eq('id', id).select().single();
  if (error) throw new Error('Failed to update route: ' + error.message);
  return data;
};

export const deleteRoute = async (id: string) => {
  const { error } = await supabase().from('routes').delete().eq('id', id);
  if (error) throw new Error('Failed to delete route: ' + error.message);
};

// =============================================================================
// DRIVERS (profiles with role=driver)
// =============================================================================

export const getDrivers = async (page = 1, limit = 20): Promise<PaginatedResult<Driver>> => {
  const from = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    supabase()
      .from('profiles')
      .select('*, driver_buses(buses(id, plate_number))', { count: 'exact' })
      .eq('role', 'driver')
      .order('full_name')
      .range(from, from + limit - 1),
    supabase().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
  ]);

  if (dataResult.error) throw new Error('Failed to fetch drivers: ' + dataResult.error.message);

  return {
    data: dataResult.data ?? [],
    total: countResult.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult.count ?? 0) / limit),
  };
};

export const getDriverById = async (id: string) => {
  const { data, error } = await supabase()
    .from('profiles')
    .select('*, driver_buses(buses(id, plate_number))')
    .eq('id', id)
    .eq('role', 'driver')
    .maybeSingle();
  if (error) throw new Error('Failed to fetch driver: ' + error.message);
  return data;
};

export const createDriver = async (email: string, full_name: string, phone: string, password: string) => {
  // 1. Create auth user (auto-confirm email â€” same as manual creation in Supabase dashboard with "Send email to verify" disabled)
  const { data: authData, error: authError } = await supabase().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'driver' },
  });
  if (authError || !authData.user) throw new Error('Failed to create auth user: ' + (authError?.message ?? 'unknown'));

  // 2. Update profile with email included
  const { error: profileError } = await supabase()
    .from('profiles')
    .update({ email, full_name, phone, role: 'driver', is_active: true })
    .eq('id', authData.user.id);
  if (profileError) throw new Error('Failed to update profile: ' + profileError.message);

  return authData.user;
};

export const updateDriver = async (
  id: string,
  updates: { full_name?: string; phone?: string; is_active?: boolean }
) => {
  const { data, error } = await supabase()
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('*, driver_buses(buses(id, plate_number))')
    .single();
  if (error) throw new Error('Failed to update driver: ' + error.message);
  return data;
};

export const deleteDriver = async (id: string) => {
  // Soft delete â€” set is_active = false
  const { error } = await supabase().from('profiles').update({ is_active: false }).eq('id', id);
  if (error) throw new Error('Failed to delete driver: ' + error.message);
};

export const deleteDriverPermanent = async (id: string) => {
  // Hard delete â€” permanently removes the driver record
  // Also remove driver-bus assignments first to avoid FK issues

  // 1. Remove driver-bus assignments
  const { error: assignmentError } = await supabase()
    .from('driver_buses')
    .delete()
    .eq('driver_id', id);
  if (assignmentError) throw new Error('Failed to remove driver assignments: ' + assignmentError.message);

  // 2. Delete Supabase Auth user (orphaned otherwise)
  const { error: authError } = await supabase().auth.admin.deleteUser(id);
  if (authError) throw new Error('Failed to delete auth user: ' + authError.message);

  // 3. Delete profile record
  const { error } = await supabase().from('profiles').delete().eq('id', id);
  if (error) throw new Error('Failed to permanently delete driver: ' + error.message);
};

export const assignBusToDriver = async (driverId: string, busId: string) => {
  const { error } = await supabase().from('driver_buses').insert({ driver_id: driverId, bus_id: busId });
  if (error) throw new Error('Failed to assign bus: ' + error.message);
};

export const unassignBusFromDriver = async (driverId: string, busId: string) => {
  const { error } = await supabase()
    .from('driver_buses')
    .delete()
    .eq('driver_id', driverId)
    .eq('bus_id', busId);
  if (error) throw new Error('Failed to unassign bus: ' + error.message);
};

// =============================================================================
// STOPS
// =============================================================================

export const getAllStops = async () => {
  const { data: stops, error } = await supabase()
    .from('stops')
    .select('id, name, latitude, longitude, created_at')
    .order('name');

  if (error) throw new Error('Failed to fetch stops: ' + error.message);

  const stopIds = (stops ?? []).map(s => s.id);
  if (stopIds.length === 0) return [];

  const { data: routeStopCounts, error: countError } = await supabase()
    .from('route_stops')
    .select('stop_id')
    .in('stop_id', stopIds);

  if (countError) throw new Error('Failed to fetch route counts: ' + countError.message);

  const countMap = new Map<string, number>();
  for (const rs of routeStopCounts ?? []) {
    countMap.set(rs.stop_id, (countMap.get(rs.stop_id) ?? 0) + 1);
  }

  return (stops ?? []).map(stop => ({
    ...stop,
    route_count: countMap.get(stop.id) ?? 0,
  }));
};

export const getRoutesForStop = async (stopId: string) => {
  const { data, error } = await supabase()
    .from('route_stops')
    .select('route_id, sequence_order, routes(id, name, is_active)')
    .eq('stop_id', stopId)
    .order('sequence_order');

  if (error) throw new Error('Failed to fetch routes for stop: ' + error.message);

  // Deduplicate by route
  const seen = new Set<string>();
  const result = [];
  for (const row of data ?? []) {
    if (!seen.has(row.route_id)) {
      seen.add(row.route_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routeInfo = (row.routes as any) ?? {};
      result.push({
        route_id: row.route_id,
        route_name: routeInfo.name ?? null,
        route_is_active: routeInfo.is_active ?? false,
        sequence_order: row.sequence_order,
      });
    }
  }
  return result;
};

export const getStopsByRoute = async (routeId: string) => {
  const { data, error } = await supabase()
    .from('route_stops')
    .select('id, stop_id, stops(id, name, latitude, longitude), sequence_order')
    .eq('route_id', routeId)
    .order('sequence_order');
  if (error) throw new Error('Failed to fetch route stops: ' + error.message);
  return data ?? [];
};

export const createStop = async (name: string, latitude: number, longitude: number) => {
  const { data, error } = await supabase()
    .from('stops')
    .insert({ name, latitude, longitude })
    .select()
    .single();
  if (error) throw new Error('Failed to create stop: ' + error.message);
  return data;
};

export const updateStop = async (
  id: string,
  updates: { name?: string; latitude?: number; longitude?: number }
) => {
  const { data, error } = await supabase().from('stops').update(updates).eq('id', id).select().single();
  if (error) throw new Error('Failed to update stop: ' + error.message);
  return data;
};

export const deleteStop = async (id: string) => {
  const { error } = await supabase().from('stops').delete().eq('id', id);
  if (error) throw new Error('Failed to delete stop: ' + error.message);
};

export const assignStopToRoute = async (routeId: string, stopId: string) => {
  // Get next sequence_order
  const { data: existing, error: fetchError } = await supabase()
    .from('route_stops')
    .select('sequence_order')
    .eq('route_id', routeId)
    .order('sequence_order', { ascending: false })
    .limit(1);

  if (fetchError) throw new Error('Failed to get route stops: ' + fetchError.message);
  const nextOrder = existing?.length ? (existing[0].sequence_order ?? 0) + 1 : 1;

  const { error } = await supabase()
    .from('route_stops')
    .insert({ route_id: routeId, stop_id: stopId, sequence_order: nextOrder });
  if (error) throw new Error('Failed to assign stop to route: ' + error.message);
};

export const removeStopFromRoute = async (routeId: string, stopId: string) => {
  if (!stopId) throw new Error('stopId is required');
  if (!routeId) throw new Error('routeId is required');
  const { error } = await supabase()
    .from('route_stops')
    .delete()
    .eq('route_id', routeId)
    .eq('stop_id', stopId);
  if (error) throw new Error('Failed to remove stop from route: ' + error.message);
};

export const reorderStopsInRoute = async (routeId: string, stopIds: string[]) => {
  // Two-pass update to avoid unique constraint conflicts.
  if (stopIds.length > 0) {
    const { error: resetError } = await supabase()
      .from('route_stops')
      .update({ sequence_order: 0 })
      .eq('route_id', routeId)
      .in('stop_id', stopIds);
    if (resetError) throw new Error('Failed to reorder stops: ' + resetError.message);
  }
  // route_stops has no UNIQUE(route_id, stop_id) constraint (verified via Supabase
  // Fire one update per stop in parallel via Promise.all.
  const results = await Promise.all(
    stopIds.map((stopId, idx) =>
      supabase()
        .from('route_stops')
        .update({ sequence_order: idx + 1 })
        .eq('route_id', routeId)
        .eq('stop_id', stopId)
    )
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) {
    throw new Error('Failed to reorder stops: ' + firstError.error.message);
  }
};

export const replaceStopInRoute = async (routeId: string, oldStopId: string, newStopId: string) => {
  // Get the sequence_order of the old stop
  const { data: oldStop, error: fetchError } = await supabase()
    .from('route_stops')
    .select('sequence_order')
    .eq('route_id', routeId)
    .eq('stop_id', oldStopId)
    .maybeSingle();

  if (fetchError) throw new Error('Failed to fetch old stop: ' + fetchError.message);
  if (!oldStop) throw new Error('Old stop not found in route');

  const sequenceOrder = oldStop.sequence_order;

  // Remove old stop
  const { error: deleteError } = await supabase()
    .from('route_stops')
    .delete()
    .eq('route_id', routeId)
    .eq('stop_id', oldStopId);

  if (deleteError) throw new Error('Failed to remove old stop: ' + deleteError.message);

  // Insert new stop at same position
  const { error: insertError } = await supabase()
    .from('route_stops')
    .insert({
      route_id: routeId,
      stop_id: newStopId,
      sequence_order: sequenceOrder,
    });

  if (insertError) throw new Error('Failed to insert new stop: ' + insertError.message);
};

// =============================================================================
// DASHBOARD STATS
// =============================================================================

export const getDashboardStats = async () => {
  // Get today's date in PHT (Asia/Manila)
  const now = new Date();
  const phtDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const todayPHT = `${phtDateStr}T00:00:00+08:00`;

  const [busCount, activeBusCount, routeCount, driverCount, ridesToday, ridesWeek] = await Promise.all([
    supabase().from('buses').select('id', { count: 'exact', head: true }),
    supabase().from('buses').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase().from('routes').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'driver').eq('is_active', true),
    supabase()
      .from('ride_logs')
      .select('id', { count: 'exact', head: true })
      .gte('boarded_at', todayPHT),
    supabase()
      .from('ride_logs')
      .select('resident_id')
      .gte('boarded_at', new Date(new Date(todayPHT).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString())
      .not('resident_id', 'is', null),
  ]);

  // Effectiveness stats over the 7-day PHT window. ride_logs has no passenger_count
  // column — each row is one boarding by one resident, so "passengers" == "riders"
  // and the meaningful metrics are unique-rider reach and repeat-rider rate.
  const weekRows = (ridesWeek.data ?? []) as Array<{ resident_id: string }>;
  const ridesThisWeek = weekRows.length;
  const uniquePassengersThisWeek = new Set(weekRows.map(r => r.resident_id)).size;
  const rideCountByResident: Record<string, number> = {};
  for (const r of weekRows) {
    rideCountByResident[r.resident_id] = (rideCountByResident[r.resident_id] ?? 0) + 1;
  }
  const repeatPassengers = Object.values(rideCountByResident).filter(c => c > 1).length;
  const repeatRiderRate = uniquePassengersThisWeek > 0
    ? Math.round((repeatPassengers / uniquePassengersThisWeek) * 1000) / 10
    : 0;
  const avgRidesPerPassenger = uniquePassengersThisWeek > 0
    ? Math.round((ridesThisWeek / uniquePassengersThisWeek) * 10) / 10
    : 0;

  return {
    total_buses: busCount.count ?? 0,
    active_buses: activeBusCount.count ?? 0,
    active_routes: routeCount.count ?? 0,
    total_drivers: driverCount.count ?? 0,
    rides_today: ridesToday.count ?? 0,
    rides_this_week: ridesThisWeek,
    unique_passengers_this_week: uniquePassengersThisWeek,
    avg_rides_per_passenger: avgRidesPerPassenger,
    repeat_rider_rate: repeatRiderRate,
  };
};

// =============================================================================
// RIDE LOGS
// =============================================================================

export interface RideLogFilters {
  from?: string;
  to?: string;
  route_id?: string;
  driver_id?: string;
  bus_id?: string;
  status?: string;
}

export const getRideLogs = async (page = 1, limit = 20, filters: RideLogFilters = {}): Promise<PaginatedResult<any>> => {
  const from = (page - 1) * limit;

  // ride_logs columns: id, bus_id, driver_id, resident_id, is_verified, boarded_at,
  // boarded_barangay, alighted_at, alighted_barangay, synced
  // NOTE: ride_logs has NO route_id, started_at, ended_at, passenger_count, status, or notes.
  //       Route association is through buses(buses.route_id).
  let query = supabase()
    .from('ride_logs')
    .select(
      'id, bus_id, driver_id, resident_id, boarded_at, boarded_barangay, alighted_at, alighted_barangay, is_verified, synced, buses(plate_number, route_id, routes(name)), driver:profiles(full_name)',
      { count: 'exact' }
    )
    .order('boarded_at', { ascending: false })
    .range(from, from + limit - 1);

  if (filters.from) query = query.gte('boarded_at', filters.from + 'T00:00:00+08:00');
  if (filters.to) query = query.lte('boarded_at', filters.to + 'T23:59:59+08:00');
  if (filters.route_id) {
    // Filter via buses.route_id â€” fetch all ride_logs then filter in JS since Supabase
    // doesn't support nested FK filtering on referenced tables in the same query
    const { data: busesWithRoute } = await supabase()
      .from('buses')
      .select('id')
      .eq('route_id', filters.route_id);
    if (!busesWithRoute?.length) return { data: [], total: 0, page, limit, totalPages: 0 };
    query = query.in('bus_id', busesWithRoute.map((b: { id: string }) => b.id));
  }
  if (filters.driver_id) query = query.eq('driver_id', filters.driver_id);
  if (filters.bus_id) query = query.eq('bus_id', filters.bus_id);

  if (filters.status === 'onboard') {
    query = query.is('alighted_at', null);
  } else if (filters.status === 'completed') {
    query = query.not('alighted_at', 'is', null);
  }

  const { data, error, count } = await query;
  if (error) throw new Error('Failed to fetch ride logs: ' + error.message);

  // Enrich scanned (non-manual) entries with resident names from e-service DB
  const scannedLogs = (data ?? []).filter((log: any) => log.resident_id);
  if (scannedLogs.length > 0) {
    // Step 1: Get resident_uuid from libre_sakay_beneficiary (Libre Sakay DB)
    const residentIds = scannedLogs.map((log: any) => log.resident_id);
    const { data: beneficiaries } = await supabase()
      .from('libre_sakay_beneficiary')
      .select('resident_id, resident_uuid')
      .in('resident_id', residentIds);

    if (beneficiaries && beneficiaries.length > 0) {
      const residentUuidMap = new Map(beneficiaries.map((b: any) => [b.resident_id, b.resident_uuid]));
      const residentUuids = [...new Set([...residentUuidMap.values()])];

      // Step 2: Get resident names from e-service DB (Prisma) via UUID mapping
      const residents = await prisma.resident.findMany({
        where: { id: { in: residentUuids } },
        select: { id: true, residentId: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(residents.map((r: any) => [r.id, r]));

      // Step 3: Attach resident info to each scanned log
      for (const log of scannedLogs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = log as any;
        const uuid = residentUuidMap.get(row.resident_id);
        const resident = uuid ? nameMap.get(uuid) : null;
        row.resident = resident
          ? { residentId: (resident as any).residentId, firstName: (resident as any).firstName, lastName: (resident as any).lastName }
          : null;
      }

      // Step 4: Fallback â€” for scanned logs where beneficiary mapping was not found,
      // directly query e-service DB using residentId (display ID like "BRGN-2026-0010001")
      const unfoundLogs = scannedLogs.filter((log: any) => !log.resident);
      if (unfoundLogs.length > 0) {
        const unfoundIds = unfoundLogs.map((log: any) => log.resident_id);
        const fallbackResidents = await prisma.resident.findMany({
          where: { residentId: { in: unfoundIds } },
          select: { residentId: true, firstName: true, lastName: true },
        });
        const fallbackMap = new Map(fallbackResidents.map((r: any) => [r.residentId, r]));

        for (const log of unfoundLogs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = log as any;
          const fallback = fallbackMap.get(row.resident_id);
          if (fallback) {
            row.resident = {
              residentId: fallback.residentId,
              firstName: fallback.firstName,
              lastName: fallback.lastName,
            };
          }
        }
      }
    }
  }

  return { data: data ?? [], total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) };
};

export const getRidesTrend = async (days = 7): Promise<{ date: string; rides: number; unique_passengers: number }[]> => {
  const now = new Date();
  // Get "today" in PHT
  const phtTodayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const since = new Date(`${phtTodayStr}T00:00:00+08:00`);
  since.setDate(since.getDate() - (days - 1));

  const { data, error } = await supabase()
    .from('ride_logs')
    .select('boarded_at, resident_id')
    .gte('boarded_at', since.toISOString());

  if (error) throw new Error('Failed to fetch rides trend: ' + error.message);

  const byDay: Record<string, { rides: number; uniqueSet: Set<string> }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const dStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    byDay[dStr] = { rides: 0, uniqueSet: new Set() };
  }

  for (const row of (data ?? []) as Array<{ boarded_at: string; resident_id: string | null }>) {
    if (!row.resident_id) continue;
    const boardedAt = parseBoardedAt(row.boarded_at);
    if (isNaN(boardedAt.getTime())) continue;
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(boardedAt);
    const bucket = byDay[day];
    if (!bucket) continue;
    bucket.rides++;
    bucket.uniqueSet.add(row.resident_id);
  }

  return Object.entries(byDay).map(([date, v]) => ({
    date,
    rides: v.rides,
    unique_passengers: v.uniqueSet.size,
  }));
};

export const deleteRideLog = async (id: string): Promise<void> => {
  const { error } = await supabase().from('ride_logs').delete().eq('id', id);
  if (error) throw new Error('Failed to delete ride log: ' + error.message);
};
