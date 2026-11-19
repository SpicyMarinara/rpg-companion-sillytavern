/**
 * Weather keyword hints for the tracker prompt.
 * The forecast field is constrained to these keywords so the output stays consistent.
 * (Previously lived in ui/weatherEffects.js alongside the removed particle effects.)
 */

export const WEATHER_PATTERNS_BY_LANGUAGE = {
    en: [
        { id: "blizzard", patterns: [ "blizzard" ] }, // Snow + Wind
        { id: "storm", patterns: [ "storm", "thunder", "lightning" ] }, // Rain + Lightning
        { id: "wind", patterns: [ "wind", "breeze", "gust", "gale" ] },
        { id: "snow", patterns: [ "snow", "flurries" ] },
        { id: "rain", patterns: [ "rain", "drizzle", "shower" ] },
        { id: "mist", patterns: [ "mist", "fog", "haze" ] },
        { id: "sunny", patterns: [ "sunny", "clear", "bright" ] },
        { id: "none", patterns: [ "cloud", "overcast", "indoor", "inside" ] },
    ],
    ru: [
        { id: "blizzard", patterns: [ "метель" ] },
        { id: "storm", patterns: [ "гроза", "буря", "шторм" ] },
        { id: "wind", patterns: [ "ветер", "ветрено", "ветерок", "бриз", "легкий бриз", "слегка ветрено", "легкий ветер", "шквал,буря" ] },
        { id: "snow", patterns: [ "снег", "снегопад" ] },
        { id: "rain", patterns: [ "дождь", "морось", "ливень" ] },
        { id: "mist", patterns: [ "мгла", "туман", "туманно" ] },
        { id: "sunny", patterns: [ "солнечно", "ясно", "ярко", "ясное утро", "ясный день" ] },
        { id: "none", patterns: [ "облачно", "пасмурно", "в помещении", "внутри" ] },
    ],
    "zh-cn": [
        { id: "blizzard", patterns: ["暴风雪"] },
        { id: "storm", patterns: ["风暴", "雷暴", "雷电"] },
        { id: "wind", patterns: ["风", "微风", "阵风", "大风"] },
        { id: "snow", patterns: ["雪", "小雪"] },
        { id: "rain", patterns: ["雨", "毛毛雨", "阵雨"] },
        { id: "mist", patterns: ["薄雾", "雾", "霾"] },
        { id: "sunny", patterns: ["晴朗", "晴天", "阳光明媚"] },
        { id: "none", patterns: ["多云", "阴天", "室内", "屋内"] },
    ],
}

/**
 * Get valid weather keywords for LLM prompt injection.
 * Returns weather patterns for specified language or all languages.
 * This ensures LLM generates responses that exactly match our expected patterns.
 *
 * @param {string} [language] - Language code (e.g., 'en', 'ru'). If not specified, returns all languages.
 * @returns {Object} Object with weather type IDs as keys and arrays of valid keywords as values
 * @example
 * // Returns: { blizzard: ["blizzard"], storm: ["storm", "thunder", "lightning"], ... }
 * getWeatherKeywordsForPrompt('en');
 */
export function getWeatherKeywordsForPrompt(language) {
    const result = {};

    // Get patterns for specified language or merge all languages
    const languagesToProcess = language && WEATHER_PATTERNS_BY_LANGUAGE[language]
        ? { [language]: WEATHER_PATTERNS_BY_LANGUAGE[language] }
        : WEATHER_PATTERNS_BY_LANGUAGE;

    for (const [lang, patterns] of Object.entries(languagesToProcess)) {
        for (const { id, patterns: keywords } of patterns) {
            if (!result[id]) {
                result[id] = [];
            }
            // Add keywords, avoiding duplicates
            for (const keyword of keywords) {
                if (!result[id].includes(keyword)) {
                    result[id].push(keyword);
                }
            }
        }
    }

    return result;
}

/**
 * Get weather keywords as a formatted string for LLM instructions.
 * Provides a clear template showing valid weather forecast values.
 *
 * @param {string} [language] - Language code. If not specified, uses all available patterns.
 * @returns {string} Formatted string for prompt injection
 * @example
 * // Returns: 'Valid forecast values: "blizzard", "storm", "thunder", "lightning", "wind", ...'
 * getWeatherKeywordsAsPromptString('en');
 */
export function getWeatherKeywordsAsPromptString(language) {
    const keywords = getWeatherKeywordsForPrompt(language);
    const allKeywords = [];

    for (const patterns of Object.values(keywords)) {
        allKeywords.push(...patterns);
    }

    return `Valid forecast values (use one of these exactly): ${allKeywords.map(k => `"${k}"`).join(', ')}`;
}
