# Command Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个纯静态的命令收藏和笔记管理网页应用，可部署到 GitHub Pages

**Architecture:** 纯前端应用，使用 sql.js (SQLite WASM) 在浏览器中运行 SQLite 数据库，数据持久化到 IndexedDB，支持导入/导出备份

**Tech Stack:** 原生 HTML/CSS/JavaScript, sql.js (SQLite WASM)

---

## Task 1: 项目骨架和 sql.js 集成

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `app.js`

**Step 1: 创建 HTML 结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Command Hub</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Command Hub</h1>
            <div class="header-actions">
                <button id="import-btn" class="btn">导入</button>
                <button id="export-btn" class="btn">导出</button>
                <button id="add-tab-btn" class="btn btn-primary">+ 新建 Tab</button>
            </div>
        </header>

        <nav class="tabs" id="tabs-nav"></nav>

        <div class="toolbar">
            <div class="sort-options">
                <label>排序:</label>
                <select id="sort-select">
                    <option value="order">自定义顺序</option>
                    <option value="count">按复制次数</option>
                </select>
            </div>
            <button id="add-item-btn" class="btn btn-primary">+ 添加项目</button>
        </div>

        <main class="items-list" id="items-list"></main>
    </div>

    <!-- Tab Modal -->
    <div id="tab-modal" class="modal">
        <div class="modal-content">
            <h2 id="tab-modal-title">新建 Tab</h2>
            <form id="tab-form">
                <input type="hidden" id="tab-id">
                <div class="form-group">
                    <label for="tab-name">名称</label>
                    <input type="text" id="tab-name" required>
                </div>
                <div class="form-group">
                    <label for="tab-type">类型</label>
                    <select id="tab-type">
                        <option value="command">命令</option>
                        <option value="note">笔记</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn" onclick="closeTabModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Item Modal -->
    <div id="item-modal" class="modal">
        <div class="modal-content">
            <h2 id="item-modal-title">添加项目</h2>
            <form id="item-form">
                <input type="hidden" id="item-id">
                <div class="form-group">
                    <label for="item-title">标题</label>
                    <input type="text" id="item-title" required>
                </div>
                <div class="form-group">
                    <label for="item-content">内容</label>
                    <textarea id="item-content" rows="4" required></textarea>
                </div>
                <div class="form-group">
                    <label for="item-description">描述</label>
                    <input type="text" id="item-description">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn" onclick="closeItemModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Hidden file input for import -->
    <input type="file" id="import-file" accept=".db" style="display:none">

    <!-- sql.js from CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

**Step 2: 创建空 CSS 文件**

```css
/* style.css - 占位 */
```

**Step 3: 创建 JS 骨架，初始化 sql.js**

```javascript
// app.js
let db = null;
let tabs = [];
let currentTabId = null;
let items = [];
let currentSort = 'order';

const DB_NAME = 'command-hub-db';

// Initialize sql.js and database
async function initDatabase() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    // Try to load from IndexedDB
    const savedData = await loadFromIndexedDB();
    if (savedData) {
        db = new SQL.Database(savedData);
    } else {
        db = new SQL.Database();
        createTables();
    }

    await loadTabs();
}

function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('command', 'note')),
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tab_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            description TEXT DEFAULT '',
            copy_count INTEGER DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
        )
    `);

    // Insert default tabs
    db.run("INSERT INTO tabs (name, type, sort_order) VALUES ('Git 命令', 'command', 1)");
    db.run("INSERT INTO tabs (name, type, sort_order) VALUES ('Claude 命令', 'command', 2)");
    saveToIndexedDB();
}

// Start the app
initDatabase();
```

**Step 4: 运行验证**

用浏览器打开 `index.html`（需要本地服务器，如 `python -m http.server 9588`）
Expected: 页面加载，控制台无报错

**Step 5: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add project skeleton with sql.js"
```

---

## Task 2: IndexedDB 持久化

**Files:**
- Modify: `app.js`

**Step 1: 添加 IndexedDB 存储函数**

在 `initDatabase` 函数之前添加：

```javascript
// IndexedDB helpers
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const idb = event.target.result;
            if (!idb.objectStoreNames.contains('database')) {
                idb.createObjectStore('database');
            }
        };
    });
}

async function saveToIndexedDB() {
    const data = db.export();
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction('database', 'readwrite');
        const store = tx.objectStore('database');
        const request = store.put(data, 'sqlite');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function loadFromIndexedDB() {
    try {
        const idb = await openIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction('database', 'readonly');
            const store = tx.objectStore('database');
            const request = store.get('sqlite');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
}
```

**Step 2: Commit**

```bash
git add app.js
git commit -m "feat: add IndexedDB persistence"
```

---

## Task 3: 导入/导出功能

**Files:**
- Modify: `app.js`

**Step 1: 添加导出功能**

```javascript
// Export database
function exportDatabase() {
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `command-hub-${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据库已导出');
}
```

**Step 2: 添加导入功能**

```javascript
// Import database
async function importDatabase(file) {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    try {
        db = new SQL.Database(data);
        await saveToIndexedDB();
        await loadTabs();
        showToast('数据库已导入');
    } catch (e) {
        showToast('导入失败：无效的数据库文件');
        console.error(e);
    }
}
```

**Step 3: 绑定导入导出按钮事件（在文件末尾添加）**

```javascript
// Import/Export event listeners
document.getElementById('export-btn').addEventListener('click', exportDatabase);
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importDatabase(e.target.files[0]);
        e.target.value = '';
    }
});
```

**Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add import/export functionality"
```

---

## Task 4: Tab CRUD 操作

**Files:**
- Modify: `app.js`

**Step 1: 添加 Tab 数据操作函数**

```javascript
// Tab operations
async function loadTabs() {
    const result = db.exec('SELECT * FROM tabs ORDER BY sort_order');
    tabs = result.length > 0 ? result[0].values.map(row => ({
        id: row[0],
        name: row[1],
        type: row[2],
        sort_order: row[3]
    })) : [];

    renderTabs();

    if (tabs.length > 0 && !currentTabId) {
        selectTab(tabs[0].id);
    } else if (currentTabId) {
        await loadItems();
    }
}

function createTab(name, type) {
    const maxOrder = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM tabs');
    const order = (maxOrder[0]?.values[0][0] || 0) + 1;
    db.run('INSERT INTO tabs (name, type, sort_order) VALUES (?, ?, ?)', [name, type, order]);
    saveToIndexedDB();
}

function updateTab(id, name, type) {
    db.run('UPDATE tabs SET name = ?, type = ? WHERE id = ?', [name, type, id]);
    saveToIndexedDB();
}

function deleteTab(id) {
    db.run('DELETE FROM items WHERE tab_id = ?', [id]);
    db.run('DELETE FROM tabs WHERE id = ?', [id]);
    saveToIndexedDB();
}

function moveTab(id, direction) {
    const current = tabs.find(t => t.id === id);
    if (!current) return;

    const idx = tabs.indexOf(current);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= tabs.length) return;

    const neighbor = tabs[neighborIdx];
    db.run('UPDATE tabs SET sort_order = ? WHERE id = ?', [neighbor.sort_order, id]);
    db.run('UPDATE tabs SET sort_order = ? WHERE id = ?', [current.sort_order, neighbor.id]);
    saveToIndexedDB();
}
```

**Step 2: 添加 Tab 渲染函数**

```javascript
function renderTabs() {
    const nav = document.getElementById('tabs-nav');
    nav.innerHTML = tabs.map(tab => `
        <div class="tab ${tab.id === currentTabId ? 'active' : ''}" data-id="${tab.id}">
            <span class="tab-name" onclick="selectTab(${tab.id})">${escapeHtml(tab.name)}</span>
            <div class="tab-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); handleMoveTab(${tab.id}, 'up')" title="上移">↑</button>
                <button class="btn-icon" onclick="event.stopPropagation(); handleMoveTab(${tab.id}, 'down')" title="下移">↓</button>
                <button class="btn-icon" onclick="event.stopPropagation(); editTab(${tab.id})" title="编辑">✏️</button>
                <button class="btn-icon" onclick="event.stopPropagation(); handleDeleteTab(${tab.id})" title="删除">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function selectTab(tabId) {
    currentTabId = tabId;
    renderTabs();
    await loadItems();
}

async function handleMoveTab(tabId, direction) {
    moveTab(tabId, direction);
    await loadTabs();
}

async function handleDeleteTab(tabId) {
    if (!confirm('确定删除此 Tab 及其所有内容？')) return;
    deleteTab(tabId);
    if (currentTabId === tabId) currentTabId = null;
    await loadTabs();
}
```

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add Tab CRUD operations"
```

---

## Task 5: Item CRUD 操作

**Files:**
- Modify: `app.js`

**Step 1: 添加 Item 数据操作函数**

```javascript
// Item operations
async function loadItems() {
    if (!currentTabId) {
        document.getElementById('items-list').innerHTML = '<p class="empty-state">请选择一个 Tab</p>';
        return;
    }

    const orderBy = currentSort === 'count' ? 'copy_count DESC' : 'sort_order ASC';
    const result = db.exec(`SELECT * FROM items WHERE tab_id = ? ORDER BY ${orderBy}`, [currentTabId]);

    items = result.length > 0 ? result[0].values.map(row => ({
        id: row[0],
        tab_id: row[1],
        title: row[2],
        content: row[3],
        description: row[4],
        copy_count: row[5],
        sort_order: row[6]
    })) : [];

    renderItems();
}

function createItem(tabId, title, content, description) {
    const maxOrder = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM items WHERE tab_id = ?', [tabId]);
    const order = (maxOrder[0]?.values[0][0] || 0) + 1;
    db.run('INSERT INTO items (tab_id, title, content, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        [tabId, title, content, description, order]);
    saveToIndexedDB();
}

function updateItem(id, title, content, description) {
    db.run('UPDATE items SET title = ?, content = ?, description = ? WHERE id = ?',
        [title, content, description, id]);
    saveToIndexedDB();
}

function deleteItem(id) {
    db.run('DELETE FROM items WHERE id = ?', [id]);
    saveToIndexedDB();
}

function incrementCopyCount(id) {
    db.run('UPDATE items SET copy_count = copy_count + 1 WHERE id = ?', [id]);
    saveToIndexedDB();
}

function moveItem(id, direction) {
    const current = items.find(i => i.id === id);
    if (!current) return;

    const idx = items.indexOf(current);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= items.length) return;

    const neighbor = items[neighborIdx];
    db.run('UPDATE items SET sort_order = ? WHERE id = ?', [neighbor.sort_order, id]);
    db.run('UPDATE items SET sort_order = ? WHERE id = ?', [current.sort_order, neighbor.id]);
    saveToIndexedDB();
}
```

**Step 2: 添加 Item 渲染函数**

```javascript
function renderItems() {
    const list = document.getElementById('items-list');
    const currentTab = tabs.find(t => t.id === currentTabId);
    const isCommand = currentTab?.type === 'command';

    if (items.length === 0) {
        list.innerHTML = '<p class="empty-state">暂无内容，点击"添加项目"创建</p>';
        return;
    }

    list.innerHTML = items.map(item => `
        <div class="item-card" data-id="${item.id}">
            <div class="item-header">
                <span class="item-title">${escapeHtml(item.title)}</span>
                <div class="item-actions">
                    ${isCommand ? `<button class="btn btn-primary btn-small" onclick="handleCopyItem(${item.id})">复制</button>` : ''}
                    <button class="btn-icon" onclick="handleMoveItem(${item.id}, 'up')" title="上移">↑</button>
                    <button class="btn-icon" onclick="handleMoveItem(${item.id}, 'down')" title="下移">↓</button>
                    <button class="btn-icon" onclick="editItem(${item.id})" title="编辑">✏️</button>
                    <button class="btn-icon" onclick="handleDeleteItem(${item.id})" title="删除">🗑️</button>
                </div>
            </div>
            <div class="item-content">${escapeHtml(item.content)}</div>
            <div class="item-footer">
                <span class="item-description">${escapeHtml(item.description || '')}</span>
                ${isCommand ? `<span class="copy-count">已复制 ${item.copy_count} 次</span>` : ''}
            </div>
        </div>
    `).join('');
}

async function handleCopyItem(itemId) {
    const item = items.find(i => i.id === itemId);
    await navigator.clipboard.writeText(item.content);
    incrementCopyCount(itemId);
    showToast('已复制到剪贴板');
    await loadItems();
}

async function handleMoveItem(itemId, direction) {
    moveItem(itemId, direction);
    await loadItems();
}

async function handleDeleteItem(itemId) {
    if (!confirm('确定删除此项目？')) return;
    deleteItem(itemId);
    await loadItems();
}
```

**Step 3: 添加工具函数**

```javascript
// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}
```

**Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add Item CRUD operations"
```

---

## Task 6: 弹窗交互逻辑

**Files:**
- Modify: `app.js`

**Step 1: Tab 弹窗逻辑**

```javascript
// Tab Modal
function openTabModal(tab = null) {
    document.getElementById('tab-modal-title').textContent = tab ? '编辑 Tab' : '新建 Tab';
    document.getElementById('tab-id').value = tab?.id || '';
    document.getElementById('tab-name').value = tab?.name || '';
    document.getElementById('tab-type').value = tab?.type || 'command';
    document.getElementById('tab-modal').classList.add('show');
    document.getElementById('tab-name').focus();
}

function closeTabModal() {
    document.getElementById('tab-modal').classList.remove('show');
}

function editTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    openTabModal(tab);
}

document.getElementById('tab-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tab-id').value;
    const name = document.getElementById('tab-name').value.trim();
    const type = document.getElementById('tab-type').value;

    if (!name) return;

    if (id) {
        updateTab(parseInt(id), name, type);
    } else {
        createTab(name, type);
    }

    closeTabModal();
    await loadTabs();
});
```

**Step 2: Item 弹窗逻辑**

```javascript
// Item Modal
function openItemModal(item = null) {
    document.getElementById('item-modal-title').textContent = item ? '编辑项目' : '添加项目';
    document.getElementById('item-id').value = item?.id || '';
    document.getElementById('item-title').value = item?.title || '';
    document.getElementById('item-content').value = item?.content || '';
    document.getElementById('item-description').value = item?.description || '';
    document.getElementById('item-modal').classList.add('show');
    document.getElementById('item-title').focus();
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('show');
}

function editItem(itemId) {
    const item = items.find(i => i.id === itemId);
    openItemModal(item);
}

document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const title = document.getElementById('item-title').value.trim();
    const content = document.getElementById('item-content').value.trim();
    const description = document.getElementById('item-description').value.trim();

    if (!title || !content) return;

    if (id) {
        updateItem(parseInt(id), title, content, description);
    } else {
        createItem(currentTabId, title, content, description);
    }

    closeItemModal();
    await loadItems();
});
```

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add modal interaction logic"
```

---

## Task 7: 事件绑定和初始化

**Files:**
- Modify: `app.js`

**Step 1: 添加所有事件绑定**

```javascript
// Event listeners
document.getElementById('add-tab-btn').addEventListener('click', () => openTabModal());

document.getElementById('add-item-btn').addEventListener('click', () => {
    if (!currentTabId) {
        showToast('请先选择一个 Tab');
        return;
    }
    openItemModal();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadItems();
});

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    }
});
```

**Step 2: Commit**

```bash
git add app.js
git commit -m "feat: add event listeners"
```

---

## Task 8: CSS 样式

**Files:**
- Modify: `style.css`

**Step 1: 完整 CSS 样式**

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: #f5f5f5;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
}

/* Header */
header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
}

header h1 {
    font-size: 24px;
    font-weight: 600;
}

.header-actions {
    display: flex;
    gap: 8px;
}

/* Buttons */
.btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}

.btn:hover {
    background: #f0f0f0;
}

.btn-primary {
    background: #007bff;
    border-color: #007bff;
    color: #fff;
}

.btn-primary:hover {
    background: #0056b3;
}

.btn-small {
    padding: 4px 10px;
    font-size: 12px;
}

.btn-icon {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.6;
    transition: opacity 0.2s;
}

.btn-icon:hover {
    opacity: 1;
}

/* Tabs */
.tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.tab {
    padding: 10px 16px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.tab:hover {
    background: #f0f0f0;
}

.tab.active {
    background: #007bff;
    color: #fff;
    border-color: #007bff;
}

.tab-name {
    cursor: pointer;
}

.tab-actions {
    display: none;
    gap: 2px;
    margin-left: 4px;
}

.tab:hover .tab-actions {
    display: flex;
}

.tab.active .btn-icon {
    color: #fff;
}

/* Toolbar */
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 12px;
    background: #fff;
    border-radius: 6px;
    border: 1px solid #ddd;
}

.sort-options {
    display: flex;
    align-items: center;
    gap: 8px;
}

.sort-options label {
    font-size: 14px;
    color: #666;
}

.sort-options select {
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

/* Items */
.items-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
}

.item-card {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    transition: box-shadow 0.2s;
}

.item-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
}

.item-title {
    font-size: 15px;
    font-weight: 600;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    color: #2c3e50;
}

.item-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.item-content {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-all;
    border: 1px solid #e9ecef;
}

.item-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.item-description {
    color: #666;
    flex: 1;
}

.copy-count {
    color: #999;
    font-size: 12px;
    margin-left: 10px;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal.show {
    display: flex;
}

.modal-content {
    background: #fff;
    padding: 24px;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-content h2 {
    margin-bottom: 20px;
    font-size: 18px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #007bff;
}

.form-group textarea {
    resize: vertical;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    min-height: 100px;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
}

/* Toast */
.toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #333;
    color: #fff;
    padding: 12px 20px;
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 1001;
}

.toast.show {
    opacity: 1;
}

/* Responsive */
@media (max-width: 600px) {
    .container {
        padding: 12px;
    }

    header {
        flex-direction: column;
        align-items: flex-start;
    }

    .toolbar {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
    }

    .sort-options {
        justify-content: space-between;
    }

    .item-header {
        flex-direction: column;
        gap: 10px;
    }

    .item-actions {
        align-self: flex-end;
    }
}
```

**Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add complete CSS styles"
```

---

## Task 9: 最终测试和部署

**Step 1: 本地测试**

启动本地服务器：
```bash
python -m http.server 9588
```

访问 http://localhost:9588 进行测试：

- [ ] 页面加载正常，显示预置 Tab
- [ ] 点击 Tab 切换正常
- [ ] 新建/编辑/删除 Tab 正常
- [ ] Tab 上下移动正常
- [ ] 添加/编辑/删除 Item 正常
- [ ] Item 上下移动正常
- [ ] 复制按钮工作，计数增加
- [ ] 排序切换正常
- [ ] 笔记类型 Tab 不显示复制按钮和计数
- [ ] 导出功能正常，下载 .db 文件
- [ ] 导入功能正常，恢复数据
- [ ] 刷新页面数据保持（IndexedDB 持久化）

**Step 2: 部署到 GitHub Pages**

```bash
git add .
git commit -m "feat: complete Command Hub v1.0"
git push origin main
```

在 GitHub 仓库设置中启用 Pages：
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / (root)
4. Save

访问 `https://<username>.github.io/command-hub/`

---

## 文件清单

```
command-hub/
├── index.html      # 页面结构 (~90 行)
├── style.css       # 样式 (~280 行)
├── app.js          # 前端逻辑 (~300 行)
└── docs/
    └── plans/
        └── 2026-02-04-command-hub.md
```

**总代码量：约 670 行**

**启动方式：**
```bash
# 本地测试
python -m http.server 9588
# 访问 http://localhost:9588

# 或部署到 GitHub Pages 直接访问
```
