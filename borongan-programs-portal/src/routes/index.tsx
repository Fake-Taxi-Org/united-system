import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const Home = React.lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const Login = React.lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Register = React.lazy(() => import('@/pages/Register').then((m) => ({ default: m.Register })));
const RegistrationStatus = React.lazy(() => import('@/pages/RegistrationStatus').then((m) => ({ default: m.RegistrationStatus })));
const LibreSakay = React.lazy(() => import('@/pages/LibreSakay').then((m) => ({ default: m.LibreSakay })));
const Routes = React.lazy(() => import('@/pages/libre-sakay/Routes').then((m) => ({ default: m.Routes })));
const RouteDetail = React.lazy(() => import('@/pages/libre-sakay/RouteDetail').then((m) => ({ default: m.RouteDetail })));
const ProgramDetail = React.lazy(() => import('@/pages/ProgramDetail').then((m) => ({ default: m.ProgramDetail })));
const Profile = React.lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
  </div>
);

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<Spinner />}>{element}</Suspense>;
}

// Redirects unauthenticated users to /login, preserving the intended path
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// Redirects already-logged-in users away from auth pages
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute>{withSuspense(<Home />)}</ProtectedRoute>,
  },
  {
    path: '/login',
    element: <GuestRoute>{withSuspense(<Login />)}</GuestRoute>,
  },
  {
    path: '/register',
    element: <GuestRoute>{withSuspense(<Register />)}</GuestRoute>,
  },
  {
    path: '/register/status',
    element: <GuestRoute>{withSuspense(<RegistrationStatus />)}</GuestRoute>,
  },
  {
    path: '/libre-sakay',
    element: <ProtectedRoute>{withSuspense(<LibreSakay />)}</ProtectedRoute>,
  },
  {
    path: '/libre-sakay/routes',
    element: <ProtectedRoute>{withSuspense(<Routes />)}</ProtectedRoute>,
  },
  {
    path: '/libre-sakay/routes/:id',
    element: <ProtectedRoute>{withSuspense(<RouteDetail />)}</ProtectedRoute>,
  },
  {
    path: '/programs/:id',
    element: <ProtectedRoute>{withSuspense(<ProgramDetail />)}</ProtectedRoute>,
  },
  {
    path: '/profile',
    element: <ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
