import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusDot from './components/status/StatusDot';
import { formatTime } from './utils/formatTime';
import useBusinessStore from './store/useBusinessStore';

describe('Flash Chat Frontend Component & Utility Tests', () => {
  test('StatusDot renders online status correctly', () => {
    render(<StatusDot isOnline={true} status="online" />);
    const dot = screen.getByRole('status');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('aria-label', 'Online');
  });

  test('StatusDot renders offline status correctly', () => {
    render(<StatusDot isOnline={false} />);
    const dot = screen.getByRole('status');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('aria-label', 'Offline');
  });

  test('formatTime formats valid timestamps', () => {
    const formatted = formatTime(new Date('2026-08-30T12:00:00Z'));
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });

  test('useBusinessStore initializes with default personal mode and handles mode switching', () => {
    const { isBusinessMode, setBusinessMode, toggleBusinessMode } = useBusinessStore.getState();
    expect(isBusinessMode).toBe(false);

    setBusinessMode(true);
    expect(useBusinessStore.getState().isBusinessMode).toBe(true);

    toggleBusinessMode();
    expect(useBusinessStore.getState().isBusinessMode).toBe(false);
  });

  test('useBusinessStore manages filter states properly', () => {
    const { setFilter, setStatusFilter, setPriorityFilter } = useBusinessStore.getState();

    setFilter('assigned_to_me');
    expect(useBusinessStore.getState().filter).toBe('assigned_to_me');

    setStatusFilter('pending');
    expect(useBusinessStore.getState().statusFilter).toBe('pending');

    setPriorityFilter('urgent');
    expect(useBusinessStore.getState().priorityFilter).toBe('urgent');
  });
});
