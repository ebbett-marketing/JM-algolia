/**
 * Ebbett Lead Intelligence - Client Script
 * 
 * Manages user session persistence and form field population.
 */

(function() {
    'use strict';

    const CONFIG = {
        storageKey: 'ebbett_intelligence',
        inputPrefix: 'eli_',
        sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days (Persistent for return visitors)
        // Map URL parameters to storage keys
        paramMap: {
            'utm_source': 'source',
            'utm_medium': 'medium',
            'utm_campaign': 'campaign',
            'utm_content': 'content',
            'utm_term': 'term',
            'gclid': 'gclid',
            'fbclid': 'fbclid'
        }
    };

    /**
     * Helper to get URL parameters
     */
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Helper to generate a session ID
     */
    function generateId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }

    /**
     * Main Session Logic
     */
    function initSession() {
        const currentParams = getUrlParams();
        const stripQuery = (href) => {
            const url = new URL(href);
            url.search = '';
            return url.toString();
        };

        // 0. Debug: Allow manual reset via URL (e.g. ?eli_reset=true)
        if (currentParams['eli_reset']) {
            localStorage.removeItem(CONFIG.storageKey);
            console.log('[Ebbett Intelligence] Session reset via URL parameter.');
        }

        // 1. Retrieve existing data
        let data = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
        const now = Date.now();
        // const currentParams = getUrlParams(); // Moved up
        const docReferrer = document.referrer;
        
        // 2. Check for Session Expiration or New Entry
        // A new session starts if:
        // - No session exists
        // - Time since last activity > 30 mins
        // - New UTM parameters are present (Marketing push)
        // - Referrer is external (User came from a different site, e.g. Google)
        
        const isExpired = data.last_activity && (now - data.last_activity > CONFIG.sessionTimeout);
        
        // Only consider it a "New Campaign" if the parameters are DIFFERENT from what we already have.
        // This prevents a page refresh (which keeps the same UTMs) from resetting the session.
        const hasNewCampaign = Object.keys(CONFIG.paramMap).some(key => {
            const newValue = currentParams[key];
            const oldValue = data.params ? data.params[CONFIG.paramMap[key]] : undefined;
            return newValue && newValue !== oldValue;
        });

        const isExternalReferrer = docReferrer && !docReferrer.includes(window.location.hostname);
        
        if (!data.session_id || isExpired || hasNewCampaign || isExternalReferrer) {
            // Reset session data for the new journey
            // (Optional: You could archive the old session here if you wanted multi-session history)
            data = {
                session_id: generateId(),
                first_visit_at: new Date().toISOString(),
                landing_page: window.location.origin + window.location.pathname, // Clean URL (Base)
                landing_page_raw: window.location.href, // Full URL (Raw)
                referrer: docReferrer || 'direct',
                user_agent: navigator.userAgent,
                language: navigator.language || navigator.userLanguage,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                history: [],
                params: {} 
            };
        }

        // 3. Update Activity Timestamp
        data.last_activity = now;

        // 4. Capture URL Parameters (Last Touch attribution)
        // If new parameters are present in the URL, update the stored params
        let paramsUpdated = false;
        
        Object.keys(CONFIG.paramMap).forEach(paramKey => {
            if (currentParams[paramKey]) {
                data.params[CONFIG.paramMap[paramKey]] = currentParams[paramKey];
                paramsUpdated = true;
            }
        });

        // 5. Record Page View
        const isFirstPage = data.history.length === 0;
        const currentPage = {
            // First history entry stores a clean URL without query parameters
            url: isFirstPage ? stripQuery(window.location.href) : window.location.href,
            title: document.title,
            timestamp: new Date().toISOString()
        };
        
        // Avoid duplicate entries
        const lastPage = data.history[data.history.length - 1];
        if (!lastPage || lastPage.url !== currentPage.url) {
            data.history.push(currentPage);
        }

        // 6. Save back to storage
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));

        // 7. Sync Forms
        syncForms(data);
        
        // Observe DOM for new forms
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    syncForms(data);
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Syncs form fields with session data
     */
    function syncForms(data) {
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            // Helper to set or create hidden input
            const setHiddenInput = (name, value) => {
                if (!value) return;
                
                let input = form.querySelector(`input[name="${name}"]`);
                if (!input) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = name;
                    form.appendChild(input);
                }
                input.value = value;
            };

            // 1. Set UTM/Param fields (e.g., eli_source, eli_campaign)
            Object.entries(data.params).forEach(([key, value]) => {
                setHiddenInput(`${CONFIG.inputPrefix}${key}`, value);
            });

            // 2. Set Session ID
            setHiddenInput(`${CONFIG.inputPrefix}session_id`, data.session_id);

            // 3. Set Contextual Data
            setHiddenInput(`${CONFIG.inputPrefix}landing_page`, data.landing_page);
            setHiddenInput(`${CONFIG.inputPrefix}landing_page_raw`, data.landing_page_raw || data.landing_page);
            setHiddenInput(`${CONFIG.inputPrefix}referrer`, data.referrer);
            setHiddenInput(`${CONFIG.inputPrefix}user_agent`, data.user_agent);
            setHiddenInput(`${CONFIG.inputPrefix}language`, data.language);
            setHiddenInput(`${CONFIG.inputPrefix}timezone`, data.timezone);

            // 4. Set Journey/History
            // We format this as a readable string or JSON depending on preference. 
            // JSON is safer for data parsing, but a list is readable.
            // Let's do a simplified list of URLs for the 'journey' field.
            const journeyUrls = data.history.map(h => h.url).join('\n');
            setHiddenInput(`${CONFIG.inputPrefix}journey`, journeyUrls);
            
            // Also full JSON if needed for advanced parsing
            // setHiddenInput(`${CONFIG.inputPrefix}journey_json`, JSON.stringify(data.history));
        });
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSession);
    } else {
        initSession();
    }

})();