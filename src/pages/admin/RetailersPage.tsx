import React, { useState } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Input, Select, Modal, Badge } from '../../components/common';
import { useStore } from '../../store';
import { Users, Plus, Phone, BarChart3, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { Retailer } from '../../types';

export const RetailersPage: React.FC = () => {
  const store = useStore();
  const [isAddRetailerModalOpen, setIsAddRetailerModalOpen] = useState(false);
  
  const [addRetailerForm, setAddRetailerForm] = useState({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
    address: '',
    deliveryLocation: '',
    creditLimit: '',
    priceTier: 'standard' as 'standard' | 'premium' | 'discount',
  });

  // Mock retailer data
  const mockRetailers: Retailer[] = [
    {
      id: '1',
      shopName: 'Ali Store',
      ownerName: 'Ali Khan',
      mobileNumber: '03001234567',
      address: 'Karachi, Sindh',
      deliveryLocation: 'Clifton, Karachi',
      creditLimit: 100000,
      priceTier: 'standard',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      shopName: 'Future Shop',
      ownerName: 'Fatima Ahmed',
      mobileNumber: '03009876543',
      address: 'Lahore, Punjab',
      deliveryLocation: 'Mall Road, Lahore',
      creditLimit: 150000,
      priceTier: 'premium',
      createdAt: new Date('2024-02-20'),
    },
    {
      id: '3',
      shopName: 'Quick Store',
      ownerName: 'Hassan Malik',
      mobileNumber: '03015555555',
      address: 'Islamabad, ICT',
      creditLimit: 75000,
      priceTier: 'discount',
      createdAt: new Date('2024-03-10'),
    },
  ];

  // Mock ledger data
  const retailerLedger: Record<string, { outstanding: number; paid: number; rgbBalance: number }> = {
    '1': { outstanding: 45000, paid: 120000, rgbBalance: 50 },
    '2': { outstanding: 0, paid: 200000, rgbBalance: 75 },
    '3': { outstanding: 32000, paid: 50000, rgbBalance: 30 },
  };

  const handleAddRetailer = () => {
    if (addRetailerForm.shopName && addRetailerForm.ownerName && addRetailerForm.creditLimit) {
      const newRetailer: Retailer = {
        id: Date.now().toString(),
        shopName: addRetailerForm.shopName,
        ownerName: addRetailerForm.ownerName,
        mobileNumber: addRetailerForm.mobileNumber,
        address: addRetailerForm.address,
        deliveryLocation: addRetailerForm.deliveryLocation,
        creditLimit: parseFloat(addRetailerForm.creditLimit),
        priceTier: addRetailerForm.priceTier,
        createdAt: new Date(),
      };
      store.addRetailer(newRetailer);
      setAddRetailerForm({
        shopName: '',
        ownerName: '',
        mobileNumber: '',
        address: '',
        deliveryLocation: '',
        creditLimit: '',
        priceTier: 'standard',
      });
      setIsAddRetailerModalOpen(false);
      store.addNotification('success', 'Retailer added successfully');
    }
  };

  const getCreditStatusColor = (outstanding: number, limit: number) => {
    const percentage = (outstanding / limit) * 100;
    if (percentage === 0) return 'success';
    if (percentage < 70) return 'info';
    if (percentage < 90) return 'warning';
    return 'danger';
  };

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
          <h1 className="text-3xl font-bold">Retailer Management</h1>
          <Button onClick={() => setIsAddRetailerModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Retailer
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-gray-600 text-sm">Total Retailers</p>
            <p className="text-2xl font-bold mt-2">{mockRetailers.length}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Total Outstanding Credit</p>
            <p className="text-2xl font-bold mt-2 text-orange-600">
              ₨{Object.values(retailerLedger).reduce((sum, l) => sum + l.outstanding, 0).toFixed(0)}
            </p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Total Credit Limit</p>
            <p className="text-2xl font-bold mt-2">
              ₨{mockRetailers.reduce((sum, r) => sum + r.creditLimit, 0).toFixed(0)}
            </p>
          </Card>
        </div>

        {/* Retailers Table */}
        <Card title="Retailers">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4">Shop Name</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-left py-3 px-4">Contact</th>
                  <th className="text-right py-3 px-4">Credit Limit</th>
                  <th className="text-right py-3 px-4">Outstanding</th>
                  <th className="text-center py-3 px-4">Credit Status</th>
                  <th className="text-center py-3 px-4">RGB</th>
                  <th className="text-center py-3 px-4">Tier</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockRetailers.map((retailer) => {
                  const ledger = retailerLedger[retailer.id] || { outstanding: 0, paid: 0, rgbBalance: 0 };
                  const creditStatusColor = getCreditStatusColor(ledger.outstanding, retailer.creditLimit);
                  const usagePercentage = (ledger.outstanding / retailer.creditLimit) * 100;
                  
                  return (
                    <tr key={retailer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{retailer.shopName}</td>
                      <td className="py-3 px-4">{retailer.ownerName}</td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1 text-blue-600">
                          <Phone size={14} />
                          {retailer.mobileNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">₨{retailer.creditLimit.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-semibold">₨{ledger.outstanding.toFixed(0)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                          <div
                            className={`h-full ${
                              creditStatusColor === 'success'
                                ? 'bg-green-600'
                                : creditStatusColor === 'info'
                                ? 'bg-blue-600'
                                : creditStatusColor === 'warning'
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs mt-1">{usagePercentage.toFixed(0)}% used</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="info">{ledger.rgbBalance} units</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            retailer.priceTier === 'premium'
                              ? 'success'
                              : retailer.priceTier === 'discount'
                              ? 'danger'
                              : 'info'
                          }
                        >
                          {retailer.priceTier}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Retailer Modal */}
        <Modal
          isOpen={isAddRetailerModalOpen}
          title="Add New Retailer"
          onClose={() => setIsAddRetailerModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAddRetailerModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRetailer}>Add Retailer</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Shop Name"
              value={addRetailerForm.shopName}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, shopName: e.target.value })}
              placeholder="e.g., Ali Store"
            />
            <Input
              label="Owner Name"
              value={addRetailerForm.ownerName}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, ownerName: e.target.value })}
              placeholder="e.g., Ali Khan"
            />
            <Input
              label="Mobile Number"
              value={addRetailerForm.mobileNumber}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, mobileNumber: e.target.value })}
              placeholder="03001234567"
            />
            <Input
              label="Address"
              value={addRetailerForm.address}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, address: e.target.value })}
              placeholder="City, Province"
            />
            <Input
              label="Delivery Location"
              value={addRetailerForm.deliveryLocation}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, deliveryLocation: e.target.value })}
              placeholder="Specific delivery point"
            />
            <Input
              label="Credit Limit (₨)"
              type="number"
              value={addRetailerForm.creditLimit}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, creditLimit: e.target.value })}
              placeholder="100000"
            />
            <Select
              label="Price Tier"
              value={addRetailerForm.priceTier}
              onChange={(e) => setAddRetailerForm({ ...addRetailerForm, priceTier: e.target.value as any })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'premium', label: 'Premium (Discount)' },
                { value: 'discount', label: 'Discount (Special Bulk)' },
              ]}
            />
          </div>
        </Modal>
      </PageContainer>
    </Layout>
  );
};
