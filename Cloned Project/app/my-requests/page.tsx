import { Suspense } from 'react';
import MyRequests from './MyRequests';

export default function MyRequestsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyRequests />
    </Suspense>
  );
}
