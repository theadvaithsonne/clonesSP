type Status = 'online' | 'away' | 'busy' | 'offline';

const bg: Record<Status, string> = {
  online:  'bg-[#48bb78]',
  away:    'bg-[#f6ad55]',
  busy:    'bg-[#fc8181]',
  offline: 'bg-[#718096]',
};

export default function StatusDot({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return <span className={`inline-block shrink-0 rounded-full ring-1 ring-[#16213e] ${dim} ${bg[status]}`} />;
}
