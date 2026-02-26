import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, MoreVertical, Phone, MapPin, Euro } from 'lucide-react'
import { api } from '../services/api'

export default function Users() {
  const [searchTerm, setSearchTerm] = useState('')
  const [page] = useState(1)
  
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, searchTerm],
    queryFn: () => api.get(`/users?page=${page}&search=${searchTerm}`).then(res => res.data),
  })

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const users = usersData?.users || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom ou téléphone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Utilisateur</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Critères</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Matchs</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Activité</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user: any) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                      {user.name?.charAt(0) || user.whatsappNumber.charAt(3)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name || 'Anonyme'}</div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {user.whatsappNumber}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <span>{user.criteria?.propertyType === 'HOUSE' ? '🏠 Maison' : user.criteria?.propertyType === 'APARTMENT' ? '🏢 Appart' : '🏠🏢 Les deux'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Euro className="w-3 h-3 mr-1" />
                      {user.criteria?.minPrice}€ - {user.criteria?.maxPrice}€
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-3 h-3 mr-1" />
                      {user.criteria?.locations?.join(', ') || 'Non défini'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                  {user._count?.matches || 0}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(user.lastInteraction).toLocaleString('fr-FR', { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun utilisateur trouvé
          </div>
        )}
      </div>
    </div>
  )
}
