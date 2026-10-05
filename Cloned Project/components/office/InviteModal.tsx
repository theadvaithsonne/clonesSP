'use client';

import { useState } from 'react';
import { officeApi as api } from '@/lib/office-api';

interface Props {
  officeId: string;
  onClose(): void;
}

export default function InviteModal({ officeId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleAdd() {
    if (!email.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const { data } = await api.post(`/api/offices/${officeId}/add-member`, { email: email.trim() });
      setSuccess(data.message);
      setEmail('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to add member');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl border border-[#1e3a5f] bg-[#16213e] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Invite Member</h2>
          <button onClick={onClose} className="rounded-md p-1 text-[#64748b] hover:text-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-xs text-[#64748b]">
          Enter the email address of someone to add directly to your office.
          They must already have an OfficeStream account.
        </p>

        {success && (
          <div className="mb-3 rounded-md bg-[#1D9E75]/10 px-3 py-2 text-sm text-[#1D9E75]">{success}</div>
        )}
        {error && (
          <div className="mb-3 rounded-md bg-[#fc8181]/10 px-3 py-2 text-sm text-[#fc8181]">{error}</div>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="teammate@company.com"
            className="flex-1 rounded-lg border border-[#1e3a5f] bg-[#0f3460] px-3 py-2 text-sm text-white placeholder-[#64748b] outline-none focus:border-[#1D9E75]"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !email.trim()}
            className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#25c792] disabled:opacity-60"
          >
            {loading ? '…' : 'Add'}
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-[#1e3a5f] py-2 text-sm text-[#a0aec0] hover:bg-[#0f3460]">
          Done
        </button>
      </div>
    </div>
  );
}
