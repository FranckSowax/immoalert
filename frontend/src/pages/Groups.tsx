import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Facebook, Search, Trash2, CheckCircle, XCircle, Users, Eye, Loader2 } from 'lucide-react'
import { api } from '../services/api'

interface Group {
  id: string
  groupId: string
  name: string
  description?: string
  keywords: string[]
  isActive: boolean
  priority: number
  lastScrapedAt?: string
}

interface SearchResult {
  id?: string
  group_id?: string
  name?: string
  title?: string
  description?: string
  members?: number
  member_count?: number
  privacy?: string
  url?: string
  image?: string
}

export default function Groups() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null)
  const [keywordsInput, setKeywordsInput] = useState('')

  const queryClient = useQueryClient()

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/admin/groups').then(res => res.data),
  })

  const groups: Group[] = Array.isArray(groupsData) ? groupsData : groupsData?.groups || []

  const addGroup = useMutation({
    mutationFn: (group: any) => api.post('/admin/groups', group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setSavingGroupId(null)
      setKeywordsInput('')
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  const savedGroupIds = groups.map(g => g.groupId)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      const params = new URLSearchParams({ q: searchQuery.trim() })
      if (searchLocation.trim()) {
        params.set('location', searchLocation.trim())
      }
      const res = await api.get(`/admin/groups/search?${params}`)
      const data = res.data
      const results = Array.isArray(data) ? data : data?.data || data?.results || data?.groups || []
      setSearchResults(results)
      if (results.length === 0) {
        setSearchError('Aucun groupe trouvé pour cette recherche.')
      }
    } catch {
      setSearchError('Erreur lors de la recherche. Vérifiez la connexion API.')
    } finally {
      setIsSearching(false)
    }
  }

  const getResultId = (result: SearchResult) => result.id || result.group_id || ''
  const getResultName = (result: SearchResult) => result.name || result.title || 'Groupe sans nom'
  const getResultMembers = (result: SearchResult) => result.members || result.member_count || 0

  const handleSaveGroup = (result: SearchResult) => {
    const groupId = getResultId(result)
    const name = getResultName(result)
    const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k)

    addGroup.mutate({ groupId, name, keywords })
  }

  const isAlreadySaved = (result: SearchResult) => savedGroupIds.includes(getResultId(result))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Groupes Facebook</h1>
        <p className="text-gray-500 mt-1">Recherchez et surveillez des groupes Facebook</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rechercher des groupes</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Mots-clés (ex: immobilier, location appartement...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="sm:w-48">
            <input
              type="text"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Ville (optionnel)"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center justify-center bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Rechercher
              </>
            )}
          </button>
        </div>

        {/* Search Error */}
        {searchError && (
          <p className="mt-4 text-sm text-gray-500">{searchError}</p>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {searchResults.length} groupe(s) trouvé(s)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result, idx) => {
                const resultId = getResultId(result)
                const alreadySaved = isAlreadySaved(result)
                const isConfirming = savingGroupId === resultId

                return (
                  <div
                    key={resultId || idx}
                    className={`border rounded-lg p-4 ${alreadySaved ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-primary-300'} transition-colors`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        {result.image ? (
                          <img src={result.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <Facebook className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{getResultName(result)}</h4>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            {getResultMembers(result) > 0 && (
                              <span className="flex items-center">
                                <Users className="w-3 h-3 mr-1" />
                                {getResultMembers(result).toLocaleString('fr-FR')} membres
                              </span>
                            )}
                            {result.privacy && (
                              <span>{result.privacy === 'CLOSED' || result.privacy === 'private' ? 'Privé' : 'Public'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {alreadySaved ? (
                        <span className="flex items-center text-xs text-green-600 font-medium flex-shrink-0 ml-2">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Surveillé
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            if (isConfirming) {
                              setSavingGroupId(null)
                              setKeywordsInput('')
                            } else {
                              setSavingGroupId(resultId)
                              setKeywordsInput(searchQuery)
                            }
                          }}
                          className="flex items-center text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors flex-shrink-0 ml-2"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Surveiller
                        </button>
                      )}
                    </div>

                    {result.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{result.description}</p>
                    )}

                    {/* Save form (inline) */}
                    {isConfirming && !alreadySaved && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Mots-clés de filtrage (séparés par des virgules)
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="location, appartement, maison"
                          value={keywordsInput}
                          onChange={(e) => setKeywordsInput(e.target.value)}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => { setSavingGroupId(null); setKeywordsInput('') }}
                            className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleSaveGroup(result)}
                            disabled={addGroup.isPending}
                            className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                          >
                            {addGroup.isPending ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Saved Groups */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Groupes surveillés ({groups.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            <Facebook className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucun groupe surveillé</p>
            <p className="text-sm">Recherchez des groupes ci-dessus pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group: Group) => (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Facebook className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      <p className="text-sm text-gray-500">ID: {group.groupId}</p>
                    </div>
                  </div>
                  {group.isActive ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {group.description && (
                  <p className="text-sm text-gray-600 mb-4">{group.description}</p>
                )}

                {group.keywords.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Mots-clés:</p>
                    <div className="flex flex-wrap gap-2">
                      {group.keywords.map((keyword, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Priorité: {group.priority}
                    {group.lastScrapedAt && (
                      <p>Dernier scan: {new Date(group.lastScrapedAt).toLocaleDateString('fr-FR')}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteGroup.mutate(group.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
