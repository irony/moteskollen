import React from 'react';
import { History, MessageSquare, Settings, LogOut, Home, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  onLogout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  onLogout
}) => {
  const { setOpenMobile } = useSidebar();

  const handleItemClick = (action: () => void) => {
    action();
    setOpenMobile(false); // Stäng sidebar på mobil efter klick
  };

  const menuItems = [
    {
      id: 'settings',
      title: 'Inställningar',
      icon: Settings,
      action: () => {}, // TODO: Implement settings
      disabled: true
    },
    {
      id: 'search',
      title: 'Sök & AI-chat',
      icon: MessageSquare,
      action: () => {
        // Trigga Cmd+K event
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true
        });
        document.dispatchEvent(event);
      },
      description: 'Tryck Cmd+K'
    },
  ];

  const settingsItems = [
    {
      id: 'logout',
      title: 'Logga ut',
      icon: LogOut,
      action: onLogout,
      variant: 'destructive' as const
    }
  ];

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarContent className="bg-background">
        {/* Huvud-sektion */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold text-foreground">
            Möteskollen
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    onClick={() => handleItemClick(item.action)}
                    disabled={item.disabled}
                    className={`w-full justify-start text-left transition-colors ${
                      item.disabled 
                        ? 'bg-muted/50 text-muted-foreground cursor-default' 
                        : 'hover:bg-muted/80'
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3 text-muted-foreground" />
                    <span className="flex-1">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Inställningar-sektion */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Inställningar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    onClick={() => handleItemClick(item.action)}
                    className={`w-full justify-start text-left transition-colors ${
                      item.variant === 'destructive' 
                        ? 'text-destructive hover:bg-destructive/10' 
                        : 'hover:bg-muted/80'
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GDPR-information längst ner */}
        <div className="p-4 border-t border-border/30">
          <div className="flex items-center text-xs text-muted-foreground">
            <FileText className="w-3 h-3 mr-2" />
            <span>100% GDPR-kompatibel</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All data bearbetas inom Sverige
          </p>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};