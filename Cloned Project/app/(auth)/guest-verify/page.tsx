import { Suspense } from 'react';
import GuestVerify from './GuestVerify';

export default function GuestVerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GuestVerify />
    </Suspense>
  );
}
