import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function SubscriptionModal({ isOpen, onClose, onSubscriptionCreated }) {
  const { authFetch } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [status, setStatus] = useState('active');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch customers & plans when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoadingOptions(true);

    const loadData = async () => {
      try {
        const [custRes, planRes] = await Promise.all([
          authFetch('/customers?active=true'),
          authFetch('/plans')
        ]);

        const [custData, planData] = await Promise.all([
          custRes.json(),
          planRes.json()
        ]);

        if (custRes.ok) {
          const list = Array.isArray(custData) ? custData : custData.customers || [];
          setCustomers(list);
          if (list.length > 0 && !customerId) {
            setCustomerId(list[0].id.toString());
          }
        }

        if (planRes.ok) {
          const list = Array.isArray(planData) ? planData : planData.plans || [];
          setPlans(list);
          if (list.length > 0 && !planId) {
            setPlanId(list[0].id.toString());
          }
        }
      } catch (err) {
        setError('Failed to load customers or subscription plans: ' + err.message);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadData();
  }, [isOpen, authFetch]);

  // Find currently selected plan
  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.id.toString() === planId.toString()) || null;
  }, [plans, planId]);

  // Calculate dynamic period end
  const calculatedPeriodEnd = useMemo(() => {
    if (!selectedPlan || !startDate) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;

    const interval = (selectedPlan.billing_interval || 'monthly').toLowerCase();
    const end = new Date(start);

    if (interval === 'daily') {
      end.setDate(end.getDate() + 1);
    } else if (interval === 'weekly') {
      end.setDate(end.getDate() + 7);
    } else if (interval === 'yearly') {
      end.setDate(end.getDate() + 365);
    } else {
      // default monthly: +30 days
      end.setDate(end.getDate() + 30);
    }

    return end.toISOString().split('T')[0];
  }, [selectedPlan, startDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (!planId) {
      setError('Please select a subscription plan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customer_id: parseInt(customerId, 10),
        plan_id: parseInt(planId, 10),
        start_date: new Date(startDate).toISOString(),
        auto_renew: autoRenew,
        status: status
      };

      const res = await authFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create subscription.');
      }

      onSubscriptionCreated(data.subscription);
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-bold text-base">Create New Subscription</h3>
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
              <span className="text-xs">Loading available customers and plans...</span>
            </div>
          ) : (
            <>
              {/* Customer Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Organization / Account *
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
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No active customers found. Please add a customer first.
                  </p>
                )}
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subscription Plan *
                </label>
                <select
                  required
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
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

              {/* Dynamic Billing Period Info */}
              {selectedPlan && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-indigo-900 font-semibold">
                    <span>Recurring Rate:</span>
                    <span>
                      ${selectedPlan.price.toFixed(2)} / {selectedPlan.billing_interval}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-700 text-[11px]">
                    <span>Billing Interval:</span>
                    <span className="capitalize font-medium">{selectedPlan.billing_interval}</span>
                  </div>
                  {calculatedPeriodEnd && (
                    <div className="flex justify-between items-center text-indigo-700 text-[11px]">
                      <span>First Period Ends:</span>
                      <span className="font-bold text-indigo-900">{calculatedPeriodEnd}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Start Date & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="active">Active (Immediate)</option>
                    <option value="draft">Draft (Pending setup)</option>
                  </select>
                </div>
              </div>

              {/* Auto Renew Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoRenew" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Auto-renew subscription at end of billing cycle
                </label>
              </div>
            </>
          )}

          {/* Buttons */}
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
              disabled={submitting || loadingOptions || customers.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              {submitting && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Create Subscription</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

