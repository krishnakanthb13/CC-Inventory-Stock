'use client';

import { useState, useEffect, useMemo } from 'react';
import BrandSettingsTab from '../components/BrandSettingsTab';
import ShippingExchangeTab from '../components/ShippingExchangeTab';
import TaxonomyTab from '../components/TaxonomyTab';
import RawJsonTab from '../components/RawJsonTab';
import {
  Shirt,
  Crown,
  Truck,
  Tags,
  FileCode,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

const DEFAULT_CATEGORIES = ['Club', 'Country', 'Retro'];
const DEFAULT_SUB_CATEGORIES = [
  'Player Version',
  'Master Copy',
  'Fan Version Set',
  'Embroidered',
  'Sublimation'
];
const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function AdminPage() {
  const [data, setData] = useState({ products: [], brand: {}, categories: [], subCategories: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState('jerseys'); // 'jerseys' | 'brand' | 'shipping' | 'taxonomy' | 'raw'

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form State
  const initialForm = {
    name: '',
    category: 'Club',
    subCategory: 'Player Version',
    team: '',
    season: '2023/24',
    price: 1499,
    mrp: 2499,
    stockQuantity: 20,
    stockStatus: 'In Stock',
    sizes: ['S', 'M', 'L', 'XL'],
    stockBySize: { S: 5, M: 5, L: 5, XL: 5 },
    images: ['https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=80'],
    description: '',
    featured: false,
    isBestSeller: false
  };

  const [formData, setFormData] = useState(initialForm);

  // Fetch initial data
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      const json = await res.json();
      if (res.ok && json.products) {
        setData(json);
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        showNotice(`Failed to load: ${json.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      showNotice(`Failed to load products: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    return (data.products || []).filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.team?.toLowerCase().includes(search.toLowerCase()) ||
        item.season?.toLowerCase().includes(search.toLowerCase());

      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesSubCat = subCategoryFilter === 'All' || item.subCategory === subCategoryFilter;
      const matchesStock =
        stockFilter === 'All' ||
        (stockFilter === 'In Stock' && item.stockStatus === 'In Stock') ||
        (stockFilter === 'Low Stock' && item.stockStatus === 'Low Stock') ||
        (stockFilter === 'Out of Stock' && item.stockStatus === 'Out of Stock');

      return matchesSearch && matchesCat && matchesSubCat && matchesStock;
    });
  }, [data.products, search, categoryFilter, subCategoryFilter, stockFilter]);

  // Statistics
  const stats = useMemo(() => {
    const list = data.products || [];
    const total = list.length;
    const inStock = list.filter((p) => p.stockStatus === 'In Stock').length;
    const lowStock = list.filter((p) => p.stockStatus === 'Low Stock').length;
    const outStock = list.filter((p) => p.stockStatus === 'Out of Stock').length;
    const totalValue = list.reduce((acc, curr) => acc + (curr.price || 0) * (curr.stockQuantity || 0), 0);

    return { total, inStock, lowStock, outStock, totalValue };
  }, [data.products]);

  // Dynamic taxonomy options derived from products.json
  const availableCategories = useMemo(() => {
    if (data.categories && data.categories.length > 0) {
      return data.categories.map((c) => (typeof c === 'string' ? c : c.name));
    }
    return DEFAULT_CATEGORIES;
  }, [data.categories]);

  const availableSubCategories = useMemo(() => {
    if (data.subCategories && data.subCategories.length > 0) {
      return data.subCategories.map((s) => (typeof s === 'string' ? s : s.name));
    }
    return DEFAULT_SUB_CATEGORIES;
  }, [data.subCategories]);

  // Quick Stock Status toggle
  const handleQuickStockChange = async (productId, newStatus) => {
    try {
      const inStock = newStatus !== 'Out of Stock';
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, stockStatus: newStatus, inStock })
      });

      const updatedJson = await res.json();
      if (!res.ok) throw new Error(updatedJson.error || 'Server error');

      setData((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === productId ? updatedJson.product : p))
      }));
      setLastSyncTime(new Date().toLocaleTimeString());
      showNotice(`Stock status updated for ${updatedJson.product.name}`);
    } catch (err) {
      showNotice(`Failed to update stock: ${err.message}`, 'error');
    }
  };

  // Add or Edit Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSyncing(true);

    try {
      if (editingProduct) {
        // Edit existing
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, updates: formData })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Server error');

        setData((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === editingProduct.id ? json.product : p))
        }));
        showNotice(`Updated ${formData.name}`);
      } else {
        // Add new
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: formData })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Server error');

        setData((prev) => ({
          ...prev,
          products: [json.product, ...prev.products]
        }));
        showNotice(`Added ${json.product.name}`);
      }

      setIsAddOpen(false);
      setEditingProduct(null);
      setFormData(initialForm);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Error saving product: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Delete product
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/products?id=${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');

      setData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== deleteTarget.id)
      }));
      showNotice(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Failed to delete product: ${err.message}`, 'error');
    }
  };

  // Trigger manual sync/re-export
  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync: true, data })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      if (json.data) {
        setData(json.data);
      }
      showNotice(`Successfully synced ${json.data?.products?.length ?? data.products.length} products to CC-Hosting-Public/data/products.json!`);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Sync error: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    const activeSizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['S', 'M', 'L', 'XL'];
    const stockMap = {};
    activeSizes.forEach((sz) => {
      stockMap[sz] = p.stockBySize?.[sz] !== undefined
        ? Number(p.stockBySize[sz])
        : Math.max(0, Math.floor((p.stockQuantity ?? 10) / activeSizes.length));
    });
    const computedTotal = Object.values(stockMap).reduce((a, b) => a + b, 0);

    setFormData({
      name: p.name || '',
      category: p.category || 'Club',
      subCategory: p.subCategory || 'Player Version',
      team: p.team || '',
      season: p.season || '',
      price: p.price || 0,
      mrp: p.mrp || 0,
      stockQuantity: computedTotal,
      stockStatus: computedTotal > 0 ? (p.stockStatus || 'In Stock') : 'Out of Stock',
      sizes: activeSizes,
      stockBySize: p.stockBySize ? { ...p.stockBySize } : stockMap,
      images: p.images || [''],
      description: p.description || '',
      featured: Boolean(p.featured),
      isBestSeller: Boolean(p.isBestSeller)
    });
    setIsAddOpen(true);
  };

  // Save Brand & Store Settings
  const handleSaveBrand = async (brandData) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBrand', brand: brandData })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      if (json.data) setData(json.data);
      showNotice('Brand & store profile updated and saved to products.json!');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Failed to save brand settings: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Save Shipping & Exchange Rules
  const handleSaveShipping = async ({ shipping, exchange }) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateShippingExchange', shipping, exchange })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      if (json.data) setData(json.data);
      showNotice('Shipping rates & exchange policy saved to products.json!');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Failed to save shipping & exchanges: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Save Categories & Quality Grades
  const handleSaveTaxonomy = async ({ categories, subCategories }) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateTaxonomy', categories, subCategories })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      if (json.data) setData(json.data);
      showNotice('Categories and quality grades saved to products.json!');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Failed to save taxonomy: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Save Raw JSON
  const handleSaveRawJson = async (rawJsonText) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRawJson', rawJson: rawJsonText })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      if (json.data) setData(json.data);
      showNotice('Raw JSON validated and applied to products.json!');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      showNotice(`Failed to save raw JSON: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const getTabStyle = (isActive) => ({
    padding: '10px 18px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: isActive ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
    backgroundColor: isActive ? 'var(--gold-dim)' : 'var(--bg-surface)',
    color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Notification Toast */}
      {notice && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '14px 22px',
            borderRadius: '12px',
            backgroundColor: notice.type === 'error' ? '#7f1d1d' : '#143823',
            border: `1px solid ${notice.type === 'error' ? '#ef4444' : '#22c55e'}`,
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {notice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.msg}</span>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/icon.jpeg"
            alt="Crown & Cross Emblem"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              border: '2px solid var(--gold-primary)',
              objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(200, 169, 106, 0.2)'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="serif-title" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--gold-primary)' }}>
                Crown & Cross
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: 'var(--gold-dim)',
                  color: 'var(--gold-primary)',
                  border: '1px solid rgba(200, 169, 106, 0.3)'
                }}
              >
                Inventory Admin
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Directly syncs to <code>CC-Hosting-Public/public/data/products.json</code>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', marginRight: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Live Storefront File</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span className="pulse-dot" />
              <span style={{ fontSize: '12px', color: 'var(--status-instock)', fontWeight: 600 }}>
                Synced {lastSyncTime ? `@ ${lastSyncTime}` : ''}
              </span>
            </div>
          </div>

          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            title="Open Live Public Storefront (Port 3001)"
          >
            <ExternalLink size={14} color="var(--gold-primary)" />
            <span>View Store</span>
          </a>

          <button
            onClick={handleFullSync}
            disabled={syncing}
            style={{
              padding: '10px 18px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              color: 'var(--text-primary)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: syncing ? 0.7 : 1
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Re-Sync JSON'}
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData(initialForm);
              setIsAddOpen(true);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--gold-primary)',
              color: '#0e1410',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(200, 169, 106, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> Add New Jersey
          </button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '14px',
          marginBottom: '26px',
          overflowX: 'auto'
        }}
      >
        <button
          onClick={() => setActiveTab('jerseys')}
          style={getTabStyle(activeTab === 'jerseys')}
        >
          <Shirt size={16} /> Jerseys Catalog ({stats.total})
        </button>

        <button
          onClick={() => setActiveTab('brand')}
          style={getTabStyle(activeTab === 'brand')}
        >
          <Crown size={16} /> Brand & Store Profile
        </button>

        <button
          onClick={() => setActiveTab('shipping')}
          style={getTabStyle(activeTab === 'shipping')}
        >
          <Truck size={16} /> Shipping & Exchanges
        </button>

        <button
          onClick={() => setActiveTab('taxonomy')}
          style={getTabStyle(activeTab === 'taxonomy')}
        >
          <Tags size={16} /> Categories & Quality Grades ({availableCategories.length})
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          style={getTabStyle(activeTab === 'raw')}
        >
          <FileCode size={16} /> Raw JSON & Backups
        </button>
      </div>

      {/* Tab 1: Jerseys & Inventory Table */}
      {activeTab === 'jerseys' && (
        <>
          {/* KPI Stats Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}
          >
            <div className="admin-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Total Jerseys
                </span>
                <Shirt size={16} color="var(--gold-primary)" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
                {stats.total}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Across Club, Country, Retro</span>
            </div>

            <div className="admin-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  In Stock
                </span>
                <PackageCheck size={16} color="var(--status-instock)" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--status-instock)' }}>
                {stats.inStock}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ready for immediate dispatch</span>
            </div>

            <div className="admin-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Low / Out of Stock
                </span>
                <AlertTriangle size={16} color={stats.outStock > 0 ? 'var(--status-out)' : 'var(--status-low)'} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: stats.outStock > 0 ? 'var(--status-out)' : 'var(--status-low)' }}>
                {stats.lowStock + stats.outStock}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{stats.outStock} completely sold out</span>
            </div>

            <div className="admin-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Total Inventory Value
                </span>
                <TrendingUp size={16} color="var(--gold-primary)" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--gold-primary)' }}>
                ₹{stats.totalValue.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Based on retail selling prices</span>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div
            className="admin-card"
            style={{
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 300px', minWidth: '240px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <Search size={15} color="var(--text-muted)" />
              </div>
              <input
                type="text"
                placeholder="Search jerseys by name, team, or season..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Category Filter */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
            {['All', ...availableCategories].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  backgroundColor: categoryFilter === cat ? 'var(--gold-primary)' : 'transparent',
                  color: categoryFilter === cat ? '#0e1410' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sub-Category Filter */}
          <select
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: '10px',
              fontSize: '12px',
              outline: 'none'
            }}
          >
            <option value="All">All Quality Types</option>
            {availableSubCategories.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: '10px',
              fontSize: '12px',
              outline: 'none'
            }}
          >
            <option value="All">All Stock Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Jersey Info</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Category & Quality</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Price</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Sizes</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Stock Qty</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Stock Status</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading jersey inventory...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No jerseys matched your filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      className="table-row-hover"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Jersey Preview & Title */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80'}
                            alt={p.name}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {p.team} • {p.season}
                              {p.featured && (
                                <span style={{ marginLeft: '6px', color: 'var(--gold-primary)', fontWeight: 700 }}>
                                  ★ Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Quality */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(200, 169, 106, 0.12)',
                              color: 'var(--gold-primary)',
                              width: 'fit-content'
                            }}
                          >
                            {p.category}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {p.subCategory}
                          </span>
                        </div>
                      </td>

                      {/* Price & MRP */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{p.price}</div>
                        {p.mrp && p.mrp > p.price && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{p.mrp}
                          </div>
                        )}
                      </td>

                      {/* Sizes */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(p.sizes || []).map((sz) => (
                            <span
                              key={sz}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {sz}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Stock Qty */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                            {p.stockQuantity ?? 0} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
                          </span>
                          {p.stockBySize && Object.keys(p.stockBySize).length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {Object.entries(p.stockBySize).map(([sz, qty]) => (
                                <span
                                  key={sz}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: qty > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: qty > 0 ? '#4ade80' : '#ef4444',
                                    border: `1px solid ${qty > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                  }}
                                  title={`Size ${sz}: ${qty} in stock`}
                                >
                                  {sz}:{qty}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Quick Status Dropdown */}
                      <td style={{ padding: '14px 16px' }}>
                        <select
                          value={p.stockStatus || 'In Stock'}
                          onChange={(e) => handleQuickStockChange(p.id, e.target.value)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor:
                              p.stockStatus === 'In Stock'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : p.stockStatus === 'Low Stock'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              p.stockStatus === 'In Stock'
                                ? 'var(--status-instock)'
                                : p.stockStatus === 'Low Stock'
                                ? 'var(--status-low)'
                                : 'var(--status-out)',
                            border: `1px solid ${
                              p.stockStatus === 'In Stock'
                                ? 'rgba(34, 197, 94, 0.4)'
                                : p.stockStatus === 'Low Stock'
                                ? 'rgba(234, 179, 8, 0.4)'
                                : 'rgba(239, 68, 68, 0.4)'
                            }`
                          }}
                        >
                          <option value="In Stock">In Stock</option>
                          <option value="Low Stock">Low Stock</option>
                          <option value="Out of Stock">Out of Stock</option>
                        </select>
                      </td>

                      {/* Action buttons */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditModal(p)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            title="Delete Jersey"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: 'var(--status-out)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Tab 2: Brand & Store Identity */}
      {activeTab === 'brand' && (
        <BrandSettingsTab
          brand={data.brand}
          onSave={handleSaveBrand}
          syncing={syncing}
        />
      )}

      {/* Tab 3: Shipping & Exchanges */}
      {activeTab === 'shipping' && (
        <ShippingExchangeTab
          shipping={data.brand?.shipping}
          exchange={data.brand?.exchange}
          onSave={handleSaveShipping}
          syncing={syncing}
        />
      )}

      {/* Tab 4: Categories & Quality Grades */}
      {activeTab === 'taxonomy' && (
        <TaxonomyTab
          categories={data.categories}
          subCategories={data.subCategories}
          onSave={handleSaveTaxonomy}
          syncing={syncing}
        />
      )}

      {/* Tab 5: Raw JSON & Backups */}
      {activeTab === 'raw' && (
        <RawJsonTab
          data={data}
          onSave={handleSaveRawJson}
          syncing={syncing}
        />
      )}

      {/* Add / Edit Product Modal */}
      {isAddOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-active)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px 32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="serif-title" style={{ fontSize: '20px', color: 'var(--gold-primary)' }}>
                {editingProduct ? 'Edit Football Jersey' : 'Add New Football Jersey'}
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Jersey Full Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Real Madrid 23/24 Home Kit — Bellingham #5"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Team / Country *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Real Madrid"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Season / Era
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2023/24 or 1998/99 Retro"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Primary Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Quality / Sub-Category *
                  </label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    {availableSubCategories.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Original MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Total Stock (Auto-Calculated)
                  </label>
                  <input
                    type="number"
                    min="0"
                    readOnly
                    value={formData.stockQuantity || 0}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--gold-primary)',
                      fontSize: '13px',
                      fontWeight: 800
                    }}
                  />
                </div>
              </div>

              {/* Size-Specific Stock Quantity Matrix */}
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Size-Specific Stock Quantity Matrix
                    </span>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Set individual stock units per size. Sizes with 0 units will automatically show as "Sold Out" on the public store.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: (formData.stockQuantity || 0) > 0 ? '#22c55e' : '#ef4444',
                      backgroundColor: (formData.stockQuantity || 0) > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: `1px solid ${(formData.stockQuantity || 0) > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}
                  >
                    {formData.stockQuantity || 0} Total Units Available
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '10px', marginTop: '12px' }}>
                  {AVAILABLE_SIZES.map((sz) => {
                    const isChecked = formData.sizes.includes(sz);
                    const currentQty = formData.stockBySize?.[sz] !== undefined ? formData.stockBySize[sz] : 0;

                    return (
                      <div
                        key={sz}
                        style={{
                          backgroundColor: isChecked ? 'rgba(200, 169, 106, 0.07)' : 'var(--bg-surface)',
                          border: `1px solid ${isChecked ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                          borderRadius: '12px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              let nextSizes;
                              let nextStock = { ...(formData.stockBySize || {}) };
                              if (isChecked) {
                                nextSizes = formData.sizes.filter((s) => s !== sz);
                                nextStock[sz] = 0;
                              } else {
                                nextSizes = [...formData.sizes, sz];
                                if (!nextStock[sz] || nextStock[sz] === 0) {
                                  nextStock[sz] = 5;
                                }
                              }
                              const sumQty = Object.entries(nextStock).reduce((acc, [s, q]) => nextSizes.includes(s) ? acc + Number(q || 0) : acc, 0);
                              setFormData({
                                ...formData,
                                sizes: nextSizes,
                                stockBySize: nextStock,
                                stockQuantity: sumQty,
                                stockStatus: sumQty > 0 ? 'In Stock' : 'Out of Stock'
                              });
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              backgroundColor: isChecked ? 'var(--gold-primary)' : 'var(--bg-elevated)',
                              color: isChecked ? '#0e1410' : 'var(--text-secondary)',
                              border: `1px solid ${isChecked ? 'var(--gold-primary)' : 'var(--border-subtle)'}`
                            }}
                            title={isChecked ? 'Click to disable size' : 'Click to enable size'}
                          >
                            Size {sz}
                          </button>

                          <span style={{ fontSize: '10px', fontWeight: 700, color: isChecked ? (currentQty > 0 ? '#4ade80' : '#ef4444') : 'var(--text-muted)' }}>
                            {isChecked ? (currentQty > 0 ? `${currentQty} in stock` : 'Sold Out') : 'Off'}
                          </span>
                        </div>

                        {isChecked && (
                          <div style={{ marginTop: '4px' }}>
                            <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>
                              Qty in Stock:
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={currentQty}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const nextStock = { ...(formData.stockBySize || {}), [sz]: val };
                                const sumQty = Object.entries(nextStock).reduce((acc, [s, q]) => formData.sizes.includes(s) ? acc + Number(q || 0) : acc, 0);
                                setFormData({
                                  ...formData,
                                  stockBySize: nextStock,
                                  stockQuantity: sumQty,
                                  stockStatus: sumQty > 0 ? 'In Stock' : 'Out of Stock'
                                });
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                fontWeight: 700,
                                textAlign: 'center'
                              }}
                              placeholder="0"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Image URLs (Google Drive direct link or web image URL)
                </label>
                <textarea
                  rows="2"
                  value={formData.images.join('\n')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      images: e.target.value.split('\n').filter((url) => url.trim() !== '')
                    })
                  }
                  placeholder="Paste image URLs (one per line)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Description / Story
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Jersey details, fabric technology, fit advice..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  />
                  Featured in Storefront Hero
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isBestSeller}
                    onChange={(e) => setFormData({ ...formData, isBestSeller: e.target.checked })}
                  />
                  Mark as Best Seller
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--gold-primary)',
                    color: '#0e1410',
                    border: 'none',
                    fontWeight: 700,
                    cursor: syncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {syncing ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid #7f1d1d',
              borderRadius: '18px',
              padding: '24px 28px',
              maxWidth: '440px',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#ef4444' }}>
              <AlertTriangle size={36} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Confirm Deletion</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> from the inventory and storefront JSON?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '9px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: '9px 20px',
                  borderRadius: '9px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
