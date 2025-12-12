'use client';

export interface SubTab {
  id: string;
  label: string;
  description?: string;  // Tooltip or subtitle
  count?: number;        // Badge for issues count
  status?: 'good' | 'warning' | 'issue';
}

interface SubTabsProps {
  tabs: SubTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function SubTabs({ tabs, activeTab, onChange }: SubTabsProps) {
  const getStatusColor = (status?: 'good' | 'warning' | 'issue') => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'issue': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getCountBadgeColor = (status?: 'good' | 'warning' | 'issue') => {
    switch (status) {
      case 'issue': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              group relative px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${isActive 
                ? 'bg-purple-100 text-purple-700 shadow-sm' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }
            `}
            title={tab.description}
          >
            <div className="flex items-center gap-2">
              {/* Status dot */}
              {tab.status && (
                <span className={`w-2 h-2 rounded-full ${getStatusColor(tab.status)}`} />
              )}
              
              {/* Label */}
              <span>{tab.label}</span>
              
              {/* Count badge */}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`
                  px-1.5 py-0.5 text-xs rounded-full font-medium
                  ${getCountBadgeColor(tab.status)}
                `}>
                  {tab.count}
                </span>
              )}
            </div>
            
            {/* Active indicator */}
            {isActive && (
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Helper to determine overall status from multiple checkpoints
export function getWorstStatus(statuses: ('good' | 'warning' | 'issue')[]): 'good' | 'warning' | 'issue' {
  if (statuses.includes('issue')) return 'issue';
  if (statuses.includes('warning')) return 'warning';
  return 'good';
}

// Helper to count issues/warnings
export function countIssues(statuses: ('good' | 'warning' | 'issue')[]): number {
  return statuses.filter(s => s === 'issue' || s === 'warning').length;
}
