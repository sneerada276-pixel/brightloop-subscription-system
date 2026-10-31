import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export default function PaymentsPage() {
  const { user, isAdmin, isStaff, isCustomer, authFetch } = useAuth();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // In-flight refund action
  const [processingRefundId, setProcessingRefundId] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/payments');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch payments.');
      }
      const list = Array.isArray(data) ? data : data.payments || [];
      setPayments(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Filtered payments by search & status
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const txnMatch = (p.transaction_id || '').toLowerCase().includes(q);
      const invMatch = (p.invoice_number || '').toLowerCase().includes(q);
      const custMatch = (p.customer_name || '').toLowerCase().includes(q);
      return txnMatch || invMatch || custMatch;
    });
  }, [payments, searchQuery, statusFilter]);

  // Metrics
  const stats = useMemo(() => {
    const totalCount = payments.length;
    const successful = payments.filter((p) => p.status === 'success');
    const totalCollected = successful.reduce((sum, p) => sum + (p.amount || 0), 0);
    const refunded = payments.filter((p) => p.status === 'refunded');
    const refundedTotal = refunded.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalCount,
      successCount: successful.length,
      totalCollected,
      refundedCount: refunded.length,
      refundedTotal
    };
  }, [payments]);

  // Refund handler (admin only)
  const handleRefund = async (payment) => {
    if (!window.confirm(`Are you sure you want to refund transaction ${payment.transaction_id} ($${payment.amount.toFixed(2)})?`)) {
      return;
    }

    setProcessingRefundId(payment.id);
    setError(null);

    try {
      const res = await authFetch(`/payments/${payment.id}/refund`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refund payment.');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Transaction ${payment.transaction_id} refunded successfully.`
      });
      setPayments((prev) =>
        prev.map((p) => (p.id === payment.id ? data.payment : p))
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingRefundId(null);
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'credit_card':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            💳 Credit Card
          </span>
        );
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            🏦 Bank Transfer
          </span>
        );
      case 'upi':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            📱 UPI
          </span>
        );
      case 'cash':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            💵 Cash
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Success
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Refunded
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Payment Audit Log & Transactions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time record of all client settlements across credit card, bank wire, UPI, and cash.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Transactions</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.totalCount}
          </span>
          <span className="text-[11px] text-slate-400">All payment records</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block">Net Collected</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            ${stats.totalCollected.toFixed(2)}
          </span>
          <span className="text-[11px] text-emerald-600/80 font-medium">
            {stats.successCount} successful
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 block">Refunds</span>
          <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
            ${stats.refundedTotal.toFixed(2)}
          </span>
          <span className="text-[11px] text-amber-600/80 font-medium">
            {stats.refundedCount} transactions refunded
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-indigo-600 block">Settlement Rate</span>
          <span className="text-2xl font-extrabold text-indigo-700 mt-1 block">
            {stats.totalCount > 0
              ? `${Math.round((stats.successCount / stats.totalCount) * 100)}%`
              : '100%'}
          </span>
          <span className="text-[11px] text-indigo-600/80 font-medium">Payment success ratio</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
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
            placeholder="Search by Transaction ID, invoice #, or customer..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['all', 'success', 'refunded', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading payments log...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-bold text-slate-700">No payment transactions found</p>
            <p className="text-xs">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Payments recorded against invoices will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Amount Paid</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Payment Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const isSuccess = p.status === 'success';
                  const isProcessing = processingRefundId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Transaction ID */}
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        {p.transaction_id}
                        {p.notes && (
                          <span className="block font-sans text-[10px] text-slate-400 font-normal truncate max-w-[160px]">
                            {p.notes}
                          </span>
                        )}
                      </td>

                      {/* Invoice # */}
                      <td className="px-5 py-4 font-mono font-medium text-indigo-700">
                        {p.invoice_number ? (
                          <span>{p.invoice_number}</span>
                        ) : (
                          <span>Invoice #{p.invoice_id}</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {p.customer_name || 'N/A'}
                      </td>

                      {/* Amount Paid */}
                      <td className="px-5 py-4 font-extrabold text-slate-900 text-sm">
                        ${(p.amount || 0).toFixed(2)}
                      </td>

                      {/* Method */}
                      <td className="px-5 py-4">{getMethodBadge(p.payment_method)}</td>

                      {/* Date */}
                      <td className="px-5 py-4 text-slate-600">
                        {p.payment_date ? (
                          <div>
                            <span className="font-medium text-slate-800 block">
                              {new Date(p.payment_date).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(p.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">{getStatusBadge(p.status)}</td>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {isSuccess && (
                            <button
                              onClick={() => handleRefund(p)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Refund
                            </button>
                          )}
                          {p.status === 'refunded' && (
                            <span className="text-[11px] text-slate-400 italic">Refunded</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
