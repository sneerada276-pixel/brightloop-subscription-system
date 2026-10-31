import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ProductModal from '../components/products/ProductModal';
import VariantModal from '../components/products/VariantModal';

export default function ProductsPage() {
  const { isStaff, isAdmin, authFetch } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Expanded product IDs for inline variants
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [activeProductForVariant, setActiveProductForVariant] = useState(null);
  const [variantToEdit, setVariantToEdit] = useState(null);

  // Deletion confirm state
  const [deletingProductId, setDeletingProductId] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/products';
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('query', searchQuery.trim());
      }
      if (statusFilter === 'active') {
        params.append('active', 'true');
      } else if (statusFilter === 'inactive') {
        params.append('active', 'false');
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch products.');
      }

      const list = Array.isArray(data) ? data : (data.products || []);
      setProducts(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, authFetch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Expand / collapse product row variants
  const toggleExpand = (productId) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Product CRUD handlers
  const handleOpenCreateProduct = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod, e) => {
    if (e) e.stopPropagation();
    setProductToEdit(prod);
    setIsProductModalOpen(true);
  };

  const handleProductSaved = (savedProduct) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProduct.id);
      if (exists) {
        return prev.map((p) => {
          if (p.id === savedProduct.id) {
            // preserve existing variants if savedProduct doesn't have them
            return {
              ...savedProduct,
              variants: savedProduct.variants !== undefined ? savedProduct.variants : p.variants
            };
          }
          return p;
        });
      }
      return [savedProduct, ...prev];
    });
    setActionMessage('Product saved successfully.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deletingProductId) return;
    try {
      const res = await authFetch(`/products/${deletingProductId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate product.');
      }

      const updated = data.product || data;
      setProducts((prev) =>
        prev.map((p) => (p.id === deletingProductId ? { ...p, is_active: false } : p))
      );
      setActionMessage('Product deactivated successfully.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingProductId(null);
    }
  };

  // Variant CRUD handlers
  const handleOpenAddVariant = (product, e) => {
    if (e) e.stopPropagation();
    setActiveProductForVariant(product);
    setVariantToEdit(null);
    setIsVariantModalOpen(true);
    // ensure row is expanded so user sees the new variant
    setExpandedProductIds((prev) => new Set(prev).add(product.id));
  };

  const handleOpenEditVariant = (product, variant, e) => {
    if (e) e.stopPropagation();
    setActiveProductForVariant(product);
    setVariantToEdit(variant);
    setIsVariantModalOpen(true);
  };

  const handleVariantSaved = (savedVariant) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === savedVariant.product_id) {
          const currentVariants = p.variants || [];
          const exists = currentVariants.some((v) => v.id === savedVariant.id);
          const nextVariants = exists
            ? currentVariants.map((v) => (v.id === savedVariant.id ? savedVariant : v))
            : [...currentVariants, savedVariant];
          return { ...p, variants: nextVariants };
        }
        return p;
      })
    );
    setActionMessage('Product variant saved successfully.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Statistics
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Module 2
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage products, baseline pricing, and configurable SKU variants.
          </p>
        </div>

        {(isStaff || isAdmin) && (
          <button
            onClick={handleOpenCreateProduct}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-indigo-100 transition-all hover:shadow-md"
          >
            <span className="mr-1.5 text-base leading-none">+</span> Add Product
          </button>
        )}
      </div>

      {/* Action / Success Banner */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Products</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalProducts}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Products</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activeProducts}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Configured Variants</span>
          <div className="text-2xl font-black text-violet-600 mt-1">{totalVariants}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, name, description..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <label className="text-xs font-semibold text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Products</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            onClick={fetchProducts}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs font-medium">Loading product catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto text-2xl">
              📦
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No products found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Get started by creating your first product.'}
            </p>
            {(isStaff || isAdmin) && (
              <button
                onClick={handleOpenCreateProduct}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                + Create Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Code</th>
                  <th className="px-4 py-3.5">Product Name</th>
                  <th className="px-4 py-3.5 text-right">Sales Price</th>
                  <th className="px-4 py-3.5 text-right">Cost Price</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Variants</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const isExpanded = expandedProductIds.has(product.id);
                  const variants = product.variants || [];

                  return (
                    <React.Fragment key={product.id}>
                      <tr
                        onClick={() => toggleExpand(product.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        {/* Expand toggle */}
                        <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                          <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-600 font-bold' : ''}`}>
                            ▶
                          </span>
                        </td>

                        {/* Code */}
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                            {product.code}
                          </span>
                        </td>

                        {/* Name & Description */}
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{product.name}</div>
                          {product.description && (
                            <div className="text-slate-400 text-[11px] truncate max-w-xs">
                              {product.description}
                            </div>
                          )}
                        </td>

                        {/* Sales Price */}
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                          ${Number(product.sales_price || 0).toFixed(2)}
                        </td>

                        {/* Cost Price */}
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                          ${Number(product.cost_price || 0).toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          {product.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Variants count */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              variants.length > 0
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Variants Toggle */}
                            <button
                              onClick={() => toggleExpand(product.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                            >
                              {isExpanded ? 'Hide Variants' : 'Variants'}
                            </button>

                            {/* Add Variant (Staff/Admin) */}
                            {(isStaff || isAdmin) && (
                              <button
                                onClick={(e) => handleOpenAddVariant(product, e)}
                                title="Add SKU Variant"
                                className="px-2 py-1 text-[11px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-md transition-colors"
                              >
                                + Variant
                              </button>
                            )}

                            {/* Edit Product (Staff/Admin) */}
                            {(isStaff || isAdmin) && (
                              <button
                                onClick={(e) => handleOpenEditProduct(product, e)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                            )}

                            {/* Soft-delete (Admin Only) */}
                            {isAdmin && product.is_active && (
                              <button
                                onClick={() => setDeletingProductId(product.id)}
                                title="Deactivate Product"
                                className="px-2 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* INLINE EXPANDED VARIANTS SUB-PANEL */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-indigo-100">
                          <td colSpan="8" className="p-4 sm:p-5 pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    Variants for {product.name}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-400">
                                    ({product.code})
                                  </span>
                                </div>

                                {(isStaff || isAdmin) && (
                                  <button
                                    onClick={(e) => handleOpenAddVariant(product, e)}
                                    className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors"
                                  >
                                    + Add Variant
                                  </button>
                                )}
                              </div>

                              {variants.length === 0 ? (
                                <div className="py-4 text-center text-slate-400 text-xs">
                                  No variants configured for this product yet.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                                      <tr>
                                        <th className="px-3 py-2">Variant Name</th>
                                        <th className="px-3 py-2">SKU</th>
                                        <th className="px-3 py-2 text-right">Sales Override</th>
                                        <th className="px-3 py-2 text-right">Cost Override</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {variants.map((v) => (
                                        <tr key={v.id} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-semibold text-slate-800">
                                            {v.variant_name}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-[11px] text-violet-700 font-bold">
                                            {v.sku}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {v.sales_price_override !== null && v.sales_price_override !== undefined ? (
                                              <span className="font-bold text-slate-900">
                                                ${Number(v.sales_price_override).toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 text-[11px]">
                                                Base (${Number(product.sales_price).toFixed(2)})
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {v.cost_price_override !== null && v.cost_price_override !== undefined ? (
                                              <span className="text-slate-700">
                                                ${Number(v.cost_price_override).toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 text-[11px]">
                                                Base (${Number(product.cost_price).toFixed(2)})
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {(isStaff || isAdmin) && (
                                              <button
                                                onClick={(e) => handleOpenEditVariant(product, v, e)}
                                                className="px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded transition-colors"
                                              >
                                                Edit
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={productToEdit}
        onProductSaved={handleProductSaved}
      />

      <VariantModal
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        product={activeProductForVariant}
        variantToEdit={variantToEdit}
        onVariantSaved={handleVariantSaved}
      />

      {/* Admin Deactivation Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-slate-900">Deactivate Product?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              This will soft-delete the product (set status to Inactive). Existing subscriptions or invoices referencing it will remain intact.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteProduct}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

