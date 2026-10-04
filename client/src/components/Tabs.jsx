import React from 'react';

export const Tabs = ({
  tabs = [], // [{ id, label, icon: Icon, badge }]
  activeTab,
  onChange,
  className = '',
  variant = 'pills' // 'pills' | 'underline'
}) => {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-line gap-4 ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 text-sm font-semibold border-b-2 transition relative ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {Icon && (React.isValidElement(Icon) ? Icon : <Icon className="w-4 h-4" />)}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-accent text-white font-bold rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default 'pills' style
  return (
    <div className={`inline-flex p-1 bg-card border border-line rounded-xl gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              isActive
                ? 'bg-brand-gradient text-white shadow-soft'
                : 'text-muted hover:text-ink hover:bg-cream'
            }`}
          >
            {Icon && (React.isValidElement(Icon) ? Icon : <Icon className="w-3.5 h-3.5" />)}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 font-bold rounded-full ${isActive ? 'bg-white text-primary' : 'bg-accent text-white'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
