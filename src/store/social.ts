import { create } from 'zustand'

export interface ChatFriend {
  friend_id: string
  username: string | null
  avatar_url: string | null
}

export interface Toast {
  id: string
  type: 'friend_request' | 'mission' | 'streak' | 'info'
  title: string
  body?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

interface SocialStore {
  pendingFriendCount: number
  unreadMessageCount: number
  unreadBySender: Record<string, number>
  pendingTradeCount: number
  chatFriend: ChatFriend | null
  chatPanelOpen: boolean
  toasts: Toast[]

  setPendingFriendCount: (n: number) => void
  setUnreadMessageCount: (n: number) => void
  setUnreadBySender: (m: Record<string, number>) => void
  clearUnreadMessages: () => void
  setPendingTradeCount: (n: number) => void
  setChatFriend: (f: ChatFriend | null) => void
  setChatPanelOpen: (open: boolean) => void
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useSocialStore = create<SocialStore>((set) => ({
  pendingFriendCount: 0,
  unreadMessageCount: 0,
  unreadBySender: {},
  pendingTradeCount: 0,
  chatFriend: null,
  chatPanelOpen: false,
  toasts: [],

  setPendingFriendCount: (n) => set({ pendingFriendCount: n }),
  setUnreadMessageCount: (n) => set({ unreadMessageCount: n }),
  setUnreadBySender: (m) => set({ unreadBySender: m }),
  clearUnreadMessages: () => set({ unreadMessageCount: 0, unreadBySender: {} }),
  setPendingTradeCount: (n) => set({ pendingTradeCount: n }),
  setChatFriend: (f) => set(s => ({ chatFriend: f, chatPanelOpen: f !== null ? true : s.chatPanelOpen })),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open, ...(open ? {} : { chatFriend: null }) }),
  addToast: (t) => set(s => ({
    toasts: [...s.toasts, { ...t, id: `${Date.now()}_${Math.random()}` }],
  })),
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
