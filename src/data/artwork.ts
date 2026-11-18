export const ART = {
  hero: '/assets/mcw-logo.png',
  bannerPragmatic: '/assets/banner-pragmatic.jpg',
  bannerRecommended: '/assets/banner-recommended.jpg',
  bannerWelcome: '/assets/banner-welcome.jpg',
  bannerExclusive: '/assets/banner-exclusive.jpg',
  olympus: '/assets/game-olympus.jpg',
  mahjong: '/assets/game-mahjong.jpg',
  superAce: '/assets/game-superace.jpg',
  spinPalace: '/assets/casino-spin.jpg',
  casinoRoyale: '/assets/casino-royale.jpg',
  megaJackpot: '/assets/casino-jackpot.jpg',
  logoJili: '/assets/logo-jili.svg',
  logoPg: '/assets/logo-pg.svg',
  logoPragmatic: '/assets/logo-pragmatic.svg',
  logoBonus: '/assets/logo-bonus.svg',
  guideRtp: '/assets/guide-rtp.svg',
  guideWager: '/assets/guide-wager.svg',
  guideBankroll: '/assets/guide-bankroll.svg',
} as const

export const SLOT_ART: Record<string, string> = {
  'left-1': ART.bannerPragmatic,
  'left-2': ART.bannerRecommended,
  'left-3': ART.bannerWelcome,
  'right-1': ART.bannerExclusive,
  thread: ART.bannerExclusive,
}

export const REVIEW_ART: Record<string, string> = {
  thread_spin_palace: ART.spinPalace,
  thread_casino_royale: ART.casinoRoyale,
  thread_mega_jackpot: ART.megaJackpot,
  thread_cashout: ART.casinoRoyale,
}

export const WIN_ART: Record<string, string> = {
  thread_win_olympus: ART.olympus,
  thread_win_mahjong: ART.mahjong,
  thread_win_ace: ART.superAce,
}

export const GUIDE_ART: Record<string, string> = {
  thread_rtp_guide: ART.guideRtp,
  thread_wagering: ART.guideWager,
  thread_bankroll: ART.guideBankroll,
}
