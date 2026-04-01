<?php
require_once 'db_connect.php';

$event_id = $_GET['event_id'] ?? 0;

if (!$event_id)
    die("No event specified");

// Fetch event
$stmt = $pdo->prepare("SELECT * FROM events WHERE id = ?");
$stmt->execute([$event_id]);
$event = $stmt->fetch();

if (!$event)
    die("Event not found");

// Fetch items with dates
$stmt = $pdo->prepare("SELECT * FROM event_items WHERE event_id = ? AND item_date IS NOT NULL");
$stmt->execute([$event_id]);
$items = $stmt->fetchAll();

// ICS content
$ics = "BEGIN:VCALENDAR\r\n";
$ics .= "VERSION:2.0\r\n";
$ics .= "PRODID:-//Practica//Event Management//EN\r\n";
$ics .= "CALSCALE:GREGORIAN\r\n";

// Event Main Entry
if ($event['start_date']) {
    $hasTime = !empty($event['start_time']);
    $start = $hasTime ? date('Ymd\THis', strtotime($event['start_date'] . ' ' . $event['start_time'])) : date('Ymd', strtotime($event['start_date']));
    
    if ($event['end_date'] || $event['end_time']) {
        $end = date('Ymd\THis', strtotime(($event['end_date'] ?: $event['start_date']) . ' ' . ($event['end_time'] ?: '23:59:59')));
    } else {
        $end = date('Ymd', strtotime($event['start_date'] . ' +1 day'));
    }

    $ics .= "BEGIN:VEVENT\r\n";
    if ($hasTime) {
        $ics .= "DTSTART:$start\r\n";
        $ics .= "DTEND:$end\r\n";
    } else {
        $ics .= "DTSTART;VALUE=DATE:$start\r\n";
        $ics .= "DTEND;VALUE=DATE:$end\r\n";
    }
    $ics .= "SUMMARY:" . escapeIcs($event['title']) . "\r\n";
    if ($event['location'])
        $ics .= "LOCATION:" . escapeIcs($event['location']) . "\r\n";
    $ics .= "END:VEVENT\r\n";
}

// Items
foreach ($items as $item) {
    if (!$item['item_date'])
        continue;

    $hasTime = !empty($item['start_time']);
    $start = $hasTime ? date('Ymd\THis', strtotime($item['item_date'] . ' ' . $item['start_time'])) : date('Ymd', strtotime($item['item_date']));
    
    if ($item['end_date'] || $item['end_time']) {
        $end = date('Ymd\THis', strtotime(($item['end_date'] ?: $item['item_date']) . ' ' . ($item['end_time'] ?: '23:59:59')));
    } else {
        $end = date('Ymd', strtotime($item['item_date'] . ' +1 day'));
    }

    $ics .= "BEGIN:VEVENT\r\n";
    if ($hasTime) {
        $ics .= "DTSTART:$start\r\n";
        $ics .= "DTEND:$end\r\n";
    } else {
        $ics .= "DTSTART;VALUE=DATE:$start\r\n";
        $ics .= "DTEND;VALUE=DATE:$end\r\n";
    }
    $ics .= "SUMMARY:" . escapeIcs($item['title']) . "\r\n";
    $desc = strip_tags($item['subtitle']);
    if ($desc)
        $ics .= "DESCRIPTION:" . escapeIcs($desc) . "\r\n";
    $ics .= "END:VEVENT\r\n";
}

$ics .= "END:VCALENDAR\r\n";

// Output
header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="' . safeFilename($event['title']) . '.ics"');
echo $ics;

// Helpers
function escapeIcs($str)
{
    $str = str_replace('\\', '\\\\', $str);
    $str = str_replace(';', '\;', $str);
    $str = str_replace(',', '\,', $str);
    $str = str_replace("\n", '\\n', $str);
    return $str;
}

function safeFilename($str)
{
    return preg_replace('/[^a-z0-9]+/', '-', strtolower($str));
}
?>