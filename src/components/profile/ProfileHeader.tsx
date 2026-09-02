import { useState } from "react";
import { Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "./AvatarUpload";
import { NotificationsDialog } from "./NotificationsDialog";

interface ProfileHeaderProps {
  name: string;
  email: string;
  avatarUrl?: string;
  church: string;
  onAvatarUpdate?: (url: string) => void;
}

export function ProfileHeader({ name, email, avatarUrl, church, onAvatarUpdate }: ProfileHeaderProps) {
  const [currentAvatar, setCurrentAvatar] = useState(avatarUrl);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleAvatarUpdate = (url: string) => {
    setCurrentAvatar(url);
    onAvatarUpdate?.(url);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 sirvo-gradient-bg opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      
      {/* Content */}
      <div className="relative px-4 sm:px-6 pt-12 pb-8">
        <div className="flex items-start justify-between mb-6">
          <Button 
            variant="glass" 
            size="icon-sm"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="glass" size="icon-sm">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center text-center">
          <AvatarUpload
            currentAvatarUrl={currentAvatar}
            userName={name}
            onUploadComplete={handleAvatarUpdate}
          />
          <h1 className="text-2xl font-bold text-primary-foreground mb-1 mt-4">{name}</h1>
          <p className="text-sm text-primary-foreground/80">{email}</p>
          <div className="mt-3 px-4 py-1.5 bg-card/20 backdrop-blur-sm rounded-full">
            <p className="text-xs font-medium text-primary-foreground">{church}</p>
          </div>
        </div>
      </div>

      <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </div>
  );
}