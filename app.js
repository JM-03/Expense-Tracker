/**
 * Holiday Expense Tracker — Main Application Logic
 * With Firebase Firestore real-time sync
 * Features: CRUD expenses, budget tracking, category breakdown,
 *           filtering/sorting, export CSV, trip code sharing
 */

(function () {
    'use strict';

    // ===================== FIREBASE INIT =====================
    let db = null;
    let tripCode = null;
    let unsubscribeTripInfo = null;
    let unsubscribeExpenses = null;

    function initFirebase() {
        try {
            if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey === 'ISI_DENGAN_API_KEY_KAMU') {
                console.warn('Firebase belum dikonfigurasi. Menggunakan mode offline (localStorage).');
                return false;
            }
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            // Enable offline persistence
            db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Persistence not available in this browser');
                }
            });
            return true;
        } catch (e) {
            console.error('Firebase init error:', e);
            return false;
        }
    }

    const firebaseReady = initFirebase();

    // ===================== STATE =====================
    const LOCAL_TRIPS_KEY = 'holiday_tracker_recent_trips';
    let state = {
        trip: { name: '', startDate: '', endDate: '', budget: 0 },
        expenses: [],
    };

    // ===================== DOM ELEMENTS =====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        // Screens
        joinScreen: $('#join-screen'),
        appContainer: $('#app-container'),

        // Join screen
        tabCreate: $('#tab-create'),
        tabJoin: $('#tab-join'),
        panelCreate: $('#panel-create'),
        panelJoin: $('#panel-join'),
        createTripName: $('#create-trip-name'),
        btnCreateTrip: $('#btn-create-trip'),
        joinTripCode: $('#join-trip-code'),
        btnJoinTrip: $('#btn-join-trip'),
        joinRecent: $('#join-recent'),
        joinRecentList: $('#join-recent-list'),

        // Trip code
        tripCodeBanner: $('#trip-code-banner'),
        tripCodeDisplay: $('#trip-code-display'),
        btnCopyCode: $('#btn-copy-code'),

        // Sync
        syncStatus: $('#sync-status'),

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
        btnShare: $('#btn-share'),
        btnExport: $('#btn-export'),
        btnLeave: $('#btn-leave'),

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

        // Share modal
        shareModalOverlay: $('#share-modal-overlay'),
        shareCodeDisplay: $('#share-code-display'),
        shareLinkInput: $('#share-link-input'),
        btnCopyLink: $('#btn-copy-link'),
        shareClose: $('#share-close'),

        // Toast
        toastContainer: $('#toast-container'),
    };

    // ===================== TRIP CODE GENERATOR =====================
    function generateTripCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ===================== RECENT TRIPS (localStorage) =====================
    function getRecentTrips() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) || '[]');
        } catch { return []; }
    }

    function saveRecentTrip(code, name) {
        const trips = getRecentTrips().filter(t => t.code !== code);
        trips.unshift({ code, name: name || 'Trip ' + code, lastAccess: Date.now() });
        if (trips.length > 5) trips.length = 5;
        localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(trips));
    }

    function removeRecentTrip(code) {
        const trips = getRecentTrips().filter(t => t.code !== code);
        localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(trips));
    }

    function renderRecentTrips() {
        const trips = getRecentTrips();
        if (trips.length === 0) {
            dom.joinRecent.style.display = 'none';
            return;
        }
        dom.joinRecent.style.display = '';
        dom.joinRecentList.innerHTML = trips.map(t => `
            <button class="recent-trip-item" data-code="${t.code}">
                <span class="recent-trip-name">${escapeHtml(t.name)}</span>
                <span class="recent-trip-code">${t.code}</span>
            </button>
        `).join('');
    }

    // ===================== HELPERS =====================
    function formatCurrency(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }

    function parseCurrencyInput(value) {
        return parseInt(value.replace(/\D/g, ''), 10) || 0;
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function getCategoryEmoji(category) {
        const match = category.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
        return match ? match[0] : '📦';
    }

    function getDayCount() {
        if (state.expenses.length === 0) return 1;
        const dates = state.expenses.map(e => new Date(e.date + 'T00:00:00').getTime());
        const diff = Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(diff, 1);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    const CATEGORY_COLORS = [
        'cat-color-0', 'cat-color-1', 'cat-color-2', 'cat-color-3',
        'cat-color-4', 'cat-color-5', 'cat-color-6', 'cat-color-7', 'cat-color-8'
    ];

    function setupAmountFormatting(input) {
        input.addEventListener('input', function () {
            const raw = this.value.replace(/\D/g, '');
            this.value = raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
        });
    }

    // ===================== SYNC STATUS =====================
    function setSyncStatus(status) {
        const dot = dom.syncStatus.querySelector('.sync-dot');
        const text = dom.syncStatus.querySelector('.sync-text');
        dot.className = 'sync-dot ' + status;
        const labels = { synced: 'Synced', syncing: 'Syncing...', offline: 'Offline', error: 'Error' };
        text.textContent = labels[status] || status;
    }

    // ===================== TOAST =====================
    function showToast(message, type = 'success') {
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===================== FIREBASE OPERATIONS =====================
    function tripRef() {
        return db.collection('trips').doc(tripCode);
    }

    function expensesRef() {
        return tripRef().collection('expenses');
    }

    // Save trip info to Firestore
    let tripInfoSaveTimeout = null;
    function saveTripInfoToFirestore() {
        if (!firebaseReady || !tripCode) return;
        clearTimeout(tripInfoSaveTimeout);
        tripInfoSaveTimeout = setTimeout(() => {
            setSyncStatus('syncing');
            tripRef().set({
                name: state.trip.name,
                startDate: state.trip.startDate,
                endDate: state.trip.endDate,
                budget: state.trip.budget,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).then(() => {
                setSyncStatus('synced');
                saveRecentTrip(tripCode, state.trip.name);
            }).catch(err => {
                console.error('Save trip info error:', err);
                setSyncStatus('error');
            });
        }, 500); // Debounce
    }

    // Add expense to Firestore
    function addExpenseToFirestore(expense) {
        if (!firebaseReady || !tripCode) return Promise.resolve();
        setSyncStatus('syncing');
        return expensesRef().doc(expense.id).set({
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
            createdAt: expense.createdAt || Date.now()
        }).then(() => {
            setSyncStatus('synced');
        }).catch(err => {
            console.error('Add expense error:', err);
            setSyncStatus('error');
        });
    }

    // Update expense in Firestore
    function updateExpenseInFirestore(expense) {
        if (!firebaseReady || !tripCode) return Promise.resolve();
        setSyncStatus('syncing');
        return expensesRef().doc(expense.id).update({
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
        }).then(() => {
            setSyncStatus('synced');
        }).catch(err => {
            console.error('Update expense error:', err);
            setSyncStatus('error');
        });
    }

    // Delete expense from Firestore
    function deleteExpenseFromFirestore(id) {
        if (!firebaseReady || !tripCode) return Promise.resolve();
        setSyncStatus('syncing');
        return expensesRef().doc(id).delete().then(() => {
            setSyncStatus('synced');
        }).catch(err => {
            console.error('Delete expense error:', err);
            setSyncStatus('error');
        });
    }

    // Listen to real-time changes
    function subscribeToTrip() {
        if (!firebaseReady || !tripCode) return;

        // Listen to trip info
        unsubscribeTripInfo = tripRef().onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                state.trip.name = data.name || '';
                state.trip.startDate = data.startDate || '';
                state.trip.endDate = data.endDate || '';
                state.trip.budget = data.budget || 0;
                updateTripInfoUI();
                renderStats();
                renderBudgetProgress();
                saveRecentTrip(tripCode, state.trip.name);
            }
            setSyncStatus('synced');
        }, err => {
            console.error('Trip info snapshot error:', err);
            setSyncStatus('error');
        });

        // Listen to expenses
        unsubscribeExpenses = expensesRef().onSnapshot(snapshot => {
            state.expenses = [];
            snapshot.forEach(doc => {
                state.expenses.push({ id: doc.id, ...doc.data() });
            });
            renderStats();
            renderBudgetProgress();
            renderCategoryChart();
            renderExpenseList();
            renderFilterOptions();
            setSyncStatus('synced');
        }, err => {
            console.error('Expenses snapshot error:', err);
            setSyncStatus('error');
        });
    }

    function unsubscribeAll() {
        if (unsubscribeTripInfo) { unsubscribeTripInfo(); unsubscribeTripInfo = null; }
        if (unsubscribeExpenses) { unsubscribeExpenses(); unsubscribeExpenses = null; }
    }

    // ===================== SCREENS =====================
    function showJoinScreen() {
        unsubscribeAll();
        tripCode = null;
        state = { trip: { name: '', startDate: '', endDate: '', budget: 0 }, expenses: [] };
        dom.joinScreen.style.display = '';
        dom.appContainer.style.display = 'none';
        renderRecentTrips();
    }

    function showApp(code) {
        tripCode = code.toUpperCase();
        dom.joinScreen.style.display = 'none';
        dom.appContainer.style.display = '';
        dom.tripCodeDisplay.textContent = tripCode;

        // Set default date
        if (!dom.dateInput.value) {
            dom.dateInput.value = new Date().toISOString().split('T')[0];
        }

        if (firebaseReady) {
            setSyncStatus('syncing');
            subscribeToTrip();
        } else {
            setSyncStatus('offline');
            // Fallback: load from localStorage
            loadFromLocalStorage(code);
        }
    }

    // localStorage fallback
    function loadFromLocalStorage(code) {
        try {
            const raw = localStorage.getItem('trip_' + code);
            if (raw) {
                const data = JSON.parse(raw);
                state.trip = data.trip || state.trip;
                state.expenses = data.expenses || [];
            }
        } catch (e) { /* ignore */ }
        updateTripInfoUI();
        renderAll();
    }

    function saveToLocalStorage() {
        if (tripCode) {
            localStorage.setItem('trip_' + tripCode, JSON.stringify(state));
        }
    }

    // ===================== RENDER =====================
    function renderAll() {
        renderStats();
        renderBudgetProgress();
        renderCategoryChart();
        renderExpenseList();
        renderFilterOptions();
    }

    function updateTripInfoUI() {
        dom.tripName.value = state.trip.name || '';
        dom.tripStart.value = state.trip.startDate || '';
        dom.tripEnd.value = state.trip.endDate || '';
        dom.tripBudget.value = state.trip.budget ? state.trip.budget.toLocaleString('id-ID') : '';
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
        if (budget <= 0) { dom.budgetSection.style.display = 'none'; return; }
        dom.budgetSection.style.display = '';
        const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
        const percent = Math.min((total / budget) * 100, 100);
        const actual = (total / budget) * 100;

        dom.progressBar.style.width = percent + '%';
        dom.progressPercent.textContent = Math.round(actual) + '%';

        if (actual > 100) {
            dom.progressBar.classList.add('over-budget');
            dom.progressPercent.style.color = '#ef4444';
        } else if (actual > 80) {
            dom.progressBar.classList.remove('over-budget');
            dom.progressPercent.style.color = '#f59e0b';
        } else {
            dom.progressBar.classList.remove('over-budget');
            dom.progressPercent.style.color = '';
        }
    }

    function renderCategoryChart() {
        const categories = {};
        state.expenses.forEach(e => { categories[e.category] = (categories[e.category] || 0) + e.amount; });
        const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            dom.categoryChart.innerHTML = '<div class="empty-state-mini">Belum ada data kategori</div>';
            return;
        }
        const maxAmount = entries[0][1];
        const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
        dom.categoryChart.innerHTML = entries.map(([cat, amount], i) => {
            const widthPercent = Math.max((amount / maxAmount) * 100, 8);
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
                </div>`;
        }).join('');
    }

    function getFilteredExpenses() {
        let expenses = [...state.expenses];
        const filterCat = dom.filterCategory.value;
        if (filterCat !== 'all') expenses = expenses.filter(e => e.category === filterCat);
        const sortBy = dom.sortBy.value;
        switch (sortBy) {
            case 'date-desc': expenses.sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0)); break;
            case 'date-asc': expenses.sort((a, b) => new Date(a.date) - new Date(b.date) || (a.createdAt || 0) - (b.createdAt || 0)); break;
            case 'amount-desc': expenses.sort((a, b) => b.amount - a.amount); break;
            case 'amount-asc': expenses.sort((a, b) => a.amount - b.amount); break;
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
                </div>`;
            return;
        }
        dom.expenseList.innerHTML = expenses.map((expense, idx) => {
            const emoji = getCategoryEmoji(expense.category);
            return `
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
                </div>`;
        }).join('');
    }

    function renderFilterOptions() {
        const categories = [...new Set(state.expenses.map(e => e.category))].sort();
        const current = dom.filterCategory.value;
        dom.filterCategory.innerHTML = '<option value="all">Semua Kategori</option>' +
            categories.map(cat => `<option value="${cat}" ${cat === current ? 'selected' : ''}>${cat}</option>`).join('');
    }

    // ===================== TRIP INFO HANDLERS =====================
    function initTripInfoHandlers() {
        const saveTrip = () => {
            state.trip.name = dom.tripName.value.trim();
            state.trip.startDate = dom.tripStart.value;
            state.trip.endDate = dom.tripEnd.value;
            state.trip.budget = parseCurrencyInput(dom.tripBudget.value);
            saveTripInfoToFirestore();
            saveToLocalStorage();
            renderStats();
            renderBudgetProgress();
        };

        dom.tripName.addEventListener('input', saveTrip);
        dom.tripStart.addEventListener('change', saveTrip);
        dom.tripEnd.addEventListener('change', saveTrip);
        setupAmountFormatting(dom.tripBudget);
        dom.tripBudget.addEventListener('input', saveTrip);
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

        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const expense = { id, description, amount, category, date, createdAt: Date.now() };

        state.expenses.push(expense);
        addExpenseToFirestore(expense);
        saveToLocalStorage();
        showToast(`${formatCurrency(amount)} — ${description}`, 'success');

        dom.descInput.value = '';
        dom.amountInput.value = '';
        dom.descInput.focus();
        renderAll();
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
            deleteExpenseFromFirestore(deleteTargetId);
            saveToLocalStorage();
            closeModal();
            showToast('Pengeluaran berhasil dihapus', 'info');
            renderAll();
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

        updateExpenseInFirestore(expense);
        saveToLocalStorage();
        dom.editModalOverlay.classList.remove('active');
        showToast('Pengeluaran berhasil diperbarui', 'success');
        renderAll();
    }

    // ===================== SHARE =====================
    function handleShare() {
        dom.shareCodeDisplay.textContent = tripCode;
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const shareLink = baseUrl + '?code=' + tripCode;
        dom.shareLinkInput.value = shareLink;
        dom.shareModalOverlay.classList.add('active');
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
            .map(e => `${e.date},"${e.category}","${e.description.replace(/"/g, '""')}",${e.amount}`)
            .join('\n');
        const totalRow = `\n\n,,TOTAL,${state.expenses.reduce((s, e) => s + e.amount, 0)}`;
        const tripInfo = state.trip.name ? `Trip: ${state.trip.name}\nKode: ${tripCode}\nBudget: ${state.trip.budget || 'Tidak ditentukan'}\n\n` : '';

        const blob = new Blob([tripInfo + header + rows + totalRow], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = state.trip.name
            ? `pengeluaran-${state.trip.name.toLowerCase().replace(/\s+/g, '-')}.csv`
            : 'pengeluaran-holiday.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data berhasil diexport ke CSV', 'success');
    }

    // ===================== MODAL HELPERS =====================
    function closeModal() {
        dom.modalOverlay.classList.remove('active');
        deleteTargetId = null;
    }

    // ===================== JOIN SCREEN LOGIC =====================
    function initJoinScreen() {
        // Tab switching
        dom.tabCreate.addEventListener('click', () => {
            dom.tabCreate.classList.add('active');
            dom.tabJoin.classList.remove('active');
            dom.panelCreate.classList.add('active');
            dom.panelJoin.classList.remove('active');
        });

        dom.tabJoin.addEventListener('click', () => {
            dom.tabJoin.classList.add('active');
            dom.tabCreate.classList.remove('active');
            dom.panelJoin.classList.add('active');
            dom.panelCreate.classList.remove('active');
        });

        // Create trip
        dom.btnCreateTrip.addEventListener('click', async () => {
            const name = dom.createTripName.value.trim() || 'My Trip';
            const code = generateTripCode();

            if (firebaseReady) {
                dom.btnCreateTrip.disabled = true;
                dom.btnCreateTrip.querySelector('span').textContent = 'Membuat...';
                try {
                    await db.collection('trips').doc(code).set({
                        name: name,
                        startDate: '',
                        endDate: '',
                        budget: 0,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    saveRecentTrip(code, name);
                    showApp(code);
                } catch (err) {
                    console.error('Create trip error:', err);
                    showToast('Gagal membuat trip. Cek koneksi internet.', 'error');
                } finally {
                    dom.btnCreateTrip.disabled = false;
                    dom.btnCreateTrip.querySelector('span').textContent = 'Buat Trip Baru';
                }
            } else {
                saveRecentTrip(code, name);
                state.trip.name = name;
                saveToLocalStorage();
                showApp(code);
            }
        });

        // Join trip
        dom.btnJoinTrip.addEventListener('click', async () => {
            const code = dom.joinTripCode.value.trim().toUpperCase();
            if (code.length < 4) {
                showToast('Masukkan kode trip yang valid', 'error');
                return;
            }

            if (firebaseReady) {
                dom.btnJoinTrip.disabled = true;
                dom.btnJoinTrip.querySelector('span').textContent = 'Mencari...';
                try {
                    const doc = await db.collection('trips').doc(code).get();
                    if (doc.exists) {
                        saveRecentTrip(code, doc.data().name);
                        showApp(code);
                    } else {
                        showToast('Trip tidak ditemukan. Periksa kode.', 'error');
                    }
                } catch (err) {
                    console.error('Join trip error:', err);
                    showToast('Gagal. Cek koneksi internet.', 'error');
                } finally {
                    dom.btnJoinTrip.disabled = false;
                    dom.btnJoinTrip.querySelector('span').textContent = 'Gabung Trip';
                }
            } else {
                saveRecentTrip(code, 'Trip ' + code);
                showApp(code);
            }
        });

        // Recent trips click
        dom.joinRecentList.addEventListener('click', (e) => {
            const item = e.target.closest('.recent-trip-item');
            if (item) {
                showApp(item.dataset.code);
            }
        });

        // Enter key
        dom.createTripName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') dom.btnCreateTrip.click();
        });
        dom.joinTripCode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') dom.btnJoinTrip.click();
        });

        // Auto-uppercase trip code input
        dom.joinTripCode.addEventListener('input', () => {
            dom.joinTripCode.value = dom.joinTripCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        renderRecentTrips();
    }

    // ===================== EVENT LISTENERS =====================
    function bindEvents() {
        dom.form.addEventListener('submit', handleAddExpense);
        setupAmountFormatting(dom.amountInput);
        setupAmountFormatting(dom.editAmount);

        dom.filterCategory.addEventListener('change', renderExpenseList);
        dom.sortBy.addEventListener('change', renderExpenseList);

        dom.btnShare.addEventListener('click', handleShare);
        dom.btnExport.addEventListener('click', handleExport);
        dom.btnLeave.addEventListener('click', showJoinScreen);

        // Copy code
        dom.btnCopyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(tripCode).then(() => showToast('Kode trip disalin!', 'success'));
        });

        // Share modal
        dom.btnCopyLink.addEventListener('click', () => {
            dom.shareLinkInput.select();
            navigator.clipboard.writeText(dom.shareLinkInput.value).then(() => showToast('Link disalin!', 'success'));
        });
        dom.shareClose.addEventListener('click', () => dom.shareModalOverlay.classList.remove('active'));
        dom.shareModalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.shareModalOverlay) dom.shareModalOverlay.classList.remove('active');
        });

        // Modals
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => { if (e.target === dom.modalOverlay) closeModal(); });
        dom.editForm.addEventListener('submit', handleSaveEdit);
        dom.editCancel.addEventListener('click', () => dom.editModalOverlay.classList.remove('active'));
        dom.editModalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.editModalOverlay) dom.editModalOverlay.classList.remove('active');
        });

        // Expense list delegation
        dom.expenseList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');
            if (editBtn) handleEditExpense(editBtn.dataset.id);
            else if (deleteBtn) handleDeleteExpense(deleteBtn.dataset.id);
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                dom.editModalOverlay.classList.remove('active');
                dom.shareModalOverlay.classList.remove('active');
            }
        });
    }

    // ===================== URL PARAMS =====================
    function checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code && code.length >= 4) {
            return code.toUpperCase();
        }
        return null;
    }

    // ===================== INIT =====================
    function init() {
        initJoinScreen();
        initTripInfoHandlers();
        bindEvents();

        // Check URL for code param
        const codeFromUrl = checkUrlParams();
        if (codeFromUrl) {
            showApp(codeFromUrl);
            saveRecentTrip(codeFromUrl, 'Trip ' + codeFromUrl);
        } else {
            // Check if we have a recent trip
            showJoinScreen();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
