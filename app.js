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
