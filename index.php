<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Practica</title>
    <link rel="stylesheet" href="index.css?v=1.1">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="shortcut icon" href="/favicon.ico" />
</head>

<body>
    <header>
        <div class="logo logo-container" style="cursor: pointer;" onclick="App.toggleTheme()">
            <div class="logo-box">
                <span class="logo-heart">💙</span>
            </div>
            Practica
        </div>
        <nav id="nav-menu">
            <!-- Injected via JS -->
        </nav>
    </header>

    <main id="app">
        <!-- SPA Content Injected Here -->
        <div class="auth-container">
            <h2>Loading Practica...</h2>
        </div>
    </main>

    <footer>
        <a href="docs.php" style="color: var(--color-text-light); text-decoration: none; margin-right: 15px;"><i class="fa-solid fa-book"></i> Documentation</a>
        &copy; <?php echo date("Y"); ?> Regents of the University of California
    </footer>

    <!-- Modals -->
    <div id="modal-container" class="modal-overlay">
        <div class="modal-content">
            <button class="modal-close" onclick="closeModal()">&times;</button>
            <div id="modal-body"></div>
        </div>
    </div>

    <!-- Scripts -->
    <script>console.log("Main HTML parsed successfully.");</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
    <script src="app.js"></script>
</body>

</html>