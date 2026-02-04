// app.js
let db = null;
let tabs = [];
let currentTabId = null;
let items = [];
let currentSort = 'order';

const DB_NAME = 'command-hub-db';

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
