import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Home, 
  Settings, 
  LogOut,
  Facebook,
  Activity
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Utilisateurs', href: '/users', icon: Users },
  { name: 'Annonces', href: '/listings', icon: Home },
  { name: 'Groupes FB', href: '/groups', icon: Facebook },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary-600">ImmoAlert</h1>
          <p className="text-xs text-gray-500 mt-1">SaaS Immobilier WhatsApp</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center px-4 py-3 text-sm font-medium text-green-600">
            <Activity className="w-5 h-5 mr-3" />
            Système Opérationnel
          </div>
          <button className="flex items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full mt-2">
            <LogOut className="w-5 h-5 mr-3" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
