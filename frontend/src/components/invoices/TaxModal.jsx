import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function TaxModal({ isOpen, onClose, onTaxCreated }) {
  const { isStaff, isAdmin, authFetch } = useAuth();

  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Active tab: 'list' or 'create'
  const [activeTab, setActiveTab] = useState('list');

  const fetchTaxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/taxes');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch taxes.');
      }
      const list = Array.isArray(data) ? data : data.taxes || [];
      setTaxes(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isOpen) {
      fetchTaxes();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchTaxes]);

  if (!isOpen) return null;

  const handleCreateTax = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tax name is required.');
      return;
    }

    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate < 0) {
      setError('Please provide a valid non-negative tax rate percentage.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        name: name.trim(),
        rate: numRate,
        is_active: isActive
      };

      const res = await authFetch('/taxes', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create tax rule.');
      }

      setSuccessMessage(`Tax rule "${data.tax.name}" created successfully!`);
      setName('');
      setRate('');
      setIsActive(true);

      if (onTaxCreated) {
        onTaxCreated(data.tax);
      }

      fetchTaxes();
      setActiveTab('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-bold text-base">Tax Configuration</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Subheader */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Rules ({taxes.length})
            </button>
            {(isAdmin || isStaff) && (
              <button
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'create'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Add New Tax
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
              {successMessage}
            </div>
          )}

          {/* TAB 1: LIST TAXES */}
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Loading tax rules...</span>
                </div>
              ) : taxes.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  <p className="font-medium">No tax rules configured yet.</p>
                  {(isAdmin || isStaff) && (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Add First Tax Rule
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {taxes.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white hover:border-indigo-200 flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-xs text-slate-900">{t.name}</h4>
                          {t.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400 bg-slate-100">
                              Inactive
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">Tax ID: #{t.id}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-extrabold text-indigo-700">
                          {t.rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE TAX */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateTax} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tax Label / Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., GST 18%, State Sales Tax 6.25%, VAT 5%"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tax Rate (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g., 18.0"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="taxActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="taxActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Active (available for new invoices)
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submitting && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Save Tax Rule</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
