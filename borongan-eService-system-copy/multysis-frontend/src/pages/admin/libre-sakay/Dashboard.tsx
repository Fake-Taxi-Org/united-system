import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { libreSakayService } from '@/services/api/libre-sakay.service';
import { portalProgramsService } from '@/services/api/portal-programs.service';
import { DONUT_COLORS } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { FiTruck, FiGitBranch, FiUsers, FiActivity, FiUserCheck } from 'react-icons/fi';
import { cn } from '@/lib/utils';

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  title,
  value,
  icon,
  color,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'violet' | 'orange';
  loading?: boolean;
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  };
  const { bg, text } = colorMap[color];
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value}</p>
            )}
          </div>
          <div className={`p-3 ${bg} rounded-lg ${text}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: number | string | undefined;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="h-7 w-12 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// DASHBOARD SECTION
// =============================================================================

const APP_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

export function DashboardSection() {
  const { data: dashStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: queryKeys.libreSakay.dashboardStats,
    queryFn: libreSakayService.getDashboardStats,
    retry: false,
  });

  const { data: fleetStats, error: fleetError } = useQuery({
    queryKey: queryKeys.libreSakay.fleet,
    queryFn: libreSakayService.getFleetStats,
    refetchInterval: 30_000,
  });

  const { data: trend, error: trendError } = useQuery({
    queryKey: queryKeys.libreSakay.ridesTrend(7),
    queryFn: () => libreSakayService.getRidesTrend(7),
    retry: false,
  });

  const { data: pendingData, error: pendingError } = useQuery({
    queryKey: ['libre-sakay', 'pending-apps'],
    queryFn: () =>
      portalProgramsService.listApplicationsAdmin({
        status: 'pending',
        programId: 'gp-all-libre-sakay',
        limit: 1,
      }),
    retry: false,
  });

  const { data: recentApps, isLoading: recentLoading, error: recentAppsError } = useQuery({
    queryKey: ['libre-sakay', 'recent-apps'],
    queryFn: () =>
      portalProgramsService.listApplicationsAdmin({
        programId: 'gp-all-libre-sakay',
        limit: 5,
        status: 'pending', // only pending — approved moves to Beneficiaries tab
      }),
    retry: false,
  });

  const fleetDonutData = fleetStats
    ? [
        { name: 'Moving', value: fleetStats.moving },
        { name: 'Parked', value: fleetStats.parked },
      ]
    : [];

  const trendData = (trend ?? []).map(p => ({
    ...p,
    label: new Date(p.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }),
    repeat: Math.max(0, p.rides - p.unique_passengers),
  }));

  const hasError = !!(statsError || fleetError || trendError || pendingError || recentAppsError);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>Failed to load dashboard data.</strong> Some stats may be out of date. Check the server logs.
          </div>
        )}
        {/* Row 1: 5 stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Active Buses"
          value={dashStats?.active_buses ?? fleetStats?.total ?? '-'}
          icon={<FiTruck size={20} />}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          title="Active Routes"
          value={dashStats?.active_routes ?? '-'}
          icon={<FiGitBranch size={20} />}
          color="green"
          loading={statsLoading}
        />
        <StatCard
          title="Enrolled Drivers"
          value={dashStats?.total_drivers ?? '-'}
          icon={<FiUsers size={20} />}
          color="violet"
          loading={statsLoading}
        />
        <StatCard
          title="Rides Today"
          value={dashStats?.rides_today ?? '-'}
          icon={<FiActivity size={20} />}
          color="orange"
          loading={statsLoading}
        />
        <StatCard
          title="Pending Applications"
          value={pendingData?.pagination.total ?? 0}
          icon={<FiUserCheck size={20} />}
          color="violet"
        />
      </div>

      {/* Row 2: Fleet donut + 7-day bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Live Fleet Status</CardTitle>
              <span className="text-xs text-gray-500">
                Updated {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              {(fleetStats?.moving ?? 0) + (fleetStats?.parked ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {fleetDonutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: number, name: string) => [`${v} buses`, name]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  No active buses in fleet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Rides — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      formatter={(v: number, name: string) => [
                        v,
                        name === 'unique_passengers' ? 'Unique Passengers' : 'Repeat Rides',
                      ]}
                    />
                    <Bar dataKey="unique_passengers" stackId="rides" fill="#10b981" radius={[0, 0, 0, 0]} name="unique_passengers" />
                    <Bar dataKey="repeat" stackId="rides" fill="#3b82f6" radius={[3, 3, 0, 0]} name="repeat" />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  No ride data yet — logs will appear here
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Weekly effectiveness summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard title="Rides This Week" value={dashStats?.rides_this_week} loading={statsLoading} />
        <MiniCard
          title="Unique Passengers This Week"
          value={dashStats?.unique_passengers_this_week}
          loading={statsLoading}
        />
        <MiniCard
          title="Avg Rides / Passenger"
          value={
            dashStats?.avg_rides_per_passenger != null
              ? Number(dashStats.avg_rides_per_passenger.toFixed(1))
              : undefined
          }
          loading={statsLoading}
        />
        <MiniCard
          title="Repeat Rider Rate"
          value={
            dashStats?.repeat_rider_rate != null
              ? `${Number(dashStats.repeat_rider_rate.toFixed(1))}%`
              : undefined
          }
          loading={statsLoading}
        />
      </div>

      {/* Row 4: Recent Applications */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Applications</CardTitle>
            <a
              href="/admin/libre-sakay/applications"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All →
            </a>
          </div>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : recentApps?.data.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No applications yet</div>
          ) : (
            <div className="space-y-2">
              {recentApps?.data.map(app => {
                const fullName = [app.resident.firstName, app.resident.middleName, app.resident.lastName]
                  .filter(Boolean)
                  .join(' ');
                const statusConf =
                  APP_STATUS_CONFIG[app.status] ?? { label: app.status, className: 'bg-gray-100 text-gray-600' };
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium text-heading-700 truncate">{fullName}</p>
                      <p className="text-xs text-gray-500">{app.program.name}</p>
                    </div>
                    <Badge className={cn('text-xs shrink-0', statusConf.className)}>
                      {statusConf.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </ErrorBoundary>
  );
}
