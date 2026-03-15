export function formatDuration(ms: number) {
    const totalMins = Math.floor(ms / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${h}ч ${m}м`
}

export function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year: number, month: number) {
    let day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
}
