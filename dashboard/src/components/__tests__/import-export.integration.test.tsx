/**
 * Integration tests for import/export functionality
 * Requirements: 17.3
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImportExport } from '../ImportExport';
import { apiClient } from '../../lib/api';

// Mock the API client
jest.mock('../../lib/api', () => ({
  apiClient: {
    exportConfigs: jest.fn(),
    importConfigs: jest.fn(),
  },
}));

describe('Import/Export Integration Tests', () => {
  const mockProjectId = 'project-1';
  const mockEnvironmentId = 'production';
  const mockOnImportComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement for download anchor only
    const originalCreateElement = document.createElement.bind(document);
    const mockAnchor = originalCreateElement('a');
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor;
      return originalCreateElement(tag);
    });
    const originalAppendChild = document.body.appendChild.bind(document.body);
    const originalRemoveChild = document.body.removeChild.bind(document.body);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: any) => originalAppendChild(node));
    jest.spyOn(document.body, 'removeChild').mockImplementation((node: any) => originalRemoveChild(node));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should export configurations successfully', async () => {
    const mockExportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
        { key_name: 'api_timeout', value: 5000, type: 'number' },
      ],
      rules: [
        { config_key_id: 'config-1', priority: 10, conditions: [] },
      ],
    };

    (apiClient.exportConfigs as jest.Mock).mockResolvedValue(mockExportData);

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const exportButton = screen.getByText('Export to JSON');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(apiClient.exportConfigs).toHaveBeenCalledWith(mockProjectId, mockEnvironmentId);
    });

    // Verify download was triggered
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('should handle export errors', async () => {
    (apiClient.exportConfigs as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Export failed' } },
    });

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const exportButton = screen.getByText('Export to JSON');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });
  });

  test('should show import preview when file is selected', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
        { key_name: 'api_timeout', value: 5000, type: 'number' },
      ],
      rules: [
        { config_key_id: 'config-1', priority: 10, conditions: [] },
      ],
    };

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create a mock file
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    // Mock FileReader
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger the onload event
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
      expect(screen.getByText(/Configurations: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Rules: 1/)).toBeInTheDocument();
    });
  });

  test('should handle invalid JSON file', async () => {
    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File(['invalid json'], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: 'invalid json',
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON file')).toBeInTheDocument();
    });
  });

  test('should import configurations successfully', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
      ],
      rules: [],
    };

    const mockImportResult = {
      created: 1,
      updated: 0,
      rulesImported: 0,
    };

    (apiClient.importConfigs as jest.Mock).mockResolvedValue(mockImportResult);

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Import');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.importConfigs).toHaveBeenCalledWith(mockImportData);
      expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      expect(screen.getByText(/Created: 1/)).toBeInTheDocument();
      expect(mockOnImportComplete).toHaveBeenCalled();
    });
  });

  test('should display import results correctly', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
        { key_name: 'api_timeout', value: 5000, type: 'number' },
      ],
      rules: [
        { config_key_id: 'config-1', priority: 10, conditions: [] },
      ],
    };

    const mockImportResult = {
      created: 1,
      updated: 1,
      rulesImported: 1,
    };

    (apiClient.importConfigs as jest.Mock).mockResolvedValue(mockImportResult);

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Import');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Created: 1/)).toBeInTheDocument();
      expect(screen.getByText(/Updated: 1/)).toBeInTheDocument();
      expect(screen.getByText(/Rules imported: 1/)).toBeInTheDocument();
    });
  });

  test('should handle import errors', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
      ],
      rules: [],
    };

    (apiClient.importConfigs as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Import validation failed' } },
    });

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Import');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Import validation failed')).toBeInTheDocument();
    });
  });

  test('should cancel import preview', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
      ],
      rules: [],
    };

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Import Preview')).not.toBeInTheDocument();
    });
  });

  test('should show full JSON in preview details', async () => {
    const mockImportData = {
      configs: [
        { key_name: 'feature_flag', value: true, type: 'boolean' },
      ],
      rules: [],
    };

    render(
      <ImportExport
        projectId={mockProjectId}
        environmentId={mockEnvironmentId}
        onImportComplete={mockOnImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File([JSON.stringify(mockImportData)], 'configs.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: JSON.stringify(mockImportData),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
    });

    const detailsElement = screen.getByText('View Full JSON');
    fireEvent.click(detailsElement);

    await waitFor(() => {
      expect(screen.getByText(/"key_name": "feature_flag"/)).toBeInTheDocument();
    });
  });
});
