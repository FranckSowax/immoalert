export interface Listing {
  id: string
  title?: string
  location?: string
  price?: number
  isValid: boolean
  _count?: {
    matches?: number
  }
  createdAt?: string
  updatedAt?: string
}

export interface User {
  id: string
  phoneNumber: string
  name?: string
  status: 'active' | 'inactive' | 'suspended'
  criteria?: {
    minPrice?: number
    maxPrice?: number
    location?: string[]
    propertyType?: string
    minRooms?: number
  }
  lastInteractionAt?: string
  createdAt: string
}

export interface FacebookGroup {
  id: string
  facebookId: string
  name: string
  url: string
  keywords: string[]
  isActive: boolean
  lastScrapedAt?: string
  createdAt: string
}

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalListings: number
  validListings: number
  totalMatches: number
  recentMatches: number
  recentListings: Listing[]
}
