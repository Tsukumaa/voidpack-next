import NextAuth from 'next-auth'
import Twitch from 'next-auth/providers/twitch'
import { db } from '@/lib/db'
import { playerProfiles, adminUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/twitch/api'

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

      // Source fiable : API Helix avec le token d'accès (l'OIDC Twitch ne renvoie
      // pas toujours pseudo/avatar). Fallback sur les claims OIDC si Helix échoue.
      let twitchId  = profile?.sub as string | undefined
      let login     = profile?.preferred_username as string | undefined
      let avatarUrl = profile?.picture as string | undefined
      let email     = profile?.email as string | undefined

      if (account.access_token) {
        try {
          const tu = await getAuthedUser(account.access_token)
          if (tu) {
            twitchId  = tu.id ?? twitchId
            login     = tu.display_name ?? tu.login ?? login
            avatarUrl = tu.profile_image_url ?? avatarUrl
            email     = tu.email ?? email
          }
        } catch (e) {
          console.error('Helix getAuthedUser error:', e)
        }
      }

      twitchId = twitchId ?? (user.id as string)
      if (!twitchId) return false
      const username = login ?? user.name ?? 'Joueur'

      try {
        await db
          .insert(playerProfiles)
          .values({ userId: twitchId, username, avatarUrl: avatarUrl ?? null, email: email ?? null, twitchId, twitchLogin: login ?? username })
          .onConflictDoUpdate({
            target: playerProfiles.userId,
            set: {
              username, avatarUrl: avatarUrl ?? null, twitchId, twitchLogin: login ?? username,
              ...(email ? { email } : {}),
              updatedAt: new Date().toISOString(),
            },
          })
      } catch (e) {
        console.error('signIn DB error:', e)
      }

      return true
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'twitch') {
        // profile.sub = id Twitch ; sinon token.sub (= user.id) déjà posé par NextAuth
        token.uid = (profile?.sub as string) ?? (token.sub as string)
      }
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
