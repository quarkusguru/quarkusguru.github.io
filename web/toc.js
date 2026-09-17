
// ============================================
// Automatic TOC Generation
// ============================================
(function() {
    'use strict';

    function generateSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim();
    }

    function generateAutoToc() {
        const tocList = document.getElementById('toc-list');
        if (!tocList) return false;

        // Check if TOC is already populated (manual mode)
        if (tocList.children.length > 0) return false;

        // Find all h2 and h3 in article content
        const articleContent = document.querySelector('.article-content');
        if (!articleContent) return false;

        const headings = articleContent.querySelectorAll('h2, h3');
        if (headings.length === 0) return false;

        let sectionNum = 0;
        let currentH2 = null;
        let currentSublist = null;

        headings.forEach((heading) => {
            const text = heading.textContent.trim();
            let id = heading.id;

            // Generate ID if it doesn't exist
            if (!id) {
                id = generateSlug(text);
                heading.id = id;
            }

            if (heading.tagName === 'H2') {
                sectionNum++;

                // Create H2 list item
                const li = document.createElement('li');
                li.className = 'toc-item toc-h2';

                const link = document.createElement('a');
                link.href = '#' + id;
                link.className = 'toc-link';
                link.setAttribute('data-target', id);
                link.textContent = text;

                li.appendChild(link);
                tocList.appendChild(li);

                currentH2 = li;
                currentSublist = null;
            } else if (heading.tagName === 'H3' && currentH2) {
                // Create subsection list if it doesn't exist
                if (!currentSublist) {
                    currentSublist = document.createElement('ul');
                    currentSublist.className = 'toc-sublist';
                    currentH2.appendChild(currentSublist);
                }

                // Create H3 list item
                const li = document.createElement('li');
                li.className = 'toc-item toc-h3';

                const link = document.createElement('a');
                link.href = '#' + id;
                link.className = 'toc-link';
                link.setAttribute('data-target', id);
                link.textContent = text;

                li.appendChild(link);
                currentSublist.appendChild(li);
            }
        });

        return true;
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Try to generate automatic TOC first
        generateAutoToc();
    });
})();

// ============================================
// Table of Contents Active State with Scroll Spy
// ============================================
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        // Small delay to ensure auto-generated TOC is ready
        setTimeout(function() {
            const toc = document.querySelector('.toc-sticky');
            if (!toc) return;

            const tocLinks = toc.querySelectorAll('.toc-link');
            const allHeadings = document.querySelectorAll('h2[id], h3[id]');

            if (tocLinks.length === 0 || allHeadings.length === 0) return;

            // Create a map of heading IDs to TOC links for quick lookup
            const linkMap = new Map();
            tocLinks.forEach(link => {
                linkMap.set(link.dataset.target, link);
            });

            let isManualClick = false;
            let manualClickTimeout;
            let activeHeadingId = null;

            /**
             * Set active state for a specific heading ID
             */
            function setActiveLink(headingId) {
                if (!headingId) return;

                // Only update if it's a different heading
                if (activeHeadingId === headingId) return;

                activeHeadingId = headingId;

                // Remove all active states
                tocLinks.forEach(link => link.classList.remove('active'));

                // Add active state to the matching link
                const activeLink = linkMap.get(headingId);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }

            /**
             * Update active TOC link based on scroll position
             */
            function updateActiveToc() {
                if (isManualClick) return;

                const scrollPosition = window.scrollY + 200; // Add offset to scroll position

                // Find the last heading we've scrolled past
                let currentHeading = null;

                // Go through all headings and find the last one we've passed
                for (let i = 0; i < allHeadings.length; i++) {
                    const heading = allHeadings[i];
                    const headingTop = heading.offsetTop;

                    // If this heading is above our current scroll position, it's a candidate
                    if (headingTop <= scrollPosition) {
                        currentHeading = heading;
                    } else {
                        // We've found a heading below us, stop checking
                        break;
                    }
                }

                // If we found a heading, activate it
                // This ensures the last heading stays active even when scrolling past it
                if (currentHeading && currentHeading.id) {
                    setActiveLink(currentHeading.id);
                }
            }

            /**
             * Throttled scroll handler
             */
            let scrollTimeout;
            function handleScroll() {
                if (scrollTimeout) {
                    window.cancelAnimationFrame(scrollTimeout);
                }
                scrollTimeout = window.requestAnimationFrame(updateActiveToc);
            }

            // Listen for scroll events
            window.addEventListener('scroll', handleScroll, { passive: true });

            // Handle TOC link clicks
            tocLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Mark as manual click
                    isManualClick = true;
                    clearTimeout(manualClickTimeout);

                    const targetId = link.dataset.target;

                    // Immediately set active state
                    setActiveLink(targetId);

                    // Scroll to target
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        const headerOffset = 100;
                        const elementPosition = targetElement.offsetTop;
                        const offsetPosition = elementPosition - headerOffset;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });

                        // Update URL hash
                        history.pushState(null, null, '#' + targetId);
                    }

                    // Re-enable auto-update after scroll animation completes
                    manualClickTimeout = setTimeout(() => {
                        isManualClick = false;
                        updateActiveToc();
                    }, 1000);
                });
            });

            // Initial update on page load
            updateActiveToc();

            // Handle direct navigation with hash
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                setActiveLink(hash);

                // Scroll to the element after a short delay
                setTimeout(() => {
                    const element = document.getElementById(hash);
                    if (element) {
                        const headerOffset = 100;
                        const elementPosition = element.offsetTop;
                        const offsetPosition = elementPosition - headerOffset;
                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
        }, 100); // End of setTimeout for auto-TOC compatibility
    });
})();