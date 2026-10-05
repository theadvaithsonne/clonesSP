import { Suspense } from 'react';
import BrowseHQs from './BrowseHQs';

export default function BrowseHQsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowseHQs />
    </Suspense>
  );
}
