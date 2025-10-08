//store/SupabaseAuth.ts

import { supabase } from "./supabaseClient";

export const SupabaseAuth = {
  /** ✅ User Login with Email */
  async signInWithEmail(email: string, password: string) {
    try {
      console.log("🔑 Attempting email login...");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error("❌ Login failed:", error.message);
        return null;
      }

      if (data?.session) {
        localStorage.setItem("supabaseSession", JSON.stringify(data.session));
        console.log("✅ Login successful. Session stored.");
      }

      return data?.user ?? null;
    } catch (err) {
      console.error("❌ Unexpected login error:", err);
      return null;
    }
  },

  /** ✅ Refresh Supabase Session */
  async refreshSession() {
    try {
      console.log("🔄 Refreshing Supabase session...");
      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        console.warn("⚠️ Session expired or unavailable. Logging out...");
        await this.signOut();
        return null;
      }

      console.log("✅ Session refreshed successfully.");
      return data.session;
    } catch (err) {
      console.error("❌ Error refreshing session:", err);
      return null;
    }
  },

  /** ✅ User Logout */
  async signOut() {
    try {
      console.log("🚪 Logging out user...");
      await supabase.auth.signOut();
      localStorage.removeItem("supabaseSession");
      console.log("✅ User logged out successfully.");
    } catch (err) {
      console.error("❌ Error logging out:", err);
    }
  },

  /** ✅ Fetch the Currently Logged-in User */
  async getUser() {
    try {
      console.log("👤 Fetching authenticated user...");
      const session = await this.refreshSession();
      if (!session) {
        console.warn("⚠️ No active session. Returning null.");
        return null;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("❌ Error fetching user:", error.message);
        return null;
      }

      console.log("✅ User fetched successfully.");
      return data?.user ?? null;
    } catch (err) {
      console.error("❌ Unexpected error fetching user:", err);
      return null;
    }
  },
};
