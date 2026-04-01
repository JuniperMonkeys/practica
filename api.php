<?php

header('Content-Type: application/json');
// Extend session lifetime to 30 days (2592000 seconds)
ini_set('session.gc_maxlifetime', 2592000);
session_set_cookie_params(2592000);
session_start();

require_once 'db_connect.php';

// Helper to send JSON response
function jsonResponse($data, $status = 200)
{
	http_response_code($status);
	echo json_encode($data);
	exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

// Auth Check Helper
function requireAuth()
{
	if (!isset($_SESSION['user_id'])) {
		jsonResponse(['error' => 'Unauthorized'], 401);
	}
}

// Activity Log Helper
function logActivity($workspace_id, $action, $target_name)
{
	global $pdo;
	if (!$workspace_id || !isset($_SESSION['user_id']))
		return;
	try {
		$stmt = $pdo->prepare("INSERT INTO activity_log (workspace_id, user_id, action, target_name) VALUES (?, ?, ?, ?)");
		$stmt->execute([$workspace_id, $_SESSION['user_id'], $action, $target_name]);
	} catch (Exception $e) {
	}
}

// Touch Workspace Helper: Manually update workspace timestamp
function touchWorkspace($workspace_id)
{
	global $pdo;
	if (!$workspace_id)
		return;
	try {
		$stmt = $pdo->prepare("UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = ?");
		$stmt->execute([$workspace_id]);
	} catch (Exception $e) {
	}
}

function getWorkspaceIdForStatus($category_id)
{
	global $pdo;
	$stmt = $pdo->prepare("SELECT workspace_id FROM categories WHERE id = ?");
	$stmt->execute([$category_id]);
	return $stmt->fetchColumn();
}

function getWorkspaceIdForEvent($event_id)
{
	global $pdo;
	$stmt = $pdo->prepare("SELECT c.workspace_id FROM events t JOIN categories c ON t.event_category_id = c.id WHERE t.id = ?");
	$stmt->execute([$event_id]);
	return $stmt->fetchColumn();
}

function getWorkspaceIdForItem($item_id)
{
	global $pdo;
	$stmt = $pdo->prepare("SELECT c.workspace_id FROM event_items ti JOIN events t ON ti.event_id = t.id JOIN categories c ON t.event_category_id = c.id WHERE ti.id = ?");
	$stmt->execute([$item_id]);
	return $stmt->fetchColumn();
}

try {
	// This switch is where every request from the frontend gets processed.
	// We handle everything from the initial handshake (auth) to the deep data dives.
	switch ($action) {
		case 'register':
			// Welcoming a new member to the crew! 
			if (isset($_SESSION['user_id'])) {
				jsonResponse(['error' => 'Already logged in'], 400);
			}
			$username = trim($input['username'] ?? '');
			$password = $input['password'] ?? '';
			$first_name = trim($input['first_name'] ?? '');
			$last_name = trim($input['last_name'] ?? '');

			if (empty($username) || empty($password)) {
				jsonResponse(['error' => 'Username and password required'], 400);
			}

			// Scouting the horizon to see if this username is already taken.
			$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
			$stmt->execute([$username]);
			if ($stmt->fetch()) {
				jsonResponse(['error' => 'Username already taken'], 409);
			}

			// Create user
			$hash = password_hash($password, PASSWORD_DEFAULT);
			$stmt = $pdo->prepare("INSERT INTO users (username, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)");
			$stmt->execute([$username, $hash, $first_name, $last_name]);

			$_SESSION['user_id'] = $pdo->lastInsertId();
			$_SESSION['username'] = $username;
			$_SESSION['first_name'] = $first_name;
			$_SESSION['last_name'] = $last_name;

			jsonResponse([
				'success' => true,
				'user' => [
					'id' => $_SESSION['user_id'],
					'username' => $username,
					'first_name' => $first_name,
					'last_name' => $last_name
				]
			]);
			break;



		case 'cas_sim':
			// CAS Sim
			// This is the "cargo cult CAS" stuff
			// It simulates a "Lookup or Create" logic after a notionally-successful CAS handshake.
			$username = trim($input['username'] ?? 'woangel'); // Default to target user for testing

			if (empty($username)) {
				jsonResponse(['error' => 'No CAS username provided'], 400);
			}

			// 1. Look for an existing user record.
			$stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
			$stmt->execute([$username]);
			$user = $stmt->fetch();

			if (!$user) {
				// 2. JIT Provisioning: If they don't exist, create them.
				// We skip the password_hash since CAS is our source of truth.
				$stmt = $pdo->prepare("INSERT INTO users (username, first_name, last_name, password_hash) VALUES (?, ?, ?, ?)");
				$stmt->execute([$username, "CAS", "User", "SSO_MANAGED"]);
				$user_id = $pdo->lastInsertId();

				$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
				$stmt->execute([$user_id]);
				$user = $stmt->fetch();
			}

			// 3. Welcome aboard!
			$_SESSION['user_id'] = $user['id'];
			$_SESSION['username'] = $user['username'];
			jsonResponse([
				'success' => true,
				'user' => [
					'id' => $user['id'],
					'username' => $user['username'],
					'first_name' => $user['first_name'],
					'last_name' => $user['last_name']
				]
			]);
			break;

		case 'login':
			// Local Login
			// Traditional password-based entry for admin or non-campus collaborators.
			$username = trim($input['username'] ?? '');
			$password = $input['password'] ?? '';

			$stmt = $pdo->prepare("SELECT id, username, first_name, last_name, password_hash FROM users WHERE username = ?");
			$stmt->execute([$username]);
			$user = $stmt->fetch();

			if ($user && password_verify($password, $user['password_hash'])) {
				$_SESSION['user_id'] = $user['id'];
				$_SESSION['username'] = $user['username'];
				$_SESSION['first_name'] = $user['first_name'];
				$_SESSION['last_name'] = $user['last_name'];
				jsonResponse([
					'success' => true,
					'user' => [
						'id' => $user['id'],
						'username' => $user['username'],
						'first_name' => $user['first_name'],
						'last_name' => $user['last_name']
					]
				]);
			} else {
				jsonResponse(['error' => 'Invalid credentials'], 401);
			}
			break;

		case 'logout':
			session_destroy();
			jsonResponse(['success' => true]);
			break;

		case 'check_updates':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$last_updated = $input['last_updated'] ?? '';

			if (!$workspace_id || !$last_updated) {
				jsonResponse(['has_updates' => false]);
			}

			$stmt = $pdo->prepare("SELECT updated_at FROM workspaces WHERE id = ?");
			$stmt->execute([$workspace_id]);
			$current_updated = $stmt->fetchColumn();

			// Compare timestamps (strings are fine for direct comparison if DB format is consistent)
			$has_updates = ($current_updated > $last_updated);
			jsonResponse([
				'has_updates' => $has_updates,
				'current_updated' => $current_updated
			]);
			break;

		case 'check_auth':
			if (isset($_SESSION['user_id'])) {
				jsonResponse([
					'authenticated' => true,
					'user' => [
						'id' => $_SESSION['user_id'],
						'username' => $_SESSION['username'],
						'first_name' => $_SESSION['first_name'] ?? '',
						'last_name' => $_SESSION['last_name'] ?? ''
					]
				]);
			} else {
				jsonResponse(['authenticated' => false]);
			}
			break;

		case 'get_workspaces':
			requireAuth();
			$user_id = $_SESSION['user_id'];

			$stmt = $pdo->prepare("
				SELECT w.*, wu.role 
				FROM workspaces w 
				JOIN workspace_users wu ON w.id = wu.workspace_id 
				WHERE wu.user_id = ? AND w.is_archived = 0
				ORDER BY w.created_at DESC
			");
			$stmt->execute([$user_id]);
			jsonResponse(['workspaces' => $stmt->fetchAll()]);
			break;

		case 'create_workspace':
			requireAuth();
			$user_id = $_SESSION['user_id'];
			$name = trim($input['name'] ?? '');

			if (empty($name))
				jsonResponse(['error' => 'Name required'], 400);

			$pdo->beginTransaction();
			try {
				$stmt = $pdo->prepare("INSERT INTO workspaces (owner_id, name) VALUES (?, ?)");
				$stmt->execute([$user_id, $name]);
				$workspace_id = $pdo->lastInsertId();

				$stmt = $pdo->prepare("INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, 'admin')");
				$stmt->execute([$workspace_id, $user_id]);

				$pdo->commit();
				jsonResponse(['success' => true, 'workspace' => ['id' => $workspace_id, 'name' => $name]]);
			} catch (Exception $e) {
				if ($pdo->inTransaction())
					$pdo->rollBack();
				jsonResponse(['error' => $e->getMessage()], 500);
			}
			break;

		case 'update_workspace':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$name = $input['name'] ?? null;
			$notes = $input['notes'] ?? null;

			// Verify ownership or access (for now just check if user is in workspace)
			// Ideally we check if they are admin/editor, but for this demo:
			$stmt = $pdo->prepare("SELECT role FROM workspace_users WHERE workspace_id = ? AND user_id = ?");
			$stmt->execute([$workspace_id, $_SESSION['user_id']]);
			if (!$stmt->fetch())
				jsonResponse(['error' => 'Access denied'], 403);

			$fields = [];
			$params = [];
			if ($name !== null) {
				$fields[] = "name=?";
				$params[] = $name;
			}
			if ($notes !== null) {
				$fields[] = "notes=?";
				$params[] = $notes;
			}

			if (!empty($fields)) {
				$params[] = $workspace_id;
				$stmt = $pdo->prepare("UPDATE workspaces SET " . implode(', ', $fields) . " WHERE id = ?");
				$stmt->execute($params);
			}
			jsonResponse(['success' => true]);
			break;

		case 'reorder_events':
			requireAuth();
			$category_id = $input['category_id'] ?? 0;
			$event_ids = $input['event_ids'] ?? [];

			if (empty($event_ids))
				jsonResponse(['success' => true]); // Nothing to do

			// Verify access (omitted for brevity, assume user has access to these events)

			$sql = "UPDATE events SET event_category_id = ?, sort_order = ? WHERE id = ?";
			$stmt = $pdo->prepare($sql);

			$pdo->beginTransaction();
			try {
				foreach ($event_ids as $index => $id) {
					$stmt->execute([$category_id, $index, $id]);
				}
				$pdo->commit();
				jsonResponse(['success' => true]);
			} catch (Exception $e) {
				if ($pdo->inTransaction())
					$pdo->rollBack();
				jsonResponse(['error' => 'Failed to reorder'], 500);
			}
			break;

		case 'reorder_categories':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$category_ids = $input['category_ids'] ?? [];

			if (empty($category_ids) || !$workspace_id)
				jsonResponse(['success' => true]); // Nothing to do

			$sql = "UPDATE categories SET sort_order = ? WHERE id = ? AND workspace_id = ?";
			$stmt = $pdo->prepare($sql);

			$pdo->beginTransaction();
			try {
				foreach ($category_ids as $index => $id) {
					$stmt->execute([$index, $id, $workspace_id]);
				}
				$pdo->commit();
				jsonResponse(['success' => true]);
			} catch (Exception $e) {
				if ($pdo->inTransaction())
					$pdo->rollBack();
				jsonResponse(['error' => 'Failed to reorder categories'], 500);
			}
			break;

		case 'toggle_sharing':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;
			$is_public = isset($input['is_public']) ? (int) $input['is_public'] : 0;

			// Generate token if enabling and none exists
			if ($is_public) {
				$stmt = $pdo->prepare("SELECT share_token FROM events WHERE id = ?");
				$stmt->execute([$event_id]);
				$token = $stmt->fetchColumn();

				if (!$token) {
					$token = bin2hex(random_bytes(16));
					$stmt = $pdo->prepare("UPDATE events SET share_token = ? WHERE id = ?");
					$stmt->execute([$token, $event_id]);
				}
			}

			$stmt = $pdo->prepare("UPDATE events SET is_public = ? WHERE id = ?");
			$stmt->execute([$is_public, $event_id]);

			touchWorkspace(getWorkspaceIdForEvent($event_id));

			jsonResponse(['success' => true]);
			break;

		case 'get_share_info':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;
			$stmt = $pdo->prepare("SELECT is_public, share_token FROM events WHERE id = ?");
			$stmt->execute([$event_id]);
			$info = $stmt->fetch();

			jsonResponse($info);
			break;

		case 'get_workspace_details':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			// Verify access
			// Add... Strict permission check (editor/viewer)

			// Get Categories
			$stmt = $pdo->prepare("SELECT * FROM categories WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC");
			$stmt->execute([$workspace_id]);
			$categories = $stmt->fetchAll();

			// Get Events
			$stmt = $pdo->prepare("
				SELECT t.* 
				FROM events t
				JOIN categories c ON t.event_category_id = c.id
				WHERE c.workspace_id = ?
				ORDER BY t.sort_order ASC, t.created_at DESC
			");
			$stmt->execute([$workspace_id]);
			$events = $stmt->fetchAll();

			// Get Event Items for Board Preview
			$event_ids = array_column($events, 'id');
			$event_items = [];
			$assignments = [];
			if (!empty($event_ids)) {
				$in = str_repeat('?,', count($event_ids) - 1) . '?';
				$stmt = $pdo->prepare("SELECT id, event_id, title, subtitle, is_flagged, is_done, link_url, item_date, start_time, end_date, end_time, is_divider, sort_order, updated_at FROM event_items WHERE event_id IN ($in) ORDER BY sort_order ASC, item_date ASC, created_at ASC");
				$stmt->execute($event_ids);
				$event_items = $stmt->fetchAll();

				// Get Assignments
				$item_ids = array_column($event_items, 'id');
				if (!empty($item_ids)) {
					$item_in = str_repeat('?,', count($item_ids) - 1) . '?';
					$stmt = $pdo->prepare("SELECT ia.*, u.username, u.first_name, u.last_name FROM item_assignments ia JOIN users u ON ia.user_id = u.id WHERE ia.item_id IN ($item_in)");
					$stmt->execute($item_ids);
					$assignments = $stmt->fetchAll();
				}
			}

			// Get Workspace Info (Name, Notes)
			$stmt = $pdo->prepare("SELECT id, name, notes, owner_id, updated_at FROM workspaces WHERE id = ?");
			$stmt->execute([$workspace_id]);
			$workspace = $stmt->fetch();

			// Get Members
			$stmt = $pdo->prepare("SELECT u.id, u.username, u.first_name, u.last_name, wu.role FROM workspace_users wu JOIN users u ON wu.user_id = u.id WHERE wu.workspace_id = ?");
			$stmt->execute([$workspace_id]);
			$members = $stmt->fetchAll();

			// Get Activity Log
			$stmt = $pdo->prepare("SELECT a.id, a.action, a.target_name, a.created_at, u.username FROM activity_log a JOIN users u ON a.user_id = u.id WHERE a.workspace_id = ? ORDER BY a.created_at DESC LIMIT 20");
			$stmt->execute([$workspace_id]);
			$activity_log = $stmt->fetchAll();

			jsonResponse([
				'workspace' => $workspace,
				'categories' => $categories,
				'events' => $events,
				'event_items' => $event_items,
				'assignments' => $assignments,
				'members' => $members,
				'activity_log' => $activity_log,
				'server_time' => date('Y-m-d H:i:s') // Useful for client-server sync
			]);
			break;

		case 'create_category':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$name = trim($input['name'] ?? '');

			if (empty($name))
				jsonResponse(['error' => 'Name required'], 400);

			$stmt = $pdo->prepare("INSERT INTO categories (workspace_id, name) VALUES (?, ?)");
			$stmt->execute([$workspace_id, $name]);

			touchWorkspace($workspace_id);

			jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
			break;

		case 'delete_category':
			requireAuth();
			$category_id = $input['id'] ?? 0;

			if (empty($category_id))
				jsonResponse(['error' => 'Category ID required'], 400);

			// Manual cascade
			// 1. Delete assignments for items in events in this category
			$pdo->prepare("DELETE FROM item_assignments WHERE item_id IN (
				SELECT id FROM event_items WHERE event_id IN (
					SELECT id FROM events WHERE event_category_id = ?
				)
			)")->execute([$category_id]);

			// 2. Delete items in events in this category
			$pdo->prepare("DELETE FROM event_items WHERE event_id IN (
				SELECT id FROM events WHERE event_category_id = ?
			)")->execute([$category_id]);

			// 3. Delete events in this category
			$pdo->prepare("DELETE FROM events WHERE event_category_id = ?")->execute([$category_id]);

			$workspace_id = getWorkspaceIdForStatus($category_id);
			// 4. Finally delete the category
			$stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
			$stmt->execute([$category_id]);

			touchWorkspace($workspace_id);

			jsonResponse(['success' => true]);
			break;

		case 'create_event':
			requireAuth();
			$category_id = $input['category_id'] ?? 0;
			$title = trim($input['title'] ?? '');

			if (empty($title))
				jsonResponse(['error' => 'Title required'], 400);

			$stmt = $pdo->prepare("INSERT INTO events (event_category_id, title) VALUES (?, ?)");
			$stmt->execute([$category_id, $title]);

			touchWorkspace(getWorkspaceIdForStatus($category_id));

			jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
			break;

		case 'get_event':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;

			$stmt = $pdo->prepare("SELECT * FROM events WHERE id = ?");
			$stmt->execute([$event_id]);
			$event = $stmt->fetch();

			if (!$event)
				jsonResponse(['error' => 'Event not found'], 404);

			$stmt = $pdo->prepare("SELECT id, event_id, title, subtitle, is_flagged, is_done, link_url, item_date, start_time, end_date, end_time, is_divider, sort_order FROM event_items WHERE event_id = ? ORDER BY sort_order ASC, item_date ASC, created_at ASC");
			$stmt->execute([$event_id]);
			$items = $stmt->fetchAll();

			// Get assignments for all items in the event. 
			// We want titles and names to show up together - no one likes mystery collaborators.
			$assignments = [];
			$item_ids = array_column($items, 'id');
			if (!empty($item_ids)) {
				$item_in = str_repeat('?,', count($item_ids) - 1) . '?';
				$stmt = $pdo->prepare("SELECT ia.*, u.username, u.first_name, u.last_name FROM item_assignments ia JOIN users u ON ia.user_id = u.id WHERE ia.item_id IN ($item_in)");
				$stmt->execute($item_ids);
				$assignments = $stmt->fetchAll();
			}

			jsonResponse(['event' => $event, 'items' => $items, 'assignments' => $assignments]);
			break;

		case 'admin_reset_password':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$target_user_id = $input['user_id'] ?? 0;

			// Verify current user is admin of this workspace
			$stmt = $pdo->prepare("SELECT role FROM workspace_users WHERE workspace_id = ? AND user_id = ?");
			$stmt->execute([$workspace_id, $_SESSION['user_id']]);
			$role = $stmt->fetchColumn();

			if ($role !== 'admin') {
				jsonResponse(['error' => 'Only admins can reset passwords'], 403);
			}

			// Generate random temporary password
			$temp_password = bin2hex(random_bytes(4)); // 8 chars
			$hash = password_hash($temp_password, PASSWORD_DEFAULT);

			$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
			$stmt->execute([$hash, $target_user_id]);

			jsonResponse(['success' => true, 'temp_password' => $temp_password]);
			break;

		case 'update_event':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;
			$title = $input['title'] ?? null;
			$location = $input['location'] ?? null;
			$start_date = $input['start_date'] ?? null;
			$end_date = $input['end_date'] ?? null;
			$show_details = $input['show_details'] ?? null;
			$expected_updated_at = $input['updated_at'] ?? null;

			// Optimistic Locking, or: verify the record hasn't changed since it was loaded
			if ($expected_updated_at) {
				$stmt = $pdo->prepare("SELECT updated_at FROM events WHERE id = ?");
				$stmt->execute([$event_id]);
				$current_updated = $stmt->fetchColumn();
				if ($current_updated > $expected_updated_at) {
					jsonResponse(['error' => 'Conflict detected: This event was modified by someone else.', 'code' => 409], 409);
				}
			}

			error_log("DEBUG update_event: " . print_r($input, true));

			// Simple dynamic update
			$fields = [];
			$params = [];
			if ($title !== null) {
				$fields[] = "title=?";
				$params[] = $title;
			}
			if ($location !== null) {
				$fields[] = "location=?";
				$params[] = $location;
			}
			if ($start_date !== null) {
				if ($start_date === '') {
					$start_date = null;
				} else {
					$ts = strtotime($start_date);
					$start_date = $ts ? date('Y-m-d', $ts) : null;
				}
				$fields[] = "start_date=?";
				$params[] = $start_date;
			}
			if (isset($input['start_time'])) {
				$fields[] = "start_time=?";
				$params[] = $input['start_time'] ?: null;
			}
			if ($end_date !== null) {
				if ($end_date === '') {
					$end_date = null;
				} else {
					$ts = strtotime($end_date);
					$end_date = $ts ? date('Y-m-d', $ts) : null;
				}
				$fields[] = "end_date=?";
				$params[] = $end_date;
			}
			if (isset($input['end_time'])) {
				$fields[] = "end_time=?";
				$params[] = $input['end_time'] ?: null;
			}
			if ($show_details !== null) {
				$fields[] = "show_details=?";
				$params[] = $show_details;
			}
			if ($board_items_limit !== null) {
				$fields[] = "board_items_limit=?";
				$params[] = (int) $board_items_limit;
			}

			if (empty($fields))
				jsonResponse(['success' => true]); // Nothing to update

			$params[] = $event_id;

			try {
				$stmt = $pdo->prepare("UPDATE events SET " . implode(', ', $fields) . " WHERE id = ?");
				$stmt->execute($params);

				// Manually touch the workspace to notify other pollers
				$workspace_id = getWorkspaceIdForEvent($event_id);
				touchWorkspace($workspace_id);

				jsonResponse(['success' => true]);
			} catch (Exception $e) {
				jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
			}
			break;

		case 'add_item':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;
			$title = trim($input['title'] ?? '');
			$subtitle = $input['subtitle'] ?? '';
			$item_date = $input['item_date'] ?? null;
			$start_time = $input['start_time'] ?? null;
			$end_date = $input['end_date'] ?? null;
			$end_time = $input['end_time'] ?? null;
			$link_url = $input['link_url'] ?? null;
			$is_divider = isset($input['is_divider']) ? (int) $input['is_divider'] : 0;

			$stmt = $pdo->prepare("INSERT INTO event_items (event_id, title, subtitle, item_date, start_time, end_date, end_time, link_url, is_divider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
			$stmt->execute([$event_id, $title, $subtitle, $item_date ?: null, $start_time ?: null, $end_date ?: null, $end_time ?: null, $link_url ?: null, $is_divider]);

			$workspace_id = getWorkspaceIdForEvent($event_id);
			logActivity($workspace_id, 'added item', $title);

			jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
			break;

		case 'delete_event':
			requireAuth();
			$event_id = $input['event_id'] ?? 0;

			if (empty($event_id))
				jsonResponse(['error' => 'Event ID required'], 400);

			$workspace_id = getWorkspaceIdForEvent($event_id);
			$stmt = $pdo->prepare("SELECT title FROM events WHERE id = ?");
			$stmt->execute([$event_id]);
			$title = $stmt->fetchColumn();

			$pdo->beginTransaction();
			try {
				// 1. Delete assignments for all items in this event
				$pdo->prepare("DELETE FROM item_assignments WHERE item_id IN (SELECT id FROM event_items WHERE event_id = ?)")->execute([$event_id]);

				// 2. Delete all items in this event
				$pdo->prepare("DELETE FROM event_items WHERE event_id = ?")->execute([$event_id]);

				// 3. Delete the event itself
				$pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$event_id]);

				$pdo->commit();
				touchWorkspace($workspace_id);
				logActivity($workspace_id, 'deleted event', $title ?: 'Unknown Event');
				jsonResponse(['success' => true]);
			} catch (Exception $e) {
				if ($pdo->inTransaction())
					$pdo->rollBack();
				jsonResponse(['error' => 'Failed to delete event', 'details' => $e->getMessage()], 500);
			}
			break;

		case 'update_item':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;
			$title = trim($input['title'] ?? '');
			$subtitle = $input['subtitle'] ?? '';
			$item_date = $input['item_date'] ?? null;
			$start_time = $input['start_time'] ?? null;
			$end_date = $input['end_date'] ?? null;
			$end_time = $input['end_time'] ?? null;
			$link_url = $input['link_url'] ?? null;
			$is_divider = isset($input['is_divider']) ? (int) $input['is_divider'] : 0;

			$expected_updated_at = $input['updated_at'] ?? null;

			if (empty($title))
				jsonResponse(['error' => 'Title required'], 400);

			// OPTIMISTIC LOCKING
			if ($expected_updated_at) {
				$stmt = $pdo->prepare("SELECT updated_at FROM event_items WHERE id = ?");
				$stmt->execute([$item_id]);
				$current_updated = $stmt->fetchColumn();
				if ($current_updated > $expected_updated_at) {
					jsonResponse(['error' => 'Conflict detected: This item was modified by someone else.', 'code' => 409], 409);
				}
			}

			$stmt = $pdo->prepare("UPDATE event_items SET title=?, subtitle=?, item_date=?, start_time=?, end_date=?, end_time=?, link_url=?, is_divider=? WHERE id=?");
			$stmt->execute([$title, $subtitle, $item_date ?: null, $start_time ?: null, $end_date ?: null, $end_time ?: null, $link_url ?: null, $is_divider, $item_id]);

			$workspace_id = getWorkspaceIdForItem($item_id);
			touchWorkspace($workspace_id);
			logActivity($workspace_id, 'updated item', $title);

			jsonResponse(['success' => true]);
			break;

		case 'delete_item':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;

			$workspace_id = getWorkspaceIdForItem($item_id);
			$title = $pdo->query("SELECT title FROM event_items WHERE id = " . (int) $item_id)->fetchColumn();

			$stmt = $pdo->prepare("DELETE FROM event_items WHERE id = ?");
			$stmt->execute([$item_id]);

			touchWorkspace($workspace_id);
			logActivity($workspace_id, 'deleted item', $title ?: 'Unknown Item');

			jsonResponse(['success' => true]);
			break;

		case 'reorder_items':
			requireAuth();
			$item_ids = $input['item_ids'] ?? [];
			if (!is_array($item_ids)) {
				jsonResponse(['error' => 'Invalid array of item IDs'], 400);
			}
			$pdo->beginTransaction();
			try {
				$stmt = $pdo->prepare("UPDATE event_items SET sort_order = ? WHERE id = ?");
				$workspace_id = null;
				foreach ($item_ids as $index => $id) {
					if (!$workspace_id)
						$workspace_id = getWorkspaceIdForItem($id);
					$stmt->execute([$index + 1, (int) $id]);
				}
				$pdo->commit();
				if ($workspace_id)
					touchWorkspace($workspace_id);
				jsonResponse(['success' => true]);
			} catch (Exception $e) {
				if ($pdo->inTransaction())
					$pdo->rollBack();
				jsonResponse(['error' => 'Failed to reorder items', 'details' => $e->getMessage()], 500);
			}
			break;

		case 'toggle_flag':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;

			$workspace_id = getWorkspaceIdForItem($item_id);
			$item = $pdo->query("SELECT title, is_flagged FROM event_items WHERE id = " . (int) $item_id)->fetch();
			$action = $item['is_flagged'] ? 'un-flagged item' : 'flagged item';

			$stmt = $pdo->prepare("UPDATE event_items SET is_flagged = NOT is_flagged WHERE id = ?");
			$stmt->execute([$item_id]);

			touchWorkspace($workspace_id);
			logActivity($workspace_id, $action, $item['title']);

			jsonResponse(['success' => true]);
			break;

		case 'toggle_done':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;

			$workspace_id = getWorkspaceIdForItem($item_id);
			$item = $pdo->query("SELECT title, is_done FROM event_items WHERE id = " . (int) $item_id)->fetch();
			$action = $item['is_done'] ? 'un-checked item' : 'checked off item';

			$stmt = $pdo->prepare("UPDATE event_items SET is_done = NOT is_done WHERE id = ?");
			$stmt->execute([$item_id]);

			touchWorkspace($workspace_id);
			logActivity($workspace_id, $action, $item['title']);

			jsonResponse(['success' => true]);
			break;

		case 'add_workspace_user':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$username = trim($input['username'] ?? '');
			$role = $input['role'] ?? 'editor'; // Allow setting role initially

			// Find user
			$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
			$stmt->execute([$username]);
			$user_to_add = $stmt->fetch();

			if (!$user_to_add)
				jsonResponse(['error' => 'User not found'], 404);

			// Add to workspace
			try {
				$stmt = $pdo->prepare("INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)");
				$stmt->execute([$workspace_id, $user_to_add['id'], $role]);
				jsonResponse(['success' => true]);
			} catch (PDOException $e) {
				if ($e->getCode() == 23000) { // Duplicate entry
					jsonResponse(['error' => 'User already in workspace'], 409);
				}
				throw $e;
			}
			break;

		case 'update_workspace_user_role':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$user_id = $input['user_id'] ?? 0;
			$role = $input['role'] ?? 'editor';

			if (!in_array($role, ['admin', 'editor', 'viewer'])) {
				jsonResponse(['error' => 'Invalid role'], 400);
			}

			// Verify the requester is an admin in this workspace
			$stmt = $pdo->prepare("SELECT role FROM workspace_users WHERE workspace_id = ? AND user_id = ?");
			$stmt->execute([$workspace_id, $_SESSION['user_id']]);
			$requester_role = $stmt->fetchColumn();

			if ($requester_role !== 'admin') {
				jsonResponse(['error' => 'Only admins can update roles'], 403);
			}

			$stmt = $pdo->prepare("UPDATE workspace_users SET role = ? WHERE workspace_id = ? AND user_id = ?");
			$stmt->execute([$role, $workspace_id, $user_id]);

			jsonResponse(['success' => true]);
			break;

		case 'search_users':
			requireAuth();
			$query = trim($input['query'] ?? '');
			if (strlen($query) < 2) {
				jsonResponse(['users' => []]);
			}

			$q = "%{$query}%";
			$stmt = $pdo->prepare("SELECT id, username, first_name, last_name FROM users WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 10");
			$stmt->execute([$q, $q, $q]);
			jsonResponse(['users' => $stmt->fetchAll()]);
			break;

		case 'get_workspace_users':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;

			$stmt = $pdo->prepare("
				SELECT u.id, u.username, wu.role 
				FROM workspace_users wu
				JOIN users u ON wu.user_id = u.id
				WHERE wu.workspace_id = ?
				ORDER BY wu.role ASC, u.username ASC
			");
			$stmt->execute([$workspace_id]);
			jsonResponse(['users' => $stmt->fetchAll()]);
			break;

		case 'remove_workspace_user':
			requireAuth();
			$workspace_id = $input['workspace_id'] ?? 0;
			$user_id_to_remove = $input['user_id'] ?? 0;

			// Prevent removing the owner
			$stmt = $pdo->prepare("SELECT owner_id FROM workspaces WHERE id = ?");
			$stmt->execute([$workspace_id]);
			$workspace = $stmt->fetch();

			if ($workspace && $workspace['owner_id'] == $user_id_to_remove) {
				jsonResponse(['error' => 'Cannot remove the workspace owner'], 400);
			}

			$stmt = $pdo->prepare("DELETE FROM workspace_users WHERE workspace_id = ? AND user_id = ?");
			$stmt->execute([$workspace_id, $user_id_to_remove]);
			jsonResponse(['success' => true]);
			break;

		case 'assign_item':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;
			$user_id = $input['user_id'] ?? 0;

			if (!$item_id || !$user_id)
				jsonResponse(['error' => 'Missing itemId or userId'], 400);

			$stmt = $pdo->prepare("INSERT IGNORE INTO item_assignments (item_id, user_id) VALUES (?, ?)");
			$stmt->execute([$item_id, $user_id]);

			$workspace_id = getWorkspaceIdForItem($item_id);
			touchWorkspace($workspace_id);

			// Email Notification (Mocked for now)
			$workspace_id = getWorkspaceIdForItem($item_id);
			$stmt = $pdo->prepare("SELECT title FROM event_items WHERE id = ?");
			$stmt->execute([$item_id]);
			$item_title = $stmt->fetchColumn();

			$stmt = $pdo->prepare("SELECT email, username FROM users WHERE id = ?");
			$stmt->execute([$user_id]);
			$user = $stmt->fetch();

			if ($user && $user['email']) {
				$from = "Practica <practica@ucdavis.edu>";
				$to = $user['email'];
				$subject = "Task Assigned: $item_title";
				$message = "Hello {$user['username']},\n\nYou have been assigned to '{$item_title}' in Practica.\n\nView details: https://practica.ucdavis.edu/";
				// mail($to, $subject, $message, "From: $from");
				error_log("EMAIL TO {$to}: {$subject}");
			}

			logActivity($workspace_id, 'assigned item', ($item_title ?: 'Item') . " to {$user['username']}");

			jsonResponse(['success' => true]);
			break;

		case 'unassign_item':
			requireAuth();
			$item_id = $input['item_id'] ?? 0;
			$user_id = $input['user_id'] ?? 0;

			$stmt = $pdo->prepare("DELETE FROM item_assignments WHERE item_id = ? AND user_id = ?");
			$stmt->execute([$item_id, $user_id]);

			jsonResponse(['success' => true]);
			break;

		default:
			jsonResponse(['error' => 'Invalid action'], 400);
			break;
	}
} catch (Exception $e) {
	jsonResponse(['error' => $e->getMessage()], 500);
}