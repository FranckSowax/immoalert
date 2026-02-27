import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, ExternalLink, CheckCircle, XCircle, Brain } from 'lucide-react'
import { api } from '../services/api'

export default function Listings() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  
  const { data: listingsData, isLoading } = useQuery({
    queryKey: ['listings', searchTerm, filter],
    queryFn: () => api.get(`/admin/listings?search=${searchTerm}&isValid=${filter === 'valid' ? 'true' : filter === 'invalid' ? 'false' : ''}`).then(res => res.data),
  })

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const listings = listingsData?.listings || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Annonces Scrapées</h1>
          <p className="text-gray-500 mt-1">Gestion des annonces immobilières</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une annonce..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 border border-gray-200 rounded-lg"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Toutes</option>
            <option value="valid">Validées</option>
            <option value="invalid">Invalides</option>
          </select>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4 mr-2" />
            Filtres avancés
          </button>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing: any) => (
          <div key={listing.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {listing.isValid ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    listing.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {listing.isValid ? 'Valide' : 'Invalide'}
                  </span>
                </div>
                {listing.aiEnriched && (
                  <span className="flex items-center text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                    <Brain className="w-3 h-3 mr-1" />
                    IA
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {listing.title || 'Sans titre'}
              </h3>

              <div className="space-y-2 text-sm text-gray-600">
                {listing.price && (
                  <p className="font-semibold text-primary-600">{listing.price.toLocaleString()} FCFA</p>
                )}
                {listing.location && <p>📍 {listing.location}</p>}
                {listing.surface && <p>📐 {listing.surface}m²</p>}
                {listing.rooms && <p>🚪 {listing.rooms} pièces</p>}
              </div>

              <p className="text-sm text-gray-500 mt-4 line-clamp-3">
                {listing.originalText?.substring(0, 150)}...
              </p>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  {listing._count?.matches || 0} matchs
                </span>
                <div className="flex space-x-2">
                  <button className="text-primary-600 hover:text-primary-800">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {listings.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Aucune annonce trouvée
        </div>
      )}
    </div>
  )
}
