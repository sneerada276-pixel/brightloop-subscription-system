import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import QuotationModal from '../components/quotations/QuotationModal';
import QuotationTemplateModal from '../components/quotations/QuotationTemplateModal';

export default function QuotationsPage() {
  const { user, isStaff, isAdmin, isCustomer, authFetch } = useAuth();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Action loading state (e.g., while sending or accepting)
  const [processingId, setProcessingId] = useState(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/quotations';
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
        throw new Error(data.error || 'Failed to fetch quotations.');
      }

      const list = Array.isArray(data) ? data : data.quotations || [];
      setQuotations(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Filtered quotations by search
  const filteredQuotations = useMemo(() => {
    if (!searchQuery.trim()) return quotations;
    const q = searchQuery.toLowerCase();
    return quotations.filter((item) => {
      const qNum = (item.quotation_number || '').toLowerCase();
      const cName = (item.customer_name || '').toLowerCase();
      const pName = (item.plan_name || '').toLowerCase();
      return qNum.includes(q) || cName.includes(q) || pName.includes(q);
    });
  }, [quotations, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    return {
      total: quotations.length,
      draft: quotations.filter((q) => q.status === 'draft').length,
      sent: quotations.filter((q) => q.status === 'sent').length,
      accepted: quotations.filter((q) => q.status === 'accepted').length,
      rejectedOrExpired: quotations.filter((q) => q.status === 'rejected' || q.status === 'expired' || q.is_expired).length
    };
  }, [quotations]);

  // Action handlers
  const handleSendQuotation = async (quotation) => {
    setProcessingId(quotation.id);
    setError(null);
    try {
      const res = await authFetch(`/quotations/${quotation.id}/send`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send quotation.');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Quotation ${quotation.quotation_number} has been marked as Sent to the customer.`
      });
      setQuotations((prev) =>
        prev.map((q) => (q.id === quotation.id ? data.quotation : q))
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptQuotation = async (quotation) => {
    setProcessingId(quotation.id);
    setError(null);
    try {
      const res = await authFetch(`/quotations/${quotation.id}/accept`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept quotation.');
      }

      const newSubId = data.subscription?.id ? `#${data.subscription.id}` : '';
      setFeedbackMessage({
        type: 'success',
        text: `Quotation ${quotation.quotation_number} accepted! Active Subscription ${newSubId} has been automatically generated.`
      });

      setQuotations((prev) =>
        prev.map((q) => (q.id === quotation.id ? data.quotation : q))
      );
      setTimeout(() => setFeedbackMessage(null), 7000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectQuotation = async (quotation) => {
    setProcessingId(quotation.id);
    setError(null);
    try {
      const res = await authFetch(`/quotations/${quotation.id}/reject`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject quotation.');
      }

      setFeedbackMessage({
        type: 'info',
        text: `Quotation ${quotation.quotation_number} marked as Rejected.`
      });
      setQuotations((prev) =>
        prev.map((q) => (q.id === quotation.id ? data.quotation : q))
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setQuotationToEdit(null);
    setIsQuotationModalOpen(true);
  };

  const handleOpenEditModal = (quotation) => {
    setQuotationToEdit(quotation);
    setIsQuotationModalOpen(true);
  };

  const handleQuotationSaved = (savedQuotation) => {
    setFeedbackMessage({
      type: 'success',
      text: `Quotation ${savedQuotation.quotation_number} saved successfully!`
    });
    setQuotations((prev) => {
      const exists = prev.some((q) => q.id === savedQuotation.id);
      if (exists) {
        return prev.map((q) => (q.id === savedQuotation.id ? savedQuotation : q));
      }
      return [savedQuotation, ...prev];
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const getStatusBadge = (item) => {
    const status = item.status;
    const isPastDue = item.is_expired;

    if (status === 'accepted') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          Accepted
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          Rejected
        </span>
      );
    }
    if (status === 'expired' || (isPastDue && status !== 'accepted')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          Expired
        </span>
      );
    }
    if (status === 'sent') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
          Sent
        </span>
      );
    }
    // draft
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        Draft
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quotations & Estimates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create proposals with custom terms, send to clients, and convert accepted quotes into active subscriptions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Templates Button */}
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            📋 Templates
          </button>

          {/* Add Quotation */}
          {(isAdmin || isStaff) && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:shadow"
            >
              <span className="mr-1.5 text-base leading-none">+</span> New Quotation
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Quotes</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.total}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-600 block">Drafts</span>
          <span className="text-2xl font-extrabold text-slate-700 mt-1 block">
            {stats.draft}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 block">Sent / Pending</span>
          <span className="text-2xl font-extrabold text-blue-700 mt-1 block">
            {stats.sent}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block">Accepted</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {stats.accepted}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 block">Expired / Rejected</span>
          <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
            {stats.rejectedOrExpired}
          </span>
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
            placeholder="Search by quote #, customer, or plan..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map((status) => (
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

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading quotations...</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-bold text-slate-700">No quotations found</p>
            <p className="text-xs">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Click "New Quotation" above to draft a quotation.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Quotation #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Proposed Plan</th>
                  <th className="px-5 py-3.5">Quoted Amount</th>
                  <th className="px-5 py-3.5">Valid Until</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((item) => {
                  const isDraft = item.status === 'draft';
                  const isSent = item.status === 'sent';
                  const isAccepted = item.status === 'accepted';
                  const isProcessing = processingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Quotation # */}
                      <td className="px-5 py-4 font-mono font-bold text-indigo-700">
                        {item.quotation_number}
                        {item.template_name && (
                          <span className="block font-sans text-[10px] text-slate-400 font-normal">
                            tpl: {item.template_name}
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {item.customer_name || `Customer #${item.customer_id}`}
                        </div>
                        {item.customer_company && (
                          <div className="text-[11px] text-slate-500">
                            {item.customer_company}
                          </div>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800 block">
                          {item.plan_name || `Plan #${item.plan_id}`}
                        </span>
                        <span className="text-[11px] text-slate-500 capitalize">
                          Interval: {item.billing_interval || 'monthly'}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="px-5 py-4 font-bold text-slate-900">
                        ${(item.total_amount || 0).toFixed(2)}
                      </td>

                      {/* Valid Until */}
                      <td className="px-5 py-4">
                        {item.valid_until ? (
                          <div>
                            <span
                              className={`font-medium ${
                                item.is_expired ? 'text-rose-600 line-through' : 'text-slate-800'
                              }`}
                            >
                              {new Date(item.valid_until).toLocaleDateString()}
                            </span>
                            {item.is_expired && (
                              <span className="block text-[10px] text-rose-600 font-bold">
                                Expired
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">No expiration</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">{getStatusBadge(item)}</td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Send (if draft) */}
                          {isDraft && (isAdmin || isStaff) && (
                            <button
                              onClick={() => handleSendQuotation(item)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Send
                            </button>
                          )}

                          {/* Accept (if draft or sent) -> Converts to Active Subscription */}
                          {(isDraft || isSent) && (
                            <button
                              onClick={() => handleAcceptQuotation(item)}
                              disabled={isProcessing || item.is_expired}
                              title="Accept quotation and automatically generate active subscription"
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-40"
                            >
                              Accept → Convert
                            </button>
                          )}

                          {/* Reject (if draft or sent) */}
                          {(isDraft || isSent) && (
                            <button
                              onClick={() => handleRejectQuotation(item)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}

                          {/* Edit (if draft) */}
                          {isDraft && (isAdmin || isStaff) && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                          )}

                          {/* Accepted confirmation tag */}
                          {isAccepted && (
                            <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✓ Subscribed
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

      {/* Create / Edit Quotation Modal */}
      <QuotationModal
        isOpen={isQuotationModalOpen}
        onClose={() => setIsQuotationModalOpen(false)}
        quotationToEdit={quotationToEdit}
        onQuotationSaved={handleQuotationSaved}
      />

      {/* Manage Quotation Templates Modal */}
      <QuotationTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
}

