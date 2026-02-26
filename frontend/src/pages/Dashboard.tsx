import type { Listing } from '../types'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  Home, 
  MessageCircle, 
  TrendingUp,
  Activity,
  Play,
  Brain,
  Heart
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../services/api.ts'

const chartData = [
  { name: 'Lun', annonces: 120, matchs: 45 },
  { name: 'Mar', annonces: 132, matchs: 52 },
  { name: 'Mer', annonces: 101, matchs: 38 },
  { name: 'Jeu', annonces: 134, matchs: 61 },
  { name: 'Ven', annonces: 190, matchs: 85 },
  { name: 'Sam', annonces: 230, matchs: 102 },
  { name: 'Dim', annonces: 210, matchs: 95 },
]

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((res: { data: any }) => res.data),
    refetchInterval: 30000,
  })

  const handleTriggerAction = async (action: string) => {
    try {
      await api.post(`/admin/actions/${action}`)
      alert(`Action ${action} déclenchée avec succès`)
    } catch (error) {
      alert(`Erreur lors du déclenchement de ${action}`)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const dashboardStats = stats || {
    users: { total: 0, active: 0, newThisWeek: 0 },
    listings: { total: 0, valid: 0, enriched: 0, last24h: 0 },
    matches: { total: 0, notified: 0, viewed: 0, interestedMatches: 0, avgMatchScore: 0 },
  }

  const statCards = [
    { 
      name: 'Utilisateurs Actifs', 
      value: dashboardStats.users?.active?.toLocaleString() || '0', 
      icon: Users, 
      change: `+${dashboardStats.users?.newThisWeek || 0} cette semaine`,
      color: 'blue'
    },
    { 
      name: 'Annonces Scrapées', 
      value: dashboardStats.listings?.total?.toLocaleString() || '0', 
      icon: Home, 
      change: `+${dashboardStats.listings?.last24h || 0} aujourd'hui`,
      color: 'green'
    },
    { 
      name: 'Matchs Envoyés', 
      value: dashboardStats.matches?.notified?.toLocaleString() || '0', 
      icon: MessageCircle, 
      change: `${dashboardStats.matches?.viewed || 0} vus`,
      color: 'purple'
    },
    { 
      name: 'Score Moyen', 
      value: `${Math.round(dashboardStats.matches?.avgMatchScore || 0)}%`, 
      icon: TrendingUp, 
      change: 'Qualité des matchs',
      color: 'orange'
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble en temps réel</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
            <Activity className="w-4 h-4 mr-1" />
            Système Opérationnel
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button 
          onClick={() => handleTriggerAction('scrape')}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Play className="w-4 h-4 mr-2" />
          Lancer Scrape
        </button>
        <button 
          onClick={() => handleTriggerAction('enrich')}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Brain className="w-4 h-4 mr-2" />
          Enrichir IA
        </button>
        <button 
          onClick={() => handleTriggerAction('match')}
          className="flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
        >
          <Heart className="w-4 h-4 mr-2" />
          Lancer Matching
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-${stat.color}-50`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité sur 7 jours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Line type="monotone" dataKey="annonces" stroke="#3b82f6" strokeWidth={2} name="Annonces scrapées" />
              <Line type="monotone" dataKey="matchs" stroke="#10b981" strokeWidth={2} name="Matchs envoyés" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dernières Activités</h3>
          <div className="space-y-4">
            {stats?.recentListings?.slice(0, 5).map((listing: Listing) => (
              <div key={listing.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${listing.isValid ? 'bg-green-100' : 'bg-red-100'}`}>
                    {listing.isValid ? (
                      <Activity className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {listing.title || 'Annonce sans titre'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {listing.location} • {listing.price}€
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {listing._count?.matches || 0} matchs
                </span>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-8">Aucune activité récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
