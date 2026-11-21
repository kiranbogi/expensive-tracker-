
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const FILE = path.join(__dirname, 'data.json');

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

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function load() {
    try {
        if (!fs.existsSync(FILE)) {
            return { transactions: [], budget: 0 };
        }

        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

        return {
            transactions: Array.isArray(data.transactions)
                ? data.transactions : [],
            budget: Number(data.budget) || 0
        };
    } catch (error) {
        console.error('Data loading error:', error);
        return { transactions: [], budget: 0 };
    }
}

function save(data) {
    const tempFile = FILE + '.tmp';

    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, FILE);
}

function validateTransaction(body) {
    const { type, amount, category, date } = body;

    if (!['income', 'expense'].includes(type)) {
        return 'Type must be income or expense.';
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return 'Amount must be greater than 0.';
    }

    if (Number(amount) > 1000000000) {
        return 'Amount is too large.';
    }

    if (type === 'expense' && !CATEGORIES.includes(category)) {
        return 'Select a valid category.';
    }

    if (
        date &&
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return 'Enter a valid date.';
    }

    return null;
}

// Get all transactions
app.get('/api/transactions', (req, res) => {
    res.json(load().transactions);
});

// Add transaction
app.post('/api/transactions', (req, res) => {
    const error = validateTransaction(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    const data = load();

    const item = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        type: req.body.type,
        amount: Number(req.body.amount),
        category: req.body.type === 'income'
            ? 'Income' : req.body.category,
        description: String(req.body.description || '').trim().slice(0, 150),
        date: req.body.date || new Date().toISOString().slice(0, 10)
    };

    data.transactions.push(item);
    save(data);

    res.status(201).json(item);
});

// Edit transaction
app.put('/api/transactions/:id', (req, res) => {
    const error = validateTransaction(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    const data = load();

    const index = data.transactions.findIndex(
        t => t.id === Number(req.params.id)
    );

    if (index === -1) {
        return res.status(404).json({
            message: 'Transaction not found.'
        });
    }

    data.transactions[index] = {
        ...data.transactions[index],
        type: req.body.type,
        amount: Number(req.body.amount),
        category: req.body.type === 'income'
            ? 'Income' : req.body.category,
        description: String(req.body.description || '').trim().slice(0, 150),
        date: req.body.date
    };

    save(data);
    res.json(data.transactions[index]);
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
    const data = load();
    const oldLength = data.transactions.length;

    data.transactions = data.transactions.filter(
        t => t.id !== Number(req.params.id)
    );

    if (oldLength === data.transactions.length) {
        return res.status(404).json({
            message: 'Transaction not found.'
        });
    }

    save(data);
    res.json({ message: 'Transaction deleted successfully.' });
});

// Get budget
app.get('/api/budget', (req, res) => {
    res.json({ limit: load().budget });
});

// Update budget
app.put('/api/budget', (req, res) => {
    const limit = Number(req.body.limit);

    if (!Number.isFinite(limit) || limit <= 0 || limit > 1000000000) {
        return res.status(400).json({
            message: 'Enter a valid budget greater than 0.'
        });
    }

    const data = load();
    data.budget = limit;

    save(data);

    res.json({ limit: data.budget });
});

// Handle server errors
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        message: 'Something went wrong. Please try again.'
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
