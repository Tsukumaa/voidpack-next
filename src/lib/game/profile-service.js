import { getSupabaseClient } from "../core/supabase.js";

const EMPTY_PROFILE = Object.freeze({
  level: 1,
  xp: 0,
  packsOpened: 0,
  highestRarity: null,
  voidPulls: 0,
  currentStreak: 0,
  bestStreak: 0
});

function normalizeProfile(row = {}) {
  return Object.freeze({
    userId: row.user_id || null,
    username: row.username || "Unknown",
    avatarUrl: row.avatar_url || null,

    level: Number(row.level) || 1,
    xp: Number(row.xp) || 0,

    packsOpened: Number(row.packs_opened) || 0,
    highestRarity: row.highest_rarity || null,
    voidPulls: Number(row.void_pulls) || 0,

    currentStreak: Number(row.current_streak) || 0,
    bestStreak: Number(row.best_streak) || 0,
    twitchId:    row.twitch_id    ?? null,
    twitchLogin: row.twitch_login ?? null,
  });
}

function createGuestProfileResult(source = "guest") {
  return Object.freeze({
    profile: EMPTY_PROFILE,
    source
  });
}

export async function getOrCreatePlayerProfile(user) {
  if (!user?.id) {
    return createGuestProfileResult("guest");
  }

  let client = null;

  try {
    client = await getSupabaseClient();
  } catch (error) {
    console.warn("[VOID Pack] Supabase client unavailable for player profile.", error);
    return createGuestProfileResult("no_supabase_client");
  }

  if (!client?.from) {
    return createGuestProfileResult("no_supabase_client");
  }

  try {
    const existingQuery = await client
      .from("player_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingQuery.error) {
      console.warn("[VOID Pack] Failed to load player profile.", existingQuery.error);
      return createGuestProfileResult("load_failed");
    }

    if (existingQuery.data) {
      return Object.freeze({
        profile: normalizeProfile(existingQuery.data),
        source: "database"
      });
    }

    const insertPayload = Object.freeze({
      user_id: user.id,
      username:
        user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.email
        || "Unknown",
      avatar_url:
        user.user_metadata?.avatar_url
        || null
    });

    const insertQuery = await client
      .from("player_profiles")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertQuery.error) {
      console.warn("[VOID Pack] Failed to create player profile.", insertQuery.error);
      return createGuestProfileResult("create_failed");
    }

    return Object.freeze({
      profile: normalizeProfile(insertQuery.data),
      source: "created"
    });
  } catch (error) {
    console.warn("[VOID Pack] Persistent profile hard fallback.", error);
    return createGuestProfileResult("exception");
  }
}

export async function updatePlayerProfile(userId, patch = {}) {
  if (!userId) {
    return Object.freeze({
      updated: false,
      reason: "MISSING_USER_ID"
    });
  }

  let client = null;

  try {
    client = await getSupabaseClient();
  } catch (error) {
    console.warn("[VOID Pack] Supabase client unavailable for profile update.", error);

    return Object.freeze({
      updated: false,
      reason: "NO_SUPABASE_CLIENT"
    });
  }

  if (!client?.from) {
    return Object.freeze({
      updated: false,
      reason: "NO_SUPABASE_CLIENT"
    });
  }

  try {
    const query = await client
      .from("player_profiles")
      .update({
        ...patch,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (query.error) {
      console.warn("[VOID Pack] Failed to update player profile.", query.error);

      return Object.freeze({
        updated: false,
        reason: "UPDATE_FAILED"
      });
    }

    return Object.freeze({
      updated: true,
      profile: normalizeProfile(query.data)
    });
  } catch (error) {
    console.warn("[VOID Pack] Failed to update player profile.", error);

    return Object.freeze({
      updated: false,
      reason: "UPDATE_EXCEPTION"
    });
  }
}
