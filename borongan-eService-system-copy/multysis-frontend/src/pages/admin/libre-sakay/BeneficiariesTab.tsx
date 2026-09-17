import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  FiDownload,
  FiUserX,
  FiUserCheck,
  FiUser,
  FiSearch,
  FiX,
  FiLoader,
  FiTrash2,
} from 'react-icons/fi';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/hooks/use-toast';
import {
  libreSakayBeneficiaryService,
  type BeneficiaryListItem,
} from '@/services/api/libre-sakay-beneficiary.service';
import { BeneficiariesTable, type BeneficiarySortKey } from './BeneficiariesTable';
import { BeneficiaryDetailsModal } from './BeneficiaryDetailsModal';
import { RemoveBeneficiaryDialog } from './RemoveBeneficiaryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardHeader } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';

type FilterTab = 'all' | 'active' | 'suspended';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

// ============================================================================
// Suspend / Activate confirmation dialog (reused for single + bulk)
// ============================================================================

function SuspendActivateDialog({
  open,
  onClose,
  beneficiary,
  bulkBeneficiaries,
  action,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  beneficiary: BeneficiaryListItem | null;
  bulkBeneficiaries?: { id: string; fullName: string }[];
  action: 'suspend' | 'activate';
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isBulk = !!bulkBeneficiaries && bulkBeneficiaries.length > 0;
  const targetIds = isBulk ? bulkBeneficiaries!.map(b => b.id) : [beneficiary!.id];
  const displayNames = isBulk
    ? bulkBeneficiaries!.map(b => b.fullName)
    : [beneficiary!.fullName];
  const label = action === 'suspend' ? 'Suspend' : 'Activate';

  const mutation = useMutation({
    mutationFn: async () => {
      if (isBulk) {
        if (action === 'suspend') return libreSakayBeneficiaryService.bulkSuspend(targetIds);
        return libreSakayBeneficiaryService.bulkActivate(targetIds);
      }
      if (action === 'suspend') {
        await libreSakayBeneficiaryService.suspend(targetIds[0]);
        return { updated: 1, failed: [] };
      }
      await libreSakayBeneficiaryService.activate(targetIds[0]);
      return { updated: 1, failed: [] };
    },
    onSuccess: result => {
      // Force every beneficiary list/detail query to refetch.
      queryClient.invalidateQueries({ queryKey: queryKeys.libreSakay.beneficiaries.all });
      const suffix =
        result.failed.length > 0
          ? ` (${result.updated} updated, ${result.failed.length} skipped)`
          : '';
      toast({
        title: `${targetIds.length} beneficiary${targetIds.length === 1 ? '' : 'ies'} ${action === 'suspend' ? 'suspended' : 'activated'} successfully${suffix}`,
      });
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'suspend' ? (
              <FiUserX className="text-amber-500" />
            ) : (
              <FiUserCheck className="text-green-600" />
            )}
            {isBulk ? `Bulk ${label}` : `${label} Beneficiary`}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {isBulk ? (
              <>
                {label} <strong>{targetIds.length}</strong> selected{' '}
                {targetIds.length === 1 ? 'beneficiary' : 'beneficiaries'}?
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs space-y-0.5 border border-gray-200 rounded-md p-2 bg-gray-50">
                  {displayNames.slice(0, 5).map((n, i) => (
                    <li key={i} className="truncate">
                      • {n}
                    </li>
                  ))}
                  {displayNames.length > 5 && (
                    <li className="text-gray-500 italic">
                      … and {displayNames.length - 5} more
                    </li>
                  )}
                </ul>
              </>
            ) : action === 'suspend' ? (
              `Are you sure you want to suspend ${beneficiary?.fullName}? They will lose access to the Libre Sakay program.`
            ) : (
              `Are you sure you want to activate ${beneficiary?.fullName}? They will regain access to the Libre Sakay program.`
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={action === 'suspend' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={action === 'activate' ? 'bg-green-600 hover:bg-green-700' : undefined}
          >
            {mutation.isPending
              ? 'Processing...'
              : isBulk
              ? `${label} ${targetIds.length}`
              : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Bulk remove confirmation dialog
// ============================================================================

function BulkRemoveDialog({
  open,
  onClose,
  bulkBeneficiaries,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  bulkBeneficiaries: { id: string; fullName: string }[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ids = bulkBeneficiaries.map(b => b.id);

  const mutation = useMutation({
    mutationFn: () => libreSakayBeneficiaryService.bulkRemove(ids),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libreSakay.beneficiaries.all });
      const suffix =
        result.failed.length > 0
          ? ` (${result.updated} removed, ${result.failed.length} skipped)`
          : '';
      toast({
        title: `${ids.length} beneficiary${ids.length === 1 ? '' : 'ies'} removed${suffix}`,
      });
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <FiTrash2 />
            Bulk Remove Beneficiaries
          </DialogTitle>
          <DialogDescription className="pt-2">
            Permanently remove <strong>{ids.length}</strong> selected{' '}
            {ids.length === 1 ? 'beneficiary' : 'beneficiaries'}? This cannot be undone.
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs space-y-0.5 border border-gray-200 rounded-md p-2 bg-gray-50">
              {bulkBeneficiaries.slice(0, 5).map((b, i) => (
                <li key={i} className="truncate">
                  • {b.fullName}
                </li>
              ))}
              {bulkBeneficiaries.length > 5 && (
                <li className="text-gray-500 italic">
                  … and {bulkBeneficiaries.length - 5} more
                </li>
              )}
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Removing...' : `Remove ${ids.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main tab component
// ============================================================================

export function BeneficiariesTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read state from URL (so refresh keeps state; shareable URLs).
  const filter = (searchParams.get('filter') as FilterTab) || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('limit') || '25', 10);
  const sortBy = (searchParams.get('sortBy') as BeneficiarySortKey) || 'date';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const urlSearch = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [suspendActivate, setSuspendActivate] = useState<
    | { mode: 'single' | 'bulk'; action: 'suspend' | 'activate'; id?: string }
    | null
  >(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);

  // Helper to update multiple URL params at once.
  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  };

  // Debounce search input → committed search (drives the query).
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== urlSearch) {
        updateParams({ q: trimmed || null, page: '1' });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, urlSearch]);

  // Sync searchInput when URL changes externally (e.g., back button).
  useEffect(() => {
    if (urlSearch !== searchInput) setSearchInput(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  // Auto-clear selection when filter/page/sort/search change (safe default).
  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, pageSize, sortBy, sortOrder, urlSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.libreSakay.beneficiaries.list(filter, page, urlSearch, sortBy, sortOrder, pageSize),
    queryFn: () =>
      libreSakayBeneficiaryService.list({
        filter,
        page,
        limit: pageSize,
        search: urlSearch.trim() || undefined,
        sortBy,
        sortOrder,
      }),
    placeholderData: prev => prev,
  });

  // All counts (always unfiltered) for the pill-tab badges.
  const countAll = useQuery({
    queryKey: queryKeys.libreSakay.beneficiaries.list('all', 1, '', 'date', 'desc', 1),
    queryFn: () =>
      libreSakayBeneficiaryService.list({ filter: 'all', page: 1, limit: 1, sortBy: 'date', sortOrder: 'desc' }),
    select: res => res.pagination.total,
    staleTime: 60_000,
  });
  const countActive = useQuery({
    queryKey: queryKeys.libreSakay.beneficiaries.list('active', 1, '', 'date', 'desc', 1),
    queryFn: () =>
      libreSakayBeneficiaryService.list({ filter: 'active', page: 1, limit: 1, sortBy: 'date', sortOrder: 'desc' }),
    select: res => res.pagination.total,
    staleTime: 60_000,
  });
  const countSuspended = useQuery({
    queryKey: queryKeys.libreSakay.beneficiaries.list('suspended', 1, '', 'date', 'desc', 1),
    queryFn: () =>
      libreSakayBeneficiaryService.list({ filter: 'suspended', page: 1, limit: 1, sortBy: 'date', sortOrder: 'desc' }),
    select: res => res.pagination.total,
    staleTime: 60_000,
  });

  const beneficiaryMap = new Map((data?.data ?? []).map(b => [b.id, b]));

  const handleClearSearch = () => {
    setSearchInput('');
    updateParams({ q: null, page: '1' });
  };

  const handleClearAll = () => {
    setSearchInput('');
    updateParams({ filter: null, q: null, page: '1' });
  };

  const handleView = (id: string) => {
    setSelectedId(id);
    setDetailsOpen(true);
  };

  const handleSingleSuspend = (id: string) => setSuspendActivate({ mode: 'single', action: 'suspend', id });
  const handleSingleActivate = (id: string) => setSuspendActivate({ mode: 'single', action: 'activate', id });
  const handleSingleRemove = (id: string) => setRemoveId(id);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const selectedBeneficiaryEntries = useMemo(() => {
    const out: { id: string; fullName: string }[] = [];
    for (const id of selectedIds) {
      const b = beneficiaryMap.get(id);
      if (b) out.push({ id, fullName: b.fullName });
    }
    return out;
  }, [selectedIds, beneficiaryMap]);

  const handleBulkSuspend = () => setSuspendActivate({ mode: 'bulk', action: 'suspend' });
  const handleBulkActivate = () => setSuspendActivate({ mode: 'bulk', action: 'activate' });
  const handleBulkRemove = () => setBulkRemoveOpen(true);

  const handleToggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (!data?.data) return;
    if (checked) {
      setSelectedIds(new Set(data.data.map(b => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleExport = () => {
    libreSakayBeneficiaryService.exportAsBlob(filter);
  };

  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  const tabCount = (tab: FilterTab): number | null => {
    if (tab === 'all') return countAll.data ?? null;
    if (tab === 'active') return countActive.data ?? null;
    return countSuspended.data ?? null;
  };

  const isFetchingFresh = isFetching && !isLoading;
  const isFiltering = filter !== 'all' || searchInput.trim().length > 0;
  const emptyTitle = isFiltering
    ? 'No matches for this filter'
    : 'No beneficiaries enrolled yet';
  const emptyDescription = isFiltering
    ? 'Try a different filter or clear your search to see everyone.'
    : 'Beneficiaries enrolled in the Libre Sakay program will appear here once their application is approved.';
  const emptyIcon = isFiltering ? <FiSearch /> : <FiUser />;

  // Suspense fix: getRemoveId needs to be set before this hook was referenced — fixed above.
  // (Removed unused state above.)

  const singleBeneficiaryForDialog = suspendActivate?.mode === 'single' && suspendActivate.id
    ? beneficiaryMap.get(suspendActivate.id) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pill filter tabs with count badges */}
        <div className="inline-flex rounded-full bg-gray-100 p-1 gap-1" role="tablist">
          {FILTER_TABS.map(tab => {
            const isActive = filter === tab.value;
            const count = tabCount(tab.value);
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => updateParams({ filter: tab.value === 'all' ? null : tab.value, page: '1' })}
                className={
                  isActive
                    ? 'inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-primary-700 shadow-sm'
                    : 'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors'
                }
              >
                {tab.label}
                <span
                  className={
                    isActive
                      ? 'inline-flex items-center justify-center min-w-[1.5rem] rounded-full bg-primary-100 px-1.5 text-[11px] font-bold text-primary-700'
                      : 'inline-flex items-center justify-center min-w-[1.5rem] rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600'
                  }
                >
                  {isLoading || count === null ? '…' : count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name or resident ID..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Page size */}
        <label className="text-xs text-gray-500 inline-flex items-center gap-1">
          Rows
          <select
            value={pageSize}
            onChange={e =>
              updateParams({ limit: e.target.value === '25' ? null : e.target.value, page: '1' })
            }
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FiDownload className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Bulk action toolbar — visible only when at least one row is selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-primary-200 bg-primary-50">
          <div className="flex items-center gap-3 text-sm">
            <Checkbox
              checked
              onCheckedChange={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
            />
            <span className="font-semibold text-primary-700">
              {selectedIds.size} selected
            </span>
            <span className="text-gray-500 text-xs">
              (across current page)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkSuspend}>
              <FiUserX className="mr-1.5 h-4 w-4" />
              Suspend
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkActivate}>
              <FiUserCheck className="mr-1.5 h-4 w-4" />
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkRemove} className="text-red-600 border-red-200 hover:bg-red-50">
              <FiTrash2 className="mr-1.5 h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span>
                {isLoading
                  ? 'Loading…'
                  : `Showing ${(data?.data.length ?? 0).toLocaleString()} of ${total.toLocaleString()} ${filter === 'all' ? 'beneficiaries' : filter === 'active' ? 'active beneficiaries' : 'suspended beneficiaries'}${urlSearch ? ` matching "${urlSearch}"` : ''}`}
              </span>
              {isFetchingFresh && (
                <span className="inline-flex items-center gap-1 text-primary-600">
                  <FiLoader className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Updating…</span>
                </span>
              )}
            </p>
            {isFiltering && !isLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <BeneficiariesTable
          data={data?.data ?? []}
          isLoading={isLoading}
          onView={handleView}
          onSuspend={handleSingleSuspend}
          onActivate={handleSingleActivate}
          onRemove={handleSingleRemove}
          selectedIds={selectedIds}
          onToggleOne={handleToggleOne}
          onToggleAll={handleToggleAll}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={({ sortBy: newSortBy, sortOrder: newSortOrder }) =>
            updateParams({ sortBy: newSortBy === 'date' ? null : newSortBy, sortOrder: newSortOrder === 'desc' ? null : newSortOrder, page: '1' })
          }
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyIcon={emptyIcon}
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={p => updateParams({ page: p === 1 ? null : String(p) })}
            onPrevious={() => updateParams({ page: page > 2 ? String(page - 1) : null })}
            onNext={() => updateParams({ page: String(page + 1) })}
            isLoading={isFetching}
          />
        )}
      </Card>

      {/* Modals */}
      <BeneficiaryDetailsModal
        id={selectedId}
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setSelectedId(null); }}
      />

      {suspendActivate && (
        <SuspendActivateDialog
          open
          onClose={() => setSuspendActivate(null)}
          beneficiary={singleBeneficiaryForDialog}
          bulkBeneficiaries={suspendActivate.mode === 'bulk' ? selectedBeneficiaryEntries : undefined}
          action={suspendActivate.action}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}

      <RemoveBeneficiaryDialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        beneficiaryId={removeId}
        beneficiaryName={
          removeId ? beneficiaryMap.get(removeId)?.fullName ?? null : null
        }
        onSuccess={() => {
          queryClient.refetchQueries({ queryKey: queryKeys.libreSakay.beneficiaries.all });
          setRemoveId(null);
        }}
      />

      {bulkRemoveOpen && (
        <BulkRemoveDialog
          open
          onClose={() => setBulkRemoveOpen(false)}
          bulkBeneficiaries={selectedBeneficiaryEntries}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
