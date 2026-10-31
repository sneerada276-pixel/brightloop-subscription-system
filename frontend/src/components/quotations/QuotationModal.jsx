import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function QuotationModal({
  isOpen,
  onClose,
  quotationToEdit,
  onQuotationSaved
}) {
  const { authFetch } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [validityDays, setValidityDays] = useState('30');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(quotationToEdit && quotationToEdit.id);

  // Fetch dropdown options when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoadingOptions(true);

    const loadData = async () => {
      try {
        const [custRes, planRes, tplRes] = await Promise.all([
          authFetch('/customers?active=true'),
          authFetch('/plans'),
          authFetch('/quotation-templates')
        ]);

        const [custData, planData, tplData] = await Promise.all([
          custRes.json(),
          planRes.json(),
          tplRes.json()
        ]);

        if (custRes.ok) {
          const list = Array.isArray(custData) ? custData : custData.customers || [];
          setCustomers(list);
        }

        if (planRes.ok) {
          const list = Array.isArray(planData) ? planData : planData.plans || [];
          setPlans(list);
        }

        if (tplRes.ok) {
          const list = Array.isArray(tplData) ? tplData : tplData.templates || [];
          setTemplates(list);
        }
      } catch (err) {
        setError('Failed to load form options: ' + err.message);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadData();
  }, [isOpen, authFetch]);

  // Set initial form values based on edit or new
  useEffect(() => {
    if (!isOpen) return;

    if (quotationToEdit) {
      setQuotationNumber(quotationToEdit.quotation_number || '');
      setCustomerId(quotationToEdit.customer_id ? quotationToEdit.customer_id.toString() : '');
      setPlanId(quotationToEdit.plan_id ? quotationToEdit.plan_id.toString() : '');
      setTemplateId(quotationToEdit.template_id ? quotationToEdit.template_id.toString() : '');
      setTotalAmount(quotationToEdit.total_amount !== undefined ? quotationToEdit.total_amount.toString() : '');
      setValidityDays('30');
    } else {
      // Auto-generate fresh quotation number
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      setQuotationNumber(`QT-${new Date().getFullYear()}-${randomDigits}`);
      setCustomerId('');
      setPlanId('');
      setTemplateId('');
      setTotalAmount('');
      setValidityDays('30');
    }
    setError(null);
  }, [quotationToEdit, isOpen]);

  // When plan changes, update totalAmount default if not already set or in create mode
  const handlePlanChange = (e) => {
    const pId = e.target.value;
    setPlanId(pId);
    if (!isEditing || !totalAmount) {
      const selected = plans.find((p) => p.id.toString() === pId);
      if (selected) {
        setTotalAmount(selected.price.toString());
      }
    }
  };

  // When template changes, update validity days default
  const handleTemplateChange = (e) => {
    const tId = e.target.value;
    setTemplateId(tId);
    if (tId) {
      const selected = templates.find((t) => t.id.toString() === tId);
      if (selected && selected.default_validity_days) {
        setValidityDays(selected.default_validity_days.toString());
      }
    }
  };

  // Dynamic preview of valid_until
  const calculatedValidUntil = useMemo(() => {
    const days = parseInt(validityDays, 10);
    if (isNaN(days) || days <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, [validityDays]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quotationNumber.trim()) {
      setError('Quotation number is required.');
      return;
    }
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (!planId) {
      setError('Please select a plan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        quotation_number: quotationNumber.trim(),
        customer_id: parseInt(customerId, 10),
        plan_id: parseInt(planId, 10),
        template_id: templateId ? parseInt(templateId, 10) : null,
        total_amount: parseFloat(totalAmount) || 0.0,
        validity_days: parseInt(validityDays, 10) || 30
      };

      const endpoint = isEditing ? `/quotations/${quotationToEdit.id}` : '/quotations';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save quotation.');
      }

      onQuotationSaved(data.quotation);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h3 className="font-bold text-base">
              {isEditing ? `Edit Quotation (${quotationToEdit.quotation_number})` : 'Create New Quotation'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {loadingOptions ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading form options...</span>
            </div>
          ) : (
            <>
              {/* Quotation Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quotation Number (Unique) *
                </label>
                <input
                  type="text"
                  required
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  placeholder="e.g., QT-2026-1001"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Organization / Contact *
                </label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : `(${c.email})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proposed Subscription Plan *
                </label>
                <select
                  required
                  value={planId}
                  onChange={handlePlanChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                >
                  <option value="">-- Choose Plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${p.price.toFixed(2)} / {p.billing_interval}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quotation Template (Optional)
                </label>
                <select
                  value={templateId}
                  onChange={handleTemplateChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                >
                  <option value="">-- No Template (Custom Terms) --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.default_validity_days} days validity)
                    </option>
                  ))}
                </select>
              </div>

              {/* Total Amount & Validity Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quoted Total Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Real-time Valid Until preview */}
              {calculatedValidUntil && (
                <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-indigo-800 font-medium">Estimated Expiry Date:</span>
                  <span className="font-bold text-indigo-900">{calculatedValidUntil}</span>
                </div>
              )}
            </>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingOptions}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              {submitting && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{isEditing ? 'Save Changes' : 'Create Quotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

