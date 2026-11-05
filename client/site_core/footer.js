document.addEventListener('DOMContentLoaded', function() {
  const brandLinks = document.querySelectorAll('.nav-cms_brand-link');
  brandLinks.forEach(link => {
    const altUrl = link.getAttribute('data-brand-alt-url');
    if (altUrl) {
      link.setAttribute('href', altUrl);
      console.log(`Updated link href to: ${altUrl}`);
    }
  });

  const images = document.querySelectorAll('img');
  
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.includes('placeholder.')) {
      console.log(`Marking placeholder image as decorative: ${src}`);
      img.setAttribute('alt', ''); // Empty alt text marks image as decorative
      img.setAttribute('role', 'presentation'); // Additional attribute for better accessibility
    }
  });
});

// === Number formatting ([data-edge-format]) ===
// Ebbett's Cloudflare Worker rewrites these at the edge (ebbett-core-edge worker, EDGE-010): CMS-bound
// prices and odometers carry data-edge-format="nzd" or "km" and arrive as raw numbers. Johnston has no
// Worker, so this does the same in the browser. Elements added later (CMS pagination, sliders) are
// formatted as they appear. Same rules as the Worker: unknown formats and non-numbers are left alone.
(function() {
  var nzd = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var plain = new Intl.NumberFormat('en-NZ');

  function formatValue(raw, format) {
    var cleaned = String(raw).trim().replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    var num = Number(cleaned);
    if (Number.isNaN(num)) return null;
    if (format === 'nzd') return nzd.format(num);
    if (format === 'km') return plain.format(num) + ' km';
    return null;
  }

  function formatIn(root) {
    var els = root.matches && root.matches('[data-edge-format]') ? [root] : [];
    els = els.concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('[data-edge-format]') : []));
    els.forEach(function(el) {
      if (el.hasAttribute('data-edge-formatted') || el.children.length) return;
      var formatted = formatValue(el.textContent, el.getAttribute('data-edge-format'));
      if (formatted !== null) el.textContent = formatted;
      el.setAttribute('data-edge-formatted', '');
    });
  }

  function start() {
    formatIn(document);
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) { if (node.nodeType === 1) formatIn(node); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
