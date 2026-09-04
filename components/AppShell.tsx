'use client';

import type { ReactNode } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import type { ReceivingStatus } from '@/lib/stealth/receiving';
import { TopNav } from './TopNav';
import { LeftRail } from './LeftRail';
import { MobileDrawer } from './MobileDrawer';

interface AppShellProps {
  children: ReactNode;
  rooms: LiveRoom[];
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  mobileDrawerOpen: boolean;
  onMobileDrawerChange: (open: boolean) => void;
  onSelectRoom: (room: LiveRoom) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  unreadCount: number;
  receivingStatus?: ReceivingStatus;
  isSwitchingAccount?: boolean;
  onConnect: () => void;
  onGoLive: () => void;
  onInboxToggle: () => void;
  onBrowse?: () => void;
  onViewStealthAddress?: () => void;
  onSwitchAccount?: () => void;
  onDisconnect?: () => void;
  inboxOpen?: boolean;
}

export function AppShell({
  children,
  rooms,
  sidebarCollapsed,
  onToggleSidebar,
  mobileDrawerOpen,
  onMobileDrawerChange,
  onSelectRoom,
  searchQuery,
  onSearchChange,
  isConnected,
  address,
  verifiedEnsName,
  unreadCount,
  receivingStatus,
  isSwitchingAccount,
  onConnect,
  onGoLive,
  onInboxToggle,
  onBrowse,
  onViewStealthAddress,
  onSwitchAccount,
  onDisconnect,
  inboxOpen,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <TopNav
        isConnected={isConnected}
        address={address}
        verifiedEnsName={verifiedEnsName}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        unreadCount={unreadCount}
        receivingStatus={receivingStatus}
        isSwitchingAccount={isSwitchingAccount}
        onConnect={onConnect}
        onMenuToggle={() => onMobileDrawerChange(true)}
        onGoLive={onGoLive}
        onInboxToggle={onInboxToggle}
        onBrowse={onBrowse}
        onViewStealthAddress={onViewStealthAddress}
        onSwitchAccount={onSwitchAccount}
        onDisconnect={onDisconnect}
      />

      <LeftRail
        rooms={rooms}
        onSelectRoom={onSelectRoom}
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />

      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => onMobileDrawerChange(false)}
        rooms={rooms}
        onSelectRoom={onSelectRoom}
      />

      <main
        className={`app-main ${
          sidebarCollapsed ? 'app-main--sidebar-collapsed' : 'app-main--sidebar-expanded'
        }`}
        style={{
          marginRight: inboxOpen ? 'min(var(--panel-width), 100vw)' : 0,
          transition: 'margin var(--duration-hover) ease',
        }}
      >
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
