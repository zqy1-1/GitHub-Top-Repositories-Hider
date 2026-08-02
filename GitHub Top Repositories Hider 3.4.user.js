// ==UserScript==
// @name         GitHub Top Repositories Hider (隐藏Github首页Top repositories下面的仓库)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Github首页左侧Top repositories一直有个bug，只要你在某个仓库的issues上发言，就会把对方的仓库显示在下面。其中有些仓库你并不想显示在左侧，就比如我就在一个掺杂了病毒程序的仓库issues上说了几句，然后这破仓库给我显示在首页了，我很想把它去掉。所以就编了这个油猴脚本。纯纯用deepseek帮你编的。
// @author       zqy
// @match        https://github.com/
// @match        https://github.com/dashboard*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'gh_top_repos_hidden';
    const TOGGLE_KEY = 'gh_show_hide_buttons';
    let isInitialized = false;

    // --- 存储操作 ---
    function getHiddenList() {
        try { return JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch { return {}; }
    }
    function saveHiddenList(list) {
        GM_setValue(STORAGE_KEY, JSON.stringify(list));
    }
    function getToggleState() {
        return GM_getValue(TOGGLE_KEY, true);
    }
    function setToggleState(state) {
        GM_setValue(TOGGLE_KEY, state);
    }

    // --- 添加隐藏按钮到单个条目 ---
    function addHideButton(li) {
        if (li.querySelector('.gh-hide-repo-btn')) return;
        const link = li.querySelector('a[data-hovercard-type="repository"]');
        if (!link) return;
        const repoFullName = link.getAttribute('href').substring(1);

        const btn = document.createElement('button');
        btn.className = 'gh-hide-repo-btn';
        btn.textContent = '×';
        btn.title = '永久隐藏此仓库';
        Object.assign(btn.style, {
            marginLeft: '8px',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: '#888',
            fontSize: '16px',
            lineHeight: '1',
            padding: '0 4px'
        });
        const show = getToggleState();
        btn.style.display = show ? 'inline' : 'none';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            li.style.display = 'none';
            const hidden = getHiddenList();
            hidden[repoFullName] = true;
            saveHiddenList(hidden);
        });

        const nameContainer = li.querySelector('.wb-break-word');
        if (nameContainer) {
            nameContainer.appendChild(btn);
        }
    }

    // --- 切换所有隐藏按钮的可见性 ---
    function toggleAllButtons(show) {
        document.querySelectorAll('.gh-hide-repo-btn').forEach(btn => {
            btn.style.display = show ? 'inline' : 'none';
        });
        // 同时切换重置按钮的显示
        const resetBtn = document.getElementById('gh-reset-btn-bottom');
        if (resetBtn) {
            resetBtn.style.display = show ? '' : 'none';
        }
    }

    // --- 更新编辑按钮文字 ---
    function updateToggleText(toggleEl, show) {
        toggleEl.textContent = show ? '编辑' : 'edit';
    }

    // --- 恢复所有仓库 ---
    function resetAllRepos() {
        saveHiddenList({});
        document.querySelectorAll('ul.js-dashboard-repos-list li').forEach(li => {
            li.style.display = '';
        });
    }

    // --- 在列表底部添加重置按钮 ---
    function addResetButton(ul) {
        if (document.getElementById('gh-reset-btn-bottom')) return;

        const resetBtn = document.createElement('button');
        resetBtn.id = 'gh-reset-btn-bottom';
        resetBtn.textContent = '↻ reset';
        Object.assign(resetBtn.style, {
            display: getToggleState() ? '' : 'none',
            marginTop: '12px',
            padding: '6px 12px',
            background: 'none',
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            color: '#24292f',
            cursor: 'pointer',
            fontSize: '14px',
            width: '100%',
            textAlign: 'center'
        });
        resetBtn.addEventListener('click', function(e) {
            if (confirm('确定要恢复所有被隐藏的仓库吗？')) {
                resetAllRepos();
                const original = this.textContent;
                this.textContent = '✓ 已恢复';
                this.style.borderColor = '#28a745';
                this.style.color = '#28a745';
                setTimeout(() => {
                    this.textContent = original;
                    this.style.borderColor = '#d0d7de';
                    this.style.color = '#24292f';
                }, 1500);
            }
        });

        // 插入到 ul 之后（作为兄弟元素）
        ul.parentNode.insertBefore(resetBtn, ul.nextSibling);
    }

    // --- 添加顶部控件（仅编辑按钮） ---
    function addTopControls() {
        const oldControls = document.getElementById('gh-repo-controls');
        if (oldControls) oldControls.remove();

        const h2s = document.querySelectorAll('h2.f5');
        let h2 = null;
        for (let el of h2s) {
            if (el.textContent.trim() === 'Top repositories') {
                h2 = el;
                break;
            }
        }
        if (!h2) {
            console.warn('未找到 "Top repositories" 标题');
            return false;
        }

        const parent = h2.parentNode;
        let newBtn = parent.querySelector('a.Button--primary, a[href="/new"]');
        if (!newBtn) {
            const allLinks = parent.querySelectorAll('a');
            for (let a of allLinks) {
                if (a.textContent.trim() === 'New') {
                    newBtn = a;
                    break;
                }
            }
        }
        if (!newBtn) {
            console.warn('未找到 New 按钮');
            return false;
        }

        const controls = document.createElement('span');
        controls.id = 'gh-repo-controls';
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';

        // 仅编辑按钮
        const toggleSpan = document.createElement('span');
        toggleSpan.id = 'gh-repo-hide-toggle';
        toggleSpan.style.cursor = 'pointer';
        toggleSpan.style.fontSize = '14px';
        toggleSpan.style.fontWeight = 'normal';
        toggleSpan.style.userSelect = 'none';
        toggleSpan.style.padding = '4px 8px';
        toggleSpan.style.borderRadius = '6px';
        toggleSpan.style.border = '1px solid #d0d7de';
        const show = getToggleState();
        updateToggleText(toggleSpan, show);
        controls.appendChild(toggleSpan);

        toggleSpan.addEventListener('click', function(e) {
            const current = getToggleState();
            const newVal = !current;
            setToggleState(newVal);
            updateToggleText(this, newVal);
            toggleAllButtons(newVal);
        });

        // 插入到 New 按钮之前，利用父级的 flex-justify-between 实现左、中、右分布
        parent.insertBefore(controls, newBtn);

        return true;
    }

    // --- 处理列表：应用隐藏状态 + 添加隐藏按钮 + 添加重置按钮 ---
    function processList(ul) {
        // 移除旧的隐藏按钮（避免重复）
        ul.querySelectorAll('.gh-hide-repo-btn').forEach(btn => btn.remove());

        const hidden = getHiddenList();
        const lis = ul.querySelectorAll('li');
        lis.forEach(li => {
            const link = li.querySelector('a[data-hovercard-type="repository"]');
            if (link) {
                const repoFullName = link.getAttribute('href').substring(1);
                if (hidden[repoFullName]) {
                    li.style.display = 'none';
                } else {
                    li.style.display = '';
                }
            }
            addHideButton(li);
        });

        // 添加重置按钮（如果不存在）
        addResetButton(ul);
    }

    // --- 初始化主函数 ---
    function init() {
        if (isInitialized) return;
        const ul = document.querySelector('ul.js-dashboard-repos-list');
        if (ul) {
            processList(ul);
        }
        const controlsAdded = addTopControls();
        if (controlsAdded) {
            isInitialized = true;
        }
        if (!controlsAdded && ul) {
            setTimeout(() => {
                addTopControls();
            }, 1000);
        }
    }

    // --- 设置观察器监听列表变化 ---
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let needRefresh = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches && node.matches('ul.js-dashboard-repos-list')) {
                            needRefresh = true;
                            break;
                        }
                    }
                    for (const node of mutation.removedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches && node.matches('ul.js-dashboard-repos-list')) {
                            needRefresh = true;
                            break;
                        }
                    }
                }
            }
            if (needRefresh) {
                const newUl = document.querySelector('ul.js-dashboard-repos-list');
                if (newUl) {
                    processList(newUl);
                }
                if (!document.getElementById('gh-repo-controls')) {
                    addTopControls();
                }
                isInitialized = true;
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- 启动 ---
    function start() {
        init();
        if (!isInitialized) {
            setTimeout(() => {
                init();
            }, 2000);
        }
        setupObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    // 样式
    GM_addStyle(`
        .gh-hide-repo-btn:hover {
            color: #d73a49 !important;
        }
        #gh-repo-hide-toggle:hover {
            background-color: #f3f4f6;
        }
        #gh-reset-btn-bottom:hover {
            background-color: #f6f8fa;
        }
    `);
})();