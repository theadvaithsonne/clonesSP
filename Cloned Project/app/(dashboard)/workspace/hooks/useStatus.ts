import { useState, useCallback } from 'react';
import { SettableUserStatus } from '../types';

/**
 * Local-only available/busy/afk state. The `workspace:status-change`
 * broadcast was removed when the green-dot online-status UI was retired
 * (no FE component listens to `workspace:user-status-changed` any more,
 * and the BE still tolerates the event without action). The dropdown
 * still works as a personal UI preference — it just isn't visible to
 * other users.
 *
 * Reintroduce the broadcast here if/when a "busy → don't ring me on
 * knocks" preference gets wired up server-side.
 */
export function useStatus() {
  const [myStatus, setMyStatus] = useState<SettableUserStatus>('available');
  const [showStatusSelector, setShowStatusSelector] = useState(false);

  const handleStatusChange = useCallback((newStatus: SettableUserStatus) => {
    setMyStatus(newStatus);
    setShowStatusSelector(false);
  }, []);

  return {
    myStatus,
    showStatusSelector,
    handleStatusChange,
    setShowStatusSelector,
    setMyStatus,
  };
}
