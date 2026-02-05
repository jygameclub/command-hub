// app.js
let db = null;
let tabs = [];
let currentTabId = null;
let items = [];
let currentSort = localStorage.getItem('commandhub_sort') || 'order_asc';
let currentTheme = localStorage.getItem('commandhub_theme') || 'dark-blue';
let commandColor = localStorage.getItem('commandhub_command_color') || '#d1fae5';
let descriptionColor = localStorage.getItem('commandhub_description_color') || '#6b7280';
let showAllTab = localStorage.getItem('commandhub_show_all_tab') !== 'false'; // 默认显示

const DB_NAME = 'command-hub-db';
const ALL_TAB_ID = 'all'; // 特殊的 All 标签 ID

// Font size control
function initFontSize() {
    const saved = localStorage.getItem('commandhub_fontsize') || '16';
    document.documentElement.style.setProperty('--base-font-size', saved + 'px');
    document.getElementById('font-size-slider').value = saved;
}

function saveFontSize(size) {
    localStorage.setItem('commandhub_fontsize', size);
    document.documentElement.style.setProperty('--base-font-size', size + 'px');
}

function saveSort(sort) {
    localStorage.setItem('commandhub_sort', sort);
    currentSort = sort;
}

// Theme default colors
const themeDefaults = {
    'dark-blue': { command: '#4ade80', description: '#fbbf24' },
    'dark-green': { command: '#67e8f9', description: '#fcd34d' },
    'dark-purple': { command: '#a5f3fc', description: '#f0abfc' },
    'dark-orange': { command: '#a3e635', description: '#fdba74' },
    'dark-red': { command: '#86efac', description: '#fda4af' },
    'dark-cyan': { command: '#a5f3fc', description: '#fde047' },
    'nord': { command: '#a3be8c', description: '#ebcb8b' },
    'monokai': { command: '#a6e22e', description: '#e6db74' },
    'dracula': { command: '#50fa7b', description: '#f1fa8c' },
    'solarized-dark': { command: '#859900', description: '#b58900' },
    'light': { command: '#059669', description: '#b45309' },
    'light-blue': { command: '#0d9488', description: '#c2410c' },
    'light-green': { command: '#0891b2', description: '#a16207' },
    'light-purple': { command: '#0d9488', description: '#b45309' },
    'solarized-light': { command: '#859900', description: '#b58900' }
};

// Theme functions
function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    // Apply custom colors if set, otherwise use theme defaults
    const defaults = themeDefaults[currentTheme] || themeDefaults['dark-blue'];
    const savedCommandColor = localStorage.getItem('commandhub_command_color');
    const savedDescriptionColor = localStorage.getItem('commandhub_description_color');

    commandColor = savedCommandColor || defaults.command;
    descriptionColor = savedDescriptionColor || defaults.description;

    document.documentElement.style.setProperty('--command-color', commandColor);
    document.documentElement.style.setProperty('--description-color', descriptionColor);
    updateThemeUI();
    updateColorInputs();
}

function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('commandhub_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    // Reset colors to theme defaults when switching themes
    const defaults = themeDefaults[theme] || themeDefaults['dark-blue'];
    commandColor = defaults.command;
    descriptionColor = defaults.description;

    // Clear custom color settings so theme defaults apply
    localStorage.removeItem('commandhub_command_color');
    localStorage.removeItem('commandhub_description_color');

    document.documentElement.style.setProperty('--command-color', commandColor);
    document.documentElement.style.setProperty('--description-color', descriptionColor);

    updateThemeUI();
    updateColorInputs();
}

function updateThemeUI() {
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === currentTheme);
    });
}

function setCommandColor(color) {
    commandColor = color;
    localStorage.setItem('commandhub_command_color', color);
    document.documentElement.style.setProperty('--command-color', color);
    updateColorPreview();
}

function setDescriptionColor(color) {
    descriptionColor = color;
    localStorage.setItem('commandhub_description_color', color);
    document.documentElement.style.setProperty('--description-color', color);
    updateColorPreview();
}

function updateColorInputs() {
    document.getElementById('command-color-picker').value = commandColor;
    document.getElementById('command-color-input').value = commandColor;
    document.getElementById('description-color-picker').value = descriptionColor;
    document.getElementById('description-color-input').value = descriptionColor;
    updateColorPreview();
}

function updateColorPreview() {
    const previewCmd = document.querySelector('.preview-command');
    const previewDesc = document.querySelector('.preview-description');
    if (previewCmd) previewCmd.style.color = commandColor;
    if (previewDesc) previewDesc.style.color = descriptionColor;
}

function resetCommandColor() {
    const defaults = themeDefaults[currentTheme] || themeDefaults['dark-blue'];
    commandColor = defaults.command;
    localStorage.removeItem('commandhub_command_color');
    document.documentElement.style.setProperty('--command-color', commandColor);
    document.getElementById('command-color-picker').value = commandColor;
    document.getElementById('command-color-input').value = commandColor;
    updateColorPreview();
}

function resetDescriptionColor() {
    const defaults = themeDefaults[currentTheme] || themeDefaults['dark-blue'];
    descriptionColor = defaults.description;
    localStorage.removeItem('commandhub_description_color');
    document.documentElement.style.setProperty('--description-color', descriptionColor);
    document.getElementById('description-color-picker').value = descriptionColor;
    document.getElementById('description-color-input').value = descriptionColor;
    updateColorPreview();
}

// Settings Modal
function openSettingsModal() {
    updateColorInputs();
    // 更新 All 标签复选框状态
    document.getElementById('show-all-tab').checked = showAllTab;
    document.getElementById('settings-modal').classList.add('show');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('show');
}

// All Tab 设置
function setShowAllTab(show) {
    showAllTab = show;
    localStorage.setItem('commandhub_show_all_tab', show ? 'true' : 'false');
    renderTabs();
    // 如果当前在 All 标签但隐藏了它，切换到第一个标签
    if (!show && currentTabId === ALL_TAB_ID && tabs.length > 0) {
        selectTab(tabs[0].id);
    }
}

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
    // 延迟释放 Blob URL 以确保下载完成
    setTimeout(() => URL.revokeObjectURL(url), 100);
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
        migrateDatabase();
        await saveToIndexedDB();  // 始终保存到 IndexedDB
        await loadTabs();
        showToast('数据库已导入');
    } catch (e) {
        showToast('导入失败：无效的数据库文件');
        console.error(e);
    }
}

// Load default database from def.db
async function loadDefaultDatabase() {
    if (!confirm('加载默认数据库会覆盖当前所有数据，确定继续吗？')) {
        return;
    }

    try {
        showToast('正在加载默认数据库...');

        // Fetch def.db from the same directory
        const response = await fetch('def.db');
        if (!response.ok) {
            throw new Error('无法加载默认数据库文件');
        }

        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);

        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });

        db = new SQL.Database(data);
        migrateDatabase();
        await saveToIndexedDB();
        currentTabId = null;  // Reset current tab
        await loadTabs();
        showToast('默认数据库已加载');
        closeSettingsModal();
    } catch (e) {
        showToast('加载失败：' + e.message);
        console.error(e);
    }
}

// Export current tab as JSON
function exportTabAsJson() {
    if (!currentTabId || currentTabId === ALL_TAB_ID) {
        showToast('请先选择具体的 Tab 再导出');
        return;
    }

    const currentTab = tabs.find(t => t.id === currentTabId);
    const data = {
        tab: {
            name: currentTab.name,
            type: currentTab.type
        },
        items: items.map(item => ({
            title: item.title,
            content: item.content,
            description: item.description || '',
            copy_count: item.copy_count || 0
        }))
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTab.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    // 延迟释放 Blob URL 以确保下载完成
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showToast('JSON 已导出');
}

// Import JSON to current tab (accepts File object or JSON string)
async function importTabFromJson(input) {
    if (!currentTabId || currentTabId === ALL_TAB_ID) {
        showToast('请先选择具体的 Tab 再导入');
        return;
    }

    try {
        // Handle both File object and string input
        const text = typeof input === 'string' ? input : await input.text();
        const parsed = JSON.parse(text);

        // Support both formats: {items:[...]} or just [...]
        const items = Array.isArray(parsed) ? parsed : (parsed.items || null);

        if (!items || !Array.isArray(items)) {
            showToast('无效的 JSON 格式：需要 items 数组');
            return;
        }

        const data = { items };

        // Ask user whether to replace or append
        const replace = confirm('是否替换当前 Tab 的所有数据？\n\n点击"确定"替换，点击"取消"追加到现有数据');

        if (replace) {
            // Delete existing items
            db.run('DELETE FROM items WHERE tab_id = ?', [currentTabId]);
        }

        // Get current max sort_order
        const maxOrderResult = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM items WHERE tab_id = ?', [currentTabId]);
        let order = (maxOrderResult[0]?.values[0][0] || 0);

        // Insert new items
        for (const item of data.items) {
            order++;
            db.run(
                'INSERT INTO items (tab_id, title, content, description, copy_count, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                [currentTabId, item.title, item.content, item.description || '', item.copy_count || 0, order]
            );
        }

        await saveToIndexedDB();
        await loadItems();
        showToast(`已导入 ${data.items.length} 个项目`);
        return true;
    } catch (e) {
        showToast('导入失败：' + e.message);
        console.error(e);
        return false;
    }
}

// JSON Import Modal functions
function openJsonImportModal() {
    if (!currentTabId) {
        showToast('请先选择一个 Tab');
        return;
    }
    document.getElementById('json-paste-area').style.display = 'none';
    document.getElementById('json-paste-input').value = '';
    document.getElementById('json-import-modal').classList.add('show');
}

function closeJsonImportModal() {
    document.getElementById('json-import-modal').classList.remove('show');
}

function showJsonPasteArea() {
    document.getElementById('json-paste-area').style.display = 'block';
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

    // 如果设置显示 All 标签，在最左边添加
    const allTabHtml = showAllTab ? `
        <div class="tab tab-all ${currentTabId === ALL_TAB_ID ? 'active' : ''}" data-id="${ALL_TAB_ID}" onclick="selectAllTab()">
            <span class="tab-name">All</span>
        </div>
    ` : '';

    const tabsHtml = tabs.map(tab => `
        <div class="tab ${tab.id === currentTabId ? 'active' : ''}" data-id="${tab.id}" onclick="selectTab(${tab.id})">
            <span class="tab-name">${escapeHtml(tab.name)}</span>
        </div>
    `).join('');

    nav.innerHTML = allTabHtml + tabsHtml;
}

async function selectTab(tabId) {
    currentTabId = tabId;
    renderTabs();
    await loadItems();
}

async function selectAllTab() {
    currentTabId = ALL_TAB_ID;
    renderTabs();
    await loadAllItems();
}

async function loadAllItems() {
    // 支持排序选择，默认按复制次数降序
    const sortMap = {
        'order_asc': 'sort_order ASC',
        'order_desc': 'sort_order DESC',
        'count_asc': 'copy_count ASC',
        'count_desc': 'copy_count DESC'
    };
    const orderBy = sortMap[currentSort] || 'copy_count DESC';
    const result = db.exec(`SELECT * FROM items ORDER BY ${orderBy}`);

    items = result.length > 0 ? result[0].values.map(row => ({
        id: row[0],
        tab_id: row[1],
        title: row[2],
        content: row[3],
        description: row[4],
        copy_count: row[5],
        sort_order: row[6]
    })) : [];

    renderAllItems();
}

function renderAllItems() {
    const list = document.getElementById('items-list');

    if (items.length === 0) {
        list.innerHTML = '<p class="empty-state">暂无内容</p>';
        return;
    }

    list.innerHTML = items.map(item => {
        const tab = tabs.find(t => t.id === item.tab_id);
        const isCommand = tab?.type === 'command';
        const isUrl = tab?.type === 'url';

        // Split content by newlines to support multiple commands/urls
        const lines = item.content.split('\n').filter(line => line.trim());

        let contentHtml;
        if (isCommand) {
            contentHtml = lines.map((cmd, idx) => `
                <div class="command-line">
                    <code>${escapeHtml(cmd)}</code>
                    <button class="btn btn-primary btn-small" onclick="handleCopyCommand(${item.id}, ${idx}, '${escapeHtml(cmd).replace(/'/g, "\\'")}')">复制</button>
                </div>
            `).join('');
        } else if (isUrl) {
            contentHtml = lines.map((url, idx) => `
                <div class="command-line">
                    <code>${escapeHtml(url)}</code>
                    <button class="btn btn-primary btn-small" onclick="handleOpenUrl(${item.id}, '${escapeHtml(url).replace(/'/g, "\\'")}')">打开</button>
                </div>
            `).join('');
        } else {
            contentHtml = `<div class="item-content">${escapeHtml(item.content)}</div>`;
        }

        // 显示所属标签和复制次数
        const tabBadge = tab ? `<span class="tab-badge">${escapeHtml(tab.name)}</span>` : '';
        const countBadge = `<span class="count-badge">${item.copy_count}</span>`;

        return `
            <div class="item-card item-card-all" data-id="${item.id}">
                <div class="item-header">
                    <div class="item-title-row">
                        ${tabBadge}
                        <span class="item-title">${escapeHtml(item.description || item.title)}</span>
                        ${countBadge}
                    </div>
                </div>
                ${contentHtml}
            </div>
        `;
    }).join('');
}

async function handleMoveTab(tabId, direction) {
    moveTab(tabId, direction);
    await loadTabs();
    // Re-open modal with updated tab info
    const tab = tabs.find(t => t.id === tabId);
    if (tab) openTabModal(tab);
}

// Item operations
async function loadItems() {
    if (!currentTabId) {
        document.getElementById('items-list').innerHTML = '<p class="empty-state">请选择一个 Tab</p>';
        return;
    }

    // Support: order_asc, order_desc, count_asc, count_desc
    const sortMap = {
        'order_asc': 'sort_order ASC',
        'order_desc': 'sort_order DESC',
        'count_asc': 'copy_count ASC',
        'count_desc': 'copy_count DESC'
    };
    const orderBy = sortMap[currentSort] || 'sort_order ASC';
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

function createItem(tabId, title, content, description, customOrder = null) {
    let order;
    if (customOrder !== null) {
        order = customOrder;
    } else {
        const maxOrder = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM items WHERE tab_id = ?', [tabId]);
        order = (maxOrder[0]?.values[0][0] || 0) + 1;
    }
    db.run('INSERT INTO items (tab_id, title, content, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        [tabId, title, content, description, order]);
    saveToIndexedDB();
}

function updateItem(id, title, content, description, order = null, copyCount = null) {
    let sql = 'UPDATE items SET title = ?, content = ?, description = ?';
    const params = [title, content, description];

    if (order !== null) {
        sql += ', sort_order = ?';
        params.push(order);
    }
    if (copyCount !== null) {
        sql += ', copy_count = ?';
        params.push(copyCount);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.run(sql, params);
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
    const isUrl = currentTab?.type === 'url';

    if (items.length === 0) {
        list.innerHTML = '<p class="empty-state">暂无内容，点击"添加项目"创建</p>';
        return;
    }

    list.innerHTML = items.map(item => {
        // Split content by newlines to support multiple commands/urls
        const lines = item.content.split('\n').filter(line => line.trim());

        let contentHtml;
        if (isCommand) {
            contentHtml = lines.map((cmd, idx) => `
                <div class="command-line">
                    <code>${escapeHtml(cmd)}</code>
                    <button class="btn btn-primary btn-small" onclick="handleCopyCommand(${item.id}, ${idx}, '${escapeHtml(cmd).replace(/'/g, "\\'")}')">复制</button>
                </div>
            `).join('');
        } else if (isUrl) {
            contentHtml = lines.map((url, idx) => `
                <div class="command-line">
                    <code>${escapeHtml(url)}</code>
                    <button class="btn btn-primary btn-small" onclick="handleOpenUrl(${item.id}, '${escapeHtml(url).replace(/'/g, "\\'")}')">打开</button>
                </div>
            `).join('');
        } else {
            contentHtml = `<div class="item-content">${escapeHtml(item.content)}</div>`;
        }

        return `
            <div class="item-card" data-id="${item.id}">
                <div class="item-header">
                    <span class="item-title">${escapeHtml(item.description || item.title)}</span>
                    <div class="item-actions">
                        <button class="btn-icon" onclick="handleMoveItem(${item.id}, 'up')" title="上移">↑</button>
                        <button class="btn-icon" onclick="handleMoveItem(${item.id}, 'down')" title="下移">↓</button>
                        <button class="btn-icon" onclick="editItem(${item.id})" title="编辑">✏️</button>
                        <button class="btn-icon" onclick="handleDeleteItem(${item.id})" title="删除">🗑️</button>
                    </div>
                </div>
                ${(isCommand || isUrl) ? `<div class="commands-list">${contentHtml}</div>` : contentHtml}
                <div class="item-footer">
                    ${isCommand ? `<span class="copy-count">已复制 ${item.copy_count} 次</span>` : ''}
                    ${isUrl ? `<span class="copy-count">已打开 ${item.copy_count} 次</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function handleCopyCommand(itemId, cmdIndex, cmdText) {
    try {
        await navigator.clipboard.writeText(cmdText);
        incrementCopyCount(itemId);
        showToast('已复制到剪贴板');
        if (currentTabId === ALL_TAB_ID) {
            await loadAllItems();
        } else {
            await loadItems();
        }
    } catch (e) {
        showToast('复制失败: ' + e.message);
    }
}

async function handleOpenUrl(itemId, url) {
    window.open(url, '_blank');
    incrementCopyCount(itemId);
    showToast('已在新标签页打开');
    if (currentTabId === ALL_TAB_ID) {
        await loadAllItems();
    } else {
        await loadItems();
    }
}

async function handleMoveItem(itemId, direction) {
    moveItem(itemId, direction);
    if (currentTabId === ALL_TAB_ID) {
        await loadAllItems();
    } else {
        await loadItems();
    }
}

async function handleDeleteItem(itemId) {
    if (!confirm('确定删除此项目？')) return;
    deleteItem(itemId);
    if (currentTabId === ALL_TAB_ID) {
        await loadAllItems();
    } else {
        await loadItems();
    }
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

// Tab Modal
function openTabModal(tab = null) {
    document.getElementById('tab-modal-title').textContent = tab ? '编辑 Tab' : '新建 Tab';
    document.getElementById('tab-id').value = tab?.id || '';
    document.getElementById('tab-name').value = tab?.name || '';
    document.getElementById('tab-type').value = tab?.type || 'command';
    // Show/hide edit actions (move/delete) only when editing
    document.getElementById('tab-edit-actions').style.display = tab ? 'block' : 'none';
    document.getElementById('tab-modal').classList.add('show');
    document.getElementById('tab-name').focus();
}

async function handleClearCurrentTab() {
    const tabId = parseInt(document.getElementById('tab-id').value);
    if (!tabId) return;
    if (!confirm('确定清空此 Tab 的所有内容？此操作不可恢复！')) return;
    db.run('DELETE FROM items WHERE tab_id = ?', [tabId]);
    await saveToIndexedDB();
    closeTabModal();
    await loadItems();
    showToast('已清空当前 Tab');
}

async function handleDeleteCurrentTab() {
    const tabId = parseInt(document.getElementById('tab-id').value);
    if (!tabId) return;
    if (!confirm('确定删除此 Tab 及其所有内容？')) return;
    deleteTab(tabId);
    if (currentTabId === tabId) currentTabId = null;
    closeTabModal();
    await loadTabs();
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

// Item Modal
function openItemModal(item = null) {
    document.getElementById('item-modal-title').textContent = item ? '编辑项目' : '添加项目';
    document.getElementById('item-id').value = item?.id || '';
    document.getElementById('item-title').value = item?.title || '';
    document.getElementById('item-content').value = item?.content || '';
    document.getElementById('item-description').value = item?.description || '';
    document.getElementById('item-order').value = item?.sort_order || '';
    // 编辑时显示复制次数字段
    const copyCountGroup = document.getElementById('copy-count-group');
    const copyCountInput = document.getElementById('item-copy-count');
    if (item) {
        copyCountGroup.style.display = 'block';
        copyCountInput.value = item.copy_count || 0;
    } else {
        copyCountGroup.style.display = 'none';
        copyCountInput.value = 0;
    }
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
    const orderValue = document.getElementById('item-order').value;
    const order = orderValue ? parseInt(orderValue) : null;
    const copyCountValue = document.getElementById('item-copy-count').value;
    const copyCount = copyCountValue ? parseInt(copyCountValue) : null;

    if (!title || !content) return;

    if (id) {
        updateItem(parseInt(id), title, content, description, order, copyCount);
    } else {
        // 在 All 标签页不能新建项目
        if (currentTabId === ALL_TAB_ID) {
            showToast('请先选择具体的 Tab 再添加项目');
            return;
        }
        createItem(currentTabId, title, content, description, order);
    }

    closeItemModal();
    if (currentTabId === ALL_TAB_ID) {
        await loadAllItems();
    } else {
        await loadItems();
    }
});

// Initialize sql.js and database
async function initDatabase() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    // Try to load from IndexedDB
    const savedData = await loadFromIndexedDB();
    if (savedData) {
        db = new SQL.Database(savedData);
        // Migrate existing database to support 'url' type
        migrateDatabase();
    } else {
        db = new SQL.Database();
        createTables();
    }

    await loadTabs();
}

// Migrate database to support new tab types
function migrateDatabase() {
    try {
        // Check current table schema
        const schemaResult = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='tabs'");
        const currentSchema = schemaResult.length > 0 ? schemaResult[0].values[0][0] : '';

        // Skip migration if already supports 'url' type
        if (currentSchema.includes("'url'")) {
            console.log('Database already migrated, skipping...');
            return;
        }

        console.log('Migrating database to support url type...');

        // Get existing tabs data
        const tabsResult = db.exec('SELECT id, name, type, sort_order FROM tabs');
        const tabsData = tabsResult.length > 0 ? tabsResult[0].values : [];

        // Get existing items data
        const itemsResult = db.exec('SELECT id, tab_id, title, content, description, copy_count, sort_order FROM items');
        const itemsData = itemsResult.length > 0 ? itemsResult[0].values : [];

        console.log(`Migrating ${tabsData.length} tabs and ${itemsData.length} items...`);

        // Drop old tables
        db.run('DROP TABLE IF EXISTS items');
        db.run('DROP TABLE IF EXISTS tabs');

        // Create new tables with updated CHECK constraint
        createTables();

        // Restore tabs data
        for (const row of tabsData) {
            db.run('INSERT INTO tabs (id, name, type, sort_order) VALUES (?, ?, ?, ?)', row);
        }

        // Restore items data
        for (const row of itemsData) {
            db.run('INSERT INTO items (id, tab_id, title, content, description, copy_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)', row);
        }

        saveToIndexedDB();
        console.log('Database migration completed successfully');
    } catch (e) {
        console.error('Migration error:', e);
    }
}

function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('command', 'note', 'url')),
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
initFontSize();
initTheme();

// Restore saved sort option
document.getElementById('sort-select').value = currentSort;

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

// Event listeners
document.getElementById('add-tab-btn').addEventListener('click', () => openTabModal());
document.getElementById('edit-tab-btn').addEventListener('click', () => {
    if (!currentTabId) {
        showToast('请先选择一个 Tab');
        return;
    }
    if (currentTabId === ALL_TAB_ID) {
        showToast('All 标签为系统固定标签，无法编辑');
        return;
    }
    const tab = tabs.find(t => t.id === currentTabId);
    if (tab) openTabModal(tab);
});

document.getElementById('add-item-btn').addEventListener('click', () => {
    if (!currentTabId) {
        showToast('请先选择一个 Tab');
        return;
    }
    if (currentTabId === ALL_TAB_ID) {
        showToast('请先选择具体的 Tab 再添加项目');
        return;
    }
    openItemModal();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
    saveSort(e.target.value);
    if (currentTabId === ALL_TAB_ID) {
        loadAllItems();
    } else {
        loadItems();
    }
});

// Font size control
document.getElementById('font-size-slider').addEventListener('input', (e) => {
    saveFontSize(e.target.value);
});

// Modal can only be closed by clicking the close/cancel button
// (Removed: close on outside click and Escape key)

// JSON Import/Export event listeners
document.getElementById('export-json-btn').addEventListener('click', exportTabAsJson);
document.getElementById('import-json-btn').addEventListener('click', openJsonImportModal);

// JSON Import Modal event listeners
document.getElementById('import-json-file-btn').addEventListener('click', () => {
    document.getElementById('import-json-file').click();
});
document.getElementById('import-json-paste-btn').addEventListener('click', showJsonPasteArea);
document.getElementById('import-json-file').addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        const success = await importTabFromJson(e.target.files[0]);
        if (success) closeJsonImportModal();
        e.target.value = '';
    }
});
document.getElementById('confirm-paste-import').addEventListener('click', async () => {
    const jsonText = document.getElementById('json-paste-input').value.trim();
    if (!jsonText) {
        showToast('请粘贴 JSON 内容');
        return;
    }
    const success = await importTabFromJson(jsonText);
    if (success) closeJsonImportModal();
});

// Settings event listeners
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

// All Tab checkbox
document.getElementById('show-all-tab').addEventListener('change', (e) => {
    setShowAllTab(e.target.checked);
});

// Theme selection
document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
        setTheme(opt.dataset.theme);
    });
});

// Command color
document.getElementById('command-color-picker').addEventListener('input', (e) => {
    setCommandColor(e.target.value);
    document.getElementById('command-color-input').value = e.target.value;
});
document.getElementById('command-color-input').addEventListener('change', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        setCommandColor(color);
        document.getElementById('command-color-picker').value = color;
    }
});

// Description color
document.getElementById('description-color-picker').addEventListener('input', (e) => {
    setDescriptionColor(e.target.value);
    document.getElementById('description-color-input').value = e.target.value;
});
document.getElementById('description-color-input').addEventListener('change', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        setDescriptionColor(color);
        document.getElementById('description-color-picker').value = color;
    }
});

// Load default database button
document.getElementById('load-default-db').addEventListener('click', loadDefaultDatabase);

// ===== URL Sidebar =====
let sidebarCollapsed = localStorage.getItem('commandhub_sidebar_collapsed') === 'true';

// Initialize sidebar
function initSidebar() {
    const sidebar = document.getElementById('url-sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    if (!sidebar || !toggle) return;

    // Apply saved state
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
    }

    document.body.classList.add('has-sidebar');

    // Toggle handler
    toggle.addEventListener('click', () => {
        sidebarCollapsed = !sidebarCollapsed;
        sidebar.classList.toggle('collapsed', sidebarCollapsed);
        document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
        localStorage.setItem('commandhub_sidebar_collapsed', sidebarCollapsed);

        // Mobile expanded state
        if (window.innerWidth <= 600) {
            sidebar.classList.toggle('expanded', !sidebarCollapsed);
            document.body.classList.toggle('sidebar-expanded', !sidebarCollapsed);
        }
    });

    // Initial load of URLs
    loadSidebarUrls();
}

// Get favicon URL for a given URL
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        // Use Google's favicon service as primary
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
        return null;
    }
}

// Extract domain from URL
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

// Load all URLs from URL-type tabs for sidebar
async function loadSidebarUrls() {
    if (!db) return;

    const container = document.getElementById('sidebar-urls');
    if (!container) return;

    // Get all URL-type tabs
    const urlTabs = tabs.filter(t => t.type === 'url');

    if (urlTabs.length === 0) {
        container.innerHTML = '<div class="sidebar-empty">暂无 URL 链接<br><span style="font-size: 11px; margin-top: 4px; display: block;">创建 URL 类型的 Tab 来添加链接</span></div>';
        return;
    }

    let html = '';

    for (const tab of urlTabs) {
        // Get items for this tab
        const result = db.exec('SELECT * FROM items WHERE tab_id = ? ORDER BY copy_count DESC, sort_order ASC', [tab.id]);
        const tabItems = result.length > 0 ? result[0].values.map(row => ({
            id: row[0],
            tab_id: row[1],
            title: row[2],
            content: row[3],
            description: row[4],
            copy_count: row[5],
            sort_order: row[6]
        })) : [];

        if (tabItems.length === 0) continue;

        html += `<div class="url-group">`;
        html += `<div class="url-group-title">${escapeHtml(tab.name)}</div>`;

        for (const item of tabItems) {
            // Each item can have multiple URLs (newline separated)
            const urls = item.content.split('\n').filter(u => u.trim());

            for (const url of urls) {
                const domain = getDomain(url);
                const faviconUrl = getFaviconUrl(url);
                const displayTitle = item.description || item.title || domain;

                html += `
                    <a class="url-item" href="${escapeHtml(url)}" target="_blank"
                       onclick="handleSidebarUrlClick(event, ${item.id}, '${escapeHtml(url).replace(/'/g, "\\'")}')">
                        <div class="url-favicon loading" data-url="${escapeHtml(url)}">
                            ${faviconUrl ? `<img src="${faviconUrl}" alt="" onerror="this.parentElement.innerHTML='🔗'" onload="this.parentElement.classList.remove('loading')">` : '🔗'}
                        </div>
                        <div class="url-info">
                            <div class="url-title">${escapeHtml(displayTitle)}</div>
                            <div class="url-domain">${escapeHtml(domain)}</div>
                        </div>
                        ${item.copy_count > 0 ? `<span class="url-count">${item.copy_count}</span>` : ''}
                    </a>
                `;
            }
        }

        html += `</div>`;
    }

    if (!html) {
        container.innerHTML = '<div class="sidebar-empty">暂无 URL 链接</div>';
        return;
    }

    container.innerHTML = html;
}

// Handle sidebar URL click
async function handleSidebarUrlClick(event, itemId, url) {
    event.preventDefault();
    window.open(url, '_blank');
    incrementCopyCount(itemId);
    showToast('已在新标签页打开');

    // Refresh both main content and sidebar
    if (currentTabId === ALL_TAB_ID) {
        await loadAllItems();
    } else {
        await loadItems();
    }
    await loadSidebarUrls();
}

// Call initSidebar after database is ready
const originalInitDatabase = initDatabase;
initDatabase = async function() {
    await originalInitDatabase.call(this);
    initSidebar();
};

// Also refresh sidebar when tabs or items change
const originalLoadTabs = loadTabs;
loadTabs = async function() {
    await originalLoadTabs.call(this);
    loadSidebarUrls();
};

const originalLoadItems = loadItems;
loadItems = async function() {
    await originalLoadItems.call(this);
    // Only refresh sidebar if we're on a URL tab or after item changes
    loadSidebarUrls();
};
