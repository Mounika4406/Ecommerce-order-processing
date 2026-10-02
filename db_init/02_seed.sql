-- Database Seed Data: 2 Users and 5 Products (including one with 0 stock)

INSERT INTO users (id, name, email) VALUES
    (1, 'Test User', 'testuser@example.com'),
    (2, 'Second User', 'seconduser@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, price, stock) VALUES
    (1, 'Wireless Noise-Canceling Headphones', 199.99, 100),
    (2, 'Mechanical Gaming Keyboard', 89.50, 50),
    (3, 'Ergonomic Wireless Mouse', 35.00, 75),
    (4, 'Ultra-Clear 4K Monitor', 349.99, 20),
    (5, 'Limited Edition Collector Figurine', 49.99, 0)
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
