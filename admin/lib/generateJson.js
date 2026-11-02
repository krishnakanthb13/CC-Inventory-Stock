// admin/lib/generateJson.js
const fs = require('fs');
const path = require('path');

const SUBMODULE_DIR_NAME = 'CC-Hosting-Public';
const RELATIVE_DATA_PATH = path.join(SUBMODULE_DIR_NAME, 'public', 'data', 'products.json');

function findRepoRoot() {
  // 1. Try climbing up from process.cwd()
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(current, RELATIVE_DATA_PATH))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 2. Try climbing up from __dirname
  current = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(current, RELATIVE_DATA_PATH))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

// Locates the CC-Hosting-Public directory itself (works even before products.json exists)
function findSubmoduleDir() {
  const startPoints = [process.cwd(), __dirname];
  for (const start of startPoints) {
    let current = start;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(current, SUBMODULE_DIR_NAME);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

// Dynamically resolve path to CC-Hosting-Public/public/data/products.json
function getJsonFilePath() {
  const root = findRepoRoot();
  if (root) {
    return path.join(root, RELATIVE_DATA_PATH);
  }

  // Fallback candidates if not found
  const candidatePaths = [
    path.resolve(process.cwd(), '../CC-Hosting-Public/public/data/products.json'),
    path.resolve(process.cwd(), 'CC-Hosting-Public/public/data/products.json'),
    path.resolve(__dirname, '../../CC-Hosting-Public/public/data/products.json'),
    path.resolve(__dirname, '../../../CC-Hosting-Public/public/data/products.json'),
    path.resolve(__dirname, '../../../../CC-Hosting-Public/public/data/products.json')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (process.cwd().endsWith('admin')) {
    return path.resolve(process.cwd(), '../CC-Hosting-Public/public/data/products.json');
  }
  return path.resolve(process.cwd(), 'CC-Hosting-Public/public/data/products.json');
}

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  return true;
}

function getProductsData() {
  const filePath = getJsonFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      if (!findSubmoduleDir()) {
        throw new Error(
          `CC-Hosting-Public submodule not found near ${filePath}. Initialize it first: git submodule update --init --recursive`
        );
      }
      throw new Error(`Data file not found at ${filePath}`);
    }
    const rawData = fs.readFileSync(filePath, 'utf8');
    // Tolerate UTF-8 BOM (e.g. from Windows editors) — JSON.parse rejects it
    return JSON.parse(rawData.replace(/^\uFEFF/, ''));
  } catch (error) {
    console.error('Error reading products.json at', filePath, ':', error.message);
    throw error;
  }
}

// Atomic write: serialize to a temp file in the same directory, then rename.
// rename is atomic on the same filesystem, so readers never observe a partially
// written file, and a crash mid-write leaves the previous products.json intact.
// Note: all route handlers perform read-modify-write with synchronous fs calls
// (no awaits between read and write), so each mutation is atomic per-request.
function saveProductsData(fullData) {
  const filePath = getJsonFilePath();
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    if (!findSubmoduleDir()) {
      throw new Error(
        `CC-Hosting-Public submodule directory not found near ${filePath}. Initialize it first: git submodule update --init --recursive`
      );
    }
    ensureDirectoryExistence(filePath);
    const serialized = `${JSON.stringify(fullData, null, 2)}\n`;
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* best-effort cleanup */ }
    console.error('Error writing products.json at', filePath, ':', error.message);
    throw error;
  }
}

function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

module.exports = {
  getJsonFilePath,
  get jsonFilePath() {
    return getJsonFilePath();
  },
  getProductsData,
  saveProductsData,
  createSlug
};
