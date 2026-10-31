import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function SubscriptionActionModal({
  isOpen,
  actionType,
  subscription,
  onClose,
  onSuccess
}) {
  const { authFetch } = useAuth();
  const [cancellationReason, setCancellationReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !subscription || !actionType) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'pause':
        return {
          title: 'Pause Subscription',
          endpoint: `/subscriptions/${subscription.id}/pause`,
          btnColor: 'bg-amber-600 hover:bg-amber-700',
          btnText: 'Pause Subscription',
          iconBg: 'bg-amber-100 text-amber-700',
          description:
            'Temporarily suspend access and recurring billing for this subscription. You can resume it at any time.'
        };
      case 'resume':
        return {
          title: 'Resume Subscription',
          endpoint: `/subscriptions/${subscription.id}/resume`,
          btnColor: 'bg-emerald-600 hover:bg-emerald-700',
          btnText: 'Resume Active Service',
          iconBg: 'bg-emerald-100 text-emerald-700',
          description:
            'Reactivate this subscription and restore active access for the customer immediately.'
        };
      case 'renew':
        return {
          title: 'Renew Subscription',
          endpoint: `/subscriptions/${subscription.id}/renew`,
          btnColor: 'bg-indigo-600 hover:bg-indigo-700',
          btnText: 'Confirm Renewal',
          iconBg: 'bg-indigo-100 text-indigo-700',
          description: `Advance this subscription period by one billing cycle (${subscription.billing_interval || 'monthly'}). The renewed period will take effect immediately.`
        };
      case 'cancel':
        return {
          title: 'Cancel / Close Subscription',
          endpoint: `/subscriptions/${subscription.id}/cancel`,
          btnColor: 'bg-rose-600 hover:bg-rose-700',
          btnText: 'Confirm Cancellation',
          iconBg: 'bg-rose-100 text-rose-700',
          description:
            'This action closes the subscription. Please provide a reason for records and audit compliance.'
        };
      default:
        return {
          title: 'Confirm Action',
          endpoint: `/subscriptions/${subscription.id}`,
          btnColor: 'bg-indigo-600 hover:bg-indigo-700',
          btnText: 'Confirm',
          iconBg: 'bg-slate-100 text-slate-700',
          description: 'Are you sure you want to proceed with this action?'
        };
    }
  };

  const config = getActionConfig();

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (actionType === 'cancel' && !cancellationReason.trim()) {
      setError('Please provide a brief reason for cancellation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body =
        actionType === 'cancel'
          ? JSON.stringify({ cancellation_reason: cancellationReason.trim() })
          : undefined;

      const res = await authFetch(config.endpoint, {
        method: 'POST',
        body
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete subscription action.');
      }

      onSuccess(data.subscription, data.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h3 className="font-bold text-base">{config.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Details summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Subscription ID:</span>
              <span className="font-bold text-slate-800">#{subscription.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Customer:</span>
              <span className="font-semibold text-slate-800">
                {subscription.customer_name || `Customer #${subscription.customer_id}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Plan:</span>
              <span className="font-semibold text-indigo-600">
                {subscription.plan_name || `Plan #${subscription.plan_id}`} (${subscription.plan_price || 0}/{subscription.billing_interval || 'mo'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Current Status:</span>
              <span className="font-bold uppercase tracking-wider text-slate-700">
                {subscription.status}
              </span>
            </div>
            {subscription.current_period_end && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Period Ends:</span>
                <span className="font-medium text-slate-800">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{config.description}</p>

          {/* Cancellation Reason input */}
          {actionType === 'cancel' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Requested by customer due to budget changes..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 bg-white"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5 ${config.btnColor}`}
            >
              {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{config.btnText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

