const fs = require('fs');
const cssPath = 'index.css';
let content = fs.readFileSync(cssPath, 'utf8');

const responsiveCSS = `
/* =============================================
   RESPONSIVE DESIGN (ADDED FOR PWA/MOBILE)
   ============================================= */
@media (max-width: 1024px) {
  .dashboard-grid, .terminal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    height: 100vh;
    left: 0;
    top: 0;
    transform: translateX(-100%);
    box-shadow: var(--shadow-xl);
    z-index: 200;
  }
  .sidebar.mobile-open { transform: translateX(0); }
  .sidebar.mobile-closed { transform: translateX(-100%); }
  .sidebar.collapsed { min-width: 260px; width: 260px; }
  
  .app-layout { flex-direction: column; }
  .main-content { width: 100vw; overflow-x: hidden; }
  
  .main-header-controls { top: 8px !important; left: 8px !important; }
  .header { padding-left: 50px; padding-right: var(--space-md); }
  .header-left .page-title { font-size: 16px; }
  
  .grid, [class*="grid-cols-"] { grid-template-columns: 1fr !important; }
  
  .table-responsive, .table-container, .card > table {
    display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  
  .card { padding: var(--space-md); }
  .stat-card { padding: var(--space-md); }
  h1, h2, .h1, .h2 { font-size: 1.3rem; }
}
`;

content += responsiveCSS;
fs.writeFileSync(cssPath, content);
console.log('Appended successfully');
