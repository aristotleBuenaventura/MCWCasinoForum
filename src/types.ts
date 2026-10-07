export type Role = 'user' | 'moderator' | 'admin'

export type MediaType = 'image' | 'video' | null

export interface User {
  id: string
  username: string
  email: string
  password: string
  displayName: string
  bio: string
  avatar: string
  role: Role
  banned: boolean
  createdAt: string
}

export interface ForumCategory {
  id: string
  name: string
  description: string
  threadCount: number
  postCount: number
}

export interface Thread {
  id: string
  forumId: string
  authorId: string
  title: string
  content: string
  mediaUrl: string | null
  mediaType: MediaType
  createdAt: string
  updatedAt: string
  views: number
}

export interface Comment {
  id: string
  threadId: string
  authorId: string
  parentId: string | null
  content: string
  createdAt: string
}

export interface Like {
  id: string
  userId: string
  targetType: 'thread' | 'comment'
  targetId: string
}

export interface Follow {
  id: string
  followerId: string
  followingId: string
}

export interface Notification {
  id: string
  userId: string
  type: 'like' | 'reply' | 'follow' | 'mention' | 'mod'
  message: string
  link: string
  read: boolean
  createdAt: string
}

export interface Report {
  id: string
  reporterId: string
  targetType: 'thread' | 'comment' | 'user'
  targetId: string
  reason: string
  status: 'open' | 'resolved'
  createdAt: string
}

export interface ForumState {
  users: User[]
  categories: ForumCategory[]
  threads: Thread[]
  comments: Comment[]
  likes: Like[]
  follows: Follow[]
  notifications: Notification[]
  reports: Report[]
  currentUserId: string | null
  darkMode: boolean
}
