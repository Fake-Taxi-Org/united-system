import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingRows, EmptyState } from './shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FiArrowDown,
  FiArrowUp,
  FiEye,
  FiUserX,
  FiUserCheck,
  FiTrash2,
  FiMoreVertical,
} from 'react-icons/fi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BeneficiaryListItem } from '@/services/api/libre-sakay-beneficiary.service';

export type BeneficiarySortKey = 'name' | 'date';

interface BeneficiariesTableProps {
  data: BeneficiaryListItem[];
  isLoading: boolean;
  onView: (id: string) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
  selectedIds: Set<string>;
  onToggleOne: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  sortBy: BeneficiarySortKey;
  sortOrder: 'asc' | 'desc';
  onSortChange: (next: { sortBy: BeneficiarySortKey; sortOrder: 'asc' | 'desc' }) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
}

const COL_COUNT = 7;

const CATEGORY_LABELS: Record<string, string> = {
  SENIOR_CITIZEN: 'Senior Citizen',
  PWD: 'PWD',
  STUDENT: 'Student',
  SOLO_PARENT: 'Solo Parent',
  HEALTHCARE_WORKER: 'Healthcare Worker',
};

const CATEGORY_CHIP_STYLES: Record<string, string> = {
  SENIOR_CITIZEN: 'bg-blue-50 text-blue-700 ring-blue-100',
  PWD: 'bg-purple-50 text-purple-700 ring-purple-100',
  STUDENT: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  SOLO_PARENT: 'bg-rose-50 text-rose-700 ring-rose-100',
  HEALTHCARE_WORKER: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  PENDING: 'bg-yellow-100 text-yellow-700',
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function BeneficiaryAvatar({ fullName, picturePath, size = 40 }: { fullName: string; picturePath: string | null | undefined; size?: number }) {
  const dim = `${size}px`;
  if (picturePath) {
    return (
      <img
        src={picturePath}
        alt={fullName}
        style={{ width: dim, height: dim }}
        className="rounded-full object-cover bg-gray-100 ring-1 ring-gray-200 flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim }}
      className="rounded-full bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center flex-shrink-0 text-primary-700 font-semibold text-sm"
      aria-label={fullName}
    >
      {getInitials(fullName)}
    </div>
  );
}

function CategoryChip({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const style = CATEGORY_CHIP_STYLES[category] ?? 'bg-gray-50 text-gray-700 ring-gray-100';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status, suspendedAt }: { status: string; suspendedAt?: string | null }) {
  const isSuspended = !!suspendedAt;
  const label = isSuspended ? 'Suspended' : status === 'INACTIVE' ? 'Inactive' : status === 'ACTIVE' ? 'Active' : 'Pending';
  const style = isSuspended
    ? 'bg-amber-100 text-amber-700'
    : STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500';
  const suspendedSince = suspendedAt
    ? new Date(suspendedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  return (
    <div className="flex flex-col">
      <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {label}
      </span>
      {suspendedSince && (
        <span className="text-[11px] text-amber-700 mt-0.5">since {suspendedSince}</span>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeSortBy,
  sortOrder,
  onClick,
}: {
  label: string;
  sortKey: BeneficiarySortKey;
  activeSortBy: BeneficiarySortKey;
  sortOrder: 'asc' | 'desc';
  onClick: () => void;
}) {
  const isActive = activeSortBy === sortKey;
  // Icon: when not actively sorted, show FiArrowDown as a neutral hint that clicking will sort.
  // When sorted asc, show FiArrowUp; desc shows FiArrowDown.
  const Icon = sortOrder === 'asc' ? FiArrowUp : FiArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1 hover:text-primary-700 transition-colors ' +
        (isActive ? 'text-primary-700' : 'text-gray-500')
      }
      aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function BeneficiariesTable({
  data,
  isLoading,
  onView,
  onSuspend,
  onActivate,
  onRemove,
  selectedIds,
  onToggleOne,
  onToggleAll,
  sortBy,
  sortOrder,
  onSortChange,
  emptyTitle = 'No beneficiaries found',
  emptyDescription = 'No beneficiaries match the current filter.',
  emptyIcon = <FiUserX />,
}: BeneficiariesTableProps) {
  // Header row with sort controls.
  // Column widths are explicit so the table layout is stable and headers
  // align with body cells regardless of row content.
  const header = (
    <TableRow>
      <TableHead className="w-10">
        <Checkbox
          aria-label="Select all rows"
          checked={
            data.length > 0 && data.every(b => selectedIds.has(b.id))
              ? true
              : data.some(b => selectedIds.has(b.id))
              ? 'indeterminate'
              : false
          }
          onCheckedChange={checked => onToggleAll(checked === true)}
          disabled={data.length === 0}
        />
      </TableHead>
      <TableHead className="w-14">
        {/* Avatar column — fixed width matches the 40px avatar in body cells */}
      </TableHead>
      <TableHead className="min-w-[260px]">
        <SortHeader
          label="Beneficiary"
          sortKey="name"
          activeSortBy={sortBy}
          sortOrder={sortOrder}
          onClick={() => {
            // Toggle sort direction if already on this column; otherwise default to asc on first click.
            const next = isActiveCol(sortBy, 'name')
              ? (sortOrder === 'asc' ? 'desc' : 'asc')
              : 'asc';
            onSortChange({ sortBy: 'name', sortOrder: next });
          }}
        />
      </TableHead>
      <TableHead className="min-w-[140px]">Barangay</TableHead>
      <TableHead className="w-32">Status</TableHead>
      <TableHead className="w-32">
        <SortHeader
          label="Registered"
          sortKey="date"
          activeSortBy={sortBy}
          sortOrder={sortOrder}
          onClick={() => {
            const next = isActiveCol(sortBy, 'date')
              ? (sortOrder === 'asc' ? 'desc' : 'asc')
              : 'desc';
            onSortChange({ sortBy: 'date', sortOrder: next });
          }}
        />
      </TableHead>
      <TableHead className="w-12"></TableHead>
    </TableRow>
  );

  if (isLoading) {
    return (
      <Table>
        <TableHeader>{header}</TableHeader>
        <TableBody>
          <LoadingRows cols={COL_COUNT} />
        </TableBody>
      </Table>
    );
  }

  if (data.length === 0) {
    return (
      <Table>
        <TableHeader>{header}</TableHeader>
        <TableBody>
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>{header}</TableHeader>
      <TableBody>
        {data.map(b => {
          const isSelected = selectedIds.has(b.id);
          return (
            <TableRow
              key={b.id}
              className="group hover:bg-gray-50/50 transition-colors"
              data-state={isSelected ? 'selected' : undefined}
            >
              <TableCell className="py-3 w-10">
                <Checkbox
                  aria-label={`Select ${b.fullName}`}
                  checked={isSelected}
                  onCheckedChange={checked => onToggleOne(b.id, checked === true)}
                />
              </TableCell>
              <TableCell className="py-3 w-14">
                <BeneficiaryAvatar fullName={b.fullName} picturePath={b.picturePath} />
              </TableCell>
              <TableCell className="py-3 min-w-[260px]">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold uppercase text-sm leading-tight text-heading-700">{b.fullName}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-gray-500">{b.residentIdNumber}</span>
                    <CategoryChip category={b.category} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3 text-sm text-gray-600 min-w-[140px]">{b.barangay}</TableCell>
              <TableCell className="py-3 w-32">
                <StatusBadge status={b.status} suspendedAt={b.suspendedAt} />
              </TableCell>
              <TableCell className="py-3 text-sm text-gray-500 whitespace-nowrap w-32">
                {new Date(b.enrolledAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell className="py-3 w-12">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 opacity-60 group-hover:opacity-100 transition-opacity"
                      aria-label="Row actions"
                    >
                      <FiMoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(b.id)}>
                      <FiEye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {b.status === 'ACTIVE' ? (
                      <DropdownMenuItem onClick={() => onSuspend(b.id)}>
                        <FiUserX className="mr-2 h-4 w-4" />
                        Suspend
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onActivate(b.id)}>
                        <FiUserCheck className="mr-2 h-4 w-4" />
                        Activate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onRemove(b.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <FiTrash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Local helper to avoid importing a comparator module.
function isActiveCol(currentSortBy: BeneficiarySortKey, col: BeneficiarySortKey): boolean {
  return currentSortBy === col;
}
