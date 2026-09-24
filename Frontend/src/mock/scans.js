export const mockScans = [
  {
    id: 'scan_1',
    projectId: 'proj_1',
    targetId: 'target_1',
    mode: 'HIGH',
    status: 'running',
    findings: 3,
    started: '1 hour ago',
    progress: 65,
    currentPhase: 'Attack Surface Analysis',
    elapsedTime: '01:15:22',
    estimatedUsage: '$4.50'
  },
  {
    id: 'scan_2',
    projectId: 'proj_1',
    targetId: 'target_2',
    mode: 'NORMAL',
    status: 'completed',
    findings: 2,
    started: '2 days ago',
    progress: 100,
    currentPhase: 'Completed',
    elapsedTime: '04:20:10',
    estimatedUsage: '$1.20'
  },
  {
    id: 'scan_3',
    projectId: 'proj_2',
    targetId: 'target_3',
    mode: 'ULTRA HIGH',
    status: 'failed',
    findings: 0,
    started: '3 days ago',
    progress: 20,
    currentPhase: 'Reconnaissance',
    elapsedTime: '00:15:00',
    estimatedUsage: '$0.50'
  }
];
