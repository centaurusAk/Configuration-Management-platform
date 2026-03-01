/**
 * Integration tests for audit log viewer
 * Requirements: 8.6
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuditPage from '../page';
import { apiClient } from '../../../../lib/api';

// Mock the API client
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    getAuditLogs: jest.fn(),
  },
}));

// Mock the DashboardLayout
jest.mock('../../../../components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Audit Log Viewer Integration Tests', () => {
  const mockAuditLogs = [
    {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      user_id: 'user-123',
      organization_id: 'org-1',
      action_type: 'CREATE' as const,
      resource_type: 'CONFIG_KEY' as const,
      resource_id: 'config-1',
      old_value: null,
      new_value: { value: true },
      metadata: {},
    },
    {
      id: '2',
      timestamp: '2024-01-15T11:00:00Z',
      user_id: 'user-456',
      organization_id: 'org-1',
      action_type: 'UPDATE' as const,
      resource_type: 'CONFIG_KEY' as const,
      resource_id: 'config-2',
      old_value: { value: false },
      new_value: { value: true },
      metadata: {},
    },
    {
      id: '3',
      timestamp: '2024-01-15T12:00:00Z',
      user_id: 'user-123',
      organization_id: 'org-1',
      action_type: 'DELETE' as const,
      resource_type: 'RULE' as const,
      resource_id: 'rule-1',
      old_value: { priority: 10 },
      new_value: null,
      metadata: {},
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should display audit logs on load', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs,
      total: 3,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getAllByText('user-123')[0]).toBeInTheDocument();
      expect(screen.getByText('user-456')).toBeInTheDocument();
    });

    // Check that all action types are displayed
    expect(screen.getAllByText('CREATE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('UPDATE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DELETE').length).toBeGreaterThan(0);
  });

  test('should filter by action type', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs.filter(log => log.action_type === 'UPDATE'),
      total: 1,
    });

    render(<AuditPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalled();
    });

    // Select UPDATE action type
    const actionTypeSelect = screen.getByLabelText('Action Type');
    fireEvent.change(actionTypeSelect, { target: { value: 'UPDATE' } });

    // Click apply filters
    const applyButton = screen.getByText('Apply Filters');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'UPDATE',
        })
      );
    });
  });

  test('should filter by resource type', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs.filter(log => log.resource_type === 'RULE'),
      total: 1,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalled();
    });

    const resourceTypeSelect = screen.getByLabelText('Resource Type');
    fireEvent.change(resourceTypeSelect, { target: { value: 'RULE' } });

    const applyButton = screen.getByText('Apply Filters');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'RULE',
        })
      );
    });
  });

  test('should filter by date range', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs,
      total: 3,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalled();
    });

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    fireEvent.change(startDateInput, { target: { value: '2024-01-15T10:00' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-15T12:00' } });

    const applyButton = screen.getByText('Apply Filters');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: {
            start: '2024-01-15T10:00',
            end: '2024-01-15T12:00',
          },
        })
      );
    });
  });

  test('should filter by user ID', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs.filter(log => log.user_id === 'user-123'),
      total: 2,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalled();
    });

    const userIdInput = screen.getByLabelText('User ID');
    fireEvent.change(userIdInput, { target: { value: 'user-123' } });

    const applyButton = screen.getByText('Apply Filters');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });
  });

  test('should clear filters', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs,
      total: 3,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalled();
    });

    // Set some filters
    const userIdInput = screen.getByLabelText('User ID');
    fireEvent.change(userIdInput, { target: { value: 'user-123' } });

    const actionTypeSelect = screen.getByLabelText('Action Type');
    fireEvent.change(actionTypeSelect, { target: { value: 'UPDATE' } });

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    // Check that inputs are cleared
    expect(userIdInput).toHaveValue('');
    expect(actionTypeSelect).toHaveValue('');
  });

  test('should paginate results', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: mockAuditLogs,
      total: 50,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 20,
        })
      );
    });
  });

  test('should display old and new values', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: [mockAuditLogs[1]], // UPDATE log with old and new values
      total: 1,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText(/false/)).toBeInTheDocument();
      expect(screen.getByText(/true/)).toBeInTheDocument();
    });
  });

  test('should handle API errors gracefully', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Failed to fetch audit logs' } },
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch audit logs')).toBeInTheDocument();
    });
  });

  test('should display empty state when no logs found', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      logs: [],
      total: 0,
    });

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('No audit logs found.')).toBeInTheDocument();
    });
  });
});
