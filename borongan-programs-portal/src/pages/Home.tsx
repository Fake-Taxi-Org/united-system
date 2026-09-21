import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheck, FiChevronDown, FiClock, FiDownload, FiExternalLink, FiHelpCircle, FiLogOut, FiUser, FiX } from 'react-icons/fi';

import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResidentIDCard } from '@/components/portal/ResidentIDCard';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  portalProgramsService,
  type PortalProgram,
} from '@/services/api/portal-programs.service';
import type { GovernmentProgramType } from '@/services/api/government-program.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/api$/, '');
function toAbsUrl(p?: string | null): string | null {
  if (!p) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${API_ORIGIN}${p.startsWith('/') ? '' : '/'}${p}`;
}

const TYPE_LABELS: Record<GovernmentProgramType, string> = {
  SENIOR_CITIZEN: 'Senior Citizen',
  PWD: 'PWD',
  STUDENT: 'Student',
  SOLO_PARENT: 'Solo Parent',
  HEALTHCARE_WORKER: 'Healthcare Worker',
  ALL: 'All Residents',
};

const APPLICATION_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700', icon: <FiClock size={12} /> },
  approved: { label: 'Beneficiary', className: 'bg-purple-100 text-purple-700', icon: <FiCheck size={12} /> },
  rejected: { label: 'Not Approved', className: 'bg-red-100 text-red-700', icon: <FiX size={12} /> },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600', icon: <FiX size={12} /> },
};

const BENEFICIARY_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  ACTIVE: { label: 'Beneficiary', className: 'bg-green-100 text-green-700', icon: <FiCheck size={12} /> },
  INACTIVE: { label: 'Suspended', className: 'bg-red-100 text-red-700', icon: <FiAlertCircle size={12} /> },
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700', icon: <FiClock size={12} /> },
};

const OTHER_PROGRAMS_URL = import.meta.env.VITE_OTHER_PROGRAMS_URL || '';
const USER_GUIDE_URL = '/user-guide/presentation.html';

// ---------------------------------------------------------------------------
// ProgramCard
// ---------------------------------------------------------------------------

interface ProgramCardProps {
  program: PortalProgram;
}

const ProgramCard: React.FC<ProgramCardProps> = ({ program }) => {
  const navigate = useNavigate();
  const appStatus = program.applicationStatus;
  const isLibreSakay = program.name.toLowerCase().includes('libre sakay');

  // Use beneficiaryStatus for Libre Sakay when set; fall back to applicationStatus
  const libreSakayStatus = isLibreSakay && program.beneficiaryStatus
    ? BENEFICIARY_STATUS_CONFIG[program.beneficiaryStatus] ?? null
    : null;
  const statusConfig = libreSakayStatus ?? (appStatus ? APPLICATION_STATUS_CONFIG[appStatus] : null);

  const handleOpen = () => {
    if (isLibreSakay) {
      navigate('/libre-sakay');
    } else {
      navigate(`/programs/${program.id}`);
    }
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow border-primary-100">
      <CardContent className="p-5 flex flex-col h-full gap-3">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-heading-700 text-base">{program.name}</h3>
          {program.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{program.description}</p>
          )}
        </div>

        {/* Type badges */}
        <div className="flex flex-wrap gap-1.5">
          {program.types.map((type) => (
            <Badge key={type} variant="outline" className="text-xs font-medium border-primary-200 text-primary-700 bg-primary-50">
              {TYPE_LABELS[type]}
            </Badge>
          ))}
        </div>

        {/* Application status badge */}
        {statusConfig && (
          <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full w-fit', statusConfig.className)}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Open button */}
        <Button
          size="sm"
          className="w-full bg-primary-600 hover:bg-primary-700"
          onClick={handleOpen}
        >
          Open
        </Button>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Hero — Guest
// ---------------------------------------------------------------------------

const GuestHero: React.FC<{ onRegister: () => void; onLogin: () => void }> = ({ onRegister, onLogin }) => (
  <div className="relative overflow-hidden text-white">
    <img
      src="/assets/City Hall of Borongan in midday sun.png"
      alt="City Hall of Borongan"
      className="absolute inset-0 w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-br from-primary-700/90 via-primary-600/85 to-primary-500/80" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
      <div className="max-w-3xl">
        <p className="text-primary-200 text-sm font-medium uppercase tracking-widest mb-3">
          City of Borongan — Government Services Portal
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">
          Access Government Services &amp; Programs
        </h1>
        <p className="text-lg text-primary-100 mb-8 leading-relaxed">
          Register as a Borongan City resident to apply for government services, track your applications,
          and access exclusive programs available to our community.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            className="bg-white text-primary-700 hover:bg-primary-50 font-semibold text-base h-12 px-8"
            onClick={onRegister}
          >
            Register as Resident
          </Button>
        </div>
        <p className="text-primary-200 text-sm mt-5">
          Already registered?{' '}
          <button className="underline underline-offset-2 hover:text-white" onClick={onLogin}>
            Sign in to apply for services
          </button>
        </p>
      </div>
    </div>

  </div>
);

// ---------------------------------------------------------------------------
// Responsive scale wrapper for ResidentIDCard (380px CR80 card)
// ---------------------------------------------------------------------------
const CARD_W = 380;

const IDCardScaler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyScale = () => {
      // Get the flex container's available width (not the scaled wrapper width)
      const parentWidth = container.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
      const scale = Math.min(1, parentWidth / CARD_W);
      container.style.transform = `scale(${scale})`;
    };

    applyScale();
    window.addEventListener('resize', applyScale);
    return () => window.removeEventListener('resize', applyScale);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: CARD_W,
        transformOrigin: 'top center',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hero — Logged-in resident dashboard
// ---------------------------------------------------------------------------

const ResidentHero: React.FC<{ resident: ReturnType<typeof useAuth>['user'] }> = ({ resident }) => {
  const r = resident as typeof resident & {
    firstName?: string;
    lastName?: string;
    barangay?: { barangayName?: string; name?: string };
    status?: string;
  };

  const barangayName = r?.barangay?.barangayName || r?.barangay?.name || '';

  return (
    <div className="relative overflow-hidden">
      <img
        src="/assets/City Hall of Borongan in midday sun.png"
        alt="City Hall of Borongan"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700/90 via-primary-600/85 to-primary-500/80" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col items-center justify-center gap-8">
          {/* Left: resident info */}
          <div className="flex-1 text-white text-center">
            <h1 className="text-3xl font-bold mb-1">{r?.name}</h1>
            {barangayName && (
              <p className="text-primary-200 text-sm mb-4">Barangay {barangayName}, Borongan City</p>
            )}
          </div>

          {/* Right: flip ID card */}
          <div className="flex-1 flex justify-center items-center">
            {resident && (
              <IDCardScaler>
                <ResidentIDCard resident={resident} />
              </IDCardScaler>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// Home (main page)
// ---------------------------------------------------------------------------

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { canInstall, isInstalled, install } = useInstallPrompt();

  const [programs, setPrograms] = useState<PortalProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const onScroll = () => setShowScrollHint(window.scrollY < 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch only Libre Sakay at the API level — others filtered server-side
      const { data } = await portalProgramsService.listPrograms({ name: 'Libre Sakay' });
      setPrograms(data);
    } catch {
      toastRef.current({ variant: 'destructive', title: 'Failed to load programs', description: 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, []); // toast accessed via ref — stable across renders

  useEffect(() => {
    if (!authLoading) fetchPrograms();
  }, [authLoading, fetchPrograms]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="LGU Borongan" className="h-8 w-auto" />
            <span className="font-semibold text-heading-700 text-sm hidden sm:block">
              Borongan Services Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(USER_GUIDE_URL, '_blank', 'noopener,noreferrer')}
              className="gap-1.5"
              aria-label="Open user guide"
              title="User Guide"
            >
              <FiHelpCircle size={14} />
              <span className="hidden sm:inline">Help</span>
            </Button>
            {canInstall && !isInstalled && (
              <Button size="sm" variant="outline" onClick={install} className="gap-1.5">
                <FiDownload size={14} />
                <span className="hidden sm:inline">Install App</span>
              </Button>
            )}
            {isAuthenticated ? (
              (() => {
                const photo = toAbsUrl(user?.picturePath);
                const initials = ((user?.name ?? '?').match(/\b\w/g) ?? []).slice(0, 2).join('').toUpperCase() || '?';
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Account menu"
                        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        <Avatar className="h-9 w-9 border border-gray-200">
                          {photo ? <AvatarImage src={photo} alt={user?.name ?? 'Profile'} /> : null}
                          <AvatarFallback className="bg-primary-100 text-primary-700 text-sm">{initials}</AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[14rem]">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-heading-900 truncate">{user?.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{user?.email || user?.username}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => navigate('/profile')}>
                        <FiUser />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={logout} className="text-danger-700 focus:text-danger-700">
                        <FiLogOut />
                        <span>Sign out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  Register
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      {isAuthenticated && user ? (
        <ResidentHero resident={user} />
      ) : (
        <GuestHero onRegister={() => navigate('/register')} onLogin={() => navigate('/login')} />
      )}

      {/* Programs section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">

        {/* Services grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}

            {/* Other Programs — external link card (hidden unless a real URL is set) */}
            {OTHER_PROGRAMS_URL.startsWith('http') && !OTHER_PROGRAMS_URL.includes('localhost') && (
              <Card className="h-full flex flex-col hover:shadow-md transition-shadow border-dashed border-primary-200 bg-primary-50/40">
                <CardContent className="p-5 flex flex-col h-full gap-3 items-center justify-center text-center">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <FiExternalLink size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-heading-700 text-base">Other Programs</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Explore more government programs and services.
                    </p>
                  </div>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-primary-300 text-primary-700 hover:bg-primary-50 gap-1.5"
                    onClick={() => window.open(OTHER_PROGRAMS_URL, '_blank', 'noopener,noreferrer')}
                  >
                    <FiExternalLink size={14} />
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Fixed scroll indicator — fades out after user starts scrolling */}
      <div
        className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 transition-opacity duration-500 pointer-events-none"
        style={{ opacity: showScrollHint ? 1 : 0 }}
      >
        <span className="text-xs tracking-widest uppercase bg-black/40 text-white px-3 py-1 rounded-full backdrop-blur-sm">Scroll</span>
        <FiChevronDown size={20} className="animate-bounce text-black/60 drop-shadow" />
      </div>


    </div>
  );
};
