import type { ForumState } from '../types'
import { uid } from '../lib/utils'

const now = Date.now()
const days = (n: number) => new Date(now - n * 86400000).toISOString()

const modId = 'user_moderator'
const adminId = 'user_admin'
const aliceId = 'user_alice'
const bobId = 'user_bob'
const caraId = 'user_cara'

export function createSeedState(): ForumState {
  const categories = [
    {
      id: 'forum_general',
      name: 'General Discussion',
      description: 'Talk about casino games, strategies, and community news.',
      threadCount: 0,
      postCount: 0,
    },
    {
      id: 'forum_slots',
      name: 'Slots & Jackpots',
      description: 'Share slot reviews, big wins, and RTP talk.',
      threadCount: 0,
      postCount: 0,
    },
    {
      id: 'forum_table',
      name: 'Table Games',
      description: 'Blackjack, roulette, poker, and more.',
      threadCount: 0,
      postCount: 0,
    },
    {
      id: 'forum_promo',
      name: 'Promotions & Bonuses',
      description: 'Deals, free spins, and loyalty tips.',
      threadCount: 0,
      postCount: 0,
    },
    {
      id: 'forum_support',
      name: 'Help & Support',
      description: 'Account help, site feedback, and reporting issues.',
      threadCount: 0,
      postCount: 0,
    },
  ]

  const users = [
    {
      id: adminId,
      username: 'admin',
      email: 'admin@mcw.forum',
      password: 'admin123',
      displayName: 'Forum Admin',
      bio: 'Keeping the community fair and fun.',
      avatar: '',
      role: 'admin' as const,
      banned: false,
      createdAt: days(900),
    },
    {
      id: modId,
      username: 'moderator',
      email: 'mod@mcw.forum',
      password: 'moderator123',
      displayName: 'MCW Mod',
      bio: 'Moderator — report spam and toxic posts.',
      avatar: '',
      role: 'moderator' as const,
      banned: false,
      createdAt: days(700),
    },
    {
      id: aliceId,
      username: 'alicewins',
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice Wins',
      bio: 'Slots enthusiast. Sharing tips and wins.',
      avatar: '',
      role: 'user' as const,
      banned: false,
      createdAt: days(120),
    },
    {
      id: bobId,
      username: 'bobdealer',
      email: 'bob@example.com',
      password: 'password123',
      displayName: 'Bob Dealer',
      bio: 'Table games forever.',
      avatar: '',
      role: 'user' as const,
      banned: false,
      createdAt: days(80),
    },
    {
      id: caraId,
      username: 'caraspins',
      email: 'cara@example.com',
      password: 'password123',
      displayName: 'Cara Spins',
      bio: 'New here — love bonuses and free spins.',
      avatar: '',
      role: 'user' as const,
      banned: false,
      createdAt: days(20),
    },
  ]

  const threads = [
    {
      id: 'thread_1',
      forumId: 'forum_slots',
      authorId: aliceId,
      title: 'Best high RTP slots right now?',
      content:
        'Looking for recommendations with solid RTP and fun bonus rounds. What are you spinning this week?',
      mediaUrl: null,
      mediaType: null,
      createdAt: days(2),
      updatedAt: days(1),
      views: 128,
    },
    {
      id: 'thread_2',
      forumId: 'forum_table',
      authorId: bobId,
      title: 'Blackjack basic strategy chart discussion',
      content:
        'Do you stick strictly to basic strategy or adjust based on table vibes? Let’s compare notes.',
      mediaUrl: null,
      mediaType: null,
      createdAt: days(3),
      updatedAt: days(2),
      views: 96,
    },
    {
      id: 'thread_3',
      forumId: 'forum_promo',
      authorId: caraId,
      title: 'Welcome bonus worth it after wagering?',
      content:
        'Has anyone calculated whether the current welcome package is actually profitable after playthrough?',
      mediaUrl: null,
      mediaType: null,
      createdAt: days(1),
      updatedAt: days(1),
      views: 74,
    },
    {
      id: 'thread_4',
      forumId: 'forum_general',
      authorId: modId,
      title: 'Forum rules & how to report content',
      content:
        'Be respectful. No spam. No scams. Use the Report button on posts/comments. Moderators will review quickly.',
      mediaUrl: null,
      mediaType: null,
      createdAt: days(30),
      updatedAt: days(5),
      views: 412,
    },
    {
      id: 'thread_5',
      forumId: 'forum_slots',
      authorId: aliceId,
      title: 'Hit a nice bonus round last night',
      content: 'Shared for the vibes — celebrate the small wins too!',
      mediaUrl: null,
      mediaType: null,
      createdAt: days(0.4),
      updatedAt: days(0.4),
      views: 51,
    },
  ]

  const comments = [
    {
      id: 'comment_1',
      threadId: 'thread_1',
      authorId: bobId,
      parentId: null,
      content: 'I’ve been enjoying medium-volatility titles lately. Better bankroll control.',
      createdAt: days(1.5),
    },
    {
      id: 'comment_2',
      threadId: 'thread_1',
      authorId: caraId,
      parentId: 'comment_1',
      content: 'Same! Any favorites under 1 credit lines?',
      createdAt: days(1.2),
    },
    {
      id: 'comment_3',
      threadId: 'thread_3',
      authorId: aliceId,
      parentId: null,
      content: 'Always check max bet caps during wagering. That kills a lot of offers.',
      createdAt: days(0.8),
    },
    {
      id: 'comment_4',
      threadId: 'thread_2',
      authorId: aliceId,
      parentId: null,
      content: 'Basic strategy is the baseline. Deviations only if you’re counting.',
      createdAt: days(2.5),
    },
  ]

  const likes = [
    { id: uid('like'), userId: bobId, targetType: 'thread' as const, targetId: 'thread_1' },
    { id: uid('like'), userId: caraId, targetType: 'thread' as const, targetId: 'thread_1' },
    { id: uid('like'), userId: aliceId, targetType: 'comment' as const, targetId: 'comment_1' },
  ]

  const follows = [
    { id: uid('follow'), followerId: bobId, followingId: aliceId },
    { id: uid('follow'), followerId: caraId, followingId: aliceId },
    { id: uid('follow'), followerId: aliceId, followingId: bobId },
  ]

  const notifications = [
    {
      id: uid('notif'),
      userId: aliceId,
      type: 'follow' as const,
      message: 'bobdealer started following you',
      link: '/profile/bobdealer',
      read: false,
      createdAt: days(1),
    },
    {
      id: uid('notif'),
      userId: aliceId,
      type: 'like' as const,
      message: 'caraspins liked your thread',
      link: '/thread/thread_1',
      read: false,
      createdAt: days(0.5),
    },
  ]

  const withCounts = categories.map((c) => {
    const catThreads = threads.filter((t) => t.forumId === c.id)
    const postCount =
      catThreads.length + comments.filter((cm) => catThreads.some((t) => t.id === cm.threadId)).length
    return { ...c, threadCount: catThreads.length, postCount }
  })

  return {
    users,
    categories: withCounts,
    threads,
    comments,
    likes,
    follows,
    notifications,
    reports: [],
    currentUserId: null,
    darkMode: false,
  }
}
