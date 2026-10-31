import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function QuotationTemplateModal({ isOpen, onClose, onTemplateCreated }) {
  const { isStaff, isAdmin, authFetch } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [defaultValidityDays, setDefaultValidityDays] = useState('30');
  const [termsConditions, setTermsConditions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active tab: 'list' or 'create'
  const [activeTab, setActiveTab] = useState('list');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/quotation-templates');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch quotation templates.');
      }
      const list = Array.isArray(data) ? data : data.templates || [];
      setTemplates(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchTemplates]);

  if (!isOpen) return null;

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        name: name.trim(),
        default_validity_days: parseInt(defaultValidityDays, 10) || 30,
        terms_conditions: termsConditions.trim() || null
      };

      const res = await authFetch('/quotation-templates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create template.');
      }

      setSuccessMessage(`Template "${data.template.name}" created successfully!`);
      setName('');
      setDefaultValidityDays('30');
      setTermsConditions('');

      if (onTemplateCreated) {
        onTemplateCreated(data.template);
      }

      fetchTemplates();
      setActiveTab('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <h3 className="font-bold text-base">Quotation Templates</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Sub-header Navigation */}
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
              All Templates ({templates.length})
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
                + Create New Template
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

          {/* TAB 1: LIST TEMPLATES */}
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  <p className="font-medium">No quotation templates configured yet.</p>
                  {(isAdmin || isStaff) && (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Create First Template
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{tpl.name}</h4>
                          <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">
                            Default validity: {tpl.default_validity_days || 30} days
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">ID: #{tpl.id}</span>
                      </div>
                      {tpl.terms_conditions && (
                        <div className="mt-3 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 whitespace-pre-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Terms & Conditions:
                          </span>
                          {tpl.terms_conditions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE TEMPLATE */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Enterprise SaaS Terms"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Default Validity Period (Days) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={defaultValidityDays}
                  onChange={(e) => setDefaultValidityDays(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Quotations created using this template will expire this many days from issue date.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  rows={4}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  placeholder="Insert payment terms, service level agreement notes, termination policies..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
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
                  <span>Save Template</span>
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

