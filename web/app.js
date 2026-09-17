import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/red-hat-display/600.css";
import "@fontsource/red-hat-display/700.css";
import "@fontsource/red-hat-mono/400.css";
import "@fontsource/red-hat-mono/500.css";

import hljs from 'highlight.js';
import mediumZoom from 'medium-zoom';

hljs.highlightAll();
mediumZoom('.article-content img');

// ============================================
// Reading time
// ============================================
(function () {
    const article = document.querySelector('.article-content');
    const slot = document.querySelector('[data-reading-time]');
    if (!article || !slot) return;

    const words = article.textContent.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 220));
    slot.textContent = minutes + ' min read';
})();

// ============================================
// Code block chrome: language label + copy button
// ============================================
(function () {
    const blocks = document.querySelectorAll('.article-content pre');
    if (!blocks.length) return;

    blocks.forEach((pre) => {
        const code = pre.querySelector('code');
        if (!code) return;

        const wrap = document.createElement('div');
        wrap.className = 'code-block';
        pre.parentNode.insertBefore(wrap, pre);

        const bar = document.createElement('div');
        bar.className = 'code-bar';

        const langMatch = code.className.match(/language-([\w-]+)/);
        const lang = document.createElement('span');
        lang.className = 'code-lang';
        lang.textContent = langMatch ? langMatch[1] : 'text';
        bar.appendChild(lang);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'code-copy';
        btn.textContent = 'copy';
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code.textContent);
                btn.textContent = 'copied';
            } catch (e) {
                btn.textContent = 'failed';
            }
            setTimeout(() => { btn.textContent = 'copy'; }, 1800);
        });
        bar.appendChild(btn);

        wrap.appendChild(bar);
        wrap.appendChild(pre);
    });
})();
