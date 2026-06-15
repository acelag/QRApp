import { useState } from 'react';
import { MapPin, CalendarDays, LayoutGrid } from 'lucide-react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { FloorPlanPage } from './FloorPlanPage';
import { ReservationsPage } from './ReservationsPage';
import { TableStatusPage } from './TableStatusPage';

type FloorTab = 'floor-plan' | 'reservations' | 'table-status';

const TABS: { key: FloorTab; label: string; Icon: React.ElementType }[] = [
  { key: 'floor-plan',   label: 'Floor Plan',   Icon: MapPin       },
  { key: 'reservations', label: 'Reservations', Icon: CalendarDays },
  { key: 'table-status', label: 'Table Status', Icon: LayoutGrid   },
];

export function FloorPage() {
  const [tab, setTab] = useState<FloorTab>(
    () => (localStorage.getItem('floor-tab') as FloorTab) ?? 'floor-plan',
  );

  function switchTab(t: FloorTab) {
    setTab(t);
    localStorage.setItem('floor-tab', t);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden mt-14 md:mt-0">
        <AdminHeader title="Floor" backTo="/admin" />

        {/* Tab bar */}
        <div className="bg-white border-b border-gray-100 px-3 sm:px-4 lg:px-6 flex gap-1 shrink-0">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content — each panel scrolls internally */}
        <div className="flex-1 overflow-hidden">
          {tab === 'floor-plan'   && <FloorPlanPage   embedded />}
          {tab === 'reservations' && <ReservationsPage embedded />}
          {tab === 'table-status' && <TableStatusPage  embedded />}
        </div>
      </div>
    </div>
  );
}
