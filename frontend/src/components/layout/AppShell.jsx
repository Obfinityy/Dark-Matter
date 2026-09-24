import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Outlet } from 'react-router-dom';

export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} />
      <div className="main-content">
        <Topbar toggleSidebar={toggleSidebar} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
