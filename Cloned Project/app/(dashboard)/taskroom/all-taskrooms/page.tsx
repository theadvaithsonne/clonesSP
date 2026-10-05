'use client';

import { useSearchParams } from 'next/navigation';
import TaskroomDashboardSunpage from './components/TaskroomSubPage';
import TaskroomDashboard from './components/AllTaskroomDashbaord';

export default function SmartDashboard() {
  const searchParams = useSearchParams();
  const taskroomId = searchParams.get('taskroomId');

  if (taskroomId) {
    return (
      <div className="min-h-screen overflow-hidden"
        style={{
          height: "100vh",
          overflow: "hidden"
        }}
      >
        <TaskroomDashboardSunpage />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden"
      style={{
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <TaskroomDashboard />
    </div>
  );
}