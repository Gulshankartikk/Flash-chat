import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusDot from './components/status/StatusDot';
import { formatTime } from './utils/formatTime';

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
});
