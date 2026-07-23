function toMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
function normalizePeriod(period) {
    if (period.isClosed && period.is24Hours) {
        throw new Error('Business hour cannot be closed and 24 hours at the same time');
    }
    if (period.isClosed) {
        return {
            ...period,
            opensAt: '00:00',
            closesAt: '00:00'
        };
    }
    if (period.is24Hours) {
        return {
            ...period,
            opensAt: '00:00',
            closesAt: '23:59'
        };
    }
    if (!period.opensAt || !period.closesAt) {
        throw new Error('opensAt and closesAt are required for regular business hours');
    }
    if (toMinutes(period.opensAt) >= toMinutes(period.closesAt)) {
        throw new Error('opensAt must be before closesAt');
    }
    return period;
}
export function normalizeAndValidateBusinessHours(hours) {
    const normalized = hours.map(normalizePeriod);
    const grouped = new Map();
    for (const period of normalized) {
        const periods = grouped.get(period.dayOfWeek) ?? [];
        if (periods.some(existing => existing.periodIndex === period.periodIndex)) {
            throw new Error('Duplicated periodIndex for the same day');
        }
        periods.push(period);
        grouped.set(period.dayOfWeek, periods);
    }
    for (const periods of grouped.values()) {
        const fullDayPeriods = periods.filter(period => period.isClosed || period.is24Hours);
        if (fullDayPeriods.length > 0 && periods.length > 1) {
            throw new Error('Closed or 24 hours days cannot have multiple periods');
        }
        const regularPeriods = periods
            .filter(period => !period.isClosed && !period.is24Hours)
            .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt));
        for (let index = 1; index < regularPeriods.length; index++) {
            const previous = regularPeriods[index - 1];
            const current = regularPeriods[index];
            if (toMinutes(current.opensAt) < toMinutes(previous.closesAt)) {
                throw new Error('Business hour periods cannot overlap');
            }
        }
    }
    return normalized;
}
export function normalizeAndValidateBusinessHourException(exception) {
    const isClosed = exception.isClosed ?? false;
    const is24Hours = exception.is24Hours ?? false;
    if (isClosed && is24Hours) {
        throw new Error('Business hour exception cannot be closed and 24 hours at the same time');
    }
    if (isClosed) {
        return {
            opensAt: null,
            closesAt: null
        };
    }
    if (is24Hours) {
        return {
            opensAt: null,
            closesAt: null
        };
    }
    if (!exception.opensAt || !exception.closesAt) {
        throw new Error('opensAt and closesAt are required for regular exceptions');
    }
    if (toMinutes(exception.opensAt) >= toMinutes(exception.closesAt)) {
        throw new Error('opensAt must be before closesAt');
    }
    return {
        opensAt: exception.opensAt,
        closesAt: exception.closesAt
    };
}
