import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Facebook, Trash2, CheckCircle, XCircle, Plus, Link, X, Tag, Search, Loader2, Users, RefreshCw, ExternalLink, ChevronDown, ChevronUp, Image } from 'lucide-react'
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
  totalPosts?: number
  validPosts?: number
}

interface SearchResult {
  id?: string
  name?: string
  description?: string
  members_count?: number
  privacy?: string
  url?: string
  image?: { uri?: string }
}

interface ScrapedListing {
  id: string
  originalText: string
  postUrl?: string
  authorName?: string
  images: string[]
  postedAt?: string
  scrapedAt: string
}

interface ScrapeResult {
  success: boolean
  totalPosts: number
  newPosts: number
  listings: ScrapedListing[]
}

function extractGroupId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/facebook\.com\/groups\/([^/?&#]+)/)
  if (urlMatch) return urlMatch[1]
  return trimmed
}

export default function Groups() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [groupInput, setGroupInput] = useState('')
  const [groupName, setGroupName] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [addError, setAddError] = useState('')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Scan state per group
  const [scanningGroupId, setScanningGroupId] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<Record<string, ScrapeResult>>({})
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

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
      setShowAddForm(false)
      setGroupInput('')
      setGroupName('')
      setKeywordsInput('')
      setAddError('')
    },
    onError: () => {
      setAddError('Erreur lors de l\'ajout. Ce groupe existe peut-être déjà.')
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  const toggleGroup = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/groups/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  const handleAdd = () => {
    const groupId = extractGroupId(groupInput)
    if (!groupId || !groupName.trim()) return

    const keywords = keywordsInput
      .split(',')
      .map(k => k.trim())
      .filter(k => k)

    addGroup.mutate({ groupId, name: groupName.trim(), keywords })
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const res = await api.get('/admin/groups/search', { params: { q: searchQuery } })
      const data = res.data
      const results = data?.results || data?.groups || data?.data || []
      setSearchResults(Array.isArray(results) ? results : [])
      if (Array.isArray(results) && results.length === 0) {
        setSearchError('Aucun groupe trouvé. Essayez d\'autres mots-clés ou ajoutez le groupe manuellement.')
      }
    } catch {
      setSearchError('Erreur lors de la recherche. Vérifiez la clé API RapidAPI.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddFromSearch = (result: SearchResult) => {
    const groupId = result.id || ''
    const name = result.name || 'Groupe Facebook'
    if (!groupId) return
    const alreadyMonitored = groups.some(g => g.groupId === groupId)
    if (alreadyMonitored) return
    addGroup.mutate({ groupId, name, keywords: [] })
  }

  const handleScanGroup = async (groupId: string) => {
    setScanningGroupId(groupId)
    try {
      const res = await api.post(`/admin/groups/${groupId}/scrape`)
      setScanResults(prev => ({ ...prev, [groupId]: res.data }))
      setExpandedGroup(groupId)
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    } catch {
      setScanResults(prev => ({
        ...prev,
        [groupId]: { success: false, totalPosts: 0, newPosts: 0, listings: [] },
      }))
      setExpandedGroup(groupId)
    } finally {
      setScanningGroupId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groupes Facebook</h1>
          <p className="text-gray-500 mt-1">
            Recherchez ou ajoutez des groupes Facebook à surveiller.
          </p>
        </div>
        <div className="flex gap-2">
          {!showSearch && (
            <button
              onClick={() => { setShowSearch(true); setShowAddForm(false) }}
              className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </button>
          )}
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setShowSearch(false) }}
              className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajout manuel
            </button>
          )}
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Rechercher des groupes Facebook</h2>
            <button
              onClick={() => { setShowSearch(false); setSearchResults([]); setSearchError('') }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: immobilier Libreville, location appartement Gabon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" />Rechercher</>}
            </button>
          </div>
          {searchError && <p className="text-sm text-amber-600 mt-3">{searchError}</p>}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-500">{searchResults.length} groupe(s) trouvé(s)</p>
              {searchResults.map((result, idx) => {
                const isMonitored = groups.some(g => g.groupId === result.id)
                return (
                  <div key={result.id || idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {result.image?.uri ? (
                        <img src={result.image.uri} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="p-2 bg-blue-100 rounded-lg"><Facebook className="w-6 h-6 text-blue-600" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{result.name || 'Groupe sans nom'}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {result.members_count && <span className="flex items-center"><Users className="w-3 h-3 mr-1" />{result.members_count.toLocaleString()} membres</span>}
                          {result.privacy && <span>{result.privacy}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddFromSearch(result)}
                      disabled={isMonitored || addGroup.isPending}
                      className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isMonitored ? 'bg-green-100 text-green-700 cursor-default' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'}`}
                    >
                      {isMonitored ? 'Surveillé' : 'Ajouter'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Group Form (Manual) */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ajouter un groupe manuellement</h2>
            <button onClick={() => { setShowAddForm(false); setAddError('') }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Link className="w-4 h-4 inline mr-1" />URL ou ID du groupe Facebook</label>
              <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="https://facebook.com/groups/123456789  ou  123456789" value={groupInput} onChange={(e) => setGroupInput(e.target.value)} />
              {groupInput && <p className="text-xs text-gray-400 mt-1">ID extrait : <span className="font-mono text-gray-600">{extractGroupId(groupInput)}</span></p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du groupe</label>
              <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Ex: Location Appartement Libreville" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Tag className="w-4 h-4 inline mr-1" />Mots-clés de filtrage (séparés par des virgules)</label>
              <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="location, appartement, maison, studio, villa" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Seuls les posts contenant au moins un de ces mots-clés seront récupérés. Laissez vide pour tout récupérer.</p>
            </div>
            {keywordsInput && (
              <div className="flex flex-wrap gap-2">
                {keywordsInput.split(',').map(k => k.trim()).filter(k => k).map((keyword, idx) => (
                  <span key={idx} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">{keyword}</span>
                ))}
              </div>
            )}
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowAddForm(false); setAddError('') }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={handleAdd} disabled={!extractGroupId(groupInput) || !groupName.trim() || addGroup.isPending} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {addGroup.isPending ? 'Ajout en cours...' : 'Ajouter et surveiller'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          <Facebook className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Aucun groupe surveillé</p>
          <p className="text-sm mt-1">Recherchez ou ajoutez votre premier groupe Facebook</p>
          <div className="mt-4 flex justify-center gap-3">
            {!showSearch && <button onClick={() => setShowSearch(true)} className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"><Search className="w-4 h-4 mr-2" />Rechercher</button>}
            {!showAddForm && <button onClick={() => setShowAddForm(true)} className="inline-flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"><Plus className="w-4 h-4 mr-2" />Ajout manuel</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group: Group) => {
            const isScanning = scanningGroupId === group.id
            const result = scanResults[group.id]
            const isExpanded = expandedGroup === group.id

            return (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Facebook className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{group.groupId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScanGroup(group.id)}
                        disabled={isScanning}
                        className="flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        title="Scanner ce groupe"
                      >
                        {isScanning ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                        )}
                        {isScanning ? 'Scan...' : 'Scanner'}
                      </button>
                      <button
                        onClick={() => toggleGroup.mutate({ id: group.id, isActive: !group.isActive })}
                        title={group.isActive ? 'Désactiver' : 'Activer'}
                        className="cursor-pointer"
                      >
                        {group.isActive ? (
                          <CheckCircle className="w-5 h-5 text-green-500 hover:text-green-700" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 hover:text-red-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {group.keywords.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1.5">
                        {group.keywords.map((keyword, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{group.lastScrapedAt ? `Dernier scan : ${new Date(group.lastScrapedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Pas encore scanné'}</span>
                      {group.totalPosts != null && group.totalPosts > 0 && (
                        <span>{group.totalPosts} posts</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result && (
                        <button
                          onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                          className="flex items-center text-xs text-primary-600 hover:text-primary-800"
                        >
                          {result.listings.length} annonce(s)
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm('Supprimer ce groupe ?')) deleteGroup.mutate(group.id) }}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Scan result summary */}
                  {result && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${result.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                      {result.success ? (
                        <span>{result.totalPosts} post(s) récupéré(s), <strong>{result.newPosts} nouvelle(s) annonce(s)</strong></span>
                      ) : (
                        <span>Erreur lors du scan. Vérifiez l'ID du groupe.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded listings */}
                {isExpanded && result && result.listings.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Annonces récupérées</h4>
                      <a
                        href={`/listings?groupId=${group.id}`}
                        className="text-xs text-primary-600 hover:text-primary-800 flex items-center"
                      >
                        Voir tout <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {result.listings.map((listing) => (
                        <div key={listing.id} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex gap-4">
                            {/* Images */}
                            {listing.images.length > 0 && (
                              <div className="flex-shrink-0 flex gap-1">
                                {listing.images.slice(0, 2).map((img, i) => (
                                  <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                ))}
                                {listing.images.length > 2 && (
                                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                    <Image className="w-4 h-4 mr-0.5" />+{listing.images.length - 2}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 line-clamp-3">{listing.originalText}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                {listing.authorName && <span>{listing.authorName}</span>}
                                {listing.postedAt && <span>{new Date(listing.postedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                {listing.postUrl && (
                                  <a href={listing.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center">
                                    Voir sur FB <ExternalLink className="w-3 h-3 ml-0.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
