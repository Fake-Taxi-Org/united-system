/**
 * Home.test.tsx
 *
 * Locks in the bulk-fetch behavior + per-card routing in Home.tsx after the
 * filter-removal change (Home.tsx:291) that drops the Libre Sakay-only filter.
 *
 * Cases:
 *   1. fetchPrograms calls listPrograms({}) — the change under test
 *   2. all 3 active programs render as cards
 *   3. Libre Sakay card click -> /libre-sakay
 *   4. other cards click -> /programs/<id>
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { mockNavigate, mockListPrograms } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListPrograms: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  BrowserRouter: ({ children }: any) => children,
}));

vi.mock('react-icons/fi', () => ({
  FiAlertCircle: () => null,
  FiCheck: () => null,
  FiChevronDown: () => null,
  FiClock: () => null,
  FiDownload: () => null,
  FiExternalLink: () => null,
  FiHelpCircle: () => null,
  FiLogOut: () => null,
  FiUser: () => null,
  FiX: () => null,
}));

vi.mock('@/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ canInstall: false, isInstalled: false, install: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'r-1',
      firstName: 'Test',
      lastName: 'User',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      picturePath: null,
    },
    logout: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/components/portal/ResidentIDCard', () => ({
  ResidentIDCard: () => null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => children,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: () => null,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button onClick={onSelect}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuPortal: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}));

vi.mock('@/services/api/portal-programs.service', () => ({
  portalProgramsService: {
    listPrograms: mockListPrograms,
    getProgram: vi.fn(),
  },
}));

import { Home } from '../Home';

const libreSakay = {
  id: 'gp-all-libre-sakay',
  name: 'Libre Sakay',
  types: ['ALL'],
  is_active: true,
  description: 'Free ride program',
  requirements: null,
};
const direkta = {
  id: '00000501-0501-4001-8001-000000000003',
  name: 'Direkta Ayuda',
  types: ['STUDENT'],
  is_active: true,
  description: 'Direct cash aid for students',
  requirements: null,
};
const senior = {
  id: '00000501-0501-4001-8001-000000000004',
  name: 'Senior Citizen Allowance',
  types: ['SENIOR_CITIZEN'],
  is_active: true,
  description: 'Monthly allowance for seniors',
  requirements: null,
};

describe('Home - program cards render from listPrograms({})', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockListPrograms.mockReset();
  });

  it('calls listPrograms with an empty filter object', async () => {
    mockListPrograms.mockResolvedValueOnce({ data: [] });
    render(<Home />);
    await waitFor(() => {
      expect(mockListPrograms).toHaveBeenCalledWith({});
    });
  });

  it('renders one card per program returned by the API', async () => {
    mockListPrograms.mockResolvedValueOnce({ data: [libreSakay, direkta, senior] });
    render(<Home />);
    expect(await screen.findByText('Libre Sakay')).toBeInTheDocument();
    expect(await screen.findByText('Direkta Ayuda')).toBeInTheDocument();
    expect(await screen.findByText('Senior Citizen Allowance')).toBeInTheDocument();
  });

  it('routes the Libre Sakay card click to /libre-sakay', async () => {
    mockListPrograms.mockResolvedValueOnce({ data: [libreSakay, direkta, senior] });
    render(<Home />);
    const openButtons = await screen.findAllByRole('button', { name: /open/i });
    expect(openButtons).toHaveLength(3);
    fireEvent.click(openButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/libre-sakay');
  });

  it('routes the Direkta Ayuda card click to /programs/<id>', async () => {
    mockListPrograms.mockResolvedValueOnce({ data: [libreSakay, direkta, senior] });
    render(<Home />);
    const openButtons = await screen.findAllByRole('button', { name: /open/i });
    fireEvent.click(openButtons[1]);
    expect(mockNavigate).toHaveBeenCalledWith(`/programs/${direkta.id}`);
  });

  it('routes the Senior Citizen Allowance card click to /programs/<id>', async () => {
    mockListPrograms.mockResolvedValueOnce({ data: [libreSakay, direkta, senior] });
    render(<Home />);
    const openButtons = await screen.findAllByRole('button', { name: /open/i });
    fireEvent.click(openButtons[2]);
    expect(mockNavigate).toHaveBeenCalledWith(`/programs/${senior.id}`);
  });
});