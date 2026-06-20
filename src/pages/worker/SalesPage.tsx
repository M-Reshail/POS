import React, { useState, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Select } from '../../components/common';
import { useStore } from '../../store';
import { ShoppingCart, Plus, Trash2, Droplet, Edit2, Check, Search, X, History, UserPlus, Calendar, BarChart3, Package, Users, TrendingUp } from 'lucide-react';
import { Bill, BillItem, PaymentRecord } from '../../types';

interface ProductWithPrice {
  id: string;
  brand: string;
  variant: string;
  category: string;
  petConversionFactor: number;
  defaultPrice: number;
  icon: React.ReactNode;
}

interface CartItemWithEdit extends BillItem {
  isEditingPrice?: boolean;
  editPrice?: string;
}

type PaymentMethod = 'cash' | 'udhar' | 'generate-only';

// Brand image map - uses existing images from public/images/
const BRAND_IMAGES: Record<string, string> = {
  'Pepsi': '/images/pepsi.png',
  'Coca Cola': '/images/coca-cola.png',
  'Sprite': '/images/sprite.png',
  'Dew': '/images/dew.png',
  'String': '/images/string.png',
  'Fanta': '/images/fanta.png',
};

export const SalesPage: React.FC = () => {
  const store = useStore();
  const bills = useStore((state) => state.bills); // Explicit subscription to bills for re-renders
  const [retailers, setRetailers] = useState<any[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [cartItems, setCartItems] = useState<CartItemWithEdit[]>([]);
  const [productQuantities, setProductQuantities] = useState<{ [key: string]: string }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('');
  const [selectedProductBrand, setSelectedProductBrand] = useState('');
  const [selectedRGBBrand, setSelectedRGBBrand] = useState('');
  const [viewMode, setViewMode] = useState<'create' | 'history'>('create');
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [oldPendingPayment, setOldPendingPayment] = useState('');
  const [manualPendingAmount, setManualPendingAmount] = useState('');
  const [pendingReceiptBill, setPendingReceiptBill] = useState<Bill | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<string | null>(null);
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showRGBView, setShowRGBView] = useState(false);
  const [rgbQuantities, setRgbQuantities] = useState<{ [key: string]: string }>({});
  const [newRetailerForm, setNewRetailerForm] = useState({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
  });

  // Mock data for demo with prices
  React.useEffect(() => {
    setRetailers([
      { id: '1', shopName: 'Ali Store', ownerName: 'Ali Khan', mobileNumber: '03001234567' },
      { id: '2', shopName: 'Future Shop', ownerName: 'Fatima Ahmed', mobileNumber: '03009876543' },
    ]);
  }, []);

  // RGB Products (Bottle Crates) - all variants including trays
  // Tray items are sub-variants under their brand; they do NOT appear in the flat brand list
  const rgbProducts = [
    { id: 'rgb-1', brand: 'Pepsi', type: 'RGB', defaultPrice: 1800, icon: '📦' },
    { id: 'rgb-2', brand: 'Coca Cola', type: 'RGB', defaultPrice: 1850, icon: '📦' },
    { id: 'rgb-3', brand: 'Sprite', type: 'RGB', defaultPrice: 1750, icon: '📦' },
    { id: 'rgb-4', brand: 'Dew', type: 'RGB', defaultPrice: 1600, icon: '📦' },
    { id: 'rgb-5', brand: 'String', type: 'RGB', defaultPrice: 1400, icon: '📦' },
    // Tray variants — shown only when a brand is selected in the RGB view
    { id: 'rgb-6', brand: 'Pepsi', type: 'Tray (12 Bottles)', defaultPrice: 900, icon: '📋' },
    { id: 'rgb-7', brand: 'Coca Cola', type: 'Tray (12 Bottles)', defaultPrice: 950, icon: '📋' },
    { id: 'rgb-8', brand: 'Sprite', type: 'Tray (12 Bottles)', defaultPrice: 900, icon: '📋' },
  ];

  // Unique brands in the RGB section (no duplicates — Tray items are sub-variants)
  const uniqueRGBBrands = Array.from(new Set(rgbProducts.map(p => p.brand))).sort();
  // Products visible in the current RGB brand drill-down
  const selectedRGBBrandProducts = selectedRGBBrand
    ? rgbProducts.filter(p => p.brand === selectedRGBBrand)
    : [];

  const mockProducts: ProductWithPrice[] = [
    { 
      id: '1', 
      brand: 'Pepsi', 
      variant: '1.5L', 
      category: 'soft-drink', 
      petConversionFactor: 12,
      defaultPrice: 80,
      icon: <Droplet size={32} className="text-blue-600" />
    },
    { 
      id: '2', 
      brand: 'Pepsi', 
      variant: '2L', 
      category: 'soft-drink', 
      petConversionFactor: 8,
      defaultPrice: 95,
      icon: <Droplet size={32} className="text-blue-600" />
    },
    { 
      id: '3', 
      brand: 'Pepsi', 
      variant: '250ml', 
      category: 'soft-drink', 
      petConversionFactor: 48,
      defaultPrice: 30,
      icon: <Droplet size={32} className="text-blue-600" />
    },
    { 
      id: '4', 
      brand: 'Sprite', 
      variant: '1.5L', 
      category: 'soft-drink', 
      petConversionFactor: 12,
      defaultPrice: 85,
      icon: <Droplet size={32} className="text-green-600" />
    },
    { 
      id: '5', 
      brand: 'Sprite', 
      variant: '2L', 
      category: 'soft-drink', 
      petConversionFactor: 8,
      defaultPrice: 100,
      icon: <Droplet size={32} className="text-green-600" />
    },
    { 
      id: '6', 
      brand: 'Sprite', 
      variant: '500ml', 
      category: 'soft-drink', 
      petConversionFactor: 24,
      defaultPrice: 40,
      icon: <Droplet size={32} className="text-green-600" />
    },
    { 
      id: '7', 
      brand: 'Fanta', 
      variant: '1.5L', 
      category: 'soft-drink', 
      petConversionFactor: 12,
      defaultPrice: 75,
      icon: <Droplet size={32} className="text-orange-600" />
    },
    { 
      id: '8', 
      brand: 'Fanta', 
      variant: '2L', 
      category: 'soft-drink', 
      petConversionFactor: 8,
      defaultPrice: 90,
      icon: <Droplet size={32} className="text-orange-600" />
    },
    { 
      id: '9', 
      brand: 'Fanta', 
      variant: '250ml', 
      category: 'soft-drink', 
      petConversionFactor: 48,
      defaultPrice: 28,
      icon: <Droplet size={32} className="text-orange-600" />
    },
  ];

  // Get unique brands and varieties
  const uniqueBrands = Array.from(new Set(mockProducts.map(p => p.brand))).sort();
  const uniqueVarieties = Array.from(new Set(mockProducts.map(p => p.variant))).sort();
  const selectedBrandProducts = mockProducts.filter((product) => product.brand === selectedProductBrand);

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesSearch = 
        searchTerm === '' || 
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.variant.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBrand = selectedBrand === '' || product.brand === selectedBrand;
      const matchesVariety = selectedVariety === '' || product.variant === selectedVariety;

      return matchesSearch && matchesBrand && matchesVariety;
    });
  }, [searchTerm, selectedBrand, selectedVariety]);

  const visibleProducts = searchTerm || selectedBrand || selectedVariety
    ? filteredProducts
    : selectedBrandProducts;

  const addProductToCart = (product: ProductWithPrice) => {
    const qty = productQuantities[product.id] || '';
    if (!qty) {
      store.addNotification('error', 'Please enter quantity');
      return;
    }

    const item: CartItemWithEdit = {
      id: Date.now().toString(),
      productId: product.id,
      quantity: parseFloat(qty),
      price: product.defaultPrice,
      total: parseFloat(qty) * product.defaultPrice,
      isEditingPrice: false,
      editPrice: product.defaultPrice.toString(),
    };
    setCartItems([...cartItems, item]);
    setProductQuantities({ ...productQuantities, [product.id]: '' });
    store.addNotification('success', `${product.brand} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
  };

  const cancelBill = () => {
    setCartItems([]);
    setProductQuantities({});
    setRgbQuantities({});
    setAmountReceived('');
    setOldPendingPayment('');
    setManualPendingAmount('');
    setPaymentMethod('cash');
    setShowRGBView(false);
    store.addNotification('success', 'Bill cancelled - Cart cleared');
  };

  const addRGBToCart = (rgbProduct: any) => {
    const qty = rgbQuantities[rgbProduct.id] || '';
    if (!qty) {
      store.addNotification('error', 'Please enter quantity');
      return;
    }

    const item: CartItemWithEdit = {
      id: Date.now().toString(),
      productId: rgbProduct.id,
      quantity: parseFloat(qty),
      price: rgbProduct.defaultPrice,
      total: parseFloat(qty) * rgbProduct.defaultPrice,
      isEditingPrice: false,
      editPrice: rgbProduct.defaultPrice.toString(),
    };
    setCartItems([...cartItems, item]);
    setRgbQuantities({ ...rgbQuantities, [rgbProduct.id]: '' });
    store.addNotification('success', `${rgbProduct.brand} ${rgbProduct.type} added to cart`);
  };

  const togglePriceEdit = (itemId: string) => {
    setCartItems(cartItems.map((item) => 
      item.id === itemId 
        ? { ...item, isEditingPrice: !item.isEditingPrice, editPrice: item.price.toString() }
        : item
    ));
  };

  const updateItemPrice = (itemId: string, newPrice: string) => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      store.addNotification('error', 'Invalid price');
      return;
    }

    setCartItems(cartItems.map((item) => 
      item.id === itemId 
        ? { 
            ...item, 
            price: parsedPrice, 
            total: item.quantity * parsedPrice,
            isEditingPrice: false,
            editPrice: newPrice
          }
        : item
    ));
    store.addNotification('success', 'Price updated');
  };

  const updateItemQuantity = (itemId: string, newQuantity: string) => {
    const parsedQty = parseFloat(newQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      store.addNotification('error', 'Invalid quantity');
      return;
    }

    setCartItems(cartItems.map((item) => 
      item.id === itemId 
        ? { ...item, quantity: parsedQty, total: parsedQty * item.price }
        : item
    ));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const existingPendingAmount = bills
    .filter((bill) => bill.retailerId === selectedRetailer && bill.pendingAmount > 0)
    .reduce((sum, bill) => sum + bill.pendingAmount, 0);
  const oldPendingPaymentNum = parseFloat(oldPendingPayment) || 0;
  const manualPendingAmountNum = parseFloat(manualPendingAmount) || 0;
  const appliedOldPendingPayment = Math.min(oldPendingPaymentNum, existingPendingAmount);
  const total = subtotal + manualPendingAmountNum;
  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const changeAmount = Math.max(0, amountReceivedNum - total);
  const udhariAmount = Math.max(0, total - amountReceivedNum);

  const applyOldPendingPaymentToBills = (paymentAmount: number) => {
    if (!selectedRetailer || paymentAmount <= 0) return;

    let remainingPayment = paymentAmount;
    const updatedBills = bills.map((bill) => {
      if (bill.retailerId !== selectedRetailer || bill.pendingAmount <= 0 || remainingPayment <= 0) {
        return bill;
      }

      const paymentForBill = Math.min(remainingPayment, bill.pendingAmount);
      remainingPayment -= paymentForBill;
      const newPaidAmount = bill.paidAmount + paymentForBill;
      const newPendingAmount = Math.max(0, bill.pendingAmount - paymentForBill);

      return {
        ...bill,
        paidAmount: newPaidAmount,
        pendingAmount: newPendingAmount,
        paymentHistory: [
          ...(bill.paymentHistory || []),
          {
            id: `${Date.now()}-${bill.id}`,
            amount: paymentForBill,
            date: new Date(),
            paymentMode: 'cash' as const,
            notes: 'Old pending payment received during new bill',
          },
        ],
        status: newPendingAmount === 0 ? 'paid' as const : 'partial' as const,
        updatedAt: new Date(),
      };
    });

    store.setBills(updatedBills);
  };

  const handleCreateBill = () => {
    if (!selectedRetailer || cartItems.length === 0) {
      store.addNotification('error', 'Please select a retailer and add items');
      return;
    }

    if (amountReceivedNum === 0 && paymentMethod === 'cash') {
      store.addNotification('error', 'Please enter amount received');
      return;
    }

    const billItems: BillItem[] = cartItems.map(({ isEditingPrice, editPrice, ...item }) => item);
    const isPaid = paymentMethod === 'cash' && amountReceivedNum >= total;

    // Initialize payment history
    const paymentHistory: PaymentRecord[] = [];
    if (paymentMethod === 'udhar' || paymentMethod === 'generate-only') {
      // For udhar or bill-only transactions, no initial payment
    } else if (amountReceivedNum > 0) {
      // For cash, record the initial payment
      paymentHistory.push({
        id: Date.now().toString(),
        amount: amountReceivedNum,
        date: new Date(),
      paymentMode: 'cash',
      notes: 'New bill payment',
      });
    }

    const bill: Bill = {
      id: Date.now().toString(),
      billNumber: `BILL-${Date.now()}`,
      retailerId: selectedRetailer,
      workerId: store.currentUser?.id || '',
      items: billItems,
      subtotal,
      total,
      paidAmount: paymentMethod === 'udhar' || paymentMethod === 'generate-only' ? 0 : amountReceivedNum,
      pendingAmount: paymentMethod === 'udhar' || paymentMethod === 'generate-only' ? total : udhariAmount,
      paymentMode: paymentMethod,
      previousPendingAdded: manualPendingAmountNum,
      oldPendingPaymentApplied: appliedOldPendingPayment,
      paymentHistory,
      status: isPaid ? 'paid' : paymentMethod === 'cash' && amountReceivedNum > 0 ? 'partial' : 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setPendingReceiptBill(bill);
  };

  const handleAddNewRetailer = () => {
    if (!newRetailerForm.shopName || !newRetailerForm.ownerName || !newRetailerForm.mobileNumber) {
      store.addNotification('error', 'Please fill all fields');
      return;
    }

    const newRetailer = {
      id: Date.now().toString(),
      ...newRetailerForm,
    };

    setRetailers([...retailers, newRetailer]);
    setSelectedRetailer(newRetailer.id);
    setNewRetailerForm({ shopName: '', ownerName: '', mobileNumber: '' });
    setShowAddRetailerModal(false);
    store.addNotification('success', `Retailer ${newRetailerForm.shopName} added successfully`);
  };

  const generateBillReceipt = (bill: Bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const itemsText = bill.items
      .map((item) => {
        const product = mockProducts.find((p) => p.id === item.productId) || 
                       rgbProducts.find((p) => p.id === item.productId);
        const productInfo = (product as any)?.variant || (product as any)?.type || '';
        return `${product?.brand} ${productInfo} | Qty: ${item.quantity} | PET: Rs ${item.price.toFixed(2)} | Total: Rs ${item.total.toFixed(2)}`;
      })
      .join('\n');

    const receiptContent = `
╔════════════════════════════════════════╗
║         BEVERAGE POS SYSTEM            ║
║              SALES RECEIPT             ║
╚════════════════════════════════════════╝

Bill #: ${bill.billNumber}
Date: ${new Date(bill.createdAt).toLocaleString()}

────────────────────────────────────────
RETAILER DETAILS
────────────────────────────────────────
Shop: ${retailer?.shopName || 'N/A'}
Owner: ${retailer?.ownerName || 'N/A'}
Phone: ${retailer?.mobileNumber || 'N/A'}

────────────────────────────────────────
ITEMS
────────────────────────────────────────
${itemsText}

────────────────────────────────────────
SUMMARY
────────────────────────────────────────
Subtotal:          ₨${bill.subtotal.toFixed(2)}
${bill.previousPendingAdded ? `Previous Pending:  Rs ${bill.previousPendingAdded.toFixed(2)}\n` : ''}${bill.oldPendingPaymentApplied ? `Old Pending Paid:  Rs ${bill.oldPendingPaymentApplied.toFixed(2)}\n` : ''}
Total:             ₨${bill.total.toFixed(2)}
Amount Received:   ₨${bill.paidAmount.toFixed(2)}
${bill.paidAmount > bill.total ? `Change to Give:    ₨${(bill.paidAmount - bill.total).toFixed(2)}\n` : ''}${bill.pendingAmount > 0 ? `Udhari:            ₨${bill.pendingAmount.toFixed(2)}\n` : ''}Status:            ${bill.status.toUpperCase()}

────────────────────────────────────────
Thank you for your business!
════════════════════════════════════════
    `;

    // Copy to clipboard and show notification
    navigator.clipboard.writeText(receiptContent);
    store.addNotification('success', 'Bill receipt generated and copied!');
    
    // Also print the receipt
    const printWindow = window.open('', '', 'height=500,width=800');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Bill Receipt</title>
            <style>
              body { font-family: monospace; padding: 20px; font-size: 12px; }
              pre { white-space: pre; overflow: visible; }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const getReceiptPreviewContent = (bill: Bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const itemsText = bill.items
      .map((item) => {
        const product = mockProducts.find((p) => p.id === item.productId) ||
                       rgbProducts.find((p) => p.id === item.productId);
        const productInfo = (product as any)?.variant || (product as any)?.type || '';
        return `${product?.brand} ${productInfo} | Qty: ${item.quantity} | PET: Rs ${item.price.toFixed(2)} | Total: Rs ${item.total.toFixed(2)}`;
      })
      .join('\n');

    return `Bill #: ${bill.billNumber}
Customer: ${retailer?.shopName || 'N/A'}
Payment Method: ${bill.paymentMode === 'generate-only' ? 'Generate Bill Only' : bill.paymentMode || 'N/A'}

${itemsText}

Subtotal: Rs ${bill.subtotal.toFixed(2)}
${bill.previousPendingAdded ? `Previous Pending: Rs ${bill.previousPendingAdded.toFixed(2)}\n` : ''}Total: Rs ${bill.total.toFixed(2)}
Paid: Rs ${bill.paidAmount.toFixed(2)}
Pending: Rs ${bill.pendingAmount.toFixed(2)}`;
  };

  const resetBillForm = () => {
    setCartItems([]);
    setSelectedRetailer('');
    setProductQuantities({});
    setRgbQuantities({});
    setAmountReceived('');
    setOldPendingPayment('');
    setManualPendingAmount('');
    setPaymentMethod('cash');
    setSelectedProductBrand('');
    setPendingReceiptBill(null);
  };

  const confirmPendingReceipt = () => {
    if (!pendingReceiptBill) return;
    applyOldPendingPaymentToBills(pendingReceiptBill.oldPendingPaymentApplied || 0);
    store.addBill(pendingReceiptBill);
    generateBillReceipt(pendingReceiptBill);
    resetBillForm();
    store.addNotification('success', 'Bill created successfully');
  };

  const cancelPendingReceipt = () => {
    resetBillForm();
    store.addNotification('info', 'Transaction cancelled');
  };

  const updateBillPayment = (billId: string, additionalAmount: number) => {
    const billToUpdate = bills.find((b) => b.id === billId);
    if (!billToUpdate) {
      store.addNotification('error', 'Bill not found');
      return;
    }

    // Cap payment to not exceed the pending amount
    const maxPaymentPossible = billToUpdate.pendingAmount;
    const actualPaymentAmount = Math.min(additionalAmount, maxPaymentPossible);

    if (actualPaymentAmount <= 0) {
      store.addNotification('error', 'Invalid payment amount');
      return;
    }

    const newPaidAmount = billToUpdate.paidAmount + actualPaymentAmount;
    const newPendingAmount = Math.max(0, billToUpdate.total - newPaidAmount);
    const newStatus = newPendingAmount === 0 ? 'paid' : newPendingAmount < billToUpdate.total ? 'partial' : 'pending';

    // Add to payment history
    const paymentRecord: PaymentRecord = {
      id: Date.now().toString(),
      amount: actualPaymentAmount,
      date: new Date(paymentDate),
      paymentMode: 'cash',
    };

    const updatedPaymentHistory = [...(billToUpdate.paymentHistory || []), paymentRecord];

    // Update the bill in the store (replace the old bill with updated one)
    const updatedBill = {
      ...billToUpdate,
      paidAmount: newPaidAmount,
      pendingAmount: newPendingAmount,
      paymentHistory: updatedPaymentHistory,
      status: newStatus as 'pending' | 'partial' | 'paid',
      updatedAt: new Date(),
    };

    const updatedBills = bills.map((b) => (b.id === billId ? updatedBill : b));
    store.setBills(updatedBills);
    setAdditionalPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedBillForDetails(null);
    
    if (actualPaymentAmount < additionalAmount) {
      store.addNotification('success', `Payment recorded: ₨${actualPaymentAmount.toFixed(2)}. Bill fully paid!`);
    } else {
      store.addNotification('success', `Bill payment updated! Remaining Udhari: ₨${newPendingAmount.toFixed(2)}`);
    }
  };

  const getProductDisplayName = (productId: string) => {
    const product = mockProducts.find((p) => p.id === productId) || rgbProducts.find((p) => p.id === productId);
    const productInfo = (product as any)?.variant || (product as any)?.type || '';
    return `${product?.brand || productId} ${productInfo}`.trim();
  };

  const filteredHistoryBills = bills.filter((bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const search = historySearchTerm.trim().toLowerCase();
    const billDate = new Date(bill.createdAt).toISOString().split('T')[0];
    const productText = bill.items.map((item) => getProductDisplayName(item.productId)).join(' ').toLowerCase();
    const paymentText = bill.paymentMode || '';

    const matchesSearch =
      !search ||
      bill.billNumber.toLowerCase().includes(search) ||
      (retailer?.shopName || '').toLowerCase().includes(search) ||
      (retailer?.ownerName || '').toLowerCase().includes(search) ||
      productText.includes(search);

    const matchesDate = !historyDateFilter || billDate === historyDateFilter;
    const matchesPayment = !historyPaymentFilter || paymentText === historyPaymentFilter;

    return matchesSearch && matchesDate && matchesPayment;
  });

  const sidebarItems = store.currentUser?.role === 'admin'
    ? [
        { label: 'Dashboard', icon: <BarChart3 size={20} />, path: '/admin/dashboard' },
        { label: 'Create Sale', icon: <ShoppingCart size={20} />, path: '/worker/sales' },
        { label: 'Inventory', icon: <Package size={20} />, path: '/admin/inventory' },
        { label: 'Retailers', icon: <Users size={20} />, path: '/admin/retailers' },
        { label: 'Reports', icon: <TrendingUp size={20} />, path: '/admin/reports' },
      ]
    : [
        { label: 'Create Sale', icon: <ShoppingCart size={20} />, path: '/worker/sales' },
      ];


  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        {/* Tabs for Create Sale / History */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setViewMode('create')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              viewMode === 'create'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShoppingCart size={18} className="inline mr-2" />
            Create Sale
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              viewMode === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <History size={18} className="inline mr-2" />
            Bill History
          </button>
        </div>

        {/* CREATE SALE VIEW */}
        {viewMode === 'create' && (
          <>
            {/* Retailer Selection Card */}
            <Card className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Select
                    label="Select Retailer"
                    value={selectedRetailer}
                    onChange={(e) => setSelectedRetailer(e.target.value)}
                    options={retailers.map((r) => ({
                      value: r.id,
                      label: `${r.shopName} - ${r.ownerName}`,
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => setShowAddRetailerModal(true)}
                    variant="secondary"
                    className="flex items-center justify-center gap-2"
                  >
                    <UserPlus size={16} />
                    Add New Retailer
                  </Button>
                  {selectedRetailer && (
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      ✓ Retailer selected
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Product Cards - Main Section */}
              <div className="lg:col-span-2 space-y-4">
            <Card title="Products">
              {/* Search and Filter Section */}
              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                {/* Search Bar */}
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or variety..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* Filter Options - All in one row */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Brand Filter */}
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Brands</option>
                    {uniqueBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>

                  {/* Variety Filter */}
                  <select
                    value={selectedVariety}
                    onChange={(e) => setSelectedVariety(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Varieties</option>
                    {uniqueVarieties.map((variety) => (
                      <option key={variety} value={variety}>
                        {variety}
                      </option>
                    ))}
                  </select>

                  {/* RGB Button - Hot Selling Product */}
                  <button
                    onClick={() => {
                      setShowRGBView(!showRGBView);
                      setSearchTerm('');
                      setSelectedBrand('');
                      setSelectedVariety('');
                      setSelectedProductBrand('');
                      setSelectedRGBBrand('');
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                      showRGBView
                        ? 'bg-red-600 text-white border-red-600 shadow-lg'
                        : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                    }`}
                  >
                    📦 RGB 
                  </button>
                </div>

                {/* Active Filters Indicator */}
                {(searchTerm || selectedBrand || selectedVariety || showRGBView) && (
                  <div className="flex gap-2 flex-wrap text-xs">
                    {searchTerm && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Search: {searchTerm}
                      </span>
                    )}
                    {selectedBrand && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        Brand: {selectedBrand}
                      </span>
                    )}
                    {selectedVariety && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        Variety: {selectedVariety}
                      </span>
                    )}
                    {showRGBView && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                        📦 RGB Section
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!showRGBView && !selectedProductBrand && !searchTerm && !selectedBrand && !selectedVariety ? (
                // Brand grid — image-first cards
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {uniqueBrands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => setSelectedProductBrand(brand)}
                      className="group flex flex-col items-center p-3 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all duration-200 bg-white"
                    >
                      {/* Brand Image */}
                      <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gray-100 flex items-center justify-center">
                        {BRAND_IMAGES[brand] ? (
                          <img
                            src={BRAND_IMAGES[brand]}
                            alt={brand}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-4xl">🥤</span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-sm text-center">{brand}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {mockProducts.filter((product) => product.brand === brand).length} variants
                      </p>
                    </button>
                  ))}
                </div>
              ) : !showRGBView ? (
                <div>
                  {selectedProductBrand && !searchTerm && !selectedBrand && !selectedVariety && (
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {BRAND_IMAGES[selectedProductBrand] && (
                          <img
                            src={BRAND_IMAGES[selectedProductBrand]}
                            alt={selectedProductBrand}
                            className="w-8 h-8 rounded-md object-cover"
                          />
                        )}
                        <h3 className="font-bold text-sm text-gray-900">{selectedProductBrand} Variants</h3>
                      </div>
                      <button
                        onClick={() => setSelectedProductBrand('')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        ← Back to brands
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {visibleProducts.length > 0 ? (
                      visibleProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                        >
                          <div className="mb-2 flex justify-center text-3xl">
                            {React.cloneElement(product.icon as React.ReactElement, { size: 28 })}
                          </div>
                          <p className="font-semibold text-center text-xs leading-tight">{product.brand}</p>
                          <p className="text-xs text-gray-600 text-center mb-2 leading-tight">{product.variant}</p>
                          <p className="text-xs font-bold text-blue-600 mb-2">Rs {product.defaultPrice}</p>
                          <input
                            type="number"
                            step="5"
                            min="0"
                            value={productQuantities[product.id] || ''}
                            onChange={(e) =>
                              setProductQuantities({ ...productQuantities, [product.id]: e.target.value })
                            }
                            placeholder="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center mb-2 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={() => addProductToCart(product)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 rounded font-semibold transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-8 text-center text-gray-500">
                        <p className="text-sm">No products found matching your filters.</p>
                        <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* RGB Products Display - Brand-first, no duplicate Tray entries */}
              {showRGBView && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h3 className="font-bold text-sm text-red-600 mb-3">Empty Crates - Select a Brand</h3>
                  {!selectedRGBBrand ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {uniqueRGBBrands.map((brand) => (
                        <button key={brand} onClick={() => setSelectedRGBBrand(brand)} className="group flex flex-col items-center p-3 border-2 border-red-200 rounded-xl hover:border-red-500 hover:shadow-md transition-all duration-200 bg-red-50">
                          <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-white flex items-center justify-center">
                            {BRAND_IMAGES[brand] ? (
                              <img src={BRAND_IMAGES[brand]} alt={brand} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (<span className="text-4xl">📦</span>)}
                          </div>
                          <p className="font-bold text-gray-900 text-sm text-center">{brand}</p>
                          <p className="text-xs text-red-600 mt-0.5">{rgbProducts.filter(p => p.brand === brand).length} types</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {BRAND_IMAGES[selectedRGBBrand] && (<img src={BRAND_IMAGES[selectedRGBBrand]} alt={selectedRGBBrand} className="w-8 h-8 rounded-md object-cover" />)}
                          <h4 className="font-bold text-sm text-gray-900">{selectedRGBBrand} Crate Types</h4>
                        </div>
                        <button onClick={() => setSelectedRGBBrand('')} className="text-xs font-semibold text-red-600 hover:text-red-700">Back to brands</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {selectedRGBBrandProducts.map((product) => (
                          <div key={product.id} className="flex flex-col items-center p-3 border-2 border-red-300 rounded-lg hover:border-red-600 transition-all duration-200 bg-red-50">
                            <div className="mb-2 text-3xl">{product.icon}</div>
                            <p className="font-semibold text-center text-xs">{product.brand}</p>
                            <p className="text-xs text-gray-600 text-center mb-2">{product.type}</p>
                            <p className="text-xs font-bold text-red-600 mb-2">Rs {product.defaultPrice}</p>
                            <input type="number" step="1" min="0" value={rgbQuantities[product.id] || ''} onChange={(e) => setRgbQuantities({ ...rgbQuantities, [product.id]: e.target.value })} placeholder="0" className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center mb-2 focus:border-red-500 focus:outline-none" />
                            <button onClick={() => addRGBToCart(product)} className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 rounded font-semibold transition-colors flex items-center justify-center gap-1"><Plus size={14} />Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Product Grid - Compact Cards */}

            </Card>
          </div>

          {/* Cart Summary - Sidebar */}
          <div className="lg:col-span-2">
            <Card title={`Bill Summary (${cartItems.length})`} className="sticky top-24">
              {cartItems.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">
                  Click on products to add items
                </p>
              )}
              {cartItems.length > 0 && (
                <div className="max-h-96 overflow-y-auto mb-4">
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-2 py-2 text-left">Item</th>
                          <th className="px-2 py-2 text-center">PET</th>
                          <th className="px-2 py-2 text-right">Price/PET</th>
                          <th className="px-2 py-2 text-right">Total</th>
                          <th className="px-2 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item) => {
                          const product = mockProducts.find((p) => p.id === item.productId) ||
                                           rgbProducts.find((p) => p.id === item.productId);
                          return (
                            <tr key={item.id} className="border-t border-gray-200 bg-white hover:bg-gray-50">
                              <td className="px-2 py-2">
                                <p className="font-semibold text-gray-900">{product?.brand}</p>
                                <p className="text-gray-500">{(product as any)?.variant || (product as any)?.type}</p>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="number"
                                  step="5"
                                  value={item.quantity}
                                  onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs"
                                />
                              </td>
                              <td className="px-2 py-2 text-right">
                                {item.isEditingPrice ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      value={item.editPrice}
                                      onChange={(e) => {
                                        const updatedItems = cartItems.map(i =>
                                          i.id === item.id ? { ...i, editPrice: e.target.value } : i
                                        );
                                        setCartItems(updatedItems);
                                      }}
                                      className="w-20 px-2 py-1 border border-blue-300 rounded text-right text-xs"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => updateItemPrice(item.id, item.editPrice || '')}
                                      className="bg-green-600 text-white p-1 rounded hover:bg-green-700 transition-colors"
                                      title="Save price per PET"
                                    >
                                      <Check size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => togglePriceEdit(item.id)}
                                    className="inline-flex items-center gap-1 text-blue-700 hover:bg-blue-50 px-2 py-1 rounded"
                                    title="Edit price per PET"
                                  >
                                    Rs {item.price.toFixed(2)}
                                    <Edit2 size={13} />
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-2 text-right font-bold text-blue-600">Rs {item.total.toFixed(2)}</td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="hidden space-y-2 max-h-96 overflow-y-auto mb-4">
                {cartItems.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">
                    👆 Click on products to add items
                  </p>
                ) : (
                  cartItems.map((item) => {
                    const product = mockProducts.find((p) => p.id === item.productId) || 
                                     rgbProducts.find((p) => p.id === item.productId);
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{product?.brand}</p>
                            <p className="text-xs text-gray-600">{(product as any)?.variant || (product as any)?.type}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Quantity Edit */}
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="5"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <span className="text-xs text-gray-600">PET</span>
                          </div>
                        </div>

                        {/* Price Edit */}
                        {item.isEditingPrice ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="number"
                              value={item.editPrice}
                              onChange={(e) => {
                                const updatedItems = cartItems.map(i =>
                                  i.id === item.id ? { ...i, editPrice: e.target.value } : i
                                );
                                setCartItems(updatedItems);
                              }}
                              className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => updateItemPrice(item.id, item.editPrice || '')}
                              className="bg-green-600 text-white p-1 rounded hover:bg-green-700 transition-colors"
                              title="Save price"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span>₨{item.price.toFixed(2)}/PET</span>
                            <button
                              onClick={() => togglePriceEdit(item.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded transition-colors"
                              title="Edit price"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}

                        {/* Total */}
                        <div className="border-t pt-2 flex justify-between items-center bg-blue-50 p-2 rounded">
                          <span className="text-xs font-semibold text-gray-700">Total:</span>
                          <span className="font-bold text-blue-600">₨{item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totals */}
              {cartItems.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  {/* Retailer Selection in Summary */}
                  {!selectedRetailer && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Select/Add Retailer *</label>
                      <div className="flex gap-2 mb-2">
                        <select
                          value={selectedRetailer}
                          onChange={(e) => setSelectedRetailer(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">Select a retailer...</option>
                          {retailers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.shopName} - {r.ownerName}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowAddRetailerModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                          title="Add new retailer"
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Selected Retailer Info */}
                  {selectedRetailer && (
                    <div className="bg-green-50 border border-green-200 p-2 rounded text-xs">
                      <p className="font-semibold text-green-700">✓ Retailer Selected</p>
                      <p className="text-gray-700">
                        {retailers.find((r) => r.id === selectedRetailer)?.shopName}
                      </p>
                    </div>
                  )}

                  {/* Subtotal */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold">₨{subtotal.toFixed(2)}</span>
                  </div>

                  {selectedRetailer && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-orange-700">Existing customer pending</span>
                        <span className="text-orange-700">Rs {existingPendingAmount.toFixed(2)}</span>
                      </div>
                      {existingPendingAmount > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Receive old pending now</label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={oldPendingPayment}
                            onChange={(e) => setOldPendingPayment(e.target.value)}
                            placeholder="Amount received for old pending"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                          {appliedOldPendingPayment > 0 && (
                            <p className="mt-1 text-xs text-green-700">
                              Rs {appliedOldPendingPayment.toFixed(2)} will be applied to old pending bills.
                            </p>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Add previous pending manually</label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={manualPendingAmount}
                          onChange={(e) => setManualPendingAmount(e.target.value)}
                          placeholder="Add old pending to this bill"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between text-lg border-t border-b py-2">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="font-bold text-blue-600 text-xl">₨{total.toFixed(2)}</span>
                  </div>

                  {/* Payment Method Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          paymentMethod === 'cash'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        💰 Cash
                      </button>
                      <button
                        onClick={() => {
                          setPaymentMethod('udhar');
                          setAmountReceived('');
                        }}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          paymentMethod === 'udhar'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Udhari
                      </button>
                      <button
                        onClick={() => {
                          setPaymentMethod('generate-only');
                          setAmountReceived('');
                        }}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          paymentMethod === 'generate-only'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Generate Bill Only
                      </button>
                    </div>
                  </div>

                  {/* Amount Received Input (Cash Only) */}
                  {paymentMethod === 'cash' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Amount Received (₨) *</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="Enter amount received"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Payment Summary */}
                  {paymentMethod === 'cash' && amountReceivedNum > 0 && (
                    <div className="bg-blue-50 border-2 border-blue-300 p-3 rounded space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 font-semibold">Amount Received:</span>
                        <span className="font-bold text-blue-600">₨{amountReceivedNum.toFixed(2)}</span>
                      </div>
                      {changeAmount > 0 && (
                        <div className="flex justify-between text-sm bg-green-100 p-2 rounded border border-green-300 font-semibold">
                          <span className="text-green-700">💵 Change to Give:</span>
                          <span className="text-green-700 text-lg">₨{changeAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {udhariAmount > 0 && (
                        <div className="flex justify-between text-sm bg-orange-100 p-2 rounded border border-orange-300 font-semibold">
                          <span className="text-orange-700">📋 Remaining Udhari:</span>
                          <span className="text-orange-700">₨{udhariAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create Bill & Cancel Buttons */}
                  <div className="space-y-2 pt-2">
                    <Button 
                      onClick={handleCreateBill} 
                      className="w-full"
                      disabled={!selectedRetailer}
                    >
                      <Check size={18} className="mr-2" />
                      Create Bill
                    </Button>
                    <Button 
                      onClick={cancelBill} 
                      variant="secondary"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300"
                    >
                      <X size={18} className="mr-2" />
                      Cancel Bill
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Quick Info Card */}
            <Card className="mt-4">
              <h4 className="font-semibold text-sm mb-2">📋 Tips</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ Click product icon to add</li>
                <li>✓ Edit quantity inline</li>
                <li>✓ Click edit icon to change price</li>
                <li>✓ Click 📦 RGB for hot-selling crates</li>
                <li>✓ Use Cancel Bill to clear everything</li>
                <li>✓ Remove unwanted items</li>
              </ul>
            </Card>
          </div>
        </div>
          </>
        )}

        {/* BILL HISTORY VIEW */}
        {viewMode === 'history' && (
          <Card title="Bill History">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="relative md:col-span-2">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  placeholder="Search bill #, customer, product..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={historyPaymentFilter}
                onChange={(e) => setHistoryPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="udhar">Udhari</option>
                <option value="generate-only">Generate Bill Only</option>
              </select>
            </div>
            {bills && bills.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Bill #</th>
                      <th className="px-4 py-2 text-left">Retailer</th>
                      <th className="px-4 py-2 text-center">Items</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-center">Payment</th>
                      <th className="px-4 py-2 text-center">Status</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryBills.map((bill) => {
                      const retailer = retailers.find((r) => r.id === bill.retailerId);
                      return (
                        <tr key={bill.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-semibold text-blue-600">{bill.billNumber}</td>
                          <td className="px-4 py-2">{retailer?.shopName || 'N/A'}</td>
                          <td className="px-4 py-2 text-center">{bill.items.length}</td>
                          <td className="px-4 py-2 text-right font-semibold">₨{bill.total.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center capitalize">
                            {bill.paymentMode === 'generate-only' ? 'Bill Only' : bill.paymentMode || 'N/A'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              bill.status === 'paid' 
                                ? 'bg-green-100 text-green-700'
                                : bill.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {bill.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => setSelectedBillForDetails(bill.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredHistoryBills.length === 0 && (
                  <p className="text-center text-gray-500 py-6">No bills match your filters</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History size={32} className="mx-auto mb-2 opacity-50" />
                <p>No bills created yet</p>
              </div>
            )}
          </Card>
        )}

        {/* Bill Details Modal */}
        {selectedBillForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
              {(() => {
                const bill = bills.find((b) => b.id === selectedBillForDetails);
                if (!bill) return null;
                const retailer = retailers.find((r) => r.id === bill.retailerId);

                return (
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-bold">{bill.billNumber}</h3>
                        <p className="text-xs text-gray-600">Created: {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <button
                        onClick={() => setSelectedBillForDetails(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Retailer Info */}
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4">
                      <p className="text-sm font-semibold text-gray-900">{retailer?.shopName}</p>
                      <p className="text-xs text-gray-600">Owner: {retailer?.ownerName}</p>
                      <p className="text-xs text-gray-600">Phone: {retailer?.mobileNumber}</p>
                    </div>

                    {/* Items List */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">Bill Items:</h4>
                      <div className="max-h-40 overflow-y-auto border rounded bg-gray-50">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="px-2 py-2 text-left">Item</th>
                              <th className="px-2 py-2 text-center">PET</th>
                              <th className="px-2 py-2 text-right">Price/PET</th>
                              <th className="px-2 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bill.items.map((item, idx) => {
                              const product = mockProducts.find((p) => p.id === item.productId) || 
                                             rgbProducts.find((p) => p.id === item.productId);
                              const productInfo = (product as any)?.variant || (product as any)?.type || '';
                              return (
                                <tr key={idx} className="border-t border-gray-200 bg-white">
                                  <td className="px-2 py-2">{product?.brand} {productInfo}</td>
                                  <td className="px-2 py-2 text-center">{item.quantity}</td>
                                  <td className="px-2 py-2 text-right">Rs {item.price.toFixed(2)}</td>
                                  <td className="px-2 py-2 text-right font-semibold">Rs {item.total.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="hidden space-y-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                        {bill.items.map((item, idx) => {
                          const product = mockProducts.find((p) => p.id === item.productId) || 
                                         rgbProducts.find((p) => p.id === item.productId);
                          const productInfo = (product as any)?.variant || (product as any)?.type || '';
                          return (
                            <div key={idx} className="flex justify-between text-xs">
                              <span>{product?.brand} ({productInfo}) x {item.quantity}</span>
                              <span className="font-semibold">₨{item.total.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="border-t pt-3 space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Total Bill:</span>
                        <span className="font-semibold">₨{bill.total.toFixed(2)}</span>
                      </div>
                      {!!bill.previousPendingAdded && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">Previous Pending Added:</span>
                          <span className="font-semibold text-orange-600">Rs {bill.previousPendingAdded.toFixed(2)}</span>
                        </div>
                      )}
                      {!!bill.oldPendingPaymentApplied && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">Old Pending Paid:</span>
                          <span className="font-semibold text-green-600">Rs {bill.oldPendingPaymentApplied.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Amount Paid:</span>
                        <span className="font-semibold text-green-600">₨{bill.paidAmount.toFixed(2)}</span>
                      </div>
                      {bill.paidAmount > bill.total && (
                        <div className="flex justify-between text-sm bg-green-50 p-2 rounded border border-green-200">
                          <span className="text-green-700 font-semibold">💵 Change Given:</span>
                          <span className="font-bold text-green-700">₨{(bill.paidAmount - bill.total).toFixed(2)}</span>
                        </div>
                      )}
                      {bill.pendingAmount > 0 && (
                        <div className="flex justify-between text-sm bg-orange-50 p-2 rounded border border-orange-200">
                          <span className="text-orange-700 font-semibold">📋 Remaining Udhari:</span>
                          <span className="font-bold text-orange-700">₨{bill.pendingAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-gray-700">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          bill.status === 'paid' 
                            ? 'bg-green-100 text-green-700'
                            : bill.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {bill.status}
                        </span>
                      </div>
                    </div>

                    {/* Payment History */}
                    {(bill.paymentHistory && bill.paymentHistory.length > 0) && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <History size={16} />
                          Payment History
                        </h4>
                        <div className="space-y-2">
                          {bill.paymentHistory.map((payment, idx) => (
                            <div key={payment.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-blue-100">
                              <div>
                                <span className="font-semibold text-gray-900">Payment #{idx + 1}</span>
                                <p className="text-xs text-gray-600">
                                  📅 {new Date(payment.date).toLocaleDateString()} ({new Date(payment.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                </p>
                              </div>
                              <span className="font-bold text-green-600">₨{payment.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                            <span>Total Paid:</span>
                            <span className="text-green-600">₨{bill.paymentHistory.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Update Section */}
                    {bill.pendingAmount > 0 && (
                      <div className="bg-orange-50 border border-orange-200 p-3 rounded mb-4">
                        <h4 className="font-semibold text-sm mb-2">💳 Record Payment</h4>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={additionalPaymentAmount}
                              onChange={(e) => setAdditionalPaymentAmount(e.target.value)}
                              placeholder="Enter amount received"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                const amount = parseFloat(additionalPaymentAmount);
                                if (isNaN(amount) || amount <= 0) {
                                  store.addNotification('error', 'Enter valid amount');
                                  return;
                                }
                                updateBillPayment(bill.id, amount);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                            >
                              <Check size={14} className="inline mr-1" />
                              Update
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-600" />
                            <input
                              type="date"
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedBillForDetails(null)}
                      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-2 rounded text-sm font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* Receipt Preview Modal */}
        {pendingReceiptBill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold">Receipt Preview</h3>
                  <p className="text-xs text-gray-600">Confirm to save and print this bill.</p>
                </div>
                <button
                  onClick={cancelPendingReceipt}
                  className="text-gray-500 hover:text-gray-700"
                  title="Cancel transaction"
                >
                  <X size={20} />
                </button>
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-[11px] leading-5 overflow-x-auto whitespace-pre font-mono">
                {getReceiptPreviewContent(pendingReceiptBill)}
              </pre>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="secondary" onClick={cancelPendingReceipt}>
                  Cancel
                </Button>
                <Button onClick={confirmPendingReceipt}>
                  Confirm Bill
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Add New Retailer Modal */}
        {showAddRetailerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-96 max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Add New Retailer</h3>
                <button
                  onClick={() => setShowAddRetailerModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Shop Name *</label>
                  <input
                    type="text"
                    value={newRetailerForm.shopName}
                    onChange={(e) =>
                      setNewRetailerForm({ ...newRetailerForm, shopName: e.target.value })
                    }
                    placeholder="Enter shop name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Owner Name *</label>
                  <input
                    type="text"
                    value={newRetailerForm.ownerName}
                    onChange={(e) =>
                      setNewRetailerForm({ ...newRetailerForm, ownerName: e.target.value })
                    }
                    placeholder="Enter owner name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number *</label>
                  <input
                    type="tel"
                    value={newRetailerForm.mobileNumber}
                    onChange={(e) =>
                      setNewRetailerForm({ ...newRetailerForm, mobileNumber: e.target.value })
                    }
                    placeholder="Enter mobile number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleAddNewRetailer}
                    className="flex-1"
                  >
                    <Check size={16} className="mr-2" />
                    Add Retailer
                  </Button>
                  <Button
                    onClick={() => setShowAddRetailerModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
