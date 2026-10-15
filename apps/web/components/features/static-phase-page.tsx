'use client';

import { PhasePanel } from '@/components/features/phase-panel';
import { ROUTE_META } from '@/lib/route-meta';

export function StaticPhasePage({ routeKey }: { routeKey: keyof typeof ROUTE_META }) {
  const meta = ROUTE_META[routeKey];
  return <PhasePanel title={meta.title} subtitle={meta.subtitle} phase={meta.phase} />;
}
