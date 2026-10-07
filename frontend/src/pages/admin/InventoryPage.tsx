import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Input, Select, Modal } from '../../components/common';
import { Card, StatIcon, Figure } from '../../components/ui/Card';
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
  const [adjustmentSign, setAdjustmentSign] = useState<1 | -1>(-1);

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
  const [rgbForm, setRgbForm] = useState({ name: '', stockQuantity: '' });
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
  const totalBuyValue = stockBatches.reduce((s, b) => s + b.quantity * b.buyPrice, 0);

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
      setAdjustmentSign(-1);
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
      setRgbForm({ name: '', stockQuantity: '' });
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

  const headerActions = !isRgbPanelOpen ? (
    <div className="hidden md:flex items-center gap-2">
      <Button
        onClick={() => { setIsAddProductModalOpen(true); setAddProductBrandMode('existing'); }}
        className="h-9 px-2.5 sm:px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
      >
        <Plus size={15} />
        <span>New Variant</span>
      </Button>
      <Button
        variant="secondary"
        className="h-9 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        onClick={() => {
          if (products.length === 0) {
            store.addNotification('info', 'Create a product first before adding stock');
          } else {
            setIsAddStockModalOpen(true);
          }
        }}
      >
        <Plus size={15} />
        <span>Add Stock</span>
      </Button>
      <Button
        variant="secondary"
        className="h-9 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        onClick={() => { setIsRgbPanelOpen(true); loadRGBItems(); }}
      >
        <span>📦 RGB<span className="hidden sm:inline"> Management</span></span>
      </Button>
    </div>
  ) : (
    <Button
      variant="secondary"
      className="hidden md:flex h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold items-center justify-center gap-1.5 shadow-xs"
      onClick={() => setIsRgbPanelOpen(false)}
    >
      ← Back to Inventory
    </Button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR} headerActions={headerActions}>
      <PageContainer>
        {/* Mobile Action Buttons (second row on mobile, matching Create Sale pattern) */}
        {!isRgbPanelOpen ? (
          <div className="flex md:hidden items-center gap-2 mb-4 w-full flex-wrap">
            <Button
              onClick={() => { setIsAddProductModalOpen(true); setAddProductBrandMode('existing'); }}
              className="flex-1 min-w-[100px] h-9 px-2.5 text-xs font-bold flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
            >
              <Plus size={14} />
              <span>New Variant</span>
            </Button>
            <Button
              variant="secondary"
              className="flex-1 min-w-[90px] h-9 px-2.5 text-xs font-semibold flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
              onClick={() => {
                if (products.length === 0) {
                  store.addNotification('info', 'Create a product first before adding stock');
                } else {
                  setIsAddStockModalOpen(true);
                }
              }}
            >
              <Plus size={14} />
              <span>Add Stock</span>
            </Button>
            <Button
              variant="secondary"
              className="h-9 px-2.5 text-xs font-semibold flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
              onClick={() => { setIsRgbPanelOpen(true); loadRGBItems(); }}
            >
              <span>📦 RGB</span>
            </Button>
          </div>
        ) : (
          <div className="flex md:hidden items-center mb-4">
            <Button
              variant="secondary"
              className="h-9 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
              onClick={() => setIsRgbPanelOpen(false)}
            >
              ← Back to Inventory
            </Button>
          </div>
        )}

        {isRgbPanelOpen ? (
          /* ── RGB VIEW ONLY ────────────────────────────────────────────────────────── */
          <div>
            {/* RGB Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-ink-muted leading-snug">Crates in Warehouse</span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<Package size={18} />} tone="brand" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-ink"><Figure>{totalWarehouseCrates.toLocaleString()}</Figure></h3>
              </Card>

              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-ink-muted leading-snug">Crates Out with Retailers</span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<Boxes size={18} />} tone="warning" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-warning-500"><Figure>{totalCratesOut.toLocaleString()}</Figure></h3>
              </Card>

              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-ink-muted leading-snug">RGB Bottle Types</span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<TrendingUp size={18} />} tone="brand" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-ink"><Figure>{rgbItems.length}</Figure></h3>
              </Card>
            </div>

            {/* RGB Stock Management Panel */}
            <Card variant="default" className="mb-6">
              <div className="flex justify-end items-center mb-4">
                <Button size="sm" onClick={() => setIsAddRgbModalOpen(true)}>
                  <Plus size={14} className="mr-1" /> Add Type
                </Button>
              </div>
              {rgbLoading ? (
                <div className="py-8 text-center text-sm text-ink-muted">Loading RGB stock…</div>
              ) : rgbItems.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                    <Package size={22} className="text-ink-subtle" />
                  </div>
                  <p className="text-sm text-ink-muted font-medium">No RGB types yet.</p>
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
                        className="bg-surface-card border-2 border-border hover:border-accent-400 rounded-card p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-card bg-accent-500/10 border border-accent-500/30 flex items-center justify-center font-bold text-xl">
                              📦
                            </div>
                            <div>
                              <h4 className="font-bold text-ink text-sm leading-tight">{item.name}</h4>
                              <p className="text-[11px] text-ink-subtle mt-0.5">
                                Updated {new Date(item.lastUpdated).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setDeletingRgbItem(item); setDeleteRgbError(''); }}
                            className="w-7 h-7 flex items-center justify-center rounded-control bg-surface-muted hover:bg-danger-50 text-ink-subtle hover:text-danger-500 transition-colors"
                            title="Delete RGB Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="bg-surface-muted/80 border border-border rounded-card p-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">Warehouse Stock</span>
                            <span className="text-lg font-bold text-ink"><Figure>{item.stockQuantity}</Figure> <span className="text-xs font-normal text-ink-muted">crates</span></span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRGBAdjust(item.id, item.stockQuantity, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-control bg-danger-500 hover:bg-danger-600 active:scale-95 text-white font-bold transition-all shadow-2xs"
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
                              className="w-11 text-center font-bold text-ink text-sm border border-border rounded-control focus:border-accent-500 focus:outline-none bg-surface-card py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => handleRGBAdjust(item.id, item.stockQuantity, 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-control bg-success-500 hover:bg-success-600 active:scale-95 text-white font-bold transition-all shadow-2xs"
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
            <Card variant="default">
              <h3 className="text-sm font-bold text-ink mb-3">Retailer RGB Balances</h3>
              {retailerBalancesList.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-card bg-surface-muted flex items-center justify-center"><Boxes size={18} className="text-ink-subtle" /></div>
                  <p className="text-sm text-ink-muted">No outstanding RGB crate balances with any retailer.</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border-strong">
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Retailer</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">RGB Type</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-4">Quantity Owed</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-4">Last Transaction</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retailerBalancesList.map((row, idx) => {
                        const key = `${row.retailerId}_${row.rgbItemId}`;
                        const isOpen = returnRowKey === key;

                        return (
                          <tr key={idx} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-ink block">{row.shopName}</span>
                              <span className="text-xs text-ink-muted">{row.retailerName}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-ink-muted">{row.itemName}</td>
                            <td className="py-3 px-4 text-right font-bold text-warning-500"><Figure>{row.balance}</Figure> crates</td>
                            <td className="py-3 px-4 text-right text-xs text-ink-subtle">
                              {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isOpen ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="flex items-center border border-success-500/40 bg-success-50/50 rounded-control overflow-hidden h-7">
                                    <button
                                      type="button"
                                      onClick={() => setReturnQtyInput(prev => Math.max(0, prev - 1))}
                                      disabled={returnQtyInput <= 0}
                                      className="w-6 h-full bg-success-500 hover:bg-success-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold flex items-center justify-center transition-colors"
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
                                      className="w-10 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 text-success-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setReturnQtyInput(prev => Math.min(row.balance, prev + 1))}
                                      disabled={returnQtyInput >= row.balance}
                                      className="w-6 h-full bg-success-500 hover:bg-success-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold flex items-center justify-center transition-colors"
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
                                    className="text-xs font-semibold text-ink-subtle hover:text-ink-muted px-1"
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
                                  className="px-2.5 py-1 text-xs font-semibold rounded-control bg-warning-50 text-warning-500 border border-warning-500/30 hover:bg-warning-50/80 transition-colors inline-flex items-center gap-1"
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
            <Card variant="default">
              <h3 className="text-sm font-bold text-ink mb-3">RGB Transaction History</h3>
              {rgbTransactions.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-card bg-surface-muted flex items-center justify-center"><RotateCcw size={18} className="text-ink-subtle" /></div>
                  <p className="text-sm text-ink-muted">No RGB transactions recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-auto border border-border rounded-card">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border-strong">
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Date</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Retailer</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">RGB Item</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-4">Type</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-4">Quantity</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Recorded By</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-4">Bill Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rgbTransactions.map((tx) => {
                        const isIssue = tx.type?.toLowerCase() === 'issue';
                        return (
                          <tr key={tx.id} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                            <td className="py-3 px-4 text-xs text-ink-subtle">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-semibold text-ink">
                              {tx.retailerName}
                            </td>
                            <td className="py-3 px-4 font-medium text-ink-muted">
                              {tx.itemName}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-control text-xs font-bold ${isIssue ? 'bg-warning-50 text-warning-500 border border-warning-500/30' : 'bg-success-50 text-success-500 border border-success-500/30'
                                }`}>
                                {isIssue ? 'Given ↑' : 'Returned ↓'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-ink">
                              <Figure>{tx.quantity}</Figure> crates
                            </td>
                            <td className="py-3 px-4 text-xs text-ink-muted">
                              {tx.workerName || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center text-xs">
                              {tx.saleId ? (
                                <span className="px-2 py-1 bg-info-50 text-info-500 font-mono rounded-control font-medium border border-info-500/30">
                                  Linked to Sale
                                </span>
                              ) : (
                                <span className="text-ink-subtle font-normal">Standalone</span>
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

            {/* ── Inventory KPI Summary Cards ───────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] sm:text-[11px] text-ink-muted font-bold uppercase tracking-wider leading-snug">
                    Total PET Units
                  </span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<Package size={18} />} tone="brand" />
                  </div>
                </div>
                <p className="text-base sm:text-lg xl:text-xl font-extrabold text-ink tracking-tight">
                  <Figure>{stockBatches.reduce((s, b) => s + b.quantity, 0).toLocaleString()}</Figure>
                </p>
              </Card>

              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] sm:text-[11px] text-ink-muted font-bold uppercase tracking-wider leading-snug">
                    Products
                  </span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<Boxes size={18} />} tone="brand" />
                  </div>
                </div>
                <p className="text-base sm:text-lg xl:text-xl font-extrabold text-ink tracking-tight">
                  <Figure>{products.length}</Figure>
                </p>
              </Card>

              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] sm:text-[11px] text-ink-muted font-bold uppercase tracking-wider leading-snug">
                    Stock Cost Value
                  </span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<TrendingUp size={18} />} tone="warning" />
                  </div>
                </div>
                <p className="text-base sm:text-lg xl:text-xl font-extrabold text-ink tracking-tight">
                  ₨<Figure>{Math.round(totalBuyValue).toLocaleString('en-PK')}</Figure>
                </p>
              </Card>

              <Card variant="stat" className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] sm:text-[11px] text-ink-muted font-bold uppercase tracking-wider leading-snug">
                    Retail Value
                  </span>
                  <div className="flex-shrink-0">
                    <StatIcon icon={<TrendingUp size={18} />} tone="success" />
                  </div>
                </div>
                <p className="text-base sm:text-lg xl:text-xl font-extrabold text-brand-700 tracking-tight">
                  ₨<Figure>{Math.round(totalStockValue).toLocaleString('en-PK')}</Figure>
                </p>
              </Card>
            </div>

            {/* ── Products (brand grid → variant cards) ─────────────────────────── */}
            <Card variant="default" className="mb-6">
              <h3 className="text-sm font-bold text-ink mb-4">Products</h3>
              {!selectedInventoryBrand ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
                  {inventoryBrands.map(([brandKey, { brand, products: brandProducts }]) => {
                    const imgUrl = brand?.imageUrl ? resolveImageUrl(brand.imageUrl)
                      : getProductBrandImage(brandProducts[0]);
                    return (
                      <button
                        key={brandKey}
                        onClick={() => setSelectedInventoryBrand(brandKey)}
                        className="group flex flex-col items-center p-1.5 sm:p-2 border-2 border-border rounded-card hover:border-brand-600 hover:shadow-md transition-all duration-200 bg-surface-card"
                      >
                        <div className="w-full h-16 sm:h-24 rounded-control overflow-hidden mb-1 sm:mb-1.5 bg-surface-muted flex items-center justify-center">
                          {imgUrl ? (
                            <img src={imgUrl} alt={brandKey} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-2xl sm:text-3xl">🥤</span>
                          )}
                        </div>
                        <p className="font-bold text-ink text-[11px] sm:text-xs text-center line-clamp-1">{brand?.displayName ?? brandKey}</p>
                        <p className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5">{brandProducts.length} variant{brandProducts.length !== 1 ? 's' : ''}</p>
                      </button>
                    );
                  })}
                  {inventoryBrands.length === 0 && !store.isLoading && (
                    <p className="col-span-full text-center text-sm text-ink-subtle py-8">No products yet</p>
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
                            <div className="w-10 h-10 rounded-control overflow-hidden border border-border flex-shrink-0">
                              <img src={brandImgUrl} alt={selectedInventoryBrand} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-ink text-lg capitalize">{brand?.displayName ?? selectedInventoryBrand} — Variants</h3>
                            <p className="text-xs text-ink-muted">{selectedInventoryVariants.length} variant{selectedInventoryVariants.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedInventoryBrand('')}
                            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
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
                        <div key={product.id} className="border border-border rounded-card p-2.5 bg-surface-muted/40 flex items-start gap-2.5">
                          <div className="w-12 h-12 rounded-control overflow-hidden bg-surface-card flex-shrink-0 flex items-center justify-center border border-border">
                            {imgUrl ? (
                              <img src={imgUrl} alt={getBrandName(product)} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-ink-subtle" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-ink text-xs truncate">{getBrandName(product)} {product.variant}</p>
                            <p className="text-[11px] text-ink-muted mt-0.5 capitalize">{product.category}</p>
                            <p className="text-xs font-semibold text-brand-600 mt-0.5">Stock: <Figure>{totalStock}</Figure> units</p>
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              <Button size="sm" onClick={() => openAddStockForVariant(product.id)} className="text-xs py-1 px-2">Add Stock</Button>
                              <button
                                onClick={() => openEditModal(product)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-control bg-surface-muted text-brand-700 hover:bg-brand-50 border border-brand-200 transition-colors"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={() => { setDeleteError(''); setDeletingProduct(product); }}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-control bg-danger-50 text-danger-500 hover:bg-danger-50/80 border border-danger-500/20 transition-colors"
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
            <Card variant="default">
              <h3 className="text-sm font-bold text-ink mb-3">Stock Batches</h3>
              {stockBatches.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-center"><div className="w-10 h-10 rounded-card bg-surface-muted flex items-center justify-center"><Package size={18} className="text-ink-subtle" /></div><p className="text-sm text-ink-muted">No stock batches yet</p></div>
              ) : (
                <div className="divide-y divide-border">
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
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/50 transition-colors text-left"
                        >
                          <span className="text-ink-subtle">
                            {isBrandOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                          {brand?.imageUrl ? (
                            <img src={resolveImageUrl(brand.imageUrl)!} alt={brandKey}
                              className="w-7 h-7 rounded object-cover border border-border flex-shrink-0" />
                          ) : (
                            <span className="w-7 h-7 rounded bg-surface-muted flex items-center justify-center text-sm flex-shrink-0">🥤</span>
                          )}
                          <span className="font-bold text-ink flex-1">
                            {brand?.displayName ?? brandKey}
                          </span>
                          <span className="text-xs text-ink-muted font-medium">
                            <Figure>{brandTotalQty}</Figure> units total
                          </span>
                        </button>

                        {/* 2-Level: Brand -> Batches Table (Immediate variant + batch details) */}
                        {isBrandOpen && (
                          <div className="bg-surface-muted/30 p-3 border-t border-border overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                              <thead className="sticky top-0 z-10 bg-surface-muted">
                                <tr className="border-b border-border text-ink-subtle font-semibold uppercase text-[11px] tracking-wider bg-surface-muted">
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
                              <tbody className="divide-y divide-border">
                                {brandProds.flatMap((product) => {
                                  const variantBatches = stockBatches.filter(b => b.productId === product.id);
                                  return variantBatches.map((batch) => {
                                    const exp = checkExpiryStatus(batch.expiryDate);
                                    const showBadge = exp.status !== 'ok';
                                    const supplierName = (batch as any).supplier || '—';

                                    return (
                                      <tr key={batch.id} className="hover:bg-surface-card transition-colors bg-surface-card/60">
                                        <td className="py-2.5 px-3 font-semibold text-ink capitalize whitespace-nowrap">
                                          {product.variant}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-ink-muted whitespace-nowrap">
                                          {batch.batchNumber}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-ink whitespace-nowrap">
                                          <Figure>{batch.quantity}</Figure>
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-ink-muted whitespace-nowrap">
                                          ₨<Figure>{Number(batch.buyPrice).toFixed(0)}</Figure>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-ink whitespace-nowrap">
                                          ₨<Figure>{Number(batch.salePrice).toFixed(0)}</Figure>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                          <span className={showBadge ? (exp.status === 'expired' ? 'text-danger-500 font-semibold' : 'text-warning-500 font-semibold') : 'text-ink-muted'}>
                                            {new Date(batch.expiryDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </span>
                                          {showBadge && (
                                            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-control font-semibold ${exp.status === 'expired' ? 'bg-danger-50 text-danger-500 border border-danger-500/20' : 'bg-warning-50 text-warning-500 border border-warning-500/20'
                                              }`}>
                                              {exp.label}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-ink-subtle max-w-[120px] truncate" title={supplierName}>
                                          {supplierName}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                          <button
                                            onClick={() => {
                                              setSelectedBatch(batch);
                                              setAdjustStockForm({ reason: 'damage', quantity: '', notes: '' });
                                              setAdjustmentSign(-1);
                                              setAdjustStockErrors({});
                                              setAdjustStockGenericError('');
                                              setIsAdjustStockModalOpen(true);
                                            }}
                                            className="text-brand-600 hover:text-brand-700 font-semibold hover:underline"
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors"
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
                className="flex-1 bg-brand-700 hover:bg-brand-600 text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add Stock Now
              </button>
            </>
          }
        >
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-success-50 text-success-500 border border-success-500/20 rounded-full flex items-center justify-center mx-auto">
              <Package size={28} />
            </div>
            <p className="text-sm text-ink-muted">
              <strong className="text-ink">{postCreateProductLabel}</strong> has been created successfully.
            </p>
            <p className="text-sm text-ink-subtle">
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddStock} disabled={addStockLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {addStockLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding…</> : 'Add Stock'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Generic error banner */}
            {addStockGenericError && (
              <div className="bg-danger-50 border border-danger-500/30 rounded-control px-4 py-3 text-xs text-danger-500 flex items-start gap-2 font-medium">
                <span className="mt-0.5 flex-shrink-0">⚠</span>
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdjustStock} disabled={adjustStockLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {adjustStockLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adjusting…</> : 'Apply Adjustment'}
              </button>
            </>
          }
        >
          {selectedBatch && (
            <div className="space-y-4">
              {/* Generic error banner */}
              {adjustStockGenericError && (
                <div className="bg-danger-50 border border-danger-500/30 rounded-control px-4 py-3 text-xs text-danger-500 flex items-start gap-2 font-medium">
                  <span className="mt-0.5 flex-shrink-0">⚠</span>
                  <span>{adjustStockGenericError}</span>
                </div>
              )}
              {/* Info block */}
              <div className="bg-surface-muted border border-border rounded-card p-3 space-y-1">
                <p className="text-sm font-bold text-ink">{getProductLabel(selectedBatch.productId)}</p>
                <p className="text-xs text-ink-muted">Batch: <span className="font-mono text-ink">{selectedBatch.batchNumber}</span></p>
                <p className="text-xs text-ink-muted">Current stock: <span className="font-bold text-brand-600"><Figure>{selectedBatch.quantity}</Figure> units</span></p>
              </div>

              {/* Operation indicator */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Operation *</label>
                <div className="w-full py-2 rounded-control text-sm font-semibold bg-danger-500 text-white border-2 border-danger-500 text-center">
                  − Remove Stock
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Quantity * <span className="text-ink-subtle font-normal">(positive number, sign set above)</span>
                </label>
                <input
                  type="number" min="1"
                  className={`input-field text-sm ${adjustStockErrors.quantity ? 'border-danger-500 focus:ring-danger-500/50' : ''
                    }`}
                  value={adjustStockForm.quantity}
                  placeholder="e.g. 10"
                  onChange={e => {
                    setAdjustStockForm({ ...adjustStockForm, quantity: e.target.value });
                    setAdjustStockErrors(prev => { const n = { ...prev }; delete n.quantity; return n; });
                  }}
                />
                {adjustStockErrors.quantity && <p className="text-danger-500 text-xs mt-1">{adjustStockErrors.quantity}</p>}
                {adjustStockForm.quantity && !isNaN(parseFloat(adjustStockForm.quantity)) && parseFloat(adjustStockForm.quantity) > 0 && (
                  <p className="text-xs text-ink-muted mt-1">
                    Result: <Figure>{selectedBatch.quantity}</Figure> {adjustmentSign === 1 ? '+' : '−'} <Figure>{Math.round(parseFloat(adjustStockForm.quantity))}</Figure> = <strong className={adjustmentSign === 1 ? 'text-success-500' : 'text-danger-500'}><Figure>{selectedBatch.quantity + Math.round(parseFloat(adjustStockForm.quantity)) * adjustmentSign}</Figure> units</strong>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Reason *</label>
                <select
                  className="input-field text-sm"
                  value={adjustStockForm.reason}
                  onChange={e => setAdjustStockForm({ ...adjustStockForm, reason: e.target.value as any })}
                >
                  <option value="damage">Damage</option>
                  <option value="theft">Theft</option>
                  <option value="manual-correction">Manual Correction</option>
                </select>
                {adjustStockErrors.reason && <p className="text-danger-500 text-xs mt-1">{adjustStockErrors.reason}</p>}
              </div>

              {/* Notes with live char counter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-ink-muted">Notes *</label>
                  <span className={`text-xs ${adjustStockForm.notes.trim().length < 3 ? 'text-ink-subtle' : 'text-success-500'
                    }`}>{adjustStockForm.notes.length} chars</span>
                </div>
                <textarea
                  rows={2}
                  className={`input-field text-sm resize-none ${adjustStockErrors.notes ? 'border-danger-500 focus:ring-danger-500/50' : ''
                    }`}
                  placeholder="Describe reason for adjustment (min 3 chars)"
                  value={adjustStockForm.notes}
                  onChange={e => {
                    setAdjustStockForm({ ...adjustStockForm, notes: e.target.value });
                    setAdjustStockErrors(prev => { const n = { ...prev }; delete n.notes; return n; });
                  }}
                />
                {adjustStockErrors.notes && <p className="text-danger-500 text-xs mt-1">{adjustStockErrors.notes}</p>}
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateProduct} disabled={addProductLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {addProductLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</> : 'Create Variant'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Brand selection */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-2">Brand <span className="text-danger-500">*</span></label>
              <div className="flex gap-2 mb-2">
                <button type="button"
                  onClick={() => { setAddProductBrandMode('existing'); setAddProductNewBrandName(''); addBrandImage.reset(); }}
                  className={`flex-1 text-xs py-1.5 rounded-control border font-semibold transition-colors ${addProductBrandMode === 'existing' ? 'bg-brand-700 text-white border-brand-700' : 'border-border text-ink-muted hover:border-border-strong'}`}>
                  Existing Brand
                </button>
                <button type="button"
                  onClick={() => { setAddProductBrandMode('new'); setAddProductSelectedBrandId(''); }}
                  className={`flex-1 text-xs py-1.5 rounded-control border font-semibold transition-colors ${addProductBrandMode === 'new' ? 'bg-brand-700 text-white border-brand-700' : 'border-border text-ink-muted hover:border-border-strong'}`}>
                  + New Brand
                </button>
              </div>

              {addProductBrandMode === 'existing' ? (
                <>
                  <select
                    className={`input-field text-sm ${addProductErrors.brand ? 'border-danger-500' : ''}`}
                    value={addProductSelectedBrandId}
                    onChange={e => setAddProductSelectedBrandId(e.target.value)}
                  >
                    <option value="">Select a brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
                  </select>
                  {selectedBrand && (
                    <div className="mt-2 flex items-center gap-3 p-2 bg-surface-muted rounded-control border border-border">
                      {selectedBrand.imageUrl ? (
                        <img src={resolveImageUrl(selectedBrand.imageUrl)!} alt={selectedBrand.displayName} className="w-10 h-10 rounded-control object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-control bg-surface-card flex items-center justify-center text-lg">🥤</div>
                      )}
                      <p className="text-xs text-brand-700 font-medium">Using <strong>{selectedBrand.displayName}</strong> image for this variant.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    className={`input-field text-sm ${addProductErrors.brand ? 'border-danger-500' : ''}`}
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
              {addProductErrors.brand && <p className="text-danger-500 text-xs mt-1">{addProductErrors.brand}</p>}
            </div>

            {/* Variant */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Variant <span className="text-danger-500">*</span>
                <span className="text-ink-subtle font-normal ml-1">(saved in lowercase)</span>
              </label>
              <input
                className={`input-field text-sm ${addProductErrors.variant ? 'border-danger-500' : ''}`}
                value={addProductVariant}
                onChange={e => setAddProductVariant(e.target.value)}
                placeholder="e.g. 1.5l pet, 500ml can"
              />
              {addProductErrors.variant && <p className="text-danger-500 text-xs mt-1">{addProductErrors.variant}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Description <span className="text-ink-subtle font-normal">(optional)</span></label>
              <input
                className="input-field text-sm"
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={editLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {editLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Read-only brand display with Edit Brand Image button */}
            {(() => {
              const productBrand = editingProduct
                ? (editingProduct.brandRel ?? brands.find(b => b.id === (editingProduct as any).brandId || b.name.toLowerCase() === editingProduct.brand.toLowerCase()))
                : null;
              return (
                <div className="bg-surface-muted border border-border rounded-card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {editingProduct && getProductBrandImage(editingProduct) ? (
                      <img src={getProductBrandImage(editingProduct)!} alt="brand" className="w-10 h-10 rounded-control object-cover border border-border flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-control bg-surface-card flex items-center justify-center flex-shrink-0 text-xl">🥤</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-ink-subtle">Brand</p>
                      <p className="font-semibold text-ink capitalize truncate">{editingProduct ? getBrandName(editingProduct) : ''}</p>
                    </div>
                  </div>
                  {productBrand && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        openEditBrand(productBrand);
                      }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-control bg-surface-card text-brand-700 hover:bg-brand-50 border border-brand-200 transition-colors font-semibold shadow-2xs whitespace-nowrap flex-shrink-0"
                    >
                      <ImageIcon size={13} /> Edit Brand Image
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Variant */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Variant <span className="text-danger-500">*</span>
                <span className="text-ink-subtle font-normal ml-1">(saved in lowercase)</span>
              </label>
              <input
                className={`input-field text-sm ${editErrors.variant ? 'border-danger-500' : ''}`}
                value={editVariant}
                onChange={e => setEditVariant(e.target.value)}
                placeholder="e.g. 1.5l pet"
              />
              {editErrors.variant && <p className="text-danger-500 text-xs mt-1">{editErrors.variant}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Description <span className="text-ink-subtle font-normal">(optional)</span></label>
              <input
                className="input-field text-sm"
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEditBrand} disabled={editBrandLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {editBrandLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : 'Save Brand'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-info-50 border border-info-500/30 rounded-control px-3 py-2 text-xs text-info-500 font-medium">
              ℹ️ Changing the image here updates it for <strong>all</strong> variants under "{editingBrand?.displayName}" automatically.
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Display Name</label>
              <input
                className={`input-field text-sm ${editBrandErrors.displayName ? 'border-danger-500' : ''}`}
                value={editBrandDisplayName}
                onChange={e => setEditBrandDisplayName(e.target.value)}
                placeholder="e.g. Coca Cola"
              />
              {editBrandErrors.displayName && <p className="text-danger-500 text-xs mt-1">{editBrandErrors.displayName}</p>}
            </div>

            {/* Current image preview + new upload */}
            {editingBrand?.imageUrl && !editBrandImage.preview && (
              <div>
                <p className="text-xs font-semibold text-ink-muted mb-2">Current Image</p>
                <div className="relative w-full aspect-video rounded-card overflow-hidden border-2 border-border bg-surface-muted">
                  <img src={resolveImageUrl(editingBrand.imageUrl)!} alt="current" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-ink-subtle mt-1">Upload a new image below to replace it.</p>
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2.5 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleteLoading}
                className="flex-1 bg-danger-500 hover:bg-danger-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2">
                {deleteLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Hiding…</> : 'Yes, Hide Product'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              This will <strong>hide</strong>{' '}
              <span className="font-semibold text-ink">{deletingProduct ? `${getBrandName(deletingProduct)} ${deletingProduct.variant}` : ''}</span>{' '}
              from the sales screen and inventory list.
            </p>
            <div className="bg-warning-50 border border-warning-500/30 rounded-control px-3 py-2 text-xs text-warning-500 font-medium">
              ℹ️ This is a <strong>soft delete</strong> — no data is permanently erased. Historical bills remain intact.
            </div>
            <p className="text-sm text-ink-subtle">If this product still has stock, it cannot be hidden. Reduce stock to 0 first.</p>
            {deleteError && <div className="bg-danger-50 border border-danger-500/30 rounded-control px-3 py-2 text-xs text-danger-500 font-medium">{deleteError}</div>}
          </div>
        </Modal>

        {/* ── Add RGB Variety Modal ──────────────────────────────────────────── */}
        <Modal isOpen={isAddRgbModalOpen} title="Add RGB Type" size="sm"
          onClose={() => { setIsAddRgbModalOpen(false); setRgbFormErrors({}); }}
          footer={
            <>
              <button onClick={() => { setIsAddRgbModalOpen(false); setRgbFormErrors({}); }}
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateRGBType} disabled={rgbFormLoading}
                className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2 transition-colors">
                {rgbFormLoading ? 'Creating…' : 'Add Type'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Name <span className="text-danger-500">*</span></label>
              <input
                className={`input-field text-sm ${rgbFormErrors.name ? 'border-danger-500' : ''}`}
                value={rgbForm.name} onChange={e => setRgbForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pepsi RGB, Sprite RGB"
              />
              {rgbFormErrors.name && <p className="text-danger-500 text-xs mt-1">{rgbFormErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Initial Stock (crates)</label>
              <input type="number" min="0"
                className={`input-field text-sm ${rgbFormErrors.stockQuantity ? 'border-danger-500' : ''}`}
                value={rgbForm.stockQuantity} onChange={e => setRgbForm(f => ({ ...f, stockQuantity: e.target.value }))}
                placeholder="0"
              />
              {rgbFormErrors.stockQuantity && <p className="text-danger-500 text-xs mt-1">{rgbFormErrors.stockQuantity}</p>}
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
                className="flex-1 bg-surface-muted text-ink hover:bg-border/50 border border-border text-sm font-semibold rounded-control py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRgb}
                disabled={deleteRgbLoading}
                className="flex-1 bg-danger-500 hover:bg-danger-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2 transition-colors flex items-center justify-center gap-2"
              >
                {deleteRgbLoading ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          {deletingRgbItem && (
            <div className="space-y-3">
              {deleteRgbError && (
                <div className="bg-danger-50 border border-danger-500/30 rounded-control p-3 text-xs text-danger-500 font-medium">
                  {deleteRgbError}
                </div>
              )}
              <p className="text-sm text-ink-muted">
                Are you sure you want to delete <strong className="text-ink">"{deletingRgbItem.name}"</strong>?
              </p>
              <p className="text-xs text-ink-subtle">
                This item will be permanently removed. (Blocked if any retailer has active balances).
              </p>
            </div>
          )}
        </Modal>

      </PageContainer>
    </Layout>
  );
};
