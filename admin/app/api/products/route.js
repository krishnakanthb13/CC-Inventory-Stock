export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
const { getProductsData, saveProductsData, createSlug } = require('../../../lib/generateJson');

export async function GET() {
  try {
    const data = getProductsData();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
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
    if (payload.action === 'updateTaxonomy') {
      const data = getProductsData();
      if (Array.isArray(payload.categories)) {
        data.categories = payload.categories;
      }
      if (Array.isArray(payload.subCategories)) {
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

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) {
        return NextResponse.json({ error: 'Invalid schema: Root must contain a "products" array' }, { status: 400 });
      }

      saveProductsData(parsed);
      return NextResponse.json({ success: true, message: 'Raw JSON validated and applied to products.json', data: parsed });
    }

    const data = getProductsData();

    // Otherwise add new product
    const product = payload.product;
    if (!product || !product.name || !product.price) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const newId = product.id || `cc-${String(Date.now()).slice(-6)}`;
    const newSlug = product.slug || createSlug(product.name);

    const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : ['S', 'M', 'L', 'XL'];
    let stockBySize = product.stockBySize && typeof product.stockBySize === 'object'
      ? { ...product.stockBySize }
      : {};
    if (Object.keys(stockBySize).length === 0) {
      const perSize = Math.max(0, Math.floor((Number(product.stockQuantity) || 10) / sizes.length));
      sizes.forEach((s) => { stockBySize[s] = perSize; });
    }
    const totalQty = Object.values(stockBySize).reduce((a, b) => Number(a || 0) + Number(b || 0), 0);

    const newProduct = {
      id: newId,
      slug: newSlug,
      name: product.name,
      category: product.category || 'Club',
      subCategory: product.subCategory || 'Fan Version Set',
      team: product.team || '',
      season: product.season || '2023/24',
      price: Number(product.price) || 0,
      mrp: Number(product.mrp) || Number(product.price) * 1.5,
      inStock: totalQty > 0,
      stockStatus: totalQty > 0 ? (product.stockStatus || 'In Stock') : 'Out of Stock',
      stockQuantity: totalQty,
      sizes,
      stockBySize,
      images: Array.isArray(product.images) && product.images.length > 0 
        ? product.images 
        : ['https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=80'],
      featured: Boolean(product.featured),
      isBestSeller: Boolean(product.isBestSeller),
      isRetro: product.category === 'Retro',
      description: product.description || ''
    };

    data.products.unshift(newProduct);
    saveProductsData(data);

    return NextResponse.json({ success: true, message: 'Product added successfully', product: newProduct, total: data.products.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const payload = await request.json();
    const { id, updates } = payload;
    if (!id || !updates) {
      return NextResponse.json({ error: 'Product ID and updates are required' }, { status: 400 });
    }

    const data = getProductsData();
    const index = data.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let computedStock = data.products[index].stockQuantity ?? 10;
    let stockBySize = updates.stockBySize !== undefined ? updates.stockBySize : data.products[index].stockBySize;

    if (stockBySize && typeof stockBySize === 'object' && Object.keys(stockBySize).length > 0) {
      computedStock = Object.values(stockBySize).reduce((a, b) => Number(a || 0) + Number(b || 0), 0);
    } else if (updates.stockQuantity !== undefined) {
      computedStock = Number(updates.stockQuantity);
    }

    data.products[index] = {
      ...data.products[index],
      ...updates,
      price: updates.price ? Number(updates.price) : data.products[index].price,
      mrp: updates.mrp ? Number(updates.mrp) : data.products[index].mrp,
      stockQuantity: computedStock,
      stockBySize: stockBySize || {},
      inStock: computedStock > 0,
      stockStatus: computedStock > 0 ? (updates.stockStatus || data.products[index].stockStatus || 'In Stock') : 'Out of Stock'
    };

    saveProductsData(data);
    return NextResponse.json({ success: true, message: 'Product updated', product: data.products[index] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
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

    if (stockBySize !== undefined && typeof stockBySize === 'object') {
      product.stockBySize = stockBySize;
      product.stockQuantity = Object.values(stockBySize).reduce((a, b) => Number(a || 0) + Number(b || 0), 0);
      product.inStock = product.stockQuantity > 0;
      product.stockStatus = product.stockQuantity > 0 ? (stockStatus || product.stockStatus || 'In Stock') : 'Out of Stock';
    } else {
      if (stockStatus !== undefined) product.stockStatus = stockStatus;
      if (inStock !== undefined) product.inStock = inStock;
      if (stockQuantity !== undefined) product.stockQuantity = Number(stockQuantity);
    }

    saveProductsData(data);
    return NextResponse.json({ success: true, message: 'Stock status updated', product });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
