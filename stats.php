<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'db_connect.php';

// Fetch basic KPIs
$stats = [];

try {
    // Total Users
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $stats['Total Users'] = $stmt->fetchColumn();

    // Total Workspaces
    $stmt = $pdo->query("SELECT COUNT(*) FROM workspaces");
    $stats['Total Workspaces'] = $stmt->fetchColumn();

    // Total Events
    $stmt = $pdo->query("SELECT COUNT(*) FROM events");
    $stats['Total Events'] = $stmt->fetchColumn();

    // Total Event Items
    $stmt = $pdo->query("SELECT COUNT(*) FROM event_items");
    $stats['Total Event Items'] = $stmt->fetchColumn();

} catch (Exception $e) {
    die("Error fetching stats: " . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Hat - System Stats</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="index.css">
    <style>
        body {
            background-color: var(--color-cloud);
            padding: 40px;
            margin: 0;
            min-height: 100vh;
        }

        .stats-container {
            background: white;
            padding: 40px;
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-soft);
            max-width: 600px;
            width: 100%;
            margin: 0 auto;
        }

        .stats-header {
            color: var(--color-sea-dark);
            margin-bottom: 30px;
            text-align: center;
            font-size: 2rem;
            font-weight: 800;
        }

        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .stat-card {
            background: var(--color-cloud);
            padding: 20px;
            border-radius: var(--radius-lg);
            text-align: center;
            border: 1px solid var(--color-border-subtle);
        }

        .stat-value {
            font-size: 3rem;
            font-weight: 800;
            color: var(--color-sea);
            margin-bottom: 5px;
        }

        .stat-label {
            color: var(--color-text);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.9rem;
            letter-spacing: 1px;
        }
    </style>
</head>

<body>

    <div class="stats-container">
        <h1 class="stats-header">System Statistics</h1>

        <div class="stat-grid">
            <?php foreach ($stats as $label => $value): ?>
                <div class="stat-card">
                    <div class="stat-value"><?= number_format($value) ?></div>
                    <div class="stat-label"><?= htmlspecialchars($label) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

</body>

</html>