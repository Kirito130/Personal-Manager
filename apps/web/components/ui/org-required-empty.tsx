'use client';

import { EmptyBlock } from '@/components/ui/api-state';
import Link from 'next/link';

export function OrgRequiredEmpty() {
  return (
    <EmptyBlock
      title="Organization required"
      description="Switch to an organization in the top bar, or create one in Settings."
      action={
        <Link href="/settings" className="lifeos-btn-primary">
          Open settings
        </Link>
      }
    />
  );
}
