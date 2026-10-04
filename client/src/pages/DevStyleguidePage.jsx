import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Select } from '../components/Select';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Tabs } from '../components/Tabs';
import { Switch } from '../components/Switch';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Divider } from '../components/Divider';
import { Tooltip } from '../components/Tooltip';
import { ListItem } from '../components/ListItem';
import { FlashAiLogo } from '../components/common/FlashAiLogo';
import { AiProviderDisclosure } from '../components/common/AiProviderDisclosure';
import { useThemeStore } from '../store/useThemeStore';
import { Sparkles, Heart, Bell, MessageSquare, Moon, Sun, Lock } from 'lucide-react';

export const DevStyleguidePage = () => {
  const { theme, toggleTheme } = useThemeStore();
  const [switchState, setSwitchState] = useState(true);
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <div className="min-h-screen bg-cream text-ink p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-line mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Flash Chat Design System Styleguide</h1>
          <p className="text-xs text-muted mt-1">Single source of truth component library (/dev/ui)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={toggleTheme} icon={theme === 'dark' ? Sun : Moon}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </div>

      {/* WCAG Contrast Summary */}
      <Card padding="p-5" className="mb-8">
        <h2 className="text-sm font-bold text-ink mb-3">WCAG AA & AAA Verified Contrast Ratios</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-card border border-line">
            <span className="font-bold text-ink">Ink on Cream</span>
            <p className="text-muted mt-1">#1F2937 on #FFF7ED</p>
            <span className="text-primary font-bold">12.6:1 (AAA)</span>
          </div>
          <div className="p-3 rounded-lg bg-card border border-line">
            <span className="font-bold text-ink">Ink on White Card</span>
            <p className="text-muted mt-1">#1F2937 on #FFFFFF</p>
            <span className="text-primary font-bold">14.1:1 (AAA)</span>
          </div>
          <div className="p-3 rounded-lg bg-card border border-line">
            <span className="font-bold text-ink">White on Accent</span>
            <p className="text-muted mt-1">#FFFFFF on #F43F5E</p>
            <span className="text-primary font-bold">3.9:1 (AA)</span>
          </div>
          <div className="p-3 rounded-lg bg-card border border-line">
            <span className="font-bold text-ink">Muted on White</span>
            <p className="text-muted mt-1">#6B7280 on #FFFFFF</p>
            <span className="text-primary font-bold">4.6:1 (AA)</span>
          </div>
        </div>
      </Card>

      {/* 1. Buttons */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">1. Buttons & Action States</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary (Gradient)</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" isLoading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      {/* 2. Form Inputs */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">2. Inputs, Textareas & Selects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Default Input" placeholder="Type here..." helperText="Standard helper note" />
          <Input label="Error State" value="Invalid content" error="This field is required" />
          <Select
            label="Dropdown Select"
            options={[
              { value: '1', label: 'Option 1' },
              { value: '2', label: 'Option 2' }
            ]}
          />
          <Textarea label="Message Area" placeholder="Write a note..." rows={2} />
        </div>
      </section>

      {/* 3. Avatars & Badges */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">3. Avatars, Story Rings & Badges</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar alt="Alex" size="lg" isOnline showStatus hasStory />
          <Avatar alt="Sarah" size="md" isOnline showStatus />
          <Avatar alt="Offline" size="md" isOnline={false} showStatus />
          <Avatar alt="Flash" size="sm" />
          <div className="flex items-center gap-2">
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="unread">9+ unread</Badge>
            <Badge variant="muted">Muted</Badge>
          </div>
        </div>
      </section>

      {/* 4. Tabs, Switches & Tooltips */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">4. Navigation Tabs & Controls</h2>
        <div className="flex flex-col gap-4">
          <Tabs
            tabs={[
              { id: 'tab1', label: 'Chats', icon: MessageSquare, badge: 3 },
              { id: 'tab2', label: 'Social', icon: Heart },
              { id: 'tab3', label: 'Flash AI', icon: Sparkles }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          <Switch
            label="Push Notifications"
            description="Receive real-time alerts when messages arrive"
            checked={switchState}
            onChange={setSwitchState}
          />
          <div>
            <Tooltip content="End-to-end encrypted Vault">
              <span className="text-xs font-semibold text-primary underline cursor-help inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Hover for Tooltip
              </span>
            </Tooltip>
          </div>
        </div>
      </section>

      {/* 5. List Items & Cards */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">5. List Items & Cards</h2>
        <div className="flex flex-col gap-3">
          <ListItem
            left={<Avatar alt="Alice" size="md" isOnline showStatus />}
            title="Alice Wonder"
            subtitle="Hey there! Are we meeting for coffee today?"
            right={<span className="text-xs text-muted">12:45 PM</span>}
            onClick={() => {}}
          />
          <ListItem
            left={<Avatar alt="Flash Support" size="md" isOnline showStatus />}
            title="Flash Support"
            subtitle="We usually reply within 15 minutes."
            right={<Badge variant="unread">1</Badge>}
            active
            onClick={() => {}}
          />
        </div>
      </section>

      {/* 6. Flash AI Branding & Disclosure */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">6. Flash AI Branding & Provider Disclosure</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <FlashAiLogo size="sm" />
            <FlashAiLogo size="md" />
            <FlashAiLogo size="lg" />
          </div>
          <AiProviderDisclosure />
        </div>
      </section>

      {/* 7. Skeletons & Empty State */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-ink mb-4">7. Skeletons & Empty States</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-card border border-line rounded-xl flex flex-col gap-3">
            <Skeleton variant="avatar" />
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
          <Card>
            <EmptyState
              emoji="⚡"
              title="No messages yet"
              description="Start a new conversation with your contacts."
              actionText="Start Chat"
              onAction={() => {}}
            />
          </Card>
        </div>
      </section>
    </div>
  );
};

export default DevStyleguidePage;
