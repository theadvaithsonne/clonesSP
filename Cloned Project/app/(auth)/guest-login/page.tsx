import { Suspense } from 'react';
import GuestLogin from './GuestLogin';

export default function GuestLoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GuestLogin />
    </Suspense>
  );
}
