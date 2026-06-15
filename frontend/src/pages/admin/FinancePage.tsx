import { useState } from 'react';
import { Receipt, CreditCard, Tag } from 'lucide-react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { BillsPage } from './BillsPage';
import { RoomChargesPage } from './RoomChargesPage';
import { PromoCodesPage } from './PromoCodesPage';

type FinanceTab = 'bills' | 'room-charges' | 'promo-codes';

const TABS: { key: FinanceTab; label: string; Icon: React.ElementType }[] = [
  { key: 'bills',        label: 'Bills',        Icon: Receipt    },
  { key: 'room-charges', label: 'Room Charges', Icon: CreditCard },
  { key: 'promo-codes',  label: 'Promo Codes',  Icon: Tag        },
];

export function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>(
    () => (localStorage.getItem('finance-tab') as FinanceTab) ?? 'bills',
  );

  function switchTab(t: FinanceTab) {
    setTab(t);
    localStorage.setItem('finance-tab', t);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden mt-14 md:mt-0">
        <AdminHeader title="Finance" backTo="/admin" />

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

        <div className="flex-1 overflow-hidden">
          {tab === 'bills'        && <BillsPage       embedded />}
          {tab === 'room-charges' && <RoomChargesPage  embedded />}
          {tab === 'promo-codes'  && <PromoCodesPage   embedded />}
        </div>
      </div>
    </div>
  );
}
