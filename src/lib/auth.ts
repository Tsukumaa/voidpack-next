import NextAuth from 'next-auth'
import Twitch from 'next-auth/providers/twitch'
import { db } from '@/lib/db'
import { playerProfiles, adminUsers, boosterCredits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Twitch({
      clientId:     process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'twitch') return false
      // Twitch OIDC : profile.sub = id Twitch, preferred_username = login
      const twitchId = (profile?.sub as string) ?? user.id
      if (!twitchId) return false
      const login     = (profile?.preferred_username as string) ?? user.name ?? 'Unknown'
      const avatarUrl = (profile?.picture as string) ?? user.image ?? null
      const email     = (profile?.email as string) ?? user.email ?? null

      // Upsert profile — le user_id EST l'id Twitch (twitch_id rempli pour le matching points)
      try {
        const existing = await db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, discordId) })

        await db
          .insert(playerProfiles)
          .values({ userId: twitchId, username: login, avatarUrl, email, twitchId, twitchLogin: login })
          .onConflictDoUpdate({
            target: playerProfiles.userId,
            set: {
              username: login, avatarUrl, twitchId, twitchLogin: login,
              ...(email ? { email } : {}),
              updatedAt: new Date().toISOString(),
            },
          })

        // Booster de bienvenue à la première connexion
        if (!existing) {
          await db.insert(boosterCredits).values({
            userId:      discordId,
            boosterType: 'void',
            source:      'welcome',
            sourceRef:   `welcome_${discordId}`,
          }).onConflictDoNothing()
        }
      } catch (e) {
        console.error('signIn DB error:', e)
      }

      return true
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'twitch' && profile) {
        token.uid = profile.sub as string
      }
      // Re-check admin on every token refresh so changes take effect without re-login
      if (token.uid) {
        const admin = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.discordId, token.uid as string),
        })
        token.isAdmin = !!admin
      }
      return token
    },
    async session({ session, token }) {
      session.user.id      = token.uid as string
      session.user.isAdmin = token.isAdmin as boolean
      return session
    },
  },
})
