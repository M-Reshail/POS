import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Input, Select, Modal, Badge } from '../../components/common';
import { useStore } from '../../store';
import { Package, Plus, BarChart3, Users, TrendingUp, ShoppingCart } from 'lucide-react';
import { StockBatch } from '../../types';
import { inventoryService } from '../../services/inventory';

// Brand image map - reuses images from public/images/ (same as Products page)
const BRAND_IMAGES: Record<string, string> = {
  'Pepsi': '/images/pepsi.png',
  'Coca Cola': '/images/coca-cola.png',
  'Sprite': '/images/sprite.png',
  'Dew': '/images/dew.png',
  'String': '/images/string.png',
  'Fanta': '/images/fanta.png',
};

export const InventoryPage: React.FC = () => {
  const store = useStore();
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [selectedInventoryBrand, setSelectedInventoryBrand] = useState('');
  
  const [addStockForm, setAddStockForm] = useState({
    productId: '',
    quantity: '',
    buyPrice: '',
    salePrice: '',
    batchNumber: '',
    expiryDate: '',
    supplier: '',
  });

  const [adjustStockForm, setAdjustStockForm] = useState({
    reason: 'damage' as 'damage' | 'theft' | 'manual-correction',
    quantity: '',
    notes: '',
  });

  // Use store data
  const mockProducts = store.products;
  const mockStockBatches = store.stockBatches;

  useEffect(() => {
    store.fetchInitialData();
  }, [store.fetchInitialData]);

  const handleAddStock = async () => {
    if (addStockForm.productId && addStockForm.quantity && addStockForm.buyPrice) {
      try {
        await inventoryService.addBatch({
          productId: addStockForm.productId,
          quantity: parseFloat(addStockForm.quantity),
          buyPrice: parseFloat(addStockForm.buyPrice),
          salePrice: parseFloat(addStockForm.salePrice),
          batchNumber: addStockForm.batchNumber,
          expiryDate: new Date(addStockForm.expiryDate),
          supplier: addStockForm.supplier,
        });
        store.fetchInventory();
        setAddStockForm({
          productId: '',
          quantity: '',
          buyPrice: '',
          salePrice: '',
          batchNumber: '',
          expiryDate: '',
          supplier: '',
        });
        setIsAddStockModalOpen(false);
        store.addNotification('success', 'Stock added successfully');
      } catch (err: any) {
        store.addNotification('error', err.response?.data?.message || 'Failed to add stock');
      }
    }
  };

  const handleAdjustStock = async () => {
    if (selectedBatch && adjustStockForm.quantity) {
      try {
        await inventoryService.adjustStock(selectedBatch.id, {
          quantity: parseFloat(adjustStockForm.quantity),
          reason: adjustStockForm.reason,
          notes: adjustStockForm.notes,
        });
        store.fetchInventory();
        store.addNotification('success', `Stock adjusted successfully`);
        setIsAdjustStockModalOpen(false);
        setAdjustStockForm({
          reason: 'damage',
          quantity: '',
          notes: '',
        });
      } catch (err: any) {
        store.addNotification('error', err.response?.data?.message || 'Failed to adjust stock');
      }
    }
  };

  const getProductName = (productId: string) => {
    const product = mockProducts.find((p) => p.id === productId);
    return product ? `${product.brand} ${product.variant}` : 'Unknown';
  };

  const inventoryBrands = Array.from(new Set(mockProducts.map((product) => product.brand))).sort();
  const selectedInventoryVariants = selectedInventoryBrand
    ? mockProducts.filter((product) => product.brand === selectedInventoryBrand)
    : [];
  const visibleStockBatches = selectedInventoryBrand
    ? mockStockBatches.filter((batch) => mockProducts.find((product) => product.id === batch.productId)?.brand === selectedInventoryBrand)
    : mockStockBatches;

  const openAddStockForVariant = (productId: string) => {
    setAddStockForm({ ...addStockForm, productId });
    setIsAddStockModalOpen(true);
  };

  const checkExpiryStatus = (expiryDateStr: any) => {
    const expiryDate = new Date(expiryDateStr);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return { status: 'expired', label: 'Expired' };
    if (daysUntilExpiry < 30) return { status: 'warning', label: `${daysUntilExpiry}d left` };
    return { status: 'ok', label: 'OK' };
  };

  const totalStockValue = mockStockBatches.reduce(
    (sum, batch) => sum + batch.quantity * batch.salePrice,
    0
  );
  const totalBuyValue = mockStockBatches.reduce(
    (sum, batch) => sum + batch.quantity * batch.buyPrice,
    0
  );

  const sidebarItems = [
    { label: 'Dashboard', icon: <BarChart3 size={20} />, path: '/admin/dashboard' },
    { label: 'Create Sale', icon: <ShoppingCart size={20} />, path: '/worker/sales' },
    { label: 'Inventory', icon: <Package size={20} />, path: '/admin/inventory' },
    { label: 'Retailers', icon: <Users size={20} />, path: '/admin/retailers' },
    { label: 'Reports', icon: <TrendingUp size={20} />, path: '/admin/reports' },
  ];

  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <Button
            variant="secondary"
            onClick={() => store.addNotification('info', 'Select a product variant below to add stock')}
          >
            <Plus size={18} className="mr-2" />
            Add Stock
          </Button>
        </div>

        {/* Inventory Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <p className="text-gray-600 text-sm">Total PET Units</p>
            <p className="text-2xl font-bold mt-2">{mockStockBatches.reduce((sum, b) => sum + b.quantity, 0)}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Stock Cost Value</p>
            <p className="text-2xl font-bold mt-2">₨{totalBuyValue.toFixed(0)}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Retail Value</p>
            <p className="text-2xl font-bold mt-2">₨{totalStockValue.toFixed(0)}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Gross Margin</p>
            <p className="text-2xl font-bold mt-2 text-green-600">
              {((((totalStockValue - totalBuyValue) / totalStockValue) * 100) || 0).toFixed(1)}%
            </p>
          </Card>
        </div>

        <Card title="Products" className="mb-6">
          {!selectedInventoryBrand ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {inventoryBrands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setSelectedInventoryBrand(brand)}
                  className="group flex flex-col items-center p-3 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all duration-200 bg-white"
                >
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
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {BRAND_IMAGES[selectedInventoryBrand] && (
                    <img
                      src={BRAND_IMAGES[selectedInventoryBrand]}
                      alt={selectedInventoryBrand}
                      className="w-8 h-8 rounded-md object-cover"
                    />
                  )}
                  <h3 className="font-semibold text-gray-900">{selectedInventoryBrand} Variants</h3>
                </div>
                <button
                  onClick={() => setSelectedInventoryBrand('')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  ← Back to brands
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedInventoryVariants.map((product) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
                      {BRAND_IMAGES[product.brand] ? (
                        <img
                          src={BRAND_IMAGES[product.brand]}
                          alt={product.brand}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Package size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{product.brand} {product.variant}</p>
                      <p className="text-xs text-gray-500 mt-1">PET factor: {product.petConversionFactor}</p>
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => openAddStockForVariant(product.id)}
                      >
                        Add Stock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Stock Table */}
        <Card title={selectedInventoryBrand ? `${selectedInventoryBrand} Stock Batches` : 'Stock Batches'}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Batch #</th>
                  <th className="text-right py-3 px-4">PET Qty</th>
                  <th className="text-right py-3 px-4">Buy Price</th>
                  <th className="text-right py-3 px-4">Sale Price</th>
                  <th className="text-center py-3 px-4">Expiry</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleStockBatches.map((batch) => {
                  const expiryStatus = checkExpiryStatus(batch.expiryDate);
                  return (
                    <tr key={batch.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{getProductName(batch.productId)}</td>
                      <td className="py-3 px-4 font-mono text-xs">{batch.batchNumber}</td>
                      <td className="py-3 px-4 text-right">{batch.quantity}</td>
                      <td className="py-3 px-4 text-right">₨{batch.buyPrice}</td>
                      <td className="py-3 px-4 text-right">₨{batch.salePrice}</td>
                      <td className="py-3 px-4 text-center text-xs">
                        {new Date(batch.expiryDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            expiryStatus.status === 'expired'
                              ? 'danger'
                              : expiryStatus.status === 'warning'
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {expiryStatus.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBatch(batch);
                            setIsAdjustStockModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Stock Modal */}
        <Modal
          isOpen={isAddStockModalOpen}
          title="Add Stock"
          onClose={() => setIsAddStockModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAddStockModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStock}>Add Stock</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Selected Variant"
              value={addStockForm.productId}
              onChange={(e) => setAddStockForm({ ...addStockForm, productId: e.target.value })}
              disabled
              options={mockProducts
                .filter((p) => !addStockForm.productId || p.id === addStockForm.productId)
                .map((p) => ({
                value: p.id,
                label: `${p.brand} - ${p.variant}`,
              }))}
            />
            <Input
              label="Quantity (PET)"
              type="number"
              value={addStockForm.quantity}
              onChange={(e) => setAddStockForm({ ...addStockForm, quantity: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Buy Price per PET"
              type="number"
              value={addStockForm.buyPrice}
              onChange={(e) => setAddStockForm({ ...addStockForm, buyPrice: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Sale Price per PET"
              type="number"
              value={addStockForm.salePrice}
              onChange={(e) => setAddStockForm({ ...addStockForm, salePrice: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Batch Number"
              value={addStockForm.batchNumber}
              onChange={(e) => setAddStockForm({ ...addStockForm, batchNumber: e.target.value })}
              placeholder="e.g., BATCH001"
            />
            <Input
              label="Expiry Date"
              type="date"
              value={addStockForm.expiryDate}
              onChange={(e) => setAddStockForm({ ...addStockForm, expiryDate: e.target.value })}
            />
            <Input
              label="Supplier"
              value={addStockForm.supplier}
              onChange={(e) => setAddStockForm({ ...addStockForm, supplier: e.target.value })}
              placeholder="Supplier name"
            />
          </div>
        </Modal>

        {/* Adjust Stock Modal */}
        <Modal
          isOpen={isAdjustStockModalOpen}
          title="Adjust Stock"
          onClose={() => setIsAdjustStockModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAdjustStockModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdjustStock}>Adjust</Button>
            </>
          }
        >
          {selectedBatch && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">Product: <span className="font-medium">{getProductName(selectedBatch.productId)}</span></p>
                <p className="text-sm text-gray-600">Current Qty: <span className="font-medium">{selectedBatch.quantity} PET</span></p>
              </div>
              <Select
                label="Reason"
                value={adjustStockForm.reason}
                onChange={(e) => setAdjustStockForm({ ...adjustStockForm, reason: e.target.value as any })}
                options={[
                  { value: 'damage', label: 'Damage' },
                  { value: 'theft', label: 'Theft' },
                  { value: 'manual-correction', label: 'Manual Correction' },
                ]}
              />
              <Input
                label="Quantity to Adjust (PET)"
                type="number"
                value={adjustStockForm.quantity}
                onChange={(e) => setAdjustStockForm({ ...adjustStockForm, quantity: e.target.value })}
                placeholder="0"
              />
              <Input
                label="Notes"
                value={adjustStockForm.notes}
                onChange={(e) => setAdjustStockForm({ ...adjustStockForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          )}
        </Modal>
      </PageContainer>
    </Layout>
  );
};
