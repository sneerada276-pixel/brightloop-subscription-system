import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function DiscountModal({ isOpen, onClose, onDiscountCreated }) {
  const { isStaff, isAdmin, authFetch } = useAuth();

  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [value, setValue] = useState('');
  const [minPurchaseAmount, setMinPurchaseAmount] = useState('0');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [usageLimit, setUsageLimit] = useState('100');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Active tab: 'list' or 'create'
  const [activeTab, setActiveTab] = useState('list');

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/discounts');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch discounts.');
      }
      const list = Array.isArray(data) ? data : data.discounts || [];
      setDiscounts(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isOpen) {
      fetchDiscounts();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchDiscounts]);

  if (!isOpen) return null;

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Discount code is required.');
      return;
    }

    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setError('Please provide a positive discount value.');
      return;
    }
    if (discountType === 'percentage' && numVal > 100) {
      setError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        value: numVal,
        min_purchase_amount: parseFloat(minPurchaseAmount) || 0.0,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_to: validTo ? new Date(validTo).toISOString() : null,
        usage_limit: parseInt(usageLimit, 10) || 100,
        is_active: isActive
      };

      const res = await authFetch('/discounts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create discount.');
      }

      setSuccessMessage(`Discount code "${data.discount.code}" created successfully!`);
      setCode('');
      setValue('');
      setMinPurchaseAmount('0');
      setValidFrom('');
      setValidTo('');
      setUsageLimit('100');
      setIsActive(true);

      if (onDiscountCreated) {
        onDiscountCreated(data.discount);
      }

      fetchDiscounts();
      setActiveTab('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <h3 className="font-bold text-base">Discounts & Promo Codes</h3>
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
              Promo Codes ({discounts.length})
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
                + Add New Discount
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

          {/* TAB 1: LIST DISCOUNTS */}
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Loading discount codes...</span>
                </div>
              ) : discounts.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  <p className="font-medium">No promo codes created yet.</p>
                  {(isAdmin || isStaff) && (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Create First Promo Code
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {discounts.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white hover:border-indigo-200 flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">
                            {d.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {d.discount_type === 'percentage' ? `${d.value}% Off` : `$${d.value.toFixed(2)} Off`}
                          </span>
                          {d.is_active ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium text-slate-400 bg-slate-100">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 space-x-2">
                          <span>Min Spend: ${d.min_purchase_amount.toFixed(2)}</span>
                          <span>•</span>
                          <span>Used: {d.used_count} / {d.usage_limit}</span>
                        </div>
                      </div>
                      {d.valid_to && (
                        <div className="text-right text-[11px] text-slate-500">
                          Expires: {new Date(d.valid_to).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE DISCOUNT */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateDiscount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Promo Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g., WINTER25"
                    className="w-full font-mono uppercase text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Discount Value {discountType === 'percentage' ? '(%)' : '($)'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={discountType === 'percentage' ? '20' : '15.00'}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Purchase ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minPurchaseAmount}
                    onChange={(e) => setMinPurchaseAmount(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valid From (Optional)
                  </label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valid To (Optional)
                  </label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Usage Limit (Max redemptions)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <input
                    type="checkbox"
                    id="discountActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="discountActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Active Code
                  </label>
                </div>
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
                  <span>Save Promo Code</span>
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

