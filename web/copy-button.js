// ============================================
// Copy Button for Code Blocks
// ============================================
(function () {
    'use strict';

    const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    function addCopyButtons() {
        document.querySelectorAll('.article-content pre').forEach((pre) => {
            if (pre.querySelector('.copy-button')) return;

            const code = pre.querySelector('code');
            if (!code) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'copy-button';
            button.setAttribute('aria-label', 'Copy code to clipboard');
            button.innerHTML = copyIcon;

            button.addEventListener('click', () => {
                navigator.clipboard.writeText(code.innerText).then(() => {
                    button.innerHTML = checkIcon;
                    button.classList.add('copied');
                    button.setAttribute('aria-label', 'Copied!');

                    clearTimeout(button._resetTimeout);
                    button._resetTimeout = setTimeout(() => {
                        button.innerHTML = copyIcon;
                        button.classList.remove('copied');
                        button.setAttribute('aria-label', 'Copy code to clipboard');
                    }, 2000);
                });
            });

            pre.appendChild(button);
        });
    }

    document.addEventListener('DOMContentLoaded', addCopyButtons);
})();
