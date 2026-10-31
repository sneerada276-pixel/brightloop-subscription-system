import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import InvoiceModal from '../components/invoices/InvoiceModal';
import PaymentModal from '../components/invoices/PaymentModal';
import TaxModal from '../components/invoices/TaxModal';
import DiscountModal from '../components/invoices/DiscountModal';

export default function InvoicesPage() {
  const { user, isStaff, isAdmin, isCustomer, authFetch } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Receipt Modal State
  const [receiptInvoice, setReceiptInvoice] = useState(null);

  // Action in-flight ID
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/invoices';
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
        throw new Error(data.error || 'Failed to fetch invoices.');
      }

      const list = Array.isArray(data) ? data : data.invoices || [];
      setInvoices(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Filtered invoices by search
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter((item) => {
      const numMatch = (item.invoice_number || '').toLowerCase().includes(q);
      const custMatch = (item.customer_name || '').toLowerCase().includes(q);
      return numMatch || custMatch;
    });
  }, [invoices, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter((i) => i.status === 'paid');
    const paidTotal = paid.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const pending = invoices.filter((i) => i.status === 'pending');
    const pendingTotal = pending.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const overdue = invoices.filter((i) => i.status === 'overdue' || i.is_overdue);
    const overdueTotal = overdue.reduce((sum, i) => sum + (i.total_amount || 0), 0);

    return {
      total,
      paidCount: paid.length,
      paidTotal,
      pendingCount: pending.length,
      pendingTotal,
      overdueCount: overdue.length,
      overdueTotal
    };
  }, [invoices]);

  // Handlers
  const handleSendInvoice = async (invoice) => {
    setActionLoadingId(invoice.id);
    setError(null);
    try {
      const res = await authFetch(`/invoices/${invoice.id}/send`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invoice.');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Invoice ${invoice.invoice_number} sent to customer (status: Pending).`
      });
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoice.id ? data.invoice : i))
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to cancel invoice ${invoice.invoice_number}?`)) {
      return;
    }
    setActionLoadingId(invoice.id);
    setError(null);
    try {
      const res = await authFetch(`/invoices/${invoice.id}/cancel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel invoice.');
      }

      setFeedbackMessage({
        type: 'info',
        text: `Invoice ${invoice.invoice_number} has been cancelled.`
      });
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoice.id ? data.invoice : i))
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentRecorded = (payment, updatedInvoice) => {
    setFeedbackMessage({
      type: 'success',
      text: `Payment of $${payment.amount.toFixed(2)} recorded! Invoice ${updatedInvoice.invoice_number} marked as ${updatedInvoice.status.toUpperCase()}.`
    });
    setInvoices((prev) =>
      prev.map((i) => (i.id === updatedInvoice.id ? updatedInvoice : i))
    );
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  const handleInvoiceCreated = (newInvoice) => {
    setFeedbackMessage({
      type: 'success',
      text: `Invoice ${newInvoice.invoice_number} created successfully!`
    });
    setInvoices((prev) => [newInvoice, ...prev]);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const getStatusBadge = (item) => {
    const isOverdue = item.status === 'overdue' || item.is_overdue;

    if (item.status === 'paid') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          Paid
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          Overdue
        </span>
      );
    }
    if (item.status === 'pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          Pending
        </span>
      );
    }
    if (item.status === 'cancelled') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 line-through">
          Cancelled
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
            Invoices & Automated Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer billings, taxes, promo codes, and payment status lifecycle.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Taxes configuration */}
          <button
            onClick={() => setIsTaxModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            ⚙️ Taxes
          </button>

          {/* Discounts */}
          <button
            onClick={() => setIsDiscountModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            🏷️ Discounts
          </button>

          {/* New Invoice (Admin/Staff only) */}
          {(isAdmin || isStaff) && (
            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:shadow"
            >
              <span className="mr-1.5 text-base leading-none">+</span> New Invoice
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Invoiced</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.total}
          </span>
          <span className="text-[11px] text-slate-400">Total billings generated</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block">Collected (Paid)</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            ${stats.paidTotal.toFixed(2)}
          </span>
          <span className="text-[11px] text-emerald-600/80 font-medium">
            {stats.paidCount} invoices settled
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 block">Pending Balance</span>
          <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
            ${stats.pendingTotal.toFixed(2)}
          </span>
          <span className="text-[11px] text-amber-600/80 font-medium">
            {stats.pendingCount} awaiting payment
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 block">Overdue Amount</span>
          <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
            ${stats.overdueTotal.toFixed(2)}
          </span>
          <span className="text-[11px] text-rose-600/80 font-medium">
            {stats.overdueCount} past due
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
            placeholder="Search by invoice # or customer..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['all', 'pending', 'paid', 'overdue', 'cancelled', 'draft'].map((status) => (
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

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-bold text-slate-700">No invoices found</p>
            <p className="text-xs">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Click "New Invoice" above to generate a bill.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Subtotal / Adjustments</th>
                  <th className="px-5 py-3.5">Total Amount</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isDraft = inv.status === 'draft';
                  const isPending = inv.status === 'pending';
                  const isPaid = inv.status === 'paid';
                  const isCancelled = inv.status === 'cancelled';
                  const isOverdue = inv.status === 'overdue' || inv.is_overdue;
                  const isProcessing = actionLoadingId === inv.id;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Invoice # */}
                      <td className="px-5 py-4 font-mono font-bold text-indigo-700">
                        {inv.invoice_number}
                        {inv.subscription_id && (
                          <span className="block font-sans text-[10px] text-slate-400 font-normal">
                            Sub #{inv.subscription_id}
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {inv.customer_name || `Customer #${inv.customer_id}`}
                        </div>
                        {inv.customer_company && (
                          <div className="text-[11px] text-slate-500">{inv.customer_company}</div>
                        )}
                      </td>

                      {/* Subtotal & Breakdown */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-700 block">
                          ${(inv.subtotal || 0).toFixed(2)}
                        </span>
                        <div className="text-[10px] text-slate-400 space-x-1.5">
                          {inv.tax_amount > 0 && <span>+${inv.tax_amount.toFixed(2)} Tax</span>}
                          {inv.discount_amount > 0 && (
                            <span className="text-emerald-600 font-medium">
                              -${inv.discount_amount.toFixed(2)} Promo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="px-5 py-4 font-extrabold text-slate-900 text-sm">
                        ${(inv.total_amount || 0).toFixed(2)}
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4">
                        {inv.due_date ? (
                          <span
                            className={`font-medium ${
                              isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {new Date(inv.due_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">{getStatusBadge(inv)}</td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Record Payment (if pending or overdue) */}
                          {(isPending || isOverdue) && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                            >
                              💳 Pay
                            </button>
                          )}

                          {/* Send (if draft) */}
                          {isDraft && (isAdmin || isStaff) && (
                            <button
                              onClick={() => handleSendInvoice(inv)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Send
                            </button>
                          )}

                          {/* Cancel (if draft or pending) */}
                          {(isDraft || isPending || isOverdue) && (isAdmin || isStaff) && (
                            <button
                              onClick={() => handleCancelInvoice(inv)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}

                          {/* Receipt view */}
                          <button
                            onClick={() => setReceiptInvoice(inv)}
                            className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                            title="View printable receipt"
                          >
                            📄 Receipt
                          </button>
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

      {/* Invoice Creation Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />

      {/* Payment Recording Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        invoice={selectedInvoiceForPayment}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoiceForPayment(null);
        }}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Tax Management Modal */}
      <TaxModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
      />

      {/* Discount Management Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
      />

      {/* Printable Receipt Modal */}
      {receiptInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-base">Invoice Receipt ({receiptInvoice.invoice_number})</h3>
              <button
                onClick={() => setReceiptInvoice(null)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-xl font-extrabold text-indigo-600 block">BrightLoop Inc.</span>
                <span className="text-slate-400 text-[11px]">Subscription Management Platform</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Billed To:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{receiptInvoice.customer_name}</span>
                  <span className="text-slate-500 block">{receiptInvoice.customer_email}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Invoice Details:</span>
                  <span className="font-mono font-bold text-slate-800 block mt-0.5">{receiptInvoice.invoice_number}</span>
                  <span className="text-slate-500 block">
                    Issued: {receiptInvoice.issue_date ? new Date(receiptInvoice.issue_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">${(receiptInvoice.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax:</span>
                  <span className="font-medium">+${(receiptInvoice.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Discount / Promo:</span>
                  <span className="font-medium">-${(receiptInvoice.discount_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200 text-sm">
                  <span>Total Amount:</span>
                  <span className="text-indigo-700">${(receiptInvoice.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment transactions history */}
              {receiptInvoice.payments && receiptInvoice.payments.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1.5">Recorded Payments:</span>
                  <div className="space-y-1">
                    {receiptInvoice.payments.map((p) => (
                      <div key={p.id} className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between text-[11px] text-emerald-800">
                        <span>{p.transaction_id} ({p.payment_method})</span>
                        <span className="font-bold">${p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                >
                  🖨️ Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptInvoice(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
