'use client';

import React, { useState } from 'react';
import { Context, RuleTestResult } from '../types/context';

interface RuleTesterProps {
  configId: string;
  onTest: (context: Context) => Promise<RuleTestResult>;
}

export default function RuleTester({ configId, onTest }: RuleTesterProps) {
  const [context, setContext] = useState<Context>({});
  const [result, setResult] = useState<RuleTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAttributeKey, setCustomAttributeKey] = useState('');
  const [customAttributeValue, setCustomAttributeValue] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const testResult = await onTest(context);
      setResult(testResult);
    } catch (err: any) {
      setError(err.message || 'Failed to test rule evaluation');
    } finally {
      setLoading(false);
    }
  };

  const handleContextChange = (field: keyof Context, value: string) => {
    setContext(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleAddCustomAttribute = () => {
    if (customAttributeKey && customAttributeValue) {
      setContext(prev => ({
        ...prev,
        custom_attributes: {
          ...(prev.custom_attributes || {}),
          [customAttributeKey]: customAttributeValue,
        },
      }));
      setCustomAttributeKey('');
      setCustomAttributeValue('');
    }
  };

  const handleRemoveCustomAttribute = (key: string) => {
    setContext(prev => {
      const newCustomAttributes = { ...(prev.custom_attributes || {}) };
      delete newCustomAttributes[key];
      return {
        ...prev,
        custom_attributes: Object.keys(newCustomAttributes).length > 0 ? newCustomAttributes : undefined,
      };
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Test Rule Evaluation</h3>
      
      {/* Context Input Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="user_id" className="block text-sm font-medium text-gray-700">
            User ID
          </label>
          <input
            type="text"
            id="user_id"
            value={context.user_id || ''}
            onChange={(e) => handleContextChange('user_id', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., user123"
          />
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700">
            Region
          </label>
          <input
            type="text"
            id="region"
            value={context.region || ''}
            onChange={(e) => handleContextChange('region', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., us-east-1"
          />
        </div>

        <div>
          <label htmlFor="app_version" className="block text-sm font-medium text-gray-700">
            App Version
          </label>
          <input
            type="text"
            id="app_version"
            value={context.app_version || ''}
            onChange={(e) => handleContextChange('app_version', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., 1.2.3"
          />
        </div>

        <div>
          <label htmlFor="tier" className="block text-sm font-medium text-gray-700">
            Tier
          </label>
          <input
            type="text"
            id="tier"
            value={context.tier || ''}
            onChange={(e) => handleContextChange('tier', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., premium"
          />
        </div>

        {/* Custom Attributes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Attributes
          </label>
          
          {context.custom_attributes && Object.keys(context.custom_attributes).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(context.custom_attributes).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomAttribute(key)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={customAttributeKey}
              onChange={(e) => setCustomAttributeKey(e.target.value)}
              placeholder="Key"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <input
              type="text"
              value={customAttributeValue}
              onChange={(e) => setCustomAttributeValue(e.target.value)}
              placeholder="Value"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={handleAddCustomAttribute}
              disabled={!customAttributeKey || !customAttributeValue}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Test Button */}
      <button
        onClick={handleTest}
        disabled={loading}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
      >
        {loading ? 'Testing...' : 'Test Rule Evaluation'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="border-t pt-4">
            <h4 className="text-md font-medium text-gray-900 mb-2">Result</h4>
            <div className="bg-gray-50 p-4 rounded-md">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {JSON.stringify(result.value, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-900 mb-2">Matched Rule</h4>
            {result.matched_rule ? (
              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <p className="text-sm text-green-800">
                  <span className="font-medium">Rule ID:</span> {result.matched_rule.id}
                </p>
                <p className="text-sm text-green-800">
                  <span className="font-medium">Priority:</span> {result.matched_rule.priority}
                </p>
                <p className="text-sm text-green-800 mt-2">
                  <span className="font-medium">Value:</span>
                </p>
                <pre className="text-sm text-green-800 mt-1 whitespace-pre-wrap">
                  {JSON.stringify(result.matched_rule.value, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  No rule matched. Returned default value:
                </p>
                <pre className="text-sm text-yellow-800 mt-2 whitespace-pre-wrap">
                  {JSON.stringify(result.default_value, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Evaluation Trace */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-2">Evaluation Trace</h4>
            <div className="space-y-2">
              {result.evaluation_trace.map((trace, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md border ${
                    trace.matched
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Rule {trace.rule_id.substring(0, 8)}... (Priority: {trace.priority})
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        trace.matched ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {trace.matched ? '✓ Matched' : '✗ Not matched'}
                    </span>
                  </div>
                  {!trace.matched && trace.reason && (
                    <p className="text-sm text-gray-600 mt-1">Reason: {trace.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
