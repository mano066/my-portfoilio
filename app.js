// Chatbot functionality
class CareerTakAIChatbot {
  constructor() {
    this.toggle = document.getElementById('chatbot-toggle');
    this.panel = document.getElementById('chatbot-panel');
    this.close = document.getElementById('chatbot-close');
    this.content = document.getElementById('chatbot-content');
    this.heroToggle = document.getElementById('chatbot-toggle-hero');
    this.isOpen = false;
    this.isLoaded = false;
    
    this.init();
  }
  
  init() {
    this.toggle?.addEventListener('click', () => this.toggleChatbot());
    this.heroToggle?.addEventListener('click', () => this.openChatbot());
    this.close?.addEventListener('click', () => this.closeChatbot());
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && 
          !this.panel?.contains(e.target) && 
          !this.toggle?.contains(e.target) &&
          !this.heroToggle?.contains(e.target)) {
        this.closeChatbot();
      }
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeChatbot();
      }
    });
  }
  
  toggleChatbot() {
    if (this.isOpen) {
      this.closeChatbot();
    } else {
      this.openChatbot();
    }
  }
  
  openChatbot() {
    this.isOpen = true;
    this.toggle?.classList.add('active');
    this.panel?.classList.add('active');
    
    if (!this.isLoaded) {
      this.loadGradioApp();
    }
    
    // Focus management for accessibility
    setTimeout(() => {
      this.close?.focus();
    }, 300);
  }
  
  closeChatbot() {
    this.isOpen = false;
    this.toggle?.classList.remove('active');
    this.panel?.classList.remove('active');
    
    // Return focus to toggle button
    this.toggle?.focus();
  }
  
  loadGradioApp() {
    if (this.isLoaded || !this.content) return;
    
    try {
      // Create gradio app element
      const gradioApp = document.createElement('gradio-app');
      gradioApp.setAttribute('space', 'MANO066/Career-takAI');
      gradioApp.setAttribute('theme_mode', 'light');
      gradioApp.setAttribute('eager', 'true');
      gradioApp.setAttribute('container', 'false');
      gradioApp.setAttribute('info', 'false');
      gradioApp.style.height = '100%';
      gradioApp.style.width = '100%';
      
      // Clear loading state
      this.content.innerHTML = '';
      this.content.appendChild(gradioApp);
      
      this.isLoaded = true;
      
      // Handle loading errors
      setTimeout(() => {
        if (!gradioApp.shadowRoot) {
          this.showError();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Failed to load Career-takAI:', error);
      this.showError();
    }
  }
  
  showError() {
    if (!this.content) return;
    
    this.content.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        <i class="ti ti-alert-circle" style="font-size: 32px; color: var(--accent); margin-bottom: 12px;"></i>
        <p>Unable to load Career-takAI assistant.</p>
        <p style="font-size: 14px;">Please try again later or visit the <a href="https://huggingface.co/spaces/MANO066/Career-takAI" target="_blank" style="color: var(--primary);">Space directly</a>.</p>
      </div>
    `;
  }
}

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
  document.querySelectorAll('.card, .expertise-card, .project-card, .publication-card').forEach(el => {
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

// Floating elements animation (continued)
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

// Error handling for missing images
function initImageErrorHandling() {
  const images = document.querySelectorAll('img');
  images.forEach((img, index) => {
    img.addEventListener('error', function() {
      // Create a gradient placeholder with appropriate icon
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--primary-light), var(--bg-secondary));
        color: var(--primary);
        font-size: 24px;
        border-radius: inherit;
      `;
      
      // Different icons based on image context
      let iconClass = 'ti-user';
      if (this.classList.contains('portrait')) {
        iconClass = 'ti-user-circle';
      } else if (this.src && this.src.includes('research')) {
        iconClass = 'ti-file-text';
      }
      
      placeholder.innerHTML = `<i class="ti ${iconClass}"></i>`;
      
      this.parentNode.replaceChild(placeholder, this);
    });
  });
}

// Theme detection and handling
function initThemeHandling() {
  // Detect system theme preference
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  function handleThemeChange(e) {
    // Optional: Add theme switching logic here
    console.log('Theme changed to:', e.matches ? 'dark' : 'light');
  }
  
  mediaQuery.addListener(handleThemeChange);
  handleThemeChange(mediaQuery);
}

// Enhanced scroll behavior
function initScrollBehavior() {
  let lastScrollTop = 0;
  const header = document.querySelector('.site');
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      // Scrolling down
      header?.classList.add('hidden');
    } else {
      // Scrolling up
      header?.classList.remove('hidden');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }, { passive: true });
}

// Form validation (if contact forms are added later)
function initFormValidation() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const requiredFields = this.querySelectorAll('[required]');
      let isValid = true;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add('error');
        } else {
          field.classList.remove('error');
        }
      });
      
      if (!isValid) {
        e.preventDefault();
      }
    });
  });
}

// Analytics tracking (placeholder for GA4 or similar)
function initAnalytics() {
  // Placeholder for analytics implementation
  const trackEvent = (action, category = 'General') => {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: window.location.pathname
      });
    }
  };
  
  // Track page views
  trackEvent('page_view', 'Navigation');
  
  // Track chatbot interactions
  document.getElementById('chatbot-toggle')?.addEventListener('click', () => {
    trackEvent('chatbot_open', 'Engagement');
  });
  
  // Track social link clicks
  document.querySelectorAll('.social-link').forEach(link => {
    link.addEventListener('click', () => {
      const platform = link.textContent.trim();
      trackEvent(`social_click_${platform}`, 'Social');
    });
  });
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Core functionality
  initPageTransitions();
  initSmoothScrolling();
  initAnimations();
  initNavigationHighlighting();
  initFloatingElements();
  initLoadingExperience();
  initAccessibility();
  initPerformanceMonitoring();
  initImageErrorHandling();
  initThemeHandling();
  initScrollBehavior();
  initFormValidation();
  initAnalytics();
  
  // Initialize chatbot
  new CareerTakAIChatbot();
  
  // Current year in footer
  const yearElements = document.querySelectorAll('#current-year');
  const currentYear = new Date().getFullYear();
  yearElements.forEach(el => el.textContent = currentYear);
  
  // Add smooth reveal animations
  const revealElements = document.querySelectorAll('.hero-content > *');
  revealElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'all 0.6s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * 100);
  });
});

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

