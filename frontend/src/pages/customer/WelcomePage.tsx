import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tableService } from '../../services/tableService';
import { restaurantService, type RestaurantInfo } from '../../services/restaurantService';
import { menuService } from '../../services/menuService';
import { sessionService } from '../../services/sessionService';
import { menuPrefetchCache } from '../../services/menuPrefetchCache';
import { WelcomeScreen } from '../../components/WelcomeScreen';
import { THEME_COLOR } from '../../context/ThemeContext';

export function WelcomePage() {
  const { t } = useTranslation();
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  // Track whether background prefetch has finished so we can skip the loader
  const prefetchDone = useRef(false);

  useEffect(() => {
    if (!tableId) return;
    tableService.getTable(tableId).then((table) => {
      setTableNumber(table.number);

      // Fire restaurant info + menu data in parallel
      restaurantService.getRestaurantInfo(table.restaurantId).then((restInfo) => {
        setInfo(restInfo);

        // Kick off the heavy menu fetches in the background while the
        // user reads the welcome screen — result stored in the cache so
        // MenuPage can skip its own network calls entirely.
        Promise.all([
          menuService.getCategories(table.restaurantId),
          menuService.getItems(table.restaurantId),
          sessionService.getOrCreate(table.id, table.number, table.restaurantId),
        ]).then(([categories, items, session]) => {
          menuPrefetchCache.set({
            tableId: table.id,
            restaurantId: table.restaurantId,
            tableNumber: table.number,
            categories,
            items,
            sessionId: session.id,
            restaurantInfo: restInfo,
          });
          prefetchDone.current = true;
        }).catch(() => { /* MenuPage will fall back to its own fetch */ });
      });
    }).catch(() => {});
  }, [tableId]);

  return (
    <div className="relative">
      <WelcomeScreen
        restaurantName={info?.name ?? 'Welcome'}
        logo={info?.logo}
        themeColor={THEME_COLOR}
        heroUrl={info?.welcomeImageUrl}
        heading={info?.welcomeHeading}
        tagline={info?.welcomeTagline || t('customer.scanEnjoy')}
        subtitle={tableNumber !== null ? t('customer.tableNumber', { number: tableNumber }) : null}
        waitTimeMin={info?.waitTimeMin ?? null}
        waitTimeLabel={info?.waitTimeMin != null ? t('customer.waitTime', { n: info.waitTimeMin }) : undefined}
        social={info ?? undefined}
        followUsLabel={t('customer.followUs')}
        ctaLabel={t('customer.viewMenu')}
        poweredByLabel={t('customer.poweredBy')}
        onEnter={() => navigate(`/menu/${tableId}`)}
      />
    </div>
  );
}
