/**
 * Real-Time Synchronization Service
 * Syncs game time with real time (Animal Crossing style)
 *
 * @module realworld/timeService
 */

/**
 * Time data returned from the service
 * @typedef {Object} TimeData
 * @property {number} hour - Hour (0-23)
 * @property {number} minute - Minute (0-59)
 * @property {string} dayOfWeek - Full day name (e.g., "Monday")
 * @property {string} dayOfWeekShort - Short day name (e.g., "Mon")
 * @property {string} date - Formatted date string
 * @property {string} monthName - Full month name
 * @property {number} day - Day of month
 * @property {number} year - Year
 * @property {boolean} isNight - True if between 10 PM and 6 AM
 * @property {boolean} isMorning - True if between 6 AM and 12 PM
 * @property {boolean} isAfternoon - True if between 12 PM and 5 PM
 * @property {boolean} isEvening - True if between 5 PM and 10 PM
 * @property {string} period - Current time period name
 * @property {string} timeFormatted - Formatted time string (HH:MM)
 * @property {string} timeFormatted12h - 12-hour formatted time (H:MM AM/PM)
 * @property {number} timestamp - Unix timestamp in milliseconds
 */

/**
 * Special date information
 * @typedef {Object} SpecialDate
 * @property {string} name - Name of the special day
 * @property {string} message - Greeting message
 * @property {string} [emoji] - Optional emoji for the day
 */

/**
 * Predefined special dates (month-day format)
 */
const SPECIAL_DATES = {
    '1-1': { name: "New Year's Day", message: "Happy New Year!", emoji: '🎉' },
    '2-14': { name: "Valentine's Day", message: "Happy Valentine's Day!", emoji: '💕' },
    '3-17': { name: "St. Patrick's Day", message: "Happy St. Patrick's Day!", emoji: '☘️' },
    '4-1': { name: "April Fools' Day", message: "Happy April Fools' Day!", emoji: '🃏' },
    '4-22': { name: "Earth Day", message: "Happy Earth Day!", emoji: '🌍' },
    '5-4': { name: "Star Wars Day", message: "May the Fourth be with you!", emoji: '⭐' },
    '7-4': { name: "Independence Day (US)", message: "Happy 4th of July!", emoji: '🎆' },
    '10-31': { name: "Halloween", message: "Happy Halloween!", emoji: '🎃' },
    '11-11': { name: "Veterans Day", message: "Thank you to all veterans!", emoji: '🎖️' },
    '12-24': { name: "Christmas Eve", message: "Merry Christmas Eve!", emoji: '🎄' },
    '12-25': { name: "Christmas", message: "Merry Christmas!", emoji: '🎄' },
    '12-31': { name: "New Year's Eve", message: "Happy New Year's Eve!", emoji: '🥂' }
};

/**
 * Service for real-time synchronization and time-aware features
 */
export class TimeService {
    /**
     * Create a TimeService instance
     * @param {Object} [options={}] - Configuration options
     * @param {string} [options.timezone] - IANA timezone string (defaults to system timezone)
     * @param {number} [options.timeOffset=0] - Hours to offset from real time
     * @param {boolean} [options.use24Hour=true] - Use 24-hour format
     */
    constructor(options = {}) {
        /** @type {string} */
        this.timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        /** @type {number} Offset in hours from real time */
        this.timeOffset = options.timeOffset || 0;
        /** @type {boolean} */
        this.use24Hour = options.use24Hour !== false;
        /** @type {Map<string, SpecialDate>} Custom special dates */
        this.customDates = new Map();
        /** @type {string|null} Player's birthday (MM-DD format) */
        this.playerBirthday = null;
    }

    /**
     * Set a time offset (for time travel features)
     * @param {number} hours - Hours to offset (positive or negative)
     */
    setTimeOffset(hours) {
        this.timeOffset = hours;
    }

    /**
     * Set the player's birthday for special greetings
     * @param {number} month - Month (1-12)
     * @param {number} day - Day of month
     */
    setPlayerBirthday(month, day) {
        this.playerBirthday = `${month}-${day}`;
    }

    /**
     * Add a custom special date
     * @param {number} month - Month (1-12)
     * @param {number} day - Day of month
     * @param {SpecialDate} dateInfo - Special date information
     */
    addCustomDate(month, day, dateInfo) {
        this.customDates.set(`${month}-${day}`, dateInfo);
    }

    /**
     * Get the current time data
     * @returns {TimeData}
     */
    getCurrentTime() {
        const now = new Date();

        // Apply time offset
        if (this.timeOffset !== 0) {
            now.setHours(now.getHours() + this.timeOffset);
        }

        const hour = now.getHours();
        const minute = now.getMinutes();

        // Determine time period
        let period = 'night';
        let isNight = false;
        let isMorning = false;
        let isAfternoon = false;
        let isEvening = false;

        if (hour >= 22 || hour < 6) {
            isNight = true;
            period = hour >= 22 ? 'late night' : 'early morning';
        } else if (hour >= 6 && hour < 12) {
            isMorning = true;
            period = hour < 9 ? 'early morning' : 'morning';
        } else if (hour >= 12 && hour < 17) {
            isAfternoon = true;
            period = hour < 14 ? 'midday' : 'afternoon';
        } else {
            isEvening = true;
            period = hour < 20 ? 'evening' : 'night';
        }

        // Format time strings
        const timeFormatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        let timeFormatted12h;
        const hour12 = hour % 12 || 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        timeFormatted12h = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;

        // Get day and date info
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
        const dayOfWeekShort = now.toLocaleDateString('en-US', { weekday: 'short' });
        const monthName = now.toLocaleDateString('en-US', { month: 'long' });
        const date = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return {
            hour,
            minute,
            dayOfWeek,
            dayOfWeekShort,
            date,
            monthName,
            day: now.getDate(),
            year: now.getFullYear(),
            isNight,
            isMorning,
            isAfternoon,
            isEvening,
            period,
            timeFormatted,
            timeFormatted12h,
            timestamp: now.getTime()
        };
    }

    /**
     * Get a human-readable description of the current time of day
     * @returns {string}
     */
    getTimeOfDayDescription() {
        const time = this.getCurrentTime();

        if (time.isNight) {
            if (time.hour >= 22) return 'late at night';
            if (time.hour < 3) return 'in the dead of night';
            return 'in the early hours';
        }
        if (time.isMorning) {
            if (time.hour < 8) return 'early in the morning';
            if (time.hour < 10) return 'in the morning';
            return 'late morning';
        }
        if (time.isAfternoon) {
            if (time.hour < 14) return 'around midday';
            if (time.hour < 16) return 'in the afternoon';
            return 'late afternoon';
        }
        if (time.isEvening) {
            if (time.hour < 19) return 'in the early evening';
            if (time.hour < 21) return 'in the evening';
            return 'late evening';
        }

        return 'during the day';
    }

    /**
     * Generate time-aware companion dialogue
     * @param {string} [characterPersonality='friendly'] - Character personality type
     * @returns {string|null}
     */
    getTimeDialogue(characterPersonality = 'friendly') {
        const time = this.getCurrentTime();

        const dialogues = {
            // Very late night (12 AM - 4 AM)
            veryLateNight: [
                "It's really late... Maybe you should get some rest?",
                "Burning the midnight oil, huh? Don't forget to sleep!",
                "The night is so quiet at this hour... Are you okay?",
                "Even night owls need rest eventually!"
            ],
            // Early morning (4 AM - 7 AM)
            earlyMorning: [
                "You're up early! Or... did you stay up all night?",
                "Early bird catches the worm! Good morning!",
                "The world is just waking up. It's peaceful, isn't it?",
                "Rise and shine! Ready to take on the day?"
            ],
            // Morning (7 AM - 9 AM)
            morning: [
                "Good morning! Ready to start the day?",
                "Morning! Hope you slept well!",
                "A fresh new day! What's on the agenda?",
                "Good morning! Don't forget breakfast!"
            ],
            // Mid-morning (9 AM - 12 PM)
            midMorning: [
                "How's your morning going?",
                "Getting things done this morning?",
                "The day is well underway!",
                "Having a productive morning?"
            ],
            // Lunch time (12 PM - 2 PM)
            lunchTime: [
                "It's around lunchtime! Have you eaten?",
                "Midday already! Time flies, doesn't it?",
                "Don't skip lunch! Even a small snack helps.",
                "Taking a lunch break?"
            ],
            // Afternoon (2 PM - 5 PM)
            afternoon: [
                "Afternoon! How's your day been so far?",
                "The afternoon is here! Still going strong?",
                "Mid-afternoon already! Hope your day is going well.",
                "Need an afternoon pick-me-up?"
            ],
            // Early evening (5 PM - 7 PM)
            earlyEvening: [
                "The day is winding down. How was it?",
                "Evening approaches! Time to relax soon.",
                "The sun is getting lower... Beautiful time of day.",
                "Almost done with the day?"
            ],
            // Evening (7 PM - 10 PM)
            evening: [
                "Good evening! Time to unwind?",
                "Evening vibes! What are you up to?",
                "Hope you had a good day!",
                "Settling in for the evening?"
            ],
            // Late night (10 PM - 12 AM)
            lateNight: [
                "Getting late! Don't stay up too long.",
                "Night time... Relaxing or still busy?",
                "The night is here. Winding down?",
                "Late night activities? Just don't forget to rest!"
            ]
        };

        // Determine which category based on hour
        let category = 'afternoon';
        const hour = time.hour;

        if (hour >= 0 && hour < 4) {
            category = 'veryLateNight';
        } else if (hour >= 4 && hour < 7) {
            category = 'earlyMorning';
        } else if (hour >= 7 && hour < 9) {
            category = 'morning';
        } else if (hour >= 9 && hour < 12) {
            category = 'midMorning';
        } else if (hour >= 12 && hour < 14) {
            category = 'lunchTime';
        } else if (hour >= 14 && hour < 17) {
            category = 'afternoon';
        } else if (hour >= 17 && hour < 19) {
            category = 'earlyEvening';
        } else if (hour >= 19 && hour < 22) {
            category = 'evening';
        } else {
            category = 'lateNight';
        }

        const options = dialogues[category];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Check if today is a special occasion
     * @returns {SpecialDate|null}
     */
    checkSpecialDates() {
        const now = new Date();
        if (this.timeOffset !== 0) {
            now.setHours(now.getHours() + this.timeOffset);
        }

        const month = now.getMonth() + 1;
        const day = now.getDate();
        const key = `${month}-${day}`;

        // Check player birthday first
        if (this.playerBirthday && this.playerBirthday === key) {
            return {
                name: "Your Birthday",
                message: "Happy Birthday! Hope you have an amazing day!",
                emoji: '🎂'
            };
        }

        // Check custom dates
        if (this.customDates.has(key)) {
            return this.customDates.get(key);
        }

        // Check predefined special dates
        return SPECIAL_DATES[key] || null;
    }

    /**
     * Get seasonal information
     * @returns {{ season: string, emoji: string, description: string }}
     */
    getSeason() {
        const now = new Date();
        if (this.timeOffset !== 0) {
            now.setHours(now.getHours() + this.timeOffset);
        }

        const month = now.getMonth() + 1;

        // Northern hemisphere seasons
        if (month >= 3 && month <= 5) {
            return {
                season: 'Spring',
                emoji: '🌸',
                description: 'Flowers are blooming and days are getting longer'
            };
        } else if (month >= 6 && month <= 8) {
            return {
                season: 'Summer',
                emoji: '☀️',
                description: 'Warm days and long evenings'
            };
        } else if (month >= 9 && month <= 11) {
            return {
                season: 'Autumn',
                emoji: '🍂',
                description: 'Leaves are changing and the air is crisp'
            };
        } else {
            return {
                season: 'Winter',
                emoji: '❄️',
                description: 'Cold days and long nights'
            };
        }
    }

    /**
     * Get time-based ambient description for immersive context
     * @returns {string}
     */
    getAmbientDescription() {
        const time = this.getCurrentTime();
        const parts = [];

        if (time.isNight) {
            if (time.hour >= 22 || time.hour < 2) {
                parts.push('The world outside is quiet and still');
            } else if (time.hour < 5) {
                parts.push('It is the quietest hour of the night');
            } else {
                parts.push('The first hints of dawn begin to appear');
            }
        } else if (time.isMorning) {
            if (time.hour < 8) {
                parts.push('The morning sun rises, casting long shadows');
            } else if (time.hour < 10) {
                parts.push('Morning light fills the space');
            } else {
                parts.push('The sun climbs higher as morning progresses');
            }
        } else if (time.isAfternoon) {
            if (time.hour < 14) {
                parts.push('The midday sun sits high overhead');
            } else if (time.hour < 16) {
                parts.push('Afternoon sunlight streams through');
            } else {
                parts.push('The afternoon light begins to soften');
            }
        } else if (time.isEvening) {
            if (time.hour < 19) {
                parts.push('Golden hour light bathes everything in warm tones');
            } else if (time.hour < 21) {
                parts.push('Twilight settles in as the sky darkens');
            } else {
                parts.push('Night approaches as the last light fades');
            }
        }

        return parts.join('. ');
    }

    /**
     * Calculate how long until a specific hour
     * @param {number} targetHour - Target hour (0-23)
     * @returns {{ hours: number, minutes: number }}
     */
    getTimeUntil(targetHour) {
        const time = this.getCurrentTime();
        let hoursUntil = targetHour - time.hour;

        if (hoursUntil <= 0) {
            hoursUntil += 24;
        }

        const minutesUntil = 60 - time.minute;
        if (minutesUntil < 60) {
            hoursUntil--;
        }

        return {
            hours: hoursUntil,
            minutes: minutesUntil % 60
        };
    }

    /**
     * Format time for display
     * @param {boolean} [use12Hour=false] - Use 12-hour format
     * @returns {string}
     */
    getFormattedTime(use12Hour = false) {
        const time = this.getCurrentTime();
        return use12Hour ? time.timeFormatted12h : time.timeFormatted;
    }
}

export default TimeService;
