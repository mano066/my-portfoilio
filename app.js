// Current year
document.addEventListener('DOMContentLoaded', function() {
  const yearElements = document.querySelectorAll('#current-year');
  const currentYear = new Date().getFullYear();
  yearElements.forEach(el => el.textContent = currentYear);
});

// Page transition effect
function initPageTransitions() {
  const transition = document.querySelector('.page-transition');
  
  // Hide transition on load
  setTimeout(() => {
    if (transition) {
      transition.style.transform = 'translateY(-100%)';
    }
  }, 100);
  
  // Handle navigation clicks
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      // Only transition for internal pages
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && 
          !href.startsWith('tel:') && !this.hasAttribute('target')) {
        e.preventDefault();
        
        if (transition) {
          transition.classList.add('active');
          setTimeout(() => {
            window.location.href = href;
          }, 300);
        } else {
          window.location.href = href;
        }
      }
    });
  });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Intersection Observer for animations
function initAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);
  
  // Observe elements that should animate in
  document.querySelectorAll('.card, .expertise-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Enhanced navigation highlighting
function initNavigationHighlighting() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Floating elements animation
function initFloatingElements() {
  const floatingElements = document.querySelectorAll('.float-element');
  
  floatingElements.forEach((element, index) => {
    const delay = index * 0.5;
    element.style.animationDelay = `${delay}s`;
    
    // Add random movement
    setInterval(() => {
      const randomX = Math.random() * 20 - 10;
      const randomY = Math.random() * 20 - 10;
      element.style.transform += ` translate(${randomX}px, ${randomY}px)`;
    }, 3000 + Math.random() * 2000);
  });
}

// Enhanced loading experience
function initLoadingExperience() {
  // Preload critical images
  const criticalImages = ['profile.jpg'];
  
  criticalImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });
  
  // Add loaded class when everything is ready
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Stagger animation of hero elements
    const heroElements = document.querySelectorAll('.hero-badge, .hero-title, .hero-subtitle, .hero-stats, .hero-actions, .social-links');
    heroElements.forEach((el, index) => {
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 100);
    });
  });
}

// Accessibility improvements
function initAccessibility() {
  // Skip to main content link
  const skipLink = document.createElement('a');
  skipLink.href = '#main';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: var(--primary);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add main id to main element
  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main';
  }
}

// Performance monitoring
function initPerformanceMonitoring() {
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        console.log(`Page loaded in ${perfData.loadEventEnd - perfData.loadEventStart}ms`);
      }
    });
  }
}

// Initialize all features
document.addEventListener('DOMContentLoaded', function() {
  initPageTransitions();
  initSmoothScrolling();
  initAnimations();
  initNavigationHighlighting();
  initFloatingElements();
  initLoadingExperience();
  initAccessibility();
  initPerformanceMonitoring();
});

// Error handling for missing images
document.addEventListener('DOMContentLoaded', function() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('error', function() {
      this.style.display = 'none';
      console.warn(`Failed to load image: ${this.src}`);
    });
  });
});
