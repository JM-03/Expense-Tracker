/**
 * Holiday Expense Tracker — Main Application Logic
 * Features: CRUD expenses, budget tracking, category breakdown,
 *           filtering/sorting, export CSV, localStorage persistence
 */

(function () {
    'use strict';

    // ===================== STATE =====================
    const STORAGE_KEY = 'holiday_expense_tracker';
    let state = loadState();

    // ===================== DOM ELEMENTS =====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        // Trip info
        tripName: $('#trip-name'),
        tripStart: $('#trip-start'),
        tripEnd: $('#trip-end'),
        tripBudget: $('#trip-budget'),
        budgetSection: $('#budget-progress-section'),
        progressBar: $('#progress-bar'),
        progressPercent: $('#progress-percent'),

        // Stats
        statTotal: $('#stat-total'),
        statRemaining: $('#stat-remaining'),
        statCount: $('#stat-count'),
        statDaily: $('#stat-daily'),

        // Form
        form: $('#expense-form'),
        descInput: $('#expense-desc'),
        amountInput: $('#expense-amount'),
        categoryInput: $('#expense-category'),
        dateInput: $('#expense-date'),

        // Category chart
        categoryChart: $('#category-chart'),

        // List
        expenseList: $('#expense-list'),
        filterCategory: $('#filter-category'),
        sortBy: $('#sort-by'),

        // Actions
        btnExport: $('#btn-export'),
        btnClear: $('#btn-clear'),

        // Modal
        modalOverlay: $('#modal-overlay'),
        modalTitle: $('#modal-title'),
        modalMessage: $('#modal-message'),
        modalConfirm: $('#modal-confirm'),
        modalCancel: $('#modal-cancel'),

        // Edit modal
        editModalOverlay: $('#edit-modal-overlay'),
        editForm: $('#edit-form'),
        editDesc: $('#edit-desc'),
        editAmount: $('#edit-amount'),
        editCategory: $('#edit-category'),
        editDate: $('#edit-date'),
        editCancel: $('#edit-cancel'),

        // Toast
        toastContainer: $('#toast-container'),
    };

    // ===================== PERSISTENCE =====================
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
        return {
            trip: { name: '', startDate: '', endDate: '', budget: 0 },
            expenses: [],
        };
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    // ===================== HELPERS =====================
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function formatCurrency(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }

    function parseCurrencyInput(value) {
        // Remove non-digit characters
        return parseInt(value.replace(/\D/g, ''), 10) || 0;
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return d.toLocaleDateString('id-ID', options);
    }

    function getCategoryEmoji(category) {
        const match = category.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
        return match ? match[0] : '📦';
    }

    function getDayCount() {
        const expenses = state.expenses;
        if (expenses.length === 0) return 1;
        const dates = expenses.map(e => new Date(e.date + 'T00:00:00').getTime());
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const diff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(diff, 1);
    }

    const CATEGORY_COLORS = [
        'cat-color-0', 'cat-color-1', 'cat-color-2', 'cat-color-3',
        'cat-color-4', 'cat-color-5', 'cat-color-6', 'cat-color-7', 'cat-color-8'
    ];

    // ===================== FORMAT AMOUNT INPUT =====================
    function setupAmountFormatting(input) {
        input.addEventListener('input', function () {
            const raw = this.value.replace(/\D/g, '');
            if (raw) {
                this.value = parseInt(raw, 10).toLocaleString('id-ID');
            } else {
                this.value = '';
            }
        });
    }

    // ===================== TOAST =====================
    function showToast(message, type = 'success') {
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===================== RENDER =====================
    function render() {
        renderStats();
        renderBudgetProgress();
        renderCategoryChart();
        renderExpenseList();
        renderFilterOptions();
        saveState();
    }

    function renderStats() {
        const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
        const budget = state.trip.budget || 0;
        const remaining = budget - total;
        const count = state.expenses.length;
        const dailyAvg = count > 0 ? Math.round(total / getDayCount()) : 0;

        dom.statTotal.textContent = formatCurrency(total);
        dom.statRemaining.textContent = budget > 0 ? formatCurrency(remaining) : '—';
        dom.statCount.textContent = count;
        dom.statDaily.textContent = formatCurrency(dailyAvg);

        // Color remaining
        if (budget > 0 && remaining < 0) {
            dom.statRemaining.style.color = '#ef4444';
        } else if (budget > 0 && remaining < budget * 0.2) {
            dom.statRemaining.style.color = '#f59e0b';
        } else {
            dom.statRemaining.style.color = '';
        }
    }

    function renderBudgetProgress() {
        const budget = state.trip.budget || 0;
        if (budget <= 0) {
            dom.budgetSection.style.display = 'none';
            return;
        }
        dom.budgetSection.style.display = '';
        const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
        const percent = Math.min((total / budget) * 100, 100);
        const actualPercent = (total / budget) * 100;

        dom.progressBar.style.width = percent + '%';
        dom.progressPercent.textContent = Math.round(actualPercent) + '%';

        if (actualPercent > 100) {
            dom.progressBar.classList.add('over-budget');
            dom.progressPercent.style.color = '#ef4444';
        } else if (actualPercent > 80) {
            dom.progressBar.classList.remove('over-budget');
            dom.progressPercent.style.color = '#f59e0b';
        } else {
            dom.progressBar.classList.remove('over-budget');
            dom.progressPercent.style.color = '';
        }
    }

    function renderCategoryChart() {
        const categories = {};
        state.expenses.forEach(e => {
            categories[e.category] = (categories[e.category] || 0) + e.amount;
        });

        const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            dom.categoryChart.innerHTML = '<div class="empty-state-mini">Belum ada data kategori</div>';
            return;
        }

        const maxAmount = entries[0][1];
        dom.categoryChart.innerHTML = entries.map(([cat, amount], i) => {
            const widthPercent = Math.max((amount / maxAmount) * 100, 8);
            const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
            const sharePercent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
            return `
                <div class="category-bar-row" style="animation-delay: ${i * 0.05}s">
                    <span class="category-bar-label">${cat}</span>
                    <div class="category-bar-track">
                        <div class="category-bar-fill ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}" style="width: ${widthPercent}%">
                            <span>${sharePercent}%</span>
                        </div>
                    </div>
                    <span class="category-bar-amount">${formatCurrency(amount)}</span>
                </div>
            `;
        }).join('');
    }

    function getFilteredExpenses() {
        let expenses = [...state.expenses];

        // Filter
        const filterCat = dom.filterCategory.value;
        if (filterCat !== 'all') {
            expenses = expenses.filter(e => e.category === filterCat);
        }

        // Sort
        const sortBy = dom.sortBy.value;
        switch (sortBy) {
            case 'date-desc':
                expenses.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
                break;
            case 'date-asc':
                expenses.sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
                break;
            case 'amount-desc':
                expenses.sort((a, b) => b.amount - a.amount);
                break;
            case 'amount-asc':
                expenses.sort((a, b) => a.amount - b.amount);
                break;
        }

        return expenses;
    }

    function renderExpenseList() {
        const expenses = getFilteredExpenses();

        if (expenses.length === 0) {
            const isFiltered = dom.filterCategory.value !== 'all';
            dom.expenseList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${isFiltered ? '🔍' : '🏖️'}</div>
                    <h3>${isFiltered ? 'Tidak ada hasil' : 'Belum ada pengeluaran'}</h3>
                    <p>${isFiltered ? 'Coba filter kategori lain' : 'Mulai catat pengeluaran liburanmu!'}</p>
                </div>
            `;
            return;
        }

        // Group by date
        const grouped = {};
        expenses.forEach(e => {
            const key = e.date;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
        });

        let html = '';
        Object.entries(grouped).forEach(([date, items]) => {
            items.forEach((expense, idx) => {
                const emoji = getCategoryEmoji(expense.category);
                html += `
                    <div class="expense-item" data-id="${expense.id}" style="animation-delay: ${idx * 0.04}s">
                        <div class="expense-category-badge">${emoji}</div>
                        <div class="expense-details">
                            <div class="expense-desc">${escapeHtml(expense.description)}</div>
                            <div class="expense-meta">
                                <span class="expense-cat-text">${escapeHtml(expense.category)}</span>
                                <span class="meta-dot"></span>
                                <span class="expense-date-text">${formatDateDisplay(expense.date)}</span>
                            </div>
                        </div>
                        <div class="expense-amount">${formatCurrency(expense.amount)}</div>
                        <div class="expense-actions">
                            <button class="btn-action btn-edit" data-id="${expense.id}" title="Edit">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-action btn-delete" data-id="${expense.id}" title="Hapus">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        dom.expenseList.innerHTML = html;
    }

    function renderFilterOptions() {
        const categories = [...new Set(state.expenses.map(e => e.category))].sort();
        const currentFilter = dom.filterCategory.value;
        dom.filterCategory.innerHTML = '<option value="all">Semua Kategori</option>' +
            categories.map(cat => `<option value="${cat}" ${cat === currentFilter ? 'selected' : ''}>${cat}</option>`).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===================== TRIP INFO =====================
    function initTripInfo() {
        dom.tripName.value = state.trip.name || '';
        dom.tripStart.value = state.trip.startDate || '';
        dom.tripEnd.value = state.trip.endDate || '';
        dom.tripBudget.value = state.trip.budget ? state.trip.budget.toLocaleString('id-ID') : '';

        // Set default date to today
        if (!dom.dateInput.value) {
            dom.dateInput.value = new Date().toISOString().split('T')[0];
        }

        dom.tripName.addEventListener('input', () => {
            state.trip.name = dom.tripName.value.trim();
            saveState();
        });

        dom.tripStart.addEventListener('change', () => {
            state.trip.startDate = dom.tripStart.value;
            saveState();
        });

        dom.tripEnd.addEventListener('change', () => {
            state.trip.endDate = dom.tripEnd.value;
            saveState();
        });

        setupAmountFormatting(dom.tripBudget);
        dom.tripBudget.addEventListener('input', () => {
            state.trip.budget = parseCurrencyInput(dom.tripBudget.value);
            renderStats();
            renderBudgetProgress();
            saveState();
        });
    }

    // ===================== ADD EXPENSE =====================
    function handleAddExpense(e) {
        e.preventDefault();

        const description = dom.descInput.value.trim();
        const amount = parseCurrencyInput(dom.amountInput.value);
        const category = dom.categoryInput.value;
        const date = dom.dateInput.value;

        if (!description || !amount || !category || !date) {
            showToast('Mohon lengkapi semua field', 'error');
            return;
        }

        if (amount <= 0) {
            showToast('Jumlah harus lebih dari 0', 'error');
            return;
        }

        const expense = {
            id: generateId(),
            description,
            amount,
            category,
            date,
            createdAt: Date.now(),
        };

        state.expenses.push(expense);
        showToast(`${formatCurrency(amount)} — ${description}`, 'success');

        // Reset form (keep category and date)
        dom.descInput.value = '';
        dom.amountInput.value = '';
        dom.descInput.focus();

        render();
    }

    // ===================== DELETE EXPENSE =====================
    let deleteTargetId = null;

    function handleDeleteExpense(id) {
        deleteTargetId = id;
        const expense = state.expenses.find(e => e.id === id);
        if (!expense) return;

        dom.modalTitle.textContent = 'Hapus Pengeluaran?';
        dom.modalMessage.textContent = `"${expense.description}" — ${formatCurrency(expense.amount)} akan dihapus.`;
        dom.modalConfirm.textContent = 'Hapus';
        dom.modalConfirm.onclick = () => {
            state.expenses = state.expenses.filter(e => e.id !== deleteTargetId);
            closeModal();
            showToast('Pengeluaran berhasil dihapus', 'info');
            render();
        };
        dom.modalOverlay.classList.add('active');
    }

    // ===================== EDIT EXPENSE =====================
    let editTargetId = null;

    function handleEditExpense(id) {
        editTargetId = id;
        const expense = state.expenses.find(e => e.id === id);
        if (!expense) return;

        dom.editDesc.value = expense.description;
        dom.editAmount.value = expense.amount.toLocaleString('id-ID');
        dom.editCategory.value = expense.category;
        dom.editDate.value = expense.date;

        dom.editModalOverlay.classList.add('active');
    }

    function handleSaveEdit(e) {
        e.preventDefault();
        const expense = state.expenses.find(e => e.id === editTargetId);
        if (!expense) return;

        const desc = dom.editDesc.value.trim();
        const amount = parseCurrencyInput(dom.editAmount.value);
        const category = dom.editCategory.value;
        const date = dom.editDate.value;

        if (!desc || !amount || !category || !date) {
            showToast('Mohon lengkapi semua field', 'error');
            return;
        }

        expense.description = desc;
        expense.amount = amount;
        expense.category = category;
        expense.date = date;

        dom.editModalOverlay.classList.remove('active');
        showToast('Pengeluaran berhasil diperbarui', 'success');
        render();
    }

    // ===================== CLEAR ALL =====================
    function handleClearAll() {
        if (state.expenses.length === 0) {
            showToast('Tidak ada data untuk dihapus', 'info');
            return;
        }

        dom.modalTitle.textContent = 'Hapus Semua Data?';
        dom.modalMessage.textContent = `${state.expenses.length} pengeluaran akan dihapus. Tindakan ini tidak bisa dibatalkan.`;
        dom.modalConfirm.textContent = 'Hapus Semua';
        dom.modalConfirm.onclick = () => {
            state.expenses = [];
            closeModal();
            showToast('Semua data berhasil dihapus', 'info');
            render();
        };
        dom.modalOverlay.classList.add('active');
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
        deleteTargetId = null;
    }

    // ===================== EXPORT CSV =====================
    function handleExport() {
        if (state.expenses.length === 0) {
            showToast('Tidak ada data untuk diexport', 'info');
            return;
        }

        const header = 'Tanggal,Kategori,Deskripsi,Jumlah\n';
        const rows = state.expenses
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(e => {
                return `${e.date},"${e.category}","${e.description.replace(/"/g, '""')}",${e.amount}`;
            })
            .join('\n');

        const totalRow = `\n\n,,TOTAL,${state.expenses.reduce((s, e) => s + e.amount, 0)}`;

        const tripInfo = state.trip.name
            ? `Trip: ${state.trip.name}\nBudget: ${state.trip.budget || 'Tidak ditentukan'}\n\n`
            : '';

        const blob = new Blob([tripInfo + header + rows + totalRow], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = state.trip.name
            ? `pengeluaran-${state.trip.name.toLowerCase().replace(/\s+/g, '-')}.csv`
            : 'pengeluaran-holiday.csv';
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Data berhasil diexport ke CSV', 'success');
    }

    // ===================== EVENT LISTENERS =====================
    function bindEvents() {
        // Form submit
        dom.form.addEventListener('submit', handleAddExpense);

        // Amount formatting
        setupAmountFormatting(dom.amountInput);
        setupAmountFormatting(dom.editAmount);

        // Filter & sort
        dom.filterCategory.addEventListener('change', renderExpenseList);
        dom.sortBy.addEventListener('change', renderExpenseList);

        // Actions
        dom.btnExport.addEventListener('click', handleExport);
        dom.btnClear.addEventListener('click', handleClearAll);

        // Modal
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });

        // Edit modal
        dom.editForm.addEventListener('submit', handleSaveEdit);
        dom.editCancel.addEventListener('click', () => {
            dom.editModalOverlay.classList.remove('active');
        });
        dom.editModalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.editModalOverlay) {
                dom.editModalOverlay.classList.remove('active');
            }
        });

        // Expense list event delegation
        dom.expenseList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');

            if (editBtn) {
                handleEditExpense(editBtn.dataset.id);
            } else if (deleteBtn) {
                handleDeleteExpense(deleteBtn.dataset.id);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                dom.editModalOverlay.classList.remove('active');
            }
        });
    }

    // ===================== INIT =====================
    function init() {
        initTripInfo();
        bindEvents();
        render();
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
