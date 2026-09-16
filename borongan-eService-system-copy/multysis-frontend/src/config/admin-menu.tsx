// ponytail: E-government hidden for now — re-enable this import when restoring.
// import { buildEGovernmentSubmenu } from '@/utils/dynamic-menu';
import {
  FiCreditCard,
  // FiFileText, // ponytail: E-government hidden for now — re-enable with the menu entry
  FiHelpCircle,
  FiHome,
  FiMessageSquare,
  FiSettings,
  FiShield,
  FiTool,
  FiUsers,
  FiClipboard,
} from 'react-icons/fi';
import { SlWallet } from 'react-icons/sl';

interface MenuItem {
  path?: string;
  label?: string;
  icon?: React.ReactNode;
  type?: 'separator';
  hasSubmenu?: boolean;
  submenuItems?: { path: string; label: string; badgeCount?: number; isCategoryHeader?: boolean }[];
  badgeCount?: number;
  system?: string;
}

interface NotificationCounts {
  pendingApplications: number;
  pendingCitizens: number;
  pendingUpdateRequests: number;
  unreadMessages: number;
  total: number;
  pendingApplicationsByService?: Record<string, number>; // service code -> count
}

export const getAdminMenuItems = async (notificationCounts?: NotificationCounts): Promise<MenuItem[]> => {
  // ponytail: E-government hidden for now — also skip its dynamic submenu fetch.
  // Restore both blocks (this whole fetch + the menu entry below) when ready.
  // let dynamicSubmenuItems: {
  //   path: string;
  //   label: string;
  //   badgeCount?: number;
  //   isCategoryHeader?: boolean;
  //   category?: string;
  // }[] = [];
  //
  // try {
  //   const { getDynamicServices } = await import('@/utils/dynamic-menu');
  //   const dynamicServices = await getDynamicServices();
  //   const menuEntries = buildEGovernmentSubmenu(dynamicServices);
  //
  //   // Transform menu entries (with sections) to flat submenu items with category headers
  //   const transformedItems: {
  //     path: string;
  //     label: string;
  //     badgeCount?: number;
  //     isCategoryHeader?: boolean;
  //     category?: string;
  //   }[] = [];
  //
  //   menuEntries.forEach(entry => {
  //     if (entry.type === 'section') {
  //       // Add category header
  //       transformedItems.push({
  //         path: '',
  //         label: `▾ ${entry.title} ▾`,
  //         isCategoryHeader: true,
  //         category: entry.title,
  //       });
  //
  //       // Add items in this category
  //       entry.items.forEach(item => {
  //         // Find the service to get badge count
  //         const pathParts = item.path.split('/');
  //         const servicePath = pathParts[pathParts.length - 1];
  //
  //         const matchingService = dynamicServices.find(s => {
  //           const normalizedCode = s.code.toLowerCase().replace(/_/g, '-');
  //           return normalizedCode === servicePath;
  //         });
  //
  //         const badgeCount = matchingService
  //           ? notificationCounts?.pendingApplicationsByService?.[matchingService.code] || 0
  //           : 0;
  //
  //         transformedItems.push({
  //           path: item.path,
  //           label: item.label,
  //           badgeCount: badgeCount > 0 ? badgeCount : undefined,
  //           category: entry.title, // Store category for each service
  //         });
  //       });
  //     }
  //   });
  //
  //   dynamicSubmenuItems = transformedItems;
  // } catch (error) {
  //   console.error('Failed to load dynamic services for menu:', error);
  //   // Continue with empty dynamic submenu items
  // }

  return [
    { path: '/admin/dashboard', label: 'Dashboard', icon: <FiHome />, system: 'core' },
    {
      path: '/admin/registration-workflow',
      label: 'Registration Requests',
      icon: <FiClipboard />,
      badgeCount: notificationCounts?.pendingCitizens || 0,
      system: 'core',
    },

    { type: 'separator' as const, system: 'core' },

    // ponytail: E-government nav hidden for now — restore when ready
    // {
    //   path: '/admin/e-government',
    //   label: 'E-government',
    //   icon: <FiFileText />,
    //   hasSubmenu: true,
    //   badgeCount: notificationCounts?.pendingApplications || 0,
    //   system: 'core',
    //   submenuItems: [
    //     ...dynamicSubmenuItems,
    //     // Static items that are not services
    //     { path: '/admin/e-government/reports', label: 'Reports' },
    //     { path: '/admin/e-government/gcash-reports', label: 'Gcash Reports' },
    //     { path: '/admin/e-government/payments', label: 'Payments' },
    //     { path: '/admin/e-government/billings', label: 'Billings' },
    //     { path: '/admin/e-government/miscellaneous-fee', label: 'Miscellaneous Fee' },
    //     { path: '/admin/e-government/qr-scanner', label: 'QR Scanner' },
    //   ],
    // },
    { path: '/admin/e-bills-payment', label: 'E-Bills Payment', icon: <FiCreditCard />, system: 'core' },
    { path: '/admin/e-services', label: 'E-Services', icon: <FiTool />, system: 'core' },
    {
      path: '/admin/e-news',
      label: 'E-News',
      icon: <FiMessageSquare />,
      hasSubmenu: true,
      system: 'core',
      submenuItems: [{ path: '/admin/e-news/articles', label: 'Articles' }],
    },
    {
      path: '/admin/e-wallet-services',
      label: 'E-Wallet Services',
      icon: <SlWallet className="text-primary-600" size={14} />,
      hasSubmenu: true,
      system: 'core',
      submenuItems: [
        { path: '/admin/e-wallet-services/bills', label: 'Bills' },
        { path: '/admin/e-wallet-services/cash-in', label: 'Cash-in' },
        { path: '/admin/e-wallet-services/cash-transfer', label: 'Cash Transfer' },
        { path: '/admin/e-wallet-services/receive-funds', label: 'Receive Funds' },
        { path: '/admin/e-wallet-services/mobile-load', label: 'Mobile Load' },
        { path: '/admin/e-wallet-services/wallet-support', label: 'Wallet Support' },
      ],
    },
    { path: '/admin/e-help', label: 'E-Help', icon: <FiHelpCircle />, system: 'core' },

    // Separator: Below e-help
    { type: 'separator' as const, system: 'core' },

    {
      path: '/admin/general-settings',
      label: 'General Settings',
      icon: <FiSettings />,
      hasSubmenu: true,
      system: 'core',
      submenuItems: [
        { path: '/admin/general-settings/address', label: 'Address' },
        { path: '/admin/general-settings/appointment', label: 'Appointment' },
        { path: '/admin/general-settings/billing-imports', label: 'Billing Imports' },
        { path: '/admin/general-settings/brgy-chairmen', label: 'Brgy. Chairmen' },
        { path: '/admin/general-settings/cms', label: 'CMS' },
        { path: '/admin/general-settings/business-ests', label: 'Business Ests.' },
        { path: '/admin/general-settings/calendar-entries', label: 'Calendar Entries' },
        { path: '/admin/general-settings/citizenship', label: 'Citizenship' },
        { path: '/admin/general-settings/e-wallet-services', label: 'E-Wallet Services' },
        { path: '/admin/general-settings/faq', label: 'Frequently Asked Questions' },
        { path: '/admin/general-settings/hospitals', label: 'Hospitals' },
        { path: '/admin/general-settings/how-to', label: 'How To' },
        { path: '/admin/general-settings/institution', label: 'Institution' },
        { path: '/admin/general-settings/requirements', label: 'Requirements' },
        { path: '/admin/general-settings/smart-city-services', label: 'Smart City Services' },
        { path: '/admin/general-settings/system-modules', label: 'System Modules' },
        { path: '/admin/general-settings/opt-modules', label: 'OPT Modules' },
        { path: '/admin/general-settings/government-program', label: 'Government Program' },
        { path: '/admin/general-settings/tax-profiles', label: 'Tax Profiles' },
      ],
    },
    {
      path: '/admin/access-control',
      label: 'Access Control',
      icon: <FiShield />,
      hasSubmenu: true,
      system: 'core',
      submenuItems: [
        { path: '/admin/profile', label: 'My Profile' },
        { path: '/admin/access-control/role-management', label: 'Role Management' },
        { path: '/admin/access-control/permissions', label: 'Permissions' },
        { path: '/admin/access-control/user-management', label: 'User Management' },
        { path: '/admin/access-control/page-management', label: 'Page Management' },
      ],
    },

    // Separator: Below access control
    { type: 'separator' as const, system: 'core' },

    { path: '/admin/city-announcement', label: 'City Announcement', icon: <FiMessageSquare />, system: 'core' },
  ];
};

// Default export for backward compatibility (will use empty submenu initially)
export const adminMenuItems: MenuItem[] = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: <FiHome />, system: 'core' },
  { path: '/admin/residents', label: 'Residents', icon: <FiUsers />, system: 'core' },
  { path: '/admin/registration-workflow', label: 'Registration Requests', icon: <FiClipboard />, system: 'core' },
  { type: 'separator' as const, system: 'core' },
  // ponytail: E-government nav hidden for now — restore when ready
  // {
  //   path: '/admin/e-government',
  //   label: 'E-government',
  //   icon: <FiFileText />,
  //   hasSubmenu: true,
  //   system: 'core',
  //   submenuItems: [
  //     { path: '/admin/e-government/reports', label: 'Reports' },
  //     { path: '/admin/e-government/gcash-reports', label: 'Gcash Reports' },
  //     { path: '/admin/e-government/payments', label: 'Payments' },
  //     { path: '/admin/e-government/billings', label: 'Billings' },
  //     { path: '/admin/e-government/miscellaneous-fee', label: 'Miscellaneous Fee' },
  //     { path: '/admin/e-government/qr-scanner', label: 'QR Scanner' },
  //   ],
  // },
  { path: '/admin/e-bills-payment', label: 'E-Bills Payment', icon: <FiCreditCard />, system: 'core' },
  { path: '/admin/e-services', label: 'E-Services', icon: <FiTool />, system: 'core' },
  {
    path: '/admin/e-news',
    label: 'E-News',
    icon: <FiMessageSquare />,
    hasSubmenu: true,
    system: 'core',
    submenuItems: [{ path: '/admin/e-news/articles', label: 'Articles' }],
  },
  {
    path: '/admin/e-wallet-services',
    label: 'E-Wallet Services',
    icon: <SlWallet className="text-primary-600" size={14} />,
    hasSubmenu: true,
    system: 'core',
    submenuItems: [
      { path: '/admin/e-wallet-services/bills', label: 'Bills' },
      { path: '/admin/e-wallet-services/cash-in', label: 'Cash-in' },
      { path: '/admin/e-wallet-services/cash-transfer', label: 'Cash Transfer' },
      { path: '/admin/e-wallet-services/receive-funds', label: 'Receive Funds' },
      { path: '/admin/e-wallet-services/mobile-load', label: 'Mobile Load' },
      { path: '/admin/e-wallet-services/wallet-support', label: 'Wallet Support' },
    ],
  },
  { path: '/admin/e-help', label: 'E-Help', icon: <FiHelpCircle />, system: 'core' },
  { type: 'separator' as const, system: 'core' },
  {
    path: '/admin/general-settings',
    label: 'General Settings',
    icon: <FiSettings />,
    hasSubmenu: true,
    system: 'core',
    submenuItems: [
      { path: '/admin/general-settings/address', label: 'Address' },
      { path: '/admin/general-settings/appointment', label: 'Appointment' },
      { path: '/admin/general-settings/billing-imports', label: 'Billing Imports' },
      { path: '/admin/general-settings/brgy-chairmen', label: 'Brgy. Chairmen' },
      { path: '/admin/general-settings/cms', label: 'CMS' },
      { path: '/admin/general-settings/business-ests', label: 'Business Ests.' },
      { path: '/admin/general-settings/calendar-entries', label: 'Calendar Entries' },
      { path: '/admin/general-settings/citizenship', label: 'Citizenship' },
      { path: '/admin/general-settings/e-wallet-services', label: 'E-Wallet Services' },
      { path: '/admin/general-settings/faq', label: 'Frequently Asked Questions' },
      { path: '/admin/general-settings/hospitals', label: 'Hospitals' },
      { path: '/admin/general-settings/how-to', label: 'How To' },
      { path: '/admin/general-settings/institution', label: 'Institution' },
      { path: '/admin/general-settings/requirements', label: 'Requirements' },
      { path: '/admin/general-settings/smart-city-services', label: 'Smart City Services' },
      { path: '/admin/general-settings/system-modules', label: 'System Modules' },
      { path: '/admin/general-settings/opt-modules', label: 'OPT Modules' },
      { path: '/admin/general-settings/government-program', label: 'Government Program' },
      { path: '/admin/general-settings/tax-profiles', label: 'Tax Profiles' },
    ],
  },
  {
    path: '/admin/access-control',
    label: 'Access Control',
    icon: <FiShield />,
    hasSubmenu: true,
    system: 'core',
    submenuItems: [
      { path: '/admin/profile', label: 'My Profile' },
      { path: '/admin/access-control/role-management', label: 'Role Management' },
      { path: '/admin/access-control/permissions', label: 'Permissions' },
      { path: '/admin/access-control/user-management', label: 'User Management' },
      { path: '/admin/access-control/page-management', label: 'Page Management' },
    ],
  },
  { type: 'separator' as const, system: 'core' },
  { path: '/admin/city-announcement', label: 'City Announcement', icon: <FiMessageSquare />, system: 'core' },
];
