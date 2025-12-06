//- No-op in case this is running outside of SillyTavern
 
const { extension_settings: _extension_settings } = typeof self.SillyTavern !== 'undefined' ? self.SillyTavern.getContext() : { extension_settings: {} };

class Internationalization {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this._listeners = {};
    }

    addEventListener(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    dispatchEvent(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(callback => callback(data));
        }
    }

    async init() {
        const savedLanguage = localStorage.getItem('rpgCompanionLanguage') || 'en';
        this.currentLanguage = savedLanguage;

        await this.loadTranslations(this.currentLanguage);
        this.applyTranslations(document.body);

        const langSelect = document.getElementById('rpg-companion-language-select');
        if (langSelect) {
            langSelect.value = this.currentLanguage;
        }
    }

    async loadTranslations(lang) {
        const fetchUrl = `/scripts/extensions/third-party/rpg-companion-sillytavern/src/i18n/${lang}.json`;
        try {
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                console.error(`[RPG-Companion-i18n] Failed to load translation file for ${lang}. Status: ${response.status}`);
                if (lang !== 'en') {
                    return this.loadTranslations('en');
                }
                return;
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('[RPG-Companion-i18n] CRITICAL error loading translation file:', error);
        }
    }

    applyTranslations(rootElement) {
        if (!rootElement) {
            return;
        }

        // 1. Translate textContent
        const textElements = rootElement.querySelectorAll('[data-i18n-key]');
        textElements.forEach(element => {
            const key = element.dataset.i18nKey;
            const translation = this.getTranslation(key);
            if (translation) {
                element.textContent = translation;
            }
        });

        // 2. Translate title attribute
        const titleElements = rootElement.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.dataset.i18nTitle;
            const translation = this.getTranslation(key);
            if (translation) {
                element.setAttribute('title', translation);
            }
        });

        // 3. Translate aria-label attribute
        const ariaLabelElements = rootElement.querySelectorAll('[data-i18n-aria-label]');
        ariaLabelElements.forEach(element => {
            const key = element.dataset.i18nAriaLabel;
            const translation = this.getTranslation(key);
            if (translation) {
                element.setAttribute('aria-label', translation);
            }
        });
    }

    getTranslation(key, fallback = null) {
        // Return translation, or fallback, or the key itself (prevents "null" from showing)
        return this.translations[key] || fallback || key;
    }

    async setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('rpgCompanionLanguage', lang);
        await this.loadTranslations(lang);
        this.applyTranslations(document.body);
        this.dispatchEvent('languageChanged');
    }
}

export const i18n = new Internationalization();
