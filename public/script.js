
const { useState, useEffect, useMemo } = React;

const CATEGORIES = [
    'Food',
    'Transportation',
    'Shopping',
    'Education',
    'Entertainment',
    'Healthcare',
    'Bills and Utilities',
    'Others'
];

const today = () => {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
};

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
});

function App() {
    const [list, setList] = useState([]);
    const [budget, setBudget] = useState(0);
    const [limit, setLimit] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dark, setDark] = useState(
        localStorage.getItem('spendwise-theme') === 'dark'
    );

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterMonth, setFilterMonth] = useState(
        today().slice(0, 7)
    );

    const [form, setForm] = useState({
        type: 'expense',
        amount: '',
        category: 'Food',
        description: '',
        date: today()
    });

    const api = async (url, options = {}) => {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong.');
        }

        return data;
    };

    const load = async () => {
        try {
            setLoading(true);
            setError('');

            const [transactions, budgetData] = await Promise.all([
                api('/api/transactions'),
                api('/api/budget')
            ]);

            setList(transactions);
            setBudget(budgetData.limit);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
        localStorage.setItem(
            'spendwise-theme',
            dark ? 'dark' : 'light'
        );
    }, [dark]);

    const change = (key, value) => {
        setForm(previous => ({
            ...previous,
            [key]: value
        }));
    };

    const resetForm = () => {
        setForm({
            type: 'expense',
            amount: '',
            category: 'Food',
            description: '',
            date: today()
        });
        setEditing(null);
        setError('');
    };

    const openAdd = () => {
        resetForm();
        setModal(true);
    };

    const openEdit = transaction => {
        setEditing(transaction.id);

        setForm({
            type: transaction.type,
            amount: String(transaction.amount),
            category: transaction.category === 'Income'
                ? 'Food' : transaction.category,
            description: transaction.description || '',
            date: transaction.date
        });

        setError('');
        setModal(true);
    };

    const saveTransaction = async e => {
        e.preventDefault();

        try {
            setError('');

            const url = editing
                ? '/api/transactions/' + editing
                : '/api/transactions';

            const method = editing ? 'PUT' : 'POST';

            await api(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            });

            setModal(false);
            resetForm();
            await load();
        } catch (err) {
            setError(err.message);
        }
    };

    const remove = async id => {
        if (!window.confirm('Delete this transaction?')) return;

        try {
            await api('/api/transactions/' + id, {
                method: 'DELETE'
            });

            await load();
        } catch (err) {
            setError(err.message);
        }
    };

    const saveBudget = async e => {
        e.preventDefault();

        try {
            setError('');

            await api('/api/budget', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit })
            });

            setLimit('');
            await load();
        } catch (err) {
            setError(err.message);
        }
    };

    // Dashboard calculations

    const income = list
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = list
        .filter(t => t.type === 'expense');

    const totalExpenses = expenses
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = income - totalExpenses;

    const monthTransactions = expenses.filter(
        t => t.date.startsWith(today().slice(0, 7))
    );

    const monthlySpent = monthTransactions.reduce(
        (sum, t) => sum + Number(t.amount), 0
    );

    const percentage = budget > 0
        ? Math.round((monthlySpent / budget) * 100)
        : 0;

    // Category analysis

    const categories = CATEGORIES.map(category => ({
        name: category,
        total: expenses
            .filter(t => t.category === category)
            .reduce((sum, t) => sum + Number(t.amount), 0)
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

    const maxCategory = Math.max(
        1,
        ...categories.map(c => c.total)
    );

    // Transaction filters

    const filtered = useMemo(() => {
        return [...list]
            .filter(t => {
                const text = (
                    t.description + ' ' + t.category
                ).toLowerCase();

                const matchesSearch = text.includes(
                    search.toLowerCase()
                );

                const matchesType =
                    filterType === 'all' ||
                    t.type === filterType;

                const matchesCategory =
                    filterCategory === 'all' ||
                    t.category === filterCategory;

                const matchesMonth =
                    filterMonth === 'all' ||
                    t.date.startsWith(filterMonth);

                return matchesSearch &&
                    matchesType &&
                    matchesCategory &&
                    matchesMonth;
            })
            .sort((a, b) =>
                b.date.localeCompare(a.date) || b.id - a.id
            );
    }, [list, search, filterType, filterCategory, filterMonth]);

    // CSV export

    const exportCSV = () => {
        const headers = [
            'Date',
            'Type',
            'Category',
            'Description',
            'Amount'
        ];

        const rows = filtered.map(t => [
            t.date,
            t.type,
            t.category,
            t.description,
            t.amount
        ]);

        const escapeCSV = value =>
            '"' + String(value ?? '').replace(/"/g, '""') + '"';

        const csv = [headers, ...rows]
            .map(row => row.map(escapeCSV).join(','))
            .join('\n');

        const blob = new Blob(
            ['\uFEFF' + csv],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'spendwise-transactions.csv';
        link.click();

        URL.revokeObjectURL(url);
    };

    const goTo = id => {
        document.getElementById(id)?.scrollIntoView({
            behavior: 'smooth'
        });
        setMenuOpen(false);
    };

    return (
        <div className="app">

            <div
                className={'mobile-overlay ' + (menuOpen ? 'show' : '')}
                onClick={() => setMenuOpen(false)}
            />

            {/* Sidebar */}

            <aside className={'sidebar ' + (menuOpen ? 'open' : '')}>

                <div className="brand">
                    Spend<span>Wise.</span>
                </div>

                <div className="nav-label">MENU</div>

                <div
                    className="nav-item active"
                    onClick={() => goTo('dashboard')}
                >
                    ◫ Dashboard
                </div>

                <div
                    className="nav-item"
                    onClick={() => goTo('transactions')}
                >
                    ⇄ Transactions
                </div>

                <div
                    className="nav-item"
                    onClick={() => goTo('budget')}
                >
                    ◷ Monthly Budget
                </div>

                <div
                    className="nav-item"
                    onClick={() => goTo('categories')}
                >
                    ▥ Categories
                </div>

                <div className="nav-label">PREFERENCES</div>

                <div
                    className="nav-item"
                    onClick={() => setDark(!dark)}
                >
                    {dark ? '☀ Light Mode' : '☾ Dark Mode'}
                </div>

                <div
                    className="nav-item"
                    onClick={exportCSV}
                >
                    ⇩ Export CSV
                </div>

                <div className="nav-label">ABOUT</div>

                <p className="muted">
                    SpendWise v2.0
                    <br /><br />
                    Manage your money smarter.
                </p>

            </aside>

            {/* Main content */}

            <main className="main" id="dashboard">

                <header className="topbar">

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}>

                        <button
                            className="icon-btn menu-button"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            ☰
                        </button>

                        <div>
                            <h1>Dashboard</h1>
                            <div className="subtitle">
                                Welcome back! Here's your financial overview.
                            </div>
                        </div>

                    </div>

                    <div className="top-actions">

                        <button
                            className="icon-btn"
                            onClick={() => setDark(!dark)}
                            title="Toggle theme"
                        >
                            {dark ? '☀' : '☾'}
                        </button>

                        <button className="btn" onClick={openAdd}>
                            + Add Transaction
                        </button>

                    </div>

                </header>

                {error && !modal && (
                    <p className="error">{error}</p>
                )}

                {/* Summary cards */}

                <section className="stats">

                    <div className="card">
                        <span className="stat-icon">↗</span>
                        <div className="stat-label">Total Income</div>
                        <div className="stat-value green">
                            {money(income)}
                        </div>
                    </div>

                    <div className="card">
                        <span className="stat-icon">↙</span>
                        <div className="stat-label">Total Expenses</div>
                        <div className="stat-value red">
                            {money(totalExpenses)}
                        </div>
                    </div>

                    <div className="card">
                        <span className="stat-icon">₹</span>
                        <div className="stat-label">Available Balance</div>
                        <div className={'stat-value ' + (
                            balance < 0 ? 'red' : 'blue'
                        )}>
                            {money(balance)}
                        </div>
                    </div>

                    <div className="card">
                        <span className="stat-icon">▤</span>
                        <div className="stat-label">This Month's Spending</div>
                        <div className="stat-value">
                            {money(monthlySpent)}
                        </div>
                    </div>

                </section>

                {/* Budget and category section */}

                <section className="content-grid">

                    <div className="card" id="budget">

                        <div className="card-heading">
                            <div>
                                <h2>Monthly Budget</h2>
                                <p>Track your spending limit</p>
                            </div>
                            <span className="stat-icon">◷</span>
                        </div>

                        <div className="stat-label">
                            Monthly spending
                        </div>

                        <div className="budget-number">
                            {money(monthlySpent)}
                        </div>

                        <form onSubmit={saveBudget}>
                            <div className="filters">
                                <input
                                    className="field search"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Enter new budget"
                                    value={limit}
                                    onChange={e => setLimit(e.target.value)}
                                    required
                                />

                                <button className="btn" type="submit">
                                    Save Budget
                                </button>
                            </div>
                        </form>

                        {budget > 0 ? (
                            <>
                                <div className="progress">
                                    <div
                                        className={
                                            'progress-fill ' +
                                            (percentage > 100 ? 'over' : '')
                                        }
                                        style={{
                                            width: Math.min(percentage, 100) + '%'
                                        }}
                                    />
                                </div>

                                <div className="card-heading">
                                    <span className="muted">
                                        {money(monthlySpent)} spent
                                    </span>

                                    <strong className={
                                        percentage > 100 ? 'red' : 'green'
                                    }>
                                        {percentage}%
                                    </strong>
                                </div>

                                <p className="muted">
                                    Budget: {money(budget)}
                                    {' · '}
                                    {monthlySpent > budget
                                        ? 'You exceeded your budget!'
                                        : money(budget - monthlySpent) + ' remaining'}
                                </p>
                            </>
                        ) : (
                            <p className="muted">
                                Set a budget to start tracking your monthly spending.
                            </p>
                        )}

                    </div>

                    <div className="card" id="categories">

                        <div className="card-heading">
                            <div>
                                <h2>Expenses by Category</h2>
                                <p>Overall spending distribution</p>
                            </div>
                        </div>

                        {categories.length === 0 ? (
                            <div className="empty">
                                No expense data available.
                            </div>
                        ) : (
                            categories.map(c => (
                                <div className="category-item" key={c.name}>

                                    <div className="category-info">
                                        <span>{c.name}</span>
                                        <strong>{money(c.total)}</strong>
                                    </div>

                                    <div className="category-track">
                                        <div
                                            className="category-fill"
                                            style={{
                                                width: (c.total / maxCategory) * 100 + '%'
                                            }}
                                        />
                                    </div>

                                </div>
                            ))
                        )}

                    </div>

                </section>

                {/* Transactions */}

                <section className="card transaction-section" id="transactions">

                    <div className="card-heading">

                        <div>
                            <h2>Recent Transactions</h2>
                            <p>View and manage your transactions</p>
                        </div>

                        <button
                            className="btn btn-secondary"
                            onClick={exportCSV}
                        >
                            ⇩ Export CSV
                        </button>

                    </div>

                    <div className="filters">

                        <input
                            className="field search"
                            placeholder="Search transactions..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />

                        <select
                            className="field"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            <option value="all">All Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expenses</option>
                        </select>

                        <select
                            className="field"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            <option value="Income">Income</option>
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <input
                            className="field"
                            type="month"
                            value={filterMonth === 'all' ? '' : filterMonth}
                            onChange={e => setFilterMonth(
                                e.target.value || 'all'
                            )}
                        />

                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setSearch('');
                                setFilterType('all');
                                setFilterCategory('all');
                                setFilterMonth(today().slice(0, 7));
                            }}
                        >
                            Reset
                        </button>

                    </div>

                    {loading ? (
                        <div className="empty">Loading transactions...</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">
                            No transactions found. Add your first transaction!
                        </div>
                    ) : (

                        <div className="table-wrap">

                            <table>
                                <thead>
                                    <tr>
                                        <th>DATE</th>
                                        <th>DESCRIPTION</th>
                                        <th>CATEGORY</th>
                                        <th>TYPE</th>
                                        <th>AMOUNT</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map(t => (
                                        <tr key={t.id}>

                                            <td>{t.date}</td>

                                            <td>
                                                {t.description || 'No description'}
                                            </td>

                                            <td>{t.category}</td>

                                            <td>
                                                <span className={
                                                    'type-tag ' + t.type
                                                }>
                                                    {t.type}
                                                </span>
                                            </td>

                                            <td className={
                                                t.type === 'income'
                                                    ? 'green' : 'red'
                                            }>
                                                {t.type === 'income' ? '+' : '-'}
                                                {money(t.amount)}
                                            </td>

                                            <td>
                                                <div className="actions">

                                                    <button
                                                        className="action-btn"
                                                        onClick={() => openEdit(t)}
                                                        title="Edit"
                                                    >
                                                        ✎
                                                    </button>

                                                    <button
                                                        className="action-btn"
                                                        onClick={() => remove(t.id)}
                                                        title="Delete"
                                                    >
                                                        🗑
                                                    </button>

                                                </div>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        </div>
                    )}

                </section>

                <p className="muted" style={{
                    textAlign: 'center',
                    marginTop: 25
                }}>
                    SpendWise © 2026 · Manage your money smarter.
                </p>

            </main>

            {/* Add/Edit Transaction Modal */}

            {modal && (
                <div
                    className="modal-backdrop"
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) {
                            setModal(false);
                            resetForm();
                        }
                    }}
                >

                    <div className="modal">

                        <h2>
                            {editing ? 'Edit Transaction' : 'Add Transaction'}
                        </h2>

                        <form onSubmit={saveTransaction}>

                            <div className="form-group">
                                <label>Transaction Type</label>

                                <select
                                    className="field"
                                    value={form.type}
                                    onChange={e => change('type', e.target.value)}
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Amount (₹)</label>

                                <input
                                    className="field"
                                    type="number"
                                    min="0.01"
                                    max="1000000000"
                                    step="0.01"
                                    placeholder="Enter amount"
                                    value={form.amount}
                                    onChange={e => change('amount', e.target.value)}
                                    required
                                />
                            </div>

                            {form.type === 'expense' && (
                                <div className="form-group">
                                    <label>Category</label>

                                    <select
                                        className="field"
                                        value={form.category}
                                        onChange={e => change('category', e.target.value)}
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Description</label>

                                <input
                                    className="field"
                                    maxLength="150"
                                    placeholder="What was this transaction for?"
                                    value={form.description}
                                    onChange={e => change('description', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Date</label>

                                <input
                                    className="field"
                                    type="date"
                                    value={form.date}
                                    onChange={e => change('date', e.target.value)}
                                    max={today()}
                                    required
                                />
                            </div>

                            {error && (
                                <p className="error">{error}</p>
                            )}

                            <div className="form-actions">

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setModal(false);
                                        resetForm();
                                    }}
                                >
                                    Cancel
                                </button>

                                <button type="submit" className="btn">
                                    {editing ? 'Update' : 'Add Transaction'}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

        </div>
    );
}

ReactDOM.createRoot(
    document.getElementById('root')
).render(<App />);
