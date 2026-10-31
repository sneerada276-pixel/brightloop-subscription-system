import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function InvoiceModal({ isOpen, onClose, onInvoiceCreated }) {
  const { authFetch } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [taxId, setTaxId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountFeedback, setDiscountFeedback] = useState(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState('pending');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch options when opened
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoadingOptions(true);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${randomSuffix}`);
    setCustomerId('');
    setSubscriptionId('');
    setSubtotal('100.00');
    setTaxId('');
    setDiscountCode('');
    setAppliedDiscount(null);
    setDiscountFeedback(null);

    const loadData = async () => {
      try {
        const [custRes, taxRes, subRes] = await Promise.all([
          authFetch('/customers?active=true'),
          authFetch('/taxes?active=true'),
          authFetch('/subscriptions')
        ]);

        const [custData, taxData, subData] = await Promise.all([
          custRes.json(),
          taxRes.json(),
          subRes.json()
        ]);

        if (custRes.ok) {
          const list = Array.isArray(custData) ? custData : custData.customers || [];
          setCustomers(list);
          if (list.length > 0) setCustomerId(list[0].id.toString());
        }

        if (taxRes.ok) {
          const list = Array.isArray(taxData) ? taxData : taxData.taxes || [];
          setTaxes(list);
        }

        if (subRes.ok) {
          const list = Array.isArray(subData) ? subData : subData.subscriptions || [];
          setSubscriptions(list);
        }
      } catch (err) {
        setError('Failed to load customers or taxes: ' + err.message);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadData();
  }, [isOpen, authFetch]);

  // Selected tax rule
  const selectedTax = useMemo(() => {
    return taxes.find((t) => t.id.toString() === taxId.toString()) || null;
  }, [taxes, taxId]);

  // Tax amount calculation
  const calculatedTaxAmount = useMemo(() => {
    const sub = parseFloat(subtotal) || 0.0;
    if (!selectedTax) return 0.0;
    const rate = selectedTax.rate > 1.0 ? selectedTax.rate / 100.0 : selectedTax.rate;
    return Math.round(sub * rate * 100) / 100;
  }, [subtotal, selectedTax]);

  // Discount amount calculation
  const calculatedDiscountAmount = useMemo(() => {
    if (!appliedDiscount) return 0.0;
    return appliedDiscount.discount_amount || 0.0;
  }, [appliedDiscount]);

  // Final Total
  const calculatedTotal = useMemo(() => {
    const sub = parseFloat(subtotal) || 0.0;
    const total = sub + calculatedTaxAmount - calculatedDiscountAmount;
    return Math.max(0.0, Math.round(total * 100) / 100);
  }, [subtotal, calculatedTaxAmount, calculatedDiscountAmount]);

  // Validate discount code live
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    const sub = parseFloat(subtotal) || 0.0;
    setValidatingDiscount(true);
    setDiscountFeedback(null);

    try {
      const res = await authFetch('/discounts/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: discountCode.trim().toUpperCase(),
          subtotal: sub
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAppliedDiscount(null);
        setDiscountFeedback({ type: 'error', text: data.error || 'Invalid discount code.' });
      } else {
        setAppliedDiscount(data);
        setDiscountFeedback({
          type: 'success',
          text: `Applied code "${discountCode.toUpperCase()}": Saved $${data.discount_amount.toFixed(2)}!`
        });
      }
    } catch (err) {
      setAppliedDiscount(null);
      setDiscountFeedback({ type: 'error', text: err.message });
    } finally {
      setValidatingDiscount(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required.');
      return;
    }
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }

    const sub = parseFloat(subtotal);
    if (isNaN(sub) || sub < 0) {
      setError('Subtotal must be a valid non-negative number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        invoice_number: invoiceNumber.trim(),
        customer_id: parseInt(customerId, 10),
        subscription_id: subscriptionId ? parseInt(subscriptionId, 10) : null,
        subtotal: sub,
        tax_id: taxId ? parseInt(taxId, 10) : null,
        discount_code: appliedDiscount ? discountCode.trim().toUpperCase() : undefined,
        discount_amount: calculatedDiscountAmount,
        due_date: new Date(dueDate).toISOString(),
        status: status
      };

      const res = await authFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice.');
      }

      onInvoiceCreated(data.invoice);
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
            <h3 className="font-bold text-base">Generate New Invoice</h3>
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
              {/* Invoice # & Customer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Account *
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
                </div>
              </div>

              {/* Subtotal & Linked Subscription */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subtotal ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subscription (Optional)
                  </label>
                  <select
                    value={subscriptionId}
                    onChange={(e) => setSubscriptionId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="">-- Standalone Invoice --</option>
                    {subscriptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Sub #{s.id} ({s.customer_name} - {s.plan_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax Rule */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tax Rule
                </label>
                <select
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                >
                  <option value="">-- No Tax Applied (0%) --</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Code with Live Validation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promo / Discount Code
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase());
                      setAppliedDiscount(null);
                      setDiscountFeedback(null);
                    }}
                    placeholder="e.g., SUMMER20"
                    className="flex-1 font-mono uppercase text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={!discountCode.trim() || validatingDiscount}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
                  >
                    {validatingDiscount ? '...' : 'Apply'}
                  </button>
                </div>
                {discountFeedback && (
                  <p
                    className={`text-[11px] font-semibold mt-1 ${
                      discountFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {discountFeedback.text}
                  </p>
                )}
              </div>

              {/* Due Date & Initial Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="pending">Pending (Ready for Payment)</option>
                    <option value="draft">Draft (Review before sending)</option>
                  </select>
                </div>
              </div>

              {/* Live Calculation Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${(parseFloat(subtotal) || 0).toFixed(2)}</span>
                </div>
                {selectedTax && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({selectedTax.name}):</span>
                    <span>+${calculatedTaxAmount.toFixed(2)}</span>
                  </div>
                )}
                {calculatedDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount:</span>
                    <span>-${calculatedDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-extrabold pt-1.5 border-t border-slate-200 text-sm">
                  <span>Total Amount Due:</span>
                  <span className="text-indigo-700">${calculatedTotal.toFixed(2)}</span>
                </div>
              </div>
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
              <span>Create Invoice</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
