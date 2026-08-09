const ADMIN_COOKIE_NAME = 'analytics_admin_exclude';
const ADMIN_COOKIE_VALUE = 'true';
const COOKIE_EXPIRY_DAYS = 365 * 10; // 10 years

export class AdminExclusion {
  static setAdminExclusion(): void {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);

    document.cookie = `${ADMIN_COOKIE_NAME}=${ADMIN_COOKIE_VALUE}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict; Secure`;

    console.log('[Admin Exclusion] Analytics tracking disabled for this browser');
  }

  static removeAdminExclusion(): void {
    document.cookie = `${ADMIN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

    console.log('[Admin Exclusion] Analytics tracking enabled for this browser');
  }

  static isAdminExcluded(): boolean {
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === ADMIN_COOKIE_NAME && value === ADMIN_COOKIE_VALUE) {
        return true;
      }
    }

    return false;
  }

  static getStatus(): { excluded: boolean; sessionId: string | null } {
    const excluded = this.isAdminExcluded();
    const sessionId = excluded ? null : sessionStorage.getItem('analytics_session_id');

    return { excluded, sessionId };
  }
}
