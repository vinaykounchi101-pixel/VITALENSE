/**
 * Mobile Hardware-Backed Token & Credential Storage.
 *
 * Implements secure token persistence using:
 * - iOS: Apple Keychain (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
 * - Android: Android Keystore encrypted SharedPreferences (AES-256 GCM)
 * via expo-secure-store.
 */

import * as SecureStore from "expo-secure-store";
import { AuthSession } from "../../types";

const KEY_ACCESS_TOKEN = "vitalsense_access_token";
const KEY_REFRESH_TOKEN = "vitalsense_refresh_token";
const KEY_USER_ACCOUNT_ID = "vitalsense_user_account_id";
const KEY_PERSON_ID = "vitalsense_person_id";
const KEY_EXPIRES_AT = "vitalsense_token_expires_at";

export class SecureTokenStorage {
  /**
   * Persists an authenticated session into platform-protected storage.
   */
  static async saveSession(session: AuthSession): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS_TOKEN, session.access_token),
      SecureStore.setItemAsync(KEY_REFRESH_TOKEN, session.refresh_token),
      SecureStore.setItemAsync(KEY_USER_ACCOUNT_ID, session.user_account_id),
      SecureStore.setItemAsync(KEY_PERSON_ID, session.person_id),
      SecureStore.setItemAsync(KEY_EXPIRES_AT, session.expires_at.toString()),
    ]);
  }

  /**
   * Retrieves active session from platform-protected storage.
   */
  static async getSession(): Promise<AuthSession | null> {
    try {
      const [accessToken, refreshToken, userAccountId, personId, expiresAtStr] =
        await Promise.all([
          SecureStore.getItemAsync(KEY_ACCESS_TOKEN),
          SecureStore.getItemAsync(KEY_REFRESH_TOKEN),
          SecureStore.getItemAsync(KEY_USER_ACCOUNT_ID),
          SecureStore.getItemAsync(KEY_PERSON_ID),
          SecureStore.getItemAsync(KEY_EXPIRES_AT),
        ]);

      if (!accessToken || !refreshToken || !userAccountId || !personId) {
        return null;
      }

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user_account_id: userAccountId,
        person_id: personId,
        expires_at: expiresAtStr ? parseInt(expiresAtStr, 10) : 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Securely clears all tokens upon logout or account switching.
   */
  static async clearSession(): Promise<void> {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEY_USER_ACCOUNT_ID),
      SecureStore.deleteItemAsync(KEY_PERSON_ID),
      SecureStore.deleteItemAsync(KEY_EXPIRES_AT),
    ]);
  }
}
