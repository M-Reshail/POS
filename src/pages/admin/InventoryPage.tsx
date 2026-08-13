import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Input, Select, Modal } from '../../components/common';
import { useStore } from '../../store';
import { Package, Plus, Trash2, Upload, X, Pencil, Minus, ImageIcon, ChevronDown, ChevronRight, Boxes, TrendingUp, RotateCcw } from 'lucide-react';
import { StockBatch, RGBItem, Product, Brand, RGBTransactionRecord } from '../../types';
import { inventoryService } from '../../services/inventory';
import { productsService } from '../../services/products';
import { brandsService } from '../../services/brands';
import { rgbService } from '../../services/rgb';
import { ADMIN_SIDEBAR } from '../../constants/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────



const resolveImageUrl = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
  return `${base}${imageUrl}`;
};

/** Get display name for a product's brand */
const getBrandName = (p: Product): string => {
  if (p.brandRel) return p.brandRel.displayName || p.brandRel.name;
  return p.brand;
};

/** Get brand image URL from a product */
const getProductBrandImage = (p: Product): string | null => {
  return resolveImageUrl(p.brandRel?.imageUrl);
};

// ── Image Upload Field ─────────────────────────────────────────────────────────

interface ImageUploadFieldProps {
  preview: string | null;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  fileRef: React.RefObject<HTMLInputElement>;
  error?: string;
  label?: string;
}
const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  preview, onSelect, onClear, fileRef, error, label = 'Brand Image',
}) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-2">
      {label} <span className="text-gray-400 font-normal">(optional, max 2 MB)</span>
    </label>
    {preview ? (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-blue-200 bg-gray-100">
        <img src={preview} alt="Preview" className="w-full h-full object-contain" />
        <button
          type="button"
          onClick={onClear}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
          aria-label="Remove image"
        >
          <X size={12} />
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-500"
      >
        <Upload size={20} />
        <span className="text-xs">Click to upload image</span>
        <span className="text-xs opacity-70">JPEG · PNG · WebP</span>
      </button>
    )}
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={onSelect}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const useImageUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Only JPEG, PNG, or WebP allowed.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const onClear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError('');
    if (ref.current) ref.current.value = '';
  }, []);

  return { file, preview, error, setError, ref, onSelect, onClear, reset: onClear };
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const InventoryPage: React.FC = () => {
  const store = useStore();

  // ── Brands data ──────────────────────────────────────────────────────────────
  const [brands, setBrands] = useState<Brand[]>([]);

  const loadBrands = async () => {
    try { setBrands(await brandsService.list()); }
    catch { store.addNotification('error', 'Failed to load brands'); }
  };

  // ── Stock modals ─────────────────────────────────────────────────────────────
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [selectedInventoryBrand, setSelectedInventoryBrand] = useState('');

  const [addStockForm, setAddStockForm] = useState({
    productId: '', quantity: '', buyPrice: '', salePrice: '',
    batchNumber: '', expiryDate: '', supplier: '',
  });
  const [addStockErrors, setAddStockErrors] = useState<Record<string, string>>({});
  const [addStockGenericError, setAddStockGenericError] = useState('');
  const [addStockLoading, setAddStockLoading] = useState(false);

  const [adjustStockForm, setAdjustStockForm] = useState({
    reason: 'damage' as 'damage' | 'theft' | 'manual-correction',
    quantity: '', notes: '',
  });
  const [adjustStockErrors, setAdjustStockErrors] = useState<Record<string, string>>({});
  const [adjustStockGenericError, setAdjustStockGenericError] = useState('');
  const [adjustStockLoading, setAdjustStockLoading] = useState(false);

  // ── Post-create stock flow ─────────────────────────────────────────────────
  const [postCreateProductId, setPostCreateProductId] = useState<string | null>(null);
  const [postCreateProductLabel, setPostCreateProductLabel] = useState('');

  // ── Stock batch tree expand state ─────────────────────────────────────────
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const toggleBrand = (key: string) =>
    setExpandedBrands(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  // ── Adjust sign state (positive = add, negative = deduct) ────────────────────
  const [adjustmentSign, setAdjustmentSign] = useState<1 | -1>(1);

  // ── Add Product modal ─────────────────────────────────────────────────────────
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [addProductBrandMode, setAddProductBrandMode] = useState<'existing' | 'new'>('existing');
  const [addProductSelectedBrandId, setAddProductSelectedBrandId] = useState('');
  const [addProductNewBrandName, setAddProductNewBrandName] = useState('');
  const [addProductVariant, setAddProductVariant] = useState('');
  const [addProductDescription, setAddProductDescription] = useState('');
  const [addProductErrors, setAddProductErrors] = useState<Record<string, string>>({});
  const [addProductLoading, setAddProductLoading] = useState(false);
  const addBrandImage = useImageUpload();

  const selectedBrand = brands.find(b => b.id === addProductSelectedBrandId) ?? null;

  // ── Edit Product modal (Bug 2 fix: brand is read-only here) ───────────────────
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editVariant, setEditVariant] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editLoading, setEditLoading] = useState(false);

  // ── Edit Brand modal ──────────────────────────────────────────────────────────
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editBrandDisplayName, setEditBrandDisplayName] = useState('');
  const [editBrandErrors, setEditBrandErrors] = useState<Record<string, string>>({});
  const [editBrandLoading, setEditBrandLoading] = useState(false);
  const editBrandImage = useImageUpload();

  // ── Delete product ────────────────────────────────────────────────────────────
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── RGB management ────────────────────────────────────────────────────────────
  const [isRgbPanelOpen, setIsRgbPanelOpen] = useState(false);
  const [rgbItems, setRgbItems] = useState<RGBItem[]>([]);
  const [rgbLoading, setRgbLoading] = useState(false);
  const [isAddRgbModalOpen, setIsAddRgbModalOpen] = useState(false);
  const [rgbForm, setRgbForm] = useState({ name: '', stockQuantity: '', linkedProductId: '' });
  const [rgbFormErrors, setRgbFormErrors] = useState<{ name?: string; stockQuantity?: string }>({});
  const [rgbFormLoading, setRgbFormLoading] = useState(false);
  const [rgbStockInputs, setRgbStockInputs] = useState<Record<string, string>>({});
  const [deletingRgbItem, setDeletingRgbItem] = useState<RGBItem | null>(null);
  const [deleteRgbLoading, setDeleteRgbLoading] = useState(false);
  const [deleteRgbError, setDeleteRgbError] = useState('');

  // Standalone RGB Return state for Inventory page
  const [returnRowKey, setReturnRowKey] = useState<string | null>(null);
  const [returnQtyInput, setReturnQtyInput] = useState<number>(0);
  const [submittingInventoryReturn, setSubmittingInventoryReturn] = useState(false);
  const [rgbTransactions, setRgbTransactions] = useState<RGBTransactionRecord[]>([]);

  // ── Store data ────────────────────────────────────────────────────────────────
  const products = store.products;
  const stockBatches = store.stockBatches;

  useEffect(() => {
    store.fetchInventory();
    store.fetchProducts();
    loadBrands();
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────────
  const inventoryBrands = useMemo(() => {
    const map = new Map<string, { brand: Brand | null; products: Product[] }>();
    for (const p of products) {
      const key = p.brandRel?.name ?? getBrandName(p).toLowerCase();
      if (!map.has(key)) map.set(key, { brand: p.brandRel ?? null, products: [] });
      map.get(key)!.products.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const selectedInventoryVariants = selectedInventoryBrand
    ? products.filter(p => (p.brandRel?.name ?? getBrandName(p).toLowerCase()) === selectedInventoryBrand)
    : [];

  const totalStockValue = stockBatches.reduce((s, b) => s + b.quantity * b.salePrice, 0);
  const totalBuyValue   = stockBatches.reduce((s, b) => s + b.quantity * b.buyPrice, 0);

  // ── RGB Computed Metrics ─────────────────────────────────────────────────────
  const totalWarehouseCrates = useMemo(() => {
    return rgbItems.reduce((acc, item) => acc + (item.stockQuantity || 0), 0);
  }, [rgbItems]);

  const totalCratesOut = useMemo(() => {
    return store.retailers.reduce((acc, r) => {
      const rTotal = r.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;
      return acc + rTotal;
    }, 0);
  }, [store.retailers]);

  const retailerBalancesList = useMemo(() => {
    const list: { retailerId: string; rgbItemId: string; retailerName: string; shopName: string; itemName: string; balance: number; updatedAt: Date | string }[] = [];
    store.retailers.forEach((r) => {
      r.rgbBalances?.forEach((b) => {
        if (b.balance > 0) {
          const item = b.rgbItem || rgbItems.find((i) => i.id === b.rgbItemId);
          list.push({
            retailerId: r.id,
            rgbItemId: b.rgbItemId,
            retailerName: r.ownerName,
            shopName: r.shopName,
            itemName: item?.name || 'RGB Crate',
            balance: b.balance,
            updatedAt: b.updatedAt,
          });
        }
      });
    });
    return list;
  }, [store.retailers, rgbItems]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getProductLabel = (productId: string) => {
    const p = products.find(x => x.id === productId);
    return p ? `${getBrandName(p)} ${p.variant}` : 'Unknown';
  };

  const openAddStockForVariant = (productId: string) => {
    setAddStockForm(f => ({ ...f, productId }));
    setIsAddStockModalOpen(true);
  };

  const checkExpiryStatus = (expiryDateStr: any) => {
    const days = Math.ceil((new Date(expiryDateStr).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return { status: 'expired', label: 'Expired' };
    if (days < 30) return { status: 'warning', label: `${days}d left` };
    return { status: 'ok', label: 'OK' };
  };

  // ── Create Product ────────────────────────────────────────────────────────────
  const handleCreateProduct = async () => {
    const errs: Record<string, string> = {};
    if (addProductBrandMode === 'existing' && !addProductSelectedBrandId) errs.brand = 'Select a brand.';
    if (addProductBrandMode === 'new' && !addProductNewBrandName.trim()) errs.brand = 'Brand name is required.';
    if (!addProductVariant.trim()) errs.variant = 'Variant is required.';
    if (Object.keys(errs).length > 0) { setAddProductErrors(errs); return; }
    setAddProductErrors({});
    setAddProductLoading(true);

    try {
      let brandId = addProductSelectedBrandId;

      if (addProductBrandMode === 'new') {
        const newBrand = await brandsService.create(
          addProductNewBrandName.trim().toLowerCase(),
          addProductNewBrandName.trim(),
          addBrandImage.file ?? undefined
        );
        brandId = newBrand.id;
        await loadBrands();
      }

      await productsService.create({
        brandId,
        variant: addProductVariant.trim().toLowerCase(),
        description: addProductDescription.trim() || undefined,
      });

      store.fetchProducts();
      store.addNotification('success', `Variant "${addProductVariant}" created`);

      // Capture product info for post-create stock flow
      const createdVariantLabel = `${addProductBrandMode === 'new' ? addProductNewBrandName.trim() : (selectedBrand?.displayName ?? 'Product')} ${addProductVariant.trim()}`;

      // Reset form
      setAddProductSelectedBrandId('');
      setAddProductNewBrandName('');
      setAddProductVariant('');
      setAddProductDescription('');
      addBrandImage.reset();
      setIsAddProductModalOpen(false);

      // Find the just-created product (latest with matching variant)
      // We use a small delay so fetchProducts resolves first
      setTimeout(async () => {
        const refreshedProducts = await productsService.getAll();
        const created = refreshedProducts.find(
          p => p.variant === addProductVariant.trim().toLowerCase()
            && (p.brandId === brandId || p.brandRel?.id === brandId)
        );
        if (created) {
          setPostCreateProductId(created.id);
          setPostCreateProductLabel(createdVariantLabel);
        }
      }, 300);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create product.';
      setAddProductErrors({ brand: msg });
    } finally {
      setAddProductLoading(false);
    }
  };

  // ── Open Edit Modal ───────────────────────────────────────────────────────────
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditVariant(product.variant);
    setEditDescription(product.description || '');
    setEditErrors({});
  };

  // ── Save Edit (Bug 2 fix: only variant/description — NO brand) ────────
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    const errs: Record<string, string> = {};
    if (!editVariant.trim()) errs.variant = 'Variant is required.';
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditErrors({});
    setEditLoading(true);
    try {
      await productsService.update(editingProduct.id, {
        variant: editVariant.trim().toLowerCase(),
        description: editDescription.trim() || undefined,
      });
      store.fetchProducts();
      store.addNotification('success', 'Product updated');
      setEditingProduct(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update.';
      setEditErrors({ variant: msg });
    } finally {
      setEditLoading(false);
    }
  };

  // ── Open Edit Brand Modal ─────────────────────────────────────────────────────
  const openEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setEditBrandDisplayName(brand.displayName);
    setEditBrandErrors({});
    editBrandImage.reset();
  };

  // ── Save Edit Brand ───────────────────────────────────────────────────────────
  const handleSaveEditBrand = async () => {
    if (!editingBrand) return;
    setEditBrandErrors({});
    setEditBrandLoading(true);
    try {
      await brandsService.update(
        editingBrand.id,
        editBrandDisplayName.trim() || undefined,
        editBrandImage.file ?? undefined
      );
      await loadBrands();
      store.fetchProducts();  // products will get updated brand.imageUrl on next fetch
      store.addNotification('success', `Brand "${editBrandDisplayName}" updated`);
      setEditingBrand(null);
      editBrandImage.reset();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update brand.';
      setEditBrandErrors({ displayName: msg });
    } finally {
      setEditBrandLoading(false);
    }
  };

  // ── Delete (soft) ─────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await productsService.softDelete(deletingProduct.id);
      store.fetchProducts();
      store.addNotification('success', `"${getBrandName(deletingProduct)} ${deletingProduct.variant}" hidden from inventory.`);
      setDeletingProduct(null);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete product.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Add Stock ─────────────────────────────────────────────────────────────────
  const handleAddStock = async () => {
    // Client-side inline validation
    const errs: Record<string, string> = {};
    if (!addStockForm.productId) errs.productId = 'Select a product.';
    if (!addStockForm.quantity || isNaN(parseFloat(addStockForm.quantity)) || parseFloat(addStockForm.quantity) <= 0)
      errs.quantity = 'Quantity must be a positive number.';
    if (!addStockForm.buyPrice || isNaN(parseFloat(addStockForm.buyPrice)) || parseFloat(addStockForm.buyPrice) <= 0)
      errs.buyPrice = 'Buy price must be a positive number.';
    if (!addStockForm.salePrice || isNaN(parseFloat(addStockForm.salePrice)) || parseFloat(addStockForm.salePrice) <= 0)
      errs.salePrice = 'Sale price must be a positive number.';
    if (!addStockForm.batchNumber.trim()) errs.batchNumber = 'Batch number is required.';
    if (!addStockForm.expiryDate) errs.expiryDate = 'Expiry date is required.';
    if (Object.keys(errs).length > 0) {
      setAddStockErrors(errs);
      setAddStockGenericError('');
      return;
    }
    setAddStockErrors({});
    setAddStockGenericError('');
    setAddStockLoading(true);
    try {
      await inventoryService.addBatch({
        productId: addStockForm.productId,
        quantity: parseFloat(addStockForm.quantity),
        buyPrice: parseFloat(addStockForm.buyPrice),
        salePrice: parseFloat(addStockForm.salePrice),
        batchNumber: addStockForm.batchNumber.trim(),
        expiryDate: new Date(addStockForm.expiryDate),
        supplier: addStockForm.supplier,
      });
      store.fetchInventory();
      setAddStockForm({ productId: '', quantity: '', buyPrice: '', salePrice: '', batchNumber: '', expiryDate: '', supplier: '' });
      setAddStockErrors({});
      setAddStockGenericError('');
      setIsAddStockModalOpen(false);
      setPostCreateProductId(null);
      store.addNotification('success', 'Stock added successfully');
    } catch (err: any) {
      // Parse backend Zod fieldErrors if present
      const backendErrors = err.response?.data?.errors;
      if (backendErrors && typeof backendErrors === 'object') {
        const fieldErrs: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(backendErrors)) {
          fieldErrs[key] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setAddStockErrors(fieldErrs);
        setAddStockGenericError(err.response?.data?.message || '');
      } else {
        setAddStockGenericError(err.response?.data?.message || err.message || 'Failed to add stock.');
      }
    } finally {
      setAddStockLoading(false);
    }
  };

  // ── Adjust Stock ──────────────────────────────────────────────────────────────
  const handleAdjustStock = async () => {
    if (!selectedBatch) return;
    // Client-side inline validation
    const errs: Record<string, string> = {};
    if (!adjustStockForm.quantity || isNaN(parseFloat(adjustStockForm.quantity)) || parseFloat(adjustStockForm.quantity) === 0)
      errs.quantity = 'Enter a non-zero quantity.';
    if (!adjustStockForm.notes || adjustStockForm.notes.trim().length < 3)
      errs.notes = 'Notes must be at least 3 characters.';
    if (Object.keys(errs).length > 0) {
      setAdjustStockErrors(errs);
      setAdjustStockGenericError('');
      return;
    }
    setAdjustStockErrors({});
    setAdjustStockGenericError('');
    setAdjustStockLoading(true);

    // Map UI reason values to Prisma AdjustmentReason enum
    // Prisma enum: damage | theft | manual_correction (underscore)
    const reasonMap: Record<string, string> = {
      'damage': 'damage',
      'theft': 'theft',
      'manual-correction': 'manual_correction',
    };
    const signedQty = Math.round(Math.abs(parseFloat(adjustStockForm.quantity))) * adjustmentSign;
    const mappedReason = reasonMap[adjustStockForm.reason] ?? adjustStockForm.reason;
    const productLabel = getProductLabel(selectedBatch.productId);
    const beforeQty = selectedBatch.quantity;

    try {
      await inventoryService.adjustStock(selectedBatch.id, {
        quantity: signedQty,
        reason: mappedReason,
        notes: adjustStockForm.notes.trim(),
      });
      store.fetchInventory();
      const afterQty = beforeQty + signedQty;
      store.addNotification(
        'success',
        `Stock updated: ${productLabel} — ${beforeQty} → ${afterQty} units`
      );
      setIsAdjustStockModalOpen(false);
      setAdjustStockForm({ reason: 'damage', quantity: '', notes: '' });
      setAdjustmentSign(1);
      setAdjustStockErrors({});
      setAdjustStockGenericError('');
    } catch (err: any) {
      const backendErrors = err.response?.data?.errors;
      if (backendErrors && typeof backendErrors === 'object') {
        const fieldErrs: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(backendErrors)) {
          fieldErrs[key] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setAdjustStockErrors(fieldErrs);
        setAdjustStockGenericError(err.response?.data?.message || '');
      } else {
        setAdjustStockGenericError(err.response?.data?.message || err.message || 'Failed to adjust stock.');
      }
    } finally {
    setAdjustStockLoading(false);
    }
  };

  // ── RGB Handlers ──────────────────────────────────────────────────────────────
  const loadRGBItems = async () => {
    setRgbLoading(true);
    try {
      const [items, txResult] = await Promise.all([
        rgbService.getAll(),
        rgbService.getTransactions(),
      ]);
      setRgbItems(items);
      setRgbTransactions(txResult.transactions || []);
      store.fetchRetailers();
    }
    catch { store.addNotification('error', 'Failed to load RGB items'); }
    finally { setRgbLoading(false); }
  };

  const handleCreateRGBType = async () => {
    const errs: typeof rgbFormErrors = {};
    if (!rgbForm.name.trim()) errs.name = 'Name is required.';
    const qty = parseInt(rgbForm.stockQuantity || '0');
    if (isNaN(qty) || qty < 0) errs.stockQuantity = 'Quantity must be 0 or more.';
    if (Object.keys(errs).length > 0) { setRgbFormErrors(errs); return; }
    setRgbFormErrors({});
    setRgbFormLoading(true);
    try {
      await rgbService.create({
        name: rgbForm.name.trim(),
        stockQuantity: qty,
      });
      store.addNotification('success', `RGB "${rgbForm.name}" created`);
      setRgbForm({ name: '', stockQuantity: '', linkedProductId: '' });
      setIsAddRgbModalOpen(false);
      loadRGBItems();
    } catch (err: any) {
      setRgbFormErrors({ name: err.response?.data?.message || 'Failed to create RGB item' });
    } finally {
      setRgbFormLoading(false);
    }
  };

  const handleRGBSetAbsolute = async (id: string, valueStr: string) => {
    const parsed = parseInt(valueStr, 10);
    const newQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setRgbStockInputs((prev) => ({ ...prev, [id]: String(newQty) }));
    try {
      const updated = await rgbService.update(id, { stockQuantity: newQty });
      setRgbItems((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setRgbStockInputs((prev) => ({ ...prev, [id]: String(updated.stockQuantity) }));
    } catch {
      store.addNotification('error', 'Failed to update RGB stock');
      setRgbItems((prev) => {
        const item = prev.find((v) => v.id === id);
        if (item) setRgbStockInputs((p) => ({ ...p, [id]: String(item.stockQuantity) }));
        return prev;
      });
    }
  };

  const handleRGBAdjust = async (id: string, currentStock: number, delta: number) => {
    const newQty = Math.max(0, currentStock + delta);
    try {
      const updated = await rgbService.update(id, { stockQuantity: newQty });
      setRgbItems(prev => prev.map(v => v.id === id ? updated : v));
    } catch {
      store.addNotification('error', 'Failed to adjust RGB stock');
    }
  };

  const handleConfirmDeleteRgb = async () => {
    if (!deletingRgbItem) return;
    setDeleteRgbLoading(true);
    setDeleteRgbError('');
    try {
      await rgbService.delete(deletingRgbItem.id);
      setRgbItems(prev => prev.filter(v => v.id !== deletingRgbItem.id));
      store.addNotification('success', `"${deletingRgbItem.name}" removed`);
      setDeletingRgbItem(null);
    } catch (err: any) {
      setDeleteRgbError(err.response?.data?.message || 'Failed to delete RGB item.');
    } finally {
      setDeleteRgbLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isRgbPanelOpen ? 'RGB Management' : 'Inventory Management'}
          </h1>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            {!isRgbPanelOpen ? (
              <>
                <Button onClick={() => { setIsAddProductModalOpen(true); setAddProductBrandMode('existing'); }} className="text-xs sm:text-sm py-2 px-3">
                  <Plus size={16} className="mr-1.5" /> New Variant
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs sm:text-sm py-2 px-3"
                  onClick={() => {
                    if (products.length === 0) {
                      store.addNotification('info', 'Create a product first before adding stock');
                    } else {
                      setIsAddStockModalOpen(true);
                    }
                  }}
                >
                  <Plus size={16} className="mr-1.5" /> Add Stock
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs sm:text-sm py-2 px-3"
                  onClick={() => { setIsRgbPanelOpen(true); loadRGBItems(); }}
                >
                  📦 RGB Management
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                className="text-xs sm:text-sm py-2 px-3"
                onClick={() => setIsRgbPanelOpen(false)}
              >
                ← Back to Inventory
              </Button>
            )}
          </div>
        </div>

        {isRgbPanelOpen ? (
          /* ── RGB VIEW ONLY ────────────────────────────────────────────────────────── */
          <div>
            {/* RGB Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Crates in Warehouse</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalWarehouseCrates.toLocaleString()}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Package size={20} />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Crates Out with Retailers</p>
                  <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{totalCratesOut.toLocaleString()}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Boxes size={20} />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">RGB Bottle Types</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{rgbItems.length}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                  <TrendingUp size={20} />
                </div>
              </div>
            </div>

            {/* RGB Stock Management Panel */}
            <Card title="📦 RGB (Empty Crates) — Stock Management" className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">
                  Track returnable glass bottle (crate) stock per type. Data is stored in the database.
                </p>
                <Button size="sm" onClick={() => setIsAddRgbModalOpen(true)}>
                  <Plus size={14} className="mr-1" /> Add Type
                </Button>
              </div>
              {rgbLoading ? (
                <div className="py-8 text-center text-sm text-gray-400">Loading RGB stock…</div>
              ) : rgbItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500 mb-3">No RGB types yet.</p>
                  <Button size="sm" onClick={() => setIsAddRgbModalOpen(true)}>
                    <Plus size={14} className="mr-1" /> Add First Type
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {rgbItems.map((item) => {
                    return (
                      <div
                        key={item.id}
                        className="bg-white border-2 border-slate-100 hover:border-amber-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                              📦
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{item.name}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Updated {new Date(item.lastUpdated).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setDeletingRgbItem(item); setDeleteRgbError(''); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete RGB Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Warehouse Stock</span>
                            <span className="text-lg font-black text-slate-800">{item.stockQuantity} <span className="text-xs font-normal text-slate-500">crates</span></span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRGBAdjust(item.id, item.stockQuantity, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold transition-all shadow-2xs"
                              title="Decrease 1"
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={rgbStockInputs[item.id] ?? String(item.stockQuantity)}
                              onFocus={(e) => {
                                setRgbStockInputs((prev) => ({ ...prev, [item.id]: String(item.stockQuantity) }));
                                e.target.select();
                              }}
                              onChange={(e) =>
                                setRgbStockInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              onBlur={(e) => handleRGBSetAbsolute(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-11 text-center font-extrabold text-slate-900 text-sm border border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none bg-white py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => handleRGBAdjust(item.id, item.stockQuantity, 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold transition-all shadow-2xs"
                              title="Increase 1"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Retailer Balances Table */}
            <Card title="Retailer RGB Balances">
              {retailerBalancesList.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No outstanding RGB crate balances with any retailer.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-600">
                        <th className="text-left py-3 px-4">Retailer</th>
                        <th className="text-left py-3 px-4">RGB Type</th>
                        <th className="text-right py-3 px-4">Quantity Owed</th>
                        <th className="text-right py-3 px-4">Last Transaction</th>
                        <th className="text-center py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retailerBalancesList.map((row, idx) => {
                        const key = `${row.retailerId}_${row.rgbItemId}`;
                        const isOpen = returnRowKey === key;

                        return (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-gray-900 block">{row.shopName}</span>
                              <span className="text-xs text-gray-500">{row.retailerName}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-700">{row.itemName}</td>
                            <td className="py-3 px-4 text-right font-bold text-amber-600">{row.balance} crates</td>
                            <td className="py-3 px-4 text-right text-xs text-gray-500">
                              {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isOpen ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="flex items-center border border-green-200 bg-green-50 rounded-lg overflow-hidden h-7">
                                    <button
                                      type="button"
                                      onClick={() => setReturnQtyInput(prev => Math.max(0, prev - 1))}
                                      disabled={returnQtyInput <= 0}
                                      className="w-6 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white font-bold flex items-center justify-center transition-colors"
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max={row.balance}
                                      value={returnQtyInput === 0 ? '' : returnQtyInput}
                                      placeholder="0"
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const parsed = parseInt(e.target.value) || 0;
                                        setReturnQtyInput(Math.min(row.balance, Math.max(0, parsed)));
                                      }}
                                      className="w-10 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 text-green-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setReturnQtyInput(prev => Math.min(row.balance, prev + 1))}
                                      disabled={returnQtyInput >= row.balance}
                                      className="w-6 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white font-bold flex items-center justify-center transition-colors"
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                  <Button
                                    size="sm"
                                    loading={submittingInventoryReturn}
                                    disabled={returnQtyInput <= 0}
                                    onClick={async () => {
                                      setSubmittingInventoryReturn(true);
                                      try {
                                        await rgbService.returnStandalone(row.rgbItemId, { retailerId: row.retailerId, quantity: returnQtyInput });
                                        store.addNotification('success', 'Crates return recorded');
                                        setReturnRowKey(null);
                                        setReturnQtyInput(0);
                                        loadRGBItems();
                                        store.fetchRetailers();
                                      } catch (err: any) {
                                        store.addNotification('error', err.response?.data?.message || 'Failed to record return');
                                      } finally {
                                        setSubmittingInventoryReturn(false);
                                      }
                                    }}
                                  >
                                    Confirm
                                  </Button>
                                  <button
                                    onClick={() => setReturnRowKey(null)}
                                    className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setReturnRowKey(key);
                                    setReturnQtyInput(1);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors inline-flex items-center gap-1"
                                >
                                  <RotateCcw size={11} />
                                  RGB Return
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* RGB Transaction History */}
            <Card title="RGB Transaction History">
              {rgbTransactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No RGB transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-600">
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-left py-3 px-4">Retailer</th>
                        <th className="text-left py-3 px-4">RGB Item</th>
                        <th className="text-center py-3 px-4">Type</th>
                        <th className="text-right py-3 px-4">Quantity</th>
                        <th className="text-left py-3 px-4">Recorded By</th>
                        <th className="text-center py-3 px-4">Bill Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rgbTransactions.map((tx) => {
                        const isIssue = tx.type?.toLowerCase() === 'issue';
                        return (
                          <tr key={tx.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-900">
                              {tx.retailerName}
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-700">
                              {tx.itemName}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isIssue ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isIssue ? 'Given ↓' : 'Returned ↑'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">
                              {tx.quantity} crates
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-600">
                              {tx.workerName || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center text-xs">
                              {tx.saleId ? (
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 font-mono rounded-md font-medium border border-blue-200">
                                  Linked to Sale
                                </span>
                              ) : (
                                <span className="text-gray-400 font-normal">Standalone</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        ) : (
          /* ── NORMAL INVENTORY VIEW ─────────────────────────────────────────────────── */
          <div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card><p className="text-gray-600 text-sm">Total PET Units</p><p className="text-2xl font-bold mt-2">{stockBatches.reduce((s, b) => s + b.quantity, 0)}</p></Card>
          <Card><p className="text-gray-600 text-sm">Products</p><p className="text-2xl font-bold mt-2">{products.length}</p></Card>
          <Card><p className="text-gray-600 text-sm">Stock Cost Value</p><p className="text-2xl font-bold mt-2">₨{totalBuyValue.toFixed(0)}</p></Card>
          <Card><p className="text-gray-600 text-sm">Retail Value</p><p className="text-2xl font-bold mt-2">₨{totalStockValue.toFixed(0)}</p></Card>
        </div>

        {/* ── Products (brand grid → variant cards) ─────────────────────────── */}
        <Card title="Products" className="mb-6">
          {!selectedInventoryBrand ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {inventoryBrands.map(([brandKey, { brand, products: brandProducts }]) => {
                const imgUrl = brand?.imageUrl ? resolveImageUrl(brand.imageUrl)
                  : getProductBrandImage(brandProducts[0]);
                return (
                  <button
                    key={brandKey}
                    onClick={() => setSelectedInventoryBrand(brandKey)}
                    className="group flex flex-col items-center p-1.5 sm:p-2 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all duration-200 bg-white"
                  >
                    <div className="w-full h-16 sm:h-24 rounded-lg overflow-hidden mb-1 sm:mb-1.5 bg-gray-100 flex items-center justify-center">
                      {imgUrl ? (
                        <img src={imgUrl} alt={brandKey} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span className="text-2xl sm:text-3xl">🥤</span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-[11px] sm:text-xs text-center line-clamp-1">{brand?.displayName ?? brandKey}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">{brandProducts.length} variant{brandProducts.length !== 1 ? 's' : ''}</p>
                  </button>
                );
              })}
              {inventoryBrands.length === 0 && !store.isLoading && (
                <p className="col-span-full text-center text-sm text-gray-400 py-8">No products yet</p>
              )}
            </div>
          ) : (
            <div>
              {/* Back + Edit Brand header */}
              {(() => {
                const entry = inventoryBrands.find(([k]) => k === selectedInventoryBrand);
                const brand = entry?.[1].brand ?? null;
                const brandImgUrl = brand?.imageUrl ? resolveImageUrl(brand.imageUrl) : null;
                return (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {brandImgUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                          <img src={brandImgUrl} alt={selectedInventoryBrand} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg capitalize">{brand?.displayName ?? selectedInventoryBrand} — Variants</h3>
                        <p className="text-xs text-gray-500">{selectedInventoryVariants.length} variant{selectedInventoryVariants.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {brand && (
                        <button
                          onClick={() => openEditBrand(brand)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                        >
                          <ImageIcon size={12} /> Edit Brand Image
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedInventoryBrand('')}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        ← Back
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {selectedInventoryVariants.map((product) => {
                  const imgUrl = getProductBrandImage(product);
                  const totalStock = stockBatches.filter(b => b.productId === product.id).reduce((s, b) => s + b.quantity, 0);
                  return (
                    <div key={product.id} className="border border-gray-200 rounded-xl p-2.5 bg-gray-50 flex items-start gap-2.5">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center border border-gray-100">
                        {imgUrl ? (
                          <img src={imgUrl} alt={getBrandName(product)} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-xs truncate">{getBrandName(product)} {product.variant}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 capitalize">{product.category}</p>
                        <p className="text-xs font-semibold text-blue-600 mt-0.5">Stock: {totalStock} units</p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <Button size="sm" onClick={() => openAddStockForVariant(product.id)} className="text-xs py-1 px-2">Add Stock</Button>
                          <button
                            onClick={() => openEditModal(product)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            onClick={() => { setDeleteError(''); setDeletingProduct(product); }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* ── Stock Batches — Collapsible Brand → Variant → Batch Tree ─────── */}
        <Card title="Stock Batches">
          {stockBatches.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No stock batches yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {inventoryBrands.map(([brandKey, { brand, products: brandProds }]) => {
                const brandBatches = stockBatches.filter(b =>
                  brandProds.some(p => p.id === b.productId)
                );
                if (brandBatches.length === 0) return null;
                const brandTotalQty = brandBatches.reduce((s, b) => s + b.quantity, 0);
                const isBrandOpen = expandedBrands.has(brandKey);

                return (
                  <div key={brandKey}>
                    {/* Brand header row */}
                    <button
                      onClick={() => toggleBrand(brandKey)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-gray-400">
                        {isBrandOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      {brand?.imageUrl ? (
                        <img src={resolveImageUrl(brand.imageUrl)!} alt={brandKey}
                          className="w-7 h-7 rounded object-cover border border-gray-200 flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">🥤</span>
                      )}
                      <span className="font-bold text-gray-900 flex-1">
                        {brand?.displayName ?? brandKey}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        {brandTotalQty} units total
                      </span>
                    </button>

                    {/* 2-Level: Brand -> Batches Table (Immediate variant + batch details) */}
                    {isBrandOpen && (
                      <div className="bg-gray-50/50 p-3 border-t border-gray-100 overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                              <th className="py-2 px-3">Variant</th>
                              <th className="py-2 px-3">Batch #</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3 text-right">Buy Price</th>
                              <th className="py-2 px-3 text-right">Sale Price</th>
                              <th className="py-2 px-3">Expiry</th>
                              <th className="py-2 px-3">Supplier</th>
                              <th className="py-2 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {brandProds.flatMap((product) => {
                              const variantBatches = stockBatches.filter(b => b.productId === product.id);
                              return variantBatches.map((batch) => {
                                const exp = checkExpiryStatus(batch.expiryDate);
                                const showBadge = exp.status !== 'ok';
                                const supplierName = (batch as any).supplier || '—';

                                return (
                                  <tr key={batch.id} className="hover:bg-white transition-colors bg-white/60">
                                    <td className="py-2.5 px-3 font-semibold text-gray-900 capitalize whitespace-nowrap">
                                      {product.variant}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-gray-600 whitespace-nowrap">
                                      {batch.batchNumber}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                      {batch.quantity}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-600 whitespace-nowrap">
                                      ₨{Number(batch.buyPrice).toFixed(0)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 whitespace-nowrap">
                                      ₨{Number(batch.salePrice).toFixed(0)}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={showBadge ? (exp.status === 'expired' ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold') : 'text-gray-600'}>
                                        {new Date(batch.expiryDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                      {showBadge && (
                                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                          exp.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {exp.label}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-gray-500 max-w-[120px] truncate" title={supplierName}>
                                      {supplierName}
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                      <button
                                        onClick={() => {
                                          setSelectedBatch(batch);
                                          setAdjustStockForm({ reason: 'damage', quantity: '', notes: '' });
                                          setAdjustmentSign(1);
                                          setAdjustStockErrors({});
                                          setAdjustStockGenericError('');
                                          setIsAdjustStockModalOpen(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                                      >
                                        Adjust
                                      </button>
                                    </td>
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
    )}


        {/* ── Post-Create Stock Prompt ───────────────────────────────────────── */}
        <Modal
          isOpen={!!postCreateProductId}
          title="Product Created!"
          onClose={() => setPostCreateProductId(null)}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setPostCreateProductId(null)}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors"
              >
                Skip for Now
              </button>
              <button
                onClick={() => {
                  setAddStockForm(f => ({ ...f, productId: postCreateProductId! }));
                  setAddStockErrors({});
                  setAddStockGenericError('');
                  setPostCreateProductId(null);
                  setIsAddStockModalOpen(true);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add Stock Now
              </button>
            </>
          }
        >
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Package size={28} className="text-green-600" />
            </div>
            <p className="text-sm text-gray-700">
              <strong>{postCreateProductLabel}</strong> has been created successfully.
            </p>
            <p className="text-sm text-gray-500">
              Would you like to add initial stock for this product now?
            </p>
          </div>
        </Modal>

        {/* ── Add Stock Modal ────────────────────────────────────────────────── */}
        <Modal isOpen={isAddStockModalOpen} title="Add Stock"
          onClose={() => { setIsAddStockModalOpen(false); setAddStockErrors({}); setAddStockGenericError(''); }}
          footer={
            <>
              <button onClick={() => { setIsAddStockModalOpen(false); setAddStockErrors({}); setAddStockGenericError(''); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddStock} disabled={addStockLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {addStockLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding…</> : 'Add Stock'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Generic error banner */}
            {addStockGenericError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
                <span>{addStockGenericError}</span>
              </div>
            )}
            <Select label="Product *" value={addStockForm.productId}
              onChange={e => { setAddStockForm({ ...addStockForm, productId: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.productId; return n; }); }}
              options={[{ value: '', label: 'Select product...' }, ...products.map(p => ({ value: p.id, label: `${getBrandName(p)} — ${p.variant}` }))]}
              error={addStockErrors.productId}
            />
            <Input label="Quantity *" type="number" value={addStockForm.quantity}
              onChange={e => { setAddStockForm({ ...addStockForm, quantity: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.quantity; return n; }); }}
              placeholder="0" error={addStockErrors.quantity}
            />
            <Input label="Buy Price per Unit *" type="number" value={addStockForm.buyPrice}
              onChange={e => { setAddStockForm({ ...addStockForm, buyPrice: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.buyPrice; return n; }); }}
              placeholder="0" error={addStockErrors.buyPrice}
            />
            <Input label="Sale Price per Unit *" type="number" value={addStockForm.salePrice}
              onChange={e => { setAddStockForm({ ...addStockForm, salePrice: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.salePrice; return n; }); }}
              placeholder="0" error={addStockErrors.salePrice}
            />
            <Input label="Batch Number *" value={addStockForm.batchNumber}
              onChange={e => { setAddStockForm({ ...addStockForm, batchNumber: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.batchNumber; return n; }); }}
              placeholder="e.g. BATCH001" error={addStockErrors.batchNumber}
            />
            <Input label="Expiry Date *" type="date" value={addStockForm.expiryDate}
              onChange={e => { setAddStockForm({ ...addStockForm, expiryDate: e.target.value }); setAddStockErrors(prev => { const n = { ...prev }; delete n.expiryDate; return n; }); }}
              error={addStockErrors.expiryDate}
            />
            <Input label="Supplier" value={addStockForm.supplier}
              onChange={e => setAddStockForm({ ...addStockForm, supplier: e.target.value })}
              placeholder="Supplier name (optional)"
            />
          </div>
        </Modal>

        {/* ── Adjust Stock Modal ─────────────────────────────────────────────── */}
        <Modal isOpen={isAdjustStockModalOpen} title="Adjust Stock"
          onClose={() => { setIsAdjustStockModalOpen(false); setAdjustStockErrors({}); setAdjustStockGenericError(''); }}
          footer={
            <>
              <button onClick={() => { setIsAdjustStockModalOpen(false); setAdjustStockErrors({}); setAdjustStockGenericError(''); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdjustStock} disabled={adjustStockLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {adjustStockLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adjusting…</> : 'Apply Adjustment'}
              </button>
            </>
          }
        >
          {selectedBatch && (
            <div className="space-y-4">
              {/* Generic error banner */}
              {adjustStockGenericError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
                  <span>{adjustStockGenericError}</span>
                </div>
              )}
              {/* Info block */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800">{getProductLabel(selectedBatch.productId)}</p>
                <p className="text-xs text-gray-500">Batch: <span className="font-mono">{selectedBatch.batchNumber}</span></p>
                <p className="text-xs text-gray-500">Current stock: <span className="font-bold text-blue-700">{selectedBatch.quantity} units</span></p>
              </div>

              {/* +/− Sign toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Operation *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustmentSign(1)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      adjustmentSign === 1 ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:border-green-400'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    onClick={() => setAdjustmentSign(-1)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      adjustmentSign === -1 ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-400'
                    }`}
                  >
                    − Remove Stock
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Quantity * <span className="text-gray-400 font-normal">(positive number, sign set above)</span>
                </label>
                <input
                  type="number" min="1"
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                    adjustStockErrors.quantity ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  value={adjustStockForm.quantity}
                  placeholder="e.g. 10"
                  onChange={e => {
                    setAdjustStockForm({ ...adjustStockForm, quantity: e.target.value });
                    setAdjustStockErrors(prev => { const n = { ...prev }; delete n.quantity; return n; });
                  }}
                />
                {adjustStockErrors.quantity && <p className="text-red-500 text-xs mt-1">{adjustStockErrors.quantity}</p>}
                {adjustStockForm.quantity && !isNaN(parseFloat(adjustStockForm.quantity)) && parseFloat(adjustStockForm.quantity) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Result: {selectedBatch.quantity} {adjustmentSign === 1 ? '+' : '−'} {Math.round(parseFloat(adjustStockForm.quantity))} = <strong className={adjustmentSign === 1 ? 'text-green-700' : 'text-red-700'}>{selectedBatch.quantity + Math.round(parseFloat(adjustStockForm.quantity)) * adjustmentSign} units</strong>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason *</label>
                <select
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={adjustStockForm.reason}
                  onChange={e => setAdjustStockForm({ ...adjustStockForm, reason: e.target.value as any })}
                >
                  <option value="damage">Damage</option>
                  <option value="theft">Theft</option>
                  <option value="manual-correction">Manual Correction</option>
                </select>
                {adjustStockErrors.reason && <p className="text-red-500 text-xs mt-1">{adjustStockErrors.reason}</p>}
              </div>

              {/* Notes with live char counter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-600">Notes *</label>
                  <span className={`text-xs ${
                    adjustStockForm.notes.trim().length < 3 ? 'text-gray-400' : 'text-green-600'
                  }`}>{adjustStockForm.notes.length} chars</span>
                </div>
                <textarea
                  rows={2}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none ${
                    adjustStockErrors.notes ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Describe reason for adjustment (min 3 chars)"
                  value={adjustStockForm.notes}
                  onChange={e => {
                    setAdjustStockForm({ ...adjustStockForm, notes: e.target.value });
                    setAdjustStockErrors(prev => { const n = { ...prev }; delete n.notes; return n; });
                  }}
                />
                {adjustStockErrors.notes && <p className="text-red-500 text-xs mt-1">{adjustStockErrors.notes}</p>}
              </div>
            </div>
          )}
        </Modal>

        {/* ── Add Product (Variant) Modal ────────────────────────────────────── */}
        <Modal
          isOpen={isAddProductModalOpen}
          title="Add Product Variant"
          onClose={() => { setIsAddProductModalOpen(false); addBrandImage.reset(); setAddProductErrors({}); }}
          footer={
            <>
              <button onClick={() => { setIsAddProductModalOpen(false); addBrandImage.reset(); setAddProductErrors({}); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateProduct} disabled={addProductLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {addProductLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</> : 'Create Variant'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Brand selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Brand <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mb-2">
                <button type="button"
                  onClick={() => { setAddProductBrandMode('existing'); setAddProductNewBrandName(''); addBrandImage.reset(); }}
                  className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${addProductBrandMode === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  Existing Brand
                </button>
                <button type="button"
                  onClick={() => { setAddProductBrandMode('new'); setAddProductSelectedBrandId(''); }}
                  className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${addProductBrandMode === 'new' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  + New Brand
                </button>
              </div>

              {addProductBrandMode === 'existing' ? (
                <>
                  <select
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${addProductErrors.brand ? 'border-red-400' : 'border-gray-200'}`}
                    value={addProductSelectedBrandId}
                    onChange={e => setAddProductSelectedBrandId(e.target.value)}
                  >
                    <option value="">Select a brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
                  </select>
                  {selectedBrand && (
                    <div className="mt-2 flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                      {selectedBrand.imageUrl ? (
                        <img src={resolveImageUrl(selectedBrand.imageUrl)!} alt={selectedBrand.displayName} className="w-10 h-10 rounded object-cover border border-blue-200" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-lg">🥤</div>
                      )}
                      <p className="text-xs text-blue-700 font-medium">Using <strong>{selectedBrand.displayName}</strong> image for this variant.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${addProductErrors.brand ? 'border-red-400' : 'border-gray-200'}`}
                    value={addProductNewBrandName}
                    onChange={e => setAddProductNewBrandName(e.target.value)}
                    placeholder="e.g. Pepsi (saved in lowercase)"
                  />
                  <ImageUploadField
                    label="Brand Image"
                    preview={addBrandImage.preview}
                    onSelect={addBrandImage.onSelect}
                    onClear={addBrandImage.onClear}
                    fileRef={addBrandImage.ref}
                    error={addBrandImage.error}
                  />
                </div>
              )}
              {addProductErrors.brand && <p className="text-red-500 text-xs mt-1">{addProductErrors.brand}</p>}
            </div>

            {/* Variant */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Variant <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(saved in lowercase)</span>
              </label>
              <input
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${addProductErrors.variant ? 'border-red-400' : 'border-gray-200'}`}
                value={addProductVariant}
                onChange={e => setAddProductVariant(e.target.value)}
                placeholder="e.g. 1.5l pet, 500ml can"
              />
              {addProductErrors.variant && <p className="text-red-500 text-xs mt-1">{addProductErrors.variant}</p>}
            </div>



            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                value={addProductDescription}
                onChange={e => setAddProductDescription(e.target.value)}
                placeholder="e.g. Carbonated soft drink"
              />
            </div>
          </div>
        </Modal>

        {/* ── Edit Product Modal (Bug 2 fix: brand is read-only, no image) ──── */}
        <Modal
          isOpen={!!editingProduct}
          title={`Edit Variant — ${getBrandName(editingProduct ?? { brand: '', variant: '' } as any)} ${editingProduct?.variant ?? ''}`}
          onClose={() => { setEditingProduct(null); setEditErrors({}); }}
          footer={
            <>
              <button onClick={() => { setEditingProduct(null); setEditErrors({}); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={editLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {editLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Read-only brand display */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
              {editingProduct && getProductBrandImage(editingProduct) ? (
                <img src={getProductBrandImage(editingProduct)!} alt="brand" className="w-10 h-10 rounded object-cover border border-gray-200 flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">🥤</div>
              )}
              <div>
                <p className="text-xs text-gray-500">Brand (read-only)</p>
                <p className="font-semibold text-gray-900 capitalize">{editingProduct ? getBrandName(editingProduct) : ''}</p>
                <p className="text-xs text-blue-500 mt-0.5">To change brand image, use "Edit Brand Image" on the brand header.</p>
              </div>
            </div>

            {/* Variant */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Variant <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(saved in lowercase)</span>
              </label>
              <input
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${editErrors.variant ? 'border-red-400' : 'border-gray-200'}`}
                value={editVariant}
                onChange={e => setEditVariant(e.target.value)}
                placeholder="e.g. 1.5l pet"
              />
              {editErrors.variant && <p className="text-red-500 text-xs mt-1">{editErrors.variant}</p>}
            </div>



            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="e.g. Carbonated soft drink"
              />
            </div>
          </div>
        </Modal>

        {/* ── Edit Brand Modal ───────────────────────────────────────────────── */}
        <Modal
          isOpen={!!editingBrand}
          title={`Edit Brand — ${editingBrand?.displayName ?? ''}`}
          onClose={() => { setEditingBrand(null); editBrandImage.reset(); setEditBrandErrors({}); }}
          footer={
            <>
              <button onClick={() => { setEditingBrand(null); editBrandImage.reset(); setEditBrandErrors({}); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEditBrand} disabled={editBrandLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {editBrandLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : 'Save Brand'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              ℹ️ Changing the image here updates it for <strong>all</strong> variants under "{editingBrand?.displayName}" automatically.
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name</label>
              <input
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 ${editBrandErrors.displayName ? 'border-red-400' : 'border-gray-200'}`}
                value={editBrandDisplayName}
                onChange={e => setEditBrandDisplayName(e.target.value)}
                placeholder="e.g. Coca Cola"
              />
              {editBrandErrors.displayName && <p className="text-red-500 text-xs mt-1">{editBrandErrors.displayName}</p>}
            </div>

            {/* Current image preview + new upload */}
            {editingBrand?.imageUrl && !editBrandImage.preview && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Current Image</p>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100">
                  <img src={resolveImageUrl(editingBrand.imageUrl)!} alt="current" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Upload a new image below to replace it.</p>
              </div>
            )}

            <ImageUploadField
              label={editingBrand?.imageUrl ? 'Replace Image' : 'Brand Image'}
              preview={editBrandImage.preview}
              onSelect={editBrandImage.onSelect}
              onClear={editBrandImage.onClear}
              fileRef={editBrandImage.ref}
              error={editBrandImage.error}
            />
          </div>
        </Modal>

        {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
        <Modal
          isOpen={!!deletingProduct}
          title="Hide This Product?"
          onClose={() => { setDeletingProduct(null); setDeleteError(''); }}
          footer={
            <>
              <button onClick={() => { setDeletingProduct(null); setDeleteError(''); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
                {deleteLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Hiding…</> : 'Yes, Hide Product'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              This will <strong>hide</strong>{' '}
              <span className="font-semibold text-gray-900">{deletingProduct ? `${getBrandName(deletingProduct)} ${deletingProduct.variant}` : ''}</span>{' '}
              from the sales screen and inventory list.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              ℹ️ This is a <strong>soft delete</strong> — no data is permanently erased. Historical bills remain intact.
            </div>
            <p className="text-sm text-gray-600">If this product still has stock, it cannot be hidden. Reduce stock to 0 first.</p>
            {deleteError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{deleteError}</div>}
          </div>
        </Modal>

        {/* ── Add RGB Variety Modal ──────────────────────────────────────────── */}
        <Modal isOpen={isAddRgbModalOpen} title="Add RGB Type" size="sm"
          onClose={() => { setIsAddRgbModalOpen(false); setRgbFormErrors({}); }}
          footer={
            <>
              <button onClick={() => { setIsAddRgbModalOpen(false); setRgbFormErrors({}); }}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateRGBType} disabled={rgbFormLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2 transition-colors">
                {rgbFormLoading ? 'Creating…' : 'Add Type'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${rgbFormErrors.name ? 'border-red-400' : 'border-gray-200'}`}
                value={rgbForm.name} onChange={e => setRgbForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pepsi RGB, Sprite RGB"
              />
              {rgbFormErrors.name && <p className="text-red-500 text-xs mt-1">{rgbFormErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Stock (crates)</label>
              <input type="number" min="0"
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${rgbFormErrors.stockQuantity ? 'border-red-400' : 'border-gray-200'}`}
                value={rgbForm.stockQuantity} onChange={e => setRgbForm(f => ({ ...f, stockQuantity: e.target.value }))}
                placeholder="0"
              />
              {rgbFormErrors.stockQuantity && <p className="text-red-500 text-xs mt-1">{rgbFormErrors.stockQuantity}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Product <span className="text-gray-400 font-normal">(optional)</span></label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                value={rgbForm.linkedProductId} onChange={e => setRgbForm(f => ({ ...f, linkedProductId: e.target.value }))}>
                <option value="">— None —</option>
                {products.map(p => <option key={p.id} value={p.id}>{getBrandName(p)} {p.variant}</option>)}
              </select>
            </div>
          </div>
        </Modal>

        {/* ── Confirm Delete RGB Modal ─────────────────────────────────────── */}
        <Modal
          isOpen={!!deletingRgbItem}
          title="Delete RGB Item"
          onClose={() => setDeletingRgbItem(null)}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setDeletingRgbItem(null)}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRgb}
                disabled={deleteRgbLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg py-2 transition-colors flex items-center justify-center gap-2"
              >
                {deleteRgbLoading ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          {deletingRgbItem && (
            <div className="space-y-3">
              {deleteRgbError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  {deleteRgbError}
                </div>
              )}
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <strong className="text-gray-900">"{deletingRgbItem.name}"</strong>?
              </p>
              <p className="text-xs text-gray-500">
                This item will be permanently removed. (Blocked if any retailer has active balances).
              </p>
            </div>
          )}
        </Modal>

      </PageContainer>
    </Layout>
  );
};
