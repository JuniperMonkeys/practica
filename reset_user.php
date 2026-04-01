<?php
/**
 * Practica Emergency Rescue Script
 * Use this ONLY if you are locked out of your admin account.
 * 
 * Usage: 
 * 1. Upload this file to your server.
 * 2. Visit: reset_user.php?username=YOUR_USERNAME&password=NEW_PASSWORD
 * 3. DELETE THIS FILE IMMEDIATELY AFTER USE.
 */

require_once 'db_connect.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

if (!$username || !$password) {
    die("<h1>Practica Rescue Tool</h1><p>Usage: <code>reset_user.php?username=XXX&password=YYY</code></p><p style='color: red;'><strong>WARNING: Delete this file as soon as you are done!</strong></p>");
}

try {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE username = ?");
    $stmt->execute([$hash, $username]);

    if ($stmt->rowCount() > 0) {
        echo "<h1>Success!</h1><p>Password for <strong>$username</strong> has been reset.</p><p>You can now log in with your new password.</p><p style='color: red;'><strong>DELETE THIS FILE NOW!</strong></p>";
    } else {
        echo "<h1>User Not Found</h1><p>Could not find a user with username '$username'.</p>";
    }
} catch (PDOException $e) {
    die("Error: " . $e->getMessage());
}
