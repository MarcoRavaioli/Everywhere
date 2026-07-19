import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import ProximityBanner from './ProximityBanner';
import { useApp } from '@/context/AppContext';

export default function SessionLayout() {
  const { isInSession } = useApp();

  if (!isInSession) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ProximityBanner />
      <div className="pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
