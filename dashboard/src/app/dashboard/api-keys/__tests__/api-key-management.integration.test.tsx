/**
 * Integration tests for API key management
 * Requirements: 14.6
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApiKeysPage from '../page';
import { apiClient } from '../../../../lib/api';

// Mock the API client
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    getApiKeys: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
  },
}));

// Mock the DashboardLayout
jest.mock('../../../../components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the ConfirmDialog
jest.mock('../../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ title, message, onConfirm, onCancel }: any) => (
    <div data-testid="confirm-dialog">
      <h3>{title}</h3>
      <p>{message}</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('API Key Management Integration Tests', () => {
  const mockApiKeys = [
    {
      id: 'key-1',
      prefix: 'sk_test_',
      project_id: 'project-1',
      environment_id: 'production',
      created_at: '2024-01-15T10:00:00Z',
      expires_at: null,
      revoked: false,
    },
    {
      id: 'key-2',
      prefix: 'sk_prod_',
      project_id: 'project-1',
      environment_id: 'production',
      created_at: '2024-01-10T10:00:00Z',
      expires_at: '2024-12-31T23:59:59Z',
      revoked: false,
    },
    {
      id: 'key-3',
      prefix: 'sk_old_',
      project_id: 'project-1',
      environment_id: 'staging',
      created_at: '2024-01-01T10:00:00Z',
      expires_at: null,
      revoked: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });
  });

  test('should display API keys on load', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: mockApiKeys,
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('sk_test_...')).toBeInTheDocument();
      expect(screen.getByText('sk_prod_...')).toBeInTheDocument();
      expect(screen.getByText('sk_old_...')).toBeInTheDocument();
    });
  });

  test('should show active and revoked status', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: mockApiKeys,
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      const activeStatuses = screen.getAllByText('Active');
      expect(activeStatuses).toHaveLength(2);
      expect(screen.getByText('Revoked')).toBeInTheDocument();
    });
  });

  test('should open create form when clicking Create API Key button', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [],
    });

    render(<ApiKeysPage />);

    const createButton = screen.getByText('Create API Key');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project ID')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter environment ID')).toBeInTheDocument();
    });
  });

  test('should create API key successfully', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [],
    });

    const newKey = 'sk_test_1234567890abcdef';
    (apiClient.createApiKey as jest.Mock).mockResolvedValue({
      key: newKey,
    });

    render(<ApiKeysPage />);

    // Open create form
    const createButton = screen.getByText('Create API Key');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project ID')).toBeInTheDocument();
    });

    // Fill in form
    const projectIdInput = screen.getByPlaceholderText('Enter project ID');
    const environmentIdInput = screen.getByPlaceholderText('Enter environment ID');

    fireEvent.change(projectIdInput, { target: { value: 'project-1' } });
    fireEvent.change(environmentIdInput, { target: { value: 'production' } });

    // Submit form
    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.createApiKey).toHaveBeenCalledWith({
        projectId: 'project-1',
        environmentId: 'production',
      });
    });

    // Check that generated key is displayed
    await waitFor(() => {
      expect(screen.getByText('API Key Created Successfully!')).toBeInTheDocument();
      expect(screen.getByDisplayValue(newKey)).toBeInTheDocument();
    });
  });

  test('should copy API key to clipboard', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [],
    });

    const newKey = 'sk_test_1234567890abcdef';
    (apiClient.createApiKey as jest.Mock).mockResolvedValue({
      key: newKey,
    });

    render(<ApiKeysPage />);

    // Create API key
    const createButton = screen.getByText('Create API Key');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project ID')).toBeInTheDocument();
    });

    const projectIdInput = screen.getByPlaceholderText('Enter project ID');
    const environmentIdInput = screen.getByPlaceholderText('Enter environment ID');

    fireEvent.change(projectIdInput, { target: { value: 'project-1' } });
    fireEvent.change(environmentIdInput, { target: { value: 'production' } });

    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API Key Created Successfully!')).toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(newKey);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  test('should show expiration date when set', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: mockApiKeys,
    });

    render(<ApiKeysPage />);

    const expectedDate = new Date('2024-12-31T23:59:59Z').toLocaleDateString();
    await waitFor(() => {
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
      const neverTexts = screen.getAllByText('Never');
      expect(neverTexts.length).toBeGreaterThan(0);
    });
  });

  test('should open revoke confirmation dialog', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: mockApiKeys,
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('sk_test_...')).toBeInTheDocument();
    });

    // Click revoke button for first active key
    const revokeButtons = screen.getAllByText('Revoke');
    fireEvent.click(revokeButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Revoke API Key')).toBeInTheDocument();
    });
  });

  test('should revoke API key successfully', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: mockApiKeys,
    });

    (apiClient.revokeApiKey as jest.Mock).mockResolvedValue({});

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('sk_test_...')).toBeInTheDocument();
    });

    // Click revoke button
    const revokeButtons = screen.getAllByText('Revoke');
    fireEvent.click(revokeButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    // Confirm revocation
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.revokeApiKey).toHaveBeenCalledWith('key-1');
    });
  });

  test('should not show revoke button for already revoked keys', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [mockApiKeys[2]], // Only the revoked key
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('sk_old_...')).toBeInTheDocument();
      expect(screen.getByText('Revoked')).toBeInTheDocument();
    });

    // Should not have any revoke buttons
    expect(screen.queryByText('Revoke')).not.toBeInTheDocument();
  });

  test('should handle API errors when creating key', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [],
    });

    (apiClient.createApiKey as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Failed to create API key' } },
    });

    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation();

    render(<ApiKeysPage />);

    const createButton = screen.getByText('Create API Key');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter project ID')).toBeInTheDocument();
    });

    const projectIdInput = screen.getByPlaceholderText('Enter project ID');
    const environmentIdInput = screen.getByPlaceholderText('Enter environment ID');

    fireEvent.change(projectIdInput, { target: { value: 'project-1' } });
    fireEvent.change(environmentIdInput, { target: { value: 'production' } });

    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Failed to create API key');
    });

    alertMock.mockRestore();
  });

  test('should display empty state when no API keys exist', async () => {
    (apiClient.getApiKeys as jest.Mock).mockResolvedValue({
      apiKeys: [],
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('No API keys found. Create one to get started.')).toBeInTheDocument();
    });
  });
});
