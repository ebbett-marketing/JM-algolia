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