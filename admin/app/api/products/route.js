export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
const { getProductsData, saveProductsData, createSlug } = require('../../../lib/generateJson');

// Optional shared-secret auth. When ADMIN_TOKEN is unset the API stays open
// (single-user local tool default); set it to lock down mutations from other
// machines on the network. The admin UI sends it via NEXT_PUBLIC_ADMIN_TOKEN.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function requireAuth(request) {
  if (!ADMIN_TOKEN) return null;
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${ADMIN_TOKEN}`) return null;
  return NextResponse.json({ error: 'Unauthorized: missing or invalid admin token' }, { status: 401 });
}

// --- Validation / normalization helpers -------------------------------------

function normalizeStockBySize(sb) {
  // Returns a cleaned { size: nonNegativeInteger } map, or null when the
  // payload is not a plain object (caller decides how to react).
  if (!sb || typeof sb !== 'object' || Array.isArray(sb)) return null;
  const out = {};
  for (const [size, qty] of Object.entries(sb)) {
    const n = Number(qty);
    out[size] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return out;
}

function sumStock(stockBySize) {
  return Object.values(stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0);
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return null;
  const filtered = images.filter((u) => typeof u === 'string' && u.trim() !== '');
  return filtered.length > 0 ? filtered : null;
}

function normalizeSizes(sizes) {
  if (!Array.isArray(sizes)) return null;
  const cleaned = sizes.filter((s) => typeof s === 'string' && s.trim() !== '');
  return cleaned.length > 0 ? [...new Set(cleaned)] : null;
}

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=80';

export async function GET(request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const data = getProductsData();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const payload = await request.json();

    // 1. Full data replacement or sync
    if (payload.fullSync) {
      if (payload.data && Array.isArray(payload.data.products) && payload.data.products.length > 0) {
        saveProductsData(payload.data);
        return NextResponse.json({ success: true, message: 'All data synced successfully', data: payload.data });
      } else {
        // Fallback reload from disk if payload data is empty
        const freshData = getProductsData();
        return NextResponse.json({ success: true, message: 'Catalog reloaded from disk', data: freshData });
      }
    }

    // 2. Action: Update Brand Information
    if (payload.action === 'updateBrand') {
      const data = getProductsData();
      data.brand = {
        ...data.brand,
        ...payload.brand,
        shipping: {
          ...(data.brand?.shipping || {}),
          ...(payload.brand?.shipping || {})
        },
        exchange: {
          ...(data.brand?.exchange || {}),
          ...(payload.brand?.exchange || {})
        }
      };
      saveProductsData(data);
      return NextResponse.json({ success: true, message: 'Brand & store settings updated successfully', data });
    }

    // 3. Action: Update Shipping & Exchange Rules
    if (payload.action === 'updateShippingExchange') {
      const data = getProductsData();
      data.brand = {
        ...data.brand,
        shipping: {
          ...(data.brand?.shipping || {}),
          ...(payload.shipping || {})
        },
        exchange: {
          ...(data.brand?.exchange || {}),
          ...(payload.exchange || {})
        }
      };
      saveProductsData(data);
      return NextResponse.json({ success: true, message: 'Shipping & exchange rules saved successfully', data });
    }

    // 4. Action: Update Categories & Sub-Categories (Taxonomy)
    //    - Renames cascade to products (matched by taxonomy id).
    //    - Removing an entry still referenced by products is rejected (409)
    //      unless payload.force === true.
    if (payload.action === 'updateTaxonomy') {
      const data = getProductsData();

      const entryId = (entry) => (typeof entry === 'string' ? entry : entry && (entry.id ?? entry.name));
      const entryName = (entry) => (typeof entry === 'string' ? entry : entry && entry.name);

      const applyTaxonomy = (field, oldList, newList) => {
        const oldEntries = Array.isArray(oldList) ? oldList : [];
        const newEntries = Array.isArray(newList) ? newList : [];

        if (!payload.force) {
          const newIds = new Set(newEntries.map(entryId));
          const removedNames = oldEntries
            .filter((oe) => !newIds.has(entryId(oe)))
            .map(entryName)
            .filter(Boolean);
          const inUse = [...new Set(removedNames)].filter((name) =>
            data.products.some((p) => p[field] === name)
          );
          if (inUse.length > 0) {
            return NextResponse.json(
              {
                error: `Cannot remove ${field === 'category' ? 'categories' : 'quality grades'} still used by products: ${inUse.join(
                  ', '
                )}. Rename them instead, or reassign the affected products first.`
              },
              { status: 409 }
            );
          }
        }

        // Cascade renames (same id, different display name) to products
        newEntries.forEach((ne) => {
          const oldEntry = oldEntries.find((oe) => entryId(oe) === entryId(ne));
          const oldName = oldEntry ? entryName(oldEntry) : null;
          const newName = entryName(ne);
          if (oldName && newName && oldName !== newName) {
            data.products.forEach((p) => {
              if (p[field] === oldName) {
                p[field] = newName;
                if (field === 'category') p.isRetro = newName === 'Retro';
              }
            });
          }
        });
        return null;
      };

      if (Array.isArray(payload.categories)) {
        const blocked = applyTaxonomy('category', data.categories, payload.categories);
        if (blocked) return blocked;
        data.categories = payload.categories;
      }
      if (Array.isArray(payload.subCategories)) {
        const blocked = applyTaxonomy('subCategory', data.subCategories, payload.subCategories);
        if (blocked) return blocked;
        data.subCategories = payload.subCategories;
      }

      saveProductsData(data);
      return NextResponse.json({ success: true, message: 'Categories and quality grades updated successfully', data });
    }

    // 5. Action: Direct Raw JSON overwrite with validation
    if (payload.action === 'updateRawJson') {
      if (!payload.rawJson) {
        return NextResponse.json({ error: 'No JSON payload provided' }, { status: 400 });
      }
      let parsed;
      try {
        parsed = typeof payload.rawJson === 'string' ? JSON.parse(payload.rawJson) : payload.rawJson;
      } catch (parseErr) {
        return NextResponse.json({ error: `JSON Parse Error: ${parseErr.message}` }, { status: 400 });
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.products)) {
        return NextResponse.json({ error: 'Invalid schema: Root must contain a "products" array' }, { status: 400 });
      }
      if (!parsed.products.every((p) => p && typeof p === 'object')) {
        return NextResponse.json({ error: 'Invalid schema: every entry in "products" must be an object' }, { status: 400 });
      }

      saveProductsData(parsed);
      return NextResponse.json({ success: true, message: 'Raw JSON validated and applied to products.json', data: parsed });
    }

    const data = getProductsData();

    // Otherwise add new product
    const product = payload.product;
    if (!product || typeof product.name !== 'string' || product.name.trim() === '') {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'A valid non-negative price is required' }, { status: 400 });
    }

    // ID: client-supplied ids must be unique; generated ids are collision-resistant
    const requestedId = typeof product.id === 'string' && product.id.trim() !== '' ? product.id : null;
    if (requestedId) {
      if (data.products.some((p) => p.id === requestedId)) {
        return NextResponse.json({ error: `Product id "${requestedId}" already exists` }, { status: 409 });
      }
    }
    const newId = requestedId || `cc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Slug: unique — append a numeric suffix on collision
    let newSlug = product.slug || createSlug(product.name);
    if (newSlug) {
      let candidate = newSlug;
      let suffix = 2;
      while (data.products.some((p) => p.slug === candidate)) {
        candidate = `${newSlug}-${suffix}`;
        suffix += 1;
      }
      newSlug = candidate;
    }

    const sizes = normalizeSizes(product.sizes) || ['S', 'M', 'L', 'XL'];

    let stockBySize = normalizeStockBySize(product.stockBySize);
    if (!stockBySize || Object.keys(stockBySize).length === 0) {
      const perSize = Math.max(0, Math.floor((Number(product.stockQuantity) || 10) / sizes.length));
      stockBySize = {};
      sizes.forEach((s) => { stockBySize[s] = perSize; });
    }
    const totalQty = sumStock(stockBySize);

    const mrp = product.mrp !== undefined ? Number(product.mrp) : price * 1.5;

    const newProduct = {
      id: newId,
      slug: newSlug,
      name: product.name,
      category: product.category || 'Club',
      subCategory: product.subCategory || 'Fan Version Set',
      team: product.team || '',
      season: product.season || '2023/24',
      price,
      mrp: Number.isFinite(mrp) && mrp >= 0 ? mrp : price * 1.5,
      inStock: totalQty > 0,
      stockStatus: totalQty > 0 ? (product.stockStatus || 'In Stock') : 'Out of Stock',
      stockQuantity: totalQty,
      sizes,
      stockBySize,
      images: normalizeImages(product.images) || [DEFAULT_FALLBACK_IMAGE],
      featured: Boolean(product.featured),
      isBestSeller: Boolean(product.isBestSeller),
      isRetro: (product.category || 'Club') === 'Retro',
      description: typeof product.description === 'string' ? product.description : ''
    };

    data.products.unshift(newProduct);
    saveProductsData(data);

    return NextResponse.json({ success: true, message: 'Product added successfully', product: newProduct, total: data.products.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const payload = await request.json();
    const { id, updates } = payload;
    if (!id || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Product ID and updates are required' }, { status: 400 });
    }

    const data = getProductsData();
    const index = data.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existing = data.products[index];

    // Validate field types before merging
    if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim() === '')) {
      return NextResponse.json({ error: 'Product name must be a non-empty string' }, { status: 400 });
    }
    if (updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 });
    }
    if (updates.mrp !== undefined && (!Number.isFinite(Number(updates.mrp)) || Number(updates.mrp) < 0)) {
      return NextResponse.json({ error: 'MRP must be a non-negative number' }, { status: 400 });
    }
    if (updates.sizes !== undefined) {
      const sizes = normalizeSizes(updates.sizes);
      if (!sizes) {
        return NextResponse.json({ error: 'Sizes must be a non-empty array of strings' }, { status: 400 });
      }
      updates.sizes = sizes;
    }
    if (updates.images !== undefined) {
      const images = normalizeImages(updates.images);
      if (!images) {
        return NextResponse.json({ error: 'Images must be a non-empty array of URL strings' }, { status: 400 });
      }
      updates.images = images;
    }

    let stockBySize = existing.stockBySize;
    let computedStock = typeof existing.stockQuantity === 'number' ? existing.stockQuantity : 0;

    if (updates.stockBySize !== undefined) {
      const normalized = normalizeStockBySize(updates.stockBySize);
      if (normalized === null) {
        return NextResponse.json({ error: 'stockBySize must be an object mapping sizes to quantities' }, { status: 400 });
      }
      stockBySize = normalized;
      computedStock = sumStock(stockBySize);
    } else if (updates.stockQuantity !== undefined) {
      const qty = Number(updates.stockQuantity);
      if (!Number.isFinite(qty) || qty < 0) {
        return NextResponse.json({ error: 'stockQuantity must be a non-negative number' }, { status: 400 });
      }
      computedStock = Math.floor(qty);
    }

    const finalCategory = updates.category !== undefined ? updates.category : existing.category;

    data.products[index] = {
      ...existing,
      ...updates,
      price: updates.price !== undefined ? Number(updates.price) : existing.price,
      mrp: updates.mrp !== undefined ? Number(updates.mrp) : existing.mrp,
      stockQuantity: computedStock,
      stockBySize,
      inStock: computedStock > 0,
      stockStatus:
        computedStock > 0
          ? updates.stockStatus || existing.stockStatus || 'In Stock'
          : 'Out of Stock',
      isRetro: finalCategory === 'Retro'
    };

    saveProductsData(data);
    return NextResponse.json({ success: true, message: 'Product updated', product: data.products[index] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const data = getProductsData();
    const initialCount = data.products.length;
    data.products = data.products.filter((p) => p.id !== id);

    if (data.products.length === initialCount) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    saveProductsData(data);
    return NextResponse.json({ success: true, message: 'Product deleted', remaining: data.products.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const payload = await request.json();
    const { id, stockStatus, inStock, stockQuantity, stockBySize } = payload;
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const data = getProductsData();
    const product = data.products.find((p) => p.id === id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (stockBySize !== undefined) {
      const normalized = normalizeStockBySize(stockBySize);
      if (normalized === null) {
        return NextResponse.json({ error: 'stockBySize must be an object mapping sizes to quantities' }, { status: 400 });
      }
      product.stockBySize = normalized;
      product.stockQuantity = sumStock(normalized);
      product.inStock = product.stockQuantity > 0;
      product.stockStatus = product.stockQuantity > 0 ? stockStatus || product.stockStatus || 'In Stock' : 'Out of Stock';
    } else {
      if (stockStatus !== undefined) product.stockStatus = stockStatus;
      if (inStock !== undefined) product.inStock = Boolean(inStock);
      if (stockQuantity !== undefined) {
        const qty = Number(stockQuantity);
        if (!Number.isFinite(qty) || qty < 0) {
          return NextResponse.json({ error: 'stockQuantity must be a non-negative number' }, { status: 400 });
        }
        product.stockQuantity = Math.floor(qty);
        product.inStock = product.stockQuantity > 0;
        if (product.stockQuantity === 0) product.stockStatus = 'Out of Stock';
      }
    }

    saveProductsData(data);
    return NextResponse.json({ success: true, message: 'Stock status updated', product });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
