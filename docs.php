<?php
require_once 'db_connect.php';
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Practica Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="index.css">
    <style>
        body {
            background: var(--color-bg-sky);
            color: var(--color-text-dark);
            line-height: 1.6;
        }

        p {
            margin-top: 0;
            margin-bottom: 20px;
        }

        .docs-container {
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px 60px;
        }

        .docs-card {
            background: white;
            padding: 40px;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-md);
            border: 1px solid var(--color-border-subtle);
        }

        .docs-header {
            border-bottom: 2px solid var(--color-bg-sand);
            margin-bottom: 30px;
            padding-bottom: 20px;
        }

        .docs-header h1 {
            color: var(--color-sea-blue);
            margin: 0;
            font-size: 2.5rem;
            font-weight: 800;
        }

        .docs-section {
            margin-bottom: 40px;
        }

        .docs-section h2 {
            color: var(--color-sea-dark);
            border-left: 4px solid var(--color-sea);
            padding-left: 15px;
            margin-bottom: 20px;
            font-size: 1.8rem;
        }

        .docs-section h3 {
            color: var(--color-sea-blue);
            margin-top: 25px;
            font-size: 1.3rem;
        }

        .tech-note {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: var(--radius-md);
            margin: 20px 0;
            font-family: 'Inter', system-ui, sans-serif;
        }

        .tech-note h4 {
            margin-top: 0;
            color: #475569;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tech-note h4 i {
            color: var(--color-sea);
        }

        code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            color: #0f172a;
        }

        pre {
            background: #1e293b;
            color: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 0.85rem;
            margin: 15px 0;
        }



        ul {
            list-style: none;
            padding: 0;
            margin: 18px 0;
        }

        li {
            position: relative;
            padding-left: 30px;
            margin-bottom: 14px;
            color: #334155;
        }

        li::before {
            content: "\f058";
            /* circle-check */
            font-family: "Font Awesome 6 Free";
            font-weight: 900;
            position: absolute;
            left: 0;
            color: var(--color-sea);
            font-size: 1rem;
            line-height: 1.6;
        }

        .tech-note ul {
            margin: 10px 0;
        }

        .tech-note li {
            margin-bottom: 10px;
            font-size: 0.95rem;
        }

        .tech-note li::before {
            content: "\f105";
            /* angle-right */
            color: var(--color-sea-blue);
            font-size: 0.9rem;
        }

        li strong {
            color: var(--color-sea-dark);
            font-weight: 700;
        }

        header {
            background-color: var(--color-header-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 1000;
            border-bottom: 1px solid var(--color-border-subtle);
        }

        .header-inner {
            max-width: 900px;
            margin: 0 auto;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .back-nav-link {
            color: var(--color-sea-blue);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: color 0.15s;
        }

        .back-nav-link:hover {
            color: var(--color-sea-dark);
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .feature-item {
            padding: 15px;
            background: #fff;
            border: 1px solid var(--color-border-subtle);
            border-radius: var(--radius-md);
        }

        .feature-item i {
            color: var(--color-sea);
            font-size: 1.5rem;
            margin-bottom: 10px;
            display: block;
        }
    </style>
</head>

<body>
    <header>
        <div class="header-inner">
            <div class="logo logo-container" style="cursor: pointer;" onclick="window.location.href='index.php'">
                <div class="logo-box">
                    <span class="logo-heart">💙</span>
                </div>
                Practica <span style="margin-left: 8px; font-weight: 400; opacity: 0.6;">Docs</span>
            </div>
            <a href="index.php" class="back-nav-link"><i class="fa-solid fa-arrow-left"></i> Back to Practica</a>
        </div>
    </header>

    <div class="docs-container" style="margin-top: 20px;">
        <div class="docs-card">
            <!-- Documentation Content -->

            <section class="docs-section">
                <h2>Overview</h2>
                <p>
                    Practica is a streamlined workspace designed to replace spreadsheets and emails for managing
                    department events. It provides a visual "Command Center" for things happening in real life.
                </p>
                <p>
                    It is a modification of a website I'd built called <a href="https://cloudhat.org">Cloud Hat</a>,
                    which is a shared travel planner. Aside from branding/nomenclatural changes and such, Practica
                    amends the
                    available user info, allows users to be assigned to individual items, expands role permissioning,
                    and adds the ability to
                    set event and item times.
                </p>
                <p>
                    So, it's a modification of my existing tool. Cloud Hat was in turn inspired by kanban boards
                    generally, and Jira specifically; in principle, both Cloud Hat and Practica are supposed to answer
                    the question
                    "what if Jira was more accessible and geared toward real-life tasks and events".
                </p>
                <div class="feature-grid">
                    <div class="feature-item">
                        <i class="fa-solid fa-rectangle-list"></i>
                        <strong>Live Event Boards</strong>
                        <p style="font-size: 0.85rem; margin-top: 5px;">A single, unified view of all unit-wide events.
                        </p>
                    </div>
                    <div class="feature-item">
                        <i class="fa-solid fa-share-nodes"></i>
                        <strong>Instant Sharing</strong>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Generate public links to
                            share with guest speakers or faculty.</p>
                    </div>
                    <div class="feature-item">
                        <i class="fa-solid fa-file-pdf"></i>
                        <strong>Export Anywhere</strong>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Download event agendas as PDFs or sync them to
                            Outlook/Google with one-click ICS files.</p>
                    </div>
                    <div class="feature-item">
                        <i class="fa-solid fa-users"></i>
                        <strong>Team Assignments</strong>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Assign specific tasks to team members to ensure
                            clear ownership and accountability for every item.</p>
                    </div>
                </div>

                <h3>Key Benefits</h3>
                <ul>
                    <li><strong>Campus Branding:</strong> It looks like a UC Davis tool (hopefully), helping onboard
                        staff.</li>
                    <li><strong>Real-time Updates:</strong> Changes made by the event team reflect instantly for all
                        logged-in members.</li>
                    <li><strong>Mobile Optimized:</strong> Manage your event on the fly from a phone or tablet.</li>
                </ul>
            </section>

            <hr style="border: 0; border-top: 2px solid #f1f5f9; margin: 40px 0;">

            <section class="docs-section">
                <h2>Usage Guide</h2>
                <p>
                    Practica organizes information through a simple, four-tier hierarchy. This ensures that even the
                    most complex department schedules remain manageable and clean.
                </p>

                <div class="tech-note" style="border-left: 4px solid var(--color-sea-blue); background: #fdfdfd;">
                    <ul style="margin: 0;">
                        <li style="margin-bottom: 20px;">
                            <strong>1. Workspace:</strong> The broadest container for your department or unit (e.g.,
                            "Sociology Department" or "Dean's Office"). Everything is housed here.
                        </li>
                        <li style="margin-bottom: 20px;">
                            <strong>2. Category:</strong> Groups related events together within a workspace (e.g.,
                            "Undergrad Events," "Fiscal Year 2024," or "Faculty Recruitment").
                        </li>
                        <li style="margin-bottom: 20px;">
                            <strong>3. Event:</strong> A specific scheduled gathering or project (e.g., "Commencement
                            Dinner" or "Speaker Series: Jane Doe"). Events have their own global dates and location.
                        </li>
                        <li style="margin-bottom: 0;">
                            <strong>4. Item:</strong> The individual tasks, logistics, or milestones within an event
                            (e.g., "Catering Setup," "AV Check," or "Session 1: Introduction").
                        </li>
                    </ul>
                </div>
            </section>

            <hr style="border: 0; border-top: 2px solid #f1f5f9; margin: 40px 0;">

            <section class="docs-section">
                <h2>Technical Architecture</h2>
                <p>
                    Practica is built as a lightweight single-page application with a
                    PHP backend. It prioritizes speed, deployability, and clarity.
                </p>

                <div class="tech-note">
                    <h4><i class="fa-solid fa-server"></i> Overview</h4>
                    <ul>
                        <li><strong>Backend:</strong> PHP 8.0+.
                        </li>
                        <li><strong>Frontend:</strong> Vanilla JavaScript (state-driven), CSS Variables for theme
                            management.</li>
                        <li><strong>Database:</strong> MySQL 5.7+ / MariaDB.</li>
                        <li><strong>PDF Engine:</strong> <code>html2pdf.js</code> (generates on the client side).</li>
                    </ul>
                </div>

                <h3>Data Model</h3>
                <p>The system revolves around three core entities:</p>
                <ul>
                    <li><code>events</code>: The parent container (title, location, global dates).</li>
                    <li><code>event_items</code>: Tasks, logistics, or milestones within an event.</li>
                    <li><code>item_assignments</code>: Linking users to specific tasks.</li>
                </ul>

                <h3>State Management</h3>
                <p>
                    The frontend application (<code>app.js</code>) manages a central <code>App.state</code> object. When
                    an action occurs (like adding an item), the application updates the server via
                    <code>App.api()</code> and re-renders only the necessary DOM elements. Cloud Hat was the first
                    webapp like this I'd ever written, so any feedback is VERY welcome! Everything else I've ever
                    written is a giant pile of PHP files.
                </p>

                <div class="tech-note">
                    <h4><i class="fa-solid fa-code"></i> Practica's "API"</h4>
                    <pre>
// Example internal call
const response = await App.api({
    action: 'update_event',
    event_id: 123,
    title: 'New Title'
});</pre>
                    <p style="font-size: 0.85rem; margin: 0; color: #64748b;">
                        The server (<code>api.php</code>) handles requests from the app, acting as a traffic controller
                        that decides exactly which action to carry out.
                    </p>
                </div>

                <h3>Security & Sharing</h3>
                <p>
                    Public sharing is handled via tokens. When an event is marked "Public"
                    (<code>is_public = 1</code>), a unique <code>share_token</code> is generated. The
                    <code>share.php</code> page then provides a read-only mirror of the data without requiring
                    authentication.
                </p>
            </section>

            <section class="docs-section">
                <h2>Implementation Notes</h2>
                <div class="tech-note">
                    <h4><i class="fa-solid fa-wrench"></i> Deployment Requirements</h4>
                    <p style="font-size: 0.9rem;">
                        1. Apache/Nginx with PHP support.<br>
                        2. MySQL Database.<br>
                        3. Configuration in <code>db_connect.php</code>, at least for the prototype. My credential
                        storage is remarkably stupid!
                    </p>
                </div>
                <p>
                    For future integrations, the database schema supports cascading deletes, ensuring that deleting an
                    event category cleanly removes all child events, items, and assignments.
                </p>
            </section>
        </div>

        <footer style="text-align: center; margin-top: 30px; font-size: 0.85rem; color: var(--color-text-light);">
            &copy; <?php echo date("Y"); ?> Practica Project &bull; UC Davis Event Management
        </footer>
    </div>
</body>

</html>