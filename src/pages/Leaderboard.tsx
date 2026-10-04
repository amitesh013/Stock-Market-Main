import React from 'react';
import LeaderboardBoard from '../components/Leaderboard';
import { PageHeader } from '../components/dashboard/ui';

export default function Leaderboard() {
  return (
    <div>
      <PageHeader title="Leaderboard" description="One continuous competition. Rankings update live with every portfolio value change." />
      <div className="min-h-[560px]">
        <LeaderboardBoard />
      </div>
    </div>
  );
}
