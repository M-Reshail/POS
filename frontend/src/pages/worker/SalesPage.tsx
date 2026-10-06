import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button } from '../../components/common';
import { Card, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import {
  ShoppingCart, Trash2, Droplet, Edit2, Check, Search, X,
  History, UserPlus, ChevronLeft, Minus, Plus, RotateCcw,
} from 'lucide-react';
import { Bill, BillItem, RGBRetailerBalance, RGBTransactionRecord, AllocationPlan, UdhaarAllocationMode } from '../../types';
import { retailersService } from '../../services/retailers';
import { billsService } from '../../services/bills';
import { rgbService } from '../../services/rgb';
import { ADMIN_SIDEBAR, WORKER_SIDEBAR } from '../../constants/navigation';
import { ExpandableBillRow } from '../../components/bills/ExpandableBillRow';

interface CartItem extends BillItem {
  isEditingPrice?: boolean;
  editPrice?: string;
  productName?: string;
}

// Udhaar removed — only Cash and Bill Only are valid for new sales
type PaymentMethod = 'cash' | 'credit' | 'udhar' | 'generate-only';

// Resolve a product image URL (server-relative → full URL)
const getProductImage = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${base}${imageUrl}`;
};

export const SalesPage: React.FC = () => {
  const store = useStore();
  const retailers = store.retailers;
  const products = store.products;
  const { stockBatches, rgbItems } = store;

  // View switch: 'create' | 'history' | 'rgbHistory'
  const [viewMode, setViewMode] = useState<'create' | 'history' | 'rgbHistory'>('create');
  const [selectedProductBrand, setSelectedProductBrand] = useState('');
  const [showRGB, setShowRGB] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cart — single source of truth for all product quantities
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Bill Summary panel
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  // Udhaar payment toward old/new pending bills — does NOT inflate this bill's total
  const [udhaarPaymentAmount, setUdhaarPaymentAmount] = useState('');
  const [udhaarPaymentMode, setUdhaarPaymentMode] = useState<UdhaarAllocationMode>('old_first');
  const [allocationPreview, setAllocationPreview] = useState<AllocationPlan | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingReceiptBill, setPendingReceiptBill] = useState<Bill | null>(null);
  const [receiptPendingBills, setReceiptPendingBills] = useState<Bill[]>([]);

  // RGB exchanges for this sale
  // key = rgbItemId, value = { cratesGiven, cratesReturned }
  const [rgbExchanges, setRgbExchanges] = useState<Record<string, { cratesGiven: number; cratesReturned: number }>>({});
  const [retailerRGBBalances, setRetailerRGBBalances] = useState<RGBRetailerBalance[]>([]);

  // History tab (Full dataset loaded in single call)
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<string | null>(null);
  const [historyBills, setHistoryBills] = useState<Bill[]>([]);
  const [historyBillsLoading, setHistoryBillsLoading] = useState(false);

  // RGB History tab (Full dataset loaded in single call)
  const [rgbHistory, setRgbHistory] = useState<RGBTransactionRecord[]>([]);
  const [rgbHistoryLoading, setRgbHistoryLoading] = useState(false);

  // Add Retailer Modal
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [newRetailerForm, setNewRetailerForm] = useState({ shopName: '', ownerName: '', mobileNumber: '', address: '' });
  const [retailerFormErrors, setRetailerFormErrors] = useState<{ shopName?: string; ownerName?: string; mobileNumber?: string; address?: string }>({});

  const currentUser = store.currentUser;

  useEffect(() => {
    if (currentUser) {
      store.fetchInitialData();
    }
  }, [currentUser?.id]);

  // Fetch retailer's RGB balances whenever the selected retailer changes
  useEffect(() => {
    setRgbExchanges({});
    if (!selectedRetailer) {
      setRetailerRGBBalances([]);
      return;
    }
    rgbService.getRetailerBalances(selectedRetailer)
      .then(setRetailerRGBBalances)
      .catch(() => setRetailerRGBBalances([]));
  }, [selectedRetailer]);

  const loadHistoryBills = async () => {
    setHistoryBillsLoading(true);
    try {
      const res = await billsService.list({ limit: 2000 });
      setHistoryBills(res.bills || []);
    } catch (err) {
      console.error('Failed to load history bills:', err);
    } finally {
      setHistoryBillsLoading(false);
    }
  };

  const loadRgbHistory = async () => {
    setRgbHistoryLoading(true);
    try {
      const res = await rgbService.getTransactions({ limit: 2000 });
      setRgbHistory(res.transactions || []);
    } catch (err) {
      console.error('Failed to load RGB history:', err);
    } finally {
      setRgbHistoryLoading(false);
    }
  };

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
    () => Array.from(new Set(inventoryProducts.map((p) => p.brandRel?.displayName ?? p.brand))).sort(),
    [inventoryProducts]
  );

  const filteredProducts = useMemo(() => {
    const base = selectedProductBrand
      ? inventoryProducts.filter((p) => (p.brandRel?.displayName ?? p.brand) === selectedProductBrand)
      : inventoryProducts;
    if (!searchTerm) return base;
    return base.filter(
      (p) =>
        (p.brandRel?.displayName ?? p.brand).toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.variant.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventoryProducts, selectedProductBrand, searchTerm]);

  // ── Grouped RGB History for Worker Tab ───────────────────────────────────────
  const groupedWorkerRgbHistory = useMemo(() => {
    const filtered = rgbHistory.filter((tx) => {
      const s = historySearchTerm.toLowerCase();
      const matchSearch =
        !s ||
        (tx.retailerName || '').toLowerCase().includes(s) ||
        (tx.itemName || '').toLowerCase().includes(s);
      const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
      const matchDate = !historyDateFilter || txDate === historyDateFilter;
      return matchSearch && matchDate;
    });

    const groups: {
      key: string;
      saleId: string | null;
      retailerName: string;
      rgbItemId: string;
      itemName: string;
      workerName: string;
      cratesGiven: number;
      cratesReturned: number;
      createdAt: string | Date;
    }[] = [];

    const map = new Map<string, (typeof groups)[0]>();

    filtered.forEach((tx) => {
      if (tx.saleId) {
        const groupKey = `${tx.saleId}_${tx.rgbItemId}`;
        let group = map.get(groupKey);
        if (!group) {
          group = {
            key: groupKey,
            saleId: tx.saleId,
            retailerName: tx.retailerName || '',
            rgbItemId: tx.rgbItemId,
            itemName: tx.itemName || '',
            workerName: tx.workerName || '',
            cratesGiven: 0,
            cratesReturned: 0,
            createdAt: tx.createdAt,
          };
          map.set(groupKey, group);
          groups.push(group);
        }
        if (tx.type?.toLowerCase() === 'issue') {
          group.cratesGiven += tx.quantity;
        } else if (tx.type?.toLowerCase() === 'return') {
          group.cratesReturned += tx.quantity;
        }
      } else {
        // Standalone RGB transaction
        groups.push({
          key: tx.id,
          saleId: null,
          retailerName: tx.retailerName || '',
          rgbItemId: tx.rgbItemId,
          itemName: tx.itemName || '',
          workerName: tx.workerName || '',
          cratesGiven: tx.type?.toLowerCase() === 'issue' ? tx.quantity : 0,
          cratesReturned: tx.type?.toLowerCase() === 'return' ? tx.quantity : 0,
          createdAt: tx.createdAt,
        });
      }
    });

    return groups;
  }, [rgbHistory, historySearchTerm, historyDateFilter]);

  // ── Cart-derived stock map (real-time, updates on every cart change) ──────────
  // Maps productId → quantity currently in cart (non-RGB items only)
  const cartStockMap = useMemo(() => {
    const map: { [productId: string]: number } = {};
    for (const item of cartItems) {
      if (!item.productId.startsWith('rgb-')) {
        map[item.productId] = (map[item.productId] ?? 0) + item.quantity;
      }
    }
    return map;
  }, [cartItems]);


  // ── Cart Logic ─────────────────────────────────────────────────────────────────
  // Stepper: +1 to cart — reads from DB stock ceiling, enforces effectiveStock > 0
  const incrementProduct = (product: typeof inventoryProducts[0]) => {
    const effectiveStock = product.availableStock - (cartStockMap[product.id] ?? 0);
    if (effectiveStock <= 0) return; // already at ceiling

    setCartItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing];
        const newQty = item.quantity + 1;
        updated[existing] = {
          ...item,
          quantity: newQty,
          total: newQty * item.price,
        };
        return updated;
      }
      // First time adding this product
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: `${product.brand} ${product.variant}`,
          quantity: 1,
          price: product.defaultPrice,
          total: product.defaultPrice,
          isEditingPrice: false,
          editPrice: product.defaultPrice.toString(),
        },
      ];
    });
  };

  // Stepper: −1 from cart — removes item entirely when quantity hits 0
  const decrementProduct = (productId: string) => {
    setCartItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === productId);
      if (existing < 0) return prev;
      const item = prev[existing];
      if (item.quantity <= 1) {
        // Remove item from cart entirely
        return prev.filter((_, idx) => idx !== existing);
      }
      const updated = [...prev];
      const newQty = item.quantity - 1;
      updated[existing] = {
        ...item,
        quantity: newQty,
        total: Math.max(0, newQty * item.price),
      };
      return updated;
    });
  };

  // Stepper: Set absolute quantity for a product (enforces stock ceiling)
  const setProductQuantity = (product: typeof inventoryProducts[0], qty: number) => {
    const targetQty = Math.min(product.availableStock, Math.max(0, qty));
    setCartItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (targetQty <= 0) {
        if (existing < 0) return prev;
        return prev.filter((_, idx) => idx !== existing);
      }

      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing];
        updated[existing] = {
          ...item,
          quantity: targetQty,
          total: targetQty * item.price,
        };
        return updated;
      }
      // First time adding this product
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: `${product.brand} ${product.variant}`,
          quantity: targetQty,
          price: product.defaultPrice,
          total: targetQty * product.defaultPrice,
          isEditingPrice: false,
          editPrice: product.defaultPrice.toString(),
        },
      ];
    });
  };


  const removeFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateItemPrice = (itemId: string, newPriceStr: string) => {
    const price = parseFloat(newPriceStr);
    if (isNaN(price) || price < 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, price, total: item.quantity * price, isEditingPrice: false }
          : item
      )
    );
  };

  const updateItemQty = (itemId: string, newQtyStr: string) => {
    const qty = parseFloat(newQtyStr);
    if (isNaN(qty) || qty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: qty, total: Math.max(0, qty * item.price) }
          : item
      )
    );
  };

  // ── Totals ────────────────────────────────────────────────────────────────────
  const subtotal = cartItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const udhaarPaymentNum = parseFloat(udhaarPaymentAmount) || 0;
  // FIXED: new bill total = products only. Udhaar payment is applied to OLD bills, not this total.
  const total = subtotal;
  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const changeAmount = Math.max(0, amountReceivedNum - total);
  const udhariAmount = Math.max(0, total - amountReceivedNum);

  // Use the ledger-sourced outstanding from store.retailers (authoritative)
  // — previously used store.bills aggregation which was unreliable (pagination + stale state)
  const existingPendingForRetailer =
    Number(retailers.find((r) => r.id === selectedRetailer)?.outstanding ?? 0);

  // Synchronous submission guard preventing double-clicks/rapid re-submits
  const isSubmittingRef = useRef(false);

  // ── Bill submission ───────────────────────────────────────────────────────────
  const handleCreateBill = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      if (!selectedRetailer) {
        store.addNotification('error', 'Select a retailer in Bill Summary');
        return;
      }
      // Allow RGB-only bill: empty cart is valid if there's at least one non-zero RGB exchange
      const hasRgbActivity = Object.values(rgbExchanges).some(
        (v) => v.cratesGiven > 0 || v.cratesReturned > 0
      );
      if (cartItems.length === 0 && !hasRgbActivity) {
        store.addNotification('error', 'Add at least one product or record a crate exchange');
        return;
      }
      if (paymentMethod === 'cash' && amountReceivedNum === 0) {
        store.addNotification('error', 'Enter amount received');
        return;
      }

      const paidAmt = paymentMethod === 'generate-only' ? 0 : amountReceivedNum;

      // Build rgbExchanges array (only entries with at least one non-zero value)
      const rgbExchangesPayload = Object.entries(rgbExchanges)
        .filter(([, v]) => v.cratesGiven > 0 || v.cratesReturned > 0)
        .map(([rgbItemId, v]) => ({
          rgbItemId,
          cratesGiven: v.cratesGiven,
          cratesReturned: v.cratesReturned,
        }));

      const billPayload = {
        retailerId: selectedRetailer,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMode: paymentMethod,
        paidAmount: paidAmt,
        // Udhaar payment: applied to old/new bills — NOT added to total (was the bug)
        ...(udhaarPaymentNum > 0 ? {
          udhaarPaymentAmount: udhaarPaymentNum,
          udhaarPaymentMode: udhaarPaymentMode,
        } : {}),
        rgbExchanges: rgbExchangesPayload,
      };

      const result: any = await store.checkoutBill(billPayload);
      const createdBill: Bill = result?.bill ?? result;
      const otherPending: Bill[] = result?.otherPendingBills ?? [];

      if (cartItems.length > 0 && createdBill) {
        setPendingReceiptBill(createdBill);
        setReceiptPendingBills(otherPending);
      } else {
        // RGB-only exchange: no product receipt needed, reset form fields cleanly
        resetForm();
      }
    } catch (err) {
      // Error handled in store
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const resetForm = () => {
    setCartItems([]);
    setSelectedRetailer('');
    setAmountReceived('');
    setUdhaarPaymentAmount('');
    setUdhaarPaymentMode('old_first');
    setAllocationPreview(null);
    setPaymentMethod('cash');
    setPendingReceiptBill(null);
    setReceiptPendingBills([]);
    setShowRGB(false);
    setSelectedProductBrand('');
    setRgbExchanges({});
    setRetailerRGBBalances([]);
  };

  const generateAndPrintReceipt = (
    bill: Bill,
    otherPendingBills: Bill[] = [],
    includeOtherPending: boolean = true
  ) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId) || bill.retailer;
    const itemsText = bill.items
      .map((item) => {
        const name = (item as CartItem).productName || (item.product ? `${item.product.brand} ${item.product.variant}` : item.productId);
        return `${name} | Qty: ${item.quantity} | Price: ₨${Number(item.price).toFixed(2)} | Total: ₨${Number(item.total).toFixed(2)}`;
      })
      .join('\n');

    const hasOtherPending = includeOtherPending && otherPendingBills.length > 0;
    const totalOtherPending = otherPendingBills.reduce((s, b) => s + Number(b.pendingAmount), 0);
    const grandTotalOutstanding = totalOtherPending + Number(bill.pendingAmount || 0);

    const otherPendingText = hasOtherPending
      ? `────────────────────────────────────────
OTHER PENDING BILLS
────────────────────────────────────────
${otherPendingBills.map((b) => {
  const billDate = new Date(b.createdAt).toLocaleDateString('en-PK');
  return `${b.billNumber} | ${billDate} | ₨${Number(b.pendingAmount).toFixed(0)}`;
}).join('\n')}
────────────────────────────────────────
Total Other Pending:  ₨${totalOtherPending.toFixed(0)}
Grand Total Outstanding: ₨${grandTotalOutstanding.toFixed(0)}
`
      : '';

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
Subtotal:     ₨${Number(bill.subtotal).toFixed(2)}
Total:        ₨${Number(bill.total).toFixed(2)}
Paid:         ₨${Number(bill.paidAmount).toFixed(2)}
${Number(bill.pendingAmount) > 0 ? `Udhari:       ₨${Number(bill.pendingAmount).toFixed(2)}\n` : ''}Status:       ${bill.status.toUpperCase()}
${bill.oldPendingPaymentApplied && Number(bill.oldPendingPaymentApplied) > 0 ? `\n────────────────────────────────────────\nUDHAAR PAYMENT APPLIED: ₨${Number(bill.oldPendingPaymentApplied).toFixed(0)}\n────────────────────────────────────────` : ''}

${otherPendingText}Thank you for your business!
════════════════════════════════════════
    `;

    navigator.clipboard.writeText(content).catch(() => {});
    const w = window.open('', '', 'height=600,width=800');
    if (w) {
      w.document.write(`<html><head><title>Bill Receipt</title><style>body{font-family:monospace;padding:20px;font-size:12px;}pre{white-space:pre;}</style></head><body><pre>${content}</pre><script>window.print();window.close();</script></body></html>`);
      w.document.close();
    }
  };

  const handleAddRetailer = async () => {
    const errors: typeof retailerFormErrors = {};
    if (!newRetailerForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!newRetailerForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!newRetailerForm.address.trim()) errors.address = 'Address is required.';
    if (newRetailerForm.mobileNumber && !/^\d{11}$/.test(newRetailerForm.mobileNumber)) {
      errors.mobileNumber = 'Mobile Number must be 11 digits.';
    }

    if (Object.keys(errors).length > 0) {
      setRetailerFormErrors(errors);
      return;
    }
    setRetailerFormErrors({});

    try {
      const r = await retailersService.create({ ...newRetailerForm });
      store.fetchRetailers();
      setSelectedRetailer(r.id);
      store.addNotification('success', 'Retailer added');
      setNewRetailerForm({ shopName: '', ownerName: '', mobileNumber: '', address: '' });
      setShowAddRetailerModal(false);
    } catch (err: any) {
      setRetailerFormErrors({ shopName: err.response?.data?.message || 'Failed to add retailer' });
    }
  };

  const filteredHistoryBills = useMemo(() => {
    return historyBills
      .filter((bill) => {
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
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [historyBills, retailers, historySearchTerm, historyDateFilter]);

  const isAdmin = currentUser?.role === 'admin';
  const sidebarItems = isAdmin ? ADMIN_SIDEBAR : WORKER_SIDEBAR;

  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md -mt-3 sm:-mt-4 md:-mt-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-3 pb-3 mb-4 border-b border-border shadow-xs transition-all">
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              onClick={() => setViewMode('create')}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'create' ? 'border-brand-700 text-brand-700 font-bold' : 'border-transparent text-ink-muted hover:text-ink font-medium'
              }`}
            >
              <ShoppingCart size={14} /> Create Sale
            </button>
            <button
              onClick={() => { setViewMode('history'); loadHistoryBills(); }}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'history' ? 'border-brand-700 text-brand-700 font-bold' : 'border-transparent text-ink-muted hover:text-ink font-medium'
              }`}
            >
              <History size={14} /> Bill History
            </button>
            <button
              onClick={() => { setViewMode('rgbHistory'); loadRgbHistory(); }}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'rgbHistory' ? 'border-brand-700 text-brand-700 font-bold' : 'border-transparent text-ink-muted hover:text-ink font-medium'
              }`}
            >
              <RotateCcw size={14} /> RGB History
            </button>
          </div>

          {viewMode === 'history' && (
            <div className="flex gap-2 sm:gap-3 mt-2.5 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Search bill# or retailer..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="input-field text-xs sm:text-sm pl-9 pr-3 py-1.5 sm:py-2"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="input-field text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2"
              />
              {(historySearchTerm || historyDateFilter) && (
                <button
                  onClick={() => { setHistorySearchTerm(''); setHistoryDateFilter(''); }}
                  className="text-xs text-brand-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {viewMode === 'rgbHistory' && (
            <div className="flex gap-2 sm:gap-3 mt-2.5 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Search retailer or crate item..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="input-field text-xs sm:text-sm pl-9 pr-3 py-1.5 sm:py-2"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="input-field text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2"
              />
              {(historySearchTerm || historyDateFilter) && (
                <button
                  onClick={() => { setHistorySearchTerm(''); setHistoryDateFilter(''); }}
                  className="text-xs text-brand-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {viewMode === 'create' && (
          pendingReceiptBill ? (
            <div className="max-w-lg mx-auto">
              <Card variant="default">
                <h3 className="text-base font-bold text-ink mb-3">✅ Bill Created Successfully</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-ink-muted">Bill#</span><span className="font-mono font-bold text-ink">{pendingReceiptBill.billNumber}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Total</span><span className="font-bold text-lg text-ink">₨<Figure>{Number(pendingReceiptBill.total).toFixed(0)}</Figure></span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Paid</span><span className="text-success-500 font-semibold">₨<Figure>{Number(pendingReceiptBill.paidAmount).toFixed(0)}</Figure></span></div>
                  {Number(pendingReceiptBill.pendingAmount) > 0 && (
                    <div className="flex justify-between"><span className="text-ink-muted">Udhari</span><span className="text-warning-500 font-semibold">₨<Figure>{Number(pendingReceiptBill.pendingAmount).toFixed(0)}</Figure></span></div>
                  )}
                  <div className="flex justify-between"><span className="text-ink-muted">Status</span><span className={`font-semibold capitalize ${pendingReceiptBill.status === 'paid' ? 'text-success-500' : 'text-warning-500'}`}>{pendingReceiptBill.status}</span></div>
                  {pendingReceiptBill.oldPendingPaymentApplied && Number(pendingReceiptBill.oldPendingPaymentApplied) > 0 && (
                    <div className="flex justify-between text-brand-600 font-medium pt-2 border-t border-border">
                      <span>Udhaar Payment Applied</span>
                      <span>₨<Figure>{Number(pendingReceiptBill.oldPendingPaymentApplied).toFixed(0)}</Figure></span>
                    </div>
                  )}
                </div>

                {receiptPendingBills.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-ink mb-2">Other Pending Bills</p>
                    <div className="space-y-1 text-xs">
                      {receiptPendingBills.map((bill) => (
                        <div key={bill.id} className="flex justify-between text-ink-muted">
                          <span className="font-mono">{bill.billNumber}</span>
                          <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
                          <span className="text-warning-500 font-semibold">₨<Figure>{Number(bill.pendingAmount).toFixed(0)}</Figure></span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-ink border-t border-border pt-1 mt-1">
                        <span>Total Other Pending</span>
                        <span className="text-warning-500">₨<Figure>{receiptPendingBills.reduce((s, b) => s + Number(b.pendingAmount), 0).toFixed(0)}</Figure></span>
                      </div>
                      {Number(pendingReceiptBill.pendingAmount) > 0 && (
                        <div className="flex justify-between font-bold text-ink">
                          <span>Grand Total Outstanding</span>
                          <span className="text-warning-500">₨<Figure>{(receiptPendingBills.reduce((s, b) => s + Number(b.pendingAmount), 0) + Number(pendingReceiptBill.pendingAmount)).toFixed(0)}</Figure></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mt-5">
                  <Button
                    onClick={() => {
                      generateAndPrintReceipt(pendingReceiptBill, receiptPendingBills, false);
                      resetForm();
                    }}
                    className="flex-1 text-xs bg-brand-700 hover:bg-brand-600 text-white rounded-control"
                  >
                    🖨 Print New Bill Only
                  </Button>
                  <Button
                    onClick={() => {
                      generateAndPrintReceipt(pendingReceiptBill, receiptPendingBills, true);
                      resetForm();
                    }}
                    className="flex-1 text-xs bg-brand-700 hover:bg-brand-600 text-white rounded-control"
                  >
                    🖨 Print + Old Pending
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={resetForm}
                    className="sm:w-20 text-xs border-border bg-surface-muted text-ink hover:bg-border/50 rounded-control"
                  >
                    Close
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <Card variant="default">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-ink flex-shrink-0">Products</h3>
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search brand or variant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field text-xs pl-8 pr-7 py-1.5"
                      />
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowRGB(!showRGB); setSelectedProductBrand(''); setSearchTerm(''); }}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-control border transition-all ${
                        showRGB ? 'bg-brand-700 text-white border-brand-700' : 'text-brand-600 border-border bg-surface-card hover:bg-surface-muted'
                      }`}
                    >
                      📦 RGB
                    </button>
                  </div>
                  {selectedProductBrand && !showRGB && (
                    <button
                      onClick={() => setSelectedProductBrand('')}
                      className="mb-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      <ChevronLeft size={14} /> All Brands
                    </button>
                  )}
                  {showRGB ? (
                    <div>
                      {!selectedRetailer ? (
                        <div className="text-center py-6">
                          <span className="text-3xl">📦</span>
                          <p className="text-sm text-ink-muted mt-2">Select a retailer in <strong>Bill Summary</strong> to record crate exchanges.</p>
                        </div>
                      ) : rgbItems.length === 0 ? (
                        <p className="text-sm text-ink-subtle text-center py-6">
                          No RGB types configured yet. Add them in <strong>Inventory → RGB Management</strong>.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between bg-surface-muted p-2.5 rounded-control border border-border text-xs">
                            <p className="text-ink-muted font-medium flex items-center gap-1.5">
                              <span>📦</span>
                              <span>Record crate exchange for this sale. Adjust <strong>Given</strong> or <strong>Returned</strong> quantities below.</span>
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {rgbItems.map((rgb) => {
                              const exchange = rgbExchanges[rgb.id] ?? { cratesGiven: 0, cratesReturned: 0 };
                              const balance = retailerRGBBalances.find(b => b.rgbItemId === rgb.id)?.balance ?? 0;
                              return (
                                <div
                                  key={rgb.id}
                                  className="bg-surface-card border border-border hover:border-brand-500/50 rounded-card p-3.5 shadow-xs transition-all flex flex-col justify-between"
                                >
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-10 rounded-control bg-brand-500/10 border border-brand-500/30 text-brand-600 flex items-center justify-center font-bold text-lg">
                                        📦
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-ink text-sm leading-tight">{rgb.name}</h4>
                                        <p className="text-[11px] text-ink-muted">Whse Stock: <strong className="text-ink"><Figure>{rgb.stockQuantity}</Figure></strong></p>
                                      </div>
                                    </div>
                                    <div>
                                      {balance > 0 ? (
                                        <span className="px-2.5 py-1 rounded-control text-xs font-bold bg-surface-muted text-ink border border-border flex items-center gap-1">
                                          📦 Owes: <Figure>{balance}</Figure>
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-control text-[11px] font-medium bg-surface-muted text-ink-subtle border border-border">
                                          0 Owed
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-surface-muted border border-border rounded-control p-2 flex flex-col items-center">
                                      <span className="text-[11px] font-bold text-ink-muted mb-1 flex items-center gap-1">
                                        Given ↑
                                      </span>
                                      <div className="flex items-center justify-between w-full border border-border bg-surface-card rounded-control overflow-hidden h-8 shadow-xs">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.max(0, exchange.cratesGiven - 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesGiven: val } }));
                                          }}
                                          disabled={exchange.cratesGiven <= 0}
                                          className="w-8 h-full bg-brand-700 hover:bg-brand-600 active:scale-95 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold transition-all flex items-center justify-center"
                                        >
                                          <Minus size={13} />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={exchange.cratesGiven === 0 ? '' : exchange.cratesGiven}
                                          placeholder="0"
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesGiven: val } }));
                                          }}
                                          className="w-full text-center text-xs font-extrabold bg-transparent border-0 focus:outline-none p-0 text-ink [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = exchange.cratesGiven + 1;
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesGiven: val } }));
                                          }}
                                          className="w-8 h-full bg-brand-700 hover:bg-brand-600 active:scale-95 text-white font-bold transition-all flex items-center justify-center"
                                        >
                                          <Plus size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className={`border rounded-control p-2 flex flex-col items-center transition-all ${
                                      balance <= 0
                                        ? 'bg-surface-muted/60 border-border opacity-60'
                                        : 'bg-surface-muted border-border'
                                    }`}>
                                      <span className={`text-[11px] font-bold mb-1 flex items-center gap-1 ${
                                        balance <= 0 ? 'text-ink-subtle' : 'text-ink-muted'
                                      }`}>
                                        Returned ↓
                                      </span>
                                      <div className={`flex items-center justify-between w-full border rounded-control overflow-hidden h-8 shadow-xs ${
                                        balance <= 0 ? 'bg-surface-muted border-border' : 'bg-surface-card border-border'
                                      }`}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.max(0, exchange.cratesReturned - 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesReturned: val } }));
                                          }}
                                          disabled={balance <= 0 || exchange.cratesReturned <= 0}
                                          className="w-8 h-full bg-brand-700 hover:bg-brand-600 active:scale-95 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold transition-all flex items-center justify-center"
                                        >
                                          <Minus size={13} />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          max={balance}
                                          disabled={balance <= 0}
                                          value={balance <= 0 ? '' : exchange.cratesReturned === 0 ? '' : exchange.cratesReturned}
                                          placeholder="0"
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const parsed = parseInt(e.target.value) || 0;
                                            const val = Math.min(balance, Math.max(0, parsed));
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesReturned: val } }));
                                          }}
                                          className={`w-full text-center text-xs font-extrabold bg-transparent border-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                            balance <= 0 ? 'text-ink-subtle cursor-not-allowed' : 'text-ink'
                                          }`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.min(balance, exchange.cratesReturned + 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesReturned: val } }));
                                          }}
                                          disabled={balance <= 0 || exchange.cratesReturned >= balance}
                                          className="w-8 h-full bg-brand-700 hover:bg-brand-600 active:scale-95 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold transition-all flex items-center justify-center"
                                        >
                                          <Plus size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !selectedProductBrand && !searchTerm ? (
                    store.isLoading && uniqueBrands.length === 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center p-2 border border-border rounded-card bg-surface-muted animate-pulse">
                            <div className="w-full aspect-square rounded-control bg-border mb-1.5" />
                            <div className="h-3 w-12 bg-border rounded mb-1" />
                            <div className="h-2 w-8 bg-border rounded" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {uniqueBrands.map((brand) => {
                          const brandImgProduct = inventoryProducts.find((p) => (p.brandRel?.displayName ?? p.brand) === brand);
                          const imgUrl = brandImgProduct?.brandRel?.imageUrl
                            ? getProductImage(brandImgProduct.brandRel.imageUrl ?? undefined)
                            : null;
                          return (
                            <button
                              key={brand}
                              onClick={() => setSelectedProductBrand(brand)}
                              className="group flex flex-col items-center p-2 border border-border rounded-card hover:border-brand-600 hover:shadow-xs transition-all duration-150 bg-surface-card"
                            >
                              <div className="w-full aspect-square rounded-control overflow-hidden mb-1.5 bg-surface-muted flex items-center justify-center">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={brand}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <Droplet size={24} className="text-brand-600" />
                                )}
                              </div>
                              <p className="text-xs font-bold text-ink">{brand}</p>
                              <p className="text-xs text-ink-subtle">
                                <Figure>{inventoryProducts.filter((p) => (p.brandRel?.displayName ?? p.brand) === brand).length}</Figure> variants
                              </p>
                            </button>
                          );
                        })}
                        {uniqueBrands.length === 0 && !store.isLoading && (
                          <p className="col-span-full text-center text-sm text-ink-subtle py-8">No products in inventory yet</p>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                      {filteredProducts.map((product) => {
                        const effectiveStock = product.availableStock - (cartStockMap[product.id] ?? 0);
                        const cartQty = cartStockMap[product.id] ?? 0;
                        const isFullyOOS = product.availableStock <= 0;
                        const isAllInCart = !isFullyOOS && effectiveStock <= 0;
                        const imgUrl = product.brandRel?.imageUrl
                          ? getProductImage(product.brandRel.imageUrl ?? undefined)
                          : product.imageUrl ? getProductImage(product.imageUrl ?? undefined) : null;
                        return (
                          <div
                            key={product.id}
                            className={`relative flex flex-col p-1.5 sm:p-2.5 border rounded-card transition-all duration-150 bg-surface-card ${
                              isFullyOOS
                                ? 'border-border bg-surface-muted/60 opacity-70'
                                : isAllInCart
                                ? 'border-success-500/50 bg-success-50/30'
                                : cartQty > 0
                                ? 'border-brand-600 bg-brand-50/30'
                                : 'border-border hover:border-brand-600 hover:shadow-xs'
                            }`}
                          >
                            {isFullyOOS && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-card z-10 pointer-events-none">
                                <span className="bg-danger-50 text-danger-500 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-control border border-danger-500/30">
                                  Out of Stock
                                </span>
                              </div>
                            )}
                            {imgUrl && (
                              <div className="w-full aspect-[4/3] rounded-control overflow-hidden mb-1 sm:mb-1.5 bg-surface-muted">
                                <img
                                  src={imgUrl}
                                  alt={`${product.brand} ${product.variant}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <p className="text-[11px] sm:text-xs font-bold text-ink leading-tight truncate">{product.brand}</p>
                            <p className="text-[10px] sm:text-xs text-ink-muted leading-tight truncate">{product.variant}</p>
                            <p className="text-[11px] sm:text-xs font-bold text-brand-600 mt-0.5 mb-1 sm:mb-1.5">
                              ₨<Figure>{product.defaultPrice.toFixed(0)}</Figure>
                              <span className="ml-1 text-ink-subtle font-normal text-[10px] sm:text-xs block sm:inline">
                                (<Figure>{isFullyOOS ? 0 : effectiveStock}</Figure> left)
                              </span>
                            </p>
                            <div className={`flex items-center justify-between mt-auto border rounded-control overflow-hidden transition-all ${
                              cartQty > 0
                                ? 'border-brand-600 bg-surface-card shadow-xs'
                                : 'border-border bg-surface-muted'
                            }`}>
                              <button
                                onClick={() => decrementProduct(product.id)}
                                disabled={cartQty <= 0}
                                className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 bg-danger-500 hover:bg-danger-600 active:scale-95 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold transition-all flex items-center justify-center"
                              >
                                <Minus size={11} className="sm:w-3.5 sm:h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={product.availableStock}
                                value={cartQty === 0 ? '' : cartQty}
                                placeholder="0"
                                disabled={isFullyOOS}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    setProductQuantity(product, 0);
                                  } else {
                                    const parsed = parseInt(val, 10);
                                    if (!isNaN(parsed)) setProductQuantity(product, parsed);
                                  }
                                }}
                                className={`w-7 sm:w-12 text-center text-xs sm:text-sm font-bold bg-transparent border-0 focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  cartQty > 0 ? 'text-brand-600' : 'text-ink-subtle'
                                }`}
                              />
                              <button
                                onClick={() => incrementProduct(product)}
                                disabled={isFullyOOS || effectiveStock <= 0}
                                className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 bg-green-600 hover:bg-green-700 active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white font-bold transition-all flex items-center justify-center"
                              >
                                <Plus size={11} className="sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>
                            {isAllInCart && (
                              <p className="text-[10px] sm:text-xs text-green-700 font-semibold text-center mt-0.5 sm:mt-1">✓ All in cart</p>
                            )}
                          </div>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <p className="col-span-full text-center text-sm text-gray-400 py-8">No products found</p>
                      )}
                    </div>
                  )}
                </Card>

                {/* ── Cart Table ── */}
                {cartItems.length > 0 && (
                  <Card className="mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-800">Cart ({cartItems.length} items)</h3>
                      <button onClick={() => setCartItems([])} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
                    </div>
                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 border border-border rounded-card">
                      <table className="w-full text-xs min-w-[460px]">
                        <thead className="sticky top-0 z-10 bg-surface-muted border-b border-border text-ink-subtle uppercase text-[10px] font-bold">
                          <tr>
                            <th className="text-left py-2 px-3">Item</th>
                            <th className="text-center py-2 px-1">Qty</th>
                            <th className="text-center py-2 px-1">Price</th>
                            <th className="text-right py-2 px-3">Total</th>
                            <th className="py-2 px-1"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-surface-card">
                          {cartItems.map((item) => (
                            <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                              <td className="py-2 px-3 font-semibold text-ink">{item.productName}</td>
                              <td className="py-2 px-1 text-center">
                                <input
                                  type="number"
                                  value={item.quantity ?? 0}
                                  onChange={(e) => updateItemQty(item.id, e.target.value)}
                                  className="input-field text-xs text-center w-14 py-0.5 font-bold"
                                />
                              </td>
                              <td className="py-2 px-1 text-center">
                                {item.isEditingPrice ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      value={item.editPrice ?? item.price.toString()}
                                      onChange={(e) =>
                                        setCartItems((prev) =>
                                          prev.map((i) =>
                                            i.id === item.id ? { ...i, editPrice: e.target.value } : i
                                          )
                                        )
                                      }
                                      className="input-field text-xs text-center w-16 py-0.5 font-bold"
                                    />
                                    <button
                                      onClick={() => updateItemPrice(item.id, item.editPrice || '0')}
                                      className="text-success-500 hover:text-success-600"
                                    >
                                      <Check size={14} />
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
                                    className="inline-flex items-center gap-1 text-ink hover:text-brand-600 font-medium"
                                  >
                                    ₨<Figure>{item.price.toFixed(0)}</Figure> <Edit2 size={11} className="text-ink-subtle" />
                                  </button>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-ink">
                                ₨<Figure>{item.total.toFixed(0)}</Figure>
                              </td>
                              <td className="py-2 px-1 text-center">
                                <button onClick={() => removeFromCart(item.id)} className="text-ink-subtle hover:text-danger-500 transition-colors">
                                  <Trash2 size={14} />
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
                  <Card variant="default">
                    <h3 className="text-sm font-bold text-ink mb-3">Bill Summary</h3>
                    {/* Retailer select in summary */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-ink-muted block mb-1">Retailer</label>
                      <div className="flex gap-1.5">
                        <select
                          value={selectedRetailer}
                          onChange={(e) => setSelectedRetailer(e.target.value)}
                          className="input-field text-xs flex-1"
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
                          className="flex-shrink-0 p-1.5 border border-border rounded-control hover:border-brand-600 text-ink-muted hover:text-brand-600 bg-surface-card hover:bg-surface-muted transition-colors"
                          title="Add Retailer"
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                      {selectedRetailer && existingPendingForRetailer > 0 && (
                        <p className="mt-1.5 text-xs text-warning-500 font-medium">
                          ⚠ Existing udhari: ₨<Figure>{existingPendingForRetailer.toFixed(0)}</Figure>
                        </p>
                      )}
                      {/* RGB crates owed by this retailer */}
                      {selectedRetailer && retailerRGBBalances.filter(b => b.balance > 0).length > 0 && (
                        <div className="mt-2 p-2 bg-surface-muted border border-border rounded-control">
                          <p className="text-xs font-semibold text-ink-muted mb-1">📦 RGB Crates Owed</p>
                          {retailerRGBBalances.filter(b => b.balance > 0).map(b => (
                            <div key={b.id} className="flex justify-between text-xs text-ink-muted">
                              <span>{b.rgbItem?.name ?? b.rgbItemId}</span>
                              <span className="font-bold text-ink"><Figure>{b.balance}</Figure></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1.5 text-sm border-t border-border pt-3 mb-3">
                      <div className="flex justify-between text-ink-muted">
                        <span>Subtotal</span>
                        <span>₨<Figure>{subtotal.toFixed(0)}</Figure></span>
                      </div>
                      <div className="flex justify-between font-bold text-ink text-lg border-t border-border pt-1.5">
                        <span>Total</span>
                        <span>₨<Figure>{total.toFixed(0)}</Figure></span>
                      </div>
                    </div>

                    {/* Udhaar Payment — applied to OLD bills, does NOT inflate this bill's total */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-ink-muted block mb-1">
                        💳 Apply Payment to Udhaar (₨)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={udhaarPaymentAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUdhaarPaymentAmount(val);
                          setAllocationPreview(null);
                          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                          const amt = parseFloat(val) || 0;
                          if (amt > 0 && selectedRetailer) {
                            setPreviewLoading(true);
                            previewTimerRef.current = setTimeout(async () => {
                              try {
                                const plan = await billsService.previewAllocation({
                                  retailerId: selectedRetailer,
                                  newBillTotal: total,
                                  newBillPaid: paymentMethod === 'cash' ? (parseFloat(amountReceived) || 0) : 0,
                                  paymentAmount: amt,
                                  mode: udhaarPaymentMode,
                                });
                                setAllocationPreview(plan);
                              } catch { /* silently ignore preview errors */ }
                              finally { setPreviewLoading(false); }
                            }, 600);
                          }
                        }}
                        placeholder="0"
                        className="input-field text-xs"
                      />
                      {/* Allocation mode selector */}
                      {udhaarPaymentNum > 0 && (
                        <div className="mt-1.5 flex gap-2">
                          {(['old_first', 'current_first'] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setUdhaarPaymentMode(m);
                                setAllocationPreview(null);
                                if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                                const amt = parseFloat(udhaarPaymentAmount) || 0;
                                if (amt > 0 && selectedRetailer) {
                                  setPreviewLoading(true);
                                  previewTimerRef.current = setTimeout(async () => {
                                    try {
                                      const plan = await billsService.previewAllocation({
                                        retailerId: selectedRetailer,
                                        newBillTotal: total,
                                        newBillPaid: paymentMethod === 'cash' ? (parseFloat(amountReceived) || 0) : 0,
                                        paymentAmount: amt,
                                        mode: m,
                                      });
                                      setAllocationPreview(plan);
                                    } catch { /* ignore */ }
                                    finally { setPreviewLoading(false); }
                                  }, 100);
                                }
                              }}
                              className={`flex-1 py-1 text-[10px] font-semibold rounded-control border transition-all ${
                                udhaarPaymentMode === m
                                  ? 'bg-brand-700 text-white border-brand-700 font-bold'
                                  : 'bg-surface-muted text-ink-muted border-border hover:bg-border/50'
                              }`}
                            >
                              {m === 'old_first' ? 'Old bills first ✓' : 'This bill first'}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Allocation Preview Panel */}
                      {udhaarPaymentNum > 0 && (
                        <div className="mt-2 rounded-control border border-info-500/30 bg-info-50/30 p-2.5 text-[10px]">
                          {previewLoading ? (
                            <p className="text-info-500 text-center py-1">Calculating allocation…</p>
                          ) : allocationPreview ? (
                            <>
                              <p className="font-bold text-info-500 mb-1">Allocation Preview</p>
                              {allocationPreview.entries.map((e) => (
                                <div key={e.billId} className="flex justify-between text-ink-muted py-0.5 border-b border-border/50 last:border-0">
                                  <span className="truncate mr-1 font-mono">{e.billNumber}</span>
                                  <span className="shrink-0">
                                    −₨<Figure>{e.amountApplied.toFixed(0)}</Figure>
                                    {' → '}
                                    <span className={e.newStatus === 'paid' ? 'text-success-500 font-bold' : 'text-warning-500'}>
                                      {e.newStatus === 'paid' ? 'PAID' : `₨${e.pendingAfter.toFixed(0)}`}
                                    </span>
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between font-semibold text-info-500 mt-1 pt-1 border-t border-border">
                                <span>Total Applied</span>
                                <span>₨<Figure>{allocationPreview.totalApplied.toFixed(0)}</Figure></span>
                              </div>
                              {allocationPreview.excessAmount > 0 && (
                                <p className="mt-1 text-warning-500 font-medium">
                                  ⚠ ₨<Figure>{allocationPreview.excessAmount.toFixed(0)}</Figure> exceeds all pending — will not be applied
                                </p>
                              )}
                            </>
                          ) : selectedRetailer ? (
                            <p className="text-ink-subtle text-center py-1">Enter an amount to preview</p>
                          ) : (
                            <p className="text-ink-subtle text-center py-1">Select a retailer first</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment method — Cash and Bill Only only */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-ink-muted block mb-1">Payment Method</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(['cash', 'generate-only'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setPaymentMethod(m as PaymentMethod)}
                            className={`py-1.5 text-xs font-semibold rounded-control border transition-all ${
                              paymentMethod === m
                                ? 'bg-brand-700 text-white border-brand-700 font-bold'
                                : 'bg-surface-card border-border text-ink-muted hover:bg-surface-muted'
                            }`}
                          >
                            {m === 'generate-only' ? 'Bill Only' : 'Cash'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount received (cash only) */}
                    {paymentMethod === 'cash' && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-ink-muted block mb-1">Amount Received (₨)</label>
                        <input
                          type="number"
                          min="0"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="0"
                          className="input-field text-xs"
                        />
                        {amountReceivedNum > 0 && (
                          <div className="mt-1 space-y-0.5 text-xs">
                            {changeAmount > 0 && (
                              <div className="flex justify-between text-success-500 font-medium">
                                <span>Change</span><span>₨<Figure>{changeAmount.toFixed(0)}</Figure></span>
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
                        disabled={cartItems.length === 0 && !Object.values(rgbExchanges).some(v => v.cratesGiven > 0 || v.cratesReturned > 0)}
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
            <Card variant="default">
              <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card shadow-xs">
                <table className="w-full text-xs min-w-[540px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border">
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Bill#</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Retailer</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Worker</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-3">Total</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-3">Paid</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-3">Udhari</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-3">Mode</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-3">Status</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Date</th>
                      <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-card">
                    {filteredHistoryBills.map((bill) => (
                      <ExpandableBillRow
                        key={bill.id}
                        bill={bill}
                        showRetailer={true}
                        showWorker={true}
                        colSpan={10}
                        isExpanded={selectedBillForDetails === bill.id}
                        onToggleExpand={() =>
                          setSelectedBillForDetails((prev) => (prev === bill.id ? null : bill.id))
                        }
                        onPaymentSuccess={async () => {
                          await Promise.all([loadHistoryBills(), store.fetchInitialData()]);
                        }}
                        viewMode="admin-bills"
                      />
                    ))}
                  </tbody>
                </table>
                {filteredHistoryBills.length === 0 && (
                  <p className="text-center text-ink-muted py-12 text-sm">
                    {historyBillsLoading ? 'Loading bills...' : 'No bills found'}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── RGB HISTORY ── */}
        {viewMode === 'rgbHistory' && (
          <div>
            <Card variant="default">
              {rgbHistoryLoading ? (
                <div className="py-12 text-center text-sm text-ink-muted">Loading RGB history...</div>
              ) : (
                <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card shadow-xs">
                  <table className="w-full text-xs min-w-[540px]">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border">
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Date</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Retailer</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">RGB Item</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-3">Crate Exchange Activity</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-3">Worker</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-3">Bill Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface-card">
                      {groupedWorkerRgbHistory.map((group) => (
                        <tr key={group.key} className="hover:bg-surface-muted/50 transition-colors">
                          <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px]">
                            {new Date(group.createdAt).toLocaleString('en-PK', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-ink">{group.retailerName}</td>
                          <td className="py-2.5 px-3 font-bold text-ink">{group.itemName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                              {group.cratesGiven > 0 && (
                                <span className="px-2 py-0.5 rounded-control text-xs font-semibold bg-surface-muted text-ink border border-border">
                                  Given ↑ <Figure>{group.cratesGiven}</Figure>
                                </span>
                              )}
                              {group.cratesReturned > 0 && (
                                <span className="px-2 py-0.5 rounded-control text-xs font-semibold bg-surface-muted text-ink border border-border">
                                  Returned ↓ <Figure>{group.cratesReturned}</Figure>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-ink-muted">{group.workerName || 'N/A'}</td>
                          <td className="py-2.5 px-3 text-center">
                            {group.saleId ? (
                              <span className="px-2 py-0.5 bg-info-50 text-info-500 font-mono rounded-control text-[11px] border border-info-500/30 font-semibold">
                                Linked to Sale
                              </span>
                            ) : (
                              <span className="text-ink-subtle font-normal">Standalone</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {groupedWorkerRgbHistory.length === 0 && (
                    <p className="text-center text-ink-muted py-12 text-sm">No RGB activity recorded yet</p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Add Retailer Modal ── */}
        {showAddRetailerModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="bg-surface-card rounded-hero border border-border shadow-xl max-w-sm w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-ink text-base">Add Retailer</h3>
                <button
                  onClick={() => { setShowAddRetailerModal(false); setRetailerFormErrors({}); }}
                  className="text-ink-subtle hover:text-ink transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                {/* Shop Name */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Shop Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRetailerForm.shopName}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, shopName: e.target.value }))}
                    placeholder="e.g. Ali Store"
                    className={`input-field text-sm ${retailerFormErrors.shopName ? 'border-danger-500 focus:border-danger-500' : ''}`}
                  />
                  {retailerFormErrors.shopName && <p className="text-danger-500 text-xs mt-1">{retailerFormErrors.shopName}</p>}
                </div>
                {/* Owner Name */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Owner Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRetailerForm.ownerName}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="e.g. Ali Khan"
                    className={`input-field text-sm ${retailerFormErrors.ownerName ? 'border-danger-500 focus:border-danger-500' : ''}`}
                  />
                  {retailerFormErrors.ownerName && <p className="text-danger-500 text-xs mt-1">{retailerFormErrors.ownerName}</p>}
                </div>
                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Phone <span className="text-ink-subtle font-normal">(11 digits)</span>
                  </label>
                  <input
                    type="text"
                    value={newRetailerForm.mobileNumber}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                    placeholder="03001234567"
                    maxLength={11}
                    className={`input-field text-sm ${retailerFormErrors.mobileNumber ? 'border-danger-500 focus:border-danger-500' : ''}`}
                  />
                  {retailerFormErrors.mobileNumber && <p className="text-danger-500 text-xs mt-1">{retailerFormErrors.mobileNumber}</p>}
                </div>
                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Address <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRetailerForm.address}
                    onChange={(e) => setNewRetailerForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="City, Province"
                    className={`input-field text-sm ${retailerFormErrors.address ? 'border-danger-500 focus:border-danger-500' : ''}`}
                  />
                  {retailerFormErrors.address && <p className="text-danger-500 text-xs mt-1">{retailerFormErrors.address}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleAddRetailer}
                  className="flex-1 bg-brand-700 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded-control text-sm shadow-sm transition-all"
                >
                  Add Retailer
                </button>
                <button
                  onClick={() => { setShowAddRetailerModal(false); setRetailerFormErrors({}); }}
                  className="flex-1 bg-surface-muted text-ink border border-border hover:bg-border/50 font-medium py-2 px-4 rounded-control text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
