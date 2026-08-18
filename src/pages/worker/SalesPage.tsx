import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
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

interface CartItem extends BillItem {
  isEditingPrice?: boolean;
  editPrice?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
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
  const { bills, stockBatches, rgbItems } = store;

  // View switch: 'create' | 'history' | 'rgbHistory'
  const [viewMode, setViewMode] = useState<'create' | 'history' | 'rgbHistory'>('create');
  const [selectedProductBrand, setSelectedProductBrand] = useState('');
  const [showRGB, setShowRGB] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cart — single source of truth for all product quantities
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [itemDiscountInputs, setItemDiscountInputs] = useState<{ [key: string]: string }>({});

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
  const [cartDiscountType, setCartDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [cartDiscountValue, setCartDiscountValue] = useState('');
  const [pendingReceiptBill, setPendingReceiptBill] = useState<Bill | null>(null);
  const [receiptPendingBills, setReceiptPendingBills] = useState<Bill[]>([]);

  // RGB exchanges for this sale
  // key = rgbItemId, value = { cratesGiven, cratesReturned }
  const [rgbExchanges, setRgbExchanges] = useState<Record<string, { cratesGiven: number; cratesReturned: number }>>({});
  const [retailerRGBBalances, setRetailerRGBBalances] = useState<RGBRetailerBalance[]>([]);

  // History
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<string | null>(null);
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState('');

  // RGB History tab
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
          total: newQty * item.price - (item.discountValue || 0),
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
          discountType: 'fixed' as const,
          discountValue: 0,
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
        const next = prev.filter((_, idx) => idx !== existing);
        // Also clean up its discount input
        setItemDiscountInputs((d) => { const n = { ...d }; delete n[item.id]; return n; });
        return next;
      }
      const updated = [...prev];
      const newQty = item.quantity - 1;
      updated[existing] = {
        ...item,
        quantity: newQty,
        total: Math.max(0, newQty * item.price - (item.discountValue || 0)),
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
        const next = prev.filter((_, idx) => idx !== existing);
        const item = prev[existing];
        setItemDiscountInputs((d) => { const n = { ...d }; delete n[item.id]; return n; });
        return next;
      }

      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing];
        updated[existing] = {
          ...item,
          quantity: targetQty,
          total: targetQty * item.price - (item.discountValue || 0),
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
          discountType: 'fixed' as const,
          discountValue: 0,
        },
      ];
    });
  };


  const removeFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
    setItemDiscountInputs((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
  };

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
  const itemDiscounts = cartItems.reduce((s, i) => s + (i.discountValue || 0), 0);
  const cartDiscountValueNum = parseFloat(cartDiscountValue) || 0;
  const cartDiscountAmount = cartDiscountType === 'percent'
    ? Math.max(0, subtotal - itemDiscounts) * cartDiscountValueNum / 100
    : cartDiscountValueNum;
  const totalDiscounts = itemDiscounts + cartDiscountAmount;
  const udhaarPaymentNum = parseFloat(udhaarPaymentAmount) || 0;
  // FIXED: new bill total = products only. Udhaar payment is applied to OLD bills, not this total.
  const total = subtotal - totalDiscounts;
  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const changeAmount = Math.max(0, amountReceivedNum - total);
  const udhariAmount = Math.max(0, total - amountReceivedNum);

  const retailerPendingBills = bills
    .filter((b) => b.retailerId === selectedRetailer && Number(b.pendingAmount) > 0);
  const existingPendingForRetailer = retailerPendingBills
    .reduce((s, b) => s + Number(b.pendingAmount), 0);

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
          discount: item.discountValue || 0,
        })),
        discount: totalDiscounts,
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

  const loadRgbHistory = async () => {
    setRgbHistoryLoading(true);
    try {
      const data = await rgbService.getTransactions();
      setRgbHistory(data.transactions || []);
    } catch {
      store.addNotification('error', 'Failed to load RGB history');
    } finally {
      setRgbHistoryLoading(false);
    }
  };

  const resetForm = () => {
    setCartItems([]);
    setItemDiscountInputs({});
    setSelectedRetailer('');
    setAmountReceived('');
    setUdhaarPaymentAmount('');
    setUdhaarPaymentMode('old_first');
    setAllocationPreview(null);
    setPaymentMethod('cash');
    setCartDiscountType('fixed');
    setCartDiscountValue('');
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
${bill.discount && Number(bill.discount) > 0 ? `Discount:     ₨${Number(bill.discount).toFixed(2)}\n` : ''}Total:        ₨${Number(bill.total).toFixed(2)}
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
      const r = await retailersService.create({ ...newRetailerForm });
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

  const filteredHistoryBills = useMemo(() => {
    return bills
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
  }, [bills, retailers, historySearchTerm, historyDateFilter]);

  // ── Sidebar ───────────────────────────────────────────────────────────────────
  const isAdmin = currentUser?.role === 'admin';
  const sidebarItems = isAdmin ? ADMIN_SIDEBAR : WORKER_SIDEBAR;

  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        {/* Sticky Header Container: Tabs + Search & Filter Controls */}
        <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md -mt-3 sm:-mt-4 md:-mt-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-3 pb-3 mb-4 border-b border-gray-200/80 shadow-xs transition-all">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              onClick={() => setViewMode('create')}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'create' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <ShoppingCart size={14} /> Create Sale
            </button>
            <button
              onClick={() => { setViewMode('history'); store.fetchBills(); }}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <History size={14} /> Bill History
            </button>
            <button
              onClick={() => { setViewMode('rgbHistory'); loadRgbHistory(); }}
              className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                viewMode === 'rgbHistory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <RotateCcw size={14} /> RGB History
            </button>
          </div>

          {/* Sticky Search & Filter Controls for History views */}
          {viewMode === 'history' && (
            <div className="flex gap-2 sm:gap-3 mt-2.5 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bill# or retailer..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none shadow-2xs"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="text-xs sm:text-sm border border-gray-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white focus:border-blue-400 focus:outline-none shadow-2xs"
              />
              {(historySearchTerm || historyDateFilter) && (
                <button
                  onClick={() => { setHistorySearchTerm(''); setHistoryDateFilter(''); }}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {viewMode === 'rgbHistory' && (
            <div className="flex gap-2 sm:gap-3 mt-2.5 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search retailer or crate item..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none shadow-2xs"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="text-xs sm:text-sm border border-gray-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white focus:border-blue-400 focus:outline-none shadow-2xs"
              />
              {(historySearchTerm || historyDateFilter) && (
                <button
                  onClick={() => { setHistorySearchTerm(''); setHistoryDateFilter(''); }}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── CREATE SALE ── */}
        {viewMode === 'create' && (
          pendingReceiptBill ? (
            // Receipt confirmation screen
            <div className="max-w-lg mx-auto">
              <Card title="✅ Bill Created Successfully">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Bill#</span><span className="font-mono font-bold">{pendingReceiptBill.billNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-lg">₨{Number(pendingReceiptBill.total).toFixed(0)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-green-600 font-semibold">₨{Number(pendingReceiptBill.paidAmount).toFixed(0)}</span></div>
                  {Number(pendingReceiptBill.pendingAmount) > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">Udhari</span><span className="text-orange-600 font-semibold">₨{Number(pendingReceiptBill.pendingAmount).toFixed(0)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-semibold capitalize ${pendingReceiptBill.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{pendingReceiptBill.status}</span></div>
                  {pendingReceiptBill.oldPendingPaymentApplied && Number(pendingReceiptBill.oldPendingPaymentApplied) > 0 && (
                    <div className="flex justify-between text-blue-600 font-medium pt-2 border-t border-gray-100">
                      <span>Udhaar Payment Applied</span>
                      <span>₨{Number(pendingReceiptBill.oldPendingPaymentApplied).toFixed(0)}</span>
                    </div>
                  )}
                </div>

                {receiptPendingBills.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Other Pending Bills</p>
                    <div className="space-y-1 text-xs">
                      {receiptPendingBills.map((bill) => (
                        <div key={bill.id} className="flex justify-between text-gray-600">
                          <span className="font-mono">{bill.billNumber}</span>
                          <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
                          <span className="text-orange-600 font-semibold">₨{Number(bill.pendingAmount).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-gray-700 border-t border-gray-100 pt-1 mt-1">
                        <span>Total Other Pending</span>
                        <span className="text-orange-600">₨{receiptPendingBills.reduce((s, b) => s + Number(b.pendingAmount), 0).toFixed(0)}</span>
                      </div>
                      {Number(pendingReceiptBill.pendingAmount) > 0 && (
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>Grand Total Outstanding</span>
                          <span className="text-orange-600">₨{(receiptPendingBills.reduce((s, b) => s + Number(b.pendingAmount), 0) + Number(pendingReceiptBill.pendingAmount)).toFixed(0)}</span>
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
                    className="flex-1 text-xs"
                  >
                    🖨 Print New Bill Only
                  </Button>
                  <Button
                    onClick={() => {
                      generateAndPrintReceipt(pendingReceiptBill, receiptPendingBills, true);
                      resetForm();
                    }}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    🖨 Print + Old Pending
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={resetForm}
                    className="sm:w-20 text-xs"
                  >
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

                  {/* RGB Exchange Section — interactive crate issue/return per sale */}
                  {showRGB ? (
                    <div>
                      {!selectedRetailer ? (
                        <div className="text-center py-6">
                          <span className="text-3xl">📦</span>
                          <p className="text-sm text-gray-500 mt-2">Select a retailer in <strong>Bill Summary</strong> to record crate exchanges.</p>
                        </div>
                      ) : rgbItems.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">
                          No RGB types configured yet. Add them in <strong>Inventory → RGB Management</strong>.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 text-xs">
                            <p className="text-amber-800 font-medium flex items-center gap-1.5">
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
                                  className="bg-white border-2 border-slate-100 hover:border-amber-300 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                  {/* Item Header */}
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                        📦
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{rgb.name}</h4>
                                        <p className="text-[11px] text-slate-500">Whse Stock: <strong className="text-slate-700">{rgb.stockQuantity}</strong></p>
                                      </div>
                                    </div>
                                    <div>
                                      {balance > 0 ? (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200/60 flex items-center gap-1 shadow-2xs">
                                          📦 Owes: {balance}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-400">
                                          0 Owed
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Steppers Grid */}
                                  <div className="grid grid-cols-2 gap-2">
                                    {/* Given (Issue) Block */}
                                    <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-2 flex flex-col items-center">
                                      <span className="text-[11px] font-bold text-orange-800 mb-1 flex items-center gap-1">
                                        Given ↓
                                      </span>
                                      <div className="flex items-center justify-between w-full border border-orange-300 bg-white rounded-lg overflow-hidden h-8 shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.max(0, exchange.cratesGiven - 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesGiven: val } }));
                                          }}
                                          disabled={exchange.cratesGiven <= 0}
                                          className="w-8 h-full bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white font-bold transition-all flex items-center justify-center"
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
                                          className="w-full text-center text-xs font-extrabold bg-transparent border-0 focus:outline-none p-0 text-orange-950 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = exchange.cratesGiven + 1;
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesGiven: val } }));
                                          }}
                                          className="w-8 h-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold transition-all flex items-center justify-center"
                                        >
                                          <Plus size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Returned (Collect) Block */}
                                    <div className={`border rounded-xl p-2 flex flex-col items-center transition-all ${
                                      balance <= 0
                                        ? 'bg-slate-100/80 border-slate-200 opacity-60'
                                        : 'bg-emerald-50/70 border-emerald-200/80'
                                    }`}>
                                      <span className={`text-[11px] font-bold mb-1 flex items-center gap-1 ${
                                        balance <= 0 ? 'text-slate-400' : 'text-emerald-800'
                                      }`}>
                                        Returned ↑
                                      </span>
                                      <div className={`flex items-center justify-between w-full border rounded-lg overflow-hidden h-8 shadow-2xs ${
                                        balance <= 0 ? 'bg-slate-100 border-slate-200' : 'bg-white border-emerald-300'
                                      }`}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.max(0, exchange.cratesReturned - 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesReturned: val } }));
                                          }}
                                          disabled={balance <= 0 || exchange.cratesReturned <= 0}
                                          className="w-8 h-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold transition-all flex items-center justify-center"
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
                                            balance <= 0 ? 'text-slate-400 cursor-not-allowed' : 'text-emerald-950'
                                          }`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = Math.min(balance, exchange.cratesReturned + 1);
                                            setRgbExchanges(prev => ({ ...prev, [rgb.id]: { ...exchange, cratesReturned: val } }));
                                          }}
                                          disabled={balance <= 0 || exchange.cratesReturned >= balance}
                                          className="w-8 h-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold transition-all flex items-center justify-center"
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
                    // Brand grid — show loading skeletons while data fetches
                    store.isLoading && uniqueBrands.length === 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center p-2 border-2 border-gray-100 rounded-lg bg-gray-50 animate-pulse">
                            <div className="w-full aspect-square rounded-md bg-gray-200 mb-1.5" />
                            <div className="h-3 w-12 bg-gray-200 rounded mb-1" />
                            <div className="h-2 w-8 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {uniqueBrands.map((brand) => {
                          // Use brand-level image (from brandRel relation)
                          const brandImgProduct = inventoryProducts.find((p) => (p.brandRel?.displayName ?? p.brand) === brand);
                          const imgUrl = brandImgProduct?.brandRel?.imageUrl
                            ? getProductImage(brandImgProduct.brandRel.imageUrl ?? undefined)
                            : null;
                          return (
                            <button
                              key={brand}
                              onClick={() => setSelectedProductBrand(brand)}
                              className="group flex flex-col items-center p-2 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm transition-all duration-150 bg-white"
                            >
                              <div className="w-full aspect-square rounded-md overflow-hidden mb-1.5 bg-gray-50 flex items-center justify-center">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={brand}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <Droplet size={24} className="text-blue-400" />
                                )}
                              </div>
                              <p className="text-xs font-bold text-gray-800">{brand}</p>
                              <p className="text-xs text-gray-400">
                                {inventoryProducts.filter((p) => (p.brandRel?.displayName ?? p.brand) === brand).length} variants
                              </p>
                            </button>
                          );
                        })}
                        {uniqueBrands.length === 0 && !store.isLoading && (
                          <p className="col-span-full text-center text-sm text-gray-400 py-8">No products in inventory yet</p>
                        )}
                      </div>
                    )
                  ) : (
                    // Product variant grid with real-time stepper controls
                    <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                      {filteredProducts.map((product) => {
                        const effectiveStock = product.availableStock - (cartStockMap[product.id] ?? 0);
                        const cartQty = cartStockMap[product.id] ?? 0;
                        const isFullyOOS = product.availableStock <= 0;
                        const isAllInCart = !isFullyOOS && effectiveStock <= 0;
                        // Use brand-level image for variant cards
                        const imgUrl = product.brandRel?.imageUrl
                          ? getProductImage(product.brandRel.imageUrl ?? undefined)
                          : product.imageUrl ? getProductImage(product.imageUrl ?? undefined) : null;
                        return (
                          <div
                            key={product.id}
                            className={`relative flex flex-col p-1.5 sm:p-2.5 border-2 rounded-lg transition-all duration-150 bg-white ${
                              isFullyOOS
                                ? 'border-gray-100 opacity-60'
                                : isAllInCart
                                ? 'border-green-400 bg-green-50'
                                : cartQty > 0
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-400 hover:shadow-sm'
                            }`}
                          >
                            {/* Out of Stock overlay */}
                            {isFullyOOS && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg z-10 pointer-events-none">
                                <span className="bg-red-100 text-red-600 text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full border border-red-200">
                                  Out of Stock
                                </span>
                              </div>
                            )}

                            {/* Product image */}
                            {imgUrl && (
                              <div className="w-full aspect-[4/3] rounded-md overflow-hidden mb-1 sm:mb-1.5 bg-gray-50">
                                <img
                                  src={imgUrl}
                                  alt={`${product.brand} ${product.variant}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                                />
                              </div>
                            )}

                            <p className="text-[11px] sm:text-xs font-bold text-gray-800 leading-tight truncate">{product.brand}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 leading-tight truncate">{product.variant}</p>
                            <p className="text-[11px] sm:text-xs font-bold text-blue-600 mt-0.5 mb-1 sm:mb-1.5">
                              ₨{product.defaultPrice.toFixed(0)}
                              <span className="ml-1 text-gray-400 font-normal text-[10px] sm:text-xs block sm:inline">
                                ({isFullyOOS ? '0' : effectiveStock} left)
                              </span>
                            </p>

                            {/* Stepper control: combined pill with integrated − | qty input | + */}
                            <div className={`flex items-center justify-between mt-auto border rounded-lg overflow-hidden transition-all ${
                              cartQty > 0
                                ? 'border-blue-400 bg-white shadow-xs'
                                : 'border-gray-200 bg-gray-50'
                            }`}>
                              <button
                                onClick={() => decrementProduct(product.id)}
                                disabled={cartQty <= 0}
                                className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 bg-red-500 hover:bg-red-600 active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white font-bold transition-all flex items-center justify-center"
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
                                  cartQty > 0 ? 'text-blue-700' : 'text-gray-400'
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
                    {/* Cart Discount Control */}
                    <div className="mb-3 pb-3 border-b border-gray-100 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <label className="text-xs font-semibold text-gray-600">Cart Discount:</label>
                      <div className="flex items-center gap-1.5 flex-1 w-full sm:w-auto">
                        <select
                          value={cartDiscountType}
                          onChange={(e) => setCartDiscountType(e.target.value as 'percent' | 'fixed')}
                          className="border border-gray-200 rounded text-xs py-1 px-1.5 focus:outline-none focus:border-blue-400 bg-white"
                        >
                          <option value="fixed">PKR</option>
                          <option value="percent">%</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={cartDiscountValue ?? ''}
                          onChange={(e) => setCartDiscountValue(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                      <table className="w-full text-xs min-w-[460px]">
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
                                  value={item.quantity ?? 0}
                                  onChange={(e) => updateItemQty(item.id, e.target.value)}
                                  className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="py-1 px-1 text-center">
                                {item.isEditingPrice ? (
                                  <div className="flex items-center gap-1">
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
                                    value={itemDiscountInputs[item.id] ?? ''}
                                    className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                                    onChange={(e) => {
                                      setItemDiscountInputs((prev) => ({ ...prev, [item.id]: e.target.value }));
                                      updateItemDiscount(
                                        item.id,
                                        parseFloat(e.target.value) || 0,
                                        item.discountType || 'fixed'
                                      );
                                    }}
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
                      {/* RGB crates owed by this retailer */}
                      {selectedRetailer && retailerRGBBalances.filter(b => b.balance > 0).length > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs font-semibold text-amber-700 mb-1">📦 RGB Crates Owed</p>
                          {retailerRGBBalances.filter(b => b.balance > 0).map(b => (
                            <div key={b.id} className="flex justify-between text-xs text-amber-700">
                              <span>{b.rgbItem?.name ?? b.rgbItemId}</span>
                              <span className="font-bold">{b.balance}</span>
                            </div>
                          ))}
                        </div>
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
                      <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1.5">
                        <span>Total</span>
                        <span>₨{total.toFixed(0)}</span>
                      </div>
                    </div>

                    {/* Udhaar Payment — applied to OLD bills, does NOT inflate this bill's total */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
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
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
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
                              className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${
                                udhaarPaymentMode === m
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-200 text-gray-500 hover:border-blue-300'
                              }`}
                            >
                              {m === 'old_first' ? 'Old bills first ✓' : 'This bill first'}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Allocation Preview Panel */}
                      {udhaarPaymentNum > 0 && (
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-[10px]">
                          {previewLoading ? (
                            <p className="text-blue-500 text-center py-1">Calculating allocation…</p>
                          ) : allocationPreview ? (
                            <>
                              <p className="font-semibold text-blue-700 mb-1">Allocation Preview</p>
                              {allocationPreview.entries.map((e) => (
                                <div key={e.billId} className="flex justify-between text-gray-700 py-0.5 border-b border-blue-100 last:border-0">
                                  <span className="truncate mr-1">{e.billNumber}</span>
                                  <span className="shrink-0">
                                    −₨{e.amountApplied.toFixed(0)}
                                    {' → '}
                                    <span className={e.newStatus === 'paid' ? 'text-green-600 font-bold' : 'text-orange-600'}>
                                      {e.newStatus === 'paid' ? 'PAID' : `₨${e.pendingAfter.toFixed(0)}`}
                                    </span>
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between font-semibold text-blue-700 mt-1 pt-1 border-t border-blue-200">
                                <span>Total Applied</span>
                                <span>₨{allocationPreview.totalApplied.toFixed(0)}</span>
                              </div>
                              {allocationPreview.excessAmount > 0 && (
                                <p className="mt-1 text-orange-600 font-medium">
                                  ⚠ ₨{allocationPreview.excessAmount.toFixed(0)} exceeds all pending — will not be applied
                                </p>
                              )}
                            </>
                          ) : selectedRetailer ? (
                            <p className="text-gray-400 text-center py-1">Enter an amount to preview</p>
                          ) : (
                            <p className="text-gray-400 text-center py-1">Select a retailer first</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment method — Cash and Bill Only only (Udhaar removed) */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Payment Method</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(['cash', 'generate-only'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setPaymentMethod(m as PaymentMethod)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                              paymentMethod === m
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 text-gray-600 hover:border-blue-300'
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
            <Card>
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-xs min-w-[540px]">
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
                    {filteredHistoryBills.map((bill) => {
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
                                    {bill.items.length === 0 && !bill.rgbExchanges?.length && (
                                      <p className="text-xs text-gray-400 italic">No product items</p>
                                    )}
                                    {bill.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-xs py-0.5">
                                        <span className="text-gray-600">{item.product ? `${item.product.brand} ${item.product.variant}` : item.productId} ×{item.quantity}</span>
                                        <span>₨{Number(item.total).toFixed(0)}</span>
                                      </div>
                                    ))}
                                    {/* RGB exchange entries */}
                                    {bill.rgbExchanges && bill.rgbExchanges.length > 0 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-teal-100">
                                        <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                          📦 Crate Exchanges
                                        </p>
                                        {bill.rgbExchanges.map((ex) => (
                                          <div key={ex.id} className="flex items-center justify-between text-xs py-0.5">
                                            <span className={`font-medium ${ex.type === 'issue' ? 'text-amber-700' : 'text-teal-700'}`}>
                                              {ex.type === 'issue' ? '📦↓ ' : '📦↑ '}
                                              {ex.itemName} — {ex.type === 'issue' ? 'Given' : 'Returned'}
                                            </span>
                                            <span className={`font-bold ${ex.type === 'issue' ? 'text-amber-700' : 'text-teal-700'}`}>
                                              {ex.quantity} crates
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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

        {/* ── RGB HISTORY ── */}
        {viewMode === 'rgbHistory' && (
          <div>
            <Card>
              {rgbHistoryLoading ? (
                <div className="py-8 text-center text-sm text-gray-400">Loading RGB history...</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-xs min-w-[540px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Retailer</th>
                        <th className="text-left py-2 px-2">RGB Item</th>
                        <th className="text-center py-2 px-2">Crate Exchange Activity</th>
                        <th className="text-left py-2 px-2">Worker</th>
                        <th className="text-center py-2 px-2">Bill Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedWorkerRgbHistory.map((group) => (
                        <tr key={group.key} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-500 font-mono">
                            {new Date(group.createdAt).toLocaleString('en-PK', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-2 font-medium">{group.retailerName}</td>
                          <td className="py-2 px-2 font-semibold text-gray-800">{group.itemName}</td>
                          <td className="py-2 px-2 text-center">
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                              {group.cratesGiven > 0 && (
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Given ↓ {group.cratesGiven}
                                </span>
                              )}
                              {group.cratesReturned > 0 && (
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Returned ↑ {group.cratesReturned}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-gray-500">{group.workerName || 'N/A'}</td>
                          <td className="py-2 px-2 text-center">
                            {group.saleId ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono rounded text-[11px] border border-blue-200 font-semibold">
                                Linked to Sale
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">Standalone</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {groupedWorkerRgbHistory.length === 0 && (
                    <p className="text-center text-gray-400 py-8 text-sm">No RGB activity recorded yet</p>
                  )}
                </div>
              )}
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
