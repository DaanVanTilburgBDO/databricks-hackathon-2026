import { useEffect, useState } from 'react';
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Toaster,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { Menu } from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { GeniePage } from './pages/GeniePage';
import { RecordDetailPage } from './pages/RecordDetailPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';

interface NavigationItem {
  label: string;
  to: string;
  end?: boolean;
}

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', to: '/', end: true },
  { label: 'Review Queue', to: '/queue' },
  { label: 'Genie', to: '/genie' },
];

function getDesktopNavClass(isActive: boolean): string {
  return [
    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#FF3621] text-white'
      : 'text-white/80 hover:bg-white/10 hover:text-white',
  ].join(' ');
}

function getMobileNavClass(isActive: boolean): string {
  return [
    'block rounded-xl px-4 py-3 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#FF3621] text-white'
      : 'text-[#0B2026] hover:bg-[#F3EDE6]',
  ].join(' ');
}

function NavigationLinks({
  className,
  mobile = false,
  onNavigate,
}: {
  className?: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className={className}>
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            mobile ? getMobileNavClass(isActive) : getDesktopNavClass(isActive)
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-[#F9F7F4] text-[#0B2026]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B2026] text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Data Readiness Desk</h1>
            <p className="text-sm text-white/65">
              Profiling and review workflow for healthcare facility data quality.
            </p>
          </div>

          <NavigationLinks className="ml-auto hidden items-center gap-2 md:flex" />

          <div className="ml-auto md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
              <SheetContent side="left" className="border-r-[#E7DED2] bg-[#F9F7F4]">
                <SheetHeader>
                  <SheetTitle className="text-left text-[#0B2026]">
                    Data Readiness Desk
                  </SheetTitle>
                </SheetHeader>
                <NavigationLinks
                  mobile
                  className="mt-6 flex flex-col gap-2"
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/queue', element: <ReviewQueuePage /> },
      { path: '/genie', element: <GeniePage /> },
      { path: '/record/:uniqueId', element: <RecordDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
