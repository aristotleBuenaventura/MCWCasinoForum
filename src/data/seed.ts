import type { Ad, CmsItem, ForumCategory, ForumState, GameProvider, Thread } from '../types'
import { uid } from '../lib/utils'

const now = Date.now()
const days = (n: number) => new Date(now - n * 86400000).toISOString()

const modId = 'user_moderator'
const adminId = 'user_admin'
const aliceId = 'user_alice'
const bobId = 'user_bob'
const caraId = 'user_cara'

function cat(
  id: string,
  slug: string,
  name: string,
  description: string,
  parentId: string | null,
  order: number,
  featured = false,
): ForumCategory {
  return { id, slug, name, description, parentId, featured, order, threadCount: 0, postCount: 0 }
}

function thread(
  id: string,
  forumId: string,
  authorId: string,
  title: string,
  content: string,
  created: number,
  extra?: Partial<Thread>,
): Thread {
  return {
    id,
    forumId,
    authorId,
    title,
    content,
    mediaUrl: extra?.mediaUrl ?? null,
    mediaType: extra?.mediaType ?? null,
    pinned: extra?.pinned ?? false,
    createdAt: days(created),
    updatedAt: days(created),
    views: extra?.views ?? Math.floor(40 + Math.random() * 200),
  }
}

export function createSeedState(): ForumState {
  const categories: ForumCategory[] = [
    cat('cat_slots', 'slot-games', 'Slot Games', 'Discuss slots, bonuses, and volatility.', null, 1, true),
    cat('cat_providers', 'game-providers', 'Game Providers', 'Studios and their game catalogs.', null, 2, true),
    cat('cat_jili', 'jili', 'JILI', 'JILI titles, RTP talk, and strategies.', 'cat_providers', 1),
    cat('cat_pgsoft', 'pg-soft', 'PG Soft', 'PG Soft slots and community reviews.', 'cat_providers', 2),
    cat('cat_pragmatic', 'pragmatic-play', 'Pragmatic Play', 'Gates of Olympus, Sweet Bonanza, and more.', 'cat_providers', 3),
    cat('cat_reviews', 'casino-reviews', 'Casino Reviews', 'Player reviews of casinos and platforms.', 'cat_providers', 4),
    cat('cat_bonuses', 'bonuses', 'Bonuses', 'Welcome offers, wagering, and promo math.', null, 3, true),
    cat('cat_rtp', 'rtp-volatility', 'RTP & Volatility', 'How RTP and variance affect your bankroll.', null, 4),
    cat('cat_responsible', 'responsible-gambling', 'Responsible Gambling', 'Limits, tools, and staying in control.', null, 5),
    cat('cat_bigwins', 'big-wins', 'Big Wins', 'Share screenshots and verified hit stories.', null, 6),
    cat('cat_guides', 'guides', 'Guides & Resources', 'How-tos for RTP, wagering, and bankroll.', null, 7, true),
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

  const threads: Thread[] = [
    thread(
      'thread_mahjong',
      'cat_pgsoft',
      aliceId,
      'My go-to “Mahjong Ways” strategy — what RTP are you guys actually getting lately?',
      'Posting my usual bet sizing and bonus-buy notes. Curious what RTP others are seeing on Mahjong Ways this month.',
      0.3,
      { pinned: true, views: 312 },
    ),
    thread(
      'thread_cashout',
      'cat_reviews',
      bobId,
      'Reviewed my cashout experience at CasinoX — verified withdrawal in 4 hours.',
      'Submitted KYC once, then the payout hit in about four hours. Sharing the full timeline so others know what to expect.',
      0.8,
      { views: 188 },
    ),
    thread(
      'thread_olympus',
      'cat_pragmatic',
      caraId,
      'Best strategy for Gates of Olympus?',
      'Do you play base game only or bonus buy when the balance allows? Drop your sample sizes.',
      1.2,
      { views: 245 },
    ),
    thread(
      'thread_spin_palace',
      'cat_reviews',
      aliceId,
      'Spin Palace review — 4.8/5 after two months',
      'Fast cashouts, decent table limits, and a usable VIP path. Biggest knock is the wagering on some reloads.',
      2,
      { views: 410 },
    ),
    thread(
      'thread_casino_royale',
      'cat_reviews',
      bobId,
      'Casino Royale review — 4.8/5 for live tables',
      'Live blackjack was the reason I stayed. Slots catalog is average but support was solid.',
      2.4,
      { views: 276 },
    ),
    thread(
      'thread_mega_jackpot',
      'cat_reviews',
      caraId,
      'Mega Jackpot review — 4.8/5 if you chase progressives',
      'Network jackpots are the draw. I treat it as entertainment spend, not a plan.',
      3,
      { views: 198 },
    ),
    thread(
      'thread_rtp_guide',
      'cat_guides',
      modId,
      'How to Calculate RTP & Volatility',
      'A practical walkthrough of published RTP vs session variance, and how to read volatility labels.',
      5,
      { views: 520 },
    ),
    thread(
      'thread_wagering',
      'cat_guides',
      aliceId,
      'Casino Bonuses: What Are Wagering Requirements?',
      'Playthrough, game weighting, max bet rules — the three things that decide if a bonus is worth it.',
      6,
      { views: 388 },
    ),
    thread(
      'thread_bankroll',
      'cat_guides',
      bobId,
      'Responsible Bankroll Management',
      'Set a session cap, a monthly cap, and a stop-loss before you load the wallet.',
      7,
      { views: 301 },
    ),
    thread(
      'thread_bonus_welcome',
      'cat_bonuses',
      caraId,
      'Welcome bonus worth it after wagering?',
      'Ran the numbers on a 100% match with 35x. Sharing the spreadsheet logic.',
      1,
      { views: 167 },
    ),
    thread(
      'thread_jili_hot',
      'cat_jili',
      aliceId,
      'Which JILI titles are actually hitting this week?',
      'Looking for mid-volatility picks that still have a decent bonus round.',
      0.5,
      { views: 142 },
    ),
    thread(
      'thread_win_olympus',
      'cat_bigwins',
      aliceId,
      'Gates of Olympus — 2,546x MAX WIN',
      'Screenshot attached from last night’s session. Not advice, just the hit.',
      0.2,
      { views: 640 },
    ),
    thread(
      'thread_win_mahjong',
      'cat_bigwins',
      bobId,
      'Mahjong Ways — Hit 56x Bold Multiplier',
      'Stacked symbols finally lined up. Sharing the setup I used.',
      0.6,
      { views: 233 },
    ),
    thread(
      'thread_win_ace',
      'cat_bigwins',
      caraId,
      'Super Ace — Wild Jacket hit',
      'Short session, lucky timing. Always cash a piece back to the bank.',
      1.1,
      { views: 154 },
    ),
    thread(
      'thread_rules',
      'cat_responsible',
      modId,
      'Forum rules & how to report content',
      'Be respectful. No spam. No scams. Use Report on posts. Moderators review quickly.',
      20,
      { pinned: true, views: 890 },
    ),
  ]

  const comments = [
    {
      id: 'comment_1',
      threadId: 'thread_mahjong',
      authorId: bobId,
      parentId: null,
      content: 'I’ve been seeing more dry stretches on higher stakes. Base game feels tighter this week.',
      createdAt: days(0.2),
    },
    {
      id: 'comment_2',
      threadId: 'thread_mahjong',
      authorId: caraId,
      parentId: 'comment_1',
      content: 'Same. I dropped stake size and the bonus frequency felt more normal.',
      createdAt: days(0.15),
    },
    {
      id: 'comment_3',
      threadId: 'thread_cashout',
      authorId: aliceId,
      parentId: null,
      content: 'Four hours is fast. Which method did you use?',
      createdAt: days(0.7),
    },
    {
      id: 'comment_4',
      threadId: 'thread_olympus',
      authorId: aliceId,
      parentId: null,
      content: 'I never bonus-buy unless I’m already up for the session.',
      createdAt: days(1),
    },
    {
      id: 'comment_5',
      threadId: 'thread_win_olympus',
      authorId: caraId,
      parentId: null,
      content: 'Insane multiplier. Congrats.',
      createdAt: days(0.1),
    },
  ]

  const likes = [
    { id: uid('like'), userId: bobId, targetType: 'thread' as const, targetId: 'thread_mahjong' },
    { id: uid('like'), userId: caraId, targetType: 'thread' as const, targetId: 'thread_mahjong' },
    { id: uid('like'), userId: aliceId, targetType: 'thread' as const, targetId: 'thread_cashout' },
    { id: uid('like'), userId: bobId, targetType: 'thread' as const, targetId: 'thread_win_olympus' },
    { id: uid('like'), userId: caraId, targetType: 'thread' as const, targetId: 'thread_win_olympus' },
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
      link: '/thread/thread_mahjong',
      read: false,
      createdAt: days(0.5),
    },
  ]

  const ads: Ad[] = [
    { id: 'ad_l1a', slot: 'left-1', imageUrl: '', url: 'https://example.com/pragmatic', title: 'Pragmatic Play challenge', order: 1 },
    { id: 'ad_l1b', slot: 'left-1', imageUrl: '', url: 'https://example.com/jili', title: 'JILI weekly race', order: 2 },
    { id: 'ad_l2', slot: 'left-2', imageUrl: '', url: 'https://example.com/offer', title: 'Recommended online casinos', order: 1 },
    { id: 'ad_l3', slot: 'left-3', imageUrl: '', url: 'https://example.com/welcome', title: '100% welcome bonus', order: 1 },
    { id: 'ad_r1', slot: 'right-1', imageUrl: '', url: 'https://example.com/promos', title: 'Exclusive bonuses & promos', order: 1 },
  ]

  const trendingGames: CmsItem[] = [
    { id: 'tg_1', title: 'Gates of Olympus', subtitle: 'Pragmatic Play', imageUrl: '', url: '/communities/pragmatic-play', order: 1 },
    { id: 'tg_2', title: 'Mahjong Ways', subtitle: 'PG Soft', imageUrl: '', url: '/communities/pg-soft', order: 2 },
    { id: 'tg_3', title: 'Super Ace', subtitle: 'JILI', imageUrl: '', url: '/communities/jili', order: 3 },
  ]

  const providers: GameProvider[] = [
    { id: 'prov_pg', name: 'PG Soft', imageUrl: '', url: '/communities/pg-soft', rating: 4.8, order: 1 },
    { id: 'prov_jili', name: 'JILI Games', imageUrl: '', url: '/communities/jili', rating: 4.6, order: 2 },
    { id: 'prov_pp', name: 'Pragmatic Play', imageUrl: '', url: '/communities/pragmatic-play', rating: 4.7, order: 3 },
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
    ads,
    adRotateSec: 5,
    trendingGames,
    providers,
    currentUserId: null,
  }
}
