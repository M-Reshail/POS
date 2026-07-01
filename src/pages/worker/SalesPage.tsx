import React, { useState, useMemo, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import {
  ShoppingCart, Plus, Trash2, Droplet, Edit2, Check, Search, X,
  History, UserPlus, ChevronLeft,
} from 'lucide-react';
import { Bill, BillItem } from '../../types';
import { retailersService } from '../../services/retailers';
import { billsService } from '../../services/bills';
import { ADMIN_SIDEBAR, WORKER_SIDEBAR } from '../../constants/navigation';

interface CartItem extends BillItem {
  isEditingPrice?: boolean;
  editPrice?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  productName?: string;
}

type PaymentMethod = 'cash' | 'udhar' | 'generate-only';

// Brand image map
const BRAND_IMAGES: Record<string, string> = {
  'Pepsi': '/images/pepsi.png',
  'Coca Cola': '/images/coca-cola.png',
  'Sprite': '/images/sprite.png',
  'Dew': '/images/dew.png',
  'String': '/images/string.png',
  'Fanta': '/images/fanta.png',
  'Marinda': '/images/marinda.png',
  'Mirinda': '/images/marinda.png',
};

// RGB brands (one-click: always adds 5 units)
const RGB_BRANDS = ['Pepsi', 'Coca Cola', 'Sprite', 'Dew', 'String', 'Fanta', 'Marinda', 'Mirinda'];
const RGB_QTY_PER_CLICK = 5;

export const SalesPage: React.FC = () => {
  const store = useStore();
  const { bills, retailers, products, stockBatches } = store;

  // View
  const [viewMode, setViewMode] = useState<'create' | 'history'>('create');
  const [selectedProductBrand, setSelectedProductBrand] = useState('');
  const [showRGB, setShowRGB] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productQuantities, setProductQuantities] = useState<{ [key: string]: string }>({});

  // Bill Summary panel
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [manualPendingAmount, setManualPendingAmount] = useState('');
  const [pendingReceiptBill, setPendingReceiptBill] = useState<Bill | null>(null);

  // History
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<string | null>(null);
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState('');

  // Add Retailer Modal
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [newRetailerForm, setNewRetailerForm] = useState({ shopName: '', ownerName: '', mobileNumber: '', address: '' });
  const [retailerFormErrors, setRetailerFormErrors] = useState<{ shopName?: string; ownerName?: string; mobileNumber?: string; address?: string }>({});

  useEffect(() => {
    store.fetchInitialData();
  }, []);

  // ── Derived products from inventory ──────────────────────────────────────────
  const inventoryProducts = useMemo(() => {
    return products.map((p) => {
      const latestBatch = stockBatches
        .filter((b) => b.productId === p.id && b.quantity > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      return {
        ...p,
        defaultPrice: latestBatch ? Number(latestBatch.salePrice) : 0,
        availableStock: stockBatches.filter(b => b.productId === p.id).reduce((s, b) => s + b.quantity, 0),
      };
    });
  }, [products, stockBatches]);

  const uniqueBrands = useMemo(
    () => Array.from(new Set(inventoryProducts.map((p) => p.brand))).sort(),
    [inventoryProducts]
  );

  const filteredProducts = useMemo(() => {
    const base = selectedProductBrand
      ? inventoryProducts.filter((p) => p.brand === selectedProductBrand)
      : inventoryProducts;
    if (!searchTerm) return base;
    return base.filter(
      (p) =>
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.variant.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventoryProducts, selectedProductBrand, searchTerm]);

  // ── Cart Logic ────────────────────────────────────────────────────────────────
  const addProductToCart = (product: typeof inventoryProducts[0]) => {
    const qtyStr = productQuantities[product.id] || '';
    const qty = parseFloat(qtyStr);
    if (!qtyStr || isNaN(qty) || qty <= 0) {
      store.addNotification('error', 'Enter quantity first');
      return;
    }

    setCartItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id && !i.isEditingPrice);
      if (existing >= 0) {
        // Merge: add quantity
        const updated = [...prev];
        const item = updated[existing];
        const newQty = item.quantity + qty;
        updated[existing] = {
          ...item,
          quantity: newQty,
          total: newQty * item.price - (item.discountValue || 0),
        };
        return updated;
      }
      // New item
      return [
        ...prev,
        {
          id: Date.now().toString(),
          productId: product.id,
          productName: `${product.brand} ${product.variant}`,
          quantity: qty,
          price: product.defaultPrice,
          total: qty * product.defaultPrice,
          isEditingPrice: false,
          editPrice: product.defaultPrice.toString(),
          discountType: 'fixed',
          discountValue: 0,
        },
      ];
    });

    setProductQuantities((prev) => ({ ...prev, [product.id]: '' }));
    store.addNotification('success', `${product.brand} ${product.variant} added`);
  };

  // RGB one-click: add 5 units of the RGB brand
  const addRGBToCart = (brand: string) => {
    const rgbProductId = `rgb-${brand.toLowerCase().replace(/\s+/g, '-')}`;
    setCartItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === rgbProductId);
      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing];
        const newQty = item.quantity + RGB_QTY_PER_CLICK;
        updated[existing] = { ...item, quantity: newQty, total: newQty * item.price };
        return updated;
      }
      return [
        ...prev,
        {
          id: `rgb-${Date.now()}`,
          productId: rgbProductId,
          productName: `${brand} RGB (Crates)`,
          quantity: RGB_QTY_PER_CLICK,
          price: 0,
          total: 0,
          discountType: 'fixed',
          discountValue: 0,
        },
      ];
    });
    store.addNotification('success', `${brand} RGB ×${RGB_QTY_PER_CLICK} added`);
  };

  const removeFromCart = (itemId: string) =>
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));

  const updateItemPrice = (itemId: string, newPriceStr: string) => {
    const price = parseFloat(newPriceStr);
    if (isNaN(price) || price < 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, price, total: item.quantity * price - (item.discountValue || 0), isEditingPrice: false }
          : item
      )
    );
  };

  const updateItemDiscount = (itemId: string, value: number, type: 'percent' | 'fixed') => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const discAmt = type === 'percent' ? (item.quantity * item.price * value) / 100 : value;
        return {
          ...item,
          discountType: type,
          discountValue: discAmt,
          discount: discAmt,
          total: Math.max(0, item.quantity * item.price - discAmt),
        };
      })
    );
  };

  const updateItemQty = (itemId: string, newQtyStr: string) => {
    const qty = parseFloat(newQtyStr);
    if (isNaN(qty) || qty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: qty, total: Math.max(0, qty * item.price - (item.discountValue || 0)) }
          : item
      )
    );
  };

  // ── Totals ────────────────────────────────────────────────────────────────────
  const subtotal = cartItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const totalDiscounts = cartItems.reduce((s, i) => s + (i.discountValue || 0), 0);
  const manualPendingNum = parseFloat(manualPendingAmount) || 0;
  const total = subtotal - totalDiscounts + manualPendingNum;
  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const changeAmount = Math.max(0, amountReceivedNum - total);
  const udhariAmount = Math.max(0, total - amountReceivedNum);

  const existingPendingForRetailer = bills
    .filter((b) => b.retailerId === selectedRetailer && Number(b.pendingAmount) > 0)
    .reduce((s, b) => s + Number(b.pendingAmount), 0);

  // ── Bill submission ───────────────────────────────────────────────────────────
  const handleCreateBill = async () => {
    if (!selectedRetailer) {
      store.addNotification('error', 'Select a retailer in Bill Summary');
      return;
    }
    if (cartItems.length === 0) {
      store.addNotification('error', 'Add at least one product');
      return;
    }
    if (paymentMethod === 'cash' && amountReceivedNum === 0) {
      store.addNotification('error', 'Enter amount received');
      return;
    }

    const isPaid = paymentMethod === 'cash' && amountReceivedNum >= total;
    const paidAmt = paymentMethod === 'udhar' || paymentMethod === 'generate_only' ? 0 : amountReceivedNum;
    const pendingAmt = paymentMethod === 'udhar' || paymentMethod === 'generate_only' ? total : udhariAmount;

    const billPayload = {
      retailerId: selectedRetailer,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        discount: item.discountValue || 0,
      })),
      discount: totalDiscounts,
      paymentMode: paymentMethod,
      paidAmount: paidAmt,
      previousPendingAdded: manualPendingNum || undefined,
    };

    try {
      await store.checkoutBill(billPayload);
      const billForReceipt: Bill = {
        id: Date.now().toString(),
        billNumber: `BILL-${Date.now()}`,
        retailerId: selectedRetailer,
        workerId: store.currentUser?.id || '',
        items: cartItems,
        subtotal,
        discount: totalDiscounts,
        total,
        paidAmount: paidAmt,
        pendingAmount: pendingAmt,
        paymentMode: paymentMethod,
        previousPendingAdded: manualPendingNum,
        paymentHistory: [],
        status: isPaid ? 'paid' : paymentMethod === 'cash' && amountReceivedNum > 0 ? 'partial' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setPendingReceiptBill(billForReceipt);
    } catch (err) {
      // Error handled in store
    }
  };

  const resetForm = () => {
    setCartItems([]);
    setProductQuantities({});
    setSelectedRetailer('');
    setAmountReceived('');
    setManualPendingAmount('');
    setPaymentMethod('cash');
    setPendingReceiptBill(null);
    setShowRGB(false);
    setSelectedProductBrand('');
  };

  const generateAndPrintReceipt = (bill: Bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const itemsText = bill.items
      .map((item) => {
        const name = (item as CartItem).productName || item.productId;
        return `${name} | Qty: ${item.quantity} | Price: ₨${item.price} | Total: ₨${item.total.toFixed(2)}`;
      })
      .join('\n');

    const content = `
╔════════════════════════════════════════╗
║                ABDULHAQ                ║
╚════════════════════════════════════════╝

Bill#: ${bill.billNumber}
Date:  ${new Date(bill.createdAt).toLocaleString()}

RETAILER: ${retailer?.shopName || 'N/A'} (${retailer?.ownerName || ''})
Phone:    ${retailer?.mobileNumber || 'N/A'}

────────────────────────────────────────
ITEMS
────────────────────────────────────────
${itemsText}

────────────────────────────────────────
Subtotal:     ₨${bill.subtotal.toFixed(2)}
${bill.discount ? `Discount:     ₨${bill.discount.toFixed(2)}\n` : ''}${bill.previousPendingAdded ? `Prev Pending: ₨${bill.previousPendingAdded.toFixed(2)}\n` : ''}Total:        ₨${bill.total.toFixed(2)}
Paid:         ₨${bill.paidAmount.toFixed(2)}
${bill.pendingAmount > 0 ? `Udhari:       ₨${bill.pendingAmount.toFixed(2)}\n` : ''}Status:       ${bill.status.toUpperCase()}

Thank you for your business!
════════════════════════════════════════
    `;

    navigator.clipboard.writeText(content).catch(() => {});
    const w = window.open('', '', 'height=600,width=800');
    if (w) {
      w.document.write(`<html><head><title>Bill Receipt</title><style>body{font-family:monospace;padding:20px;font-size:12px;}pre{white-space:pre;}</style></head><body><pre>${content}</pre><script>window.print();window.close();</script></body></html>`);
      w.document.close();
    }
    store.addNotification('success', 'Receipt generated!');
  };

  const handleAddRetailer = async () => {
    // Inline validation — keep modal open on error, preserve form values
    const errors: typeof retailerFormErrors = {};
    if (!newRetailerForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!newRetailerForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!newRetailerForm.address.trim()) errors.address = 'Address is required.';
    if (newRetailerForm.mobileNumber && !/^\d{11}$/.test(newRetailerForm.mobileNumber)) {
      errors.mobileNumber = 'Phone must be exactly 11 digits.';
    }

    if (Object.keys(errors).length > 0) {
      setRetailerFormErrors(errors); // Show errors inside modal, do NOT close
      return;
    }
    setRetailerFormErrors({});

    try {
      const r = await retailersService.create({ ...newRetailerForm, creditLimit: 0, priceTier: 'standard' });
      store.fetchRetailers();
      setSelectedRetailer(r.id);
      store.addNotification('success', 'Retailer added');
      // Only reset form on success
      setNewRetailerForm({ shopName: '', ownerName: '', mobileNumber: '', address: '' });
      setShowAddRetailerModal(false);
    } catch (err: any) {
      setRetailerFormErrors({ shopName: err.response?.data?.message || 'Failed to add retailer' });
    }
  };


  const updateBillPayment = async (billId: string, amount: number) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    try {
      await billsService.addPayment(billId, { amount, paymentMode: 'cash' });
      store.fetchBills();
      store.addNotification('success', `Payment of ₨${amount} recorded`);
      setSelectedBillForDetails(null);
      setAdditionalPaymentAmount('');
    } catch (err: any) {
      store.addNotification('error', err.response?.data?.message || 'Failed to add payment');
    }
  };

  const filteredHistoryBills = bills.filter((bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const s = historySearchTerm.toLowerCase();
    const matchSearch =
      !s ||
      bill.billNumber.toLowerCase().includes(s) ||
      (retailer?.shopName || '').toLowerCase().includes(s) ||
      (retailer?.ownerName || '').toLowerCase().includes(s);
    const billDate = new Date(bill.createdAt).toISOString().split('T')[0];
    const matchDate = !historyDateFilter || billDate === historyDateFilter;
    return matchSearch && matchDate;
  });

  // ── Sidebar ───────────────────────────────────────────────────────────────────
  const isAdmin = store.currentUser?.role === 'admin';
  const sidebarItems = isAdmin ? ADMIN_SIDEBAR : WORKER_SIDEBAR;

  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setViewMode('create')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              viewMode === 'create' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShoppingCart size={14} className="inline mr-1" /> Create Sale
          </button>
          <button
            onClick={() => { setViewMode('history'); store.fetchBills(); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              viewMode === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <History size={14} className="inline mr-1" /> Bill History
          </button>
        </div>

        {/* ── CREATE SALE ── */}
        {viewMode === 'create' && (
          pendingReceiptBill ? (
            // Receipt confirmation screen
            <div className="max-w-lg mx-auto">
              <Card title="✅ Bill Created Successfully">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Bill#</span><span className="font-mono font-bold">{pendingReceiptBill.billNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-lg">₨{pendingReceiptBill.total.toFixed(0)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-green-600 font-semibold">₨{pendingReceiptBill.paidAmount.toFixed(0)}</span></div>
                  {pendingReceiptBill.pendingAmount > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">Udhari</span><span className="text-orange-600 font-semibold">₨{pendingReceiptBill.pendingAmount.toFixed(0)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-semibold capitalize ${pendingReceiptBill.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{pendingReceiptBill.status}</span></div>
                </div>
                <div className="flex gap-3 mt-5">
                  <Button onClick={() => { generateAndPrintReceipt(pendingReceiptBill); resetForm(); }} className="flex-1">
                    🖨 Print & Close
                  </Button>
                  <Button variant="secondary" onClick={resetForm} className="flex-1">
                    Close
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* ── Products Panel (2/3 width) ── */}
              <div className="xl:col-span-2">
                <Card>
                  {/* Header row: Products title + Search + RGB toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-gray-800 flex-shrink-0">Products</h3>
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search brand or variant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                      />
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {/* RGB Toggle */}
                    <button
                      onClick={() => { setShowRGB(!showRGB); setSelectedProductBrand(''); setSearchTerm(''); }}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                        showRGB ? 'bg-red-600 text-white border-red-600' : 'text-red-600 border-red-500 hover:bg-red-50'
                      }`}
                    >
                      📦 RGB
                    </button>
                  </div>

                  {/* Brand drill-down breadcrumb */}
                  {selectedProductBrand && !showRGB && (
                    <button
                      onClick={() => setSelectedProductBrand('')}
                      className="mb-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <ChevronLeft size={14} /> All Brands
                    </button>
                  )}

                  {/* RGB view */}
                  {showRGB ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Click to add <strong>{RGB_QTY_PER_CLICK} crates</strong> per click (can click multiple times)
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {RGB_BRANDS.map((brand) => (
                          <button
                            key={brand}
                            onClick={() => addRGBToCart(brand)}
                            className="flex flex-col items-center p-2 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all duration-150 bg-white"
                          >
                            <span className="text-2xl mb-1">📦</span>
                            <p className="text-xs font-bold text-gray-800 text-center leading-tight">{brand}</p>
                            <p className="text-xs text-red-600 font-semibold">+{RGB_QTY_PER_CLICK}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : !selectedProductBrand && !searchTerm ? (
                    // Brand grid
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {uniqueBrands.map((brand) => (
                        <button
                          key={brand}
                          onClick={() => setSelectedProductBrand(brand)}
                          className="group flex flex-col items-center p-2 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm transition-all duration-150 bg-white"
                        >
                          <div className="w-full aspect-square rounded-md overflow-hidden mb-1.5 bg-gray-50 flex items-center justify-center">
                            {BRAND_IMAGES[brand] ? (
                              <img
                                src={BRAND_IMAGES[brand]}
                                alt={brand}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <Droplet size={24} className="text-blue-400" />
                            )}
                          </div>
                          <p className="text-xs font-bold text-gray-800">{brand}</p>
                          <p className="text-xs text-gray-400">
                            {inventoryProducts.filter((p) => p.brand === brand).length} variants
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Product variant grid
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className={`flex flex-col p-2.5 border-2 rounded-lg transition-all duration-150 bg-white ${
                            product.availableStock <= 0
                              ? 'border-gray-100 opacity-50'
                              : 'border-gray-200 hover:border-blue-400 hover:shadow-sm'
                          }`}
                        >
                          <p className="text-xs font-bold text-gray-800 leading-tight">{product.brand}</p>
                          <p className="text-xs text-gray-500 mb-1 leading-tight">{product.variant}</p>
                          <p className="text-xs font-bold text-blue-600 mb-1.5">
                            ₨{product.defaultPrice.toFixed(0)}
                            {product.availableStock <= 0 && <span className="ml-1 text-red-500">(Out)</span>}
                          </p>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={productQuantities[product.id] || ''}
                              onChange={(e) =>
                                setProductQuantities((prev) => ({ ...prev, [product.id]: e.target.value }))
                              }
                              placeholder="Qty"
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-center focus:border-blue-400 focus:outline-none"
                            />
                            <button
                              onClick={() => addProductToCart(product)}
                              disabled={product.availableStock <= 0}
                              className="flex-shrink-0 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded font-bold transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <p className="col-span-full text-center text-sm text-gray-400 py-8">No products found</p>
                      )}
                    </div>
                  )}
                </Card>

                {/* ── Cart Table ── */}
                {cartItems.length > 0 && (
                  <Card className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-800">Cart ({cartItems.length} items)</h3>
                      <button onClick={() => setCartItems([])} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-500">
                            <th className="text-left py-1 pr-2">Item</th>
                            <th className="text-center py-1 px-1">Qty</th>
                            <th className="text-center py-1 px-1">Price</th>
                            <th className="text-center py-1 px-1">Discount</th>
                            <th className="text-right py-1 px-1">Total</th>
                            <th className="py-1 px-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cartItems.map((item) => (
                            <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-1 pr-2 font-medium text-gray-800">{item.productName}</td>
                              <td className="py-1 px-1 text-center">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItemQty(item.id, e.target.value)}
                                  className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="py-1 px-1 text-center">
                                {item.isEditingPrice ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={item.editPrice}
                                      onChange={(e) =>
                                        setCartItems((prev) =>
                                          prev.map((i) =>
                                            i.id === item.id ? { ...i, editPrice: e.target.value } : i
                                          )
                                        )
                                      }
                                      className="w-16 text-center border border-blue-300 rounded px-1 py-0.5 focus:outline-none"
                                    />
                                    <button
                                      onClick={() => updateItemPrice(item.id, item.editPrice || '0')}
                                      className="text-green-600"
                                    >
                                      <Check size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setCartItems((prev) =>
                                        prev.map((i) =>
                                          i.id === item.id ? { ...i, isEditingPrice: true } : i
                                        )
                                      )
                                    }
                                    className="flex items-center gap-1 text-gray-700 hover:text-blue-600"
                                  >
                                    ₨{item.price.toFixed(0)} <Edit2 size={10} />
                                  </button>
                                )}
                              </td>
                              <td className="py-1 px-1 text-center">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={item.discountType || 'fixed'}
                                    onChange={(e) =>
                                      updateItemDiscount(item.id, 0, e.target.value as 'percent' | 'fixed')
                                    }
                                    className="border border-gray-200 rounded text-xs py-0.5 px-1 focus:outline-none focus:border-blue-400 bg-white"
                                  >
                                    <option value="fixed">PKR</option>
                                    <option value="percent">%</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                                    onChange={(e) =>
                                      updateItemDiscount(
                                        item.id,
                                        parseFloat(e.target.value) || 0,
                                        item.discountType || 'fixed'
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="py-1 px-1 text-right font-semibold text-gray-800">
                                ₨{item.total.toFixed(0)}
                              </td>
                              <td className="py-1 px-1 text-center">
                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>

              {/* ── Bill Summary Panel (1/3 width, sticky) ── */}
              <div className="xl:col-span-1">
                <div className="sticky top-4">
                  <Card title="Bill Summary">
                    {/* Retailer select in summary */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Retailer</label>
                      <div className="flex gap-1.5">
                        <select
                          value={selectedRetailer}
                          onChange={(e) => setSelectedRetailer(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">Select retailer...</option>
                          {retailers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.shopName} — {r.ownerName}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowAddRetailerModal(true)}
                          className="flex-shrink-0 p-1.5 border border-gray-200 rounded-lg hover:border-blue-400 text-gray-500 hover:text-blue-600"
                          title="Add Retailer"
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                      {selectedRetailer && existingPendingForRetailer > 0 && (
                        <p className="mt-1 text-xs text-orange-600">
                          ⚠ Existing udhari: ₨{existingPendingForRetailer.toFixed(0)}
                        </p>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3 mb-3">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>₨{subtotal.toFixed(0)}</span>
                      </div>
                      {totalDiscounts > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount</span>
                          <span>−₨{totalDiscounts.toFixed(0)}</span>
                        </div>
                      )}
                      {manualPendingNum > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Added Pending</span>
                          <span>+₨{manualPendingNum.toFixed(0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1.5">
                        <span>Total</span>
                        <span>₨{total.toFixed(0)}</span>
                      </div>
                    </div>

                    {/* Optional: add previous pending */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Add Previous Pending (₨)</label>
                      <input
                        type="number"
                        min="0"
                        value={manualPendingAmount}
                        onChange={(e) => setManualPendingAmount(e.target.value)}
                        placeholder="0"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                      />
                    </div>

                    {/* Payment method */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Payment Method</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['cash', 'udhar', 'generate_only'] as PaymentMethod[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setPaymentMethod(m)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                              paymentMethod === m
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 text-gray-600 hover:border-blue-300'
                            }`}
                          >
                            {m === 'generate_only' ? 'Bill Only' : m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount received (cash only) */}
                    {paymentMethod === 'cash' && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Amount Received (₨)</label>
                        <input
                          type="number"
                          min="0"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="0"
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                        />
                        {amountReceivedNum > 0 && (
                          <div className="mt-1 space-y-0.5 text-xs">
                            {changeAmount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Change</span><span>₨{changeAmount.toFixed(0)}</span>
                              </div>
                            )}
                            {udhariAmount > 0 && (
                              <div className="flex justify-between text-orange-600">
                                <span>Udhari</span><span>₨{udhariAmount.toFixed(0)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleCreateBill}
                        loading={store.isLoading}
                        className="w-full"
                        disabled={cartItems.length === 0}
                      >
                        Create Bill
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={resetForm}
                        className="w-full text-xs"
                      >
                        Cancel / Clear
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )
        )}

        {/* ── BILL HISTORY ── */}
        {viewMode === 'history' && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bill# or retailer..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
              />
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 px-2">Bill#</th>
                      <th className="text-left py-2 px-2">Retailer</th>
                      <th className="text-right py-2 px-2">Total</th>
                      <th className="text-right py-2 px-2">Paid</th>
                      <th className="text-right py-2 px-2">Udhari</th>
                      <th className="text-center py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryBills.slice().reverse().map((bill) => {
                      const retailer = retailers.find((r) => r.id === bill.retailerId);
                      const isExpanded = selectedBillForDetails === bill.id;
                      const statusColors: Record<string, string> = {
                        paid: 'bg-green-100 text-green-700',
                        pending: 'bg-orange-100 text-orange-700',
                        partial: 'bg-yellow-100 text-yellow-700',
                      };
                      return (
                        <React.Fragment key={bill.id}>
                          <tr className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 font-mono text-gray-600">{bill.billNumber}</td>
                            <td className="py-2 px-2 font-medium">{retailer?.shopName || '—'}</td>
                            <td className="py-2 px-2 text-right font-semibold">₨{Number(bill.total).toFixed(0)}</td>
                            <td className="py-2 px-2 text-right text-green-700">₨{Number(bill.paidAmount).toFixed(0)}</td>
                            <td className="py-2 px-2 text-right text-orange-600">₨{Number(bill.pendingAmount).toFixed(0)}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[bill.status]}`}>
                                {bill.status}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-gray-400">{new Date(bill.createdAt).toLocaleDateString()}</td>
                            <td className="py-2 px-2">
                              <button
                                onClick={() => setSelectedBillForDetails(isExpanded ? null : bill.id)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                {isExpanded ? 'Close' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-blue-50 px-4 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <p className="font-semibold text-xs text-gray-700 mb-1">Items</p>
                                    {bill.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-xs py-0.5">
                                        <span className="text-gray-600">{item.product ? `${item.product.brand} ${item.product.variant}` : item.productId} ×{item.quantity}</span>
                                        <span>₨{Number(item.total).toFixed(0)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {Number(bill.pendingAmount) > 0 && (
                                    <div>
                                      <p className="font-semibold text-xs text-gray-700 mb-1">Add Payment</p>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          value={additionalPaymentAmount}
                                          onChange={(e) => setAdditionalPaymentAmount(e.target.value)}
                                          placeholder="Amount"
                                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            updateBillPayment(bill.id, parseFloat(additionalPaymentAmount) || 0)
                                          }
                                        >
                                          Pay
                                        </Button>
                                      </div>
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
                {filteredHistoryBills.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">No bills found</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Add Retailer Modal ── */}
        {showAddRetailerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Add Retailer</h3>
                <button onClick={() => { setShowAddRetailerModal(false); setRetailerFormErrors({}); }} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                {/* Shop Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Shop Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRetailerForm.shopName}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, shopName: e.target.value }))}
                    placeholder="e.g. Ali Store"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${retailerFormErrors.shopName ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {retailerFormErrors.shopName && <p className="text-red-500 text-xs mt-1">{retailerFormErrors.shopName}</p>}
                </div>
                {/* Owner Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRetailerForm.ownerName}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="e.g. Ali Khan"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${retailerFormErrors.ownerName ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {retailerFormErrors.ownerName && <p className="text-red-500 text-xs mt-1">{retailerFormErrors.ownerName}</p>}
                </div>
                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone <span className="text-gray-400 font-normal">(11 digits)</span></label>
                  <input
                    type="text"
                    value={newRetailerForm.mobileNumber}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                    placeholder="03001234567"
                    maxLength={11}
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${retailerFormErrors.mobileNumber ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {retailerFormErrors.mobileNumber && <p className="text-red-500 text-xs mt-1">{retailerFormErrors.mobileNumber}</p>}
                </div>
                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Address <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRetailerForm.address}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="City, Province"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${retailerFormErrors.address ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {retailerFormErrors.address && <p className="text-red-500 text-xs mt-1">{retailerFormErrors.address}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button onClick={handleAddRetailer} className="flex-1">Add Retailer</Button>
                <Button variant="secondary" onClick={() => { setShowAddRetailerModal(false); setRetailerFormErrors({}); }} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
