<?php
require_once 'db_connect.php';

$token = $_GET['token'] ?? '';
if (!$token) {
    die("Invalid sharing link.");
}

// Fetch event details
$stmt = $pdo->prepare("SELECT * FROM events WHERE share_token = ? AND is_public = 1");
$stmt->execute([$token]);
$event = $stmt->fetch();

if (!$event) {
    die("This event is not shared or the link has expired.");
}

// Fetch items
$stmt = $pdo->prepare("SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order ASC, item_date ASC, created_at ASC");
$stmt->execute([$event['id']]);
$items = $stmt->fetchAll();

// Fetch assignments
$item_ids = array_column($items, 'id');
$assignments = [];
if (!empty($item_ids)) {
    $item_in = str_repeat('?,', count($item_ids) - 1) . '?';
    $stmt = $pdo->prepare("SELECT ia.*, u.username, u.first_name, u.last_name FROM item_assignments ia JOIN users u ON ia.user_id = u.id WHERE ia.item_id IN ($item_in)");
    $stmt->execute($item_ids);
    $assignments = $stmt->fetchAll();
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($event['title']); ?> - Practica</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="index.css">
    <style>
        body {
            background: linear-gradient(135deg, var(--color-bg-sky) 0%, var(--color-bg-sand) 100%);
            min-height: 100vh;
        }

        .share-container {
            max-width: 600px;
            margin: 20px auto;
            padding: 15px;
        }

        .share-header {
            position: relative;
            text-align: center;
            margin-bottom: 30px;
            background: var(--color-card-bg);
            padding: 40px 20px;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-md);
            border: 1px solid var(--color-border-subtle);
        }

        .share-event-title {
            margin: 0 0 12px;
            font-size: 2.2rem;
            color: var(--color-sea-blue);
            font-weight: 800;
            line-height: 1.2;
        }

        .share-event-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
            color: var(--color-text-light);
            font-size: 1rem;
            font-weight: 500;
        }

        .share-event-meta span {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .share-event-meta i {
            color: var(--color-sea-blue);
            font-size: 1.1rem;
        }

        .share-branding-tag {
            position: absolute;
            bottom: 12px;
            right: 18px;
            display: flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--color-text-light);
            opacity: 0.5;
            transition: opacity 0.2s;
        }

        .share-branding-tag:hover {
            opacity: 1;
            color: var(--color-sea-blue);
        }

        .share-branding-tag .logo-heart {
            font-size: 0.9rem;
        }

        .item-card {
            background: var(--color-card-bg);
            border-radius: var(--radius-md);
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: var(--shadow-soft);
            border-left: 4px solid var(--color-sea);
            transition: box-shadow 0.2s;
        }

        .item-card:hover {
            box-shadow: var(--shadow-md);
        }

        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }

        .item-title {
            font-weight: 600;
            font-size: 1.05rem;
            color: var(--color-text-dark);
        }

        .item-date {
            font-size: 0.8rem;
            color: var(--color-text-light);
            background: var(--color-bg-sand);
            padding: 2px 8px;
            border-radius: 12px;
        }

        .item-subtitle {
            font-size: 0.85rem;
            color: var(--color-text-light);
            margin-bottom: 6px;
            font-style: italic;
        }

        .item-details {
            font-size: 0.9rem;
            line-height: 1.4;
            color: var(--color-text-dark);
            white-space: pre-wrap;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dotted var(--color-border-subtle);
        }

        .footer-credit {
            text-align: center;
            margin-top: 30px;
            font-size: 0.8rem;
            color: var(--color-text-light);
        }

        .divider {
            margin: 24px 0;
            display: flex;
            align-items: center;
            text-align: center;
            gap: 15px;
        }

        .divider::before,
        .divider::after {
            content: "";
            flex: 1;
            height: 1px;
            background: var(--color-border-subtle);
        }

        .divider span {
            color: var(--color-sea-dark);
            font-weight: 700;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            white-space: nowrap;
            background: none;
            padding: 0;
        }

        .item-card.is-done {
            opacity: 0.6;
            border-left-color: var(--color-text-light);
        }

        .item-card.is-done .item-title {
            text-decoration: line-through;
            color: var(--color-text-light);
        }
    </style>
</head>

<body>
    <div class="share-container">
        <div class="share-header">
            <h1 class="share-event-title"><?php echo htmlspecialchars($event['title']); ?></h1>

            <div class="share-event-meta">
                <?php if ($event['location']): ?>
                    <span>
                        <i class="fa-solid fa-location-dot"></i>
                        <?php echo htmlspecialchars($event['location']); ?>
                    </span>
                <?php endif; ?>

                <?php if ($event['start_date']): ?>
                    <span>
                        <i class="fa-regular fa-calendar"></i>
                        <?php
                        echo date('M j, Y', strtotime($event['start_date']));
                        if ($event['start_time'])
                            echo ' ' . date('g:ia', strtotime($event['start_time']));

                        if ($event['end_date'] || $event['end_time']) {
                            echo ' — ';
                            if ($event['end_date'] && $event['end_date'] != $event['start_date'])
                                echo date('M j, Y ', strtotime($event['end_date']));
                            if ($event['end_time'])
                                echo date('g:ia', strtotime($event['end_time']));
                        }
                        ?>
                    </span>
                <?php endif; ?>
            </div>

            <a href="index.php" class="share-branding-tag">
                <span class="logo-heart">💙</span>
                <span>Practica</span>
            </a>
        </div>

        <div class="items-list">
            <?php foreach ($items as $item): ?>
                <?php if ($item['is_divider']): ?>
                    <div class="divider">
                        <span><?php echo htmlspecialchars($item['title']); ?></span>
                    </div>
                <?php else: ?>
                    <div class="item-card <?php echo $item['is_done'] ? 'is-done' : ''; ?>">
                        <div class="item-header">
                            <div class="item-title">
                                <?php if ($item['is_done']): ?><i class="fa-solid fa-circle-check"
                                        style="color: var(--color-sea-dark); margin-right: 4px;"></i><?php endif; ?>
                                <?php if ($item['is_flagged']): ?><i class="fa-solid fa-star"
                                        style="color: var(--color-accent);"></i> <?php endif; ?>
                                <?php echo htmlspecialchars($item['title']); ?>
                            </div>
                            <?php if ($item['item_date']): ?>
                                <div class="item-date">
                                    <?php
                                    echo date('M j', strtotime($item['item_date']));
                                    if ($item['start_time'])
                                        echo ' ' . date('g:ia', strtotime($item['start_time']));
                                    ?>
                                    <?php if ($item['end_date'] || $item['end_time']): ?>
                                        -
                                        <?php
                                        if ($item['end_date'] && $item['end_date'] != $item['item_date'])
                                            echo date('M j ', strtotime($item['end_date']));
                                        if ($item['end_time'])
                                            echo date('g:ia', strtotime($item['end_time']));
                                        ?>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>

                        <?php
                        $item_assigns = array_filter($assignments, function ($a) use ($item) {
                            return $a['item_id'] == $item['id']; });
                        if (!empty($item_assigns)): ?>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;">
                                <?php foreach ($item_assigns as $assign):
                                    $displayName = ($assign['first_name'] && $assign['last_name']) ? htmlspecialchars($assign['first_name'] . ' ' . $assign['last_name']) : htmlspecialchars($assign['username']);
                                    ?>
                                    <div
                                        style="display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 2px 10px 2px 4px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 0.75rem; color: var(--color-sea-blue); font-weight: 500;">
                                        <div
                                            style="width: 14px; height: 14px; background: var(--color-sea-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.5rem;">
                                            <i class="fa-solid fa-user"></i>
                                        </div>
                                        <?php echo $displayName; ?>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>

                        <?php if ($item['link_url']): ?>
                            <div style="margin-top: 4px;">
                                <a href="<?php echo htmlspecialchars($item['link_url']); ?>" target="_blank"
                                    style="font-size: 0.8rem; color: var(--color-sea-dark); text-decoration: none; font-weight: 500;">
                                    <i class="fa-solid fa-link"></i> View Link
                                </a>
                            </div>
                        <?php endif; ?>

                        <?php if ($item['subtitle']): ?>
                            <div class="item-details"><?php echo nl2br(htmlspecialchars($item['subtitle'])); ?></div>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
            <?php endforeach; ?>
        </div>

        <div class="footer-credit">
            Shared from <strong><a href="index.php" style="color: inherit; text-decoration: none;">Practica</a></strong>
            - Shared event management for UC Davis.
        </div>
    </div>
</body>

</html>