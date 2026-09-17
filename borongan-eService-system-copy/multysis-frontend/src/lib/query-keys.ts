export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },

  residents: {
    all: ['residents'] as const,
    list: (filters: Record<string, unknown>) => ['residents', 'list', filters] as const,
    detail: (id: string) => ['residents', 'detail', id] as const,
    search: (search: string, options?: Record<string, unknown>) => ['residents', 'search', search, options] as const,
  },

  services: {
    all: ['services'] as const,
    list: (page: number, filters?: Record<string, unknown>) => ['services', 'list', page, filters] as const,
    detail: (id: string) => ['services', 'detail', id] as const,
    categories: ['services', 'categories'] as const,
  },

  users: {
    all: ['users'] as const,
    list: (page: number, limit?: number, search?: string) => ['users', 'list', page, limit, search] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  roles: {
    all: ['roles'] as const,
    list: (page: number, limit?: number, search?: string) => ['roles', 'list', page, limit, search] as const,
    detail: (id: string) => ['roles', 'detail', id] as const,
  },

  permissions: {
    all: ['permissions'] as const,
    list: (filters?: Record<string, unknown>) => ['permissions', 'list', filters] as const,
  },

  faqs: {
    all: ['faqs'] as const,
    list: (filters?: Record<string, unknown>) => ['faqs', 'list', filters] as const,
    detail: (id: string) => ['faqs', 'detail', id] as const,
  },

  dashboard: {
    statistics: ['dashboard', 'statistics'] as const,
  },

  transactions: {
    all: ['transactions'] as const,
    list: (filters: Record<string, unknown>) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
    resident: (residentId: string, filters?: Record<string, unknown>) =>
      ['transactions', 'resident', residentId, filters] as const,
  },

  profile: {
    me: ['profile', 'me'] as const,
    household: ['profile', 'household'] as const,
    classifications: ['profile', 'classifications'] as const,
  },

  addresses: {
    all: ['addresses'] as const,
    regions: ['addresses', 'regions'] as const,
    provinces: (regionCode?: string) => ['addresses', 'provinces', regionCode] as const,
    municipalities: (provCode?: string) => ['addresses', 'municipalities', provCode] as const,
    barangays: (munCode?: string) => ['addresses', 'barangays', munCode] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    unread: ['notifications', 'unread'] as const,
    subscriber: ['notifications', 'subscriber'] as const,
    admin: ['notifications', 'admin'] as const,
  },

  medicineRequests: {
    all: ['medicineRequests'] as const,
    list: (filters: Record<string, unknown>) => ['medicineRequests', 'list', filters] as const,
    detail: (id: string) => ['medicineRequests', 'detail', id] as const,
    stats: ['medicineRequests', 'stats'] as const,
  },

  pages: {
    all: ['pages'] as const,
    list: (page: number, limit: number, search?: string) => ['pages', 'list', page, limit, search] as const,
    detail: (id: string) => ['pages', 'detail', id] as const,
    systems: ['pages', 'systems'] as const,
  },

  systems: {
    all: ['systems'] as const,
  },

  libreSakay: {
    fleet: ['libreSakay', 'fleet'] as const,
    fleetLocations: ['libreSakay', 'fleetLocations'] as const,
    buses: {
      all: ['libreSakay', 'buses'] as const,
      list: (page: number, limit?: number) => ['libreSakay', 'buses', 'list', page, limit] as const,
      detail: (id: string) => ['libreSakay', 'buses', 'detail', id] as const,
    },
    routes: {
      all: ['libreSakay', 'routes'] as const,
      list: (page: number, limit?: number) => ['libreSakay', 'routes', 'list', page, limit] as const,
      detail: (id: string) => ['libreSakay', 'routes', 'detail', id] as const,
      stops: (id: string) => ['libreSakay', 'routes', 'stops', id] as const,
    },
    drivers: {
      all: ['libreSakay', 'drivers'] as const,
      list: (page: number, limit?: number) => ['libreSakay', 'drivers', 'list', page, limit] as const,
      detail: (id: string) => ['libreSakay', 'drivers', 'detail', id] as const,
    },
    stops: {
      all: ['libreSakay', 'stops'] as const,
      list: (page: number, limit?: number) => ['libreSakay', 'stops', 'list', page, limit] as const,
      detail: (id: string) => ['libreSakay', 'stops', 'detail', id] as const,
      routes: (id: string) => ['libreSakay', 'stops', 'routes', id] as const,
    },
    dashboardStats: ['libreSakay', 'dashboardStats'] as const,
    ridesTrend: (days: number) => ['libreSakay', 'ridesTrend', days] as const,
    rideLogs: {
      all: ['libreSakay', 'rideLogs'] as const,
      list: (page: number, filters?: object) => ['libreSakay', 'rideLogs', 'list', page, filters] as const,
    },
    beneficiaries: {
      all: ['libreSakay', 'beneficiaries'] as const,
      list: (
        filter: string,
        page: number,
        search?: string,
        sortBy?: string,
        sortOrder?: string,
        limit?: number
      ) =>
        [
          'libreSakay',
          'beneficiaries',
          'list',
          filter,
          page,
          search ?? '',
          sortBy ?? 'date',
          sortOrder ?? 'desc',
          limit ?? 25,
        ] as const,
      detail: (id: string) => ['libreSakay', 'beneficiaries', 'detail', id] as const,
    },
  },
};

export default queryKeys;
