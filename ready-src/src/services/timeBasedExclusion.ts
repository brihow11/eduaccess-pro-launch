export class TimeBasedExclusion {
  static isWithinExclusionWindow(): boolean {
    const now = new Date();

    // Convert to Central Time (UTC-6 or UTC-5 depending on DST)
    const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    const hours = centralTime.getHours();
    const minutes = centralTime.getMinutes();

    // Check if between 11:45pm (23:45) and 1:00am (01:00)
    // This handles the midnight boundary
    const isAfter2345 = (hours === 23 && minutes >= 45) || hours === 0 || (hours === 1 && minutes === 0);

    if (isAfter2345) {
      const timeString = centralTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Chicago',
        hour12: true
      });
      console.log(`[Time Exclusion] Current Central Time: ${timeString} - Analytics disabled`);
      return true;
    }

    return false;
  }

  static getExclusionWindowInfo(): string {
    return '11:45 PM - 1:00 AM Central Time';
  }
}
