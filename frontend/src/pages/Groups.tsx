import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Facebook, Trash2, CheckCircle, XCircle, Plus, Link, X, Tag } from 'lucide-react'
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

function extractGroupId(input: string): string {
  const trimmed = input.trim()
  // Handle full URLs: https://facebook.com/groups/123456 or https://www.facebook.com/groups/my-group-name
  const urlMatch = trimmed.match(/facebook\.com\/groups\/([^/?&#]+)/)
  if (urlMatch) return urlMatch[1]
  // Otherwise treat as raw ID
  return trimmed
}

export default function Groups() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [groupInput, setGroupInput] = useState('')
  const [groupName, setGroupName] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [addError, setAddError] = useState('')

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groupes Facebook</h1>
          <p className="text-gray-500 mt-1">
            Ajoutez des groupes Facebook à surveiller. Les posts seront automatiquement scrapés, classifiés par IA, et envoyés aux utilisateurs correspondants.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un groupe
          </button>
        )}
      </div>

      {/* Add Group Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ajouter un groupe Facebook</h2>
            <button
              onClick={() => { setShowAddForm(false); setAddError('') }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Link className="w-4 h-4 inline mr-1" />
                URL ou ID du groupe Facebook
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://facebook.com/groups/123456789  ou  123456789"
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
              />
              {groupInput && (
                <p className="text-xs text-gray-400 mt-1">
                  ID extrait : <span className="font-mono text-gray-600">{extractGroupId(groupInput)}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du groupe
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ex: Location Appartement Libreville"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4 inline mr-1" />
                Mots-clés de filtrage (séparés par des virgules)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="location, appartement, maison, studio, villa"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Seuls les posts contenant au moins un de ces mots-clés seront récupérés. Laissez vide pour tout récupérer.
              </p>
            </div>

            {keywordsInput && (
              <div className="flex flex-wrap gap-2">
                {keywordsInput.split(',').map(k => k.trim()).filter(k => k).map((keyword, idx) => (
                  <span key={idx} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
                    {keyword}
                  </span>
                ))}
              </div>
            )}

            {addError && (
              <p className="text-sm text-red-600">{addError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddForm(false); setAddError('') }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={!extractGroupId(groupInput) || !groupName.trim() || addGroup.isPending}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
          <p className="text-sm mt-1">Ajoutez votre premier groupe Facebook pour commencer la surveillance</p>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 inline-flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un groupe
            </button>
          )}
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
                    <p className="text-sm text-gray-500 font-mono">{group.groupId}</p>
                  </div>
                </div>
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

              {group.description && (
                <p className="text-sm text-gray-600 mb-4">{group.description}</p>
              )}

              {group.keywords.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Mots-clés :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.keywords.map((keyword, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {group.lastScrapedAt ? (
                    <p>Dernier scan : {new Date(group.lastScrapedAt).toLocaleDateString('fr-FR')}</p>
                  ) : (
                    <p>Pas encore scanné</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Supprimer ce groupe ?')) {
                      deleteGroup.mutate(group.id)
                    }
                  }}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
