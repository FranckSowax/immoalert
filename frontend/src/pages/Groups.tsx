import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Facebook, Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react'
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

export default function Groups() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGroup, setNewGroup] = useState({ groupId: '', name: '', keywords: '' })
  
  const queryClient = useQueryClient()
  
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/admin/groups').then(res => res.data),
  })

  const addGroup = useMutation({
    mutationFn: (group: any) => api.post('/admin/groups', group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setShowAddModal(false)
      setNewGroup({ groupId: '', name: '', keywords: '' })
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groupes Facebook</h1>
          <p className="text-gray-500 mt-1">Gestion des groupes surveillés</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un groupe
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups?.map((group: Group) => (
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
              <div className="flex space-x-2">
                <button className="text-gray-400 hover:text-gray-600">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => deleteGroup.mutate(group.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {groups?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Facebook className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Aucun groupe configuré</p>
          <p className="text-sm">Ajoutez votre premier groupe Facebook à surveiller</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Ajouter un groupe</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID du groupe
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="123456789"
                  value={newGroup.groupId}
                  onChange={(e) => setNewGroup({ ...newGroup, groupId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du groupe
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Location Paris"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mots-clés (séparés par des virgules)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="location, appartement, maison"
                  value={newGroup.keywords}
                  onChange={(e) => setNewGroup({ ...newGroup, keywords: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => addGroup.mutate({
                  groupId: newGroup.groupId,
                  name: newGroup.name,
                  keywords: newGroup.keywords.split(',').map(k => k.trim()).filter(k => k),
                })}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                disabled={!newGroup.groupId || !newGroup.name}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
