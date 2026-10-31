import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import SubscriptionModal from '../components/subscriptions/SubscriptionModal';
import SubscriptionActionModal from '../components/subscriptions/SubscriptionActionModal';

export default function SubscriptionsPage() {
  const { user, isStaff, isAdmin, isCustomer, authFetch } = useAuth();

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionModalConfig, setActionModalConfig] = useState({
    isOpen: false,
    actionType: null,
    subscription: null
  });

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/subscriptions';
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch subscriptions.');
      }

      const list = Array.isArray(data) ? data : data.subscriptions || [];
      setSubscriptions(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Filtered subscriptions based on search query
  const filteredSubscriptions = useMemo(() => {
    if (!searchQuery.trim()) return subscriptions;
    const q = searchQuery.toLowerCase();
    return subscriptions.filter((s) => {
      const custName = (s.customer_name || '').toLowerCase();
      const planName = (s.plan_name || '').toLowerCase();
      const idMatch = s.id.toString().includes(q);
      return custName.includes(q) || planName.includes(q) || idMatch;
    });
  }, [subscriptions, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    return {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.status === 'active' || s.status === 'renewed').length,
      paused: subscriptions.filter((s) => s.status === 'paused').length,
      closed: subscriptions.filter((s) => s.status === 'closed').length
    };
  }, [subscriptions]);

  // Action handlers
  const handleOpenAction = (actionType, subscription) => {
    setActionModalConfig({
      isOpen: true,
      actionType,
      subscription
    });
  };

  const handleActionSuccess = (updatedSub, msg) => {
    setFeedbackMessage({
      type: 'success',
      text: msg || `Subscription #${updatedSub.id} updated successfully.`
    });
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === updatedSub.id ? updatedSub : s))
    );
    // Dismiss message after 5 seconds
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleSubscriptionCreated = (newSub) => {
    setFeedbackMessage({
      type: 'success',
      text: `Subscription #${newSub.id} created successfully!`
    });
    setSubscriptions((prev) => [newSub, ...prev]);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Active
          </span>
        );
      case 'renewed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
            Renewed
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Paused
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
            Closed
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Subscription Lifecycle Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track, renew, pause, and manage customer subscriptions across dynamic billing periods.
          </p>
        </div>

        {(isAdmin || isStaff) && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:shadow"
          >
            <span className="mr-1.5 text-base leading-none">+</span> New Subscription
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Subscriptions</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.total}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block">Active & Renewed</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {stats.active}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 block">Paused</span>
          <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
            {stats.paused}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 block">Closed / Cancelled</span>
          <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
            {stats.closed}
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, plan, or subscription ID..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['all', 'active', 'renewed', 'paused', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading subscriptions...</p>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-bold text-slate-700">No subscriptions found</p>
            <p className="text-xs">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Get started by creating a subscription or accepting a quotation.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Plan & Pricing</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Current Period Ends</th>
                  <th className="px-5 py-3.5">Auto Renew</th>
                  <th className="px-5 py-3.5 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubscriptions.map((sub) => {
                  const isActive = sub.status === 'active';
                  const isRenewed = sub.status === 'renewed';
                  const isPaused = sub.status === 'paused';
                  const isClosed = sub.status === 'closed';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        #{sub.id}
                        {sub.quotation_id && (
                          <span
                            title={`Converted from Quotation #${sub.quotation_id}`}
                            className="block font-sans text-[10px] text-indigo-500 font-medium"
                          >
                            via Quote #{sub.quotation_id}
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {sub.customer_name || `Customer #${sub.customer_id}`}
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800 block">
                          {sub.plan_name || `Plan #${sub.plan_id}`}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ${(sub.plan_price || 0).toFixed(2)} / {sub.billing_interval || 'month'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {getStatusBadge(sub.status)}
                        {sub.pause_date && isPaused && (
                          <span className="block text-[10px] text-amber-700 mt-1">
                            Paused on {new Date(sub.pause_date).toLocaleDateString()}
                          </span>
                        )}
                        {sub.cancellation_reason && isClosed && (
                          <span
                            title={sub.cancellation_reason}
                            className="block text-[10px] text-rose-600 mt-1 truncate max-w-[140px]"
                          >
                            Reason: {sub.cancellation_reason}
                          </span>
                        )}
                      </td>

                      {/* Period End */}
                      <td className="px-5 py-4">
                        {sub.current_period_end ? (
                          <span className="font-medium text-slate-800">
                            {new Date(sub.current_period_end).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                        {sub.current_period_start && (
                          <span className="block text-[10px] text-slate-400">
                            Started: {new Date(sub.current_period_start).toLocaleDateString()}
                          </span>
                        )}
                      </td>

                      {/* Auto Renew */}
                      <td className="px-5 py-4">
                        {sub.auto_renew ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* If active or renewed */}
                          {(isActive || isRenewed) && (
                            <>
                              {(isAdmin || isStaff) && (
                                <>
                                  <button
                                    onClick={() => handleOpenAction('pause', sub)}
                                    className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                                  >
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleOpenAction('renew', sub)}
                                    className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                                  >
                                    Renew
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleOpenAction('cancel', sub)}
                                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {/* If paused */}
                          {isPaused && (
                            <>
                              {(isAdmin || isStaff) && (
                                <button
                                  onClick={() => handleOpenAction('resume', sub)}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                >
                                  Resume
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenAction('cancel', sub)}
                                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {/* If closed */}
                          {isClosed && (
                            <span className="text-[11px] text-slate-400 italic font-medium px-2 py-1">
                              Closed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Creation Modal */}
      <SubscriptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubscriptionCreated={handleSubscriptionCreated}
      />

      {/* Subscription Action Modal (Pause, Resume, Renew, Cancel) */}
      <SubscriptionActionModal
        isOpen={actionModalConfig.isOpen}
        actionType={actionModalConfig.actionType}
        subscription={actionModalConfig.subscription}
        onClose={() =>
          setActionModalConfig({ isOpen: false, actionType: null, subscription: null })
        }
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}

