/* ==============================================================
   Country Chicken Farm Manager — Application Logic
   ==============================================================
   Pure vanilla JS. No dependencies. Data stored in localStorage.
   ============================================================== */

// ========================
//  CONSTANTS
// ========================
const STORAGE_KEY = 'chicken_farm_data';
const INCOME_CATEGORIES = ['Egg Sales', 'Chicken Sales', 'Manure Sales', 'Other'];
const EXPENSE_CATEGORIES = ['Feed', 'Medicine', 'Vaccination', 'Labor', 'Equipment', 'Electricity', 'Water', 'Transportation', 'Other'];

const CATEGORY_ICONS = {
    'Egg Sales': '🥚', 'Chicken Sales': '🐓', 'Manure Sales': '🌱', 'Other': '📦',
    'Feed': '🌽', 'Medicine': '💊', 'Vaccination': '💉', 'Labor': '👷', 'Equipment': '🔧',
    'Electricity': '⚡', 'Water': '💧', 'Transportation': '🚚'
};

// ========================
//  DATA STORE
// ========================
const Store = {
    _data: null,

    _defaults() {
        return { todos: [], income: [], expenses: [], lastBackup: null };
    },

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            this._data = raw ? JSON.parse(raw) : this._defaults();
        } catch {
            this._data = this._defaults();
        }
        // Ensure all keys exist (migration safety)
        const d = this._defaults();
        for (const key of Object.keys(d)) {
            if (!(key in this._data)) this._data[key] = d[key];
        }
    },

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    },

    get data() {
        if (!this._data) this.load();
        return this._data;
    },

    // ---------- Todos ----------
    addTodo(text, date) {
        this.data.todos.push({
            id: this._uid(),
            text,
            date,
            completed: false,
            createdAt: new Date().toISOString()
        });
        this.save();
    },

    toggleTodo(id) {
        const t = this.data.todos.find(t => t.id === id);
        if (t) { t.completed = !t.completed; this.save(); }
    },

    deleteTodo(id) {
        this.data.todos = this.data.todos.filter(t => t.id !== id);
        this.save();
    },

    getTodosByDate(date) {
        return this.data.todos
            .filter(t => t.date === date)
            .sort((a, b) => a.completed - b.completed || new Date(b.createdAt) - new Date(a.createdAt));
    },

    getPendingTodosCount(date) {
        return this.data.todos.filter(t => t.date === date && !t.completed).length;
    },

    // ---------- Finance ----------
    addEntry(type, entry) {
        const list = type === 'income' ? this.data.income : this.data.expenses;
        list.push({
            id: this._uid(),
            ...entry,
            createdAt: new Date().toISOString()
        });
        this.save();
    },

    deleteEntry(type, id) {
        if (type === 'income') {
            this.data.income = this.data.income.filter(e => e.id !== id);
        } else {
            this.data.expenses = this.data.expenses.filter(e => e.id !== id);
        }
        this.save();
    },

    getEntriesByMonth(type, year, month) {
        const list = type === 'income' ? this.data.income : this.data.expenses;
        return list
            .filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === year && d.getMonth() === month;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
    },

    getMonthTotal(type, year, month) {
        return this.getEntriesByMonth(type, year, month)
            .reduce((sum, e) => sum + Number(e.amount), 0);
    },

    getTodayEntries() {
        const today = App.todayStr();
        const inc = this.data.income.filter(e => e.date === today).map(e => ({ ...e, type: 'income' }));
        const exp = this.data.expenses.filter(e => e.date === today).map(e => ({ ...e, type: 'expense' }));
        return [...inc, ...exp].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // ---------- Backup ----------
    exportJSON() {
        this.data.lastBackup = new Date().toISOString();
        this.save();
        return JSON.stringify(this.data, null, 2);
    },

    importJSON(jsonStr) {
        const imported = JSON.parse(jsonStr);
        // Basic validation
        if (!imported.todos || !imported.income || !imported.expenses) {
            throw new Error('Invalid backup file');
        }
        this._data = imported;
        this.save();
    },

    // ---------- Helpers ----------
    _uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
};

// ========================
//  APP CONTROLLER
// ========================
const App = {
    currentTab: 'dashboard',
    todoDate: null,
    incomeMonth: null, // { year, month }
    expenseMonth: null,

    // ---------- Init ----------
    init() {
        Store.load();

        const now = new Date();
        this.todoDate = this.todayStr();
        this.incomeMonth = { year: now.getFullYear(), month: now.getMonth() };
        this.expenseMonth = { year: now.getFullYear(), month: now.getMonth() };

        // Set header date
        document.getElementById('header-date').textContent = now.toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        // Set default date input
        document.getElementById('todo-date').value = this.todoDate;
        document.getElementById('finance-date').value = this.todoDate;

        // Check backup reminder
        this.checkBackupReminder();

        // Render default tab
        this.renderAll();
    },

    todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    // ---------- Tab Navigation ----------
    switchTab(tabName) {
        this.currentTab = tabName;
        // Update panels
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-' + tabName).classList.add('active');
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const navBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
        if (navBtn) navBtn.classList.add('active');
        // Re-render current tab
        this.renderTab(tabName);
    },

    renderTab(tab) {
        switch (tab) {
            case 'dashboard': this.renderDashboard(); break;
            case 'todos': this.renderTodos(); break;
            case 'income': this.renderIncome(); break;
            case 'expenses': this.renderExpenses(); break;
            case 'backup': this.renderBackup(); break;
        }
    },

    renderAll() {
        this.renderDashboard();
        this.renderTodos();
        this.renderIncome();
        this.renderExpenses();
        this.renderBackup();
    },

    // ---------- Dashboard ----------
    renderDashboard() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = this.todayStr();

        const pending = Store.getPendingTodosCount(today);
        const income = Store.getMonthTotal('income', year, month);
        const expense = Store.getMonthTotal('expense', year, month);
        const profit = income - expense;

        document.getElementById('dash-pending').textContent = pending;
        document.getElementById('dash-income').textContent = this.formatCurrency(income);
        document.getElementById('dash-expense').textContent = this.formatCurrency(expense);
        document.getElementById('dash-profit').textContent = this.formatCurrency(profit);

        // Profit bar
        const maxVal = Math.max(income, expense, 1);
        document.getElementById('bar-income').style.width = (income / maxVal * 100) + '%';
        document.getElementById('bar-expense').style.width = (expense / maxVal * 100) + '%';
        document.getElementById('bar-income-amt').textContent = this.formatCurrency(income);
        document.getElementById('bar-expense-amt').textContent = this.formatCurrency(expense);

        // Recent activity
        const todayEntries = Store.getTodayEntries();
        const todayTodos = Store.getTodosByDate(today);
        const recentEl = document.getElementById('recent-list');

        if (todayEntries.length === 0 && todayTodos.length === 0) {
            recentEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🌾</span><p>No activity today. Start by adding a task!</p></div>`;
            return;
        }

        let html = '';
        // Show completed todos
        todayTodos.filter(t => t.completed).forEach(t => {
            html += `<div class="activity-item">
        <div class="activity-icon todo-icon">✅</div>
        <span class="activity-text">${this.escapeHtml(t.text)}</span>
      </div>`;
        });
        // Show finance entries
        todayEntries.forEach(e => {
            const icon = CATEGORY_ICONS[e.category] || '📦';
            const cls = e.type === 'income' ? 'income' : 'expense';
            const sign = e.type === 'income' ? '+' : '-';
            html += `<div class="activity-item">
        <div class="activity-icon ${cls}-icon">${icon}</div>
        <span class="activity-text">${this.escapeHtml(e.category)}${e.notes ? ' — ' + this.escapeHtml(e.notes) : ''}</span>
        <span class="activity-amount ${cls}">${sign}${this.formatCurrency(e.amount)}</span>
      </div>`;
        });

        recentEl.innerHTML = html;
    },

    // ---------- Todos ----------
    renderTodos() {
        const todos = Store.getTodosByDate(this.todoDate);
        const listEl = document.getElementById('todo-list');

        if (todos.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p>No tasks for this day. Add one above!</p></div>`;
            return;
        }

        listEl.innerHTML = todos.map(t => `
      <div class="todo-item" data-id="${t.id}">
        <button class="todo-checkbox ${t.completed ? 'checked' : ''}" onclick="App.handleToggleTodo('${t.id}')" aria-label="Toggle task"></button>
        <span class="todo-text ${t.completed ? 'completed' : ''}">${this.escapeHtml(t.text)}</span>
        <button class="todo-delete" onclick="App.handleDeleteTodo('${t.id}')" aria-label="Delete task">🗑</button>
      </div>
    `).join('');
    },

    handleAddTodo(e) {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        const text = input.value.trim();
        if (!text) return;

        Store.addTodo(text, this.todoDate);
        input.value = '';
        this.renderTodos();
        this.renderDashboard();
        this.showToast('Task added! ✅');
    },

    handleToggleTodo(id) {
        Store.toggleTodo(id);
        this.renderTodos();
        this.renderDashboard();
    },

    handleDeleteTodo(id) {
        this._pendingDeleteId = id;
        this._pendingDeleteType = 'todo';
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('confirm-delete-btn').onclick = () => {
            Store.deleteTodo(id);
            this.hideConfirm();
            this.renderTodos();
            this.renderDashboard();
            this.showToast('Task deleted');
        };
    },

    // Date navigation for todos
    changeDate(delta) {
        const d = new Date(this.todoDate);
        d.setDate(d.getDate() + delta);
        this.todoDate = d.toISOString().split('T')[0];
        document.getElementById('todo-date').value = this.todoDate;
        this.renderTodos();
    },

    onDateChange(value) {
        this.todoDate = value;
        this.renderTodos();
    },

    // ---------- Income ----------
    renderIncome() {
        const { year, month } = this.incomeMonth;
        document.getElementById('income-month-label').textContent = this.monthLabel(year, month);

        const entries = Store.getEntriesByMonth('income', year, month);
        const total = entries.reduce((s, e) => s + Number(e.amount), 0);
        document.getElementById('income-total').textContent = this.formatCurrency(total);

        const listEl = document.getElementById('income-list');
        if (entries.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">💰</span><p>No income recorded this month</p></div>`;
            return;
        }

        listEl.innerHTML = entries.map(e => this._financeItemHTML(e, 'income')).join('');
    },

    // ---------- Expenses ----------
    renderExpenses() {
        const { year, month } = this.expenseMonth;
        document.getElementById('expense-month-label').textContent = this.monthLabel(year, month);

        const entries = Store.getEntriesByMonth('expense', year, month);
        const total = entries.reduce((s, e) => s + Number(e.amount), 0);
        document.getElementById('expense-total').textContent = this.formatCurrency(total);

        const listEl = document.getElementById('expense-list');
        if (entries.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">💸</span><p>No expenses recorded this month</p></div>`;
            return;
        }

        listEl.innerHTML = entries.map(e => this._financeItemHTML(e, 'expense')).join('');
    },

    _financeItemHTML(entry, type) {
        const icon = CATEGORY_ICONS[entry.category] || '📦';
        const dateStr = new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const cls = type === 'income' ? 'income-entry' : 'expense-entry';
        const sign = type === 'income' ? '+' : '-';
        return `
      <div class="finance-item ${cls}">
        <div class="finance-item-icon">${icon}</div>
        <div class="finance-item-details">
          <div class="finance-item-category">${this.escapeHtml(entry.category)}</div>
          <div class="finance-item-meta">${dateStr}${entry.notes ? ' • ' + this.escapeHtml(entry.notes) : ''}</div>
        </div>
        <div class="finance-item-amount">${sign}${this.formatCurrency(entry.amount)}</div>
        <button class="finance-item-delete" onclick="App.handleDeleteFinance('${type}', '${entry.id}')" aria-label="Delete entry">🗑</button>
      </div>`;
    },

    // Month navigation
    changeMonth(type, delta) {
        const m = type === 'income' ? this.incomeMonth : this.expenseMonth;
        m.month += delta;
        if (m.month > 11) { m.month = 0; m.year++; }
        if (m.month < 0) { m.month = 11; m.year--; }
        if (type === 'income') this.renderIncome();
        else this.renderExpenses();
    },

    // ---------- Finance Modal ----------
    showModal(type) {
        const modal = document.getElementById('finance-modal');
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const typeInput = document.getElementById('finance-type');
        const catSelect = document.getElementById('finance-category');
        const saveBtn = document.getElementById('modal-save-btn');

        typeInput.value = type;
        title.textContent = type === 'income' ? 'Add Income' : 'Add Expense';
        saveBtn.textContent = 'Save';

        // Reset form
        document.getElementById('finance-form').reset();
        document.getElementById('finance-date').value = this.todayStr();

        // Fill categories
        const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        catSelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');

        // Focus amount
        setTimeout(() => document.getElementById('finance-amount').focus(), 300);
    },

    hideModal() {
        document.getElementById('finance-modal').classList.add('hidden');
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    handleSaveFinance(e) {
        e.preventDefault();
        const type = document.getElementById('finance-type').value;
        const entry = {
            date: document.getElementById('finance-date').value,
            category: document.getElementById('finance-category').value,
            amount: Number(document.getElementById('finance-amount').value),
            notes: document.getElementById('finance-notes').value.trim()
        };

        if (!entry.date || !entry.amount || entry.amount <= 0) return;

        Store.addEntry(type, entry);
        this.hideModal();
        this.renderAll();
        this.showToast(type === 'income' ? 'Income added! 💰' : 'Expense added! 💸');
    },

    handleDeleteFinance(type, id) {
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('confirm-delete-btn').onclick = () => {
            Store.deleteEntry(type, id);
            this.hideConfirm();
            this.renderAll();
            this.showToast('Entry deleted');
        };
    },

    hideConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // ---------- Backup ----------
    renderBackup() {
        const data = Store.data;
        const statusEl = document.getElementById('backup-status');
        const textEl = document.getElementById('last-backup-text');
        const statsEl = document.getElementById('backup-stats');

        if (data.lastBackup) {
            const d = new Date(data.lastBackup);
            textEl.textContent = 'Last backup: ' + d.toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            statusEl.classList.add('recent');
        } else {
            textEl.textContent = 'Never backed up';
            statusEl.classList.remove('recent');
        }

        statsEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Total Todos</span><span class="stat-value">${data.todos.length}</span></div>
      <div class="stat-row"><span class="stat-label">Income Entries</span><span class="stat-value">${data.income.length}</span></div>
      <div class="stat-row"><span class="stat-label">Expense Entries</span><span class="stat-value">${data.expenses.length}</span></div>
      <div class="stat-row"><span class="stat-label">Total Income</span><span class="stat-value">${this.formatCurrency(data.income.reduce((s, e) => s + Number(e.amount), 0))}</span></div>
      <div class="stat-row"><span class="stat-label">Total Expenses</span><span class="stat-value">${this.formatCurrency(data.expenses.reduce((s, e) => s + Number(e.amount), 0))}</span></div>
    `;
    },

    handleExport() {
        try {
            const json = Store.exportJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `chicken-farm-backup-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.renderBackup();
            this.checkBackupReminder();
            this.showToast('Backup downloaded! ✅');
        } catch (err) {
            this.showToast('Export failed. Please try again.');
        }
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                Store.importJSON(e.target.result);
                this.renderAll();
                this.showToast('Data restored successfully! 🎉');
            } catch (err) {
                this.showToast('Invalid backup file. Please try a different file.');
            }
        };
        reader.readAsText(file);
        // Reset file input so same file can be imported again
        event.target.value = '';
    },

    checkBackupReminder() {
        const last = Store.data.lastBackup;
        const banner = document.getElementById('backup-banner');
        const totalEntries = Store.data.todos.length + Store.data.income.length + Store.data.expenses.length;

        if (totalEntries === 0) {
            banner.classList.add('hidden');
            return;
        }

        if (!last) {
            // Never backed up and has data
            banner.classList.remove('hidden');
            return;
        }

        const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    },

    dismissBanner() {
        document.getElementById('backup-banner').classList.add('hidden');
    },

    // ---------- Helpers ----------
    formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN');
    },

    monthLabel(year, month) {
        return new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 400);
        }, 2200);
    }
};

// ========================
//  BOOT
// ========================
document.addEventListener('DOMContentLoaded', () => App.init());
