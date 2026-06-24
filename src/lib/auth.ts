import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import { db } from '@/lib/db'
import { playerProfiles, adminUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId:     process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'discord') return false
      const discordId = profile?.id as string
      if (!discordId) return false
      const username  = (profile?.username as string) ?? user.name ?? 'Unknown'
      const avatarUrl = user.image ?? null
      const email     = (profile?.email as string) ?? user.email ?? null

      // Upsert profile — ne pas bloquer la connexion si la DB est down
      try {
        await db
          .insert(playerProfiles)
          .values({ userId: discordId, username, avatarUrl, email })
          .onConflictDoUpdate({
            target: playerProfiles.userId,
            set: { username, avatarUrl, ...(email ? { email } : {}), updatedAt: new Date().toISOString() },
          })
      } catch (e) {
        console.error('signIn DB error:', e)
      }

      return true
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'discord' && profile) {
        token.discordId = profile.id as string
      }
      // Re-check admin on every token refresh so changes take effect without re-login
      if (token.discordId) {
        const admin = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.discordId, token.discordId as string),
        })
        token.isAdmin = !!admin
      }
      return token
    },
    async session({ session, token }) {
      session.user.id      = token.discordId as string
      session.user.isAdmin = token.isAdmin as boolean
      return session
    },
  },
})
