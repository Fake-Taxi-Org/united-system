import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiTruck, FiClock } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRoute } from '@/hooks/useRoutes';
import { RouteMap } from '@/components/libre-sakay/RouteMap';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type { RouteStop } from '@/hooks/useRoutes';
import { useNextBusETA } from '@/hooks/useNextBusETA';
import { cn } from '@/lib/utils';
import { getRouteGeometry } from '@/lib/routing';
import { useBusLocations } from '@/hooks/useBusLocations';

interface BusOnRoute {
  id: string;
  plate_number: string;
  is_active: boolean;
}

function useBusesOnRoute(routeId: string | null) {
  return useQuery<BusOnRoute[]>({
    queryKey: ['buses-on-route', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      const { data, error } = await supabase
        .from('buses')
        .select('id, plate_number, is_active')
        .eq('route_id', routeId)
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!routeId,
    staleTime: 30_000,
  });
}

interface StopCardProps {
  stop: RouteStop;
  routeId: string;
  index: number;
  selectedStop: RouteStop | null;
  onToggle: (stop: RouteStop) => void;
}

function StopCard({ stop, routeId, index, selectedStop, onToggle }: StopCardProps) {
  const { data: etas = [], isLoading: etaLoading } = useNextBusETA(routeId, stop);
  const nearest = etas.length > 0 ? etas.reduce((min, curr) => curr.etaMinutes < min.etaMinutes ? curr : min) : null;

  return (
    <Card
      className={cn('border cursor-pointer transition-all', selectedStop?.id === stop.id ? 'border-primary-300 bg-primary-50 shadow-sm' : 'border-gray-100 shadow-sm hover:border-primary-200')}
      onClick={() => onToggle(stop)}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold', selectedStop?.id === stop.id ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-700')}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-heading-700 text-sm">{stop.name}</p>
          </div>
          {etaLoading ? (
            <div className="w-14 h-5 bg-gray-100 animate-pulse rounded flex-shrink-0" />
          ) : nearest ? (
            <div className="flex items-center gap-1 bg-primary-50 border border-primary-100 rounded-md px-2 py-1 flex-shrink-0">
              <FiClock size={11} className="text-primary-500" />
              <span className="text-xs font-semibold text-primary-700">{nearest.etaMinutes} min</span>
            </div>
          ) : null}
          <FiMapPin className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: route, isLoading } = useRoute(id ?? null);
  const { data: buses = [], isLoading: busesLoading } = useBusesOnRoute(id ?? null);
  const { data: allBusLocations = [] } = useBusLocations(15_000);
  const routeBusLocations = allBusLocations.filter(b => b.bus?.route?.id === id);
  const { data: routeGeometry } = useQuery({
    queryKey: ['route-geometry', id, route?.stops.map(s => `${s.id}-${s.latitude}-${s.longitude}`)],
    queryFn: () => route?.stops ? getRouteGeometry(route.stops) : null,
    enabled: !!route?.stops?.length,
    staleTime: 5 * 60 * 1000, // 5 minutes — route geometry doesn't change often
  });
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/libre-sakay/routes')}
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Back to routes"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/da-logo.png" alt="DA" className="h-7 w-auto" />
            <span className="font-semibold text-heading-700">Libre Sakay</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {isLoading ? (
          <>
            <div className="h-8 w-48 bg-gray-100 animate-pulse rounded" />
            <div className="h-64 bg-gray-100 animate-pulse rounded-xl" />
          </>
        ) : !route ? (
          <Card className="border border-dashed border-gray-200">
            <CardContent className="py-10 text-center">
              <p className="text-gray-400 text-sm">Route not found.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Route header */}
            <div>
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-heading-800">{route.name}</h1>
                <Badge variant="outline" className="text-xs border-primary-200 text-primary-700 bg-primary-50">
                  {route.stops.length} stops
                </Badge>
              </div>
              {route.description && (
                <p className="text-sm text-gray-500 mt-1">{route.description}</p>
              )}
            </div>

            {/* Map */}
            <div>
              <h2 className="text-sm font-semibold text-heading-600 uppercase tracking-wide mb-2">
                Route Map
              </h2>
              <RouteMap
                height="340px"
                stops={route.stops}
                routeGeometry={routeGeometry}
                busLocations={routeBusLocations}
                onStopClick={setSelectedStop}
              />
            </div>

            {/* Buses on this route */}
            <div>
              <h2 className="text-sm font-semibold text-heading-600 uppercase tracking-wide mb-2">
                Active Buses on Route
              </h2>
              {busesLoading ? (
                <div className="h-16 bg-gray-100 animate-pulse rounded-xl" />
              ) : buses.length === 0 ? (
                <Card className="border border-dashed border-gray-200">
                  <CardContent className="py-6 text-center">
                    <p className="text-gray-400 text-sm">No active buses on this route.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {buses.map(bus => (
                    <div
                      key={bus.id}
                      className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2 shadow-sm"
                    >
                      <FiTruck className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-heading-700">{bus.plate_number}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          bus.is_active === true
                            ? 'border-green-200 text-green-700 bg-green-50'
                            : 'border-gray-200 text-gray-500'
                        }`}
                      >
                        {bus.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stops list */}
            <div>
              <h2 className="text-sm font-semibold text-heading-600 uppercase tracking-wide mb-2">
                Stops ({route.stops.length})
              </h2>
              {route.stops.length === 0 ? (
                <Card className="border border-dashed border-gray-200">
                  <CardContent className="py-6 text-center">
                    <p className="text-gray-400 text-sm">No stops defined for this route.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {route.stops.map((stop, index) => (
                    <StopCard
                      key={stop.id}
                      stop={stop}
                      routeId={route.id}
                      index={index}
                      selectedStop={selectedStop}
                      onToggle={(s) => setSelectedStop(selectedStop?.id === s.id ? null : s)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
